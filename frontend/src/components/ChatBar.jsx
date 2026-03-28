import { useState, useEffect, useRef } from "react";
import ChatPanel from "./ChatPanel";

export default function ChatBar({
  threads,
  activeThreadId,
  onNewThread,
  onSelectThread,
  onSendMessage,
  onUseAsAnswer,
  onAddAspect,
  onSwitchToThreads,
  initialExpanded,
  onCollapse,
  interviewPaused,
  onResumeInterview,
  tree,
  panelTabs,
  chatContextNodeId,
  chatContextTabId,
  onContextChange,
  isChatWaiting,
  onGeneratePanel,
  leftPanelOpen = true,
  rightPanelOpen = false,
  rightPanelWidth = 280,
}) {
  const [expanded, setExpanded] = useState(initialExpanded || false);
  const [inputDraft, setInputDraft] = useState("");
  const barRef = useRef(null);

  // Offset so the bar stays centered on the visible canvas area
  const canvasOffset = (leftPanelOpen ? 150 : 0) - (rightPanelOpen ? rightPanelWidth / 2 : 0);

  // Cap width so the bar never spills into the panels
  const leftW = leftPanelOpen ? 300 : 0;
  const rightW = rightPanelOpen ? rightPanelWidth : 0;
  const availableW = window.innerWidth - leftW - rightW - 48;
  const chatBarWidth = Math.min(640, Math.max(320, availableW));

  // Sync expanded with parent chatOpen in both directions
  useEffect(() => {
    setExpanded(!!initialExpanded);
  }, [initialExpanded]);

  // Collapse on Escape key or outside click
  useEffect(() => {
    if (!expanded) return;

    function onKeyDown(e) {
      if (e.key === "Escape") {
        setExpanded(false);
        onCollapse?.();
      }
    }

    function onMouseDown(e) {
      if (barRef.current && !barRef.current.contains(e.target)) {
        setExpanded(false);
        onCollapse?.();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [expanded, onCollapse]);

  function handleInputChange(e) {
    setInputDraft(e.target.value);
    if (e.target.value.length > 0 && !expanded) {
      setExpanded(true);
    }
  }

  function handleInputFocus() {
    if (!expanded) {
      setExpanded(true);
      onNewThread?.();
    }
  }

  function handleBarSend(e) {
    e?.preventDefault();
    if (!inputDraft.trim()) return;

    // Ensure there's an active thread; create one if needed
    if (!activeThreadId) {
      onNewThread();
    }
    onSendMessage(inputDraft.trim(), { nodeId: chatContextNodeId, tabId: chatContextTabId });
    setInputDraft("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleBarSend();
    }
  }

  function handleToggleThreadsIcon(e) {
    e.stopPropagation();
    setExpanded(true);
    onSwitchToThreads?.();
  }

  const handleClose = () => { setExpanded(false); onCollapse?.(); };

  return (
    <div className="chat-bar" ref={barRef} style={{ left: `calc(50% + ${canvasOffset}px)`, width: chatBarWidth }}>
      {expanded && (
        <div className="chat-bar__panel">
          <ChatPanel
            threads={threads}
            activeThreadId={activeThreadId}
            onSelectThread={onSelectThread}
            onNewThread={onNewThread}
            onSendMessage={onSendMessage}
            onUseAsAnswer={onUseAsAnswer}
            onAddAspect={onAddAspect}
            onSwitchToThreads={onSwitchToThreads}
            onClose={handleClose}
            tree={tree}
            panelTabs={panelTabs}
            chatContextNodeId={chatContextNodeId}
            chatContextTabId={chatContextTabId}
            onContextChange={onContextChange}
            isChatWaiting={isChatWaiting}
            onGeneratePanel={onGeneratePanel}
            interviewPaused={interviewPaused}
            onResumeInterview={onResumeInterview}
          />
        </div>
      )}

      {interviewPaused && !expanded && (
        <button className="chat-bar__resume-btn" onClick={onResumeInterview}>
          ▶ Resume Interview
        </button>
      )}

      {!expanded && (
        <div className="chat-bar__input-row">
          <input
            className="chat-bar__input"
            type="text"
            placeholder="Ask Midwife..."
            value={inputDraft}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
          />
          <button
            className={`chat-bar__send-btn${inputDraft.trim() ? "" : " chat-bar__send-btn--disabled"}`}
            onClick={handleBarSend}
            disabled={!inputDraft.trim()}
            title="Send"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
