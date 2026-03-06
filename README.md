```md
# MRLC GED Exam App

A self-hosted **Exam + Quiz web application** built for **Mon Refugee Learning Centre (MRLC)** to run GED practice quizzes/exams **locally (offline-first)** with an option to enable **remote access**. Teachers can manage classes, students, passages for reading comprehension, questions, quizzes, and export results—while students can join and take timed quizzes with a **server-enforced timer**.

**Author:** Tao Mon Lae

---

## Features

### Admin / Teacher
- **Class Management**
  - Create classes
  - Auto-generate and share class codes
  - Optional join PIN
  - Configure join policies (where enabled)
- **Student Management**
  - Add students to roster
  - Import students from CSV (bulk)
  - Create/reset student accounts (optional)
- **Passage Library (RLA + Other Subjects)**
  - Add comprehension passages for RLA (and other subjects if needed)
  - Link questions to passages for comprehension quizzes
- **Question Bank**
  - Multiple question types: **MCQ**, **Multi-select**, **Short answer**, **Numeric**, **Reorder**
  - **Tags** and **difficulty levels**
  - Duplicate questions (fast authoring)
- **Quiz / Exam Builder**
  - Build quizzes from question bank
  - Time limit per quiz (minutes)
  - Shuffle questions option
  - Publish/unpublish control (students only see **published** quizzes)
  - Duplicate quizzes (create draft copies)
- **Reports**
  - Class marks matrix (students × quizzes)
  - Quiz statistics (avg/max/min/submissions)
  - **Missing students** list (who didn’t submit)
- **Exports**
  - Export quiz marks CSV
  - Export class results / marks matrix CSV

### Students
- Join class using class code (and PIN if enabled)
- View **published quizzes only**
- Take quizzes with **server-enforced timer**
- Autosave answers
- Submit quiz (server validates time)

### Deployment / Reliability
- Runs on **Docker** (easy install on Ubuntu)
- Supports:
  - **SQLite** (offline/local LAN)
  - **Postgres** (remote/hosted)

---

## Tech Stack
- **Frontend:** React + Vite  
- **Backend:** Node.js + Express  
- **ORM:** Prisma  
- **Database:** SQLite (local) / Postgres (remote)  
- **Deployment:** Docker + Docker Compose  

---

## Project Structure
```

.
├─ docker-compose.sqlite.yml
├─ docker-compose.postgres.yml
├─ Dockerfile
├─ server/
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  └─ seed.js
│  └─ src/
│     ├─ index.js
│     ├─ routes/
│     └─ middleware/
└─ web/
├─ src/
│  ├─ pages/
│  ├─ components/
│  └─ lib/
└─ vite.config.js

````

---

## Quick Start (Docker + SQLite) — Recommended for Local/Offline

### Requirements
- Docker installed
- Docker Compose plugin installed

Check:
```bash
docker --version
docker compose version
````

### Run (SQLite)

From the project folder:

```bash
docker compose -f docker-compose.sqlite.yml up -d --build
```

Open:

* **[http://localhost:4001](http://localhost:4001)**

Stop:

```bash
docker compose -f docker-compose.sqlite.yml down
```

---

## Run with Docker + Postgres (Remote/Hosted)

### Run (Postgres)

```bash
docker compose -f docker-compose.postgres.yml up -d --build
```

Open:

* **[http://localhost:4001](http://localhost:4001)**

Stop:

```bash
docker compose -f docker-compose.postgres.yml down
```

---

## First Login & Setup

### Default Admin (seeded on first run)

* **Username:** admin
* **Password:** admin123

⚠️ Change this after first login.

### Recommended Setup Steps

1. Login as Admin
2. Create a class (e.g., “GED Morning”, “Pre-GED”, “GED Night”)
3. Copy/share class code with students (set a PIN if needed)
4. Import or add student roster
5. Add RLA passages + questions
6. Create quiz/exam and publish
7. Monitor submissions and export results

---

## Teacher Workflow (Recommended)

### 1) Create a Class

* Teacher Dashboard → Create Class
* Copy/share class code

### 2) Add Students

**Manual:**

* Class → Students → Add student

**CSV Import (bulk):**

* Class → Import Students
  Use CSV headers like:
* `displayName,username,password`
  (Username/password optional)

### 3) Add Passages (RLA Comprehension)

* Passages → Add Passage
* Paste paragraph(s), set title

### 4) Build Question Bank

* Questions → Add
* Add tags (example: `main-idea`, `inference`, `vocabulary`)
* Set difficulty (1 = easy → 5 = hard)

### 5) Create Quiz / Exam

* Quizzes → Create
* Choose subject, set time limit
* Add questions
* Publish when ready

### 6) Check Results

* Class Report → marks matrix + missing students
* Export CSV for records

---

## Student Workflow

1. Open the app URL (teacher provides)
2. Join class using class code (and PIN if required)
3. Open **Published Quizzes**
4. Start quiz (timer enforced by server)
5. Answer questions (autosave)
6. Submit before time expires

---

## Timer Rules (Server Enforced)

* When a student starts a quiz, the server creates an Attempt with `endsAt`
* The frontend syncs time from the server periodically
* If time expires:

  * autosave/submit is restricted and may auto-submit
  * server decides final acceptance based on `endsAt`
    This prevents students from refreshing to gain extra time.

---

## Reports & Exports

* **Class Report**

  * Marks matrix (students × quizzes)
  * Quiz stats (avg/max/min/submissions)
  * Missing students list (not submitted)
* **CSV Exports**

  * Quiz marks CSV (per quiz)
  * Class results / marks matrix CSV

Open CSV in Excel / Google Sheets / LibreOffice.

---

## Backups

### SQLite (Local)

SQLite DB is stored in Docker volume. Recommended:

* Stop containers and copy the volume to a safe place
* Or add/enable a backup endpoint later (recommended future upgrade)

### Postgres (Remote)

Recommended:

* `pg_dump` scheduled backups
* store backups off-server

---

## Troubleshooting

### Port already in use (4001)

Check which container is using it:

```bash
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

Stop the old container:

```bash
docker stop <container_name>
```

Or change port mapping in compose:

```yml
ports:
  - "4010:4001"
```

### Slow build / npm install

First build downloads dependencies; later builds use Docker cache.

---

## Security Recommendations

* Change default admin password immediately
* If exposed to the internet:

  * Use HTTPS via Nginx/Caddy
  * Consider rate limiting login endpoints
* Make regular backups

---

## Author

**Tao Mon Lae**

```
```
