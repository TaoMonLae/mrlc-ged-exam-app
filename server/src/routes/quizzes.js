const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/asyncHandler");
const router = express.Router();

const { stringify: csvStringify } = require("csv-stringify/sync");

// List quizzes (teacher)
router.get("/", requireAuth, requireRole(["ADMIN","TEACHER"]), asyncHandler(async (req, res) => {
  const { classId } = req.query;
  if (!classId) return res.status(400).json({ error: "classId required" });
  const quizzes = await prisma.quiz.findMany({
    where: { classId: String(classId) },
    include: { questions: { include: { question: true }, orderBy: { order: "asc" } }, _count: { select: { attempts: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json({ quizzes: quizzes.map(q => ({
    ...q,
    questionCount: q.questions.length,
    totalPoints: q.questions.reduce((s, qq) => s + qq.points, 0),
    attemptCount: q._count.attempts,
    questions: q.questions.map(qq => ({
      id: qq.id, questionId: qq.questionId, order: qq.order, points: qq.points,
      prompt: qq.question.prompt, type: qq.question.type,
      difficulty: qq.question.difficulty, tags: JSON.parse(qq.question.tags || "[]")
    }))
  })) });
}));


// Duplicate a quiz (Admin/Teacher)
router.post("/:id/duplicate", requireAuth, requireRole(["ADMIN","TEACHER"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: { questions: { orderBy: { order: "asc" } } }
  });
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });

  const copy = await prisma.quiz.create({
    data: {
      classId: quiz.classId,
      subject: quiz.subject,
      title: `${quiz.title} (Copy)`,
      timeLimitMin: quiz.timeLimitMin,
      shuffleQuestions: quiz.shuffleQuestions,
      published: false,
      marksReleased: false,
      retakePolicy: quiz.retakePolicy,
      maxRetakes: quiz.maxRetakes,
      openAt: quiz.openAt,
      closeAt: quiz.closeAt,
    }
  });

  if (quiz.questions && quiz.questions.length) {
    await prisma.quizQuestion.createMany({
      data: quiz.questions.map(q => ({
        quizId: copy.id,
        questionId: q.questionId,
        order: q.order,
        points: q.points
      }))
    });
  }

  res.json({ quiz: copy });
}));


// Export marks for a quiz as CSV (Admin/Teacher)
router.get("/:id/marks.csv", requireAuth, requireRole(["ADMIN","TEACHER"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: { questions: true }
  });
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });

  const attempts = await prisma.attempt.findMany({
    where: { quizId: id, status: "SUBMITTED" },
    include: { student: true },
    orderBy: [{ student: { displayName: "asc" } }, { submittedAt: "asc" }]
  });

  const totalPoints = (quiz.questions || []).reduce((s, qq) => s + (qq.points || 0), 0);

  const records = attempts.map(a => {
    const finalScore = (a.scoreOverride !== null && a.scoreOverride !== undefined) ? a.scoreOverride : a.score;
    return {
      studentName: a.student.displayName,
      score: finalScore,
      totalPoints,
      submittedAt: a.submittedAt
    };
  });

  const csv = csvStringify(records, { header: true });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="quiz-marks-${id}.csv"`);
  res.send(csv);
}));

// Teacher/Admin: list submissions for a quiz
router.get("/:id/submissions", requireAuth, requireRole(["ADMIN","TEACHER"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: { questions: true, class: true }
  });
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });

  const [attempts, enrollments] = await Promise.all([
    prisma.attempt.findMany({
      where: { quizId: id },
      include: { student: true },
      orderBy: [{ status: "asc" }, { submittedAt: "desc" }, { startedAt: "desc" }]
    }),
    quiz.classId
      ? prisma.enrollment.findMany({ where: { classId: quiz.classId }, include: { student: true } })
      : Promise.resolve([])
  ]);

  const totalPoints = (quiz.questions || []).reduce((s, qq) => s + (qq.points || 0), 0);

  // Build set of studentIds who have any attempt
  const attemptedIds = new Set(attempts.map(a => a.studentId));

  // Enrolled students with no attempt at all
  const notStarted = enrollments
    .filter(e => !attemptedIds.has(e.studentId))
    .map(e => ({
      id: null,
      studentId: e.studentId,
      studentName: e.student?.displayName || "Unknown",
      status: "NOT_STARTED",
      score: null,
      scoreOverride: null,
      startedAt: null,
      submittedAt: null
    }));

  const allRows = [
    ...attempts.map(a => ({
      id: a.id,
      studentId: a.studentId,
      studentName: a.student?.displayName || "Unknown",
      status: a.status,
      score: a.score,
      scoreOverride: a.scoreOverride,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt
    })),
    ...notStarted
  ];

  res.json({
    quiz: { id: quiz.id, title: quiz.title, subject: quiz.subject, marksReleased: quiz.marksReleased, published: quiz.published },
    class: quiz.class ? { id: quiz.class.id, name: quiz.class.name } : null,
    totalPoints,
    enrolledCount: enrollments.length,
    attempts: allRows
  });
}));

// Teacher/Admin: release or hide marks for a quiz
router.patch("/:id/marks-release", requireAuth, requireRole(["ADMIN","TEACHER"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { marksReleased } = req.body || {};
  if (typeof marksReleased !== "boolean") return res.status(400).json({ error: "marksReleased must be boolean" });

  const quiz = await prisma.quiz.update({ where: { id }, data: { marksReleased } });
  res.json({ quiz });
}));

// Student: list published quizzes
router.get("/student-list", requireAuth, asyncHandler(async (req, res) => {
  if (req.user.type !== "STUDENT") return res.status(403).json({ error: "Students only" });
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: req.user.studentId }, include: { class: true }
  });
  const classIds = enrollments.map(e => e.classId);
  const now = new Date();
  const quizzes = await prisma.quiz.findMany({
    where: { classId: { in: classIds }, published: true },
    include: { class: true, _count: { select: { questions: true } } },
    orderBy: { createdAt: "desc" }
  });
  const attempts = await prisma.attempt.findMany({
    where: { studentId: req.user.studentId, quizId: { in: quizzes.map(q => q.id) } },
    orderBy: { startedAt: "desc" }
  });
  // Build attempt map: quizId -> best/latest attempt
  const attemptMap = {};
  for (const a of attempts) {
    if (!attemptMap[a.quizId]) attemptMap[a.quizId] = [];
    attemptMap[a.quizId].push(a);
  }
  res.json({ quizzes: quizzes.map(q => {
    const qAttempts = attemptMap[q.id] || [];
    const submitted = qAttempts.filter(a => a.status === "SUBMITTED");
    const inProgress = qAttempts.find(a => a.status === "IN_PROGRESS");
    // Check scheduling
    const notYetOpen = q.openAt && new Date(q.openAt) > now;
    const closed = q.closeAt && new Date(q.closeAt) < now;
    // Check retake availability
    let canRetake = false;
    if (submitted.length > 0) {
      if (q.retakePolicy === "ALLOW_RETAKE") canRetake = true;
      else if (q.retakePolicy === "LIMITED" && submitted.length < q.maxRetakes) canRetake = true;
    }
    const latestSubmitted = submitted[0] || null;
    return {
      id: q.id, title: q.title, subject: q.subject, timeLimitMin: q.timeLimitMin,
      marksReleased: q.marksReleased, className: q.class.name, classId: q.classId,
      questionCount: q._count.questions, retakePolicy: q.retakePolicy, maxRetakes: q.maxRetakes,
      openAt: q.openAt, closeAt: q.closeAt, notYetOpen, closed,
      attemptCount: submitted.length, canRetake,
      inProgressAttempt: inProgress ? { id: inProgress.id, status: inProgress.status } : null,
      latestAttempt: latestSubmitted ? {
        id: latestSubmitted.id, status: latestSubmitted.status,
        score: latestSubmitted.scoreOverride ?? latestSubmitted.score,
        submittedAt: latestSubmitted.submittedAt
      } : null
    };
  }) });
}));

// Leaderboard for a quiz
router.get("/:id/leaderboard", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const quiz = await prisma.quiz.findUnique({ where: { id }, include: { questions: true } });
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });
  if (!quiz.marksReleased && req.user.type === "STUDENT")
    return res.status(403).json({ error: "Marks not released yet" });
  const totalPoints = quiz.questions.reduce((s, qq) => s + qq.points, 0);
  // Best attempt per student
  const attempts = await prisma.attempt.findMany({
    where: { quizId: id, status: "SUBMITTED" },
    include: { student: true },
    orderBy: { submittedAt: "asc" }
  });
  const best = {};
  for (const a of attempts) {
    const finalScore = a.scoreOverride ?? a.score;
    if (!best[a.studentId] || finalScore > best[a.studentId].score) {
      best[a.studentId] = { studentId: a.studentId, name: a.student.displayName, score: finalScore, submittedAt: a.submittedAt };
    }
  }
  const board = Object.values(best).sort((a, b) => b.score - a.score).map((e, i) => ({ rank: i + 1, ...e, totalPoints, pct: totalPoints > 0 ? Math.round((e.score / totalPoints) * 100) : 0 }));
  res.json({ leaderboard: board, totalPoints });
}));

// Create quiz
router.post("/", requireAuth, requireRole(["ADMIN","TEACHER"]), asyncHandler(async (req, res) => {
  const { classId, subject, title, timeLimitMin, shuffleQuestions, questionIds, pointsMap, retakePolicy, maxRetakes, openAt, closeAt } = req.body || {};
  if (!classId || !subject || !title) return res.status(400).json({ error: "classId, subject, title required" });
  const quiz = await prisma.quiz.create({
    data: {
      classId, subject, title,
      timeLimitMin: timeLimitMin || 30,
      shuffleQuestions: shuffleQuestions !== false,
      published: false, marksReleased: false,
      retakePolicy: retakePolicy || "NO_RETAKE",
      maxRetakes: Number(maxRetakes) || 0,
      openAt: openAt ? new Date(openAt) : null,
      closeAt: closeAt ? new Date(closeAt) : null,
      questions: questionIds?.length ? {
        create: questionIds.map((qid, idx) => ({ questionId: qid, order: idx, points: (pointsMap && pointsMap[qid]) ? Number(pointsMap[qid]) : 1 }))
      } : undefined
    },
    include: { questions: true }
  });
  res.json({ quiz });
}));

// Update quiz
router.patch("/:id", requireAuth, requireRole(["ADMIN","TEACHER"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { published, marksReleased, title, timeLimitMin, shuffleQuestions, pointsMap, retakePolicy, maxRetakes, openAt, closeAt } = req.body || {};
  const data = {};
  if (typeof published === "boolean") data.published = published;
  if (typeof marksReleased === "boolean") data.marksReleased = marksReleased;
  if (title) data.title = title;
  if (timeLimitMin) data.timeLimitMin = Number(timeLimitMin);
  if (typeof shuffleQuestions === "boolean") data.shuffleQuestions = shuffleQuestions;
  if (retakePolicy) data.retakePolicy = retakePolicy;
  if (maxRetakes !== undefined) data.maxRetakes = Number(maxRetakes) || 0;
  if (openAt !== undefined) data.openAt = openAt ? new Date(openAt) : null;
  if (closeAt !== undefined) data.closeAt = closeAt ? new Date(closeAt) : null;
  const quiz = await prisma.quiz.update({ where: { id }, data });
  if (pointsMap && typeof pointsMap === "object") {
    for (const [qqId, pts] of Object.entries(pointsMap)) {
      await prisma.quizQuestion.update({ where: { id: qqId }, data: { points: Number(pts) || 1 } });
    }
  }
  res.json({ quiz });
}));

// Delete quiz
router.delete("/:id", requireAuth, requireRole(["ADMIN","TEACHER"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.attempt.deleteMany({ where: { quizId: id } });
  await prisma.quizQuestion.deleteMany({ where: { quizId: id } });
  await prisma.quiz.delete({ where: { id } });
  res.json({ ok: true });
}));

// Student: get quiz for taking
router.get("/:id/student", requireAuth, asyncHandler(async (req, res) => {
  if (req.user.type !== "STUDENT") return res.status(403).json({ error: "Students only" });
  const quiz = await prisma.quiz.findUnique({
    where: { id: req.params.id },
    include: { class: true, questions: { include: { question: { include: { passage: true } } }, orderBy: { order: "asc" } } }
  });
  if (!quiz || !quiz.published) return res.status(404).json({ error: "Quiz not found or not published" });
  const now = new Date();
  if (quiz.openAt && new Date(quiz.openAt) > now) return res.status(403).json({ error: "Quiz not open yet" });
  if (quiz.closeAt && new Date(quiz.closeAt) < now) return res.status(403).json({ error: "Quiz is closed" });

  let questions = quiz.questions.map(qq => ({
    id: qq.question.id, qqId: qq.id, type: qq.question.type,
    prompt: qq.question.prompt, choices: qq.question.choicesJson ? JSON.parse(qq.question.choicesJson) : null,
    passageId: qq.question.passageId, points: qq.points,
    passage: qq.question.passage ? { id: qq.question.passage.id, title: qq.question.passage.title, content: qq.question.passage.content } : null
  }));
  if (quiz.shuffleQuestions) {
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }
  }
  res.json({ quiz: { id: quiz.id, title: quiz.title, subject: quiz.subject, timeLimitMin: quiz.timeLimitMin, classId: quiz.classId, className: quiz.class.name, marksReleased: quiz.marksReleased, retakePolicy: quiz.retakePolicy, questions } });
}));

// Teacher: quiz detail
router.get("/:id/detail", requireAuth, requireRole(["ADMIN","TEACHER"]), asyncHandler(async (req, res) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: req.params.id },
    include: { questions: { include: { question: true }, orderBy: { order: "asc" } }, _count: { select: { attempts: true } } }
  });
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });
  res.json({ quiz: { ...quiz, questionCount: quiz.questions.length, totalPoints: quiz.questions.reduce((s, qq) => s + qq.points, 0), attemptCount: quiz._count.attempts, questions: quiz.questions.map(qq => ({ id: qq.id, questionId: qq.questionId, order: qq.order, points: qq.points, prompt: qq.question.prompt, type: qq.question.type, difficulty: qq.question.difficulty, choices: qq.question.choicesJson ? JSON.parse(qq.question.choicesJson) : null, answerJson: qq.question.answerJson, tags: JSON.parse(qq.question.tags || "[]"), explanation: qq.question.explanation })) } });
}));

module.exports = router;
