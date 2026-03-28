import { useState, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  useNodesState,
  useEdgesState,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import DiscourseNode from "./DiscourseNode";
import InterviewFlow from "./InterviewFlow";
import ReviewCard from "./ReviewCard";
import ChatBar from "./ChatBar";
import RightPanel from "./RightPanel";
import NodeContextMenu from "./NodeContextMenu";
import CreateNodeModal from "./CreateNodeModal";
import LeftPanel from "./LeftPanel";
import RepurposingModal from "./RepurposingModal";
import PendingTopicsModal from "./PendingTopicsModal";
import { answerAspect, elaborateAspect, addAspect, sendChatMessage, labelChat, deleteAspect, moveAspect, recontextualizeAspect, generatePanelTabs, updateAspect } from "../api";
import { toTitleCase } from "../utils";
import dagre from "@dagrejs/dagre";

const NODE_TYPES = { discourseNode: DiscourseNode };

const H_STEP = 180;
const PARENT_Y = 120;
const MAX_NODE_WIDTH = 280;  // hard cap for column-width uniformity

// Layout spacing constants (used for initial rough positions in buildGraphElements)
const MIN_CHILD_H = 90;    // minimum height allocated per child
const GC_H = 75;           // vertical space allocated per grandchild
const GGC_H = 55;          // vertical space allocated per great-grandchild

// Measured layout constants — legacy manual layout
const MINDMAP_GAP_H = 70;
const MINDMAP_GAP_V = 20;
const MINDMAP_ARM = 300;

// Dagre layout constants
const DAGRE_RANKSEP = 60;  // horizontal gap between levels — needs room for bezier curves
const DAGRE_NODESEP = 20;   // vertical gap between siblings

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
    // Use a prefixed ID so the same tree node never transitions between
    // "parent preview" (1 handle) and "focus" (4 handles) within the same
    // React Flow node instance — that transition confuses RF's handle registry.
    const previewId = `preview-${parentNode.id}`;
    const parentIsTerminal = (parentNode.children || []).filter(c => !c.is_ghost && !c.is_loading).length === 0;
    nodes.push({
      id: previewId,
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
      id: `e-parent-${previewId}-${focusNode.id}`,
      source: previewId,
      target: focusNode.id,
      type: "straight",
      sourceHandle: "bottom",
      targetHandle: "top",
      style: { stroke: "#888", opacity: 0.8, strokeDasharray: "5 5", strokeWidth: 2 },
      data: { baseStyle: { stroke: "#888", opacity: 0.8, strokeDasharray: "5 5", strokeWidth: 2 } },
    });
  }

  const children = (focusNode.children || []).filter(c => !c.is_ghost);
  const leftChildren = children.filter((_, i) => i % 2 === 0);
  const rightChildren = children.filter((_, i) => i % 2 === 1);

  const leftNaturalH = leftChildren.reduce((s, c) => s + childHeight(c, viewMode), 0);
  const rightNaturalH = rightChildren.reduce((s, c) => s + childHeight(c, viewMode), 0);
  const sharedTotalH = Math.max(leftNaturalH, rightNaturalH);

  function placeChildSide(sideChildren, xSign, depth) {
    const side = xSign < 0 ? "left" : "right";
    const srcHandle = xSign < 0 ? "left" : "right";
    const tgtHandle = xSign < 0 ? "right-t" : "left-t";
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
          columnId: `${side}-${depth}`,
          isInterviewing: child.id === interviewingId,
          sourcePosition: srcPos,
          targetPosition: tgtPos,
          isTerminal: childIsTerminal,
          hideAnswer: false,
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
        type: "default",
        sourceHandle: srcHandle,
        targetHandle: tgtHandle,
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
            columnId: `${side}-${depth + 1}`,
            isInterviewing: gc.id === interviewingId,
            sourcePosition: srcPos,
            targetPosition: tgtPos,
            isTerminal: gcIsTerminal,
            hideAnswer: false,
            isDimmed: false,
          },
        });
        const gcBaseStyle = { stroke: "#d4d4d4", strokeWidth: 1 };
        edges.push({
          id: `e-${child.id}-${gc.id}`,
          source: child.id,
          target: gc.id,
          type: "default",
          sourceHandle: srcHandle,
          targetHandle: tgtHandle,
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
                columnId: `${side}-${depth + 2}`,
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
              type: "default",
              sourceHandle: srcHandle,
              targetHandle: tgtHandle,
              style: ggcBaseStyleFull,
              data: { baseStyle: ggcBaseStyleFull },
            });
          }
        });
      });
    });
  }

  placeChildSide(leftChildren, -1, 1);
  placeChildSide(rightChildren, 1, 1);

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

