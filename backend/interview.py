import json
import logging
import os
import time

logger = logging.getLogger(__name__)

import anthropic as _anthropic
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import ClientError, ServerError

load_dotenv()

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def _trunc(text: str, max_chars: int = 120) -> str:
    """Truncate text for LLM prompt inclusion to avoid token bloat."""
    if not text or len(text) <= max_chars:
        return text
    return text[:max_chars].rstrip() + "…"


def _extract_json(raw: str) -> dict:
    """Extract and parse the first JSON object from a string, tolerating prose/markdown around it."""
    text = raw.strip()
    brace = text.find("{")
    rbrace = text.rfind("}")
    if brace == -1 or rbrace == -1 or rbrace < brace:
        raise json.JSONDecodeError("No JSON object found", text, 0)
    return json.loads(text[brace:rbrace + 1])
# Models tried in order; first healthy one wins.
GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-3.1-flash-lite-preview",
]

_anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
anthropic_client = _anthropic.Anthropic(api_key=_anthropic_key) if _anthropic_key else None
CLAUDE_MODEL = "claude-haiku-4-5-20251001"


def _call_claude_with_retry(fn, max_attempts=3):
    """Call fn(); retry on transient Anthropic 429/503/529 errors with exponential backoff."""
    delay = 2
    for attempt in range(max_attempts):
        try:
            return fn()
        except _anthropic.APIStatusError as e:
            if e.status_code in (429, 503, 529) and attempt < max_attempts - 1:
                time.sleep(delay)
                delay *= 2
            else:
                raise


def _generate_text(system: str, prompt_or_messages, temperature: float = 0.7, max_tokens: int = 2048, response_schema=None, skip_claude: bool = False) -> str:
    """Try Claude Haiku first, then fall back to Gemini models.

    response_schema: optional dict describing the expected JSON shape. When provided,
    Gemini is instructed to emit application/json constrained to that schema, which
    prevents malformed-JSON responses at the sampling level.
    skip_claude: when True, skip Claude entirely and go straight to Gemini. Use for
    large structured outputs where Gemini's response_schema enforcement is an advantage.
    """
    if isinstance(prompt_or_messages, str):
        gemini_contents = prompt_or_messages
        claude_messages = [{"role": "user", "content": prompt_or_messages}]
    else:
        gemini_contents = [
            types.Content(
                role="model" if m["role"] == "assistant" else m["role"],
                parts=[types.Part(text=m["content"])],
            )
            for m in prompt_or_messages
        ]
        claude_messages = list(prompt_or_messages)

    if anthropic_client and not skip_claude:
        def claude_fn():
            kwargs = dict(
                model=CLAUDE_MODEL,
                max_tokens=max_tokens,
                messages=claude_messages,
                temperature=temperature,
            )
            if system:
                kwargs["system"] = system
            r = anthropic_client.messages.create(**kwargs)
            return r.content[0].text.strip()

        try:
            return _call_claude_with_retry(claude_fn)
        except Exception as e:
            logger.warning("Claude %s failed: %s — falling back to Gemini", CLAUDE_MODEL, e)

    for model in GEMINI_MODELS:
        try:
            gemini_config = types.GenerateContentConfig(
                system_instruction=system,
                temperature=temperature,
                **({"response_mime_type": "application/json", "response_schema": response_schema}
                   if response_schema else {}),
            )
            return client.models.generate_content(
                model=model,
                contents=gemini_contents,
                config=gemini_config,
            ).text.strip()
        except (ClientError, ServerError) as e:
            logger.warning("Gemini model %s failed: %s", model, e)
            continue

    raise RuntimeError("All models failed (Claude and all Gemini fallbacks).")

# JSON schema for the generate_questions response — used to force valid JSON from Gemini.
_ASPECTS_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "aspects": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "aspect":      {"type": "STRING"},
                    "question":    {"type": "STRING"},
                    "suggestions": {"type": "ARRAY", "items": {"type": "STRING"}},
                },
                "required": ["aspect", "question", "suggestions"],
            },
        },
    },
    "required": ["aspects"],
}

