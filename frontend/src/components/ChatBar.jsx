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
}) {
  const [expanded, setExpanded] = useState(initialExpanded || false);
  const [inputDraft, setInputDraft] = useState("");
  const barRef = useRef(null);

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
    <div className="chat-bar" ref={barRef}>
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
          />
        </div>
      )}

      {interviewPaused && (
        <button className="chat-bar__resume-btn" onClick={onResumeInterview}>
          ▶ Resume Interview
        </button>
      )}

      {!expanded && (
        <div className="chat-bar__input-row">
          <button
            className="chat-bar__threads-btn"
            onClick={handleToggleThreadsIcon}
            title="Conversations"
          >
            ≡ Chats
          </button>
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
