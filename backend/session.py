from backend.models import SessionState


class SessionStore:
    def __init__(self):
        self._sessions: dict[str, SessionState] = {}

    def create_session(self, state: SessionState) -> None:
        self._sessions[state.session_id] = state

    def get_session(self, session_id: str) -> SessionState | None:
        return self._sessions.get(session_id)

    def save_session(self, state: SessionState) -> None:
        self._sessions[state.session_id] = state
