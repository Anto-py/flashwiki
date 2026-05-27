const CLOZE_RE = /<<(.+?)>>/g;

export function renderClozeFront(text) {
  if (!text) return null;
  const out = [];
  let last = 0;
  let m;
  let i = 0;
  CLOZE_RE.lastIndex = 0;
  while ((m = CLOZE_RE.exec(text)) !== null) {
    if (m.index > last) out.push(<span key={i++}>{text.slice(last, m.index)}</span>);
    out.push(
      <span
        key={i++}
        style={{
          borderBottom: '2px solid var(--accent)',
          padding: '0 12px',
          display: 'inline-block',
          minWidth: 40,
        }}
      >
        &nbsp;
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<span key={i++}>{text.slice(last)}</span>);
  return out;
}

export function renderClozeBack(text) {
  if (!text) return null;
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  return boldParts.map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p) ? (
      <strong key={i} style={{ color: 'var(--accent)' }}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export function clozeFrontToBack(front) {
  if (!front) return '';
  return front.replace(/<<(.+?)>>/g, '**$1**');
}

export function hasCloze(text) {
  return /<<.+?>>/.test(text || '');
}
