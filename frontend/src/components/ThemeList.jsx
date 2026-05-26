import { useNavigate } from 'react-router-dom';

export default function ThemeList({ themes }) {
  const navigate = useNavigate();
  if (!themes?.length) return <p className="dim">Aucune fiche pour l'instant.</p>;

  return (
    <div className="stack">
      {themes.map((t) => {
        const ratio = t.total > 0 ? Math.min(1, t.due / t.total) : 0;
        return (
          <button
            key={t.theme}
            onClick={() => navigate(`/review?theme=${encodeURIComponent(t.theme)}`)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: 16,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <strong>{t.theme}</strong>
              <span className="dim">{t.due} / {t.total}</span>
            </div>
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${ratio * 100}%`,
                  height: '100%',
                  background: ratio > 0 ? 'var(--accent-red)' : 'var(--accent-green)',
                }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
