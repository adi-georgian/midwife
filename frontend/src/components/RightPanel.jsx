const MODE_TABS = {
  logistics:      [{ id: "overview", title: "Overview" }, { id: "timeline", title: "Timeline" }, { id: "tasks", title: "Tasks & Resources" }, { id: "questions", title: "Open Questions" }],
  brainstorming:  [{ id: "overview", title: "Overview" }, { id: "ideas", title: "Ideas" }, { id: "next_steps", title: "Next Steps" }, { id: "questions", title: "Open Questions" }],
  creative:       [{ id: "overview", title: "Overview" }, { id: "concepts", title: "Concepts" }, { id: "constraints", title: "Constraints" }, { id: "questions", title: "Open Questions" }],
  problem_solving:[{ id: "overview", title: "Overview" }, { id: "root_causes", title: "Root Causes" }, { id: "solutions", title: "Solutions" }, { id: "next_steps", title: "Next Steps" }],
  decision:       [{ id: "overview", title: "Overview" }, { id: "options", title: "Options" }, { id: "recommendation", title: "Recommendation" }, { id: "questions", title: "Open Questions" }],
  research:       [{ id: "overview", title: "Overview" }, { id: "findings", title: "Key Findings" }, { id: "gaps", title: "Knowledge Gaps" }, { id: "next_steps", title: "Next Steps" }],
  reflection:     [{ id: "overview", title: "Overview" }, { id: "insights", title: "Insights" }, { id: "patterns", title: "Patterns" }, { id: "actions", title: "Action Items" }],
  goal_setting:   [{ id: "overview", title: "Overview" }, { id: "milestones", title: "Milestones" }, { id: "timeline", title: "Timeline" }, { id: "blockers", title: "Blockers" }],
  learning:       [{ id: "overview", title: "Overview" }, { id: "concepts", title: "Key Concepts" }, { id: "path", title: "Learning Path" }, { id: "questions", title: "Open Questions" }],
};

const DEFAULT_TABS = [{ id: "overview", title: "Overview" }, { id: "next_steps", title: "Next Steps" }, { id: "questions", title: "Open Questions" }];

export default function RightPanel({
  tree,
  background = {},
  phase,
  panelTabs,
  activePanelTabId,
  onSwitchTab,
  onGeneratePanel,
  isPanelGenerating,
  onCollapse,
}) {
  if (!tree) return null;

  const primaryMode = (background.mode || "").split(",")[0].trim();
  const tabDefs = MODE_TABS[primaryMode] || DEFAULT_TABS;
  const activeTab = panelTabs?.find(t => t.id === activePanelTabId) || null;

  return (
    <div className="right-panel">
      <button className="rpanel-collapse-btn" onClick={onCollapse} title="Collapse panel">›</button>

      <div className="rpanel-header">
        <span className="rpanel-title">Plan</span>
      </div>

      <div className="rpanel-tab-bar">
        {tabDefs.map(tab => (
          <button
            key={tab.id}
            className={`rpanel-tab${activePanelTabId === tab.id ? " rpanel-tab--active" : ""}`}
            onClick={() => onSwitchTab(tab.id)}
          >
            {tab.title}
          </button>
        ))}
      </div>

      <div className="rpanel-tab-content">
        {isPanelGenerating ? (
          <div className="rpanel-skeleton">
            <div className="rpanel-skeleton-line rpanel-skeleton-line--wide" />
            <div className="rpanel-skeleton-line" />
            <div className="rpanel-skeleton-line rpanel-skeleton-line--short" />
            <div className="rpanel-skeleton-line rpanel-skeleton-line--wide" />
            <div className="rpanel-skeleton-line" />
            <div className="rpanel-skeleton-line rpanel-skeleton-line--short" />
          </div>
        ) : activeTab && activeTab.content ? (
          <>
            <pre className="rpanel-tab-body">{activeTab.content}</pre>
            {phase === "signoff" && activePanelTabId === "overview" && (
              <div className="rpanel-signoff-prompt">
                Based on this, Midwife has identified some aspects worth exploring. Check them out in the left panel to get started.
              </div>
            )}
          </>
        ) : (
          <div className="rpanel-empty-state">
            <p className="rpanel-empty-state__text">
              {panelTabs === null
                ? "Generate a summary of everything you\u2019ve discussed so far."
                : "No content yet for this tab."}
            </p>
            <button className="rpanel-generate-btn" onClick={onGeneratePanel}>
              {panelTabs === null ? "Generate Summary" : "Refresh"}
            </button>
          </div>
        )}
      </div>

      {panelTabs !== null && !isPanelGenerating && phase !== "signoff" && (
        <button className="rpanel-refresh-btn" onClick={onGeneratePanel} title="Refresh all tabs">
          ↻ Refresh
        </button>
      )}
    </div>
  );
}
