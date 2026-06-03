# MAZE·RL — Complete Docker Guide for Beginners

Docker packages your entire app (backend, frontend, database) into
self-contained boxes called **containers**. Once it works in Docker,
it works identically on any computer or server — no "works on my
machine" problems.

---

## What You'll Have After This

```
Your computer / server
├── Container: mazerl_db        (PostgreSQL database)
├── Container: mazerl_backend   (FastAPI Python server)
└── Container: mazerl_frontend  (React app served by Nginx)
```

All three talk to each other automatically. You start them all with
one single command.

---

## PART 1 — Install Docker

### Windows

1. Go to **docs.docker.com/desktop/install/windows-install**
2. Download **Docker Desktop for Windows**
3. Run the installer (it installs everything — Docker + Docker Compose)
4. Restart your computer when asked
5. Open Docker Desktop — wait for it to show "Docker is running" (green icon in taskbar)
6. Open PowerShell and test:
   ```powershell
   docker --version
   docker compose version
   ```
   You should see version numbers. If yes, Docker is ready.

> **Note:** Docker Desktop requires Windows 10/11 with WSL2 enabled.
> If it asks you to install WSL2, follow the on-screen instructions —
> it takes about 5 minutes.

---

## PART 2 — Project File Structure

Make sure your project looks like this before continuing:

```
mazerlv5/                        ← root folder
├── docker-compose.yml           ← NEW (wires everything together)
├── .env.docker                  ← NEW (your passwords/secrets)
├── backend/
│   ├── Dockerfile               ← NEW (how to build the backend container)
│   ├── .dockerignore            ← NEW (files to exclude)
│   ├── main.py
│   ├── auth.py
│   ├── requirements.txt
│   └── ... (all other backend files)
└── frontend/
    ├── Dockerfile               ← NEW (how to build the frontend container)
    ├── .dockerignore            ← NEW (files to exclude)
    ├── nginx-frontend.conf      ← NEW (frontend Nginx config)
    ├── package.json
    └── ... (all other frontend files)
```

All the new files are already included in the zip you downloaded.

---

## PART 3 — Set Up Your Environment File

This is where you put your passwords. Docker reads this file automatically.

**Step 1:** Open the `mazerlv5` folder in File Explorer

**Step 2:** Find the file called `.env.docker`

**Step 3:** Copy it and rename the copy to `.env`
- Right-click `.env.docker` → Copy
- Right-click in the same folder → Paste
- Rename the new file to `.env` (remove the `.docker` part)

**Step 4:** Open `.env` with Notepad and fill in the values:

```
DB_PASSWORD=choose_any_password_like_Maze2024secure
MAZERL_SECRET=paste_a_long_random_string_here
SMTP_USER=pkspratyush710@gmail.com
SMTP_PASSWORD=your_gmail_app_password
ALLOWED_ORIGINS=*
```

**How to generate MAZERL_SECRET:**
Open PowerShell and run:
```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```
Copy the output and paste it as your MAZERL_SECRET.

**Save and close** the `.env` file.

> ⚠️  Never share the `.env` file or upload it to GitHub.
>    It contains your passwords.

---

## PART 4 — Build and Run with Docker

Open PowerShell and navigate to your project folder:

```powershell
cd C:\Users\Pratyush\OneDrive\Desktop\folderp\mazerlv5
```

(Adjust the path to wherever you unzipped the project)

### First time — build and start everything:

```powershell
docker compose up --build
```

**What happens:**
1. Docker downloads Python 3.11, Node 20, PostgreSQL, and Nginx base images (~500MB total, one time only)
2. Builds the backend container (installs pip packages, generates mazes)
3. Builds the frontend container (runs `npm install` + `npm run build`)
4. Starts all three containers
5. PostgreSQL tables are created automatically on first boot

**This takes 3–8 minutes the first time.** You'll see a lot of output scrolling — that's normal.

When you see lines like these, it's ready:
```
mazerl_backend   | INFO:     Application startup complete.
mazerl_frontend  | 2024/01/01 12:00:00 [notice] nginx: worker process is started
```

### Open your browser:

```
http://localhost
```

That's it. The game is running inside Docker.

---

## PART 5 — Everyday Commands

Open PowerShell in your project folder for all of these.

**Start (after first build — much faster):**
```powershell
docker compose up
```

**Start in background (so you can close the terminal):**
```powershell
docker compose up -d
```

**Stop everything:**
```powershell
docker compose down
```

**Stop and delete the database (fresh start):**
```powershell
docker compose down -v
```
> ⚠️  `-v` deletes all saved data including users and scores. Only use this if you want a completely clean slate.

**See what's running:**
```powershell
docker compose ps
```

**See live logs:**
```powershell
docker compose logs -f
```

**See logs for one service only:**
```powershell
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

**Rebuild after code changes:**
```powershell
docker compose up --build
```

---

## PART 6 — Understanding What Each File Does

### `docker-compose.yml`
The master file. It tells Docker:
- What containers to create (db, backend, frontend)
- How they connect to each other
- What ports to open
- Where to store the database data

### `backend/Dockerfile`
A recipe for building the backend container:
1. Start with Python 3.11
2. Install system packages
3. Install pip packages from requirements.txt
4. Copy your code
5. Run `uvicorn main:app` when started

### `frontend/Dockerfile`
A two-stage recipe:
- **Stage 1:** Use Node.js to run `npm run build` (produces the `dist/` folder)
- **Stage 2:** Copy only the built files into a tiny Nginx container

The final frontend image has no Node.js in it — just static HTML/CSS/JS files served by Nginx. This makes it ~25MB instead of ~500MB.

### `frontend/nginx-frontend.conf`
Tells Nginx inside the frontend container how to serve the React app. The key part is `try_files $uri /index.html` — without this, refreshing on any page other than `/` would give a 404 error.

### `.env.docker` / `.env`
Your secrets. Docker Compose reads `.env` automatically and injects the values into each container as environment variables. Your Python code reads them with `os.environ.get(...)`.

---

## PART 7 — Troubleshooting

**"Port 80 is already in use"**
Something else is using port 80 (maybe another web server).
Change the frontend port in `docker-compose.yml`:
```yaml
ports:
  - "3000:80"   # use port 3000 instead
```
Then open `http://localhost:3000`

**"Port 8000 is already in use"**
Your old Uvicorn is still running. Stop it first, then run Docker.

**Backend can't connect to database**
Make sure DB_PASSWORD in `.env` matches everywhere.
Try: `docker compose down -v` then `docker compose up --build`

**Changes to code not showing up**
Run `docker compose up --build` (the `--build` flag rebuilds the images with your new code).

**Docker says "Cannot connect to Docker daemon"**
Docker Desktop isn't running. Open it from the Start menu and wait for the green icon.

---

## PART 8 — After Docker Works Locally → Deploy to Render

Once Docker works on your machine, deploying to Render is simple:

1. Push your project to **GitHub** (create a free account at github.com)
2. Go to **render.com** → New → Web Service
3. Connect your GitHub repo
4. Render detects the Dockerfile automatically
5. Set the same environment variables from your `.env` file in Render's dashboard
6. Click Deploy

Render gives you a free public URL like `mazerl.onrender.com`.

---

## Summary — The One Command You Need

```powershell
# From the mazerlv5 folder:
docker compose up --build
```

Then open: `http://localhost`
