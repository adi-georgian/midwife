import { useState, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import DiscourseNode from "./DiscourseNode";
import MindmapEdge from "./MindmapEdge";
import InterviewFlow from "./InterviewFlow";
import ReviewCard from "./ReviewCard";
import ChatBar from "./ChatBar";
import RightPanel from "./RightPanel";
import NodeContextMenu from "./NodeContextMenu";
import CreateNodeModal from "./CreateNodeModal";
import LeftPanel from "./LeftPanel";
import RepurposingModal from "./RepurposingModal";
import PendingTopicsModal from "./PendingTopicsModal";
import { answerAspect, elaborateAspect, addAspect, sendChatMessage, labelChat, deleteAspect, moveAspect, recontextualizeAspect } from "../api";
import { toTitleCase } from "../utils";

const NODE_TYPES = { discourseNode: DiscourseNode };
const EDGE_TYPES = { mindmapEdge: MindmapEdge };

const H_STEP = 180;
const PARENT_Y = 120;

// Layout spacing constants
const MIN_CHILD_H = 90;    // minimum height allocated per child
const GC_H = 75;           // vertical space allocated per grandchild
const GGC_H = 55;          // vertical space allocated per great-grandchild

function normAspect(node) {
  return { ...node, aspect: toTitleCase(node.aspect) };
}

// ── DFS helpers ──────────────────────────────────────────────────────────────

function findNode(node, id) {
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const result = findNode(child, id);
    if (result) return result;
  }
  return null;
}

function findParentNode(node, targetId) {
  for (const child of node.children || []) {
    if (child.id === targetId) return node;
    const result = findParentNode(child, targetId);
    if (result) return result;
  }
  return null;
}

function findPath(node, targetId, path = []) {
  const current = [...path, { id: node.id, aspect: node.aspect }];
  if (node.id === targetId) return current;
  for (const child of node.children || []) {
    const result = findPath(child, targetId, current);
    if (result) return result;
  }
  return null;
}

// ── Layout ───────────────────────────────────────────────────────────────────

function childHeight(child, viewMode) {
  if (viewMode === "children") return MIN_CHILD_H;
  const gcs = (child.children || []).filter(c => !c.is_ghost && !c.is_loading);
  if (gcs.length === 0) return MIN_CHILD_H;
  return Math.max(MIN_CHILD_H, gcs.length * GC_H);
}

