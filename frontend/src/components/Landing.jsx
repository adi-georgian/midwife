import { useState, useRef, useEffect } from "react";
import HistoryPanel from "./HistoryPanel";

const SUGGESTIONS = [
  "plan a Christmas party for 50 people",
  "start a podcast about urban design",
  "decide whether to move to Paris",
  "write a business plan for a coffee shop",
  "learn to play guitar from scratch",
  "negotiate a salary raise at my next review",
  "plan a six-month solo trip to Southeast Asia",
  "build a morning routine that actually sticks",
  "launch an indie game on Steam",
  "switch careers into software engineering",
  "write and self-publish my first novel",
  "design a home garden from scratch",
  "prepare for a technical interview at a big tech company",
];

const MODES = [
  { id: "logistics",       label: "Logistics",       icon: "📋", desc: "Steps, timelines, resources" },
  { id: "brainstorming",   label: "Brainstorm",       icon: "💡", desc: "Explore many possibilities" },
  { id: "creative",        label: "Creative",         icon: "🎨", desc: "Imagination & originality" },
  { id: "problem_solving", label: "Problem-solving",  icon: "🔍", desc: "Root causes & solutions" },
  { id: "decision",        label: "Decision",         icon: "⚖️",  desc: "Weigh trade-offs & criteria" },
  { id: "research",        label: "Research",         icon: "📚", desc: "Map knowledge gaps" },
  { id: "reflection",      label: "Reflect",          icon: "🪞", desc: "Journal or process a situation" },
  { id: "goal_setting",    label: "Set Goals",        icon: "🎯", desc: "Define objectives & milestones" },
  { id: "learning",        label: "Learn",            icon: "📖", desc: "Map what to study & in what order" },
];

