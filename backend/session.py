import json
from pathlib import Path

from backend.models import SessionState

SESSIONS_DIR = Path(__file__).parent / "sessions"


class SessionStore:
    def __init__(self):
        SESSIONS_DIR.mkdir(exist_ok=True)
        self._sessions: dict[str, SessionState] = {}
        self._load_all()

    def _load_all(self):
        for f in SESSIONS_DIR.glob("*.json"):
            try:
                data = json.loads(f.read_text())
                state = SessionState.model_validate(data)
                self._sessions[state.session_id] = state
            except Exception:
                pass  # skip corrupt files silently

    def _persist(self, state: SessionState):
        path = SESSIONS_DIR / f"{state.session_id}.json"
        path.write_text(state.model_dump_json())

    def create_session(self, state: SessionState) -> None:
        self._sessions[state.session_id] = state
        self._persist(state)

    def get_session(self, session_id: str) -> SessionState | None:
        return self._sessions.get(session_id)

    def save_session(self, state: SessionState) -> None:
        self._sessions[state.session_id] = state
        self._persist(state)
