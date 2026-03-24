const MODE_LABELS = {
  logistics: "Logistics",
  brainstorming: "Brainstorm",
  creative: "Creative",
  problem_solving: "Problem-solving",
  decision: "Decision",
  research: "Research",
};

const BG_FIELD_LABELS = {
  priorKnowledge: "Prior knowledge",
  alreadyPlanned: "Already planned",
  constraints: "Constraints",
  helpLevel: "Help focus",
  knowledgeLevel: "Familiarity",
};

export default function RightPanel({ tree, hoveredNodeId, selectedNodeId, findNode, focusNodeId, objective = "", background = {}, onCollapse, onExplore }) {
  if (!tree) return null;

  // When something is hovered or selected, show its detail. Otherwise show focus summary.
  const activeId = selectedNodeId ?? hoveredNodeId ?? null;
  const activeNode = activeId ? (findNode(tree, activeId) ?? null) : null;

  // Summary view (nothing hovered/selected)
  if (!activeNode) {
    const focusNode = findNode(tree, focusNodeId) ?? tree;
    const realChildren = (focusNode.children || []).filter(c => !c.is_ghost && !c.is_loading);
    const answeredChildren = realChildren.filter(c => c.answer);
    const total = realChildren.length;
    const answered = answeredChildren.length;

    const modeLabel = background.mode ? MODE_LABELS[background.mode] : null;
    const bgFields = Object.entries(BG_FIELD_LABELS)
      .map(([key, label]) => ({ label, value: background[key] }))
      .filter(({ value }) => value && String(value).trim());

    return (
      <div className="right-panel">
        <button className="rpanel-collapse-btn" onClick={onCollapse} title="Collapse panel">›</button>
        <div className="rpanel-detail-content">
          <div className="rpanel-section-label">Objective</div>
          {objective && <p className="rpanel-objective">{objective}</p>}
          {(modeLabel || bgFields.length > 0) && (
            <div className="rpanel-grounding">
              {modeLabel && (
                <div className="rpanel-grounding-row">
                  <span className="rpanel-grounding-label">Mode</span>
                  <span className="rpanel-grounding-value">{modeLabel}</span>
                </div>
              )}
              {bgFields.map(({ label, value }) => (
                <div key={label} className="rpanel-grounding-row">
                  <span className="rpanel-grounding-label">{label}</span>
                  <span className="rpanel-grounding-value">{value}</span>
                </div>
              ))}
            </div>
          )}
          {total > 0 && (
            <>
              <div className="rpanel-grounding-divider" />
              <div className="rpanel-summary-progress">
                <span className="rpanel-summary-count">{answered} / {total}</span>
                <span className="rpanel-summary-label"> aspects answered</span>
              </div>
            </>
          )}
          {answeredChildren.length > 0 ? (
            <ul className="rpanel-detail-children-list">
              {answeredChildren.map(child => (
                <li key={child.id} className="rpanel-detail-child-item">
                  <span className="rpanel-detail-child-label">{child.aspect}</span>
                  <span className="rpanel-detail-child-answer">{child.answer}</span>
                </li>
              ))}
            </ul>
          ) : total > 0 ? (
            <p className="rpanel-empty">No answers yet — start exploring.</p>
          ) : null}
        </div>
      </div>
    );
  }

  // Detail view (hovered or selected node)
  const isRoot = activeNode.id === "root" || activeNode.id === tree.id;
  const realChildren = (activeNode.children || []).filter(c => !c.is_ghost && !c.is_loading);
  const isTerminal = realChildren.length === 0;

  return (
    <div className="right-panel">
      <button className="rpanel-collapse-btn" onClick={onCollapse} title="Collapse panel">›</button>
      <div className="rpanel-detail-content">
        <div className="rpanel-section-label">{isRoot ? "Session" : "Aspect"}</div>
        <h2 className="rpanel-title">{activeNode.aspect}</h2>

        {!isRoot && activeNode.question && (
          <div className="rpanel-detail-question">
            <p>{activeNode.question}</p>
          </div>
        )}

        {isTerminal && activeNode.answer && (
          <div className="rpanel-detail-answer">
            <div className="rpanel-detail-answer-label">Answer</div>
            <p>{activeNode.answer}</p>
          </div>
        )}

        {isTerminal && activeNode.answer && onExplore && (
          <button className="rpanel-explore-btn" onClick={() => onExplore(activeNode.id)}>
            Explore →
          </button>
        )}

        {isTerminal && activeNode.suggestions && activeNode.suggestions.length > 0 && (
          <div className="rpanel-detail-suggestions">
            <div className="rpanel-suggestions-label">Suggestions</div>
            <ul className="rpanel-suggestions-list">
              {activeNode.suggestions.map((s, i) => (
                <li key={i} className="rpanel-suggestion-item">{s}</li>
              ))}
            </ul>
          </div>
        )}

        {!isTerminal && realChildren.length > 0 && (
          <div className="rpanel-detail-children">
            <div className="rpanel-suggestions-label">Sub-aspects</div>
            <ul className="rpanel-detail-children-list">
              {realChildren.map(child => (
                <li key={child.id} className="rpanel-detail-child-item">
                  <span className="rpanel-detail-child-label">{child.aspect}</span>
                  {child.answer && (
                    <span className="rpanel-detail-child-answer">{child.answer}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
