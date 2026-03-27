import { Handle, Position } from "@xyflow/react";

const HANDLE_HIDDEN = { opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0 };

const POS = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
};

export default function DiscourseNode({ data }) {
  const {
    aspect,
    answer,
    is_ghost,
    is_loading,
    isRoot,
    isFocus,
    isParentPreview,
    isInterviewing,
    isGhostDisplay,
    isTerminal,
    hideAnswer,
    isDimmed,
    sourcePosition,
    targetPosition,
  } = data;

  let nodeClass = "discourse-node";
  if (isRoot) nodeClass += " discourse-node--root";
  else if (isFocus) nodeClass += " discourse-node--focus";
  else if (isParentPreview) nodeClass += " discourse-node--parent-preview";
  else if (is_loading) nodeClass += " discourse-node--loading";
  else if (is_ghost || isGhostDisplay) nodeClass += " discourse-node--ghost";
  else if (isInterviewing) nodeClass += " discourse-node--interviewing";
  else if (answer) nodeClass += " discourse-node--answered";
  else nodeClass += " discourse-node--unanswered";

  if (isDimmed) nodeClass += " discourse-node--dimmed";

  const srcPos = POS[sourcePosition] ?? Position.Bottom;
  const tgtPos = POS[targetPosition] ?? Position.Top;

  const renderHandles = () => (
    <>
      <Handle id="top" type="target" position={Position.Top} style={HANDLE_HIDDEN} />
      <Handle id="left-t" type="target" position={Position.Left} style={HANDLE_HIDDEN} />
      <Handle id="right-t" type="target" position={Position.Right} style={HANDLE_HIDDEN} />
      <Handle id="left" type="source" position={Position.Left} style={HANDLE_HIDDEN} />
      <Handle id="right" type="source" position={Position.Right} style={HANDLE_HIDDEN} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={HANDLE_HIDDEN} />
    </>
  );

  return (
    <div
      className={nodeClass}
      title={!is_ghost && !is_loading && !isGhostDisplay && aspect ? aspect : undefined}
    >
      {renderHandles()}
      {!is_loading && (
        <>
          <span className="discourse-node__label">{aspect}</span>
          {answer && !isRoot && !isFocus && isTerminal && !hideAnswer && (
            <span className="discourse-node__answer">{answer}</span>
          )}
        </>
      )}
    </div>
  );
}
