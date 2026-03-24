const SVG_W = 200;
const SVG_H = 120;
const PAD = 12;
const H_STEP = 60;
const V_STEP = 30;

function formatRelativeDate(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function computeThumbnailLayout(tree) {
  const items = [];

  function dfs(node, depth, yCenter) {
    const children = (node.children || []).filter(c => !c.is_ghost && !c.is_loading);
    items.push({
      id: node.id,
      x: depth * H_STEP,
      y: yCenter,
      isRoot: node.id === "root",
      isAnswered: !!node.answer,
    });
    if (children.length === 0) return;
    const totalSpan = children.length * V_STEP;
    let childY = yCenter - (totalSpan - V_STEP) / 2;
    for (const child of children) {
      const grandchildren = (child.children || []).filter(c => !c.is_ghost && !c.is_loading);
      const childSpan = Math.max(1, grandchildren.length) * V_STEP;
      dfs(child, depth + 1, childY + childSpan / 2 - V_STEP / 2);
      childY += Math.max(V_STEP, childSpan);
    }
  }

  if (tree) dfs(tree, 0, 0);
  return items;
}

function normalizeToBounds(items) {
  if (items.length === 0) return items;
  if (items.length === 1) {
    return [{ ...items[0], nx: SVG_W / 2, ny: SVG_H / 2 }];
  }
  const xs = items.map(n => n.x);
  const ys = items.map(n => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scaleX = (SVG_W - 2 * PAD) / rangeX;
  const scaleY = (SVG_H - 2 * PAD) / rangeY;
  const scale = Math.min(scaleX, scaleY);
  const cx = (SVG_W - rangeX * scale) / 2;
  const cy = (SVG_H - rangeY * scale) / 2;
  return items.map(n => ({
    ...n,
    nx: (n.x - minX) * scale + cx,
    ny: (n.y - minY) * scale + cy,
  }));
}

function collectEdges(tree) {
  const edges = [];
  function dfs(node) {
    for (const child of (node.children || []).filter(c => !c.is_ghost && !c.is_loading)) {
      edges.push({ from: node.id, to: child.id });
      dfs(child);
    }
  }
  if (tree) dfs(tree);
  return edges;
}

function ThumbnailSVG({ tree }) {
  if (!tree) return <div className="history-card-thumbnail" />;

  const rawItems = computeThumbnailLayout(tree);
  const items = normalizeToBounds(rawItems);
  const edges = collectEdges(tree);
  const posMap = Object.fromEntries(items.map(n => [n.id, n]));

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width="100%"
      height="100%"
      style={{ display: "block" }}
    >
      {edges.map(({ from, to }) => {
        const src = posMap[from];
        const tgt = posMap[to];
        if (!src || !tgt) return null;
        return (
          <line
            key={`${from}-${to}`}
            x1={src.nx} y1={src.ny}
            x2={tgt.nx} y2={tgt.ny}
            stroke="var(--border)"
            strokeWidth={1}
          />
        );
      })}
      {items.map(n => {
        const r = n.isRoot ? 7 : 5;
        let fill, stroke;
        if (n.isRoot) {
          fill = "var(--accent-bg)";
          stroke = "var(--accent-bg)";
        } else if (n.isAnswered) {
          fill = "var(--chip-sel-bg)";
          stroke = "var(--chip-sel-border)";
        } else {
          fill = "var(--surface)";
          stroke = "var(--border)";
        }
        return (
          <circle
            key={n.id}
            cx={n.nx}
            cy={n.ny}
            r={r}
            fill={fill}
            stroke={stroke}
            strokeWidth={1.2}
          />
        );
      })}
    </svg>
  );
}

function SessionCard({ session, onResume, onDelete }) {
  return (
    <div className="history-card">
      <button
        className="history-card-delete"
        onClick={e => { e.stopPropagation(); onDelete(session.sessionId); }}
        title="Delete"
      >
        ×
      </button>
      <button className="history-card-inner" onClick={() => onResume(session)}>
        <div className="history-card-thumbnail">
          <ThumbnailSVG tree={session.tree} />
        </div>
        <div className="history-card-footer">
          <span className="history-card-title">
            {session.discourseName || session.objective?.slice(0, 40) || "Untitled"}
          </span>
          <span className="history-card-date">{formatRelativeDate(session.savedAt)}</span>
        </div>
      </button>
    </div>
  );
}

export default function HistoryPanel({ open, sessions, onResume, onDelete, onClearAll, onClose }) {
  return (
    <div className={`history-panel${open ? " history-panel--open" : ""}`}>
      <div className="history-panel-header">
        <span className="history-panel-title">Discourses</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {sessions.length > 0 && (
            <button className="history-panel-clear" onClick={onClearAll} title="Clear all">
              Clear All
            </button>
          )}
          <button className="history-panel-close" onClick={onClose} title="Close">✕</button>
        </div>
      </div>
      <div className="history-panel-list">
        {sessions.length === 0
          ? <p className="history-panel-empty">No past discourses yet.</p>
          : sessions.map(s => (
              <SessionCard
                key={s.sessionId}
                session={s}
                onResume={onResume}
                onDelete={onDelete}
              />
            ))
        }
      </div>
    </div>
  );
}
