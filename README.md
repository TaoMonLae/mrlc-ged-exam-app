# MRLC GED Exam App

Offline-first web app for MRLC GED classes to manage students, build question banks, create quizzes/exams, and run timed assessments with server-enforced timers.

## Key Features
- Admin/Teacher dashboard (class management, roster, passages, questions, quizzes)
- Student join (class code + optional PIN) + student login support
- Passage library (RLA comprehension + other subjects)
- Question bank with tags + difficulty
- Quiz builder (publish/unpublish, shuffle, time limit)
- **Server-enforced timer** (attempt has `endsAt`; autosave/submit respects expiry)
- Results:
  - Quiz marks export CSV
  - Class marks matrix + report (with missing students list)
  - Leaderboard (per quiz)

## Tech Stack
- Frontend: React + Vite
- Backend: Node.js (Express)
- ORM: Prisma
- DB:
  - SQLite (offline/local)
  - Postgres (remote/hosted option)
- Docker-ready

---

## Run with Docker (SQLite)
Default port: **4001**

```bash
docker compose -f docker-compose.sqlite.yml up -d --build

