import { useState, useEffect } from 'react';
import { renderClozeFront, renderClozeBack } from '../lib/cloze.jsx';

export default function Card({ front, back, explanation, type, onFlip }) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setFlipped(false);
  }, [front, back]);

  const toggle = () => {
    const next = !flipped;
    setFlipped(next);
    if (next && onFlip) onFlip();
  };

  return (
    <div
      onClick={toggle}
      style={{
        perspective: 1200,
        cursor: 'pointer',
        minHeight: 280,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 280,
          transformStyle: 'preserve-3d',
          transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
        }}
      >
        <Face front>
          {type === 'cloze' ? renderClozeFront(front) : <span>{front}</span>}
        </Face>
        <Face>
          {type === 'cloze' ? (
            <div>{renderClozeBack(back)}</div>
          ) : (
            <div>{back}</div>
          )}
          {explanation && (
            <p style={{ marginTop: 16, fontSize: 14, color: 'var(--fg-dim)' }}>{explanation}</p>
          )}
        </Face>
      </div>
      <p className="dim center" style={{ marginTop: 12, fontSize: 13 }}>
        {flipped ? 'Comment c\'est passé ?' : 'Tape pour révéler'}
      </p>
    </div>
  );
}

function Face({ front, children }) {
  return (
    <div
      style={{
        position: front ? 'relative' : 'absolute',
        top: 0, left: 0, width: '100%', minHeight: 280,
        backfaceVisibility: 'hidden',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        fontSize: 18,
        lineHeight: 1.5,
        transform: front ? 'rotateY(0)' : 'rotateY(180deg)',
      }}
    >
      {children}
    </div>
  );
}
