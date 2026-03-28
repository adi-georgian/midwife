export function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p
  );
}

export default function PlanMarkdown({ content }) {
  const lines = content.split("\n");
  const elements = [];
  let listItems = [];
  let key = 0;

  function flush() {
    if (listItems.length > 0) {
      elements.push(<ul key={key++} className="rpanel-plan-list">{[...listItems]}</ul>);
      listItems = [];
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trimStart();
    if (trimmed.startsWith("### ")) {
      flush();
      elements.push(<h4 key={key++} className="rpanel-plan-h4">{renderInline(trimmed.slice(4))}</h4>);
    } else if (trimmed.startsWith("## ")) {
      flush();
      elements.push(<h3 key={key++} className="rpanel-plan-h3">{renderInline(trimmed.slice(3))}</h3>);
    } else if (trimmed.startsWith("# ")) {
      flush();
      elements.push(<h2 key={key++} className="rpanel-plan-h2">{renderInline(trimmed.slice(2))}</h2>);
    } else if (/^[-*•] /.test(trimmed)) {
      listItems.push(<li key={key++}>{renderInline(trimmed.replace(/^[-*•] /, ""))}</li>);
    } else if (trimmed === "") {
      flush();
    } else {
      flush();
      elements.push(<p key={key++} className="rpanel-plan-p">{renderInline(line)}</p>);
    }
  }
  flush();
  return <div className="rpanel-plan">{elements}</div>;
}
