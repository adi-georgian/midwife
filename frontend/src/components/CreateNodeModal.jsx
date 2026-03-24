import { useEffect, useRef } from "react";
import { useState } from "react";

export default function CreateNodeModal({ parentAspect, onSubmit, onClose, mode = "add-child" }) {
  const [aspect, setAspect] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!aspect.trim()) return;
    onSubmit({ aspect: aspect.trim(), generate: true });
  }

  const isAddAspect = mode === "add-aspect";

  return (
    <div className="create-node-modal-overlay">
      <div className="create-node-modal">
        <h3>
          {isAddAspect
            ? "Add New Aspect"
            : `Add child node${parentAspect ? ` under "${parentAspect}"` : ""}`}
        </h3>
        <form onSubmit={handleSubmit}>
          <label>
            Aspect label
            <input
              ref={inputRef}
              value={aspect}
              onChange={e => setAspect(e.target.value)}
              placeholder={isAddAspect ? "e.g. My Budget" : "e.g. Budget Planning"}
            />
          </label>
          <div className="create-node-modal__actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={!aspect.trim()}>
              {isAddAspect ? "Add Aspect" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