SYSTEM_INSTRUCTION_BASE = """
You are a planning assistant using the Socratic method to help users think through decisions.

Your task: given an objective and context, generate exactly {max_questions} clarifying questions (aspects) that cover the most important dimensions for making this decision.

Rules:
1. Each question must address a DISTINCT dimension — no overlaps.
2. If a parent aspect is provided, every question must be a DIRECT sub-question of that parent, strictly scoped to its domain.
3. If background context is provided, do NOT ask questions already answered by it.
4. Sort questions by importance (most important first).
5. Respond with valid JSON only. Example:
{{"aspects": [{{"aspect": "...", "question": "...", "suggestions": ["...", "...", "..."]}}]}}

Each aspect object must have:
- "aspect": MAXIMUM 3 words. Use concise noun phrases — NO personal pronouns (no My, Your, Our, etc.). Good examples: "Budget", "Location", "Customers", "Team", "Timeline", "Food & Drink". Use plain, everyday language — NO jargon, NO academic or technical terms, NO cerebral abstractions. IMPORTANT: If the user used an abbreviation in their objective (e.g. "UofT", "NYC", "AI", "ML"), use that exact abbreviation in the aspect title rather than spelling it out.
- "question": ONE simple sentence a complete beginner can understand. NO assumed knowledge of the topic. Write as if the person has never heard of this subject before. Be warm and direct.
- "suggestions": 3-5 short answer options. Short phrases, NOT sentences. First-person where natural for answers (e.g. "Under $500", "With a few close friends", "Not sure yet").
"""


MODE_INSTRUCTIONS: dict[str, str] = {
    "logistics": (
        "Mode: LOGISTICS & PLANNING. "
        "Focus on concrete steps, timelines, resource allocation, budgets, and coordination. "
        "Questions should be operational and practical — build a complete, executable action plan."
    ),
    "brainstorming": (
        "Mode: BRAINSTORMING. "
        "Encourage divergent thinking and exploration of many possibilities. "
        "Questions should open up the space of options, not narrow it. "
        "Suggestions should be varied and non-obvious. Avoid leading questions."
    ),
    "creative": (
        "Mode: CREATIVE EXPLORATION. "
        "Encourage imagination, originality, and unconventional thinking. "
        "Challenge assumptions. Questions should inspire rather than constrain. "
        "Include unexpected, out-of-the-box options in suggestions."
    ),
    "problem_solving": (
        "Mode: PROBLEM-SOLVING. "
        "Focus on diagnosing root causes and evaluating solutions. "
        "Questions should help the user understand WHY a problem exists before jumping to HOW to fix it. "
        "Surface obstacles, dependencies, and second-order effects."
    ),
    "decision": (
        "Mode: DECISION-MAKING. "
        "Help the user clarify their values, criteria, and trade-offs between options. "
        "Questions should surface what matters most and what they are optimising for. "
        "Avoid steering toward any particular answer."
    ),
    "research": (
        "Mode: RESEARCH & LEARNING. "
        "Help the user identify knowledge gaps and map out the landscape of the topic. "
        "Questions should guide structured inquiry and help prioritise what to investigate first."
    ),
    "reflection": (
        "Mode: REFLECTION & JOURNALING. "
        "Help the user articulate feelings, process experiences, and gain self-insight. "
        "Questions should be gentle, open-ended, and non-judgmental. "
        "Avoid prescriptive advice — guide toward self-discovery."
    ),
    "goal_setting": (
        "Mode: GOAL SETTING. "
        "Help the user define clear, specific, achievable goals with measurable outcomes. "
        "Questions should clarify what success looks like, identify milestones, and surface obstacles."
    ),
    "learning": (
        "Mode: LEARNING PLAN. "
        "Help the user identify what to learn, prioritise topics, and structure a study path. "
        "Questions should surface prior knowledge, available time, and preferred learning methods."
    ),
}


def _mode_instructions(mode: str) -> str:
    """Return combined instruction text for one or more comma-separated mode IDs."""
    parts = []
    for m in mode.split(","):
        m = m.strip()
        if m in MODE_INSTRUCTIONS:
            parts.append(MODE_INSTRUCTIONS[m])
    return "\n\n".join(parts)


