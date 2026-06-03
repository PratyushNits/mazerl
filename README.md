# MAZE·RL — Reinforcement Learning Maze Game

A real-time maze game where a human player races against a Q-learning AI agent.
Two modes: **Free Play** (no login) and **Ranked** (login required, scores saved).

---

## What's New in This Version

| Feature | Details |
|---|---|
| PostgreSQL database | Replaces flat `users.json`. Stores all user accounts and scores. |
| User accounts | Registered users stored in `users` table (username, email, hashed password). |
| Score tracking | Top score per user per tier stored in `scores` table (best time wins). |
| Public Leaderboard | Top 5 players per tier — accessible from the landing page without logging in. |
| Leaderboard button | Added to the landing page. Opens a full-page leaderboard with Easy / Medium / Hard tabs. |
| Score submission | After every ranked race, the result is automatically saved to the database. |
| Personal best banner | "🏅 NEW PERSONAL BEST!" shown on the result screen if a new record is set. |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI + Uvicorn (Python 3.11+) |
| Database | PostgreSQL 17 |
| ORM | SQLAlchemy 2.0 async + asyncpg driver |
| Auth | JWT (python-jose HS256) + bcrypt (passlib) |
| RL Agent | Custom Q-learning (Q-table, epsilon-greedy) |
| Frontend | React 18 + Vite 5 |
| Fonts | Orbitron, Share Tech Mono (Google Fonts) |

---

## Project Structure

```
mazerl/
├── backend/
│   ├── main.py           FastAPI entry point — race/maze/WebSocket endpoints
│   ├── auth.py           POST /auth/register  /login  /me
│   ├── db.py             SQLAlchemy engine, Base, User + Score models
│   ├── scores.py         POST /scores/submit  GET /scores/me  /leaderboard
│   ├── maze_parser.py    PNG → grid + start/end
│   ├── q_agent.py        Q-learning agent
│   ├── race_engine.py    Live race state machine
│   ├── skill_tracker.py  Adaptive agent speed
│   ├── generate_mazes.py One-time maze PNG generator
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/
    ├── vite.config.js
    └── src/
        ├── App.jsx                  Screen state machine
        ├── index.css                Design system (CSS variables)
        └── components/
            ├── LandingPage.jsx      Mode select + LEADERBOARD button
            ├── LeaderboardPage.jsx  Public top-5 leaderboard (new)
            ├── AuthPage.jsx         Login / Register
            ├── RankedScreen.jsx     Ranked lobby
            ├── UploadScreen.jsx     Free play maze picker
            ├── MazeSelectGrid.jsx   Maze thumbnail grid
            ├── MazeCanvas.jsx       Canvas renderer
            ├── RaceScreen.jsx       Live race
            └── ResultScreen.jsx     Post-race result + score submit
```

---

## Prerequisites

- Python 3.11 or higher
- Node.js 18 or higher
- PostgreSQL 17 installed and running on port 5432

---

## First-Time Setup

### 1. Create the PostgreSQL database

Open PowerShell (Windows) or Terminal (Mac/Linux):

```bash
psql -U postgres -c "CREATE DATABASE mazerl;"
```

### 2. Create the `.env` file

Inside the `backend/` folder, copy `.env.example` to `.env`:

```bash
# Windows
copy backend\.env.example backend\.env

# Mac / Linux
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in your PostgreSQL password:

```
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/mazerl
MAZERL_SECRET=any-long-random-string-here
```

### 3. Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4. Generate maze assets (only needed once)

```bash
python generate_mazes.py
```

### 5. Install frontend dependencies

```bash
cd frontend
npm install
```

---

## Running the App

Open **two terminals**:

**Terminal 1 — Backend**
```bash
cd backend
uvicorn main:app --reload --port 8000
```
On first run, SQLAlchemy automatically creates the `users` and `scores` tables.

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
```

Open your browser: **http://localhost:5173**

---

## How It Works

### Screen Flow

```
Landing Page
  ├── FREE PLAY  →  Upload/Pick Maze  →  Race  →  Result
  ├── RANKED     →  Login / Register  →  Ranked Lobby  →  Race  →  Result (score saved)
  └── LEADERBOARD → Public top-5 table (no login needed)
```

### Database Tables

**users** — one row per registered player
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| username | VARCHAR | Unique |
| email | VARCHAR | Unique |
| hashed_password | VARCHAR | bcrypt |
| created_at | TIMESTAMP | |

**scores** — one row per user per tier (best score only)
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | FK → users.id |
| tier | VARCHAR | easy / medium / hard |
| solved | BOOLEAN | Did player beat the agent? |
| step_count | INTEGER | |
| time_seconds | FLOAT | Lower is better |
| achieved_at | TIMESTAMP | |

**Best score rule:**
1. `solved = true` always beats `solved = false`
2. Among both solved: lower `time_seconds` wins
3. Among both unsolved: lower `step_count` wins

### API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /auth/register | — | Create account |
| POST | /auth/login | — | Login, get JWT |
| GET | /auth/me | JWT | Current user |
| POST | /scores/submit | JWT | Save race result |
| GET | /scores/me | JWT | Personal bests (all 3 tiers) |
| GET | /scores/leaderboard?tier=easy | — | Top 5 for a tier |
| GET | /mazes/{tier} | — | List pre-built mazes |
| POST | /maze/upload | — | Upload custom maze |
| POST | /race/start | — | Start a race |
| WS | /race/stream/{id} | — | Live race stream |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | asyncpg PostgreSQL connection string |
| `MAZERL_SECRET` | Yes | JWT signing key (keep secret!) |

---

## Design System

All UI uses CSS variables from `frontend/src/index.css`. Never hardcode colors.

| Variable | Value | Used for |
|---|---|---|
| `--mint` | `#0fffa0` | Free Play, success, easy tier |
| `--cyan` | `#00c8ff` | Hover states, secondary accent |
| `--pink` | `#ff3d7f` | Ranked mode, auth, hard tier |
| `--amber` | `#ffd700` | Medium tier, leaderboard, warnings |
| `--bg / --bg2 / --bg3` | Dark navy | Backgrounds |
| `--font-head` | Orbitron | Headings and labels |
| `--font-mono` | Share Tech Mono | Body text |

---

## Known Limitations

- No email verification on register
- No password reset flow
- Race sessions are in-memory — server restart disconnects active races
- Leaderboard is global per tier, not per individual maze
- No rate limiting on auth endpoints

---

## License

MIT
