"""Locks in the core privacy guarantee: a user only ever sees/edits their own canvases.

These tests exercise the HTTP layer with a temporary SQLite database and the dev
identity header. They don't call the LLM — canvases are created directly via the store,
then the ownership-sensitive endpoints are checked. If a future change weakens ownership
scoping, one of these will fail.
"""

import os
import pathlib
import tempfile
import uuid

# Point the app at a throwaway database BEFORE importing it (db.py reads this at import).
_TMP_DB = pathlib.Path(tempfile.gettempdir()) / "midwife_test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP_DB}"
os.environ.pop("ANTHROPIC_VERTEX_PROJECT_ID", None)  # no real provider needed

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from backend.db import canvases, engine
from backend.main import app, store
from backend.models import AspectNode, SessionState

client = TestClient(app)
ALICE = {"X-Dev-User-Email": "alice@georgian.io"}
BOB = {"X-Dev-User-Email": "bob@georgian.io"}


@pytest.fixture(autouse=True)
def _clean_db():
    with engine.begin() as conn:
        conn.execute(delete(canvases))
    yield


def _make_canvas(owner: str, objective: str = "Test objective") -> str:
    sid = str(uuid.uuid4())
    state = SessionState(
        session_id=sid,
        objective=objective,
        root=AspectNode(id="root", aspect="root", question=objective, suggestions=[]),
    )
    store.create_session(state, owner)
    return sid


def test_me_reflects_the_caller():
    assert client.get("/me", headers=ALICE).json()["email"] == "alice@georgian.io"
    assert client.get("/me", headers=BOB).json()["email"] == "bob@georgian.io"


def test_canvas_list_is_owner_scoped():
    _make_canvas("alice@georgian.io", "Alice's canvas")
    _make_canvas("bob@georgian.io", "Bob's canvas")
    alice = client.get("/sessions", headers=ALICE).json()["sessions"]
    bob = client.get("/sessions", headers=BOB).json()["sessions"]
    assert [s["objective"] for s in alice] == ["Alice's canvas"]
    assert [s["objective"] for s in bob] == ["Bob's canvas"]


def test_other_users_canvas_looks_missing():
    sid = _make_canvas("alice@georgian.io")
    assert client.get(f"/session/{sid}/state", headers=BOB).status_code == 404
    assert client.get(f"/session/{sid}/state", headers=ALICE).status_code == 200


def test_only_owner_can_delete():
    sid = _make_canvas("alice@georgian.io")
    assert client.delete(f"/session/{sid}", headers=BOB).status_code == 404
    assert client.get(f"/session/{sid}/state", headers=ALICE).status_code == 200  # survived
    assert client.delete(f"/session/{sid}", headers=ALICE).status_code == 200
    assert client.get("/sessions", headers=ALICE).json()["sessions"] == []


def test_view_state_persists_and_is_owner_scoped():
    sid = _make_canvas("alice@georgian.io")
    tabs = [{"id": "overview", "title": "Plan", "content": "the plan"}]
    # Bob cannot write to Alice's canvas.
    assert client.post(f"/session/{sid}/view-state", headers=BOB,
                       json={"discourse_finished": True}).status_code == 404
    # Alice can, and it round-trips through the resume endpoint.
    assert client.post(f"/session/{sid}/view-state", headers=ALICE,
                       json={"panel_tabs": tabs, "discourse_finished": True}).status_code == 200
    state = client.get(f"/session/{sid}/state", headers=ALICE).json()
    assert state["discourse_finished"] is True
    assert state["panel_tabs"] == tabs


def test_healthz_is_open():
    assert client.get("/healthz").json() == {"status": "ok"}
