require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/auth");
const classRoutes = require("./routes/classes");
const passageRoutes = require("./routes/passages");
const questionRoutes = require("./routes/questions");
const quizRoutes = require("./routes/quizzes");
const attemptRoutes = require("./routes/attempts");
const studentRoutes = require("./routes/students");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/api/health", (req, res) => res.json({ ok: true, name: "MRLC GED App" }));

app.use("/api/auth", authRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/passages", passageRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/attempts", attemptRoutes);
app.use("/api/students", studentRoutes);

// Serve frontend
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));
app.get("*", (req, res) => res.sendFile(path.join(publicDir, "index.html")));

// ── Global Express error handler ──────────────────────────────────────
// Catches any error passed via next(err) or thrown in async routes
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500
  const message = err.message || 'Internal server error'
  console.error(`[ERROR] ${req.method} ${req.path} →`, message)
  if (!res.headersSent) res.status(status).json({ error: message })
})

// ── Process-level safety nets ──────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
  // Don't exit — keep the server alive for other requests
})

app.listen(PORT, () => {
  console.log(`MRLC GED app running on http://localhost:${PORT}`)
})
