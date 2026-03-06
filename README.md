# MRLC GED Exam App

A self-hosted **Exam + Quiz web application** built for **Mon Refugee Learning Centre (MRLC)** to run GED practice quizzes/exams **locally (offline-first)** with an option to enable **remote access**. Teachers can manage classes, students, passages for reading comprehension, questions, quizzes, and export results—while students can join and take timed quizzes with a **server-enforced timer**.

**Author:** Tao Mon Lae

---

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Deployment Options](#deployment-options)
  - [Option A: Docker + SQLite (Local/Offline)](#option-a-docker--sqlite-localoffline)
  - [Option B: Docker + Postgres (Remote/Hosted)](#option-b-docker--postgres-remotehosted)
  - [Option C: Run without Docker (Developer Mode)](#option-c-run-without-docker-developer-mode)
- [First Login & Setup](#first-login--setup)
- [Teacher Workflow (Recommended Steps)](#teacher-workflow-recommended-steps)
- [Student Workflow](#student-workflow)
- [Reports & Exports](#reports--exports)
- [Timer Rules (Server Enforced)](#timer-rules-server-enforced)
- [Backups](#backups)
- [Troubleshooting](#troubleshooting)
- [Security Recommendations](#security-recommendations)
- [Roadmap](#roadmap)

---

## Features

### Admin / Teacher Features
- **Class Management**
  - Create classes
  - Generate/share class codes
  - Optional join PIN
  - Configure student join policy (roster only vs free typing, if enabled)
- **Student Management**
  - Add students to roster
  - Import students from CSV (bulk)
  - Create/reset student accounts (optional)
- **Passage Library (RLA + Other Subjects)**
  - Teachers can create comprehension passages (RLA)
  - Attach questions to passages for reading comprehension quizzes
- **Question Bank**
  - Multiple question types (MCQ, Multi-select, Short answer, Numeric, Reorder)
  - Tagging system
  - Difficulty levels
  - Duplicate questions (faster authoring)
- **Quiz / Exam Builder**
  - Build quizzes from question bank
  - Time limit per quiz (minutes)
  - Shuffle questions option
  - Publish / unpublish control (students only see published quizzes)
  - Duplicate quizzes (create draft copy)
- **Reports**
  - Class marks matrix (students × quizzes)
  - Quiz statistics (avg/max/min/submissions)
  - **Missing students report** (who hasn’t submitted)
- **Exports**
  - Export quiz marks CSV
  - Export class results CSV / marks matrix

### Student Features
- Join class using class code (and PIN if enabled)
- View **published quizzes only**
- Start quiz with **server-enforced timer**
- Autosave answers
- Submit quiz and view results (based on teacher release policy)

### Reliability / Deployment
- Runs on **Docker** for easy installation on Ubuntu servers/desktops
- Supports:
  - **SQLite** for offline/local LAN usage
  - **Postgres** for hosted/remote access
- Designed for MRLC classroom environment

---

## Tech Stack
- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database ORM:** Prisma
- **Database:** SQLite (local) or Postgres (remote)
- **Containerization:** Docker + docker compose

---

## Project Structure
├─ docker-compose.sqlite.yml
├─ docker-compose.postgres.yml
├─ Dockerfile
├─ server/
│ ├─ prisma/
│ │ ├─ schema.prisma
│ │ └─ seed.js
│ └─ src/
│ ├─ index.js
│ ├─ routes/
│ └─ middleware/
└─ web/
├─ src/
│ ├─ pages/
│ ├─ components/
│ └─ lib/
└─ vite.config.js


---

## Deployment Options

### Option A: Docker + SQLite (Local/Offline)
Best for:
- MRLC local server (Ubuntu desktop/server)
- LAN usage inside school
- Limited internet or offline operation

#### Requirements
- Docker installed
- Docker Compose plugin installed

Check:
```bash
docker --version
docker compose version

---
Run (SQLite)

From the project folder:

docker compose -f docker-compose.sqlite.yml up -d --build

Open in browser:

http://localhost:4001

Stop:

docker compose -f docker-compose.sqlite.yml down
Option B: Docker + Postgres (Remote/Hosted)

Best for:

Remote access from outside school network

VPS hosting (DigitalOcean/Hetzner/etc.)

Better concurrency under higher load

Run (Postgres)
docker compose -f docker-compose.postgres.yml up -d --build

Open:

http://localhost:4001

Stop:

docker compose -f docker-compose.postgres.yml down
Option C: Run without Docker (Developer Mode)

Best for development/testing.

Requirements

Node.js 20+

npm

Backend
cd server
cp .env.example .env
npm install
npx prisma db push
node prisma/seed.js
npm run dev
Frontend

In a second terminal:

cd web
npm install
npm run dev
