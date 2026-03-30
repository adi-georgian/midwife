import { useState, useEffect } from "react";
import PlanMarkdown from "./PlanMarkdown";

export function planToMarkdown(plan) {
  if (!plan || !plan.sections) return "";
  const lines = [];
  if (plan.title) lines.push(`# ${plan.title}`, "");
  for (const section of plan.sections) {
    lines.push(`## ${section.title}`, "");
    for (const item of section.items || []) {
      if (section.type === "tasks") {
        lines.push(`- [ ] ${item.text}`);
      } else if (section.type === "timeline") {
        lines.push(`- **${item.phase}**: ${item.label}`);
      } else {
        lines.push(`- ${item.text || item.label || ""}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function diffItemClass(status) {
  if (status === "added") return " iplan-diff-added";
  if (status === "removed") return " iplan-diff-removed";
  if (status === "modified") return " iplan-diff-modified";
  return "";
}

function TaskSection({ section, sessionId, muted }) {
  const storageKey = (id) => `plan:${sessionId}:${id}`;

  const [checked, setChecked] = useState(() => {
    const init = {};
    for (const item of section.items || []) {
      try { init[item.id] = localStorage.getItem(storageKey(item.id)) === "1"; } catch { init[item.id] = false; }
    }
    return init;
  });

  function toggle(id) {
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(storageKey(id), next[id] ? "1" : "0"); } catch {}
      return next;
    });
  }

  return (
    <div className={`iplan-section iplan-tasks${muted ? " iplan-section--muted" : ""}${diffItemClass(section._diffStatus)}`}>
      <div className="iplan-section-title">{section.title}</div>
      <ul className="iplan-task-list">
        {(section.items || []).map(item => (
          <li key={item.id} className={`iplan-task-item${checked[item.id] ? " iplan-task-item--done" : ""}${diffItemClass(item._diffStatus)}`}>
            {item._diffStatus !== "removed" && (
              <input
                type="checkbox"
                className="iplan-checkbox"
                checked={!!checked[item.id]}
                onChange={() => toggle(item.id)}
                id={`task-${item.id}`}
                disabled={!!item._diffStatus}
              />
            )}
            <label htmlFor={`task-${item.id}`} className="iplan-task-label">
              {item._diffStatus === "modified" && item._oldText && (
                <span className="iplan-diff-old">{item._oldText}</span>
              )}
              {item.text}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TimelineSection({ section, sessionId, muted }) {
  const storageKey = (id) => `plan:${sessionId}:${id}`;

  const [checked, setChecked] = useState(() => {
    const init = {};
    for (const item of section.items || []) {
      try { init[item.id] = localStorage.getItem(storageKey(item.id)) === "1"; } catch { init[item.id] = false; }
    }
    return init;
  });

  function toggle(id) {
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(storageKey(id), next[id] ? "1" : "0"); } catch {}
      return next;
    });
  }

  return (
    <div className={`iplan-section iplan-timeline-section${muted ? " iplan-section--muted" : ""}${diffItemClass(section._diffStatus)}`}>
      <div className="iplan-section-title">{section.title}</div>
      <div className="iplan-timeline">
        {(section.items || []).map((item, idx) => (
          <div key={item.id} className={`iplan-timeline-item${checked[item.id] ? " iplan-timeline-item--done" : ""}${diffItemClass(item._diffStatus)}`}>
            <div className="iplan-timeline-left">
              <div className={`iplan-timeline-dot${checked[item.id] ? " iplan-timeline-dot--done" : ""}`}
                onClick={() => item._diffStatus !== "removed" && toggle(item.id)} />
              {idx < section.items.length - 1 && <div className="iplan-timeline-line" />}
            </div>
            <div className="iplan-timeline-right">
              <span className="iplan-timeline-phase">
                {item._diffStatus === "modified" && item._oldPhase && (
                  <span className="iplan-diff-old">{item._oldPhase}</span>
                )}
                {item.phase}
              </span>
              <span className={`iplan-timeline-label${checked[item.id] ? " iplan-timeline-label--done" : ""}`}>
                {item._diffStatus === "modified" && item._oldText && !item._oldPhase && (
                  <span className="iplan-diff-old">{item._oldText}</span>
                )}
                {item.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListSection({ section, className, muted }) {
  return (
    <div className={`iplan-section ${className}${muted ? " iplan-section--muted" : ""}${diffItemClass(section._diffStatus)}`}>
      <div className="iplan-section-title">{section.title}</div>
      <ul className="iplan-list">
        {(section.items || []).map(item => (
          <li key={item.id} className={`iplan-list-item${diffItemClass(item._diffStatus)}`}>
            {item._diffStatus === "modified" && item._oldText && (
              <span className="iplan-diff-old">{item._oldText}</span>
            )}
            {item.text || item.label || ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function InteractivePlan({ content, sessionId, muted = false }) {
  let plan = null;
  try {
    if (content && !content.trimStart().startsWith("#")) {
      plan = JSON.parse(content);
    }
  } catch {}

  if (!plan || !plan.sections) {
    return <PlanMarkdown content={content || ""} />;
  }

  return (
    <div className={`iplan${muted ? " iplan--muted" : ""}`}>
      {plan.title && <h2 className="iplan-title">{plan.title}</h2>}
      {plan.sections.map(section => {
        if (section.type === "tasks") {
          return <TaskSection key={section.type} section={section} sessionId={sessionId} muted={muted} />;
        }
        if (section.type === "timeline") {
          return <TimelineSection key={section.type} section={section} sessionId={sessionId} muted={muted} />;
        }
        if (section.type === "watchout") {
          return <ListSection key={section.type} section={section} className="iplan-watchout" muted={muted} />;
        }
        if (section.type === "questions") {
          return <ListSection key={section.type} section={section} className="iplan-questions" muted={muted} />;
        }
        return null;
      })}
    </div>
  );
}