def generate_aspect_description(aspect: str, question: str, answer: str) -> str:
    """Generate a one-sentence contextualized description that weaves the question and answer together.

    E.g. aspect='Gift Collection', question='How should guests handle gifts?', answer='bring gifts on the day'
    → 'Guests will bring gifts on the day of the event.'
    """
    system = (
        "You are a concise planning assistant. Write a single short sentence (max 15 words) "
        "that contextualizes the given answer within the topic and question. "
        "Use third-person present tense. Do not start with the aspect name. "
        "Output only the sentence, no punctuation changes, no extra text."
    )
    prompt = f"Topic: {aspect}\nQuestion: {question}\nAnswer: {answer}\nDescription:"
    try:
        return _generate_text(system, prompt, temperature=0.3, max_tokens=60).strip().strip('"')
    except Exception:
        return answer


CHAT_SYSTEM = """You are Midwife, a Socratic planning assistant embedded in the user's planning session.
Help the user think through the specific aspect they are unsure about.
Ask follow-up questions if they need help clarifying their thinking.
Keep responses concise (2-4 sentences). Be warm and practical.
Always respond with valid JSON only:
{"reply": "...", "suggested_answer": null, "suggested_answers": [], "updated_aspect": null, "updated_question": null}
- If the user has clearly settled on exactly ONE specific answer, extract it as suggested_answer (short phrase). If they selected one of the pre-defined options, use the EXACT option text as given — never paraphrase, rename, or rephrase it. Leave null if no clear answer.
- If the user explicitly wants to select TWO OR MORE distinct options together (multi-select), leave suggested_answer null and instead list each option separately in suggested_answers (e.g. ["Option A", "Option B"]). Leave as empty list if zero or one option.
- updated_aspect and updated_question: if the user indicates the current question/framing doesn't fit them, reframe it by setting these fields (updated_aspect: new 2-5 word label, updated_question: new Socratic question). Otherwise leave both null."""


def generate_chat_label(messages: list[dict]) -> str:
    """Generate a short 4-6 word label for a chat thread."""
    recent = messages[-8:] if len(messages) > 8 else messages
    conversation = "\n".join(f"{m['role']}: {m['content']}" for m in recent)
    prompt = f"Generate a very short 4-6 word label/title for this conversation. Respond with just the label, no punctuation, no quotes:\n\n{conversation}"
    return _generate_text("", prompt, temperature=0.3, max_tokens=32)


def generate_discourse_name(objective: str) -> str:
    """Generate a 3-5 word plain descriptive title for the planning session."""
    prompt = (
        f"Summarize this planning objective as a plain, literal, descriptive 3-5 word title. "
        f"Do NOT use creative or poetic language. Just describe what is being planned.\n"
        f"Objective: {objective}\n"
        f"Respond with only the title, no punctuation."
    )
    return _generate_text("", prompt, temperature=0.1, max_tokens=32)


PANEL_TABS_BY_MODE: dict[str, list[dict]] = {
    "logistics":      [{"id": "overview", "title": "Overview"}, {"id": "timeline", "title": "Timeline"}, {"id": "tasks", "title": "Tasks & Resources"}, {"id": "questions", "title": "Open Questions"}],
    "brainstorming":  [{"id": "overview", "title": "Overview"}, {"id": "ideas", "title": "Ideas"}, {"id": "next_steps", "title": "Next Steps"}, {"id": "questions", "title": "Open Questions"}],
    "creative":       [{"id": "overview", "title": "Overview"}, {"id": "concepts", "title": "Concepts"}, {"id": "constraints", "title": "Constraints"}, {"id": "questions", "title": "Open Questions"}],
    "problem_solving":[{"id": "overview", "title": "Overview"}, {"id": "root_causes", "title": "Root Causes"}, {"id": "solutions", "title": "Solutions"}, {"id": "next_steps", "title": "Next Steps"}],
    "decision":       [{"id": "overview", "title": "Overview"}, {"id": "options", "title": "Options"}, {"id": "recommendation", "title": "Recommendation"}, {"id": "questions", "title": "Open Questions"}],
    "research":       [{"id": "overview", "title": "Overview"}, {"id": "findings", "title": "Key Findings"}, {"id": "gaps", "title": "Knowledge Gaps"}, {"id": "next_steps", "title": "Next Steps"}],
    "reflection":     [{"id": "overview", "title": "Overview"}, {"id": "insights", "title": "Insights"}, {"id": "patterns", "title": "Patterns"}, {"id": "actions", "title": "Action Items"}],
    "goal_setting":   [{"id": "overview", "title": "Overview"}, {"id": "milestones", "title": "Milestones"}, {"id": "timeline", "title": "Timeline"}, {"id": "blockers", "title": "Blockers"}],
    "learning":       [{"id": "overview", "title": "Overview"}, {"id": "concepts", "title": "Key Concepts"}, {"id": "path", "title": "Learning Path"}, {"id": "questions", "title": "Open Questions"}],
}

