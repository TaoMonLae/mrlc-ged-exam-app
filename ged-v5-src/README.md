# MRLC GED Exam + Quiz App (Local-first, Docker-ready)

A local-first web app for MRLC GED classes to create and run exams/quizzes (RLA, Math, Science, Social Studies).
Designed for **offline LAN use**, with **optional remote access** later. Built so you can run with **SQLite** (offline)
and switch to **Postgres** for hosted/remote usage.

## Features (template)
- Roles: **Admin / Teacher / Student**
- **Two student login modes** (configurable per class):
  1) **Account login** (username + password)
  2) **Class Code + Name** (no password) with roster-only or free-typing policy
- **RLA Passage/Paragraph library**: teacher adds passages and attaches questions
- Question bank (MCQ, multi-select, short answer, reorder, numeric)
- Quiz builder (pick questions, time limit, publish)
- Student quiz runner (timer, autosave draft, submit)
- Results + CSV export (basic)

> This is a clean, working starter. You can extend question types, add printing, analytics, multilingual UI, etc.

---

## Quick start (SQLite, recommended for offline)
### Requirements
- Docker + Docker Compose

### Run
```bash
docker compose -f docker-compose.sqlite.yml up -d --build
```

Open:
- http://localhost:8080

### Default admin account
On first run, the app seeds a default admin:
- username: **admin**
- password: **admin123**

Change it after login.

---

## Postgres (for VPS / full remote)
```bash
docker compose -f docker-compose.postgres.yml up -d --build
```

---

## Local development (no Docker)
### Backend
```bash
cd server
npm install
npx prisma migrate dev
npm run dev
```

### Frontend
```bash
cd web
npm install
npm run dev
```

Frontend dev proxy is configured to `http://localhost:8080`.

---

## Remote access options (later)
- Recommended: **Tailscale** (private + secure)
- Or: **Cloudflare Tunnel** (public URL, still safe if configured)

---

## Project structure
- `server/` Express API + Prisma
- `web/` React (Vite) UI
- `Dockerfile` builds web and serves it from the backend
- `docker-compose.*.yml` SQLite and Postgres stacks

---

## Notes
- SQLite is great for single-server (school desktop) usage.
- Postgres is better if you host on VPS or expect many concurrent users editing content.

