import { useState } from "react";

export default function RepurposingModal({ changes, onConfirm, onSkip }) {
  const [approved, setApproved] = useState(new Set(changes.map(c => c.id)));

  function toggle(id) {
    setApproved(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="create-node-modal-overlay">
      <div className="create-node-modal repurposing-modal">
        <h3>Suggested Relabelings</h3>
        <p className="repurposing-modal__subtitle">
          Based on your answers, Midwife suggests updating these aspect labels:
        </p>
        <div className="repurposing-modal__list">
          {changes.map(c => (
            <label key={c.id} className="repurposing-modal__row">
              <input
                type="checkbox"
                checked={approved.has(c.id)}
                onChange={() => toggle(c.id)}
              />
              <span className="repurposing-modal__old">{c.oldLabel}</span>
              <span className="repurposing-modal__arrow">→</span>
              <span className="repurposing-modal__new">{c.newLabel}</span>
            </label>
          ))}
        </div>
        <div className="create-node-modal__actions">
          <button type="button" onClick={onSkip}>Skip All</button>
          <button
            type="button"
            onClick={() => onConfirm(approved)}
            disabled={approved.size === 0}
          >
            Apply Selected ({approved.size})
          </button>
        </div>
      </div>
    </div>
  );
}
