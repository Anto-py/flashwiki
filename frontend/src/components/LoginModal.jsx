import { useState } from 'react';

export default function LoginModal({ onLogin, onClose }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onLogin(password);
      onClose?.();
    } catch (err) {
      setError(err.message || 'Mot de passe incorrect');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
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
          padding: 24,
          maxWidth: 400,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <h2 style={{ margin: 0 }}>Connexion</h2>
        <p className="dim" style={{ margin: 0, fontSize: 14 }}>
          Mot de passe requis pour créer, éditer ou supprimer des cartes.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          autoFocus
          required
        />
        {error && (
          <p style={{ color: 'var(--danger, #e57373)', margin: 0, fontSize: 14 }}>{error}</p>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="submit" disabled={busy}>{busy ? '…' : 'Se connecter'}</button>
        </div>
      </form>
    </div>
  );
}
