import json
import os

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
MODEL = "gemini-2.5-flash"

SYSTEM_INSTRUCTION = """You are a Socratic planning assistant. Your job is to help users turn vague objectives into concrete, actionable plans by asking clarifying questions.

You generate exactly 5 clarifying questions. For each question, provide:
- "aspect": A short 1-3 word label naming the dimension being explored (e.g., "Budget", "Timeline", "Team Size")
- "question": The full question text
- "suggestions": 3-4 suggested answers covering the most common options

You must respond with valid JSON only, no markdown fences, in this exact format:
{
  "questions": [
    {
      "aspect": "Budget",
      "question": "What is your budget for this?",
      "suggestions": ["Under $500", "$500-$2000", "$2000-$5000", "Over $5000"]
    }
  ]
}

Focus on the most important unknowns. Avoid redundant questions about things already established in the context provided."""


def generate_questions(
    objective: str, context_path: list[dict] | None = None
) -> list[dict]:
    """Generate 5 clarifying questions.

    context_path: list of {aspect, question, answer} dicts representing the
    ancestry from the root down to the node being elaborated.
    None or empty for top-level questions.
    """
    if not context_path:
        context_text = "This is the first round — generate top-level clarifying questions."
    else:
        context_text = "Context (the path through the user's planning tree to the current focus):\n"
        for i, node in enumerate(context_path):
            indent = "  " * i
            context_text += f"{indent}Aspect: {node['aspect']}\n"
            context_text += f"{indent}Question: {node['question']}\n"
            context_text += f"{indent}Answer: {node['answer']}\n\n"
        context_text += "Generate 5 sub-questions that dig deeper into the innermost topic above."

    prompt = f"Objective: {objective}\n\n{context_text}"

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            temperature=0.7,
        ),
    )

    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    text = text.strip()

    data = json.loads(text)
    return data["questions"]
