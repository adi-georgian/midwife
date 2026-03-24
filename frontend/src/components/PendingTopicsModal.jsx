export default function PendingTopicsModal({ topics, onApprove, onReject, onDismissAll }) {
  if (!topics || topics.length === 0) return null;

  return (
    <div className="pending-topics-overlay">
      <div className="pending-topics-modal">
        <div className="pending-topics-header">
          <h3 className="pending-topics-title">New Topics Detected</h3>
          <p className="pending-topics-subtitle">
            These topics came up during your interview. Add them to your discourse?
          </p>
        </div>
        <div className="pending-topics-list">
          {topics.map((topic, i) => (
            <div key={i} className="pending-topic-card">
              <div className="pending-topic-main">
                <span className="pending-topic-label">{topic.aspectDef.aspect}</span>
                {topic.aspectDef.question && (
                  <span className="pending-topic-question">{topic.aspectDef.question}</span>
                )}
              </div>
              <p className="pending-topic-context">
                Detected while discussing <strong>{topic.fromAspect}</strong>
                {topic.fromQuestion ? ` — "${topic.fromQuestion.slice(0, 80)}${topic.fromQuestion.length > 80 ? '…' : ''}"` : ''}
              </p>
              <div className="pending-topic-actions">
                <button
                  className="pending-topic-btn pending-topic-btn--approve"
                  onClick={() => onApprove(topic, i)}
                >
                  + Add to Discourse
                </button>
                <button
                  className="pending-topic-btn pending-topic-btn--reject"
                  onClick={() => onReject(i)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="pending-topics-footer">
          <button className="pending-topics-dismiss-all" onClick={onDismissAll}>
            Dismiss All
          </button>
        </div>
      </div>
    </div>
  );
}
