import { useState, useRef, useEffect } from "react";
import PlanMarkdown from "./PlanMarkdown";

const MIN_WIDTH = 220;
const MAX_WIDTH = 600;

export default function RightPanel({
  tree,
  phase,
  panelTabs,
  onGeneratePanel,
  isPanelGenerating,
  onCollapse,
  onContinueExploring,
  onFinishPlanning,
  discourseFinished = false,
  width = 280,
  onWidthChange,
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
            <PlanMarkdown content={planContent} />
          </div>
        </div>
      </div>
    )}
    <div className="right-panel" style={{ width }}>
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
          <button className="rpanel-zoom-btn" onClick={() => setPlanModalOpen(true)} title="Expand plan">⤢</button>
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
        ) : planContent ? (
          <PlanMarkdown content={planContent} />
        ) : (
          <div className="rpanel-empty-state">
            <p className="rpanel-empty-state__text">
              Your plan will appear here after the first interview round.
            </p>
          </div>
        )}
      </div>

      {!discourseFinished && phase === "selecting" && (
        <div className="rpanel-actions">
          <button
            className="rpanel-action-btn rpanel-action-btn--continue"
            onClick={() => onContinueExploring(planContent || "")}
            disabled={isPanelGenerating}
          >
            Continue Exploring
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
