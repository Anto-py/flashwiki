import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSummary } from '../api/client.js';

export default function SummaryScreen() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ids = JSON.parse(sessionStorage.getItem('session-card-ids') || '[]');
    if (ids.length === 0) {
      navigate('/', { replace: true });
      return;
    }
    getSummary(ids)
      .then((res) => {
        setData(res);
        sessionStorage.removeItem('session-card-ids');
      })
      .catch((e) => setError(e.message));
  }, [navigate]);

  if (error) {
    return (
      <div className="screen">
        <div className="error-banner">{error}</div>
        <button onClick={() => navigate('/')}>Retour</button>
      </div>
    );
  }

  if (!data) {
    return <div className="screen"><p className="dim">Chargement…</p></div>;
  }

  const { counts, total, mature_percent, dominant_theme } = data;
  const successRate = total > 0 ? Math.round(((counts.good + counts.easy) / total) * 100) : 0;

  let feedback;
  if (total === 0) {
    feedback = 'Session terminée.';
  } else if (counts.again === total) {
    feedback = 'Pas évident aujourd\'hui — ces cartes reviendront bientôt.';
  } else if (successRate >= 80) {
    feedback = 'Très bonne session — ces concepts s\'ancrent.';
  } else if (successRate >= 50) {
    feedback = 'Progrès solide. Tu reverras les difficiles bientôt.';
  } else {
    feedback = 'Session exigeante. Le système va resserrer les passages.';
  }

  return (
    <div className="screen stack">
      <h1 className="screen-title">Session terminée</h1>

      <div className="card-tile center">
        <div style={{ fontSize: 40, fontWeight: 700, marginBottom: 8 }}>{successRate}%</div>
        <div className="dim">de cartes réussies ({counts.good + counts.easy} / {total})</div>
      </div>

      <div className="card-tile">
        <p style={{ margin: 0 }}>{feedback}</p>
      </div>

      <div className="card-tile">
        <div className="dim" style={{ marginBottom: 8, fontSize: 13 }}>Détails</div>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
          <li>Encore : <strong>{counts.again}</strong></li>
          <li>Difficile : <strong>{counts.hard}</strong></li>
          <li>Bon : <strong>{counts.good}</strong></li>
          <li>Facile : <strong>{counts.easy}</strong></li>
        </ul>
      </div>

      {dominant_theme && (
        <div className="card-tile">
          <div className="dim" style={{ fontSize: 13 }}>Maîtrise du thème <strong>{dominant_theme}</strong></div>
          <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>{mature_percent}% maîtrisées</div>
        </div>
      )}

      <button className="primary" onClick={() => navigate('/')}>
        Retour au tableau de bord
      </button>
    </div>
  );
}