// ── Overview content builder ──────────────────────────────────────────────────

const MODE_DISPLAY_LABELS = {
  logistics: "Logistics", brainstorming: "Brainstorm", creative: "Creative",
  problem_solving: "Problem-solving", decision: "Decision", research: "Research",
  reflection: "Reflect", goal_setting: "Set Goals", learning: "Learn",
};

const BG_FIELD_DISPLAY = {
  helpLevel: "Help focus", priorKnowledge: "Prior knowledge",
  alreadyPlanned: "Already planned", constraints: "Constraints",
  knowledgeLevel: "Familiarity", extraContext: "Additional notes",
};

function buildOverviewContent(objective, background) {
  const parts = [];

  if (objective) {
    parts.push(`Objective\n${objective}`);
  }

  if (background.mode) {
    const modeLabels = background.mode
      .split(",")
      .map(m => MODE_DISPLAY_LABELS[m.trim()] || m.trim())
      .filter(Boolean)
      .join(", ");
    if (modeLabels) parts.push(`Mode\n${modeLabels}`);
  }

  const bgLines = Object.entries(BG_FIELD_DISPLAY)
    .filter(([key]) => background[key]?.trim?.())
    .map(([key, label]) => `• ${label}: ${background[key]}`);

  if (bgLines.length > 0) {
    parts.push(`Context\n${bgLines.join("\n")}`);
  }

  return parts.join("\n\n");
}

// ── Measured layout ───────────────────────────────────────────────────────────

// Returns { nodeId → uniformWidth } for nodes with a columnId.
// All nodes in the same column share the width of the widest, capped at MAX_NODE_WIDTH.
function computeColumnWidths(rfNodes) {
  const groups = {};
  for (const n of rfNodes) {
    const col = n.data?.columnId;
    if (!col || !n.measured?.width) continue;
    (groups[col] ??= []).push(n);
  }
  const nodeWidths = {};
  for (const nodes of Object.values(groups)) {
    const w = Math.min(Math.max(...nodes.map(n => n.measured.width)), MAX_NODE_WIDTH);
    for (const n of nodes) nodeWidths[n.id] = w;
  }
  return nodeWidths;
}

function computeMindmapLayout(rfNodes, rfEdges, focusId, nodeWidths = {}) {
  // All nodes must be measured before we can do a proper layout
  if (rfNodes.some(n => !n.measured)) return null;

  const byId = Object.fromEntries(rfNodes.map(n => [n.id, n]));
  const focus = byId[focusId];
  if (!focus) return null;

  // Build parent→children map from edges
  const childrenOf = {};
  for (const edge of rfEdges) {
    if (!childrenOf[edge.source]) childrenOf[edge.source] = [];
    childrenOf[edge.source].push(edge.target);
  }

  const fw = focus.measured.width;
  const fh = focus.measured.height;
  const fcy = fh / 2; // focus node vertical center

  const positions = { [focusId]: { x: 0, y: 0 } };

  // Direct children of focus (skip parent preview)
  const directChildren = (childrenOf[focusId] || [])
    .map(id => byId[id])
    .filter(n => n && !n.data?.isParentPreview);

  const leftChildren = directChildren.filter(n => rfEdges.find(e => e.source === focusId && e.target === n.id)?.sourceHandle === "left");
  const rightChildren = directChildren.filter(n => rfEdges.find(e => e.source === focusId && e.target === n.id)?.sourceHandle !== "left");

  // Recursively place a group of sibling nodes, centered around centerY
  function placeGroup(group, centerY, getNodeX) {
    if (group.length === 0) return;
    const totalH = group.reduce(
      (s, n) => s + n.measured.height + MINDMAP_GAP_V,
      -MINDMAP_GAP_V
    );
    let y = centerY - totalH / 2;

    for (const node of group) {
      const nh = node.measured.height;
      const nw = nodeWidths[node.id] ?? node.measured.width;
      const nx = getNodeX(nw);
      positions[node.id] = { x: nx, y };

      const nodeCenterY = y + nh / 2;
      const grandchildren = (childrenOf[node.id] || [])
        .map(id => byId[id])
        .filter(Boolean);

      if (grandchildren.length > 0) {
        const isRight = nx >= 0;
        placeGroup(
          grandchildren,
          nodeCenterY,
          gcW => isRight ? nx + nw + MINDMAP_GAP_H : nx - gcW - MINDMAP_GAP_H
        );
      }

      y += nh + MINDMAP_GAP_V;
    }
  }

  // Right children: capped so arm from focus center doesn't exceed MINDMAP_ARM
  const rightStart = Math.min(fw + MINDMAP_GAP_H, fw / 2 + MINDMAP_ARM);
  placeGroup(rightChildren, fcy, () => rightStart);

  // Left children: symmetric — right edge at -rightStart + fw, i.e. -(rightStart - fw + width + gap)
  const leftGap = rightStart - fw; // gap from focus left edge to children
  placeGroup(leftChildren, fcy, w => -(w + leftGap));

  // Parent preview: centered horizontally above focus
  const parentPreview = rfNodes.find(n => n.data?.isParentPreview);
  if (parentPreview?.measured) {
    const pw = parentPreview.measured.width;
    const ph = parentPreview.measured.height;
    positions[parentPreview.id] = {
      x: fw / 2 - pw / 2,
      y: -(ph + MINDMAP_GAP_H),
    };
  }

  return positions;
}

