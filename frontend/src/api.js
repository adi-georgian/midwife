// The backend identifies the user from the Clerk session token. App registers a getter
// (Clerk's useAuth().getToken) here so these plain functions can attach it to requests.
let _getToken = null;
export function setTokenGetter(fn) { _getToken = fn; }

async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (_getToken) {
    try {
      const token = await _getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch { /* not signed in yet — request proceeds and backend will 401 if required */ }
  }
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try { detail = (await res.json()).detail || detail; } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export async function getMe() {
  return apiFetch("/me");
}

export async function listSessions() {
  return apiFetch("/sessions");
}

export async function getSessionState(sessionId) {
  return apiFetch(`/session/${sessionId}/state`);
}

export async function deleteSession(sessionId) {
  return apiFetch(`/session/${sessionId}`, { method: "DELETE" });
}

export async function saveViewState(sessionId, { panelTabs, discourseFinished } = {}) {
  const body = {};
  if (panelTabs !== undefined) body.panel_tabs = panelTabs;
  if (discourseFinished !== undefined) body.discourse_finished = discourseFinished;
  return apiFetch(`/session/${sessionId}/view-state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function createSession(objective, background = {}) {
  return apiFetch("/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      objective,
      mode: background.mode || "",
      knowledge_level: background.knowledgeLevel || "",
      extra_context: background.extraContext || "",
      qa_pairs: background.qaPairs || [],
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

export async function generatePanelTabs(sessionId, existingPlan = null) {
  return apiFetch(`/session/${sessionId}/generate-panel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ existing_plan: existingPlan }),
  });
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

export async function generateBriefing(sessionId) {
  return apiFetch(`/session/${sessionId}/briefing`, { method: "POST" });
}

export async function sendBriefingChat(sessionId, { message, page, currentOverview, currentIdeas, currentQuestions }) {
  return apiFetch(`/session/${sessionId}/briefing-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      page,
      current_overview: currentOverview ?? null,
      current_ideas: currentIdeas ?? null,
      current_questions: currentQuestions ?? null,
    }),
  });
}

export async function generateQuestionForAspect(sessionId, label, details = "") {
  return apiFetch(`/session/${sessionId}/generate-question`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, details }),
  });
}

export async function generateBriefingCycle(sessionId) {
  return apiFetch(`/session/${sessionId}/briefing-cycle`, { method: "POST" });
}
