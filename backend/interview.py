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


def _generate_text(system: str, prompt_or_messages, temperature: float = 0.7, max_tokens: int = 2048) -> str:
    """Try Claude Haiku first, then fall back to Gemini models."""
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

    if anthropic_client:
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
            return client.models.generate_content(
                model=model,
                contents=gemini_contents,
                config=types.GenerateContentConfig(system_instruction=system, temperature=temperature),
            ).text.strip()
        except (ClientError, ServerError) as e:
            logger.warning("Gemini model %s failed: %s", model, e)
            continue

    raise RuntimeError("All models failed (Claude and all Gemini fallbacks).")

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
- "aspect": MAXIMUM 3 words. Use concise noun phrases — NO personal pronouns (no My, Your, Our, etc.). Good examples: "Budget", "Location", "Customers", "Team", "Timeline", "Food & Drink". Use plain, everyday language — NO jargon, NO academic or technical terms, NO cerebral abstractions.
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


CHAT_SYSTEM = """You are Midwife, a Socratic planning assistant embedded in the user's planning session.
Help the user think through the specific aspect they are unsure about.
Ask follow-up questions if they need help clarifying their thinking.
Keep responses concise (2-4 sentences). Be warm and practical.
Always respond with valid JSON only:
{"reply": "...", "suggested_answer": null, "suggested_answers": [], "new_aspects": [], "updated_aspect": null, "updated_question": null}
- If the user has clearly settled on exactly ONE specific answer, extract it as suggested_answer (short phrase). Leave null otherwise.
- If the user explicitly wants to select TWO OR MORE distinct options together (multi-select), leave suggested_answer null and instead list each option separately in suggested_answers (e.g. ["Option A", "Option B"]). Leave as empty list if zero or one option.
- If the conversation surfaces new distinct planning dimensions that deserve their own node in the discourse tree (a new concern, constraint, or decision the user raised), list them in new_aspects as:
  [{"aspect": "2-5 word label", "question": "the Socratic question to ask", "suggestions": ["option1", "option2", "option3"]}]
  Otherwise leave new_aspects as an empty list.
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


def generate_chat_reply(
    objective: str,
    messages: list[dict],
    aspect_context: dict | None = None,
    answered_aspects: list[dict] | None = None,
    existing_aspects: list[str] | None = None,
    mode: str = "",
) -> tuple[str, str | None, list[dict], str | None, str | None]:
    system = CHAT_SYSTEM
    if mode and mode in MODE_INSTRUCTIONS:
        system += "\n\n" + MODE_INSTRUCTIONS[mode]
    if answered_aspects:
        system += "\n\nThe following aspects have already been decided in this planning session — treat these as established facts:\n"
        for a in answered_aspects:
            system += f"- {a['aspect']}: {a['answer']}\n"
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
            f"Keep new_aspects as an empty list unless the user themselves explicitly raises "
            f"a genuinely new and distinct concern — do not proactively suggest sub-topics."
        )

    raw = _generate_text(system, messages, temperature=0.7)
    # Strip markdown code fences if present
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    text = text.strip()
    # Find JSON object — skip any leading prose before the first '{'
    brace = text.find("{")
    if brace > 0:
        text = text[brace:]
    try:
        data = json.loads(text)
        return (
            data["reply"],
            data.get("suggested_answer"),
            data.get("suggested_answers", []),
            data.get("new_aspects", []),
            data.get("updated_aspect"),
            data.get("updated_question"),
        )
    except Exception:
        return raw, None, [], [], None, None


def recontextualize_ancestors(objective: str, ancestors: list[dict], mode: str = "") -> dict:
    """Check if ancestor labels still fit given their children's aspects+answers."""
    if not ancestors:
        return {"updated_ancestors": [], "spinoff_suggestions": []}

    system = (
        "You are a planning assistant reviewing discourse tree labels. "
        "For each ancestor node provided, check if its label still accurately represents the topic "
        "given all of its children's aspects and answers. "
        "If any ancestor's label no longer fits (too narrow, too broad, or misleading), suggest a better 2-5 word label. "
        "Also, if any child's content seems like a genuinely separate top-level concern, suggest it as a spinoff. "
        "Respond with valid JSON only: "
        "{\"updated_ancestors\": [{\"id\": \"...\", \"new_aspect\": \"...\"}], "
        "\"spinoff_suggestions\": [{\"child_id\": \"...\", \"suggested_label\": \"...\", \"suggested_question\": \"...\", "
        "\"suggestions\": [\"...\", \"...\", \"...\"]}]} "
        "For each spinoff, include 3-4 short first-person answer options in 'suggestions' (e.g. 'Under $500', 'Not sure yet'). "
        "Only include nodes in updated_ancestors if their label actually needs changing. "
        "Keep both lists empty if nothing needs updating."
    )
    if mode and mode in MODE_INSTRUCTIONS:
        system += "\n\n" + MODE_INSTRUCTIONS[mode]

    prompt = f"Objective: {objective}\n\nAncestor nodes to review:\n"
    for anc in ancestors:
        prompt += f"\nNode ID: {anc['id']}\nLabel: {anc['aspect']}\nChildren:\n"
        for child in anc.get("children", []):
            prompt += f"  - {child['aspect']}: {child.get('answer', '(unanswered)')}\n"

    try:
        raw = _generate_text(system, prompt, temperature=0.3)
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]
        data = json.loads(raw.strip())
        return data
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
    if mode and mode in MODE_INSTRUCTIONS:
        system_instruction += "\n\n" + MODE_INSTRUCTIONS[mode]

    context_text = ""

    if background:
        bg_lines = []
        if background.get("help_level"):
            bg_lines.append(f"Level of help needed: {background['help_level']}")
        if background.get("prior_knowledge"):
            bg_lines.append(f"What the user already knows: {background['prior_knowledge']}")
        if background.get("already_planned"):
            bg_lines.append(f"What is already planned: {background['already_planned']}")
        if background.get("constraints"):
            bg_lines.append(f"Known constraints: {background['constraints']}")
        if background.get("knowledge_level"):
            level = background["knowledge_level"]
            bg_lines.append(f"User's familiarity with this topic: {level}.")
            if level in ("complete beginner", "some knowledge"):
                system_instruction += (
                    "\n\nIMPORTANT: The user is a beginner. For EACH question, prepend a single plain-English sentence "
                    "that briefly explains the concept being asked about, so the user understands what it means before answering. "
                    "Format the 'question' field as: \"[One-sentence plain-English intro]. [The actual question]?\". "
                    "No jargon at all."
                )
        if bg_lines:
            context_text += "Background context provided by the user:\n" + "\n".join(bg_lines) + "\n\n"

    if not context_path:
        context_text += "This is the first round — generate top-level clarifying questions."
    else:
        context_text += "Context (the path through the user's planning tree to the current focus):\n"
        for i, node in enumerate(context_path):
            indent = "  " * i
            context_text += f"{indent}Aspect: {node['aspect']}\n"
            context_text += f"{indent}Question: {node['question']}\n"
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

    text = _generate_text(system_instruction, prompt, temperature=0.7)
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    text = text.strip()

    data = json.loads(text)
    return data["aspects"]
