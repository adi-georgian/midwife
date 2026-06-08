# Owner-scoped persistence on Cloud SQL Postgres (tree as JSONB)

The current `SessionStore` (in-memory dict + one JSON file per session on local disk) is
replaced by **Cloud SQL Postgres**: a `sessions` table with an `owner_email` column and
the discourse tree stored as a **JSONB** column. Every read/write is scoped by
`owner_email`, and cross-owner access returns **404, not 403**, so the server never leaks
that another user's canvas exists.

Postgres + JSONB was chosen because the code already serializes the whole `SessionState`
to JSON on every save, so a JSONB column is a near drop-in for the existing whole-object
write semantics — no need to normalize the recursive aspect tree into relational rows.
The file store was rejected because it cannot enforce ownership, does not survive
multi-instance / stateless Cloud Run hosting, and offers no query path for "list my
canvases." Firestore was considered but Postgres keeps the door open for relational
features (sharing, audit) without a data-model rewrite.