function buildGraphElements(tree, interviewingId, focusNodeId, viewMode) {
  const nodes = [];
  const edges = [];

  const focusNode = findNode(tree, focusNodeId);
  if (!focusNode) return { nodes, edges };

  const isRootFocus = focusNode.id === tree.id;
  const parentNode = isRootFocus ? null : findParentNode(tree, focusNodeId);

  const focusIsTerminal = (focusNode.children || []).filter(c => !c.is_ghost && !c.is_loading).length === 0;
  nodes.push({
    id: focusNode.id,
    type: "discourseNode",
    position: { x: 0, y: 0 },
    data: {
      ...focusNode,
      isFocus: true,
      isRoot: isRootFocus,
      isInterviewing: false,
      isTerminal: focusIsTerminal,
      isDimmed: false,
    },
  });

  if (parentNode) {
    const parentIsTerminal = (parentNode.children || []).filter(c => !c.is_ghost && !c.is_loading).length === 0;
    nodes.push({
      id: parentNode.id,
      type: "discourseNode",
      position: { x: 0, y: -PARENT_Y },
      data: {
        ...parentNode,
        isParentPreview: true,
        isInterviewing: false,
        isTerminal: parentIsTerminal,
        isDimmed: false,
      },
    });
    edges.push({
      id: `e-parent-${parentNode.id}-${focusNode.id}`,
      source: parentNode.id,
      target: focusNode.id,
      type: "mindmapEdge",
      sourceHandle: "bottom",
      targetHandle: "top",
      style: { stroke: "#ccc", opacity: 0.5, strokeDasharray: "6 4", strokeWidth: 1.5 },
      data: { baseStyle: { stroke: "#ccc", opacity: 0.5, strokeDasharray: "6 4", strokeWidth: 1.5 } },
    });
  }

  const children = (focusNode.children || []).filter(c => !c.is_ghost);
  const leftChildren = children.filter((_, i) => i % 2 === 0);
  const rightChildren = children.filter((_, i) => i % 2 === 1);

  const leftNaturalH = leftChildren.reduce((s, c) => s + childHeight(c, viewMode), 0);
  const rightNaturalH = rightChildren.reduce((s, c) => s + childHeight(c, viewMode), 0);
  const sharedTotalH = Math.max(leftNaturalH, rightNaturalH);

  function placeChildSide(sideChildren, xSign) {
    const srcHandle = xSign < 0 ? "left" : "right";
    const srcPos = xSign < 0 ? "left" : "right";
    const tgtPos = xSign < 0 ? "right" : "left";

    const naturalH = sideChildren.reduce((s, c) => s + childHeight(c, viewMode), 0);
    const totalH = Math.max(naturalH, sharedTotalH);
    const scale = naturalH > 0 ? totalH / naturalH : 1;

    let cumY = 0;
    const childYs = sideChildren.map(child => {
      const h = childHeight(child, viewMode) * scale;
      const y = cumY + h / 2;
      cumY += h;
      return y;
    });

    sideChildren.forEach((child, i) => {
      const y = childYs[i] - totalH / 2;

      const childIsTerminal = (child.children || []).filter(c => !c.is_ghost && !c.is_loading).length === 0;
      nodes.push({
        id: child.id,
        type: "discourseNode",
        position: { x: xSign * H_STEP, y },
        data: {
          ...child,
          isInterviewing: child.id === interviewingId,
          sourcePosition: srcPos,
          targetPosition: tgtPos,
          isTerminal: childIsTerminal,
          hideAnswer: viewMode === "full",
          isDimmed: false,
        },
      });
      const childBaseStyle = child.is_loading
        ? { stroke: "#e0e0e0", opacity: 0.6, strokeWidth: 1.5 }
        : { stroke: "#c8c8c8", strokeWidth: 1.5 };
      edges.push({
        id: `e-${focusNode.id}-${child.id}`,
        source: focusNode.id,
        target: child.id,
        type: "mindmapEdge",
        sourceHandle: srcHandle,
        style: childBaseStyle,
        data: { baseStyle: childBaseStyle },
      });

      if (viewMode === "children") return;

      const grandchildren = (child.children || []).filter(c => !c.is_ghost && !c.is_loading);
      const gcTotal = grandchildren.length;
      grandchildren.forEach((gc, j) => {
        const gcY = y + (j - (gcTotal - 1) / 2) * GC_H;
        const gcIsTerminal = (gc.children || []).filter(c => !c.is_ghost && !c.is_loading).length === 0;
        nodes.push({
          id: gc.id,
          type: "discourseNode",
          position: { x: xSign * 2 * H_STEP, y: gcY },
          data: {
            ...gc,
            isInterviewing: gc.id === interviewingId,
            sourcePosition: srcPos,
            targetPosition: tgtPos,
            isTerminal: gcIsTerminal,
            hideAnswer: viewMode === "full",
            isDimmed: false,
          },
        });
        const gcBaseStyle = { stroke: "#d4d4d4", strokeWidth: 1 };
        edges.push({
          id: `e-${child.id}-${gc.id}`,
          source: child.id,
          target: gc.id,
          type: "mindmapEdge",
          style: gcBaseStyle,
          data: { baseStyle: gcBaseStyle },
        });

        const ggcs = (gc.children || []).filter(c => !c.is_ghost && !c.is_loading);
        ggcs.forEach((ggc, k) => {
          const ggcY = gcY + (k - (ggcs.length - 1) / 2) * GGC_H;
          const ggcIsTerminal = (ggc.children || []).filter(c => !c.is_ghost && !c.is_loading).length === 0;

          if (viewMode === "full") {
            nodes.push({
              id: ggc.id,
              type: "discourseNode",
              position: { x: xSign * 3 * H_STEP, y: ggcY },
              data: {
                ...ggc,
                isInterviewing: ggc.id === interviewingId,
                sourcePosition: srcPos,
                targetPosition: tgtPos,
                isTerminal: ggcIsTerminal,
                hideAnswer: true,
                isDimmed: false,
              },
            });
            const ggcBaseStyleFull = { stroke: "#d4d4d4", strokeWidth: 1 };
            edges.push({
              id: `e-${gc.id}-${ggc.id}`,
              source: gc.id,
              target: ggc.id,
              type: "mindmapEdge",
              style: ggcBaseStyleFull,
              data: { baseStyle: ggcBaseStyleFull },
            });
          }
        });
      });
    });
  }

  placeChildSide(leftChildren, -1);
  placeChildSide(rightChildren, 1);

  return { nodes, edges };
}

// ── Patch helper ─────────────────────────────────────────────────────────────

function patchNode(node, targetId, patch) {
  if (node.id === targetId) return { ...node, ...patch };
  return {
    ...node,
    children: (node.children || []).map(c => patchNode(c, targetId, patch)),
  };
}

function removeNode(node, targetId) {
  return {
    ...node,
    children: (node.children || [])
      .filter(c => c.id !== targetId)
      .map(c => removeNode(c, targetId)),
  };
}

// ── SpinoffTargetDropdown ─────────────────────────────────────────────────────