const MODE_QUESTIONS = {
  logistics: [
    { id: "alreadyPlanned", label: "What's already decided?", type: "textarea", field: "alreadyPlanned", placeholder: "e.g. Date is Dec 20, budget is ~$2000…" },
    { id: "constraints",    label: "Any constraints or limits?", type: "textarea", field: "constraints", placeholder: "e.g. Must be indoors, no alcohol…" },
    { id: "timeline",       label: "What's your timeline?", type: "chips-single", field: "constraints", prefix: "Timeline: ",
      options: ["No deadline", "Few days", "This week", "This month", "3+ months"] },
  ],
  brainstorming: [
    { id: "knowledgeLevel", label: "How familiar are you with this topic?", type: "chips-single", field: "knowledgeLevel",
      options: ["Complete beginner", "Some knowledge", "Fairly familiar", "Expert"] },
    { id: "priorKnowledge", label: "What have you already explored?", type: "textarea", field: "priorKnowledge", placeholder: "e.g. I've looked into a few options already…" },
    { id: "helpLevel",      label: "What are you hoping to get out of this?", type: "chips-single", field: "helpLevel",
      options: ["Generate new ideas", "Challenge what I know", "Creative angles", "Unstick a problem"] },
  ],
  creative: [
    { id: "audience",    label: "Who is this for?", type: "chips-single", field: "priorKnowledge", prefix: "Audience: ",
      options: ["Just me", "Friends & family", "A specific audience", "General public"] },
    { id: "constraints", label: "Any must-haves or must-nots?", type: "textarea", field: "constraints", placeholder: "e.g. Must use a specific colour scheme…" },
    { id: "vibe",        label: "What feeling are you going for?", type: "chips-multi", field: "helpLevel", prefix: "Vibe: ",
      options: ["Fun", "Bold", "Calm", "Professional", "Experimental", "Nostalgic"] },
  ],
  problem_solving: [
    { id: "priorKnowledge", label: "What's happening that shouldn't be?", type: "textarea", field: "priorKnowledge", placeholder: "Describe the problem…" },
    { id: "alreadyPlanned", label: "What have you already tried?", type: "textarea", field: "alreadyPlanned", placeholder: "e.g. I've tried restarting, checking logs…" },
    { id: "constraints",    label: "What does 'fixed' look like to you?", type: "textarea", field: "constraints", placeholder: "Describe the ideal outcome…" },
  ],
  decision: [
    { id: "priorKnowledge", label: "What options are you choosing between?", type: "textarea", field: "priorKnowledge", placeholder: "e.g. Option A vs Option B vs Option C…" },
    { id: "helpLevel",      label: "What matters most to you?", type: "chips-multi", field: "helpLevel", prefix: "Priorities: ",
      options: ["Cost / budget", "Time & effort", "Risk", "Long-term impact", "My values", "People affected"] },
    { id: "constraints",    label: "Any dealbreakers?", type: "textarea", field: "constraints", placeholder: "e.g. Must stay under $500…" },
  ],
  research: [
    { id: "knowledgeLevel", label: "How much do you already know?", type: "chips-single", field: "knowledgeLevel",
      options: ["Nothing yet", "Some basics", "Quite a lot", "I'm an expert"] },
    { id: "priorKnowledge", label: "What's the specific question you want answered?", type: "textarea", field: "priorKnowledge", placeholder: "Be as specific as you can…" },
    { id: "alreadyPlanned", label: "What will you do with what you learn?", type: "textarea", field: "alreadyPlanned", placeholder: "e.g. Write a report, make a decision…" },
  ],
  reflection: [
    { id: "priorKnowledge", label: "What's on your mind?", type: "textarea", field: "priorKnowledge", placeholder: "Describe the situation or feeling you'd like to explore…" },
    { id: "helpLevel", label: "What would feel most helpful?", type: "chips-single", field: "helpLevel",
      options: ["Just thinking out loud", "Gain clarity", "Understand my feelings", "Figure out what to do next"] },
  ],
  goal_setting: [
    { id: "priorKnowledge", label: "What do you want to achieve?", type: "textarea", field: "priorKnowledge", placeholder: "Describe the goal in your own words…" },
    { id: "constraints", label: "Any constraints or deadlines?", type: "textarea", field: "constraints", placeholder: "e.g. Must be done by June, limited budget…" },
    { id: "helpLevel", label: "Where are you in the process?", type: "chips-single", field: "helpLevel",
      options: ["Just starting out", "Have a rough idea", "Need to get specific", "Ready to make a plan"] },
  ],
  learning: [
    { id: "knowledgeLevel", label: "How much do you already know about this?", type: "chips-single", field: "knowledgeLevel",
      options: ["Complete beginner", "Some knowledge", "Fairly familiar", "Expert in parts"] },
    { id: "priorKnowledge", label: "What specifically do you want to learn?", type: "textarea", field: "priorKnowledge", placeholder: "e.g. Python for data analysis, music theory basics…" },
    { id: "helpLevel", label: "What's your goal for learning this?", type: "chips-single", field: "helpLevel",
      options: ["Personal interest", "Career change", "Specific project", "Exam or certification"] },
  ],
};

