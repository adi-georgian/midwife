export default function ReviewCard({ queue, onEdit, onSubmit }) {
  return (
    <div className="review-overlay">
      <div className="review-card">
        <h3>Review your answers</h3>
        <ul className="review-list">
          {queue.map((node, i) => (
            <li key={node.id} className="review-row">
              <span className="review-aspect">{node.aspect}</span>
              <span className="review-answer">{node.answer || <em>unanswered</em>}</span>
              <button className="review-edit-btn" onClick={() => onEdit(i)}>Edit</button>
            </li>
          ))}
        </ul>
        <button className="review-submit-btn" onClick={onSubmit}>Looks good →</button>
      </div>
    </div>
  );
}