function SpinoffTargetDropdown({ tree, suggestions, onAdd, onDismiss }) {
  const [targetId, setTargetId] = useState("root");

  function collectNodes(node, depth = 0) {
    const real = (node.children || []).filter(c => !c.is_ghost && !c.is_loading);
    return [
      { id: node.id, label: depth === 0 ? "Top level" : node.aspect, depth },
      ...real.flatMap(c => collectNodes(c, depth + 1)),
    ];
  }
  const allNodes = collectNodes(tree);

  return (
    <>
      {suggestions.map((s, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <strong>{s.suggested_label}</strong>
          {s.suggested_question && (
            <p style={{ fontSize: "0.82rem", color: "var(--text-3)" }}>{s.suggested_question}</p>
          )}
        </div>
      ))}
      <div style={{ margin: "12px 0" }}>
        <select
          value={targetId}
          onChange={e => setTargetId(e.target.value)}
          style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-1)", fontSize: "0.88rem" }}
        >
          {allNodes.map(n => (
            <option key={n.id} value={n.id}>
              {"  ".repeat(n.depth)}{n.label}
            </option>
          ))}
        </select>
      </div>
      <div className="create-node-modal__actions">
        <button type="button" onClick={onDismiss}>Dismiss</button>
        <button type="button" onClick={() => onAdd(targetId)}>Add to Discourse</button>
      </div>
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DiscourseCanvas({ sessionId, tree, setTree, objective, discourseTitle, background = {}, onSessionChange, onHome }) {
  // Resume old sessions directly to selecting phase if they already have answers
  const [phase, setPhase] = useState(() => {
    const hasAnswers = (tree?.children || []).some(c => c.answer !== null);
    return hasAnswers ? "selecting" : "signoff";
  });

  // Interview queue populated only after signoff confirmation
  const [interviewQueue, setInterviewQueue] = useState([]);
  const [interviewIndex, setInterviewIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);

  const [focusNodeId, setFocusNodeId] = useState("root");
  const [focusPath, setFocusPath] = useState(() => [{ id: "root", aspect: tree?.aspect || "Root" }]);
  const [focusChildless, setFocusChildless] = useState(false);
  const [exploringNodeId, setExploringNodeId] = useState(null);
  const [viewMode, setViewMode] = useState("grandchildren");

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  const [nodeMenu, setNodeMenu] = useState(null);
  const [movingNodeId, setMovingNodeId] = useState(null);
  const [createChildParentId, setCreateChildParentId] = useState(null);

  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  const [interviewPaused, setInterviewPaused] = useState(false);
  const [signoffParentId, setSignoffParentId] = useState(null);
  const [pendingNewTopics, setPendingNewTopics] = useState([]);

  const [interviewReady, setInterviewReady] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiError, setApiError] = useState(null);
  useEffect(() => {
    if (!apiError) return;
    const t = setTimeout(() => setApiError(null), 5000);
    return () => clearTimeout(t);
  }, [apiError]);
  const [addAspectMode, setAddAspectMode] = useState("add-child");
  const [isRecontextualizing, setIsRecontextualizing] = useState(false);
  const [pendingSpinoffs, setPendingSpinoffs] = useState(null);
  const [theme, setTheme] = useState("sepia");
  const settingsPanelRef = useRef(null);
  const settingsBtnRef = useRef(null);

  // Recontextualization state
  const [spinoffSuggestions, setSpinoffSuggestions] = useState(null);
  const [pendingRelabelings, setPendingRelabelings] = useState([]);
  const [showRepurposing, setShowRepurposing] = useState(false);

  const currentNode = phase === "interviewing" ? interviewQueue[interviewIndex] : null;

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const rfRef = useRef(null);

  // Chat state
  const [chatThreads, setChatThreads] = useState([]);
  const [activeChatThreadId, setActiveChatThreadId] = useState(null);

  // Compute focus path as a Set for the left panel
  const focusPathIds = new Set(focusPath.map(n => n.id));

  useEffect(() => {
    if (!tree) return;
    const { nodes: n, edges: e } = buildGraphElements(tree, currentNode?.id, focusNodeId, viewMode);
    setNodes(n);
    setEdges(e);
    setTimeout(() => rfRef.current?.fitView({ padding: 0.25, duration: 300 }), 0);
  }, [tree, currentNode?.id, focusNodeId, viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Separate hover effect — updates dimming in-place without resetting positions or fitView
  useEffect(() => {
    if (!hoveredNodeId) {
      setNodes(prev => prev.map(n => ({ ...n, data: { ...n.data, isDimmed: false } })));
      setEdges(prev => prev.map(e => ({ ...e, style: e.data?.baseStyle ?? e.style })));
      return;
    }
    const parent = tree ? findParentNode(tree, hoveredNodeId) : null;
    const parentId = parent?.id ?? null;
    setNodes(prev => prev.map(n => ({
      ...n,
      data: { ...n.data, isDimmed: n.id !== hoveredNodeId && n.id !== parentId },
    })));
    setEdges(prev => prev.map(e => {
      const isHighlighted = parentId && e.source === parentId && e.target === hoveredNodeId;
      const base = e.data?.baseStyle ?? e.style;
      if (isHighlighted) {
        return { ...e, style: { ...base, stroke: "#8480E8", strokeWidth: 2.5, opacity: 1, strokeDasharray: undefined } };
      }
      return { ...e, style: { ...base, opacity: 0.12 } };
    }));
  }, [hoveredNodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  function rebuildLayout() {
    if (!tree) return;
    const { nodes: n, edges: e } = buildGraphElements(tree, currentNode?.id, focusNodeId, viewMode);
    setNodes(n);
    setEdges(e);
    setTimeout(() => rfRef.current?.fitView({ padding: 0.25, duration: 300 }), 0);
  }

  useEffect(() => {
    document.body.classList.toggle("theme-dark", theme === "dark");
  }, [theme]);

  // Show interview overlay when queue is ready and we're in interviewing phase
  useEffect(() => {
    if (phase !== "interviewing" || interviewQueue.length === 0) return;
    setInterviewReady(true);
  }, [interviewQueue, phase]);

  // Re-fit canvas when the interview overlay drops (chat opens or phase ends)
  useEffect(() => {
    if (interviewPaused) {
      setTimeout(() => rfRef.current?.fitView({ padding: 0.25, duration: 400 }), 80);
    }
  }, [interviewPaused]);

  useEffect(() => {
    if (phase === "selecting") {
      setTimeout(() => rfRef.current?.fitView({ padding: 0.25, duration: 400 }), 80);
    }
  }, [phase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      rfRef.current?.fitView({ padding: 0.25, duration: 300 });
    }, 350);
    return () => clearTimeout(timer);
  }, [chatOpen, leftPanelOpen, rightPanelOpen]);

  useEffect(() => {
    if (!tree || !sessionId) return;
    onSessionChange?.({
      sessionId,
      objective,
      discourseName: discourseTitle,
      tree,
      savedAt: Date.now(),
    });
  }, [tree]);

  useEffect(() => {
    if (!settingsOpen) return;
    function onMouseDown(e) {
      if (
        settingsPanelRef.current && !settingsPanelRef.current.contains(e.target) &&
        settingsBtnRef.current && !settingsBtnRef.current.contains(e.target)
      ) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [settingsOpen]);

  async function autoLabelThread(threadId) {
    if (!threadId) return;
    const thread = chatThreads.find(t => t.id === threadId);
    if (!thread || thread.title !== "New Chat" || thread.messages.length < 2) return;
    try {
      const { label } = await labelChat(thread.messages);
      if (label) {
        setChatThreads(prev => prev.map(t => t.id === threadId ? { ...t, title: toTitleCase(label) } : t));
      }
    } catch {}
  }

  function flushPendingSpinoffs() {
    if (pendingSpinoffs && pendingSpinoffs.length > 0) {
      setSpinoffSuggestions(pendingSpinoffs);
      setPendingSpinoffs(null);
    }
  }

  function navigateTo(nodeId) {
    const path = findPath(tree, nodeId);
    setFocusNodeId(nodeId);
    if (path) setFocusPath(path);

    // If navigating away from the active signoff context, return to selecting
    if (phase === "signoff" && nodeId !== signoffParentId) {
      setPhase("selecting");
      setSignoffParentId(null);
    }

    const newFocusNode = findNode(tree, nodeId);
    if (newFocusNode) {
      const hasRealChildren = (newFocusNode.children || []).filter(c => !c.is_ghost && !c.is_loading).length > 0;
      setFocusChildless(!!newFocusNode.answer && !hasRealChildren);
    } else {
      setFocusChildless(false);
    }
  }

  function handleConfirmSignoff() {
    const parentId = signoffParentId || "root";
    const parent = findNode(tree, parentId) || tree;
    const children = (parent?.children || []).filter(c => !c.is_ghost && !c.is_loading);
    setInterviewQueue(children);
    setInterviewIndex(0);
    setSignoffParentId(null);
    setPhase("interviewing");
  }

  async function handleAnswer(answer) {
    const node = interviewQueue[interviewIndex];
    try {
      await answerAspect(sessionId, node.id, answer);
    } catch (err) {
      setApiError(err.message);
      return;
    }
    setTree(prev => patchNode(prev, node.id, { answer }));
    setInterviewQueue(prev => prev.map(n => n.id === node.id ? { ...n, answer } : n));

    // Reset chatAnswerCleared when moving to a new question
    setChatThreads(prev => prev.map(t =>
      t.aspectId === node.id ? { ...t, chatAnswerCleared: false } : t
    ));

    // Fire recontextualize async (non-blocking) — collect relabelings for approval, queue spinoffs
    setIsRecontextualizing(true);
    recontextualizeAspect(sessionId, node.id).then(data => {
      setIsRecontextualizing(false);
      if (data.updated_ancestors?.length > 0) {
        setTree(prev => {
          const changes = data.updated_ancestors.map(u => {
            const oldNode = findNode(prev, u.id);
            return { id: u.id, oldLabel: oldNode?.aspect || u.id, newLabel: u.new_aspect };
          });
          setPendingRelabelings(prev => [...prev, ...changes]);
          return prev; // don't apply yet — wait for user approval
        });
      }
      if (data.spinoff_suggestions?.length > 0) {
        setPendingSpinoffs(data.spinoff_suggestions);
      }
    }).catch(() => { setIsRecontextualizing(false); });

    const nextIndex = interviewIndex + 1;
    if (nextIndex < interviewQueue.length) {
      setInterviewIndex(nextIndex);
    } else {
      setReviewing(true);
    }
  }

  function handleSaveAndPrev(currentAnswer) {
    if (currentAnswer) {
      const node = interviewQueue[interviewIndex];
      answerAspect(sessionId, node.id, currentAnswer);
      setTree(prev => patchNode(prev, node.id, { answer: currentAnswer }));
      setInterviewQueue(prev => prev.map(n => n.id === node.id ? { ...n, answer: currentAnswer } : n));
    }
    setInterviewIndex(i => i - 1);
  }

  function handleSaveAndNext(currentAnswer) {
    if (currentAnswer) {
      const node = interviewQueue[interviewIndex];
      answerAspect(sessionId, node.id, currentAnswer);
      setTree(prev => patchNode(prev, node.id, { answer: currentAnswer }));
      setInterviewQueue(prev => prev.map(n => n.id === node.id ? { ...n, answer: currentAnswer } : n));
    }
    setInterviewIndex(i => i + 1);
  }

  function handleDismiss() {
    const newQueue = interviewQueue.filter((_, i) => i !== interviewIndex);
    setInterviewQueue(newQueue);
    if (newQueue.length === 0 || interviewIndex >= newQueue.length) {
      setReviewing(true);
    }
  }

  async function handleExploreFocus() {
    const focusNode = findNode(tree, focusNodeId);
    if (!focusNode || !focusNode.answer) return;

    const placeholders = Array.from({ length: 6 }, (_, i) => ({
      id: `loading-${focusNodeId}-${i}`,
      aspect: "…",
      question: "",
      suggestions: [],
      answer: null,
      is_loading: true,
      children: [],
    }));
    setTree(prev => patchNode(prev, focusNodeId, { children: placeholders }));
    setFocusChildless(false);
    setExploringNodeId(focusNodeId);

    let result;
    try {
      result = await elaborateAspect(sessionId, focusNodeId);
    } catch (err) {
      setApiError(err.message);
      setExploringNodeId(null);
      setTree(prev => patchNode(prev, focusNodeId, { children: [] }));
      return;
    }
    setExploringNodeId(null);
    const normedAspects = result.aspects.map(normAspect);
    setTree(prev => patchNode(prev, focusNodeId, { children: normedAspects }));
    setInterviewQueue(normedAspects);
    setInterviewIndex(0);
    setReviewing(false);
    setSignoffParentId(focusNodeId);
    setPhase("signoff");
  }

  async function handleNodeClick(event, rfNode) {
    const nodeData = rfNode.data;

    if (movingNodeId) {
      if (!nodeData.is_ghost && !nodeData.isGhostDisplay && !nodeData.is_loading && rfNode.id !== movingNodeId) {
        await handleConfirmMove(rfNode.id);
      }
      return;
    }

    if (nodeData.isParentPreview) { navigateTo(rfNode.id); return; }
    if (nodeData.is_ghost || nodeData.isGhostDisplay || nodeData.is_loading) return;
    if (nodeData.isFocus || nodeData.isRoot) return;

    if (phase === "selecting") {
      setSelectedNodeId(prev => prev === rfNode.id ? null : rfNode.id);
    }
  }

  function handleNodeDoubleClick(event, rfNode) {
    const nodeData = rfNode.data;
    if (nodeData.is_ghost || nodeData.isGhostDisplay || nodeData.is_loading) return;
    if (nodeData.isFocus || nodeData.isRoot) return;
    if (nodeData.isParentPreview) return; // parent preview already navigates on single click
    if (phase !== "selecting") return;
    setSelectedNodeId(null);
    navigateTo(rfNode.id);
  }

  async function handleExploreNode(nodeId) {
    setNodeMenu(null);
    setSelectedNodeId(null);
    const node = findNode(tree, nodeId);
    if (!node) return;

    if (!node.answer) {
      setInterviewQueue([node]);
      setInterviewIndex(0);
      setReviewing(false);
      setPhase("interviewing");
      navigateTo(nodeId);
    } else {
      const realChildren = (node.children || []).filter(c => !c.is_ghost && !c.is_loading);
      if (realChildren.length === 0) {
        setExploringNodeId(nodeId);
        const placeholders = Array.from({ length: 6 }, (_, i) => ({
          id: `loading-${nodeId}-${i}`,
          aspect: "…",
          question: "",
          suggestions: [],
          answer: null,
          is_loading: true,
          children: [],
        }));
        setTree(prev => patchNode(prev, nodeId, { children: placeholders }));
        const result = await elaborateAspect(sessionId, nodeId);
        setExploringNodeId(null);
        const normedAspects = result.aspects.map(normAspect);
        setTree(prev => patchNode(prev, nodeId, { children: normedAspects }));
        navigateTo(nodeId);
        setInterviewQueue(normedAspects);
        setInterviewIndex(0);
        setReviewing(false);
        setSignoffParentId(nodeId);
        setPhase("signoff");
      } else {
        navigateTo(nodeId);
      }
    }
  }

  async function handleDeleteNode(nodeId) {
    setNodeMenu(null);
    setSelectedNodeId(prev => prev === nodeId ? null : prev);
    const node = findNode(tree, nodeId);
    const childCount = (node?.children || []).filter(c => !c.is_ghost && !c.is_loading).length;
    if (childCount > 0) {
      const ok = window.confirm(`Delete "${node.aspect}" and its ${childCount} child node(s)?`);
      if (!ok) return;
    }
    try {
      await deleteAspect(sessionId, nodeId);
    } catch (err) { setApiError(err.message); return; }
    setTree(prev => removeNode(prev, nodeId));
    setInterviewQueue(prev => prev.filter(n => n.id !== nodeId));
  }

  async function handleConfirmMove(targetParentId, sourceId) {
    const nodeToMove = sourceId || movingNodeId;
    if (!nodeToMove || targetParentId === nodeToMove) { setMovingNodeId(null); return; }
    try {
      await moveAspect(sessionId, nodeToMove, targetParentId);
    } catch (err) { setApiError(err.message); return; }
    setTree(prev => {
      const node = findNode(prev, nodeToMove);
      const removed = removeNode(prev, nodeToMove);
      const targetParent = findNode(removed, targetParentId);
      return patchNode(removed, targetParentId, {
        children: [...(targetParent?.children || []), node],
      });
    });
    setMovingNodeId(null);
  }

  function handleChatAboutThis(node) {
    let thread = chatThreads.find(t => t.aspectId === node.id);
    if (!thread) {
      const optionsList = node.suggestions?.length > 0
        ? "\n\nOptions to consider:\n" + node.suggestions.map(s => `• ${s}`).join("\n")
        : "";
      const seedMessages = [
        { role: "assistant", content: node.question + optionsList },
      ];
      thread = {
        id: crypto.randomUUID(),
        title: node.aspect,
        aspectId: node.id,
        parentId: focusNodeId,
        messages: seedMessages,
        resolvedAnswerFor: null,
        chatAnswerCleared: false,
      };
      setChatThreads(prev => [...prev, thread]);
    }
    setActiveChatThreadId(thread.id);
    setChatOpen(true);
    setInterviewPaused(true);
  }

  function handleClearChatAnswer() {
    setChatThreads(prev => prev.map(t =>
      t.id === activeChatThreadId ? { ...t, chatAnswerCleared: true } : t
    ));
  }

  async function handleSendChatMessage(content) {
    const thread = chatThreads.find(t => t.id === activeChatThreadId);
    if (!thread) return;
    const userMsg = { role: "user", content };
    const updatedMessages = [...thread.messages, userMsg];

    setChatThreads(prev =>
      prev.map(t => t.id === activeChatThreadId ? { ...t, messages: updatedMessages } : t)
    );

    const aspectNode = thread.aspectId ? findNode(tree, thread.aspectId) : null;
    const aspectContext = aspectNode
      ? { aspect: aspectNode.aspect, question: aspectNode.question, summary: aspectNode.summary }
      : null;

    let data;
    try {
      data = await sendChatMessage(sessionId, updatedMessages, aspectContext);
    } catch (err) {
      setApiError(err.message);
      return;
    }

    // Handle updated aspect/question from chat
    if (data.updated_aspect && thread.aspectId) {
      const patch = { aspect: data.updated_aspect };
      if (data.updated_question) patch.question = data.updated_question;
      setTree(prev => patchNode(prev, thread.aspectId, patch));
      setInterviewQueue(prev => prev.map(n =>
        n.id === thread.aspectId ? { ...n, ...patch } : n
      ));
    }

    const assistantMsg = {
      role: "assistant",
      content: data.reply,
      suggestedAnswer: data.suggested_answer || null,
      suggestedAnswers: data.suggested_answers?.length > 0 ? data.suggested_answers : null,
      newAspects: data.new_aspects?.length > 0 ? data.new_aspects : null,
    };
    setChatThreads(prev =>
      prev.map(t => t.id === activeChatThreadId ? { ...t, messages: [...updatedMessages, assistantMsg] } : t)
    );
  }

  async function handleAddAspectFromChat(aspectDef, parentId) {
    if (phase === "interviewing" && currentNode) {
      setPendingNewTopics(prev => [...prev, {
        aspectDef,
        parentId,
        fromAspect: currentNode.aspect,
        fromQuestion: currentNode.question,
      }]);
      return;
    }
    let result;
    try {
      result = await addAspect(sessionId, parentId || "root", aspectDef);
    } catch (err) { setApiError(err.message); return; }
    const newNode = result.aspect;
    setTree(prev => {
      const parent = findNode(prev, parentId || "root");
      return patchNode(prev, parentId || "root", {
        children: [...(parent?.children || []), newNode],
      });
    });
  }

  async function handleUseAsAnswer(aspectId, content) {
    try {
      await answerAspect(sessionId, aspectId, content);
    } catch (err) { setApiError(err.message); return; }
    setTree(prev => patchNode(prev, aspectId, { answer: content }));
    setChatThreads(prev =>
      prev.map(t => t.aspectId === aspectId ? { ...t, resolvedAnswerFor: aspectId } : t)
    );
    setChatOpen(false);
    setInterviewPaused(false);
  }

  async function handleInlineAddAspect(aspect, parentId) {
    try {
      const result = await addAspect(sessionId, parentId, { aspect, question: "", suggestions: [] });
      const newNode = normAspect(result.aspect);
      setTree(prev => {
        const parent = findNode(prev, parentId);
        return patchNode(prev, parentId, { children: [...(parent?.children || []), newNode] });
      });
      // Only immediately interview for sub-aspects (parent is a child node, not the focus/signoff root)
      const isSubAspect = parentId !== focusNodeId && parentId !== (signoffParentId || focusNodeId);
      if (isSubAspect) {
        setInterviewQueue([newNode]);
        setInterviewIndex(0);
        setReviewing(false);
        setPhase("interviewing");
      }
    } catch (err) { setApiError(err.message); }
  }

  function handleNewThread() {
    const thread = {
      id: crypto.randomUUID(),
      title: "New Chat",
      aspectId: null,
      messages: [],
      resolvedAnswerFor: null,
      chatAnswerCleared: false,
    };
    setChatThreads(prev => [...prev, thread]);
    setActiveChatThreadId(thread.id);
  }

  function handleSelectThread(newThreadId) {
    if (newThreadId !== activeChatThreadId) {
      autoLabelThread(activeChatThreadId);
    }
    setActiveChatThreadId(newThreadId);
  }

  function handleSwitchToThreadsView() {
    autoLabelThread(activeChatThreadId);
  }

  function handleExport() {
    const data = JSON.stringify({ objective, tree }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `midwife-${objective.slice(0, 30).replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Derive chatSuggestedAnswer for the current interview node
  const activeInterviewThread = currentNode
    ? chatThreads.find(t => t.aspectId === currentNode.id)
    : null;
  const chatSuggestedAnswer = (!activeInterviewThread?.chatAnswerCleared &&
    activeInterviewThread?.messages
      ?.filter(m => m.role === "assistant" && m.suggestedAnswer)
      .at(-1)?.suggestedAnswer) || null;

  return (
    <div className="app-layout">
      <div className="canvas-header">
        <span className="canvas-brand" onClick={onHome} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && onHome?.()}>midWife</span>
      </div>
      {focusNodeId !== "root" && (
        <div className="canvas-breadcrumbs-bar">
          {focusPath.map((crumb, i) => {
            const isLast = i === focusPath.length - 1;
            return (
              <span key={crumb.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {i > 0 && <span className="crumb-sep">›</span>}
                {isLast
                  ? <span className="crumb-current">{crumb.aspect}</span>
                  : <button onClick={() => navigateTo(crumb.id)}>{crumb.aspect}</button>
                }
              </span>
            );
          })}
        </div>
      )}
      <div className="app-body">
      {leftPanelOpen ? (
        <LeftPanel
          tree={tree}
          hoveredNodeId={hoveredNodeId}
          selectedNodeId={selectedNodeId}
          findNode={findNode}
          focusNodeId={focusNodeId}
          phase={phase}
          movingNodeId={movingNodeId}
          signoffParentId={signoffParentId}
          focusChildless={focusChildless}
          viewMode={viewMode}
          onSelectNode={setSelectedNodeId}
          onExplore={handleExploreNode}
          onDelete={handleDeleteNode}
          onAddChild={id => { setCreateChildParentId(id); setAddAspectMode("add-child"); }}
          onMove={id => { setMovingNodeId(id); setSelectedNodeId(null); }}
          onConfirmMove={handleConfirmMove}
          onAddAspect={() => { setCreateChildParentId(focusNodeId); setAddAspectMode("add-aspect"); }}
          onConfirmSignoff={handleConfirmSignoff}
          onNavigateTo={id => { navigateTo(id); setSelectedNodeId(null); }}
          onCollapse={() => setLeftPanelOpen(false)}
          onExploreFocus={handleExploreFocus}
          exploringNodeId={exploringNodeId}
          onHoverNode={setHoveredNodeId}
          onInlineAdd={handleInlineAddAspect}
        />
      ) : (
        <button className="lpanel-expand-btn" onClick={() => setLeftPanelOpen(true)} title="Expand panel">›</button>
      )}

      {!rightPanelOpen && (
        <button className="rpanel-expand-btn" onClick={() => setRightPanelOpen(true)} title="Expand panel">‹</button>
      )}

      <div className="discourse-canvas">

        <div className="canvas-float-actions">
          <button className="canvas-float-btn" onClick={() => rfRef.current?.fitView({ padding: 0.15, duration: 300 })}><span style={{fontSize:"1rem",lineHeight:1}}>⤢</span> Fit</button>
          <button className="canvas-float-btn" onClick={handleExport}>↓ Export</button>
          <div style={{ position: "relative" }}>
            <button
              ref={settingsBtnRef}
              className="canvas-float-btn"
              onClick={() => setSettingsOpen(o => !o)}
              title="Settings"
            >
              Settings ⚙
            </button>
            {settingsOpen && (
              <div className="settings-panel" ref={settingsPanelRef}>
                <div className="settings-row">
                  <label>Graph View</label>
                  <select value={viewMode} onChange={e => setViewMode(e.target.value)}>
                    <option value="children">Focus Only</option>
                    <option value="grandchildren">Show Grandchildren</option>
                    <option value="full">Full Graph</option>
                  </select>
                </div>
                <div className="settings-row">
                  <label>Theme</label>
                  <select value={theme} onChange={e => setTheme(e.target.value)}>
                    <option value="sepia">Sepia</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="canvas-float-actions-right">
          <div className="canvas-node-hint">
            ▷ Click to select &nbsp;·&nbsp; ⤢ Double-click to focus
          </div>
        </div>



        {apiError && (
          <div className="api-error-banner">
            {apiError}
            <button onClick={() => setApiError(null)}>✕</button>
          </div>
        )}

        {movingNodeId && (
          <div className="move-mode-banner">
            Click a node to move <strong>{findNode(tree, movingNodeId)?.aspect}</strong> there.
            <button onClick={() => setMovingNodeId(null)}>Cancel</button>
          </div>
        )}

        {nodeMenu && (
          <NodeContextMenu
            node={findNode(tree, nodeMenu.nodeId)}
            x={nodeMenu.x}
            y={nodeMenu.y}
            onExplore={handleExploreNode}
            onAddChild={id => { setNodeMenu(null); setCreateChildParentId(id); }}
            onMove={id => { setNodeMenu(null); setMovingNodeId(id); }}
            onDelete={handleDeleteNode}
            onClose={() => setNodeMenu(null)}
          />
        )}

        {createChildParentId && (
          <CreateNodeModal
            parentAspect={findNode(tree, createChildParentId)?.aspect}
            mode={addAspectMode}
            onSubmit={async (def) => {
              const parentId = createChildParentId;
              setCreateChildParentId(null);
              setAddAspectMode("add-child");
              await handleAddAspectFromChat(def, parentId);
            }}
            onClose={() => { setCreateChildParentId(null); setAddAspectMode("add-child"); }}
          />
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onPaneClick={() => setSelectedNodeId(null)}
          onNodeMouseEnter={(_, n) => setHoveredNodeId(n.id)}
          onNodeMouseLeave={() => setHoveredNodeId(null)}
          onInit={rf => (rfRef.current = rf)}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.2}
          maxZoom={2}
        >
          <Background color={theme === "dark" ? "#2a2520" : "#d8c5aa"} gap={28} variant="dots" size={1} />
          <Controls showFitView={false}>
            <ControlButton onClick={rebuildLayout} title="Fit view">
              <svg viewBox="0 0 32 30" fill="currentColor">
                <path d="M3.692 4.192H10v1.77H5.461V10.5H3.692V4.192zm24.615 0v6.308h-1.769V5.962H22v-1.77h6.307zM10 26.038H3.692V19.73h1.77v4.538H10v1.77zm18.307-6.307v6.307H22v-1.77h4.538V19.73h1.769z"/>
              </svg>
            </ControlButton>
          </Controls>
        </ReactFlow>

        {phase === "interviewing" && currentNode && interviewReady && !reviewing && !interviewPaused && (
          <InterviewFlow
            node={currentNode}
            onAnswer={handleAnswer}
            onChatAboutThis={handleChatAboutThis}
            onClearChatAnswer={handleClearChatAnswer}
            onPrev={handleSaveAndPrev}
            onNext={handleSaveAndNext}
            hasPrev={interviewIndex > 0}
            hasNext={interviewIndex < interviewQueue.length - 1}
            questionNumber={interviewIndex + 1}
            totalQuestions={interviewQueue.length}
            chatSuggestedAnswer={chatSuggestedAnswer}
            onSkip={handleDismiss}
          />
        )}

        {reviewing && (
          <ReviewCard
            queue={interviewQueue}
            onEdit={i => { setReviewing(false); setInterviewIndex(i); }}
            onSubmit={() => {
              setReviewing(false);
              if (pendingRelabelings.length > 0) {
                setShowRepurposing(true);
              } else {
                flushPendingSpinoffs();
                setPhase("selecting");
                setLeftPanelOpen(true);
              }
            }}
          />
        )}

        {/* Recontextualizing indicator */}
        {isRecontextualizing && (
          <div className="recontexting-indicator">Recontextualizing...</div>
        )}

        {/* Repurposing approval modal — shown after review, before separate topics */}
        {showRepurposing && pendingRelabelings.length > 0 && (
          <RepurposingModal
            changes={pendingRelabelings}
            onConfirm={approvedIds => {
              setTree(prev => {
                let updated = prev;
                for (const c of pendingRelabelings) {
                  if (approvedIds.has(c.id)) {
                    updated = patchNode(updated, c.id, { aspect: c.newLabel });
                  }
                }
                return updated;
              });
              setPendingRelabelings([]);
              setShowRepurposing(false);
              flushPendingSpinoffs();
              setPhase("selecting");
              setLeftPanelOpen(true);
            }}
            onSkip={() => {
              setPendingRelabelings([]);
              setShowRepurposing(false);
              flushPendingSpinoffs();
              setPhase("selecting");
              setLeftPanelOpen(true);
            }}
          />
        )}

        {/* Spinoff suggestions modal */}
        {spinoffSuggestions && spinoffSuggestions.length > 0 && (
          <div className="create-node-modal-overlay">
            <div className="create-node-modal">
              <h3>Separate Topic Detected</h3>
              <p style={{ fontSize: "0.9rem", color: "var(--text-2)", marginBottom: 12 }}>
                This topic seems to stand on its own. Add it as an aspect under:
              </p>
              <SpinoffTargetDropdown
                tree={tree}
                suggestions={spinoffSuggestions}
                onAdd={async (targetParentId) => {
                  for (const s of spinoffSuggestions) {
                    await handleAddAspectFromChat({
                      aspect: s.suggested_label,
                      question: s.suggested_question || "",
                      suggestions: s.suggestions || [],
                    }, targetParentId);
                  }
                  setSpinoffSuggestions(null);
                }}
                onDismiss={() => setSpinoffSuggestions(null)}
              />
            </div>
          </div>
        )}

        {pendingNewTopics.length > 0 && phase === "selecting" && (
          <PendingTopicsModal
            topics={pendingNewTopics}
            onApprove={async (topic, index) => {
              const result = await addAspect(sessionId, topic.parentId || "root", topic.aspectDef);
              const newNode = result.aspect;
              setTree(prev => {
                const parent = findNode(prev, topic.parentId || "root");
                return patchNode(prev, topic.parentId || "root", {
                  children: [...(parent?.children || []), newNode],
                });
              });
              setPendingNewTopics(prev => prev.filter((_, i) => i !== index));
            }}
            onReject={(index) => setPendingNewTopics(prev => prev.filter((_, i) => i !== index))}
            onDismissAll={() => setPendingNewTopics([])}
          />
        )}

        <ChatBar
          threads={chatThreads}
          activeThreadId={activeChatThreadId}
          onNewThread={handleNewThread}
          onSelectThread={handleSelectThread}
          onSendMessage={handleSendChatMessage}
          onUseAsAnswer={handleUseAsAnswer}
          onAddAspect={handleAddAspectFromChat}
          onSwitchToThreads={handleSwitchToThreadsView}
          initialExpanded={chatOpen}
          onCollapse={() => { autoLabelThread(activeChatThreadId); setChatOpen(false); }}
          interviewPaused={interviewPaused}
          onResumeInterview={() => setInterviewPaused(false)}
          tree={tree}
        />
      </div>

      {rightPanelOpen && (
        <RightPanel
          tree={tree}
          hoveredNodeId={hoveredNodeId}
          selectedNodeId={selectedNodeId}
          findNode={findNode}
          focusNodeId={focusNodeId}
          objective={objective}
          background={background}
          onCollapse={() => setRightPanelOpen(false)}
          onExplore={handleExploreNode}
        />
      )}
      </div>
    </div>
  );
}
