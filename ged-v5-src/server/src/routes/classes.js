const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

function genCode(prefix="MRLC") {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i=0;i<4;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return `${prefix}-${s}`;
}

// List classes (Admin/Teacher)
router.get("/", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const classes = await prisma.class.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ classes });
});

// Create class
router.post("/", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });

  const cls = await prisma.class.create({
    data: {
      name,
      classCode: genCode("MRLC"),
      allowAccountLogin: true,
      allowCodeLogin: true,
      codeModePolicy: "ROSTER_ONLY",
    }
  });
  res.json({ class: cls });
});

// Update class settings
router.patch("/:id", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const { id } = req.params;
  const { allowAccountLogin, allowCodeLogin, codeModePolicy, joinPin } = req.body || {};

  const data = {};
  if (typeof allowAccountLogin === "boolean") data.allowAccountLogin = allowAccountLogin;
  if (typeof allowCodeLogin === "boolean") data.allowCodeLogin = allowCodeLogin;
  if (codeModePolicy === "ROSTER_ONLY" || codeModePolicy === "FREE_TYPING") data.codeModePolicy = codeModePolicy;

  if (joinPin === null) data.joinPinHash = null;
  if (typeof joinPin === "string" && joinPin.length > 0) {
    data.joinPinHash = await bcrypt.hash(joinPin, 10);
  }

  const cls = await prisma.class.update({ where: { id }, data });
  res.json({ class: cls });
});

// Class roster: list
router.get("/:id/roster", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const { id } = req.params;
  const enrollments = await prisma.enrollment.findMany({
    where: { classId: id },
    include: { student: true },
    orderBy: { createdAt: "asc" }
  });
  res.json({ roster: enrollments.map(e => e.student) });
});

// Add student to roster (optionally create account)
router.post("/:id/roster", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const { id } = req.params;
  const { displayName, username, password } = req.body || {};
  if (!displayName) return res.status(400).json({ error: "displayName required" });

  const nameInput = String(displayName).trim();
  const nameLower = nameInput.toLowerCase();

  let student = await prisma.student.findFirst({
    where: { displayName: nameInput }
  });

  // fallback scan (SQLite does not support mode: "insensitive")
  if (!student) {
    const candidates = await prisma.student.findMany({
      select: { id: true, displayName: true, username: true, hasPassword: true }
    });
    student = candidates.find(s => String(s.displayName || "").trim().toLowerCase() === nameLower) || null;
  }

  if (!student) {
    student = await prisma.student.create({ data: { displayName, hasPassword: false } });
  }

  // Create student account if username+password provided
  if (username && password) {
    const existing = await prisma.student.findUnique({ where: { username } });
    if (existing) return res.status(409).json({ error: "Student username already exists" });

    const hash = await bcrypt.hash(password, 10);
    student = await prisma.student.update({
      where: { id: student.id },
      data: { username, passwordHash: hash, hasPassword: true }
    });
  }

  await prisma.enrollment.upsert({
    where: { classId_studentId: { classId: id, studentId: student.id } },
    update: {},
    create: { classId: id, studentId: student.id }
  });

  res.json({ student });
});


