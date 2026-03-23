const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

function mapQ(q) {
  return { ...q, choices: q.choicesJson ? JSON.parse(q.choicesJson) : null, tags: JSON.parse(q.tags || "[]") };
}

// List questions
router.get("/", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const { classId, subject, passageId, difficulty, tag } = req.query;
  if (!classId) return res.status(400).json({ error: "classId required" });

  const where = { classId: String(classId) };
  if (subject) where.subject = subject;
  if (passageId) where.passageId = String(passageId);
  if (difficulty) where.difficulty = difficulty;

  let questions = await prisma.question.findMany({ where, orderBy: { createdAt: "desc" } });
  if (tag) {
    questions = questions.filter(q => { try { return JSON.parse(q.tags || "[]").includes(tag); } catch { return false; } });
  }
  res.json({ questions: questions.map(mapQ) });
});

// Create question
router.post("/", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const { classId, subject, type, prompt, choices, answer, explanation, passageId, tags, difficulty } = req.body || {};
  if (!classId || !subject || !type || !prompt || answer === undefined) {
    return res.status(400).json({ error: "classId, subject, type, prompt, answer required" });
  }
  const q = await prisma.question.create({
    data: {
      classId, subject, type, prompt,
      choicesJson: choices ? JSON.stringify(choices) : null,
      answerJson: JSON.stringify(answer),
      explanation: explanation || null,
      passageId: passageId || null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      difficulty: ["EASY","MEDIUM","HARD"].includes(difficulty) ? difficulty : "MEDIUM"
    }
  });
  res.json({ question: mapQ(q) });
});

// Update question
router.patch("/:id", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const { id } = req.params;
  const { tags, difficulty, explanation, prompt } = req.body || {};
  const data = {};
  if (tags !== undefined) data.tags = JSON.stringify(Array.isArray(tags) ? tags : []);
  if (["EASY","MEDIUM","HARD"].includes(difficulty)) data.difficulty = difficulty;
  if (explanation !== undefined) data.explanation = explanation;
  if (prompt !== undefined) data.prompt = prompt;
  const q = await prisma.question.update({ where: { id }, data });
  res.json({ question: mapQ(q) });
});

// Delete question
router.delete("/:id", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const { id } = req.params;
  await prisma.quizQuestion.deleteMany({ where: { questionId: id } });
  await prisma.question.delete({ where: { id } });
  res.json({ ok: true });
});


// Duplicate question (Admin/Teacher)
router.post("/:id/duplicate", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (req, res) => {
  const { id } = req.params;
  const q0 = await prisma.question.findUnique({ where: { id } });
  if (!q0) return res.status(404).json({ error: "Question not found" });

  const q = await prisma.question.create({
    data: {
      classId: q0.classId,
      subject: q0.subject,
      type: q0.type,
      prompt: `${q0.prompt} (Copy)`,
      choicesJson: q0.choicesJson,
      answerJson: q0.answerJson,
      explanation: q0.explanation,
      passageId: q0.passageId,
      tags: q0.tags,
      difficulty: q0.difficulty
    }
  });

  res.json({ question: mapQ(q) });
});

module.exports = router;
