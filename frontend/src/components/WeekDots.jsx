const LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function WeekDots({ days }) {
  const safe = Array.isArray(days) && days.length === 7 ? days : Array(7).fill(false);
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      {safe.map((done, i) => (
        <div key={i} style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: done ? 'var(--accent-green)' : 'var(--border)',
              margin: '0 auto 4px',
            }}
          />
          <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>{LABELS[i]}</div>
        </div>
      ))}
    </div>
  );
}
