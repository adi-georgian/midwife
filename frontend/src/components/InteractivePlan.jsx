import { useState, useEffect } from "react";
import PlanMarkdown from "./PlanMarkdown";

function itemsToMarkdown(items, depth, type) {
  const lines = [];
  const indent = "  ".repeat(depth);
  for (const item of items || []) {
    if (type === "tasks") {
      lines.push(`${indent}- [ ] ${item.text}`);
    } else if (type === "timeline") {
      lines.push(`${indent}- **${item.phase}**: ${item.label}`);
    } else {
      lines.push(`${indent}- ${item.text || item.label || ""}`);
    }
    if (item.children?.length) {
      lines.push(...itemsToMarkdown(item.children, depth + 1, type));
    }
  }
  return lines;
}

export function planToMarkdown(plan) {
  if (!plan || !plan.sections) return "";
  const lines = [];
  if (plan.title) lines.push(`# ${plan.title}`, "");
  for (const section of plan.sections) {
    lines.push(`## ${section.title}`, "");
    lines.push(...itemsToMarkdown(section.items, 0, section.type));
    lines.push("");
  }
  return lines.join("\n");
}

function flatItems(items) {
  const result = [];
  for (const item of items || []) {
    result.push(item);
    if (item.children?.length) result.push(...flatItems(item.children));
  }
  return result;
}

function diffItemClass(status) {
  if (status === "added") return " iplan-diff-added";
  if (status === "removed") return " iplan-diff-removed";
  if (status === "modified") return " iplan-diff-modified";
  return "";
}

function TaskItem({ item, storageKey, checked, toggle, nested }) {
  return (
    <li className={`iplan-task-item${nested ? " iplan-task-item--nested" : ""}${checked[item.id] ? " iplan-task-item--done" : ""}${diffItemClass(item._diffStatus)}`}>
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
      {(item.children || []).length > 0 && (
        <ul className="iplan-task-list iplan-task-list--nested">
          {item.children.map(child => (
            <TaskItem key={child.id} item={child} storageKey={storageKey} checked={checked} toggle={toggle} nested />
          ))}
        </ul>
      )}
    </li>
  );
}

function TaskSection({ section, sessionId, muted }) {
  const storageKey = (id) => `plan:${sessionId}:${id}`;

  const [checked, setChecked] = useState(() => {
    const init = {};
    for (const item of flatItems(section.items)) {
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
          <TaskItem key={item.id} item={item} storageKey={storageKey} checked={checked} toggle={toggle} />
        ))}
      </ul>
    </div>
  );
}

function TimelineSection({ section, sessionId, muted }) {
  const storageKey = (id) => `plan:${sessionId}:${id}`;

  const [checked, setChecked] = useState(() => {
    const init = {};
    for (const item of flatItems(section.items)) {
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
              {(item.children || []).length > 0 && (
                <ul className="iplan-timeline-children">
                  {item.children.map((child, cidx) => (
                    <li key={child.id} className={`iplan-timeline-child${checked[child.id] ? " iplan-timeline-child--done" : ""}`}>
                      <div className="iplan-timeline-child-left">
                        <div
                          className={`iplan-timeline-child-dot${checked[child.id] ? " iplan-timeline-child-dot--done" : ""}`}
                          onClick={() => toggle(child.id)}
                        />
                        {cidx < item.children.length - 1 && <div className="iplan-timeline-child-line" />}
                      </div>
                      <span className="iplan-timeline-child-label" onClick={() => toggle(child.id)}>
                        {child.label || child.text || ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
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
