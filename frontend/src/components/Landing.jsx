import { useState } from "react";

export default function Landing({ onStart }) {
  const [text, setText] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (text.trim()) onStart(text.trim());
  }

  return (
    <div className="landing">
      <h1>Midwife</h1>
      <p>What's your objective?</p>
      <form onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="e.g. Plan a Christmas party for 50 people..."
          rows={4}
        />
        <button type="submit" disabled={!text.trim()}>
          Begin
        </button>
      </form>
    </div>
  );
}
