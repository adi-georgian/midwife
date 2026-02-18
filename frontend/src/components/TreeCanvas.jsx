import { useState } from "react";
import TreeNode from "./TreeNode";
import QuestionPanel from "./QuestionPanel";
import { answerAspect, elaborateAspect, getTree } from "../api";

export default function TreeCanvas({ sessionId, tree, setTree, objective }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(false);

  async function refreshTree() {
    const data = await getTree(sessionId);
    setTree(data.root);
  }

  async function handleAnswer(aspectId, answer) {
    await answerAspect(sessionId, aspectId, answer);
    await refreshTree();
    setSelectedNode(null);
  }

  async function handleElaborate(aspectId) {
    setLoading(true);
    await elaborateAspect(sessionId, aspectId);
    await refreshTree();
    setSelectedNode(null);
    setLoading(false);
  }

  return (
    <div className="tree-canvas">
      <h2 className="objective-title">{objective}</h2>
      {loading && <p className="loading">Generating sub-questions...</p>}
      <div className="tree-container">
        {tree && (
          <TreeNode
            node={tree}
            onSelect={node => setSelectedNode(node)}
            selectedId={selectedNode?.id}
          />
        )}
      </div>
      {selectedNode && (
        <QuestionPanel
          node={selectedNode}
          onAnswer={answer => handleAnswer(selectedNode.id, answer)}
          onElaborate={() => handleElaborate(selectedNode.id)}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}
