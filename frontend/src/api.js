async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try { detail = (await res.json()).detail || detail; } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export async function createSession(objective, background = {}) {
  return apiFetch("/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      objective,
      mode: background.mode || "",
      help_level: background.helpLevel || "",
      prior_knowledge: background.priorKnowledge || "",
      already_planned: background.alreadyPlanned || "",
      constraints: background.constraints || "",
      knowledge_level: background.knowledgeLevel || "",
      extra_context: background.extraContext || "",
    }),
  });
}

export async function answerAspect(sessionId, aspectId, answer, description = null) {
  return apiFetch(`/session/${sessionId}/answer/${aspectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer, ...(description !== null ? { description } : {}) }),
  });
}

export async function elaborateAspect(sessionId, aspectId) {
  return apiFetch(`/session/${sessionId}/elaborate/${aspectId}`, {
    method: "POST",
  });
}

export async function addAspect(sessionId, parentId, aspectDef) {
  return apiFetch(`/session/${sessionId}/add-aspect/${parentId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(aspectDef),
  });
}

export async function getTree(sessionId) {
  return apiFetch(`/session/${sessionId}/tree`);
}

export async function prefetchChildren(sessionId, aspectIds) {
  return apiFetch(`/session/${sessionId}/prefetch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ aspect_ids: aspectIds }),
  });
}

export async function revealChildren(sessionId, aspectId) {
  return apiFetch(`/session/${sessionId}/reveal/${aspectId}`, {
    method: "POST",
  });
}

export async function labelChat(messages) {
  return apiFetch("/label-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
}

export async function sendChatMessage(sessionId, messages, aspectContext = null, tabContext = null) {
  return apiFetch(`/session/${sessionId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, aspect_context: aspectContext, tab_context: tabContext }),
  });
}

export async function generatePanelTabs(sessionId) {
  return apiFetch(`/session/${sessionId}/generate-panel`, { method: "POST" });
}

export async function updateAspect(sessionId, aspectId, fields) {
  return apiFetch(`/session/${sessionId}/aspect/${aspectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

export async function deleteAspect(sessionId, aspectId) {
  return apiFetch(`/session/${sessionId}/aspect/${aspectId}`, {
    method: "DELETE",
  });
}

export async function moveAspect(sessionId, aspectId, newParentId) {
  return apiFetch(`/session/${sessionId}/move-aspect/${aspectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ new_parent_id: newParentId }),
  });
}

export async function recontextualizeAspect(sessionId, aspectId) {
  return apiFetch(`/session/${sessionId}/recontextualize/${aspectId}`, {
    method: "POST",
  });
}

export async function generateAspectsForLabel(sessionId, parentId, label, details) {
  return apiFetch(`/session/${sessionId}/generate-aspects/${parentId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, details: details || "" }),
  });
}
