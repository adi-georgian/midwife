import { useState, useEffect, useRef } from "react";
import { generateQuestionForAspect } from "../api";
import PlanMarkdown from "./PlanMarkdown";

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="guide-skeleton">
      <div className="guide-skeleton__bar guide-skeleton__bar--wide" />
      <div className="guide-skeleton__bar guide-skeleton__bar--medium" />
      <div className="guide-skeleton__bar guide-skeleton__bar--wide" />
      <div className="guide-skeleton__bar guide-skeleton__bar--narrow" />
      <div className="guide-skeleton__bar guide-skeleton__bar--medium" />
    </div>
  );
}

// ── ProgressDots ─────────────────────────────────────────────────────────────

function ProgressDots({ pages, currentIndex }) {
  return (
    <div className="guide-progress-dots">
      {pages.map((_, i) => (
        <span
          key={i}
          className={`guide-progress-dot ${i === currentIndex ? "guide-progress-dot--active" : ""}`}
        />
      ))}
    </div>
  );
}

// ── BriefingAspectItem ────────────────────────────────────────────────────────

function BriefingAspectItem({ node, onRemove, onUpdate }) {
  const [title, setTitle] = useState(node.aspect);
  const [question, setQuestion] = useState(node.question);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(false);
  const titleRef = useRef(null);
  const questionRef = useRef(null);

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus();
  }, [editingTitle]);

  useEffect(() => {
    if (editingQuestion) questionRef.current?.focus();
  }, [editingQuestion]);

  function commitTitle() {
    setEditingTitle(false);
    const trimmed = title.trim() || node.aspect;
    setTitle(trimmed);
    if (trimmed !== node.aspect) onUpdate(node.id, { aspect: trimmed });
  }

  function commitQuestion() {
    setEditingQuestion(false);
    const trimmed = question.trim() || node.question;
    setQuestion(trimmed);
    if (trimmed !== node.question) onUpdate(node.id, { question: trimmed });
  }

  function openEdit(e) {
    e.stopPropagation();
    setEditingTitle(false);
    setEditingQuestion(true);
  }

  return (
    <div className="guide-aspect-item">
      <div className="guide-aspect-item__header">
        {editingTitle ? (
          <input
            ref={titleRef}
            className="guide-aspect-item__title-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => { if (e.key === "Enter") commitTitle(); if (e.key === "Escape") { setTitle(node.aspect); setEditingTitle(false); } }}
          />
        ) : (
          <span
            className="guide-aspect-item__title"
            onClick={() => setEditingTitle(true)}
            title="Click to edit title"
          >{title}</span>
        )}
        <button
          className="guide-aspect-item__remove"
          onClick={() => onRemove(node.id)}
          title="Remove this aspect"
        >×</button>
      </div>

      {node.rationale && (
        <p className="guide-aspect-item__rationale">{node.rationale}</p>
      )}

      <div className="guide-aspect-item__card">
        <div className="guide-aspect-item__card-title">{title}</div>
        {node._generating ? (
          <span className="guide-aspect-item__question guide-aspect-item__question--generating">
            Generating question…
          </span>
        ) : editingQuestion ? (
          <textarea
            ref={questionRef}
            className="guide-aspect-item__question-input"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onBlur={commitQuestion}
            onKeyDown={e => { if (e.key === "Escape") { setQuestion(node.question); setEditingQuestion(false); } }}
            rows={2}
          />
        ) : (
          <span className="guide-aspect-item__question">{question}</span>
        )}
        {!editingQuestion && !node._generating && (
          <button
            className="guide-aspect-item__card-edit-btn"
            title="Edit"
            onClick={openEdit}
          >
            <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8.5 1.5l2 2L4 10l-2.5.5.5-2.5 6.5-6.5z"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ── AddAspectInline ───────────────────────────────────────────────────────────

function AddAspectInline({ onAdd, onAddGenerating, sessionId }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const titleRef = useRef(null);
  const descRef = useRef(null);

  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open]);

  function cancel() {
    setOpen(false);
    setTitle("");
    setDescription("");
  }

  async function commit() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) { cancel(); return; }
    const id = `new-${Date.now()}`;
    const trimmedDesc = description.trim();

    // Add immediately with _generating flag — shows gray card with loading inner card
    onAddGenerating({
      id,
      aspect: trimmedTitle,
      question: "",
      rationale: "",
      _new: true,
      _generating: true,
    });
    cancel();

    // Generate question in background
    if (sessionId) {
      try {
        const result = await generateQuestionForAspect(sessionId, trimmedTitle, trimmedDesc);
        onAdd(id, result.question || "");
      } catch {
        onAdd(id, "");
      }
    }
  }

  function handleTitleKeyDown(e) {
    if (e.key === "Enter") { e.preventDefault(); descRef.current?.focus(); }
    if (e.key === "Escape") cancel();
  }

  function handleDescKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
    if (e.key === "Escape") cancel();
  }

  if (!open) {
    return (
      <button className="guide-aspect-add-btn" onClick={() => setOpen(true)}>
        + Add an Aspect
      </button>
    );
  }

  return (
    <div className="guide-aspect-add-form">
      <input
        ref={titleRef}
        className="guide-aspect-add-input"
        placeholder="Aspect title…"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={handleTitleKeyDown}
      />
      <textarea
        ref={descRef}
        className="guide-aspect-add-desc"
        placeholder="Briefly describe why this matters… (press Enter to submit)"
        value={description}
        onChange={e => setDescription(e.target.value)}
        onKeyDown={handleDescKeyDown}
        rows={2}
      />
      <div className="guide-aspect-add-actions">
        <button className="guide-aspect-add-cancel" onClick={cancel} type="button">Cancel</button>
        <button className="guide-aspect-add-submit" onClick={commit} type="button" disabled={!title.trim()}>
          Generate →
        </button>
      </div>
    </div>
  );
}

