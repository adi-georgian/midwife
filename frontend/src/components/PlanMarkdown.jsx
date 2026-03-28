export function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  if (parts.length === 1) return text;
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("*") && p.endsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}

function renderList(items, k) {
  const result = [];
  let i = 0;
  while (i < items.length) {
    const item = items[i];
    if (item.depth === 0) {
      // Collect direct children (depth 1+), normalized down by 1
      const children = [];
      let j = i + 1;
      while (j < items.length && items[j].depth > 0) {
        children.push({ text: items[j].text, depth: items[j].depth - 1 });
        j++;
      }
      if (children.length > 0) {
        result.push(
          <li key={k.v++}>
            {renderInline(item.text)}
            {renderList(children, k)}
          </li>
        );
      } else {
        result.push(<li key={k.v++}>{renderInline(item.text)}</li>);
      }
      i = j;
    } else {
      i++;
    }
  }
  return <ul key={k.v++} className="rpanel-plan-list">{result}</ul>;
}

export default function PlanMarkdown({ content }) {
  const lines = content.split("\n");
  const elements = [];
  let pending = []; // { text, depth }
  const k = { v: 0 };

  function flush() {
    if (pending.length === 0) return;
    elements.push(renderList(pending, k));
    pending = [];
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    if (trimmed.startsWith("### ")) {
      flush();
      elements.push(<h4 key={k.v++} className="rpanel-plan-h4">{renderInline(trimmed.slice(4))}</h4>);
    } else if (trimmed.startsWith("## ")) {
      flush();
      elements.push(<h3 key={k.v++} className="rpanel-plan-h3">{renderInline(trimmed.slice(3))}</h3>);
    } else if (trimmed.startsWith("# ")) {
      flush();
      elements.push(<h2 key={k.v++} className="rpanel-plan-h2">{renderInline(trimmed.slice(2))}</h2>);
    } else if (/^[-*•] /.test(trimmed)) {
      const depth = Math.floor(indent / 2);
      pending.push({ text: trimmed.replace(/^[-*•] /, ""), depth });
    } else if (trimmed === "" || trimmed === "---") {
      flush();
    } else {
      flush();
      elements.push(<p key={k.v++} className="rpanel-plan-p">{renderInline(line)}</p>);
    }
  }
  flush();
  return <div className="rpanel-plan">{elements}</div>;
}
