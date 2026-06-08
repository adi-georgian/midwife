"""Storage for Canvases (Sessions), scoped by owner.

Every method takes an `owner` (an email). Reads and writes only ever touch
canvases belonging to that owner. If you ask for a canvas that isn't yours,
`get_session` returns None — exactly as if it didn't exist — so the app never
reveals that someone else's canvas is there.
"""

from sqlalchemy import delete, insert, select, update

from backend.db import canvases, engine, init_db, now_utc
from backend.models import SessionState


class SessionStore:
    def __init__(self):
        init_db()

    def create_session(self, state: SessionState, owner: str) -> None:
        now = now_utc()
        with engine.begin() as conn:
            conn.execute(
                insert(canvases).values(
                    id=state.session_id,
                    owner=owner,
                    objective=state.objective,
                    discourse_name=state.discourse_name,
                    data=state.model_dump(),
                    created_at=now,
                    updated_at=now,
                )
            )

    def get_session(self, session_id: str, owner: str) -> SessionState | None:
        """Return the canvas only if it exists AND belongs to `owner`, else None."""
        with engine.begin() as conn:
            row = conn.execute(
                select(canvases.c.data).where(
                    canvases.c.id == session_id,
                    canvases.c.owner == owner,
                )
            ).first()
        if row is None:
            return None
        return SessionState.model_validate(row[0])

    def save_session(self, state: SessionState, owner: str) -> bool:
        """Persist changes to a canvas the owner owns. Returns False if not theirs."""
        now = now_utc()
        with engine.begin() as conn:
            result = conn.execute(
                update(canvases)
                .where(
                    canvases.c.id == state.session_id,
                    canvases.c.owner == owner,
                )
                .values(
                    objective=state.objective,
                    discourse_name=state.discourse_name,
                    data=state.model_dump(),
                    updated_at=now,
                )
            )
        return result.rowcount > 0

    def delete_session(self, session_id: str, owner: str) -> bool:
        """Permanently delete a canvas the owner owns. Returns False if not theirs."""
        with engine.begin() as conn:
            result = conn.execute(
                delete(canvases).where(
                    canvases.c.id == session_id,
                    canvases.c.owner == owner,
                )
            )
        return result.rowcount > 0

    def list_sessions(self, owner: str) -> list[dict]:
        """All canvases owned by `owner`, most recently updated first."""
        with engine.begin() as conn:
            rows = conn.execute(
                select(
                    canvases.c.id,
                    canvases.c.objective,
                    canvases.c.discourse_name,
                    canvases.c.created_at,
                    canvases.c.updated_at,
                )
                .where(canvases.c.owner == owner)
                .order_by(canvases.c.updated_at.desc())
            ).all()
        return [
            {
                "session_id": r.id,
                "objective": r.objective,
                "discourse_name": r.discourse_name,
                "created_at": r.created_at,
                "updated_at": r.updated_at,
            }
            for r in rows
        ]
