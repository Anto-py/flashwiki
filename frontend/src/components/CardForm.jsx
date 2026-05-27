import { useState, useEffect } from 'react';
import { clozeFrontToBack, hasCloze } from '../lib/cloze.jsx';
import { createCard, updateCard, deleteCard } from '../api/client.js';

export default function CardForm({
  mode,
  card,
  wikiFiles,
  defaultSourceFile,
  token,
  onClose,
  onSaved,
  onDeleted,
}) {
  const isEdit = mode === 'edit';
  const [sourceFile, setSourceFile] = useState(
    card?.source_file || defaultSourceFile || ''
  );
  const [type, setType] = useState(card?.type || 'recto_verso');
  const [front, setFront] = useState(card?.front || '');
  const [back, setBack] = useState(card?.back || '');
  const [explanation, setExplanation] = useState(card?.explanation || '');
  const [resetFsrs, setResetFsrs] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (type === 'cloze' && front && !back) {
      setBack(clozeFrontToBack(front));
    }
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!sourceFile) return setError('Choisis une fiche source.');
    if (!front.trim()) return setError('Le recto est vide.');
    if (type === 'cloze' && !hasCloze(front)) {
      return setError('Pour un cloze, entoure au moins un mot à cacher par <<...>>.');
    }

    const computedBack = type === 'cloze' ? clozeFrontToBack(front) : back;
    if (!computedBack.trim()) return setError('Le verso est vide.');

    const payload = {
      type,
      front: front.trim(),
      back: computedBack.trim(),
      explanation: explanation.trim() || null,
    };
    if (!isEdit) payload.source_file = sourceFile;
    if (isEdit && resetFsrs) payload.reset_fsrs = true;

    setBusy(true);
    try {
      const result = isEdit
        ? await updateCard(card.id, payload, token)
        : await createCard(payload, token);
      onSaved?.(result.card);
      onClose?.();
    } catch (err) {
      setError(err.message || 'Erreur réseau');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!isEdit || !card) return;
    if (!confirm(`Supprimer définitivement cette carte ?\n\n"${card.front.slice(0, 80)}…"`)) return;
    setBusy(true);
    try {
      await deleteCard(card.id, token);
      onDeleted?.(card.id);
      onClose?.();
    } catch (err) {
      setError(err.message || 'Erreur réseau');
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 16,
        overflowY: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 20,
          maxWidth: 560,
          width: '100%',
          marginTop: 40,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <h2 style={{ margin: 0 }}>{isEdit ? 'Éditer une carte' : 'Nouvelle carte'}</h2>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="dim" style={{ fontSize: 13 }}>Fiche source</span>
          <select
            value={sourceFile}
            onChange={(e) => setSourceFile(e.target.value)}
            disabled={isEdit}
            required
          >
            <option value="" disabled>— Choisir une fiche —</option>
            {wikiFiles.map((f) => (
              <option key={f.id} value={f.path}>{f.path}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="dim" style={{ fontSize: 13 }}>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="recto_verso">Recto / verso (question — réponse)</option>
            <option value="cloze">Cloze (phrase à trous &lt;&lt;mot&gt;&gt;)</option>
          </select>
        </label>

        {type === 'cloze' ? (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="dim" style={{ fontSize: 13 }}>
              Phrase (entoure les mots à cacher par <code>&lt;&lt;...&gt;&gt;</code>)
            </span>
            <textarea
              value={front}
              onChange={(e) => setFront(e.target.value)}
              rows={4}
              placeholder="Le <<chien>> aboie et le <<chat>> miaule."
              required
            />
            <span className="dim" style={{ fontSize: 12 }}>
              Tous les <code>&lt;&lt;...&gt;&gt;</code> d'une même carte seront révélés ensemble au verso.
            </span>
          </label>
        ) : (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="dim" style={{ fontSize: 13 }}>Recto (question)</span>
              <textarea
                value={front}
                onChange={(e) => setFront(e.target.value)}
                rows={3}
                required
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="dim" style={{ fontSize: 13 }}>Verso (réponse)</span>
              <textarea
                value={back}
                onChange={(e) => setBack(e.target.value)}
                rows={3}
                required
              />
            </label>
          </>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="dim" style={{ fontSize: 13 }}>Explication (optionnelle)</span>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={2}
          />
        </label>

        {isEdit && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={resetFsrs}
              onChange={(e) => setResetFsrs(e.target.checked)}
            />
            <span>Réinitialiser la progression FSRS (carte refait sa courbe d'apprentissage)</span>
          </label>
        )}

        {error && (
          <p style={{ color: 'var(--danger, #e57373)', margin: 0, fontSize: 14 }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} disabled={busy}>Annuler</button>
            {isEdit && (
              <button type="button" onClick={onDelete} disabled={busy} style={{ color: 'var(--danger, #e57373)' }}>
                Supprimer
              </button>
            )}
          </div>
          <button type="submit" disabled={busy}>
            {busy ? '…' : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  );
}