DEFAULT_TABS = [{"id": "overview", "title": "Overview"}, {"id": "next_steps", "title": "Next Steps"}, {"id": "questions", "title": "Open Questions"}]


def _tree_to_text(node: dict, depth: int = 0) -> str:
    indent = "  " * depth
    lines = [f"{indent}- {node.get('aspect', '')}"]
    if node.get("answer"):
        lines.append(f"{indent}  → {node['answer']}")
    for child in node.get("children", []):
        if not child.get("is_ghost"):
            lines.append(_tree_to_text(child, depth + 1))
    return "\n".join(lines)


def generate_panel_tabs(objective: str, mode: str, background: dict, tree: dict, title: str = "") -> list[dict]:
    """Generate all panel tab contents for the given session."""
    primary_mode = mode.split(",")[0].strip() if mode else ""
    tabs_def = PANEL_TABS_BY_MODE.get(primary_mode, DEFAULT_TABS)
    tab_names = {t["id"]: t["title"] for t in tabs_def}

    tree_text = _tree_to_text(tree)

    bg_lines = []
    for k, v in (background or {}).items():
        if v and str(v).strip():
            bg_lines.append(f"- {k.replace('_', ' ').title()}: {v}")
    bg_text = "\n".join(bg_lines) if bg_lines else "None provided."

    tab_ids_str = ", ".join(f'"{t["id"]}"' for t in tabs_def)

    def _tab_desc(t):
        if t["id"] == "overview":
            return (
                '- "overview": A full, well-structured plan document in markdown. '
                'Use ## headers with relevant emojis for each section '
                '(e.g. "## 🎯 Goal", "## 💡 Key Decisions", "## ✅ Action Steps", '
                '"## ⚠️ Watch Out For", "## ❓ Open Questions"). '
                'Use - bullet points under each section. Use **bold** for key terms. '
                'Be specific and grounded in what was actually discussed. '
                'This should read like a real, actionable deliverable — not a brief summary.'
            )
        return f'- "{t["id"]}" ({t["title"]}): focused markdown content for this section using bullet points and **bold** for key terms'

    tab_descriptions = "\n".join(_tab_desc(t) for t in tabs_def)

    system = (
        "You are a planning assistant generating a plan document for a Socratic planning session. "
        "Based on the objective, background, and discourse tree, generate rich markdown content for each tab. "
        "Be concrete, specific, and grounded in what the user actually said. "
        "Use ## headers, - bullet points, and **bold** for key terms throughout. "
        "Respond with valid JSON only: a single object where each key is a tab id and the value is a markdown string.\n"
        f"Tabs to fill:\n{tab_descriptions}"
    )
    if mode:
        instr = _mode_instructions(mode)
        if instr:
            system += "\n\n" + instr

    json_example = "{" + ", ".join('"' + t["id"] + '": "..."' for t in tabs_def) + "}"
    prompt = (
        f"Objective: {objective}\n\n"
        f"Background context:\n{bg_text}\n\n"
        f"Discourse tree (aspects and answers):\n{tree_text}\n\n"
        f"Generate content for these tabs: {tab_ids_str}.\n"
        f"Respond with JSON only: {json_example}"
    )

    raw = _generate_text(system, prompt, temperature=0.4, max_tokens=8192)
    try:
        data = _extract_json(raw)
    except Exception:
        data = {}

    result = []
    for tab in tabs_def:
        content = data.get(tab["id"], "")
        if tab["id"] == "overview" and content:
            # Strip any LLM-generated # title line(s) at the top
            lines = content.lstrip("\n").splitlines()
            while lines and lines[0].lstrip().startswith("# "):
                lines.pop(0)
            content = "\n".join(lines).lstrip("\n")
            # Prepend the canonical discourse title
            if title:
                content = f"# {title}\n\n{content}"
        result.append({
            "id": tab["id"],
            "title": tab["title"],
            "content": content,
        })
    return result


