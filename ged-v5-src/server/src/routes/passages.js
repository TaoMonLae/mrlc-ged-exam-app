const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const router = express.Router();

router.get("/", requireAuth, requireRole(["ADMIN","TEACHER"]), async (req, res) => {
  const { classId, subject } = req.query;
  if (!classId) return res.status(400).json({ error: "classId required" });
  const where = { classId: String(classId) };
  if (subject) where.subject = subject;
  const passages = await prisma.passage.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json({ passages });
});

router.post("/", requireAuth, requireRole(["ADMIN","TEACHER"]), async (req, res) => {
  const { classId, subject, title, content } = req.body || {};
  if (!classId || !subject || !title || !content)
    return res.status(400).json({ error: "classId, subject, title, content required" });
  const passage = await prisma.passage.create({ data: { classId, subject, title, content } });
  res.json({ passage });
});

router.patch("/:id", requireAuth, requireRole(["ADMIN","TEACHER"]), async (req, res) => {
  const { id } = req.params;
  const { title, content, subject } = req.body || {};
  const data = {};
  if (title !== undefined) data.title = title;
  if (content !== undefined) data.content = content;
  if (subject !== undefined) data.subject = subject;
  const passage = await prisma.passage.update({ where: { id }, data });
  res.json({ passage });
});

router.delete("/:id", requireAuth, requireRole(["ADMIN","TEACHER"]), async (req, res) => {
  const { id } = req.params;
  // Unlink questions first
  await prisma.question.updateMany({ where: { passageId: id }, data: { passageId: null } });
  await prisma.passage.delete({ where: { id } });
  res.json({ ok: true });
});

// Get single passage (for quiz passage viewer)
router.get("/:id", requireAuth, async (req, res) => {
  const passage = await prisma.passage.findUnique({ where: { id: req.params.id } });
  if (!passage) return res.status(404).json({ error: "Not found" });
  res.json({ passage });
});

module.exports = router;