function computeDagreLayout(rfNodes, rfEdges, focusId, nodeWidths = {}) {
  if (rfNodes.some(n => !n.measured)) return null;

  const byId = Object.fromEntries(rfNodes.map(n => [n.id, n]));
  const focus = byId[focusId];
  if (!focus) return null;

  const fw = focus.measured.width;
  const fh = focus.measured.height;

  const childrenOf = {};
  for (const e of rfEdges) {
    if (!childrenOf[e.source]) childrenOf[e.source] = [];
    childrenOf[e.source].push(e.target);
  }

  const directKids = (childrenOf[focusId] || [])
    .map(id => byId[id])
    .filter(n => n && !n.data?.isParentPreview);
  const leftKids  = directKids.filter(n => rfEdges.find(e => e.source === focusId && e.target === n.id)?.sourceHandle === "left");
  const rightKids = directKids.filter(n => rfEdges.find(e => e.source === focusId && e.target === n.id)?.sourceHandle !== "left");

  const positions = { [focusId]: { x: 0, y: 0 } };

  function collectSubtree(roots) {
    const visited = new Set();
    const queue = roots.map(n => n.id);
    while (queue.length) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      (childrenOf[id] || []).forEach(cid => {
        if (byId[cid] && !byId[cid].data?.isParentPreview) queue.push(cid);
      });
    }
    return [...visited].map(id => byId[id]).filter(Boolean);
  }

  function layoutSide(sideKids, direction) {
    if (sideKids.length === 0) return;

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: direction, ranksep: DAGRE_RANKSEP, nodesep: DAGRE_NODESEP, marginx: 0, marginy: 0 });
    g.setDefaultEdgeLabel(() => ({}));

    g.setNode(focusId, { width: fw, height: fh });

    const subtreeNodes = collectSubtree(sideKids);
    subtreeNodes.forEach(n => g.setNode(n.id, { width: nodeWidths[n.id] ?? n.measured.width, height: n.measured.height }));

    sideKids.forEach(kid => g.setEdge(focusId, kid.id));
    subtreeNodes.forEach(n => {
      (childrenOf[n.id] || []).forEach(cid => {
        if (byId[cid] && subtreeNodes.some(sn => sn.id === cid)) g.setEdge(n.id, cid);
      });
    });

    dagre.layout(g);

    const fp = g.node(focusId);

    // Raw top-left positions from dagre centers
    const raw = {};
    subtreeNodes.forEach(n => {
      const dp = g.node(n.id);
      if (!dp) return;
      const nw = nodeWidths[n.id] ?? n.measured.width;
      raw[n.id] = {
        x: (dp.x - fp.x) + fw / 2 - nw / 2,
        y: (dp.y - fp.y) + fh / 2 - n.measured.height / 2,
      };
    });

    // BFS to determine rank (depth from focus) for each node
    const rankOf = {};
    const bfsQueue = sideKids.map(n => [n.id, 1]);
    for (let i = 0; i < bfsQueue.length; i++) {
      const [id, rank] = bfsQueue[i];
      if (rankOf[id] !== undefined) continue;
      rankOf[id] = rank;
      (childrenOf[id] || []).forEach(cid => {
        if (byId[cid] && !byId[cid].data?.isParentPreview) bfsQueue.push([cid, rank + 1]);
      });
    }

    // Group nodes by rank, then align edges within each rank
    const byRank = {};
    subtreeNodes.forEach(n => {
      const r = rankOf[n.id] ?? 1;
      if (!byRank[r]) byRank[r] = [];
      byRank[r].push(n);
    });

    Object.values(byRank).forEach(rankNodes => {
      if (direction === "LR") {
        // Right side: align right edges — grandchildren always sit further right
        // than any sibling, preventing a wide sibling from reaching into deeper ranks.
        const maxRight = Math.max(...rankNodes.map(n => raw[n.id].x + (nodeWidths[n.id] ?? n.measured.width)));
        rankNodes.forEach(n => { positions[n.id] = { x: maxRight - (nodeWidths[n.id] ?? n.measured.width), y: raw[n.id].y }; });
      } else {
        // Left side: align left edges to the leftmost node in the rank.
        // This ensures grandchildren always sit further from the focus than any
        // sibling node — a wider sibling can never "reach into" a deeper rank.
        const minX = Math.min(...rankNodes.map(n => raw[n.id].x));
        rankNodes.forEach(n => { positions[n.id] = { x: minX, y: raw[n.id].y }; });
      }
    });
  }

  layoutSide(rightKids, "LR");
  layoutSide(leftKids,  "RL");

  const parentPreview = rfNodes.find(n => n.data?.isParentPreview);
  if (parentPreview?.measured) {
    const pw = parentPreview.measured.width;
    const ph = parentPreview.measured.height;
    positions[parentPreview.id] = { x: fw / 2 - pw / 2, y: -(ph + DAGRE_RANKSEP) };
  }

  return positions;
}

