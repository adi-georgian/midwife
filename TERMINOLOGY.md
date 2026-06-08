# Midwife

Midwife turns ideas into action via the Socratic method, modelling discourse as a tree
that branches a central objective into aspects (questions/challenges). This context
covers the language of the app and its internal-deployment model at Georgian.

## Language

**Canvas**:
A single discourse tree — one objective branching into aspects. User-facing term for what
the code calls a `Session` (`SessionState`, keyed by `session_id`).
_Avoid_: Session (code-only), tree, board, document.

**Aspect**:
A node within a Canvas representing a Socratic question or challenge to the objective or a
parent aspect. Has a label, a question, an optional answer, and child aspects.
_Avoid_: Node, question (the question is one field of an aspect, not the aspect itself).

**User**:
A person authenticated via Georgian SSO. Authorization rule: **any authenticated
`@georgian.io` identity is authorized** — there is no allowlist. Authenticated equals
authorized.
_Avoid_: Account (ambiguous — see below), member.

**Owner**:
The single User a Canvas belongs to — its creator. Every Canvas is private to exactly one
Owner; only they can list, open, edit, or delete it. No sharing, collaboration, or
team/workspace concept exists (v1).
_Avoid_: Author, collaborator (there are no collaborators).

## Flagged ambiguities

- **"Account-level storage"** (from the original request) resolved to **Owner-scoped
  storage**: Canvases are private per Owner. "Account" is otherwise avoided because it
  blurs User (the person) with any billing/org notion that does not exist here.
- **Identity provider** (GCP IAP over Google Workspace vs. Okta OIDC) is an **open
  question pending IT**. The auth layer is built as one swappable dependency so the choice
  can be made late without touching domain code.

## Example dialogue

> **Dev:** When someone opens a canvas, how do we know they're allowed to see it?
> **Aditya:** They're the Owner. A Canvas belongs to one User — whoever created it.
> **Dev:** So if I have the URL to your canvas, can I open it?
> **Aditya:** No. We scope every lookup by Owner. If it isn't yours, the server behaves as
> if it doesn't exist — a 404, not a 403, so we don't even leak that it's there.
> **Dev:** And "any Georgian employee can log in" — does that mean they can see each
> other's canvases?
> **Aditya:** No. Anyone `@georgian.io` is *authorized to use the app*, but a Canvas is
> still private to its Owner.
