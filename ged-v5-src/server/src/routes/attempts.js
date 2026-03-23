const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { stringify } = require("csv-stringify/sync");
const router = express.Router();

function remainingSec(attempt) {
  if (!attempt || !attempt.endsAt) return null;
  const ms = new Date(attempt.endsAt).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 1000));
}

async function scoreAndSubmitAttempt(attemptId, studentId, overrideAnswers) {
  let attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (!attempt) throw new Error("Attempt not found");
  if (studentId && attempt.studentId !== studentId) throw new Error("Forbidden");
  if (attempt.status === "SUBMITTED") {
    const quiz0 = await prisma.quiz.findUnique({ where: { id: attempt.quizId } });
    return { attempt, totalPoints: 0, marksReleased: quiz0?.marksReleased || false, alreadySubmitted: true };
  }

  if (overrideAnswers !== undefined) {
    attempt = await prisma.attempt.update({
      where: { id: attempt.id },
      data: { answersJson: JSON.stringify(overrideAnswers || {}) }
    });
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: attempt.quizId },
    include: { questions: { include: { question: true } } }
  });
  if (!quiz) throw new Error("Quiz not found");

  const answers = JSON.parse(attempt.answersJson || "{}");
  let score = 0, totalPoints = 0;

  for (const qq of quiz.questions) {
    const q = qq.question;
    totalPoints += qq.points;
    const key = JSON.parse(q.answerJson);
    const ans = answers[q.id];
    if (ans === undefined) continue;

    if (q.type === "MCQ" && String(ans) === String(key)) score += qq.points;
    else if (q.type === "MULTI_SELECT") {
      const a = Array.isArray(ans) ? [...ans].sort() : [];
      const k = Array.isArray(key) ? [...key].sort() : [];
      if (JSON.stringify(a) === JSON.stringify(k)) score += qq.points;
    } else if (q.type === "NUMERIC" && String(ans).trim() === String(key).trim()) score += qq.points;
    else if (q.type === "SHORT_ANSWER" && String(ans).trim().toLowerCase() === String(key).trim().toLowerCase()) score += qq.points;
    else if (q.type === "REORDER" && JSON.stringify(ans) === JSON.stringify(key)) score += qq.points;
  }

  const submitted = await prisma.attempt.update({
    where: { id: attempt.id },
    data: { status: "SUBMITTED", score, submittedAt: new Date() }
  });

  return { attempt: submitted, totalPoints, marksReleased: quiz.marksReleased, alreadySubmitted: false };
}


// Student: start or resume attempt
router.post("/start", requireAuth, async (req, res) => {
  if (req.user.type !== "STUDENT") return res.status(403).json({ error: "Students only" });
  const { quizId } = req.body || {};
  if (!quizId) return res.status(400).json({ error: "quizId required" });
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz || !quiz.published) return res.status(404).json({ error: "Quiz not found" });

  // Check retake policy
  const submitted = await prisma.attempt.count({ where: { quizId, studentId: req.user.studentId, status: "SUBMITTED" } });
  if (submitted > 0) {
    if (quiz.retakePolicy === "NO_RETAKE") return res.status(403).json({ error: "Retakes not allowed for this quiz" });
    if (quiz.retakePolicy === "LIMITED" && submitted >= quiz.maxRetakes) return res.status(403).json({ error: `Maximum ${quiz.maxRetakes} attempt(s) reached` });
  }

  let attempt = await prisma.attempt.findFirst({ where: { quizId, studentId: req.user.studentId, status: "IN_PROGRESS" } });
  if (!attempt) {
    const endsAt = new Date(Date.now() + quiz.timeLimitMin * 60 * 1000);
    attempt = await prisma.attempt.create({ data: { quizId, studentId: req.user.studentId, status: "IN_PROGRESS", answersJson: "{}", endsAt } });
  }
  const rem = remainingSec(attempt);
  // If time already expired, auto-submit on resume
  if (attempt.status === "IN_PROGRESS" && rem === 0) {
    const r = await scoreAndSubmitAttempt(attempt.id, req.user.studentId);
    return res.json({ attempt: r.attempt, totalPoints: r.totalPoints, marksReleased: r.marksReleased, expired: true, serverRemainingSec: 0 });
  }

  res.json({ attempt, serverRemainingSec: rem });
});