function ContextQuestion({ question, value, onChange }) {
  if (question.type === "textarea") {
    return (
      <div className="landing-question">
        <label className="landing-question-label">{question.label}</label>
        <textarea
          className="landing-question-textarea"
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          placeholder={question.placeholder || ""}
          rows={2}
        />
      </div>
    );
  }

  if (question.type === "chips-single") {
    return (
      <div className="landing-question">
        <label className="landing-question-label">{question.label}</label>
        <div className="landing-chips">
          {question.options.map(opt => (
            <button
              key={opt}
              type="button"
              className={`landing-chip${value === opt ? " landing-chip--active" : ""}`}
              onClick={() => onChange(value === opt ? "" : opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (question.type === "chips-multi") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="landing-question">
        <label className="landing-question-label">{question.label}</label>
        <div className="landing-chips">
          {question.options.map(opt => (
            <button
              key={opt}
              type="button"
              className={`landing-chip${selected.includes(opt) ? " landing-chip--active" : ""}`}
              onClick={() => {
                if (selected.includes(opt)) {
                  onChange(selected.filter(s => s !== opt));
                } else {
                  onChange([...selected, opt]);
                }
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export default function Landing({ onStart, disabled = false, error = null, sessions = [], onResume, onDeleteSession, onClearAllSessions }) {
  const [text, setText] = useState("");
  const [step, setStep] = useState("objective"); // "objective" | "mode" | "context"
  const [mode, setMode] = useState("");
  const [answers, setAnswers] = useState({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cycleIdx, setCycleIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCycleIdx(i => (i + 1) % SUGGESTIONS.length);
        setFading(false);
      }, 280);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  function handleProceed(e) {
    e?.preventDefault();
    if (text.trim()) setStep("mode");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && step === "objective" && text.trim()) {
      e.preventDefault();
      setStep("mode");
    }
  }

  function handleModeSelect(modeId) {
    setMode(modeId);
    setAnswers({});
    setStep("context");
  }

  function handleAnswer(id, val) {
    setAnswers(prev => ({ ...prev, [id]: val }));
  }

  function buildBackground() {
    const questions = MODE_QUESTIONS[mode] || [];
    const bg = { mode, helpLevel: "", priorKnowledge: "", alreadyPlanned: "", constraints: "", knowledgeLevel: "" };
    for (const q of questions) {
      const val = answers[q.id];
      if (!val || (Array.isArray(val) && val.length === 0)) continue;
      const str = Array.isArray(val) ? val.join(", ") : val;
      const prefixed = q.prefix ? q.prefix + str : str;
      if (q.field === "constraints" && bg.constraints) {
        bg.constraints += "; " + prefixed;
      } else {
        bg[q.field] = prefixed;
      }
    }
    return bg;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (text.trim() && mode) {
      onStart("I want to " + text.trim(), buildBackground());
    }
  }

  const questions = MODE_QUESTIONS[mode] || [];

  return (
    <>
      {sessions.length > 0 && !historyOpen && (
        <button
          className="history-toggle-btn"
          onClick={() => setHistoryOpen(true)}
          title="Past discourses"
          aria-label="Toggle history panel"
        >
          ☰
        </button>
      )}
      {historyOpen && (
        <div className="history-backdrop" onClick={() => setHistoryOpen(false)} />
      )}
      <HistoryPanel
        open={historyOpen}
        sessions={sessions}
        onResume={entry => { setHistoryOpen(false); onResume(entry); }}
        onDelete={onDeleteSession}
        onClearAll={() => { onClearAllSessions?.(); }}
        onClose={() => setHistoryOpen(false)}
      />
      <div className="landing">
      <h1>midWife</h1>
      <p className="landing-tagline">helping give birth to your ideas</p>
      {error && <p className="landing-error">{error}</p>}

      <form onSubmit={handleSubmit} className="landing-form">
        {/* Step 1: Objective */}
        <div className="landing-objective">
          <div
            className="landing-input-wrapper"
            onClick={() => inputRef.current?.focus()}
          >
            <span className="landing-input-prefix">I want to</span>
            <div className="landing-input-field">
              <textarea
                ref={inputRef}
                value={text}
                rows={1}
                onChange={e => {
                  setText(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              {!text && (
                <span className={`landing-input-suggestion${fading ? " landing-input-suggestion--fade" : ""}`}>
                  {SUGGESTIONS[cycleIdx]}
                </span>
              )}
            </div>
          </div>
          {step === "objective" && (
            <button
              type="button"
              className="landing-proceed-btn"
              disabled={!text.trim()}
              onClick={handleProceed}
            >
              Proceed →
            </button>
          )}
        </div>

        {/* Step 2: Mode picker */}
        {(step === "mode" || step === "context") && (
          <div className="landing-section landing-step" key="mode-section">
            <p className="landing-section-label">What kind of help do you need?</p>
            <div className="mode-grid">
              {MODES.map(m => (
                <button
                  key={m.id}
                  type="button"
                  className={`mode-card${mode === m.id ? " mode-card--active" : ""}`}
                  onClick={() => handleModeSelect(m.id)}
                >
                  <span className="mode-card-icon">{m.icon}</span>
                  <span className="mode-card-label">{m.label}</span>
                  <span className="mode-card-desc">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Mode-specific context questions */}
        {step === "context" && mode && (
          <div className="landing-section landing-step" key={`context-${mode}`}>
            {questions.map(q => (
              <ContextQuestion
                key={q.id}
                question={q}
                value={answers[q.id]}
                onChange={val => handleAnswer(q.id, val)}
              />
            ))}
            <button
              type="submit"
              className="landing-submit-btn"
              disabled={disabled}
            >
              {disabled ? "Starting…" : "Begin →"}
            </button>
          </div>
        )}
      </form>
      </div>
    </>
  );
}
