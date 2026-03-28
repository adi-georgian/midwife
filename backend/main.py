import asyncio
import uuid

import anthropic as _anthropic
from fastapi import FastAPI, HTTPException
from google.genai.errors import ClientError, ServerError
from fastapi.middleware.cors import CORSMiddleware

from backend.interview import generate_aspect_description, generate_briefing, generate_briefing_chat_update, generate_briefing_cycle, generate_chat_label, generate_chat_reply, generate_discourse_name, generate_panel_tabs, generate_questions, recontextualize_ancestors
from backend.models import (
    AddAspectRequest,
    AspectContext,
    AspectNode,
    AnswerRequest,
    BriefingAspect,
    BriefingChatRequest,
    BriefingChatResponse,
    BriefingCycleResponse,
    BriefingResponse,
    ChatRequest,
    ChatResponse,
    CreateSessionRequest,
    CreateSessionResponse,
    ElaborateResponse,
    GenerateAspectsRequest,
    GeneratePanelResponse,
    LabelChatRequest,
    MoveAspectRequest,
    UpdateAspectRequest,
    PanelTab,
    PrefetchRequest,
    PrefetchResponse,
    RecontextualizeResponse,
    RevealResponse,
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


def collect_answered_aspects(node: AspectNode) -> list[dict]:
    """Return all answered non-root nodes as {aspect, question, answer} dicts."""
    result = []
    if node.answer and node.id != "root":
        result.append({"aspect": node.aspect, "question": node.question, "answer": node.answer})
    for child in node.children or []:
        result.extend(collect_answered_aspects(child))
    return result


def collect_aspects(node: AspectNode, exclude_ids: set[str] | None = None) -> list[str]:
    exclude_ids = exclude_ids or set()
    result = []
    if node.id not in exclude_ids and node.aspect:
        result.append(node.aspect)
    for child in node.children or []:
        result.extend(collect_aspects(child, exclude_ids))
    return result


@app.post("/session", response_model=CreateSessionResponse)
async def create_session(request: CreateSessionRequest):
    try:
        session_id = str(uuid.uuid4())

        background = {
            "help_level": request.help_level,
            "prior_knowledge": request.prior_knowledge,
            "already_planned": request.already_planned,
            "constraints": request.constraints,
            "knowledge_level": request.knowledge_level,
            "extra_context": request.extra_context,
        }
        has_background = any(background.values())

        raw_questions = generate_questions(
            objective=request.objective,
            background=background if has_background else None,
            mode=request.mode,
        )

        aspects = [
            AspectNode(
                id=str(uuid.uuid4()),
                aspect=q["aspect"],
                question=q["question"],
                summary=q.get("summary", ""),
                importance=q.get("importance", 0.5),
                suggestions=q["suggestions"],
            )
            for q in raw_questions
        ]

        root = AspectNode(
            id="root",
            aspect=" ".join(request.objective.split()[:6]),
            question=request.objective,
            suggestions=[],
            children=aspects,
        )

        session = SessionState(
            session_id=session_id,
            objective=request.objective,
            mode=request.mode,
            background=background if has_background else {},
            root=root,
        )
        store.create_session(session)

        discourse_name = generate_discourse_name(request.objective)
        return CreateSessionResponse(session_id=session_id, aspects=aspects, discourse_name=discourse_name)
    except (ServerError, ClientError, _anthropic.APIStatusError, RuntimeError) as e:
        raise HTTPException(status_code=503, detail="AI service is currently overloaded. Please try again in a moment.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


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

    path_ids = {n.id for n in path}
    covered = collect_aspects(session.root, exclude_ids=path_ids)

    depth = len(path) - 1  # path includes root, so depth 1 = direct children of root
    max_questions = max(2, 6 - depth * 2)

    raw_questions = generate_questions(
        objective=session.objective,
        context_path=context_path,
        covered_aspects=covered,
        max_questions=max_questions,
        mode=session.mode,
    )

    new_nodes = [
        AspectNode(
            id=str(uuid.uuid4()),
            aspect=q["aspect"],
            question=q["question"],
            summary=q.get("summary", ""),
            importance=q.get("importance", 0.5),
            suggestions=q["suggestions"],
        )
        for q in raw_questions
    ]

    target_node.children.extend(new_nodes)
    store.save_session(session)

    return ElaborateResponse(aspects=new_nodes)


@app.post("/session/{session_id}/add-aspect/{parent_id}")
async def add_aspect(session_id: str, parent_id: str, request: AddAspectRequest):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    parent = session.find_node(parent_id)
    if not parent:
        raise HTTPException(status_code=404, detail="Parent node not found")

    question = request.question
    suggestions = request.suggestions

    if request.generate or not request.question.strip():
        path = session.get_path_to_node(parent_id)
        context_path = [
            {"aspect": n.aspect, "question": n.question, "answer": n.answer}
            for n in (path or [])[1:]
            if n.answer
        ]
        covered = collect_aspects(session.root)
        raw_questions = generate_questions(
            objective=session.objective,
            context_path=context_path if context_path else None,
            covered_aspects=covered,
            max_questions=1,
            mode=session.mode,
            target_aspect=request.aspect,
        )
        if raw_questions:
            question = raw_questions[0]["question"]
            suggestions = raw_questions[0].get("suggestions", [])

    new_node = AspectNode(
        id=str(uuid.uuid4()),
        aspect=request.aspect,
        question=question or f"How will you handle {request.aspect}?",
        suggestions=suggestions,
    )
    parent.children.append(new_node)
    store.save_session(session)

    return {"aspect": new_node.model_dump()}


@app.post("/session/{session_id}/generate-aspects/{parent_id}")
async def generate_aspects_for_label(session_id: str, parent_id: str, request: GenerateAspectsRequest):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    path = session.get_path_to_node(parent_id) or []
    context_path = [
        {"aspect": n.aspect, "question": n.question, "answer": n.answer or ""}
        for n in path[1:]
        if n.answer
    ]
    if request.details:
        context_path.append({
            "aspect": request.label,
            "question": f"What are you thinking regarding {request.label}?",
            "answer": request.details,
        })

    covered = collect_aspects(session.root)
    raw_questions = generate_questions(
        objective=session.objective,
        context_path=context_path if context_path else None,
        covered_aspects=covered,
        mode=session.mode,
    )

    aspects = [
        AspectNode(
            id=str(uuid.uuid4()),
            aspect=q["aspect"],
            question=q["question"],
            suggestions=q.get("suggestions", []),
        )
        for q in raw_questions
    ]
    return {"aspects": [a.model_dump() for a in aspects]}


@app.post("/session/{session_id}/generate-question")
async def generate_question_for_aspect(session_id: str, request: GenerateAspectsRequest):
    """Generate a single Socratic question for a named aspect given an optional description."""
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        context_path = []
        if request.details:
            context_path = [{"aspect": request.label, "question": f"What is your thinking on {request.label}?", "answer": request.details}]
        raw = generate_questions(
            objective=session.objective,
            context_path=context_path if context_path else None,
            covered_aspects=collect_aspects(session.root),
            mode=session.mode,
            background=session.background,
            target_aspect=request.label,
            max_questions=1,
        )
        question = raw[0]["question"] if raw else f"What are your thoughts on {request.label}?"
        return {"question": question}
    except (ClientError, ServerError, _anthropic.APIStatusError, RuntimeError):
        raise HTTPException(status_code=503, detail="AI service is currently overloaded. Please try again in a moment.")


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


@app.post("/session/{session_id}/prefetch", response_model=PrefetchResponse)
async def prefetch_children(session_id: str, request: PrefetchRequest):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    for aspect_id in request.aspect_ids:
        path = session.get_path_to_node(aspect_id)
        if not path:
            continue

        target_node = path[-1]
        if not target_node.answer:
            continue

        # Build context path for the LLM (skip root node)
        context_path = [
            {"aspect": n.aspect, "question": n.question, "answer": n.answer}
            for n in path[1:]
            if n.answer
        ]

        prefetch_depth = len(path) - 1
        prefetch_max_q = max(2, 6 - prefetch_depth * 2)
        raw_questions = generate_questions(
            objective=session.objective,
            context_path=context_path,
            max_questions=prefetch_max_q,
            mode=session.mode,
        )

        ghost_nodes = [
            AspectNode(
                id=str(uuid.uuid4()),
                aspect=q["aspect"],
                question=q["question"],
                summary=q.get("summary", ""),
                importance=q.get("importance", 0.5),
                suggestions=q["suggestions"],
                is_ghost=True,
            )
            for q in raw_questions
        ]

        target_node.children.extend(ghost_nodes)

    store.save_session(session)
    return PrefetchResponse(status="ok")


@app.post("/session/{session_id}/chat", response_model=ChatResponse)
async def chat(session_id: str, request: ChatRequest):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        answered = collect_answered_aspects(session.root)
        existing_aspects = collect_aspects(session.root)
        tab_ctx = request.tab_context.model_dump() if request.tab_context else None
        reply, suggested_answer, suggested_answers, new_aspects, updated_aspect, updated_question, updated_tab = generate_chat_reply(
            objective=session.objective,
            messages=[m.model_dump() for m in request.messages],
            aspect_context=request.aspect_context,
            answered_aspects=answered,
            existing_aspects=existing_aspects,
            mode=session.mode,
            tab_context=tab_ctx,
        )
        updated_tab_model = PanelTab(**updated_tab) if updated_tab else None
        return ChatResponse(
            reply=reply,
            suggested_answer=suggested_answer,
            suggested_answers=suggested_answers,
            new_aspects=new_aspects,
            updated_aspect=updated_aspect,
            updated_question=updated_question,
            updated_tab=updated_tab_model,
        )
    except (ServerError, ClientError, _anthropic.APIStatusError, RuntimeError) as e:
        raise HTTPException(status_code=503, detail="AI service is currently overloaded. Please try again in a moment.")


@app.post("/session/{session_id}/generate-panel", response_model=GeneratePanelResponse)
async def generate_panel(session_id: str):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        tabs = generate_panel_tabs(
            objective=session.objective,
            mode=session.mode,
            background=session.background,
            tree=session.root.model_dump(),
        )
        return GeneratePanelResponse(tabs=[PanelTab(**t) for t in tabs])
    except (ServerError, ClientError, _anthropic.APIStatusError, RuntimeError) as e:
        raise HTTPException(status_code=503, detail="AI service is currently overloaded. Please try again in a moment.")


@app.delete("/session/{session_id}/aspect/{aspect_id}")
async def delete_aspect(session_id: str, aspect_id: str):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    parent = session.find_parent(aspect_id)
    if not parent:
        raise HTTPException(status_code=404, detail="Aspect not found or cannot delete root")
    parent.children = [c for c in parent.children if c.id != aspect_id]
    store.save_session(session)
    return {"status": "ok"}


@app.patch("/session/{session_id}/aspect/{aspect_id}")
async def update_aspect(session_id: str, aspect_id: str, request: UpdateAspectRequest):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    node = session.find_node(aspect_id)
    if not node:
        raise HTTPException(status_code=404, detail="Aspect not found")
    if request.aspect is not None:
        node.aspect = request.aspect.strip()
    if request.answer is not None:
        node.answer = request.answer.strip() or None
    if request.question is not None:
        node.question = request.question.strip()
    store.save_session(session)
    return {"ok": True}


@app.post("/session/{session_id}/move-aspect/{aspect_id}")
async def move_aspect(session_id: str, aspect_id: str, request: MoveAspectRequest):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    node = session.find_node(aspect_id)
    if not node:
        raise HTTPException(status_code=404, detail="Aspect not found")
    old_parent = session.find_parent(aspect_id)
    if not old_parent:
        raise HTTPException(status_code=404, detail="Cannot move root node")
    new_parent = session.find_node(request.new_parent_id)
    if not new_parent:
        raise HTTPException(status_code=404, detail="Target parent not found")
    old_parent.children = [c for c in old_parent.children if c.id != aspect_id]
    new_parent.children.append(node)
    store.save_session(session)
    return {"status": "ok"}


@app.post("/session/{session_id}/recontextualize/{aspect_id}", response_model=RecontextualizeResponse)
async def recontextualize(session_id: str, aspect_id: str):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    path = session.get_path_to_node(aspect_id)
    if not path:
        raise HTTPException(status_code=404, detail="Aspect not found")

    # Skip root (path[0]) and the answered node itself (path[-1])
    ancestor_nodes = path[1:-1]

    ancestors_data = []
    for anc in ancestor_nodes:
        children_data = [
            {"aspect": c.aspect, "answer": c.answer}
            for c in (anc.children or [])
            if not c.is_ghost
        ]
        ancestors_data.append({
            "id": anc.id,
            "aspect": anc.aspect,
            "children": children_data,
        })

    result = recontextualize_ancestors(
        objective=session.objective,
        ancestors=ancestors_data,
        mode=session.mode,
    )

    for update in result.get("updated_ancestors", []):
        node = session.find_node(update["id"])
        if node:
            node.aspect = update["new_aspect"]
    store.save_session(session)

    return RecontextualizeResponse(
        updated_ancestors=result.get("updated_ancestors", []),
        spinoff_suggestions=result.get("spinoff_suggestions", []),
    )


@app.post("/label-chat")
async def label_chat_endpoint(request: LabelChatRequest):
    try:
        label = generate_chat_label([m.model_dump() for m in request.messages])
        return {"label": label}
    except (ServerError, ClientError, _anthropic.APIStatusError, RuntimeError):
        raise HTTPException(status_code=503, detail="AI service is currently overloaded. Please try again in a moment.")


@app.post("/session/{session_id}/reveal/{aspect_id}", response_model=RevealResponse)
async def reveal_children(session_id: str, aspect_id: str):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    node = session.find_node(aspect_id)
    if not node:
        raise HTTPException(status_code=404, detail="Aspect not found")

    for child in node.children:
        child.is_ghost = False

    store.save_session(session)
    return RevealResponse(children=node.children)


@app.post("/session/{session_id}/briefing", response_model=BriefingResponse)
async def get_briefing(session_id: str):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        aspects_list = [{"aspect": c.aspect, "question": c.question} for c in session.root.children]
        data = generate_briefing(session.objective, session.mode, session.background, aspects_list)
        aspect_rationales = [AspectContext(**r) for r in data.get("aspect_rationales", []) if isinstance(r, dict)]
        return BriefingResponse(
            overview_prose=data.get("overview_prose", ""),
            aspect_rationales=aspect_rationales,
        )
    except (ClientError, ServerError, _anthropic.APIStatusError, RuntimeError):
        raise HTTPException(status_code=503, detail="AI service is currently overloaded. Please try again in a moment.")


@app.post("/session/{session_id}/briefing-chat", response_model=BriefingChatResponse)
async def briefing_chat(session_id: str, request: BriefingChatRequest):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        data = generate_briefing_chat_update(
            message=request.message,
            page=request.page,
            current_overview=request.current_overview,
            current_ideas=request.current_ideas,
            current_questions=request.current_questions,
        )
        return BriefingChatResponse(
            acknowledgment=data.get("acknowledgment", "Got it."),
            updated_overview=data.get("updated_overview"),
        )
    except (ClientError, ServerError, _anthropic.APIStatusError, RuntimeError):
        raise HTTPException(status_code=503, detail="AI service is currently overloaded. Please try again in a moment.")


@app.post("/session/{session_id}/briefing-cycle", response_model=BriefingCycleResponse)
async def briefing_cycle(session_id: str):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        tree_dict = session.root.model_dump()
        data = generate_briefing_cycle(session.objective, session.mode, session.background, tree_dict)
        aspects = [BriefingAspect(**a) for a in data.get("aspects", []) if isinstance(a, dict)]
        return BriefingCycleResponse(aspects=aspects)
    except (ClientError, ServerError, _anthropic.APIStatusError, RuntimeError):
        raise HTTPException(status_code=503, detail="AI service is currently overloaded. Please try again in a moment.")
