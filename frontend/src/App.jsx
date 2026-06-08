import { useState, useEffect } from "react";
import Landing from "./components/Landing";
import DiscourseCanvas from "./components/DiscourseCanvas";
import GuideWindow from "./components/GuideWindow";
import { createSession, generateBriefing, generateBriefingCycle, sendBriefingChat, addAspect, deleteAspect, updateAspect, getMe, listSessions, getSessionState, deleteSession, saveViewState } from "./api";
import { toTitleCase } from "./utils";

function LoadingCanvas({ objective }) {
  return (
    <div className="loading-screen">
      <span className="loading-screen__brand">midWife</span>
      <p className="loading-screen__objective">{objective}</p>
      <div className="loading-screen__dots">
        <span /><span /><span />
      </div>
      <p className="loading-screen__label">Setting up your session…</p>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("midwife_theme") || "sepia");
  const [view, setView] = useState("landing");
  const [sessionId, setSessionId] = useState(null);
  const [tree, setTree] = useState(null);
  const [objective, setObjective] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null);
  const [discourseTitle, setDiscourseTitle] = useState("");
  const [sessions, setSessions] = useState([]);
  const [userEmail, setUserEmail] = useState("");
  const [background, setBackground] = useState({});

  // Briefing (Guide Window) state
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [briefingCycle, setBriefingCycle] = useState(0);
  const [briefingData, setBriefingData] = useState(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [briefingRetryCount, setBriefingRetryCount] = useState(0);
  const [initialInterviewQueue, setInitialInterviewQueue] = useState(null);
  // True once the user has confirmed the briefing for the first time — gates canvas mount
  const [discourseReady, setDiscourseReady] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("theme-dark", theme === "dark");
    localStorage.setItem("midwife_theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(t => t === "dark" ? "sepia" : "dark");
  }

  // On load, the server is the source of truth for which canvases are *yours*.
  // The browser's localStorage is kept only as a cache of rich view-state (the tree
  // thumbnail, plan tabs, etc.) so that resuming on the same machine is instant.
  useEffect(() => {
    let cancelled = false;

    let cache = [];
    try { cache = JSON.parse(localStorage.getItem("midwife_sessions") || "[]"); } catch {}
    const cacheById = Object.fromEntries(cache.map(s => [s.sessionId, s]));

    getMe().then(d => { if (!cancelled) setUserEmail(d.email); }).catch(() => {});

    listSessions().then(({ sessions: server }) => {
      if (cancelled) return;
      const merged = (server || []).map(s => {
        const cached = cacheById[s.session_id];
        const savedAt = s.updated_at ? new Date(s.updated_at).getTime() : (cached?.savedAt || Date.now());
        return {
          sessionId: s.session_id,
          objective: s.objective,
          discourseName: s.discourse_name || cached?.discourseName || "",
          savedAt,
          // Rich fields from the local cache (absent → resume fetches from server).
          tree: cached?.tree || null,
          background: cached?.background,
          panelTabs: cached?.panelTabs,
          discourseFinished: cached?.discourseFinished,
          mode: cached?.mode,
        };
      });
      setSessions(merged);
    }).catch(() => {
      // Backend unreachable (e.g. running without API keys) — fall back to the
      // local cache so local development isn't blocked.
      if (!cancelled) setSessions(cache);
    });

    return () => { cancelled = true; };
  }, []);

  function upsertSession(patch) {
    setSessions(prev => {
      const idx = prev.findIndex(s => s.sessionId === patch.sessionId);
      let next;
      if (idx === -1) {
        next = [patch, ...prev].slice(0, 20);
      } else {
        const merged = { ...prev[idx], ...patch };
        next = [merged, ...prev.filter((_, i) => i !== idx)].slice(0, 20);
      }
      localStorage.setItem("midwife_sessions", JSON.stringify(next));
      return next;
    });
    // Persist view-state (plan tabs / finished flag) to the server too, so the whole
    // canvas — not just its question tree — follows the user across devices.
    if (patch.sessionId && ("panelTabs" in patch || "discourseFinished" in patch)) {
      saveViewState(patch.sessionId, {
        ...("panelTabs" in patch ? { panelTabs: patch.panelTabs } : {}),
        ...("discourseFinished" in patch ? { discourseFinished: patch.discourseFinished } : {}),
      }).catch(() => {});
    }
  }

  const [resumePanelTabs, setResumePanelTabs] = useState(null);
  const [resumeDiscourseFinished, setResumeDiscourseFinished] = useState(false);

  async function handleResumeSession(entry) {
    let data = entry;
    // If this browser doesn't have the canvas cached, load it from the server.
    if (!entry.tree) {
      try {
        const s = await getSessionState(entry.sessionId);
        data = {
          ...entry,
          objective: s.objective,
          discourseName: s.discourse_name || entry.discourseName,
          tree: s.root,
          background: s.background || {},
          panelTabs: (s.panel_tabs && s.panel_tabs.length) ? s.panel_tabs : entry.panelTabs,
          discourseFinished: s.discourse_finished ?? entry.discourseFinished,
        };
      } catch {
        setStartError("Couldn't load that canvas. Please try again.");
        return;
      }
    }
    setSessionId(data.sessionId);
    setObjective(data.objective);
    setDiscourseTitle(data.discourseName || data.objective);
    setTree(data.tree);
    setBackground(data.background || {});
    setResumePanelTabs(data.panelTabs || null);
    setResumeDiscourseFinished(data.discourseFinished || false);
    setDiscourseReady(true);
    setView("discourse");
  }

  function handleDeleteSession(sessionId) {
    deleteSession(sessionId).catch(() => {});  // remove server-side too
    setSessions(prev => {
      const next = prev.filter(s => s.sessionId !== sessionId);
      localStorage.setItem("midwife_sessions", JSON.stringify(next));
      return next;
    });
  }

  function handleClearAllSessions() {
    if (!window.confirm("Delete all of your canvases? This cannot be undone.")) return;
    sessions.forEach(s => deleteSession(s.sessionId).catch(() => {}));
    setSessions([]);
    localStorage.removeItem("midwife_sessions");
  }

  function fetchBriefingContent(sid, currentTree) {
    generateBriefing(sid).then(result => {
      const rationales = result.aspect_rationales || [];
      // Build name→rationale map for fallback matching
      const rationaleMap = {};
      for (const r of rationales) {
        rationaleMap[r.aspect_name.toLowerCase()] = r.rationale;
      }
      const aspectItems = (currentTree.children || []).map((c, i) => ({
        ...c,
        // Index-based first (order preserved), then name-based fallback
        rationale: rationales[i]?.rationale || rationaleMap[c.aspect.toLowerCase()] || "",
      }));
      setBriefingData({ overview_prose: result.overview_prose, aspect_items: aspectItems });
      setIsBriefingLoading(false);
    }).catch(() => {
      setBriefingData(prev => ({ ...(prev || {}), overview_prose: null, aspect_items: null }));
      setIsBriefingLoading(false);
    });
  }

  function handleRetryBriefingOverview() {
    if (!sessionId || !tree) return;
    setBriefingRetryCount(c => c + 1);
    setBriefingData(prev => ({ ...(prev || {}), overview_prose: null }));
    setIsBriefingLoading(true);
    fetchBriefingContent(sessionId, tree);
  }

  async function handleStart(obj, bg = {}) {
    if (starting) return;
    setStarting(true);
    setStartError(null);
    setObjective(obj);
    setBackground(bg);
    setView("loading");
    try {
      const data = await createSession(obj, bg);
      setSessionId(data.session_id);
      const title = toTitleCase(data.discourse_name || obj.split(" ").slice(0, 4).join(" "));
      setDiscourseTitle(title);
      const initialTree = {
        id: "root",
        aspect: title,
        question: obj,
        suggestions: [],
        answer: null,
        children: data.aspects.map(a => ({ ...a, aspect: toTitleCase(a.aspect) })),
      };
      setTree(initialTree);
      upsertSession({
        sessionId: data.session_id,
        objective: obj,
        discourseName: title,
        tree: initialTree,
        mode: bg.mode || "",
        background: bg,
        savedAt: Date.now(),
      });
      setView("discourse");
      setDiscourseReady(false);
      setResumePanelTabs(null);
      setResumeDiscourseFinished(false);
      // Open briefing window and load content asynchronously
      setBriefingCycle(0);
      setBriefingData(null);
      setInitialInterviewQueue(null);
      setBriefingOpen(true);
      setIsBriefingLoading(true);
      fetchBriefingContent(data.session_id, initialTree);
    } catch (err) {
      setStartError(err.message || "Something went wrong. Please try again.");
      setView("landing");
    } finally {
      setStarting(false);
    }
  }

  async function handleBriefingConfirm(finalAspects) {
    if (!discourseReady) {
      // Cycle 0: null means "keep all aspects as-is" (aspects page was skipped)
      if (finalAspects === null) {
        setBriefingOpen(false);
        setDiscourseReady(true);
        return;
      }
      // Reconcile against original tree children
      const originalIds = new Set((tree?.children || []).map(c => c.id));
      const removedOnes = (tree?.children || []).filter(c => !finalAspects.find(a => a.id === c.id));
      const renamedOnes = finalAspects.filter(a => a._edited && originalIds.has(a.id));
      const newOnes = finalAspects.filter(a => !originalIds.has(a.id));

      if (sessionId) {
        await Promise.all(removedOnes.map(a => deleteAspect(sessionId, a.id).catch(() => {})));
        await Promise.all(renamedOnes.map(a => updateAspect(sessionId, a.id, { aspect: a.aspect, question: a.question }).catch(() => {})));
      }
      const addedNodes = sessionId
        ? (await Promise.all(newOnes.map(a =>
            addAspect(sessionId, "root", { aspect: a.aspect, question: a.question || "", suggestions: [] }).catch(() => null)
          ))).filter(Boolean).map(r => r.aspect || r).filter(Boolean)
        : [];

      setTree(prev => {
        const kept = (prev.children || [])
          .filter(c => !removedOnes.find(r => r.id === c.id))
          .map(c => { const ren = renamedOnes.find(r => r.id === c.id); return ren ? { ...c, aspect: ren.aspect, question: ren.question } : c; });
        return { ...prev, children: [...kept, ...addedNodes] };
      });
      setBriefingOpen(false);
      setDiscourseReady(true);
    } else {
      // Cycle 1+: add new suggested aspects
      const addedNodes = sessionId
        ? (await Promise.all(finalAspects.map(a =>
            addAspect(sessionId, "root", { aspect: a.aspect, question: a.question || "", suggestions: [] }).catch(() => null)
          ))).filter(Boolean).map(r => r.aspect || r).filter(Boolean)
        : [];
      if (addedNodes.length > 0) {
        setTree(prev => ({ ...prev, children: [...(prev.children || []), ...addedNodes] }));
      }
      setBriefingOpen(false);
    }
  }

  async function handleContinueExploring(planContent = "") {
    setBriefingData({ overview_prose: planContent, aspect_items: null });
    setIsBriefingLoading(true);
    setBriefingCycle(c => c + 1);
    setBriefingOpen(true);
    if (sessionId) {
      generateBriefingCycle(sessionId).then(result => {
        const aspects = result.aspects || [];
        setBriefingData(prev => ({ ...prev, aspect_items: aspects.length > 0 ? aspects : null }));
        setIsBriefingLoading(false);
      }).catch(() => {
        setBriefingData(prev => ({ ...prev, aspect_items: null }));
        setIsBriefingLoading(false);
      });
    }
  }

  function handleRetryBriefingCycle() {
    if (!sessionId) return;
    setBriefingRetryCount(c => c + 1);
    setBriefingData(prev => ({ ...prev, aspect_items: null }));
    setIsBriefingLoading(true);
    generateBriefingCycle(sessionId).then(result => {
      const aspects = result.aspects || [];
      setBriefingData(prev => ({ ...prev, aspect_items: aspects.length > 0 ? aspects : null }));
      setIsBriefingLoading(false);
    }).catch(() => {
      setBriefingData(prev => ({ ...prev, aspect_items: null }));
      setIsBriefingLoading(false);
    });
  }

  function handleFinishPlanning() {
    // Discourse is now frozen — DiscourseCanvas handles the visual state
  }

  async function handleBriefingChatUpdate(message, page, { currentOverview, currentIdeas, currentQuestions }) {
    if (!sessionId) return { acknowledgment: "" };
    return sendBriefingChat(sessionId, {
      message,
      page,
      currentOverview: currentOverview || null,
      currentIdeas: currentIdeas || null,
      currentQuestions: currentQuestions || null,
    });
  }

  if (view === "landing") {
    return (
      <Landing
        onStart={handleStart}
        disabled={starting}
        error={startError}
        sessions={sessions}
        onResume={handleResumeSession}
        onDeleteSession={handleDeleteSession}
        onClearAllSessions={handleClearAllSessions}
        theme={theme}
        onToggleTheme={toggleTheme}
        userEmail={userEmail}
      />
    );
  }

  if (view === "loading") {
    return <LoadingCanvas objective={objective} />;
  }

  return (
    <>
      {/* Empty canvas background shown during the initial briefing */}
      {!discourseReady && <div className="empty-canvas-bg" />}

      {/* Discourse canvas — only mounted after first briefing confirm */}
      {discourseReady && (
        <DiscourseCanvas
          sessionId={sessionId}
          tree={tree}
          setTree={setTree}
          objective={objective}
          discourseTitle={discourseTitle}
          background={background}
          onSessionChange={upsertSession}
          onHome={() => setView("landing")}
          initialInterviewQueue={initialInterviewQueue}
          onFinishPlanning={handleFinishPlanning}
          theme={theme}
          onThemeChange={setTheme}
          initialPanelTabs={resumePanelTabs}
          initialDiscourseFinished={resumeDiscourseFinished}
        />
      )}

      {briefingOpen && (
        <GuideWindow
          key={`${briefingCycle}-${briefingRetryCount}`}
          cycle={briefingCycle}
          overviewProse={briefingData?.overview_prose || null}
          aspectItems={briefingData?.aspect_items || []}
          isLoading={isBriefingLoading}
          onChatUpdate={handleBriefingChatUpdate}
          onConfirm={handleBriefingConfirm}
          onDismiss={() => setBriefingOpen(false)}
          onRetryAspects={briefingCycle > 0 ? handleRetryBriefingCycle : undefined}
          onRetryOverview={briefingCycle === 0 ? handleRetryBriefingOverview : undefined}
          sessionId={sessionId}
        />
      )}
    </>
  );
}
