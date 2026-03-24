import { useState, useEffect } from "react";
import Landing from "./components/Landing";
import DiscourseCanvas from "./components/DiscourseCanvas";
import { createSession } from "./api";
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
  const [view, setView] = useState("landing");
  const [sessionId, setSessionId] = useState(null);
  const [tree, setTree] = useState(null);
  const [objective, setObjective] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null);
  const [discourseTitle, setDiscourseTitle] = useState("");
  const [sessions, setSessions] = useState([]);
  const [background, setBackground] = useState({});

  useEffect(() => {
    const raw = localStorage.getItem("midwife_sessions");
    if (raw) {
      try { setSessions(JSON.parse(raw)); } catch {}
    } else {
      // Migrate old single-session key
      const old = localStorage.getItem("midwife_session");
      if (old) {
        try {
          const parsed = JSON.parse(old);
          const entry = {
            ...parsed,
            discourseName: parsed.objective?.split(" ").slice(0, 4).join(" ") || "",
            mode: "",
          };
          const next = [entry];
          localStorage.setItem("midwife_sessions", JSON.stringify(next));
          localStorage.removeItem("midwife_session");
          setSessions(next);
        } catch {}
      }
    }
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
  }

  function handleResumeSession(entry) {
    setSessionId(entry.sessionId);
    setObjective(entry.objective);
    setDiscourseTitle(entry.discourseName || entry.objective);
    setTree(entry.tree);
    setBackground(entry.background || {});
    setView("discourse");
  }

  function handleDeleteSession(sessionId) {
    setSessions(prev => {
      const next = prev.filter(s => s.sessionId !== sessionId);
      localStorage.setItem("midwife_sessions", JSON.stringify(next));
      return next;
    });
  }

  function handleClearAllSessions() {
    setSessions([]);
    localStorage.removeItem("midwife_sessions");
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
    } catch (err) {
      setStartError(err.message || "Something went wrong. Please try again.");
      setView("landing");
    } finally {
      setStarting(false);
    }
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
      />
    );
  }

  if (view === "loading") {
    return <LoadingCanvas objective={objective} />;
  }

  return (
    <DiscourseCanvas
      sessionId={sessionId}
      tree={tree}
      setTree={setTree}
      objective={objective}
      discourseTitle={discourseTitle}
      background={background}
      onSessionChange={upsertSession}
      onHome={() => setView("landing")}
    />
  );
}
