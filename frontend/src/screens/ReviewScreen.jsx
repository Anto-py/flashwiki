import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getSessionCards, rateCard } from '../api/client.js';
import Card from '../components/Card.jsx';
import { useOfflineQueue } from '../hooks/useOfflineQueue.js';

const RATING_BUTTONS = [
  { value: 1, label: 'Encore', color: 'var(--accent-red)' },
  { value: 2, label: 'Difficile', color: '#e08e3c' },
  { value: 3, label: 'Bon', color: 'var(--accent-blue)' },
  { value: 4, label: 'Facile', color: 'var(--accent-green)' },
];

export default function ReviewScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const theme = params.get('theme');
  const limitParam = Number(params.get('limit')) || null;
  const aheadParam = params.get('ahead') === '1';

  const [cards, setCards] = useState(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { enqueue, online } = useOfflineQueue();

  useEffect(() => {
    getSessionCards(limitParam ?? 50, theme, aheadParam)
      .then((res) => {
        setCards(res.cards);
        if (res.cards.length === 0) navigate('/', { replace: true });
      })
      .catch((e) => setError(e.message));
  }, [theme, limitParam, aheadParam, navigate]);

  if (error) {
    return (
      <div className="screen">
        <button onClick={() => navigate('/')}>← Retour</button>
        <div className="error-banner">{error}</div>
      </div>
    );
  }

  if (!cards) {
    return <div className="screen"><p className="dim">Chargement…</p></div>;
  }

  const current = cards[index];
  if (!current) {
    return <div className="screen"><p className="dim">Plus de cartes.</p></div>;
  }

  async function handleRate(rating) {
    if (submitting) return;
    setSubmitting(true);
    const reviewedAt = new Date().toISOString();
    try {
      if (online) {
        await rateCard(current.id, rating, reviewedAt);
      } else {
        await enqueue({ cardId: current.id, rating, reviewedAt });
      }
    } catch (err) {
      await enqueue({ cardId: current.id, rating, reviewedAt });
    } finally {
      const reviewedIds = JSON.parse(sessionStorage.getItem('session-card-ids') || '[]');
      reviewedIds.push(current.id);
      sessionStorage.setItem('session-card-ids', JSON.stringify(reviewedIds));

      if (index + 1 >= cards.length) {
        navigate('/summary');
      } else {
        setIndex(index + 1);
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="screen stack">
      <div className="screen-header">
        <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', padding: 0 }}>
          ← Retour
        </button>
        <span className="dim">{index + 1} / {cards.length}</span>
      </div>

      {!online && (
        <div className="error-banner" style={{ background: 'rgba(255, 209, 102, 0.15)', borderColor: 'var(--accent)', color: 'var(--accent)' }}>
          Hors ligne — ratings mis en file d'attente
        </div>
      )}

      <Card
        front={current.front}
        back={current.back}
        explanation={current.explanation}
        type={current.type}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {RATING_BUTTONS.map((b) => (
          <button
            key={b.value}
            onClick={() => handleRate(b.value)}
            disabled={submitting}
            style={{
              padding: '14px 4px',
              fontSize: 13,
              fontWeight: 600,
              background: b.color,
              color: '#1f1f2e',
              border: 'none',
            }}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