// Student: time sync (server-based timer)
router.get("/:id/time", requireAuth, async (req, res) => {
  if (req.user.type !== "STUDENT") return res.status(403).json({ error: "Students only" });
  const attempt = await prisma.attempt.findUnique({ where: { id: req.params.id } });
  if (!attempt) return res.status(404).json({ error: "Not found" });
  if (attempt.studentId !== req.user.studentId) return res.status(403).json({ error: "Forbidden" });
  const rem = remainingSec(attempt);
  res.json({ remainingSec: rem, endsAt: attempt.endsAt, status: attempt.status });
});

// Autosave
router.patch("/:id/save", requireAuth, async (req, res) => {
  if (req.user.type !== "STUDENT") return res.status(403).json({ error: "Students only" });
  const { answers } = req.body || {};

  const attempt0 = await prisma.attempt.findUnique({ where: { id: req.params.id } });
  if (!attempt0) return res.status(404).json({ error: "Not found" });
  if (attempt0.studentId !== req.user.studentId) return res.status(403).json({ error: "Forbidden" });
  if (attempt0.status === "SUBMITTED") return res.status(409).json({ error: "Already submitted", attempt: attempt0 });

  const rem = remainingSec(attempt0);
  if (rem === 0) {
    // Auto-submit if expired
    const r = await scoreAndSubmitAttempt(attempt0.id, req.user.studentId, answers);
    return res.status(409).json({ error: "Time expired", expired: true, autoSubmitted: true, attempt: r.attempt, totalPoints: r.totalPoints, marksReleased: r.marksReleased, serverRemainingSec: 0 });
  }

  const attempt = await prisma.attempt.update({
    where: { id: attempt0.id },
    data: { answersJson: JSON.stringify(answers || {}) }
  });

  res.json({ attempt, serverRemainingSec: remainingSec(attempt) });
});

// Submit + auto-score (server enforced)
router.post("/:id/submit", requireAuth, async (req, res) => {
  if (req.user.type !== "STUDENT") return res.status(403).json({ error: "Students only" });

  const attempt0 = await prisma.attempt.findUnique({ where: { id: req.params.id } });
  if (!attempt0) return res.status(404).json({ error: "Not found" });
  if (attempt0.studentId !== req.user.studentId) return res.status(403).json({ error: "Forbidden" });

  const answers = (req.body || {}).answers;

  const r = await scoreAndSubmitAttempt(attempt0.id, req.user.studentId, answers);
  res.json({ attempt: r.attempt, totalPoints: r.totalPoints, marksReleased: r.marksReleased, alreadySubmitted: r.alreadySubmitted, expired: remainingSec(attempt0) === 0 });
});

// Teacher: override score

router.patch("/:id/override", requireAuth, requireRole(["ADMIN","TEACHER"]), async (req, res) => {
  const { scoreOverride, overrideNote } = req.body || {};
  if (scoreOverride === undefined) return res.status(400).json({ error: "scoreOverride required" });
  const attempt = await prisma.attempt.update({
    where: { id: req.params.id },
    data: { scoreOverride: Number(scoreOverride), overrideNote: overrideNote || null },
    include: { student: true }
  });
  res.json({ attempt });
});

// Student: my results
router.get("/my-results", requireAuth, async (req, res) => {
  if (req.user.type !== "STUDENT") return res.status(403).json({ error: "Students only" });
  const attempts = await prisma.attempt.findMany({
    where: { studentId: req.user.studentId, status: "SUBMITTED" },
    include: { quiz: { include: { questions: true } } },
    orderBy: { submittedAt: "desc" }
  });
  res.json({ results: attempts.map(a => {
    const totalPoints = a.quiz.questions.reduce((s, qq) => s + qq.points, 0);
    const finalScore = a.scoreOverride ?? a.score;
    return { id: a.id, quizId: a.quizId, quizTitle: a.quiz.title, subject: a.quiz.subject, score: finalScore, totalPoints, marksReleased: a.quiz.marksReleased, submittedAt: a.submittedAt };
  }) });
});