def generate_chat_reply(
    objective: str,
    messages: list[dict],
    aspect_context: dict | None = None,
    answered_aspects: list[dict] | None = None,
    existing_aspects: list[str] | None = None,
    mode: str = "",
    tab_context: dict | None = None,
) -> tuple[str, str | None, list[str], list[dict], str | None, str | None, dict | None]:
    system = CHAT_SYSTEM
    if mode:
        instr = _mode_instructions(mode)
        if instr:
            system += "\n\n" + instr
    if answered_aspects:
        system += "\n\nThe following aspects have already been decided in this planning session — treat these as established facts:\n"
        for a in answered_aspects:
            system += f"- {_trunc(a['aspect'])}: {a['answer']}\n"
    if existing_aspects:
        system += (
            "\n\nAspects already in the discourse tree "
            "(do NOT suggest adding these or anything semantically similar): "
            + ", ".join(existing_aspects)
        )
    if aspect_context:
        system += (
            f"\n\nThe user is currently deciding: \"{aspect_context['aspect']}\". "
            f"The question posed to them: {aspect_context['question']}\n\n"
            f"PRIMARY DIRECTIVE: Guide user to ONE concrete answer. "
            f"If user says the question doesn't fit them, set updated_aspect + updated_question to reframe it, "
            f"then immediately solicit an answer under the new framing. "
            f"Your ONLY goal is to help them arrive at a concrete answer to THIS specific question. "
            f"Do NOT ask them which sub-topic to explore next. "
            f"Do NOT open new planning dimensions or offer to focus on one sub-area vs another. "
            f"Instead: guide them toward one of the options already presented, "
            f"or help them articulate their own answer if none fit. "
            f"As soon as the conversation points to a clear answer (even rough), "
            f"set suggested_answer to a short phrase that captures it. "
            f"IMPORTANT: If the answer matches one of the pre-defined options, use that option's EXACT text — never paraphrase it. "
            f"Do not proactively suggest sub-topics or new planning dimensions."
        )
    if tab_context:
        system += (
            f"\n\nThe user is discussing the \"{tab_context['tab_title']}\" section of their summary panel. "
            f"If their message is a directive to change or update that section (not just a question), "
            f"reflect that update in the \"updated_tab_content\" field of your JSON response — "
            f"provide the full updated content for that section as a plain-text string with bullet points where appropriate. "
            f"If the message is a question or clarification (not a directive), leave \"updated_tab_content\" as null."
        )
        # Extend the JSON schema in CHAT_SYSTEM to include updated_tab_content
        system = system.replace(
            '{"reply": "...", "suggested_answer": null, "suggested_answers": [], "updated_aspect": null, "updated_question": null}',
            '{"reply": "...", "suggested_answer": null, "suggested_answers": [], "updated_aspect": null, "updated_question": null, "updated_tab_content": null}'
        )

    raw = _generate_text(system, messages, temperature=0.7)
    try:
        data = _extract_json(raw)
        updated_tab = None
        if tab_context and data.get("updated_tab_content"):
            updated_tab = {
                "id": tab_context["tab_id"],
                "title": tab_context["tab_title"],
                "content": data["updated_tab_content"],
            }
        return (
            data["reply"],
            data.get("suggested_answer"),
            data.get("suggested_answers", []),
            data.get("updated_aspect"),
            data.get("updated_question"),
            updated_tab,
        )
    except Exception:
        return raw, None, [], None, None, None


