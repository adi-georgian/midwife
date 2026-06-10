# Single-image build for Midwife: builds the React frontend, then runs the FastAPI
# backend which serves both the API and the built frontend. Works on any host that
# runs containers (Render, Google Cloud Run, etc). The host provides $PORT.

# ---- Stage 1: build the frontend ----
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Clerk's publishable key is public and must be embedded at build time (Vite inlines
# VITE_* vars). Render supplies it from the service env var of the same name.
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
RUN npm run build

# ---- Stage 2: Python runtime ----
FROM python:3.13-slim
WORKDIR /app

# uv is the project's package manager.
RUN pip install --no-cache-dir uv

# Install dependencies only (not the project itself) for fast, cached layers.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# App code + the frontend build from stage 1.
COPY backend/ ./backend/
COPY --from=frontend /app/frontend/dist ./frontend/dist

ENV PORT=8000
EXPOSE 8000

# Bind to 0.0.0.0 and the host-provided $PORT (Render/Cloud Run set this).
CMD ["sh", "-c", ".venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
