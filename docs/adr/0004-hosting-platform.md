---
status: accepted — Render (2026-05-31); data-residency detail pending Jeremy
---

# Hosting platform: Render vs. GCP (kept open by a portable design)

> **Decision (2026-05-31): host on Render.** Georgian has invested in Render and wants to
> dogfood it. The app is already portable, so this is config, not a rewrite. One detail
> remains for Jeremy Chua: whether canvas data (possible MNPI) may live in **Render
> Managed Postgres**, or whether the database should stay on **GCP Cloud SQL** while the app
> runs on Render. Auth will use Clerk (ADR-0002), which is host-independent — so it pairs
> cleanly with Render. LLM stays on Vertex (ADR-0001), reachable from Render.

Georgian has invested in **Render** (a managed application-hosting platform, like
Vercel/Heroku) and there is appetite to dogfood it. Render could host all of Midwife: a
Web Service for the FastAPI app (which also serves the built React frontend), Render
Managed PostgreSQL for storage, a custom domain (`midwife.georgian.io`) with automatic
TLS, and git-push deploys.

**Decision: keep the hosting target open and make the code portable**, rather than binding
to one platform now. Concretely the app already reads `DATABASE_URL` (so the database can
live anywhere) and isolates identity behind a single `get_current_user` dependency (so the
login mechanism can change). Moving to Render is then mostly configuration (a `render.yaml`
Blueprint + env vars), not a rewrite.

Two consequences gate the final choice and are **questions for InfoSec (Chris)**:

- **Data residency (the big one).** Sensitive canvas content (assume MNPI). On GCP Cloud
  SQL the data sits inside Georgian's own Google Cloud project; on Render Managed Postgres
  it lives on Render's managed infrastructure (a third party from Georgian's
  controlled-environment view). A middle path is to host the *app* on Render but point
  `DATABASE_URL` at GCP Cloud SQL, keeping data-at-rest in Georgian's GCP — at the cost of
  cross-provider networking. Whether Render Postgres is an acceptable home for MNPI is
  Chris's call.
- **Auth.** Identity-Aware Proxy (IAP) is GCP-only. Hosting on Render takes IAP off the
  table and points auth toward **Okta OIDC directly in the app** (our swappable dependency
  already supports this). See ADR-0002.

LLM access (Anthropic on Vertex, ADR-0001) is unaffected: it is an outbound call that works
from any host, including Render.