def recontextualize_ancestors(objective: str, ancestors: list[dict], mode: str = "") -> dict:
    """Check if ancestor labels still fit given their children's aspects+answers."""
    if not ancestors:
        return {"updated_ancestors": [], "spinoff_suggestions": []}

    system = (
        "You are a planning assistant reviewing discourse tree labels. "
        "For each ancestor node provided, check if its label still accurately represents the topic "
        "given all of its children's aspects and answers. "
        "If an ancestor's label is genuinely confusing or misleading given its children, suggest a better 2-5 word label. "
        "Be very conservative: suggest a relabeling ONLY if the current label is clearly wrong — not merely imprecise. "
        "When you do relabel, always make the new label MORE GENERAL than the old one, never more specific. "
        "Aim for 0 relabelings per call. Only 1 if truly necessary. Never suggest more than 1. "
        "Also, if any child's content seems like a genuinely separate top-level concern, suggest it as a spinoff. "
        "Respond with valid JSON only: "
        "{\"updated_ancestors\": [{\"id\": \"...\", \"new_aspect\": \"...\"}], "
        "\"spinoff_suggestions\": [{\"child_id\": \"...\", \"suggested_label\": \"...\", \"suggested_question\": \"...\", "
        "\"suggestions\": [\"...\", \"...\", \"...\"]}]} "
        "For each spinoff, include 3-4 short first-person answer options in 'suggestions' (e.g. 'Under $500', 'Not sure yet'). "
        "Only include nodes in updated_ancestors if the label is actively misleading. "
        "Keep both lists empty if there is any doubt."
    )
    if mode:
        instr = _mode_instructions(mode)
        if instr:
            system += "\n\n" + instr

    prompt = f"Objective: {objective}\n\nAncestor nodes to review:\n"
    for anc in ancestors:
        prompt += f"\nNode ID: {anc['id']}\nLabel: {_trunc(anc['aspect'])}\nChildren:\n"
        for child in anc.get("children", []):
            prompt += f"  - {_trunc(child['aspect'])}: {child.get('answer', '(unanswered)')}\n"

    try:
        raw = _generate_text(system, prompt, temperature=0.3)
        return _extract_json(raw)
    except Exception:
        return {"updated_ancestors": [], "spinoff_suggestions": []}


def generate_questions(
    objective: str,
    context_path: list[dict] | None = None,
    covered_aspects: list[str] | None = None,
    max_questions: int = 6,
    background: dict | None = None,
    mode: str = "",
    target_aspect: str | None = None,
) -> list[dict]:
    """Generate clarifying questions.

    context_path: list of {aspect, question, answer} dicts representing the
    ancestry from the root down to the node being elaborated.
    None or empty for top-level questions.

    covered_aspects: list of aspect labels already present elsewhere in the
    planning tree; the LLM is instructed to avoid repeating them.

    background: optional dict with keys help_level, prior_knowledge,
    already_planned, constraints — injected as context before the question list.
    """
    system_instruction = SYSTEM_INSTRUCTION_BASE.format(max_questions=max_questions)
    if mode:
        instr = _mode_instructions(mode)
        if instr:
            system_instruction += "\n\n" + instr

    context_text = ""

    if background:
        bg_lines = []
        for pair in (background.get("qa_pairs") or []):
            if pair.get("question") and pair.get("answer"):
                bg_lines.append(f"{pair['question']}: {pair['answer']}")
        if background.get("knowledge_level"):
            level = background["knowledge_level"]
            bg_lines.append(f"How familiar the user is with this topic: {level}.")
            if level.lower() in ("complete beginner", "some knowledge", "nothing yet", "some basics"):
                system_instruction += (
                    "\n\nIMPORTANT: The user is a beginner. For EACH question, prepend a single plain-English sentence "
                    "that briefly explains the concept being asked about, so the user understands what it means before answering. "
                    "Format the 'question' field as: \"[One-sentence plain-English intro]. [The actual question]?\". "
                    "No jargon at all."
                )
        if background.get("extra_context"):
            bg_lines.append(f"Additional context: {background['extra_context']}")
        if bg_lines:
            context_text += "Background context provided by the user:\n" + "\n".join(bg_lines) + "\n\n"

    if not context_path:
        context_text += "This is the first round — generate top-level clarifying questions."
    else:
        context_text += "Context (the path through the user's planning tree to the current focus):\n"
        for i, node in enumerate(context_path):
            indent = "  " * i
            context_text += f"{indent}Aspect: {_trunc(node['aspect'])}\n"
            context_text += f"{indent}Question: {_trunc(node['question'])}\n"
            context_text += f"{indent}Answer: {node['answer']}\n\n"
        context_text += f"Generate {max_questions} sub-questions that dig deeper into the innermost topic above."

    if len(context_path or []) > 1:
        parent_aspect = context_path[-1]["aspect"]
        context_text += (
            f"\nYou are generating sub-questions specifically for the parent aspect: \"{parent_aspect}\". "
            f"Every question must be strictly scoped to this parent and its domain only."
        )

    if covered_aspects:
        context_text += (
            f"\n\nAlready covered aspects (DO NOT duplicate or semantically overlap with these): "
            + ", ".join(covered_aspects)
        )

    if target_aspect:
        context_text += (
            f"\nGenerate exactly one Socratic question specifically for the aspect: '{target_aspect}'."
        )

    prompt = f"Objective: {objective}\n\n{context_text}"

    for attempt in range(2):
        raw = _generate_text(system_instruction, prompt, temperature=0.7, response_schema=_ASPECTS_SCHEMA)
        try:
            data = _extract_json(raw)
            return data["aspects"]
        except (json.JSONDecodeError, KeyError):
            if attempt == 0:
                logger.warning("generate_questions: malformed JSON on attempt 1, retrying")
                continue
            raise RuntimeError("The AI returned a malformed response. Please try again.")


