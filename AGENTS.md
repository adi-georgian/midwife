# AGENTS.md

Code-level context for Midwife. Domain language lives in [TERMINOLOGY.md](./TERMINOLOGY.md);
architecture decisions in [docs/adr/](./docs/adr/); higher-level project context lives in
the Obsidian vault (`Projects/midwife`).

## What this is

A web app that turns an idea into action via the Socratic method, modelling discourse as a
tree: a central **objective** branches into **aspects** (questions/challenges), which
recursively contain child aspects. See `TERMINOLOGY.md` for the precise domain glossary
(Canvas, Aspect, User, Owner).

## Stack & layout

- **Frontend** (`frontend/`): React 19 + Vite SPA. Canvas rendering via `@xyflow/react`
  (React Flow) + `@dagrejs/dagre` for layout. Entry `src/App.jsx`; API client in
  `src/api.js`; components in `src/components/`.
- **Backend** (`backend/`): FastAPI. `main.py` = HTTP routes; `interview.py` = all LLM
  prompt logic; `models.py` = Pydantic models (`AspectNode`, `SessionState`, request/
  response types); `session.py` = persistence (`SessionStore`).
- **LLM**: one provider seam in `backend/interview.py`. Set `ANTHROPIC_VERTEX_PROJECT_ID`
  → Claude + Gemini run on **GCP Vertex AI** (Claude = Sonnet 4.6, auth via Application
  Default Credentials, data stays in Georgian's GCP). Otherwise it uses the public
  `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`. Missing providers are skipped, not fatal.
- Python ≥ 3.13, deps via `uv` (`pyproject.toml` / `uv.lock`). Tests: `uv run pytest`.

## Running locally

```bash
uv run uvicorn backend.main:app --reload   # backend on :8000
cd frontend && npm install && npm run dev   # frontend on :5173 (proxies /session -> :8000)
```

Requires `.env` with `ANTHROPIC_API_KEY` and `GEMINI_API_KEY` (see `.env.example`).

## How it works today

- A **Canvas** = a `SessionState` keyed by `session_id` (UUID). The whole discourse tree is
  the `root: AspectNode` with recursive `children`.
- **Storage is a database** (`backend/db.py`, via SQLAlchemy). One `canvases` table: the
  whole `SessionState` lives in a JSON `data` column, alongside an `owner` column and a few
  lookup columns. Local dev uses a SQLite file (`backend/midwife.db`); production points
  `DATABASE_URL` at Cloud SQL Postgres — same code. `backend/session.py`'s `SessionStore`
  is **owner-scoped**: every method takes an `owner` email; cross-owner reads return None
  (the route then 404s, so we never reveal another user's canvas exists).
- **Identity** comes from `backend/auth.py`'s `get_current_user` dependency, which every
  route depends on. **Dev only:** it returns a pretend user (`X-Dev-User-Email` header or
  `DEV_USER_EMAIL` env, default `you@georgian.io`). Production swaps the body of that one
  function for real IAP/Okta verification — nothing else changes. See ADR-0002.
- Endpoints include `GET /me` (who am I), `GET /sessions` (my canvases),
  `GET /session/{id}/state` (full state, to resume on any device),
  `POST /session/{id}/view-state` (persist plan/panel tabs + finished flag server-side),
  `DELETE /session/{id}` (hard-delete a whole canvas), and `GET /healthz` (open liveness probe).
- The frontend's canvas list is **server-authoritative**: `App.jsx` loads it from
  `GET /sessions`, resumes via `GET /session/{id}/state` when the canvas isn't cached
  locally, deletes server-side, and shows "Signed in as …" via `GET /me`.
  `localStorage["midwife_sessions"]` is now only a quick-resume cache (rich tree/panel
  state); theme stays in `localStorage["midwife_theme"]`. The Vite dev proxy forwards
  `/session*` and `/me` to the backend.
- CORS origins are env-driven (`CORS_ALLOW_ORIGINS`, default `http://localhost:5173`).
- **Single-service / Docker**: when `frontend/dist` exists, `main.py` mounts it at `/` so
  the backend serves both API and UI. The `Dockerfile` builds the SPA then runs the backend,
  binding `$PORT` — host-agnostic (Render or Cloud Run). Hosting stays open (ADR-0004);
  `DATABASE_URL` + the swappable-auth seam keep it portable.
- Papercut: `backend/interview.py` reads `GEMINI_API_KEY` at import time, so the app won't
  start without API keys present. Clean this up during the Vertex switch.

## Internal-deployment direction (in progress)

Deploying for internal Georgian use at `midwife.georgian.io`. The domain logic stays; what
is being added is a **User identity** and **Owner-scoped storage**. See the ADRs:

- LLM moves to **Anthropic on Vertex AI** (`AnthropicVertex`), no static keys — ADR-0001.
- **Auth** via GCP IAP / Google Workspace, restricted to `@georgian.io`, behind a single
  swappable `get_current_user` dependency (Okta-OIDC alternative pending IT) — ADR-0002.
- **Persistence** moves to **Cloud SQL Postgres** with the tree as a JSONB column and an
  `owner_email` column; every query scoped by owner; cross-owner access returns 404 — ADR-0003.
- Hosting: single **Cloud Run** service (FastAPI serves the built SPA + API) behind an
  HTTPS load balancer with a managed cert.

When implementing: add `GET /me` and `GET /sessions` (list my canvases), owner-scope all
`/session/{id}/*` routes, and replace the localStorage canvas list with a fetch from
`/sessions`.

## Conventions

- Code-level context → this file (`AGENTS.md`). Project-level context → Obsidian
  `Projects/midwife` (maintained via the `/pm` and `/log` skills). Local learnings →
  `/self-improve` (`.learnings/`).