function AutoLayout({ focusNodeId, layoutEngine, graphVersion }) {
  const { getNodes, getEdges, setNodes, fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const layoutKeyRef = useRef(null);

  // Reset layout key whenever focus changes OR the graph is rebuilt (tree/viewMode change)
  useEffect(() => {
    layoutKeyRef.current = null;
  }, [focusNodeId, graphVersion]);

  useEffect(() => {
    if (!nodesInitialized) return;

    const rfNodes = getNodes();
    const rfEdges = getEdges();

    const key = focusNodeId + "|" + rfNodes
      .map(n => `${n.id}:${n.measured?.width | 0}:${n.measured?.height | 0}`)
      .sort()
      .join("|");
    if (key === layoutKeyRef.current) return;
    layoutKeyRef.current = key;

    const nodeWidths = computeColumnWidths(rfNodes);

    const newPositions = layoutEngine === "dagre"
      ? computeDagreLayout(rfNodes, rfEdges, focusNodeId, nodeWidths)
      : computeMindmapLayout(rfNodes, rfEdges, focusNodeId, nodeWidths);
    if (!newPositions) return;

    setNodes(prev => prev.map(n => {
      const pos = newPositions[n.id];
      const nw = nodeWidths[n.id];
      if (pos === undefined && nw === undefined) return n;
      return {
        ...n,
        ...(pos !== undefined ? { position: pos } : {}),
        ...(nw !== undefined ? { data: { ...n.data, nodeWidth: nw } } : {}),
      };
    }));

    setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 0);
  }, [nodesInitialized, focusNodeId, layoutEngine, graphVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DiscourseCanvas({ sessionId, tree, setTree, objective, discourseTitle, background = {}, onSessionChange, onHome, initialInterviewQueue = null, onInterviewCycleComplete = null, onContinueExploring = null, onFinishPlanning = null, theme = "sepia", onThemeChange, initialPanelTabs = null }) {
  // If an initialInterviewQueue is provided (from briefing), start in interviewing phase directly
  const [phase, setPhase] = useState(() => {
    if (initialInterviewQueue && initialInterviewQueue.length > 0) return "interviewing";
    // Exclude briefing-idea nodes (pre-answered locally) from the "resumed session" check
    const hasAnswers = (tree?.children || []).some(c => c.answer !== null && !c._briefingIdea);
    return hasAnswers ? "selecting" : "signoff";
  });

  // Interview queue populated after signoff confirmation OR passed in from briefing
  const [interviewQueue, setInterviewQueue] = useState(initialInterviewQueue || []);
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
  const [rightPanelWidth, setRightPanelWidth] = useState(280);

  function handleRightPanelWidthChange(w) {
    setRightPanelWidth(w);
    rfRef.current?.fitView({ padding: 0.15, duration: 0 });
  }

  const [nodeMenu, setNodeMenu] = useState(null);
  const [movingNodeId, setMovingNodeId] = useState(null);
  const [createChildParentId, setCreateChildParentId] = useState(null);

  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const lastNodeClickRef = useRef({ nodeId: null, time: 0 });

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
  const setTheme = onThemeChange ?? (() => {});
  const [layoutEngine, setLayoutEngine] = useState("dagre");
  const settingsPanelRef = useRef(null);
  const settingsBtnRef = useRef(null);

  // Recontextualization state
  const [spinoffSuggestions, setSpinoffSuggestions] = useState(null);
  const [pendingRelabelings, setPendingRelabelings] = useState([]);
  const [showRepurposing, setShowRepurposing] = useState(false);

  const currentNode = phase === "interviewing" ? interviewQueue[interviewIndex] : null;

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [graphVersion, setGraphVersion] = useState(0);

  const rfRef = useRef(null);

  // Chat state
  const [chatThreads, setChatThreads] = useState([]);
  const [activeChatThreadId, setActiveChatThreadId] = useState(null);
  const [isChatWaiting, setIsChatWaiting] = useState(false);

  // Panel summary state — restore from session if available, else build from objective
  const [panelTabs, setPanelTabs] = useState(() => {
    if (initialPanelTabs && initialPanelTabs.length > 0) return initialPanelTabs;
    return [{ id: "overview", title: "Overview", content: "" }];
  });
  const [activePanelTabId, setActivePanelTabId] = useState("overview");
  const [isPanelGenerating, setIsPanelGenerating] = useState(false);
  const [planStale, setPlanStale] = useState(false);
  const [discourseFinished, setDiscourseFinished] = useState(false);

  // Chat context selectors (auto-sync with focus node and active panel tab)
  const [chatContextNodeId, setChatContextNodeId] = useState("root");
  const [chatContextTabId, setChatContextTabId] = useState("overview");

  useEffect(() => { setChatContextNodeId(focusNodeId); }, [focusNodeId]);
  useEffect(() => { setChatContextTabId(activePanelTabId); }, [activePanelTabId]);

  // Compute focus path as a Set for the left panel
  const focusPathIds = new Set(focusPath.map(n => n.id));

  useEffect(() => {
    if (!tree) return;
    const { nodes: n, edges: e } = buildGraphElements(tree, currentNode?.id, focusNodeId, viewMode);
    // Carry over nodeWidth for non-column nodes only (focus, parent-preview).
    // Column nodes must NOT carry over — they need to re-measure at natural width so
    // computeColumnWidths can correctly pick the widest node in the column.
    setNodes(prev => {
      const existingWidths = Object.fromEntries(
        prev.filter(p => p.data?.nodeWidth && !p.data?.columnId).map(p => [p.id, p.data.nodeWidth])
      );
      return n.map(node =>
        existingWidths[node.id]
          ? { ...node, data: { ...node.data, nodeWidth: existingWidths[node.id] } }
          : node
      );
    });
    setEdges(e);
    setGraphVersion(v => v + 1);
    // AutoLayout handles fitView after measuring node dimensions
  }, [tree, currentNode?.id, focusNodeId, viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Separate hover effect — updates dimming in-place without resetting positions or fitView
  useEffect(() => {
    if (!hoveredNodeId) {
      setNodes(prev => prev.map(n => ({ ...n, data: { ...n.data, isDimmed: false } })));
      setEdges(prev => prev.map(e => ({ ...e, style: e.data?.baseStyle ?? e.style })));
      return;
    }
    // Highlight full ancestor path from root to hovered node
    const path = tree ? findPath(tree, hoveredNodeId) : null;
    const pathIds = path ? path.map(p => p.id) : [];
    const pathSet = new Set(pathIds);
    // Build set of consecutive parent→child pairs on the path
    const pathEdgePairs = new Set();
    for (let i = 0; i < pathIds.length - 1; i++) {
      pathEdgePairs.add(`${pathIds[i]}|${pathIds[i + 1]}`);
    }
    setNodes(prev => prev.map(n => ({
      ...n,
      data: { ...n.data, isDimmed: !pathSet.has(n.id) && n.id !== exploringNodeId },
    })));
    setEdges(prev => prev.map(e => {
      const isHighlighted = pathEdgePairs.has(`${e.source}|${e.target}`) || pathEdgePairs.has(`${e.target}|${e.source}`);
      const base = e.data?.baseStyle ?? e.style;
      if (isHighlighted) {
        return { ...e, style: { ...base, stroke: "#8480E8", strokeWidth: 2.5, opacity: 1, strokeDasharray: undefined } };
      }
      return { ...e, style: { ...base, opacity: 0.12 } };
    }));
  }, [hoveredNodeId, exploringNodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  function rebuildLayout() {
    if (!tree) return;
    const { nodes: n, edges: e } = buildGraphElements(tree, currentNode?.id, focusNodeId, viewMode);
    setNodes(n);
    setEdges(e);
    setTimeout(() => rfRef.current?.fitView({ padding: 0.15, duration: 300 }), 0);
  }


  // Show interview overlay when queue is ready and we're in interviewing phase
  useEffect(() => {
    if (phase !== "interviewing" || interviewQueue.length === 0) return;
    setInterviewReady(true);
  }, [interviewQueue, phase]);

  // Respond to a new initialInterviewQueue arriving (repeat briefing cycles)
  useEffect(() => {
    if (!initialInterviewQueue || initialInterviewQueue.length === 0) return;
    setInterviewQueue(initialInterviewQueue);
    setInterviewIndex(0);
    setReviewing(false);
    setPhase("interviewing");
  }, [initialInterviewQueue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fit canvas when the interview overlay drops (chat opens or phase ends)
  useEffect(() => {
    if (interviewPaused) {
      setTimeout(() => rfRef.current?.fitView({ padding: 0.15, duration: 400 }), 80);
    }
  }, [interviewPaused]);

  useEffect(() => {
    if (phase === "selecting") {
      setTimeout(() => rfRef.current?.fitView({ padding: 0.15, duration: 400 }), 80);
    }
  }, [phase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      rfRef.current?.fitView({ padding: 0.15, duration: 300 });
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
    if (!sessionId || !panelTabs || panelTabs.length === 0) return;
    // Only persist if the plan has real generated content (more than just the basic overview)
    if (panelTabs.length === 1 && panelTabs[0].id === "overview") return;
    onSessionChange?.({
      sessionId,
      objective,
      discourseName: discourseTitle,
      tree,
      panelTabs,
      savedAt: Date.now(),
    });
  }, [panelTabs]);

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

  async function handleReviewSubmit() {
    setReviewing(false);
    setPhase("selecting");
    setLeftPanelOpen(true);
    // Fire plan generation and recontextualize in parallel — they don't depend on each other
    handleGeneratePanel();
    const lastNode = interviewQueue[interviewQueue.length - 1];
    if (lastNode && sessionId) {
      setIsRecontextualizing(true);
      recontextualizeAspect(sessionId, lastNode.id).then(data => {
        setIsRecontextualizing(false);
        if (data.updated_ancestors?.length > 0) {
          setTree(prev => {
            const changes = data.updated_ancestors.map(u => {
              const oldNode = findNode(prev, u.id);
              return { id: u.id, oldLabel: oldNode?.aspect || u.id, newLabel: u.new_aspect };
            });
            setPendingRelabelings(changes);
            if (changes.length > 0) setShowRepurposing(true);
            return prev;
          });
        }
        if (data.spinoff_suggestions?.length > 0) setPendingSpinoffs(data.spinoff_suggestions);
        flushPendingSpinoffs();
      }).catch(() => setIsRecontextualizing(false));
    } else {
      flushPendingSpinoffs();
    }
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
    // Exclude already-answered aspects (e.g. ideas auto-answered from briefing)
    const children = (parent?.children || []).filter(c => !c.is_ghost && !c.is_loading && !c.answer);
    setInterviewQueue(children);
    setInterviewIndex(0);
    setSignoffParentId(null);
    setPhase("interviewing");
  }

  async function handleAnswer(answer) {
    const node = interviewQueue[interviewIndex];
    let description;
    try {
      const resp = await answerAspect(sessionId, node.id, answer);
      description = resp?.description ?? null;
    } catch (err) {
      setApiError(err.message);
      return;
    }
    setTree(prev => patchNode(prev, node.id, { answer, ...(description ? { description } : {}) }));
    setInterviewQueue(prev => prev.map(n => n.id === node.id ? { ...n, answer } : n));

    // Reset chatAnswerCleared when moving to a new question
    setChatThreads(prev => prev.map(t =>
      t.aspectId === node.id ? { ...t, chatAnswerCleared: false } : t
    ));

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
      answerAspect(sessionId, node.id, currentAnswer).then(resp => {
        if (resp?.description) setTree(prev => patchNode(prev, node.id, { answer: currentAnswer, description: resp.description }));
      });
      setTree(prev => patchNode(prev, node.id, { answer: currentAnswer }));
      setInterviewQueue(prev => prev.map(n => n.id === node.id ? { ...n, answer: currentAnswer } : n));
    }
    setInterviewIndex(i => i - 1);
  }

  function handleSaveAndNext(currentAnswer) {
    if (currentAnswer) {
      const node = interviewQueue[interviewIndex];
      answerAspect(sessionId, node.id, currentAnswer).then(resp => {
        if (resp?.description) setTree(prev => patchNode(prev, node.id, { answer: currentAnswer, description: resp.description }));
      });
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

    if (nodeData.isParentPreview) { navigateTo(nodeData.id); return; }
    if (nodeData.is_ghost || nodeData.isGhostDisplay || nodeData.is_loading) return;
    if (nodeData.isFocus || nodeData.isRoot) return;

    if (phase === "selecting") {
      const now = Date.now();
      const last = lastNodeClickRef.current;
      if (last.nodeId === rfNode.id && now - last.time < 400) {
        lastNodeClickRef.current = { nodeId: null, time: 0 };
        setSelectedNodeId(null);
        setLeftPanelOpen(true);
        navigateTo(rfNode.id);
        return;
      }
      lastNodeClickRef.current = { nodeId: rfNode.id, time: now };
      setSelectedNodeId(prev => prev === rfNode.id ? null : rfNode.id);
      setLeftPanelOpen(true);
    }
  }

  function handleNodeDoubleClick(event, rfNode) {
    const nodeData = rfNode.data;
    if (nodeData.is_ghost || nodeData.isGhostDisplay || nodeData.is_loading) return;
    if (nodeData.isFocus || nodeData.isRoot) return;
    if (nodeData.isParentPreview) return;
    if (phase !== "selecting") return;
    setSelectedNodeId(null);
    setLeftPanelOpen(true);
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

  async function handleEditAspect(nodeId, fields) {
    try {
      await updateAspect(sessionId, nodeId, fields);
    } catch (err) { setApiError(err.message); return; }
    setTree(prev => patchNode(prev, nodeId, fields));
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

  async function handleGeneratePanel() {
    setIsPanelGenerating(true);
    setPlanStale(false);
    setRightPanelOpen(true);
    try {
      const { tabs } = await generatePanelTabs(sessionId);
      // Only update if at least one tab has real content
      if (tabs.some(t => t.content?.trim())) {
        setPanelTabs(tabs);
        if (tabs.length > 0) setActivePanelTabId(tabs[0].id);
      }
    } catch (err) {
      setApiError(err.message);
    } finally {
      setIsPanelGenerating(false);
    }
  }

  async function handleSendChatMessage(content, context) {
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

    const tabId = context?.tabId ?? chatContextTabId;
    const tabContext = tabId && panelTabs
      ? (() => { const t = panelTabs.find(t => t.id === tabId); return t ? { tab_id: t.id, tab_title: t.title } : null; })()
      : null;

    setIsChatWaiting(true);
    let data;
    try {
      data = await sendChatMessage(sessionId, updatedMessages, aspectContext, tabContext);
    } catch (err) {
      setApiError(err.message);
      setIsChatWaiting(false);
      return;
    }
    setIsChatWaiting(false);

    // Handle updated aspect/question from chat
    if (data.updated_aspect && thread.aspectId) {
      const patch = { aspect: data.updated_aspect };
      if (data.updated_question) patch.question = data.updated_question;
      setTree(prev => patchNode(prev, thread.aspectId, patch));
      setInterviewQueue(prev => prev.map(n =>
        n.id === thread.aspectId ? { ...n, ...patch } : n
      ));
    }

    // Handle updated panel tab content from chat
    if (data.updated_tab && panelTabs) {
      setPanelTabs(prev => prev.map(t =>
        t.id === data.updated_tab.id ? { ...t, content: data.updated_tab.content } : t
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
    let description;
    try {
      const resp = await answerAspect(sessionId, aspectId, content);
      description = resp?.description ?? null;
    } catch (err) { setApiError(err.message); return; }
    setTree(prev => patchNode(prev, aspectId, { answer: content, ...(description ? { description } : {}) }));
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

  function pruneEmptyThreads(threads) {
    return threads.filter(t => t.messages.length > 0);
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
    setChatThreads(prev => [...pruneEmptyThreads(prev), thread]);
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
        <div className="canvas-header-left" />
        <span className="canvas-brand" onClick={onHome} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && onHome?.()}>midWife</span>
        <div className="canvas-header-actions">
          <button className="canvas-header-btn" onClick={handleExport}>↓ Export</button>
          <div style={{ position: "relative" }}>
            <button
              ref={settingsBtnRef}
              className="canvas-header-btn"
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
          onEditAspect={handleEditAspect}
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
          discourseFinished={discourseFinished}
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
          <button className="canvas-float-btn" onClick={() => { rebuildLayout(); setGraphVersion(v => v + 1); }}>↺ Reset</button>
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
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onPaneClick={() => setSelectedNodeId(null)}
          onNodeMouseEnter={(_, n) => setHoveredNodeId(n.id)}
          onNodeMouseLeave={() => setHoveredNodeId(null)}
          onInit={rf => (rfRef.current = rf)}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.2}
          maxZoom={2}
        >
          <AutoLayout focusNodeId={focusNodeId} layoutEngine={layoutEngine} graphVersion={graphVersion} />
          <Background color={theme === "dark" ? "#252838" : "#D4C4B0"} gap={28} variant="dots" size={1} />
          <Controls showFitView={false}>
            <ControlButton
              onClick={() => { setLeftPanelOpen(false); setRightPanelOpen(false); }}
              title="Collapse panels"
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 4h4v12H3V4zm10 0h4v12h-4V4zM8 4h4v12H8V4z" opacity="0.25"/>
                <path d="M3 4h4v12H3V4zm10 0h4v12h-4V4z"/>
                <path d="M5 7l-2 3 2 3M15 7l2 3-2 3" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round"/>
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
            onSubmit={handleReviewSubmit}
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
              handleGeneratePanel();
            }}
            onSkip={() => {
              setPendingRelabelings([]);
              setShowRepurposing(false);
              flushPendingSpinoffs();
              setPhase("selecting");
              setLeftPanelOpen(true);
              handleGeneratePanel();
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
          onCollapse={() => { autoLabelThread(activeChatThreadId); setChatThreads(prev => pruneEmptyThreads(prev)); setChatOpen(false); }}
          interviewPaused={interviewPaused}
          onResumeInterview={() => setInterviewPaused(false)}
          tree={tree}
          panelTabs={panelTabs}
          chatContextNodeId={chatContextNodeId}
          chatContextTabId={chatContextTabId}
          onContextChange={(nodeId, tabId) => { setChatContextNodeId(nodeId); setChatContextTabId(tabId); }}
          isChatWaiting={isChatWaiting}
          onGeneratePanel={handleGeneratePanel}
          leftPanelOpen={leftPanelOpen}
          rightPanelOpen={rightPanelOpen}
          rightPanelWidth={rightPanelWidth}
        />
      </div>

      {rightPanelOpen && (
        <RightPanel
          tree={tree}
          hoveredNodeId={hoveredNodeId}
          selectedNodeId={selectedNodeId}
          findNode={findNode}
          focusNodeId={focusNodeId}
          phase={phase}
          panelTabs={panelTabs}
          onGeneratePanel={handleGeneratePanel}
          isPanelGenerating={isPanelGenerating}
          onCollapse={() => setRightPanelOpen(false)}
          onContinueExploring={onContinueExploring}
          onFinishPlanning={() => {
            setDiscourseFinished(true);
            if (onFinishPlanning) onFinishPlanning();
          }}
          discourseFinished={discourseFinished}
          width={rightPanelWidth}
          onWidthChange={handleRightPanelWidthChange}
        />
      )}
      </div>
    </div>
  );
}
