import { useState, useRef, useEffect, useMemo } from "react";

function flattenTree(node, depth = 0, result = []) {
  if (!node || node.is_ghost || node.is_loading) return result;
  result.push({ id: node.id, label: node.aspect, depth });
  for (const child of (node.children || [])) {
    flattenTree(child, depth + 1, result);
  }
  return result;
}

export default function ChatPanel({
  sessionId,
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onSendMessage,
  onUseAsAnswer,
  onSwitchToThreads,
  onClose,
  tree,
  panelTabs,
  chatContextNodeId,
  chatContextTabId,
  onContextChange,
  isChatWaiting,
  interviewPaused,
  onResumeInterview,
}) {
  const [inputDraft, setInputDraft] = useState("");
  const [panelView, setPanelView] = useState("chat");
  const [usedAnswer, setUsedAnswer] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const flatNodes = useMemo(() => (tree ? flattenTree(tree) : []), [tree]);

  const activeThread = threads.find(t => t.id === activeThreadId) || null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThread?.messages?.length, isChatWaiting]);

  // Auto-grow textarea
  function handleInputChange(e) {
    setInputDraft(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function handleSend(e) {
    e?.preventDefault();
    if (!inputDraft.trim()) return;
    onSendMessage(inputDraft.trim(), { nodeId: chatContextNodeId, tabId: chatContextTabId });
    setInputDraft("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleChooseAnswer(aspectId, ans) {
    setUsedAnswer(ans);
    onUseAsAnswer(aspectId, ans);
  }

  function handleSwitchToThreads() {
    onSwitchToThreads?.();
    setPanelView("threads");
  }

  // Empty state — no threads yet
  if (threads.length === 0) {
    return (
      <div className="chat-panel-inner">
        <div className="chat-panel-header">
          <span className="chat-panel-title">Chat</span>
          {onClose && <button className="chat-panel-close" onClick={onClose} title="Close">×</button>}
        </div>
        <div className="chat-empty-state">
          <p>No conversations yet.</p>
          <button className="chat-new-thread" onClick={onNewThread}>+ New Chat</button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-panel-inner">
      <div className="chat-panel-header">
        <button
          className="chat-threads-toggle"
          onClick={handleSwitchToThreads}
          title="Conversations"
        >
          ≡
        </button>
        <span className="chat-panel-title">
          {panelView === "threads" ? "Conversations" : (activeThread?.title || "Chat")}
        </span>
        {onClose && <button className="chat-panel-close" onClick={onClose} title="Close">×</button>}
      </div>

      {panelView === "threads" && (
        <div className="chat-threads-list">
          <button
            className="chat-new-thread"
            onClick={() => { onNewThread(); setPanelView("chat"); }}
          >
            + New Chat
          </button>
          {threads.map(t => (
            <button
              key={t.id}
              className={`chat-thread-row${t.id === activeThreadId ? " active" : ""}`}
              onClick={() => { onSelectThread(t.id); setPanelView("chat"); }}
            >
              <span className="chat-thread-row__title">{t.title}</span>
              <span className="chat-thread-row__count">{t.messages.length}</span>
            </button>
          ))}
        </div>
      )}

      {panelView === "chat" && activeThread && (
        <>
          <div className="chat-messages">
            {activeThread.messages.map((msg, i) => (
              <div key={i} className={`chat-message chat-message--${msg.role}`}>
                <p>{msg.content}</p>
                {msg.role === "assistant" && msg.suggestedAnswers?.length > 0 && activeThread.aspectId && (
                  <div className="choose-answers-row">
                    {msg.suggestedAnswers.map((ans, k) => {
                      const isUsed = usedAnswer === ans || (activeThread.resolvedAnswerFor && !usedAnswer);
                      const wasChosen = usedAnswer === ans;
                      return (
                        <button
                          key={k}
                          className={`choose-answer${wasChosen ? " choose-answer--used" : ""}`}
                          disabled={!!activeThread.resolvedAnswerFor || !!usedAnswer}
                          onClick={() => handleChooseAnswer(activeThread.aspectId, ans)}
                        >
                          {wasChosen ? `✓ Selected "${ans}"` : `Choose "${ans}"`}
                        </button>
                      );
                    })}
                  </div>
                )}
                {msg.role === "assistant" && msg.suggestedAnswer && !msg.suggestedAnswers?.length && activeThread.aspectId && (
                  <button
                    className={`choose-answer${usedAnswer === msg.suggestedAnswer || activeThread.resolvedAnswerFor ? " choose-answer--used" : ""}`}
                    disabled={!!activeThread.resolvedAnswerFor || !!usedAnswer}
                    onClick={() => handleChooseAnswer(activeThread.aspectId, msg.suggestedAnswer)}
                  >
                    {usedAnswer === msg.suggestedAnswer || activeThread.resolvedAnswerFor
                      ? `✓ Selected "${msg.suggestedAnswer}"`
                      : `Choose "${msg.suggestedAnswer}"`}
                  </button>
                )}
              </div>
            ))}
            {isChatWaiting && (
              <div className="chat-message chat-message--assistant chat-typing">
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          {interviewPaused && (
            <button className="chat-bar__resume-btn" onClick={onResumeInterview}>
              ▶ Resume Interview
            </button>
          )}
          {(flatNodes.length > 0 || panelTabs) && (
            <div className="chat-context-row">
              <span className="chat-context-label">About</span>
              {flatNodes.length > 0 && (
                <select
                  className="chat-context-select"
                  value={chatContextNodeId || ""}
                  onChange={e => onContextChange?.(e.target.value, chatContextTabId)}
                >
                  {flatNodes.map(n => (
                    <option key={n.id} value={n.id}>
                      {'\u00A0'.repeat(n.depth * 2)}{n.label}
                    </option>
                  ))}
                </select>
              )}
              {panelTabs && panelTabs.length > 0 && (
                <>
                  <span className="chat-context-sep">in</span>
                  <select
                    className="chat-context-select"
                    value={chatContextTabId || ""}
                    onChange={e => onContextChange?.(chatContextNodeId, e.target.value)}
                  >
                    {panelTabs.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}
          <form className="chat-input-row" onSubmit={handleSend}>
            <textarea
              ref={textareaRef}
              value={inputDraft}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Ask Midwife anything… (Shift+Enter for newline)"
            />
            <button type="submit" title="Send">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </form>
        </>
      )}

      {panelView === "chat" && !activeThread && (
        <div className="chat-empty-state">
          <p>Select or start a conversation.</p>
          <button className="chat-new-thread" onClick={() => { onNewThread(); setPanelView("chat"); }}>+ New Chat</button>
        </div>
      )}
    </div>
  );
}
