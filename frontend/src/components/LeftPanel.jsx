import { useState, useRef, useEffect } from "react";

function findParentInTree(node, targetId) {
  for (const child of node.children || []) {
    if (child.id === targetId) return node;
    const result = findParentInTree(child, targetId);
    if (result) return result;
  }
  return null;
}

export default function LeftPanel({
  tree, hoveredNodeId, selectedNodeId, findNode, focusNodeId,
  phase, movingNodeId, signoffParentId,
  viewMode,
  focusChildless, onExploreFocus, exploringNodeId,
  onSelectNode, onExplore, onDelete, onEditAspect, onAddChild, onMove, onConfirmMove,
  onAddAspect, onConfirmSignoff, onNavigateTo, onCollapse, onHoverNode, onInlineAdd,
  discourseFinished = false,
}) {
  const [inlineAddParentId, setInlineAddParentId] = useState(null);
  const [inlineAddText, setInlineAddText] = useState("");
  const [draggingId, setDraggingId] = useState(null);
  const [focusDragOver, setFocusDragOver] = useState(false);

  if (!tree) return null;

  const focusNode = findNode(tree, focusNodeId) ?? tree;
  const parentOfFocus = (focusNodeId && focusNodeId !== "root" && focusNodeId !== tree.id)
    ? findParentInTree(tree, focusNodeId)
    : null;

  const realChildren = (focusNode.children || []).filter(c => !c.is_ghost && !c.is_loading);
  const showGrandchildren = viewMode !== "children";
  const isRootFocus = focusNode.id === tree.id;

  function handleInlineSubmit(parentId) {
    const text = inlineAddText.trim();
    if (text) onInlineAdd?.(text, parentId);
    setInlineAddParentId(null);
    setInlineAddText("");
  }

  function handleInlineKeyDown(e, parentId) {
    if (e.key === "Enter") { e.preventDefault(); handleInlineSubmit(parentId); }
    if (e.key === "Escape") { setInlineAddParentId(null); setInlineAddText(""); }
  }

  // Signoff phase
  if (phase === "signoff") {
    const signoffParent = signoffParentId ? (findNode(tree, signoffParentId) || tree) : tree;
    const signoffChildren = (signoffParent?.children || []).filter(c => !c.is_ghost && !c.is_loading);

    return (
      <div className="left-panel">
        <button className="lpanel-collapse-btn" onClick={onCollapse} title="Collapse panel">‹</button>
        <div className="lpanel-content">
          {parentOfFocus && (
            <button className="lpanel-parent-link" onClick={() => onNavigateTo?.(parentOfFocus.id)}>
              ↑ Return to <span className="lpanel-parent-chip">{parentOfFocus.aspect}</span>
            </button>
          )}
          <div className="lpanel-tree-section">
            <div className={`lpanel-focus-card${isRootFocus ? " lpanel-focus-card--root" : ""}`}>
              <span className="lpanel-focus-badge">Focus</span>
              <span className="lpanel-focus-title">{focusNode.aspect}</span>
            </div>
            <div className="lpanel-children-list">
              {signoffChildren.map(child => (
                <SignoffCard
                  key={child.id}
                  node={child}
                  onDelete={onDelete}
                  isHovered={hoveredNodeId === child.id}
                  onHoverNode={onHoverNode}
                />
              ))}
              {inlineAddParentId === signoffParent.id && (
                <InlineAddInput
                  value={inlineAddText}
                  onChange={setInlineAddText}
                  onKeyDown={e => handleInlineKeyDown(e, signoffParent.id)}
                  onBlur={() => handleInlineSubmit(signoffParent.id)}
                  onSubmit={() => handleInlineSubmit(signoffParent.id)}
                />
              )}
            </div>
            {inlineAddParentId !== signoffParent.id && !discourseFinished && (
              <button
                className="lpanel-add-inline-btn"
                onClick={() => { setInlineAddParentId(signoffParent.id); setInlineAddText(""); }}
              >+ Add Aspect</button>
            )}
          </div>
        </div>
        <div className="lpanel-footer">
          <button
            className="lpanel-confirm-btn"
            onClick={onConfirmSignoff}
            disabled={signoffChildren.length === 0}
          >
            Start Interview
          </button>
        </div>
      </div>
    );
  }

  // Normal mode
  const sharedProps = {
    selectedNodeId, hoveredNodeId, movingNodeId,
    draggingId, setDraggingId,
    onSelectNode, onExplore, onDelete, onEditAspect, onMove, onConfirmMove, onNavigateTo, onHoverNode,
    inlineAddParentId, setInlineAddParentId,
    inlineAddText, setInlineAddText,
    onInlineKeyDown: handleInlineKeyDown,
    onInlineBlur: handleInlineSubmit,
    showGrandchildren,
    exploringNodeId,
    discourseFinished,
  };

  const isFocusTerminal = realChildren.length === 0;

  return (
    <div className="left-panel">
      <button className="lpanel-collapse-btn" onClick={onCollapse} title="Collapse panel">‹</button>
      <div className="lpanel-content">
        {parentOfFocus && (
          <button className="lpanel-parent-link" onClick={() => onNavigateTo?.(parentOfFocus.id)}>
            ↑ Return to <span className="lpanel-parent-chip">{parentOfFocus.aspect}</span>
          </button>
        )}
        <div className="lpanel-tree-section">
          <div
            className={`lpanel-focus-card${isRootFocus ? " lpanel-focus-card--root" : ""}${!isRootFocus && isFocusTerminal && focusNode.answer ? " lpanel-focus-card--terminal" : ""}${focusDragOver && draggingId ? " lpanel-focus-card--drag-over" : ""}`}
            onDragOver={e => {
              if (draggingId && draggingId !== focusNode.id) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setFocusDragOver(true);
              }
            }}
            onDragLeave={() => setFocusDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              const id = e.dataTransfer.getData("nodeId");
              if (id && id !== focusNode.id) {
                onConfirmMove(focusNode.id, id);
                setDraggingId(null);
              }
              setFocusDragOver(false);
            }}
          >
            <span className="lpanel-focus-badge">Focus</span>
            <span className="lpanel-focus-title">{focusNode.aspect}</span>
            {isFocusTerminal && (focusNode.answer || focusNode.question) && (
              <span className="lpanel-focus-description">
                {focusNode.answer || focusNode.question}
              </span>
            )}
          </div>

          {isFocusTerminal ? null : realChildren.length > 0 ? (
            <div className="lpanel-children-list">
              {realChildren.map(child => (
                <NavCard key={child.id} node={child} {...sharedProps} />
              ))}
              {inlineAddParentId === focusNodeId && (
                <InlineAddInput
                  value={inlineAddText}
                  onChange={setInlineAddText}
                  onKeyDown={e => handleInlineKeyDown(e, focusNodeId)}
                  onBlur={() => handleInlineSubmit(focusNodeId)}
                  onSubmit={() => handleInlineSubmit(focusNodeId)}
                />
              )}
            </div>
          ) : (
            <>
              <p className="lpanel-empty">No aspects yet.</p>
              {inlineAddParentId === focusNodeId && (
                <InlineAddInput
                  value={inlineAddText}
                  onChange={setInlineAddText}
                  onKeyDown={e => handleInlineKeyDown(e, focusNodeId)}
                  onBlur={() => handleInlineSubmit(focusNodeId)}
                  onSubmit={() => handleInlineSubmit(focusNodeId)}
                />
              )}
            </>
          )}
          {isFocusTerminal && phase === "selecting" && onExploreFocus && inlineAddParentId !== focusNodeId && !discourseFinished && (
            <button className="lpanel-explore-standalone-btn" onClick={onExploreFocus} disabled={exploringNodeId === focusNode.id}>
              {exploringNodeId === focusNode.id ? <span className="lpanel-spinner" /> : "Explore →"}
            </button>
          )}
          {inlineAddParentId !== focusNodeId && !discourseFinished && (
            <button
              className={`lpanel-add-inline-btn${isFocusTerminal ? " lpanel-add-inline-btn--terminal" : ""}`}
              onClick={() => { setInlineAddParentId(focusNodeId); setInlineAddText(""); }}
            >+ Add Aspect</button>
          )}
        </div>
      </div>
    </div>
  );
}

