const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const { signToken } = require("../lib/jwt");
const { requireAuth, requireRole } = require("../middleware/auth");

const { asyncHandler } = require("../middleware/asyncHandler");
const router = express.Router();

/**
 * Admin/Teacher login
 */
router.post("/login", asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username and password required" });

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ type: "USER", userId: user.id, role: user.role, username: user.username });
  res.json({ token, role: user.role, username: user.username });
}));

/**
 * Create teacher (Admin only)
 */
router.post("/create-teacher", requireAuth, requireRole(["ADMIN"]), asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username and password required" });

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return res.status(409).json({ error: "Username already exists" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { username, passwordHash, role: "TEACHER" } });
  res.json({ id: user.id, username: user.username, role: user.role });
}));

/**
 * Student account login (username+password)
 */
router.post("/student-login", asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username and password required" });

  const student = await prisma.student.findUnique({ where: { username } });
  if (!student || !student.passwordHash) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, student.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ type: "STUDENT", studentId: student.id, displayName: student.displayName });
  res.json({ token, displayName: student.displayName });
}));

/**
 * Join with class code + name (no password).
 * If class policy is ROSTER_ONLY, name must match enrolled roster.
 * If FREE_TYPING, student can be created and enrolled automatically.
 */
router.post("/join-code", asyncHandler(async (req, res) => {
  const { classCode, displayName, joinPin } = req.body || {};
  if (!classCode || !displayName) return res.status(400).json({ error: "classCode and displayName required" });

  const cls = await prisma.class.findUnique({ where: { classCode } });
  if (!cls) return res.status(404).json({ error: "Class not found" });
  if (!cls.allowCodeLogin) return res.status(403).json({ error: "Class code login is disabled for this class" });

  const nameInput = String(displayName).trim();
  const nameLower = nameInput.toLowerCase();

  // Optional PIN check
  if (cls.joinPinHash) {
    if (!joinPin) return res.status(400).json({ error: "joinPin required" });
    const okPin = await bcrypt.compare(joinPin, cls.joinPinHash);
    if (!okPin) return res.status(401).json({ error: "Invalid PIN" });
  }

  // SQLite-safe case-insensitive find
  let student = (await prisma.student.findFirst({ where: { displayName: nameInput } })) || null;

  if (!student) {
    const candidates = await prisma.student.findMany({
      select: { id: true, displayName: true, username: true, hasPassword: true }
    });
    student = candidates.find(s => String(s.displayName || "").trim().toLowerCase() === nameLower) || null;
  }

  if (cls.codeModePolicy === "ROSTER_ONLY") {
    if (!student) return res.status(403).json({ error: "Name not in roster. Ask teacher to add you." });

    const enrolled = await prisma.enrollment.findFirst({
      where: { classId: cls.id, studentId: student.id }
    });
    if (!enrolled) return res.status(403).json({ error: "Name not in roster for this class." });

    const token = signToken({
      type: "STUDENT",
      studentId: student.id,
      displayName: student.displayName,
      classId: cls.id
    });
    return res.json({ token, displayName: student.displayName, classId: cls.id, className: cls.name });
  }

  // FREE_TYPING: create student if missing, enroll if missing
  if (!student) {
    student = await prisma.student.create({ data: { displayName: nameInput, hasPassword: false } });
  }

  await prisma.enrollment.upsert({
    where: { classId_studentId: { classId: cls.id, studentId: student.id } },
    update: {},
    create: { classId: cls.id, studentId: student.id }
  });

  const token = signToken({
    type: "STUDENT",
    studentId: student.id,
    displayName: student.displayName,
    classId: cls.id
  });
  return res.json({ token, displayName: student.displayName, classId: cls.id, className: cls.name });
}));



/**
 * Change password (Admin/Teacher - self)
 */
router.post("/change-password", requireAuth, requireRole(["ADMIN", "TEACHER"]), asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "currentPassword and newPassword required" });
  if (String(newPassword).length < 6) return res.status(400).json({ error: "New password must be at least 6 characters" });

  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Current password is incorrect" });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  res.json({ ok: true });
}));

/**
 * List users (Admin only)
 */
router.get("/users", requireAuth, requireRole(["ADMIN"]), asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, username: true, role: true, createdAt: true }
  });
  res.json({ users });
}));

/**
 * Reset user password (Admin only)
 */
router.post("/reset-user-password", requireAuth, requireRole(["ADMIN"]), asyncHandler(async (req, res) => {
  const { userId, newPassword } = req.body || {};
  if (!userId || !newPassword) return res.status(400).json({ error: "userId and newPassword required" });
  if (String(newPassword).length < 6) return res.status(400).json({ error: "New password must be at least 6 characters" });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  res.json({ ok: true });
}));
router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  res.json({ user: req.user });
}));

// Delete user/teacher (Admin only — cannot delete self)
router.delete("/users/:id", requireAuth, requireRole(["ADMIN"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (id === req.user.userId) return res.status(400).json({ error: "Cannot delete your own account" });
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.role === "ADMIN") return res.status(400).json({ error: "Cannot delete an admin account" });
  await prisma.user.delete({ where: { id } });
  res.json({ ok: true });
}));

module.exports = router;