// Class marks report (Admin/Teacher)
router.get("/:id/marks-report", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const { id } = req.params;

  const cls = await prisma.class.findUnique({ where: { id } });
  if (!cls) return res.status(404).json({ error: "Class not found" });

  const rosterEnroll = await prisma.enrollment.findMany({
    where: { classId: id },
    include: { student: true },
    orderBy: { createdAt: "asc" }
  });
  const students = rosterEnroll.map(e => e.student);

  const quizzes = await prisma.quiz.findMany({
    where: { classId: id },
    orderBy: { createdAt: "asc" }
  });

  const attempts = await prisma.attempt.findMany({
    where: { quizId: { in: quizzes.map(q => q.id) } },
    include: { student: true, quiz: true },
  });

  // Build map studentId->quizId->attempt
  const map = {};
  for (const a of attempts) {
    if (!map[a.studentId]) map[a.studentId] = {};
    // keep latest submitted if multiple
    const existing = map[a.studentId][a.quizId];
    if (!existing || (a.submittedAt && (!existing.submittedAt || new Date(a.submittedAt) > new Date(existing.submittedAt)))) {
      map[a.studentId][a.quizId] = a;
    }
  }

  // Summary stats per quiz
  const quizStats = quizzes.map(q => {
    const sub = attempts.filter(a => a.quizId === q.id && a.status === "SUBMITTED");
    const scores = sub.map(a => a.score || 0);
    const avg = scores.length ? (scores.reduce((x,y)=>x+y,0)/scores.length) : 0;
    const max = scores.length ? Math.max(...scores) : 0;
    const min = scores.length ? Math.min(...scores) : 0;
    return { quizId: q.id, title: q.title, submitted: scores.length, total: students.length, avg, max, min };
  });


// Missing students per quiz
const missingByQuiz = quizzes.map(q => {
  const submittedSet = new Set(attempts.filter(a => a.quizId === q.id && a.status === "SUBMITTED").map(a => a.studentId));
  const missing = students.filter(s => !submittedSet.has(s.id)).map(s => ({ id: s.id, displayName: s.displayName }));
  return { quizId: q.id, title: q.title, missingCount: missing.length, missing };
});

  res.json({ class: { id: cls.id, name: cls.name }, students, quizzes, attemptsMap: map, quizStats, missingByQuiz });
});

// Export class marks matrix as CSV (Admin/Teacher)
router.get("/:id/marks-export", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const { id } = req.params;

  const rosterEnroll = await prisma.enrollment.findMany({
    where: { classId: id },
    include: { student: true },
    orderBy: { createdAt: "asc" }
  });
  const students = rosterEnroll.map(e => e.student);

  const quizzes = await prisma.quiz.findMany({
    where: { classId: id, published: true },
    orderBy: { createdAt: "asc" }
  });

  const attempts = await prisma.attempt.findMany({
    where: { quizId: { in: quizzes.map(q => q.id) }, status: "SUBMITTED" },
    include: { student: true },
  });

  const latest = {};
  for (const a of attempts) {
    const key = a.studentId + "::" + a.quizId;
    if (!latest[key] || (a.submittedAt && new Date(a.submittedAt) > new Date(latest[key].submittedAt))) {
      latest[key] = a;
    }
  }

  const header = ["studentName", ...quizzes.map(q => q.title)];
  const rows = [header.join(",")];

  for (const s of students) {
    const cells = [];
    const name = (s.displayName || "").replace(/"/g,'""');
    cells.push(`"${name}"`);
    for (const q of quizzes) {
      const a = latest[s.id + "::" + q.id];
      cells.push(a ? String(a.score ?? 0) : "");
    }
    rows.push(cells.join(","));
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="class-marks-${id}.csv"`);
  res.send(rows.join("\n"));
});

// Delete class (Admin/Teacher)
router.delete("/:id", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const { id } = req.params;

  const cls = await prisma.class.findUnique({ where: { id } });
  if (!cls) return res.status(404).json({ error: "Class not found" });

  const quizzes = await prisma.quiz.findMany({ where: { classId: id }, select: { id: true } });
  const quizIds = quizzes.map(q => q.id);

  await prisma.$transaction(async (tx) => {
    if (quizIds.length) {
      await tx.attempt.deleteMany({ where: { quizId: { in: quizIds } } });
      await tx.quizQuestion.deleteMany({ where: { quizId: { in: quizIds } } });
    }
    await tx.quiz.deleteMany({ where: { classId: id } });

    await tx.question.deleteMany({ where: { classId: id } });
    await tx.passage.deleteMany({ where: { classId: id } });
    await tx.enrollment.deleteMany({ where: { classId: id } });

    await tx.class.delete({ where: { id } });
  });

  res.json({ ok: true });
});

// Add an existing student to this class roster (Admin/Teacher)
router.post("/:id/roster/add-existing", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const { id } = req.params;
  const { studentId } = req.body || {};
  if (!studentId) return res.status(400).json({ error: "studentId required" });

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return res.status(404).json({ error: "Student not found" });

  await prisma.enrollment.upsert({
    where: { classId_studentId: { classId: id, studentId } },
    update: {},
    create: { classId: id, studentId }
  });

  res.json({ ok: true, student });
});

module.exports = router;
