export default function TreeNode({ node, onSelect, selectedId }) {
  const isAnswered = node.answer !== null && node.answer !== undefined;
  const isSelected = node.id === selectedId;
  const isRoot = node.id === "root";

  let className = "tree-node-label";
  if (isRoot) className += " root";
  else if (isAnswered) className += " answered";
  else className += " unanswered";
  if (isSelected) className += " selected";

  return (
    <div className="tree-node">
      <div
        className={className}
        onClick={() => !isRoot && onSelect(node)}
      >
        {node.aspect}
        {isAnswered && !isRoot && (
          <span className="answer-badge" title={node.answer}>✓</span>
        )}
      </div>
      {node.children && node.children.length > 0 && (
        <div className="tree-children">
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
