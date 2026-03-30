import { useState, useRef, useEffect } from "react";
import InteractivePlan, { planToMarkdown } from "./InteractivePlan";

const MIN_WIDTH = 220;
const MAX_WIDTH = 600;

export default function RightPanel({
  tree,
  phase,
  panelTabs,
  sessionId,
  onGeneratePanel,
  isPanelGenerating,
  onCollapse,
  onRefinePlan,
  onFinishPlanning,
  discourseFinished = false,
  width = 280,
  onWidthChange,
  proposedPlan,
  onAcceptProposedPlan,
  onRejectProposedPlan,
}) {
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [dragBorderHovered, setDragBorderHovered] = useState(false);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  useEffect(() => {
    function onMouseMove(e) {
      if (!draggingRef.current) return;
      const delta = startXRef.current - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta));
      onWidthChange?.(newWidth);
    }
    function onMouseUp() {
      if (draggingRef.current) {
        draggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onWidthChange]);

  if (!tree) return null;

  const planContent = panelTabs?.[0]?.content || null;

  function handleDragStart(e) {
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function handleSave() {
    let mdContent = planContent;
    try {
      if (planContent && !planContent.trimStart().startsWith("#")) {
        mdContent = planToMarkdown(JSON.parse(planContent));
      }
    } catch {}
    const blob = new Blob([mdContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "midwife-plan.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
    {planModalOpen && planContent && (
      <div className="rpanel-zoom-overlay" onClick={() => setPlanModalOpen(false)}>
        <div className="rpanel-zoom-modal" onClick={e => e.stopPropagation()}>
          <div className="rpanel-zoom-header">
            <span className="rpanel-zoom-title">Plan</span>
            <button className="rpanel-zoom-close-btn" onClick={() => setPlanModalOpen(false)}>✕</button>
          </div>
          <div className="rpanel-zoom-content">
            <InteractivePlan content={planContent} sessionId={sessionId} />
          </div>
        </div>
      </div>
    )}
    <div className="right-panel" style={{ width }} data-chat-persist>
      <div
        className={`rpanel-resize-handle${dragBorderHovered ? " rpanel-resize-handle--active" : ""}`}
        onMouseEnter={() => setDragBorderHovered(true)}
        onMouseLeave={() => setDragBorderHovered(false)}
        onMouseDown={handleDragStart}
      />
      <button className="rpanel-collapse-btn" onClick={onCollapse} title="Collapse panel">›</button>

      <div className="rpanel-header">
        <span className="rpanel-title">Plan</span>
        {planContent && !isPanelGenerating && (
          <div className="rpanel-header-actions">
            <button className="rpanel-zoom-btn" onClick={() => setPlanModalOpen(true)} title="Expand plan">
              <svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9"/>
              </svg>
            </button>
            <button className="rpanel-save-btn" title="Save as .md" onClick={handleSave}>
              <svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 1v8M4 6l3 3 3-3M2 11h10"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="rpanel-tab-content rpanel-tab-content--notabs">
        {isPanelGenerating ? (
          <div className="rpanel-skeleton">
            <div className="rpanel-skeleton-line rpanel-skeleton-line--wide" />
            <div className="rpanel-skeleton-line" />
            <div className="rpanel-skeleton-line rpanel-skeleton-line--short" />
            <div className="rpanel-skeleton-line rpanel-skeleton-line--wide" />
            <div className="rpanel-skeleton-line" />
            <div className="rpanel-skeleton-line rpanel-skeleton-line--short" />
          </div>
        ) : (
          <>
            {proposedPlan && (
              <div className="iplan-proposed-wrap">
                <div className="iplan-proposed-header">Proposed Changes</div>
                <InteractivePlan content={JSON.stringify(proposedPlan)} sessionId={sessionId} muted />
                <div className="iplan-proposed-actions">
                  <button className="iplan-accept-btn" onClick={() => onAcceptProposedPlan(proposedPlan)}>
                    Accept Changes
                  </button>
                  <button className="iplan-reject-btn" onClick={onRejectProposedPlan}>
                    Keep Current
                  </button>
                </div>
              </div>
            )}
            {planContent && !proposedPlan ? (
              <InteractivePlan content={planContent} sessionId={sessionId} />
            ) : !planContent ? (
              <div className="rpanel-empty-state">
                <p className="rpanel-empty-state__text">
                  Your plan will appear here after the first interview round.
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>

      {!discourseFinished && phase === "selecting" && !proposedPlan && (
        <div className="rpanel-actions">
          <button
            className="rpanel-action-btn rpanel-action-btn--continue"
            onClick={onRefinePlan}
            disabled={isPanelGenerating || !planContent}
          >
            Refine Plan
          </button>
          <button
            className="rpanel-action-btn rpanel-action-btn--finish"
            onClick={onFinishPlanning}
          >
            Finish Planning
          </button>
        </div>
      )}

      {discourseFinished && (
        <div className="rpanel-finished-banner">
          Planning complete. This discourse is now read-only.
        </div>
      )}
    </div>
    </>
  );
}
