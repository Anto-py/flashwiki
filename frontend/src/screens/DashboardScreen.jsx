import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboard } from '../api/client.js';
import WeekDots from '../components/WeekDots.jsx';
import ThemeList from '../components/ThemeList.jsx';

export default function DashboardScreen() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="screen">
        <Header onSettings={() => navigate('/settings')} />
        <div className="error-banner">
          Impossible de charger les cartes · vérifie ta connexion
          <div style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="screen">
        <Header onSettings={() => navigate('/settings')} />
        <p className="dim">Chargement…</p>
      </div>
    );
  }

  const total = (data.due_count ?? 0) + (data.new_available ?? 0);
  const ahead = data.ahead_count ?? 0;
  const hasAnything = total > 0 || ahead > 0;
  const reviewHref = total > 0 ? '/review' : '/review?ahead=1';

  return (
    <div className="screen stack">
      <Header onSettings={() => navigate('/settings')} />

      <div className="card-tile">
        {total === 0 ? (
          <p style={{ margin: 0 }}>
            <strong>Pas de cartes à réviser maintenant.</strong>
            <br />
            <span className="dim">
              {ahead > 0
                ? `Tu peux réviser à l'avance (${ahead} cartes en attente).`
                : 'Ajoute des fiches au wiki pour démarrer.'}
            </span>
          </p>
        ) : (
          <>
            <div style={{ fontSize: 28, fontWeight: 600 }}>
              {data.estimated_minutes} min
            </div>
            <div className="dim">
              {data.due_count} dues · {data.new_available} nouvelles
              {ahead > 0 && <> · {ahead} à venir</>}
            </div>
          </>
        )}
      </div>

      <div className="card-tile">
        <div className="dim" style={{ marginBottom: 10, fontSize: 13 }}>Cette semaine</div>
        <WeekDots days={data.days_reviewed_this_week} />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          className="primary"
          style={{ flex: 1 }}
          onClick={() => navigate(reviewHref)}
          disabled={!hasAnything}
        >
          {total > 0 ? 'Réviser' : 'Réviser à l\'avance'}
        </button>
        <button
          style={{ flex: 1 }}
          onClick={() => navigate('/review?limit=5&ahead=1')}
          disabled={!hasAnything}
        >
          Juste 5
        </button>
      </div>

      <div>
        <h2 style={{ fontSize: 16, color: 'var(--fg-dim)', margin: '24px 0 12px' }}>Thèmes</h2>
        <ThemeList themes={data.themes} />
      </div>
    </div>
  );
}

function Header({ onSettings }) {
  return (
    <div className="screen-header">
      <h1 className="screen-title">FlashWiki</h1>
      <button className="gear-btn" onClick={onSettings} aria-label="Paramètres">⚙</button>
    </div>
  );
}
