---
status: proposed (pending IT confirmation)
---

# Authentication via GCP IAP over Google Workspace identity

Midwife will authenticate users by their `@georgian.io` identity, with **any
authenticated Georgian identity authorized** (no allowlist). The proposed mechanism is
**GCP Identity-Aware Proxy (IAP)** at the load balancer, restricted to the `georgian.io`
domain — the app trusts a signed identity header and writes almost no auth code.

This is **proposed, not accepted**: IT/security owns Okta and must confirm whether an
internal GCP app may authenticate via IAP/Google Workspace (which likely federates to
Okta anyway) or must integrate **Okta OIDC directly**. To keep the decision reversible,
auth is implemented as a single swappable FastAPI dependency (`get_current_user`); the
provider choice changes only that dependency's internals, never domain code.

## Considered options

- **GCP IAP over Google Workspace** (proposed): lowest code/surface; SSO and
  deprovisioning follow the Google account; native on Cloud Run + HTTPS LB.
- **Okta OIDC directly**: explicitly binds auth to the corporate IdP; more code; best if
  security mandates direct Okta integration.
- **Clerk federating to Okta/Google** (rejected): fastest pre-built UX, but introduces a
  third party that custodies identity/session data — a poor fit for MNPI-sensitive
  internal tooling.

## Update (2026-05-31) — Clerk is now the leading option

Georgian already runs SSO on **Clerk**, set up by Jeremy Chua (AI Tech Lead). That changes
the calculus: Clerk is no longer an unvetted extra vendor — it is the **established,
org-blessed identity pattern**, so reusing it is the path of least resistance and least
risk. It is also **host-independent** (unlike IAP, which is GCP-only), so it works equally
well on Render or GCP and decouples the auth decision from the hosting decision.

Leaning toward **Clerk**, pending Jeremy's confirmation of how to onboard Midwife (Clerk
instance/org, `@georgian.io` domain restriction, frontend SDK + backend token
verification). Our swappable `get_current_user` dependency already isolates this — adopting
Clerk changes only that function's body. IAP/Okta-direct retained as fallbacks.
