import json
import os

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
MODEL = "gemini-2.5-flash"

SYSTEM_INSTRUCTION = """You are a Socratic planning assistant. Your job is to help users turn vague objectives into concrete, actionable plans by asking clarifying questions.

You work in rounds. Each round, you generate exactly 5 clarifying questions based on the user's objective and any prior answers. For each question, provide 3-4 suggested answers that cover the most common options.

You must respond with valid JSON only, no markdown fences, in this exact format:
{
  "questions": [
    {
      "question": "Your question here?",
      "suggestions": ["Option A", "Option B", "Option C"]
    }
  ]
}

Focus on the most important unknowns first. Avoid redundant questions about things already answered. Each round should dig deeper based on what you've learned so far."""

READINESS_INSTRUCTION = """You are evaluating whether enough information has been gathered to create a concrete, actionable plan.

Given the user's objective and the Q&A history so far, respond with ONLY the word "ready" if you have enough detail to produce a useful plan, or "more" if important aspects are still unclear.

Err on the side of gathering enough information — typically 2-3 rounds of questions are needed. But don't ask unnecessary questions if the picture is already clear."""

PLAN_INSTRUCTION = """You are a planning assistant. Given the user's objective and all the clarifying Q&A, produce a clear, structured, actionable plan in markdown format.

The plan should include:
- A summary of the objective
- Key decisions made during the interview
- Concrete action items organized by category or timeline
- Any important considerations or risks

Be specific and practical. Reference the user's actual answers."""


def generate_questions(objective: str, qa_history: list[dict]) -> list[dict]:
    """Ask Gemini to generate a round of clarifying questions."""
    history_text = ""
    for i, round_data in enumerate(qa_history, 1):
        history_text += f"\n--- Round {i} ---\n"
        for qa in round_data:
            history_text += f"Q: {qa['question']}\nA: {qa['answer']}\n"

    prompt = f"""Objective: {objective}

{f"Prior Q&A:{history_text}" if qa_history else "This is the first round of questions."}

Generate 5 clarifying questions with suggested answers."""

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            temperature=0.7,
        ),
    )

    text = response.text.strip()
    # Strip markdown fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    text = text.strip()

    data = json.loads(text)
    return data["questions"]


def check_readiness(objective: str, qa_history: list[dict]) -> bool:
    """Ask Gemini if we have enough info to generate a plan."""
    history_text = ""
    for i, round_data in enumerate(qa_history, 1):
        history_text += f"\n--- Round {i} ---\n"
        for qa in round_data:
            history_text += f"Q: {qa['question']}\nA: {qa['answer']}\n"

    prompt = f"""Objective: {objective}

Q&A so far:{history_text}

Do we have enough clarity to produce a concrete plan?"""

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=READINESS_INSTRUCTION,
            temperature=0.0,
        ),
    )

    return "ready" in response.text.strip().lower()


def generate_plan(objective: str, qa_history: list[dict]) -> str:
    """Ask Gemini to produce the final plan."""
    history_text = ""
    for i, round_data in enumerate(qa_history, 1):
        history_text += f"\n--- Round {i} ---\n"
        for qa in round_data:
            history_text += f"Q: {qa['question']}\nA: {qa['answer']}\n"

    prompt = f"""Objective: {objective}

Complete Q&A:{history_text}

Now produce a detailed, actionable plan based on everything discussed."""

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=PLAN_INSTRUCTION,
            temperature=0.4,
        ),
    )

    return response.text


def run_interview():
    print("\n=== Midwife: Socratic Planning Assistant ===\n")
    objective = input("What's your objective?\n> ").strip()

    if not objective:
        print("No objective provided. Exiting.")
        return

    qa_history = []  # list of rounds, each round is a list of {question, answer}
    round_num = 0
    max_rounds = 5

    while round_num < max_rounds:
        round_num += 1
        print(f"\n--- Round {round_num} ---\n")

        questions = generate_questions(objective, qa_history)
        round_answers = []

        for j, q in enumerate(questions, 1):
            print(f"Q{j}: {q['question']}")
            for k, suggestion in enumerate(q["suggestions"], 1):
                print(f"  [{k}] {suggestion}")
            print(f"  [?] Type your own answer")

            answer = input("> ").strip()

            # If user typed a number, map to the suggestion
            if answer.isdigit():
                idx = int(answer) - 1
                if 0 <= idx < len(q["suggestions"]):
                    answer = q["suggestions"][idx]

            round_answers.append({"question": q["question"], "answer": answer})
            print()

        qa_history.append(round_answers)

        # Check if we have enough info
        if check_readiness(objective, qa_history):
            print("\nEnough clarity gathered. Generating your plan...\n")
            break
        else:
            print(f"\nLet's dig deeper with another round of questions.")

    else:
        print(f"\nReached maximum rounds ({max_rounds}). Generating plan with what we have...\n")

    plan = generate_plan(objective, qa_history)
    print("=== Your Plan ===\n")
    print(plan)


if __name__ == "__main__":
    run_interview()