# ── Briefing generation ───────────────────────────────────────────────────────

_BRIEFING_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "overview_prose": {"type": "STRING"},
        "aspect_rationales": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "aspect_name": {"type": "STRING"},
                    "rationale":   {"type": "STRING"},
                },
                "required": ["aspect_name", "rationale"],
            },
        },
    },
    "required": ["overview_prose", "aspect_rationales"],
}

_BRIEFING_CYCLE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "aspects": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "id":       {"type": "STRING"},
                    "aspect":   {"type": "STRING"},
                    "question": {"type": "STRING"},
                    "rationale": {"type": "STRING"},
                },
                "required": ["id", "aspect", "question", "rationale"],
            },
        },
    },
    "required": ["aspects"],
}


def generate_briefing(objective: str, mode: str, background: dict, aspects: list[dict]) -> dict:
    """Generate the initial Briefing Window content: overview prose + per-aspect rationales."""
    bg_lines = []
    for k, v in (background or {}).items():
        if v and str(v).strip():
            bg_lines.append(f"- {k.replace('_', ' ').title()}: {v}")
    bg_text = "\n".join(bg_lines) if bg_lines else "None provided."

    aspects_text = "\n".join(
        f"- {a['aspect']}: {a['question']}" for a in (aspects or [])
    ) or "None yet."

    system = (
        "You are Midwife, a Socratic planning assistant. "
        "A user has just submitted their planning objective. Before the structured interview begins, "
        "prepare a briefing that helps them understand what you've set up.\n\n"
        "Return a JSON object with exactly these fields:\n"
        "- overview_prose: a lively, well-structured overview using light markdown formatting. "
        "Use **bold** to highlight key terms, names, and important phrases. "
        "Structure it with a short opening paragraph, then 1-2 sections using ## headings (e.g. ## What You're Building, ## Key Considerations). "
        "Each section can have 2-4 sentences or a short bullet list using '- '. "
        "Echo back the user's objective in your own words, acknowledge context they've shared, and set the stage. "
        "Be warm, specific, grounded in what they actually said. Do not invent facts.\n"
        "- aspect_rationales: for each aspect listed below, produce an object with:\n"
        "  - aspect_name: the exact aspect name (string)\n"
        "  - rationale: 1-2 crisp, thought-provoking sentences on why this aspect matters. Be specific — no filler.\n\n"
        "overview_prose must use markdown formatting as described above."
    )
    if mode:
        instr = _mode_instructions(mode)
        if instr:
            system += "\n\n" + instr

    prompt = (
        f"Objective: {objective}\n\n"
        f"Background context provided by the user:\n{bg_text}\n\n"
        f"Aspects to generate rationales for:\n{aspects_text}"
    )

    for attempt in range(2):
        raw = _generate_text(system, prompt, temperature=0.6, max_tokens=2500, response_schema=_BRIEFING_SCHEMA)
        try:
            result = _extract_json(raw)
            if result.get("overview_prose"):
                return result
            if attempt == 0:
                logger.warning("generate_briefing: empty overview_prose on attempt 1, retrying")
                continue
            raise RuntimeError("generate_briefing: LLM returned empty overview after 2 attempts")
        except json.JSONDecodeError:
            if attempt == 0:
                logger.warning("generate_briefing: malformed JSON on attempt 1, retrying")
                continue
            raise RuntimeError("generate_briefing: malformed JSON after 2 attempts")