// ── GuideWindow ───────────────────────────────────────────────────────────────

export default function GuideWindow({
  cycle,
  overviewProse,
  aspectItems,
  isLoading,
  onChatUpdate,
  onConfirm,
  onDismiss,
  onRetryAspects,
  onRetryOverview,
  sessionId,
}) {
  const pageList = ["overview", "aspects"];
  const [pageIndex, setPageIndex] = useState(0);
  const currentPage = pageList[pageIndex];

  const PAGE_TITLES = {
    overview: cycle === 0 ? "Overview" : "Plan So Far",
    aspects: cycle === 0 ? "What We'll Explore" : "New Directions",
  };

  // Overview state
  const [localOverview, setLocalOverview] = useState(overviewProse || "");
  useEffect(() => { if (overviewProse) setLocalOverview(overviewProse); }, [overviewProse]);

  // Aspects state — seed once when aspectItems first becomes non-empty
  const [localAspects, setLocalAspects] = useState([]);
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && aspectItems && aspectItems.length > 0) {
      setLocalAspects(aspectItems.map(a => ({ ...a })));
      seeded.current = true;
    }
  }, [aspectItems]);

  // Chat state
  const [chatDraft, setChatDraft] = useState("");
  const [isChatWaiting, setIsChatWaiting] = useState(false);
  const [acknowledgment, setAckText] = useState("");
  const ackTimer = useRef(null);
  const chatInputRef = useRef(null);

  function showAck(text) {
    setAckText(text);
    if (ackTimer.current) clearTimeout(ackTimer.current);
    ackTimer.current = setTimeout(() => setAckText(""), 3500);
  }

  async function handleSendChat() {
    const msg = chatDraft.trim();
    if (!msg || isChatWaiting) return;
    setChatDraft("");
    setIsChatWaiting(true);
    try {
      const result = await onChatUpdate(msg, currentPage, {
        currentOverview: localOverview,
        currentIdeas: null,
        currentQuestions: null,
      });
      if (result.updated_overview != null) setLocalOverview(result.updated_overview);
      if (result.acknowledgment) showAck(result.acknowledgment);
    } catch {
      showAck("Something went wrong. Please try again.");
    } finally {
      setIsChatWaiting(false);
      chatInputRef.current?.focus();
    }
  }

  function handleChatKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  }

  const isFirst = pageIndex === 0;
  const isLast = pageIndex === pageList.length - 1;
  const showChat = currentPage === "overview" && cycle === 0 && !!localOverview;

  const confirmLabel = cycle === 0 ? "Let's go →" : "Add These →";

  return (
    <div className="guide-overlay">
      <div className="guide-window">

        {/* Header */}
        <div className="guide-header">
          <div className="guide-header__left">
            <span className="guide-header__label">Briefing</span>
            <h2 className="guide-header__title">{PAGE_TITLES[currentPage]}</h2>
          </div>
          <div className="guide-progress-dots-wrap">
            <ProgressDots pages={pageList} currentIndex={pageIndex} />
          </div>
        </div>

        {/* Body */}
        <div className="guide-body">
          {currentPage === "overview" && (
            <div className="guide-page guide-page--overview">
              {isLoading && !localOverview ? (
                <Skeleton />
              ) : (
                <div className="guide-overview-prose">
                  {localOverview
                    ? <PlanMarkdown content={localOverview} />
                    : (
                      <div className="guide-aspects-empty">
                        <p className="guide-empty">
                          {cycle === 0 ? "Couldn't generate an overview." : "No plan summary available. Proceed to see new directions."}
                        </p>
                        {cycle === 0 && onRetryOverview && (
                          <button className="guide-retry-btn" onClick={onRetryOverview}>↻ Try again</button>
                        )}
                      </div>
                    )
                  }
                </div>
              )}
            </div>
          )}

          {currentPage === "aspects" && (
            <div className="guide-aspects-page">
              {!isLoading && localAspects.length > 0 && (
                <p className="guide-aspects-intro">
                  Here are some aspects Midwife thinks are worth exploring — which of these resonate with you? We'll interview you about these shortly. Feel free to remove, edit, or add your own.
                </p>
              )}
              {isLoading && localAspects.length === 0 ? (
                <Skeleton />
              ) : !isLoading && localAspects.length === 0 ? (
                <div className="guide-aspects-empty">
                  <p className="guide-empty">Couldn't load suggestions.</p>
                  {onRetryAspects && (
                    <button className="guide-retry-btn" onClick={onRetryAspects}>
                      ↻ Try again
                    </button>
                  )}
                  <AddAspectInline
                    sessionId={sessionId}
                    onAddGenerating={newAspect => setLocalAspects(prev => [...prev, newAspect])}
                    onAdd={(id, question) => setLocalAspects(prev =>
                      prev.map(a => a.id === id ? { ...a, question, _generating: false } : a)
                    )}
                  />
                </div>
              ) : (
                <>
                  {localAspects.map(a => (
                    <BriefingAspectItem
                      key={a.id}
                      node={a}
                      onRemove={id => setLocalAspects(prev => prev.filter(x => x.id !== id))}
                      onUpdate={(id, patch) => setLocalAspects(prev => prev.map(x => x.id === id ? { ...x, ...patch, _edited: true } : x))}
                    />
                  ))}
                  <AddAspectInline
                    sessionId={sessionId}
                    onAddGenerating={newAspect => setLocalAspects(prev => [...prev, newAspect])}
                    onAdd={(id, question) => setLocalAspects(prev =>
                      prev.map(a => a.id === id ? { ...a, question, _generating: false } : a)
                    )}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Chat section — only on cycle 0 overview */}
        {showChat && (
          <div className="guide-chat-section">
            {acknowledgment && (
              <div className="guide-ack">{acknowledgment}</div>
            )}
            <div className="chat-bar__input-row">
              <textarea
                ref={chatInputRef}
                className="chat-bar__input guide-chat-input"
                placeholder="Anything to add?"
                value={chatDraft}
                onChange={e => setChatDraft(e.target.value)}
                onKeyDown={handleChatKeyDown}
                rows={1}
                disabled={isChatWaiting || isLoading}
              />
              <button
                className="chat-bar__send-btn"
                onClick={handleSendChat}
                disabled={!chatDraft.trim() || isChatWaiting || isLoading}
              >
                {isChatWaiting ? (
                  "…"
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Footer — nav buttons */}
        <div className="guide-footer">
          <div className="guide-nav">
            <div className="guide-nav__left">
              {!isFirst && (
                <button className="guide-nav-btn guide-nav-btn--back" onClick={() => setPageIndex(i => i - 1)}>
                  ← Back
                </button>
              )}
              {cycle > 0 && isFirst && onDismiss && (
                <button className="guide-nav-btn guide-nav-btn--skip" onClick={onDismiss}>
                  Skip
                </button>
              )}
            </div>
            <div className="guide-nav__right">
              {!isLast && (currentPage !== "overview" || localOverview || cycle > 0) && (
                <button
                  className="guide-nav-btn guide-nav-btn--next"
                  onClick={() => setPageIndex(i => i + 1)}
                >
                  Next →
                </button>
              )}
              {isLast && (
                <button
                  className="guide-nav-btn guide-nav-btn--confirm"
                  onClick={() => onConfirm(localAspects)}
                  disabled={localAspects.length === 0}
                >
                  {confirmLabel}
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
