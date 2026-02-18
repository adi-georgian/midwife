export async function createSession(objective) {
  const res = await fetch("/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ objective }),
  });
  return res.json();
}

export async function answerAspect(sessionId, aspectId, answer) {
  const res = await fetch(`/session/${sessionId}/answer/${aspectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer }),
  });
  return res.json();
}

export async function elaborateAspect(sessionId, aspectId) {
  const res = await fetch(`/session/${sessionId}/elaborate/${aspectId}`, {
    method: "POST",
  });
  return res.json();
}

export async function getTree(sessionId) {
  const res = await fetch(`/session/${sessionId}/tree`);
  return res.json();
}
