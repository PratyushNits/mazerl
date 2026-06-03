# ─────────────────────────────────────────────────────────────────
#  MAZE·RL — Frontend Dockerfile
#  Two-stage build:
#    Stage 1 (builder) — installs Node, builds React app to /dist
#    Stage 2 (nginx)   — serves the built files with Nginx
#
#  The final image has NO Node.js — just Nginx + static files.
#  This keeps the image tiny (~25 MB instead of ~500 MB).
# ─────────────────────────────────────────────────────────────────

# ── STAGE 1: Build ────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (Docker cache optimization)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy the rest of the source code
COPY . .

# Build the React app for production
# Output goes to /app/dist
RUN npm run build


# ── STAGE 2: Serve ────────────────────────────────────────────────
FROM nginx:alpine

# Remove the default Nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy the built React files from Stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom Nginx config for the frontend container
# (handles React Router — all paths serve index.html)
COPY nginx-frontend.conf /etc/nginx/conf.d/default.conf

# Nginx listens on port 80 inside the container
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
