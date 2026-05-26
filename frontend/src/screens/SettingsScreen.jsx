import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, updateSettings } from '../api/client.js';

export default function SettingsScreen() {
  const navigate = useNavigate();
  const [value, setValue] = useState(20);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setValue(s.new_cards_per_day);
        localStorage.setItem('new_cards_per_day', String(s.new_cards_per_day));
      })
      .catch((e) => setError(e.message));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateSettings({ new_cards_per_day: value });
      localStorage.setItem('new_cards_per_day', String(value));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="screen stack">
      <div className="screen-header">
        <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', padding: 0 }}>
          ← Retour
        </button>
        <h1 className="screen-title">Paramètres</h1>
        <span style={{ width: 60 }} />
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card-tile">
        <label style={{ display: 'block', marginBottom: 12 }}>
          Nouvelles cartes par jour
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <strong style={{ minWidth: 40, textAlign: 'right' }}>{value}</strong>
        </div>
        <p className="dim" style={{ fontSize: 13, marginTop: 12 }}>
          Combien de cartes neuves au maximum par jour. Les cartes dues sont toujours affichées en priorité.
        </p>
      </div>

      <button className="primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Enregistrement…' : saved ? '✓ Enregistré' : 'Enregistrer'}
      </button>
    </div>
  );
}
