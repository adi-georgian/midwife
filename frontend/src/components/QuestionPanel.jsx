import { useState, useEffect } from "react";

export default function QuestionPanel({ node, onAnswer, onElaborate, onClose }) {
  const [draft, setDraft] = useState("");
  const isAnswered = node.answer !== null && node.answer !== undefined;

  // Close on Escape key
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function submitAnswer(answer) {
    if (!answer.trim()) return;
    onAnswer(answer.trim());
    setDraft("");
  }

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="question-panel" onClick={e => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose}>✕</button>
        <span className="panel-aspect">{node.aspect}</span>
        <p className="panel-question">{node.question}</p>

        {isAnswered ? (
          <div className="panel-answered">
            <p className="panel-answer-label">Your answer:</p>
            <p className="panel-answer-text">{node.answer}</p>
            <button className="elaborate-btn" onClick={onElaborate}>
              Elaborate
            </button>
          </div>
        ) : (
          <div className="panel-input">
            <div className="suggestions">
              {node.suggestions.map(s => (
                <button
                  key={s}
                  className="suggestion-chip"
                  onClick={() => submitAnswer(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="free-text">
              <input
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Or type your own answer..."
                onKeyDown={e => e.key === "Enter" && submitAnswer(draft)}
                autoFocus
              />
              <button onClick={() => submitAnswer(draft)} disabled={!draft.trim()}>
                Submit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
