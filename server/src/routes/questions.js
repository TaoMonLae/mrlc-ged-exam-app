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

// Bulk import questions from CSV/JSON
// Expected body: { classId, rows: [ { subject, type, prompt, choices, answer, explanation, tags, difficulty } ] }
router.post("/import", requireAuth, requireRole(["ADMIN","TEACHER"]), async (req, res) => {
  const { classId, rows } = req.body || {};
  if (!classId || !Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ error: "classId and rows array required" });

  const VALID_TYPES = ["MCQ","MULTI_SELECT","SHORT_ANSWER","NUMERIC","REORDER"];
  const VALID_SUBJ  = ["RLA","MATH","SCIENCE","SOCIAL_STUDIES"];
  const VALID_DIFF  = ["EASY","MEDIUM","HARD"];

  const created = [], errors = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 1;
    try {
      const subject = (r.subject || "").toUpperCase().replace(/ /g,"_");
      const type    = (r.type    || "").toUpperCase().replace(/ /g,"_");
      if (!VALID_SUBJ.includes(subject))  { errors.push(`Row ${rowNum}: invalid subject "${r.subject}"`); continue; }
      if (!VALID_TYPES.includes(type))    { errors.push(`Row ${rowNum}: invalid type "${r.type}"`);    continue; }
      if (!r.prompt || !String(r.prompt).trim()) { errors.push(`Row ${rowNum}: prompt is empty`);  continue; }
      if (r.answer === undefined || r.answer === null || r.answer === "") { errors.push(`Row ${rowNum}: answer is empty`); continue; }

      // Parse choices (pipe-separated string OR already an array)
      let choices = null;
      if (r.choices) {
        choices = Array.isArray(r.choices)
          ? r.choices
          : String(r.choices).split("|").map(c => c.trim()).filter(Boolean);
      }

      // Parse answer
      let answer;
      try {
        // If it's already valid JSON (array / number), use as-is
        answer = JSON.parse(r.answer);
      } catch {
        answer = String(r.answer).trim();
      }

      // Parse tags (comma-separated string OR array)
      let tags = [];
      if (r.tags) {
        tags = Array.isArray(r.tags)
          ? r.tags
          : String(r.tags).split(",").map(t => t.trim()).filter(Boolean);
      }

      const difficulty = VALID_DIFF.includes((r.difficulty||"").toUpperCase())
        ? r.difficulty.toUpperCase() : "MEDIUM";

      const q = await prisma.question.create({
        data: {
          classId,
          subject,
          type,
          prompt: String(r.prompt).trim(),
          choicesJson: choices ? JSON.stringify(choices) : null,
          answerJson: JSON.stringify(answer),
          explanation: r.explanation ? String(r.explanation).trim() : null,
          passageId: null,
          tags: JSON.stringify(tags),
          difficulty
        }
      });
      created.push(mapQ(q));
    } catch (e) {
      errors.push(`Row ${rowNum}: ${e.message}`);
    }
  }

  res.json({ created: created.length, errors, questions: created });
});
