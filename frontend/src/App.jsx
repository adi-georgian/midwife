import { useState } from "react";
import Landing from "./components/Landing";
import TreeCanvas from "./components/TreeCanvas";
import { createSession } from "./api";

export default function App() {
  const [view, setView] = useState("landing");
  const [sessionId, setSessionId] = useState(null);
  const [tree, setTree] = useState(null);
  const [objective, setObjective] = useState("");

  async function handleStart(obj) {
    const data = await createSession(obj);
    setObjective(obj);
    setSessionId(data.session_id);
    // Build the tree: root with the returned aspects as children
    setTree({
      id: "root",
      aspect: obj.slice(0, 50),
      question: obj,
      suggestions: [],
      answer: null,
      children: data.aspects,
    });
    setView("discourse");
  }

  if (view === "landing") {
    return <Landing onStart={handleStart} />;
  }

  return (
    <TreeCanvas
      sessionId={sessionId}
      tree={tree}
      setTree={setTree}
      objective={objective}
    />
  );
}