function InlineAddInput({ value, onChange, onKeyDown, onBlur, onSubmit }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="lpanel-child-row lpanel-child-row--new">
      <input
        ref={ref}
        className="lpanel-new-card-input"
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        placeholder="Aspect name…"
      />
      {onSubmit && (
        <button
          className="lpanel-new-card-submit"
          onMouseDown={e => { e.preventDefault(); onSubmit(); }}
          title="Add"
        >✓</button>
      )}
    </div>
  );
}

export function SignoffCard({ node, onDelete, isHovered, onHoverNode }) {
  const rowClass = [
    "lpanel-child-row lpanel-child-row--signoff",
    isHovered ? "lpanel-child-row--hovered" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={rowClass}
      onMouseEnter={() => onHoverNode?.(node.id)}
      onMouseLeave={() => onHoverNode?.(null)}
    >
      <div className="lpanel-child-row-header">
        <span className="lpanel-child-label">{node.aspect}</span>
        <button
          className="lpanel-signoff-delete"
          onClick={e => { e.stopPropagation(); onDelete(node.id); }}
          title="Remove aspect"
        >
          ×
        </button>
      </div>
      {node.question && (
        <span className="lpanel-child-question">{node.question}</span>
      )}
    </div>
  );
}

function NavCard({
  node, isSelf, depth = 0,
  selectedNodeId, hoveredNodeId, movingNodeId,
  draggingId, setDraggingId,
  onSelectNode, onExplore, onDelete, onEditAspect, onMove, onConfirmMove, onNavigateTo, onHoverNode,
  inlineAddParentId, setInlineAddParentId, inlineAddText, setInlineAddText,
  onInlineKeyDown, onInlineBlur,
  showGrandchildren, exploringNodeId,
  discourseFinished = false,
}) {
  const [hovered, setHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const editTitleRef = useRef(null);

  const isAnswered = !!node.answer;
  const isSelected = selectedNodeId === node.id;
  const isHoveredByCanvas = hoveredNodeId === node.id;
  const isMoveTarget = movingNodeId && movingNodeId !== node.id;
  const showActions = (isSelected || hovered || exploringNodeId === node.id) && !isSelf && depth === 0 && !isEditing && !discourseFinished;

  useEffect(() => {
    if (isEditing) editTitleRef.current?.focus();
  }, [isEditing]);

  async function handleEditSave() {
    const payload = {};
    const trimmedTitle = editTitle.trim();
    if (trimmedTitle && trimmedTitle !== node.aspect) payload.aspect = trimmedTitle;
    const descField = node.answer !== undefined && node.answer !== null ? "answer" : "question";
    const originalDesc = node.answer ?? node.question ?? "";
    if (editDesc !== originalDesc) payload[descField] = editDesc;
    if (Object.keys(payload).length > 0) {
      await onEditAspect?.(node.id, payload);
    }
    setIsEditing(false);
  }

  const grandchildren = (showGrandchildren && depth === 0)
    ? (node.children || []).filter(c => !c.is_ghost && !c.is_loading)
    : [];

  function handleClick(e) {
    e.stopPropagation();
    if (isEditing) return;
    if (movingNodeId && movingNodeId !== node.id) {
      onConfirmMove(node.id);
      return;
    }
    if (!isSelf) {
      onSelectNode?.(node.id);
    }
  }

  function handleDoubleClick(e) {
    e.stopPropagation();
    if (isEditing) return;
    if (!isSelf) {
      onSelectNode?.(null);
      onNavigateTo?.(node.id);
    }
  }

  const rowClass = [
    "lpanel-child-row",
    depth > 0 ? "lpanel-child-row--gc" : "",
    isAnswered ? "lpanel-child-row--answered" : "",
    showActions ? "lpanel-child-row--active" : "",
    isEditing ? "lpanel-child-row--editing" : "",
    isHoveredByCanvas && !showActions ? "lpanel-child-row--hovered" : "",
    isMoveTarget ? "lpanel-child-row--move-target" : "",
    isSelf ? "lpanel-child-row--self" : "",
    draggingId === node.id ? "lpanel-child-row--dragging" : "",
    isDragOver && draggingId && draggingId !== node.id ? "lpanel-child-row--drag-over" : "",
  ].filter(Boolean).join(" ");

  const gcSharedProps = {
    selectedNodeId, hoveredNodeId, movingNodeId,
    draggingId, setDraggingId,
    onSelectNode, onExplore, onDelete, onEditAspect, onMove, onConfirmMove, onNavigateTo, onHoverNode,
    inlineAddParentId, setInlineAddParentId, inlineAddText, setInlineAddText,
    onInlineKeyDown, onInlineBlur,
    showGrandchildren: false,
  };

  return (
    <>
      <div
        className={rowClass}
        draggable={!isSelf && !isEditing && !discourseFinished}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => { setHovered(true); onHoverNode?.(node.id); }}
        onMouseLeave={() => { setHovered(false); onHoverNode?.(null); }}
        onDragStart={e => {
          if (isSelf || isEditing) { e.preventDefault(); return; }
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("nodeId", node.id);
          setDraggingId(node.id);
        }}
        onDragEnd={() => { setDraggingId(null); setIsDragOver(false); }}
        onDragOver={e => {
          if (draggingId && draggingId !== node.id) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setIsDragOver(true);
          }
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          const id = e.dataTransfer.getData("nodeId");
          if (id && id !== node.id) {
            onConfirmMove(node.id, id);
            setDraggingId(null);
          }
          setIsDragOver(false);
        }}
      >
        {isEditing ? (
          <div className="lpanel-edit-fields" onClick={e => e.stopPropagation()}>
            <input
              ref={editTitleRef}
              className="lpanel-edit-title-input"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") { e.preventDefault(); handleEditSave(); }
                if (e.key === "Escape") setIsEditing(false);
              }}
              placeholder="Aspect title"
            />
            <textarea
              className="lpanel-edit-desc-textarea"
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Escape") setIsEditing(false);
              }}
              rows={2}
              placeholder="Description (optional)"
            />
            <div className="lpanel-edit-actions">
              <button onClick={e => { e.stopPropagation(); handleEditSave(); }}>Save</button>
              <button onClick={e => { e.stopPropagation(); setIsEditing(false); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="lpanel-child-row-header">
              <span className="lpanel-child-label">{node.aspect}</span>
            </div>
            {isAnswered ? (
              <span className="lpanel-child-question">{node.description || node.answer}</span>
            ) : node.question && depth === 0 ? (
              <span className="lpanel-child-question">{node.question}</span>
            ) : null}
          </>
        )}
        {showActions && !movingNodeId && (
          <>
            <button
              className="lpanel-card-delete-btn"
              onClick={e => { e.stopPropagation(); onDelete(node.id); }}
              title="Delete"
            >✕</button>
            <div className="lpanel-action-row">
              <button
                onClick={e => { e.stopPropagation(); onExplore(node.id); }}
                disabled={exploringNodeId === node.id}
              >
                {exploringNodeId === node.id ? <span className="lpanel-spinner" /> : (node.answer ? "Explore" : "Answer")}
              </button>
              <button onClick={e => { e.stopPropagation(); setInlineAddParentId(node.id); setInlineAddText(""); }}>+ Sub-Aspect</button>
            </div>
            <button
              className="lpanel-card-edit-btn"
              title="Edit"
              onClick={e => {
                e.stopPropagation();
                setEditTitle(node.aspect);
                setEditDesc(node.answer ?? node.question ?? "");
                setIsEditing(true);
              }}
            >
              <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.5 1.5l2 2L4 10l-2.5.5.5-2.5 6.5-6.5z"/>
              </svg>
            </button>
          </>
        )}
        {isMoveTarget && (
          <button
            className="lpanel-move-here-btn"
            onClick={e => { e.stopPropagation(); onConfirmMove(node.id); }}
          >
            Move here ↵
          </button>
        )}
      </div>
      {(grandchildren.length > 0 || inlineAddParentId === node.id) && (
        <div className="lpanel-gc-list">
          {grandchildren.map(gc => (
            <NavCard key={gc.id} node={gc} depth={1} {...gcSharedProps} />
          ))}
          {inlineAddParentId === node.id && (
            <InlineAddInput
              value={inlineAddText}
              onChange={setInlineAddText}
              onKeyDown={e => onInlineKeyDown(e, node.id)}
              onBlur={() => onInlineBlur(node.id)}
              onSubmit={() => onInlineBlur(node.id)}
            />
          )}
        </div>
      )}
    </>
  );
}
