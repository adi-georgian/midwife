import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.interview import generate_questions
from backend.models import (
    AspectNode,
    AnswerRequest,
    CreateSessionRequest,
    CreateSessionResponse,
    ElaborateResponse,
    SessionState,
    TreeResponse,
)
from backend.session import SessionStore

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

store = SessionStore()


@app.post("/session", response_model=CreateSessionResponse)
async def create_session(request: CreateSessionRequest):
    session_id = str(uuid.uuid4())

    raw_questions = generate_questions(objective=request.objective)

    aspects = [
        AspectNode(
            id=str(uuid.uuid4()),
            aspect=q["aspect"],
            question=q["question"],
            suggestions=q["suggestions"],
        )
        for q in raw_questions
    ]

    root = AspectNode(
        id="root",
        aspect=request.objective[:50],
        question=request.objective,
        suggestions=[],
        children=aspects,
    )

    session = SessionState(
        session_id=session_id,
        objective=request.objective,
        root=root,
    )
    store.create_session(session)

    return CreateSessionResponse(session_id=session_id, aspects=aspects)


@app.post("/session/{session_id}/answer/{aspect_id}")
async def answer_aspect(
    session_id: str, aspect_id: str, request: AnswerRequest
):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    node = session.find_node(aspect_id)
    if not node:
        raise HTTPException(status_code=404, detail="Aspect not found")

    node.answer = request.answer
    store.save_session(session)

    return {"status": "ok", "aspect_id": aspect_id, "answer": request.answer}


@app.post(
    "/session/{session_id}/elaborate/{aspect_id}",
    response_model=ElaborateResponse,
)
async def elaborate_aspect(session_id: str, aspect_id: str):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    path = session.get_path_to_node(aspect_id)
    if not path:
        raise HTTPException(status_code=404, detail="Aspect not found")

    target_node = path[-1]

    if not target_node.answer:
        raise HTTPException(
            status_code=400, detail="Cannot elaborate unanswered aspect"
        )

    # Build context path for the LLM (skip root node)
    context_path = [
        {"aspect": n.aspect, "question": n.question, "answer": n.answer}
        for n in path[1:]
        if n.answer
    ]

    raw_questions = generate_questions(
        objective=session.objective, context_path=context_path
    )

    new_nodes = [
        AspectNode(
            id=str(uuid.uuid4()),
            aspect=q["aspect"],
            question=q["question"],
            suggestions=q["suggestions"],
        )
        for q in raw_questions
    ]

    target_node.children.extend(new_nodes)
    store.save_session(session)

    return ElaborateResponse(aspects=new_nodes)


@app.get("/session/{session_id}/tree", response_model=TreeResponse)
async def get_tree(session_id: str):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return TreeResponse(
        session_id=session.session_id,
        objective=session.objective,
        root=session.root,
    )
