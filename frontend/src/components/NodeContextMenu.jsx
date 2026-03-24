import { useEffect, useRef } from "react";

export default function NodeContextMenu({ node, x, y, onExplore, onAddChild, onDelete, onMove, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    function handleMouseDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [onClose]);

  const childCount = (node?.children || []).filter(c => !c.is_ghost && !c.is_loading).length;

  return (
    <div ref={menuRef} className="node-context-menu" style={{ left: x, top: y }}>
      <button onClick={() => { onClose(); onExplore(node.id); }}>Flesh Out</button>
      <button onClick={() => { onClose(); onAddChild(node.id); }}>Add child</button>
      <button onClick={() => { onClose(); onMove(node.id); }}>Move</button>
      <button
        className="node-context-menu__delete"
        onClick={() => onDelete(node.id)}
      >
        {childCount > 0 ? `Delete (+ ${childCount} children)` : "Delete"}
      </button>
    </div>
  );
}
