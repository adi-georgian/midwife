import { useState, useEffect, useRef } from "react";

export default function InterviewFlow({
  node,
  onAnswer,
  onChatAboutThis,
  onClearChatAnswer,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  questionNumber,
  totalQuestions,
  chatSuggestedAnswer,
  onSkip,
}) {
  const [selectedChips, setSelectedChips] = useState([]);
  const [draft, setDraft] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const inputRef = useRef(null);

  // Reset state when node changes; pre-populate from existing answer
  useEffect(() => {
    setSelectedChips([]);
    setDraft("");
    setConfirmed(false);
    if (node?.answer && node?.suggestions) {
      const matched = node.suggestions.filter(s =>
        node.answer.toLowerCase().includes(s.toLowerCase()) ||
        s.toLowerCase().includes(node.answer.toLowerCase())
      );
      if (matched.length > 0) setSelectedChips(matched);
      else setDraft(node.answer);
    }
  }, [node?.id]);

  function buildAnswer() {
    const parts = [...selectedChips, draft.trim()];
    if (chatSuggestedAnswer && !selectedChips.includes(chatSuggestedAnswer)) {
      parts.push(chatSuggestedAnswer);
    }
    return [...new Set(parts)].filter(Boolean).join("; ");
  }

  // → confirms selection and advances; ← navigates back (saves draft)
  function confirmAndNext() {
    const answer = buildAnswer();
    if (answer) {
      setConfirmed(true);
      setTimeout(() => onAnswer(answer), 400);
    } else if (hasNext) {
      onNext?.();
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e) {
      const inInput = document.activeElement === inputRef.current;
      if ((e.key === "ArrowRight" || e.key === "Enter") && !inInput) {
        e.preventDefault();
        confirmAndNext();
      }
      if (e.key === "ArrowLeft" && !inInput) {
        e.preventDefault();
        onPrev?.(buildAnswer());
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedChips, draft, onPrev, onNext, hasNext]);

  function handleTextSubmit(e) {
    e?.preventDefault();
    const answer = draft.trim();
    if (!answer) return;
    setConfirmed(true);
    setTimeout(() => onAnswer(answer), 400);
  }

  function toggleChip(suggestion) {
    setSelectedChips(prev =>
      prev.includes(suggestion) ? prev.filter(s => s !== suggestion) : [...prev, suggestion]
    );
  }

  if (!node) return null;

  // ── Interview mode UI ───────────────────────────────────────────────────────
  const chatMatchedChip = chatSuggestedAnswer
    ? (node.suggestions || []).find(s => s.toLowerCase() === chatSuggestedAnswer.toLowerCase())
    : null;
  const isChatCustom = chatSuggestedAnswer && !chatMatchedChip;
  const hasSelection = selectedChips.length > 0 || draft.trim().length > 0 || !!chatSuggestedAnswer;

  return (
    <div className="interview-overlay">
      <div className="interview-card">
        <div className="interview-card-nav">
          <button
            className="interview-nav-btn"
            onClick={() => onPrev?.(buildAnswer())}
            disabled={!hasPrev}
            title="Previous question (←)"
          >
            ←
          </button>
          <div className="progress-indicator">
            {questionNumber} / {totalQuestions}
            <span className="aspect-pill">{node.aspect}</span>
          </div>
          <button
            className="interview-nav-btn"
            onClick={() => onNext?.(buildAnswer())}
            disabled={!hasNext}
            title="Next question (→)"
          >
            →
          </button>
        </div>

        <p className="interview-question">{node.question}</p>

        {node.summary && (
          <p className="interview-summary">{node.summary}</p>
        )}

        <div className="suggestions suggestions--chips">
          {node.suggestions?.map(s => (
            <button
              key={s}
              className={`suggestion-chip${selectedChips.includes(s) || s === chatMatchedChip ? " suggestion-chip--selected" : ""}`}
              onClick={() => toggleChip(s)}
              type="button"
            >
              {s}
            </button>
          ))}
          {!chatSuggestedAnswer && (
            <button
              className="suggestion-chip"
              style={{ color: "#888" }}
              onClick={() => onChatAboutThis?.(node)}
              type="button"
            >
              Chat about this
            </button>
          )}
        </div>

        {chatMatchedChip && (
          <div className="chat-confirmed-answer">
            <span>✓ Answered from chat</span>
            <button className="chat-confirmed-answer-change" onClick={onClearChatAnswer} type="button">
              Change
            </button>
          </div>
        )}
        {isChatCustom && (
          <div className="chat-confirmed-answer">
            <span>✓ Answer from chat: <strong>{chatSuggestedAnswer}</strong></span>
            <button className="chat-confirmed-answer-change" onClick={onClearChatAnswer} type="button">
              Change
            </button>
          </div>
        )}

        <div className="free-text">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleTextSubmit(); }}
            placeholder="Add more detail…"
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            className="suggestion-chip suggestion-chip--skip"
            type="button"
            onClick={() => onSkip?.()}
          >
            Dismiss
          </button>
          <button
            className="interview-proceed-btn"
            type="button"
            onClick={confirmAndNext}
            disabled={!hasSelection && !hasNext}
          >
            {hasSelection ? "Proceed →" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
