const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// List all students
router.get("/", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const students = await prisma.student.findMany({
    orderBy: { displayName: "asc" },
    include: { enrollments: { include: { class: true } }, _count: { select: { attempts: true } } }
  });
  res.json({ students: students.map(s => ({
    id: s.id,
    displayName: s.displayName,
    username: s.username,
    hasPassword: s.hasPassword,
    createdAt: s.createdAt,
    attemptCount: s._count.attempts,
    classes: s.enrollments.map(e => ({ id: e.class.id, name: e.class.name }))
  })) });
});

// Get student profile with full attempt history
router.get("/:id", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const { id } = req.params;
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      enrollments: { include: { class: true } },
      attempts: {
        where: { status: "SUBMITTED" },
        include: { quiz: { include: { questions: true } } },
        orderBy: { submittedAt: "desc" }
      }
    }
  });
  if (!student) return res.status(404).json({ error: "Student not found" });

  res.json({
    student: {
      id: student.id,
      displayName: student.displayName,
      username: student.username,
      hasPassword: student.hasPassword,
      createdAt: student.createdAt,
      classes: student.enrollments.map(e => ({ id: e.class.id, name: e.class.name })),
      attempts: student.attempts.map(a => {
        const totalPoints = a.quiz.questions.reduce((s, qq) => s + qq.points, 0);
        return {
          id: a.id,
          quizId: a.quizId,
          quizTitle: a.quiz.title,
          subject: a.quiz.subject,
          score: a.score,
          scoreOverride: a.scoreOverride,
          overrideNote: a.overrideNote,
          totalPoints,
          marksReleased: a.quiz.marksReleased,
          status: a.status,
          submittedAt: a.submittedAt
        };
      })
    }
  });
});

// Update student
router.patch("/:id", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const { id } = req.params;
  const { displayName, username, password } = req.body || {};
  const data = {};
  if (displayName) data.displayName = displayName.trim();
  if (username !== undefined) {
    if (username) {
      const existing = await prisma.student.findFirst({ where: { username, NOT: { id } } });
      if (existing) return res.status(409).json({ error: "Username taken" });
      data.username = username.trim();
    }
  }
  if (password) {
    data.passwordHash = await bcrypt.hash(password, 10);
    data.hasPassword = true;
  }
  const student = await prisma.student.update({ where: { id }, data });
  res.json({ student });
});

// Delete student
router.delete("/:id", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const { id } = req.params;
  await prisma.attempt.deleteMany({ where: { studentId: id } });
  await prisma.enrollment.deleteMany({ where: { studentId: id } });
  await prisma.student.delete({ where: { id } });
  res.json({ ok: true });
});

// Bulk import students
router.post("/import", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const { classId, students: rows } = req.body || {};
  if (!classId || !Array.isArray(rows)) return res.status(400).json({ error: "classId and students array required" });

  const results = { created: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const name = (row.displayName || row.name || "").trim();
    if (!name) { results.errors.push("Row missing displayName"); continue; }
    try {
      let student = await prisma.student.findFirst({ where: { displayName: name } });
      if (!student) {
        const createData = { displayName: name, hasPassword: false };
        if (row.username) createData.username = row.username.trim();
        if (row.password) { createData.passwordHash = await bcrypt.hash(row.password, 10); createData.hasPassword = true; }
        student = await prisma.student.create({ data: createData });
        results.created++;
      } else {
        results.skipped++;
      }
      await prisma.enrollment.upsert({
        where: { classId_studentId: { classId, studentId: student.id } },
        create: { classId, studentId: student.id },
        update: {}
      });
    } catch (e) {
      results.errors.push(`${name}: ${e.message}`);
    }
  }
  res.json(results);
});

module.exports = router;