def generate_briefing_chat_update(
    message: str,
    page: str,
    current_overview: str | None,
    current_ideas: list[dict] | None,
    current_questions: list[dict] | None,
) -> dict:
    """Apply a user directive to update the briefing overview (not a conversational reply)."""
    system = (
        "You are editing a planning document on behalf of the user. "
        "Apply the user's directive directly to the overview section — do NOT have a conversation. "
        "Return a JSON object with:\n"
        "- acknowledgment: one brief sentence confirming what you changed\n"
        "- updated_overview: the full updated overview prose\n"
        "Respond with valid JSON only."
    )
    context = f"Current overview:\n{current_overview or '(empty)'}"
    prompt = f"{context}\n\nUser directive: {message}"

    raw = _generate_text(system, prompt, temperature=0.4, max_tokens=2000)
    try:
        return _extract_json(raw)
    except Exception:
        return {"acknowledgment": "Got it.", "updated_overview": None}


def generate_briefing_cycle(objective: str, mode: str, background: dict, tree: dict) -> dict:
    """Generate 5 new aspects with rationales after an interview cycle completes.

    Uses the answered tree so the LLM avoids repeating already-covered territory.
    """
    import uuid as _uuid
    tree_text = _tree_to_text(tree)

    bg_lines = []
    for k, v in (background or {}).items():
        if v and str(v).strip():
            bg_lines.append(f"- {k.replace('_', ' ').title()}: {v}")
    bg_text = "\n".join(bg_lines) if bg_lines else "None provided."

    system = (
        "You are Midwife, a Socratic planning assistant. "
        "The user has just completed an interview round. Suggest 5 new aspects that would deepen or broaden "
        "the discourse — things NOT already covered in the tree.\n\n"
        "Return a JSON object with EXACTLY this key:\n"
        "- aspects: array of exactly 5 new aspects, each with:\n"
        "  - id: a short unique slug (e.g. 'cycle-1', 'cycle-2')\n"
        "  - aspect: a concise aspect title (2-4 words)\n"
        "  - question: a Socratic question that opens up this aspect (1 sentence)\n"
        "  - rationale: 1-2 crisp, thought-provoking sentences on why this aspect matters — no filler\n"
        "Do NOT repeat aspects or themes already addressed in the discourse tree.\n"
        'You MUST respond with valid JSON only. Example: {"aspects": [{"id": "cycle-1", "aspect": "...", "question": "...", "rationale": "..."}]}'
    )
    if mode:
        instr = _mode_instructions(mode)
        if instr:
            system += "\n\n" + instr

    prompt = (
        f"Objective: {objective}\n\n"
        f"Background:\n{bg_text}\n\n"
        f"Discourse tree (already covered):\n{tree_text}"
    )

    for attempt in range(2):
        raw = _generate_text(system, prompt, temperature=0.65, max_tokens=2500, response_schema=_BRIEFING_CYCLE_SCHEMA)
        try:
            return _extract_json(raw)
        except Exception:
            if attempt == 0:
                logger.warning("generate_briefing_cycle: malformed JSON on attempt 1, retrying")
                continue
            return {"aspects": []}