// Teacher: results by class
router.get("/results", requireAuth, requireRole(["ADMIN","TEACHER"]), async (req, res) => {
  const { classId, quizId } = req.query;
  if (!classId) return res.status(400).json({ error: "classId required" });
  const where = { quiz: { classId: String(classId) }, status: "SUBMITTED" };
  if (quizId) where.quizId = quizId;
  const attempts = await prisma.attempt.findMany({
    where, include: { student: true, quiz: { include: { questions: true } } }, orderBy: { submittedAt: "desc" }
  });
  res.json({ attempts: attempts.map(a => {
    const totalPoints = a.quiz.questions.reduce((s, qq) => s + qq.points, 0);
    const finalScore = a.scoreOverride ?? a.score;
    return { id: a.id, quizId: a.quizId, quizTitle: a.quiz.title, quizSubject: a.quiz.subject, marksReleased: a.quiz.marksReleased, studentId: a.studentId, studentName: a.student.displayName, score: finalScore, rawScore: a.score, scoreOverride: a.scoreOverride, overrideNote: a.overrideNote, totalPoints, submittedAt: a.submittedAt };
  }) });
});

// CSV export
router.get("/results.csv", requireAuth, requireRole(["ADMIN","TEACHER"]), async (req, res) => {
  const { classId } = req.query;
  if (!classId) return res.status(400).json({ error: "classId required" });
  const attempts = await prisma.attempt.findMany({
    where: { quiz: { classId: String(classId) }, status: "SUBMITTED" },
    include: { student: true, quiz: { include: { questions: true } } },
    orderBy: [{ student: { displayName: "asc" } }, { submittedAt: "asc" }]
  });
  const records = attempts.map(a => {
    const totalPoints = a.quiz.questions.reduce((s, qq) => s + qq.points, 0);
    const finalScore = a.scoreOverride ?? a.score;
    return { student: a.student.displayName, quiz: a.quiz.title, subject: a.quiz.subject, score: finalScore, totalPoints, percent: totalPoints ? Math.round((finalScore / totalPoints) * 100) + "%" : "N/A", overridden: a.scoreOverride !== null ? "Yes" : "No", submittedAt: a.submittedAt?.toISOString() || "" };
  });
  const csv = stringify(records, { header: true });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=marks.csv");
  res.send(csv);
});

// Review attempt answers (Teacher/Admin always; Students only if marks released)
router.get("/:id/review", requireAuth, async (req, res) => {
  const { id } = req.params;
  const attempt = await prisma.attempt.findUnique({
    where: { id },
    include: {
      student: true,
      quiz: { include: { questions: { include: { question: true }, orderBy: { order: "asc" } }, class: true } }
    }
  });
  if (!attempt) return res.status(404).json({ error: "Not found" });

  const isTeacher = req.user.type === "USER" && (req.user.role === "ADMIN" || req.user.role === "TEACHER");
  const isOwnerStudent = req.user.type === "STUDENT" && req.user.studentId === attempt.studentId;

  if (!isTeacher && !isOwnerStudent) return res.status(403).json({ error: "Forbidden" });

  // Student can only view after marks released
  if (isOwnerStudent && !attempt.quiz.marksReleased) {
    return res.status(403).json({ error: "Marks not released yet" });
  }

  const answers = JSON.parse(attempt.answersJson || "{}");

  const items = (attempt.quiz.questions || []).map(qq => {
    const q = qq.question;
    const studentAnswer = answers[q.id];
    const correctAnswer = JSON.parse(q.answerJson || "null");

    return {
      questionId: q.id,
      order: qq.order,
      points: qq.points,
      subject: q.subject,
      type: q.type,
      prompt: q.prompt,
      choices: q.choicesJson ? JSON.parse(q.choicesJson) : null,
      explanation: q.explanation || "",
      studentAnswer,
      correctAnswer
    };
  });

  const totalPoints = (attempt.quiz.questions || []).reduce((s, qq) => s + (qq.points || 0), 0);
  const finalScore = (attempt.scoreOverride !== null && attempt.scoreOverride !== undefined) ? attempt.scoreOverride : attempt.score;

  res.json({
    attempt: {
      id: attempt.id,
      status: attempt.status,
      score: finalScore,
      totalPoints,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt
    },
    student: { id: attempt.studentId, displayName: attempt.student?.displayName || "" },
    quiz: {
      id: attempt.quiz.id,
      title: attempt.quiz.title,
      subject: attempt.quiz.subject,
      marksReleased: attempt.quiz.marksReleased,
      class: attempt.quiz.class ? { id: attempt.quiz.class.id, name: attempt.quiz.class.name } : null
    },
    items
  });
});

module.exports = router;
