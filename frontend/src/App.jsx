import { useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import DashboardScreen from './screens/DashboardScreen.jsx';
import ReviewScreen from './screens/ReviewScreen.jsx';
import SummaryScreen from './screens/SummaryScreen.jsx';
import SettingsScreen from './screens/SettingsScreen.jsx';
import CardForm from './components/CardForm.jsx';
import LoginModal from './components/LoginModal.jsx';
import { useAuth } from './hooks/useAuth.js';
import { getWikiFiles } from './api/client.js';

function Layout() {
  const { token, hasToken, login, logout } = useAuth();
  const [wikiFiles, setWikiFiles] = useState([]);
  const [formState, setFormState] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [pendingFormState, setPendingFormState] = useState(null);

  useEffect(() => {
    if (!hasToken) return;
    getWikiFiles()
      .then((r) => setWikiFiles(r.files))
      .catch(() => {});
  }, [hasToken]);

  const requestEdit = useCallback(
    (card) => {
      if (!hasToken) {
        setPendingFormState({ mode: 'edit', card });
        setLoginOpen(true);
      } else {
        setFormState({ mode: 'edit', card });
      }
    },
    [hasToken]
  );

  const requestCreate = useCallback(
    (defaultSourceFile = null) => {
      if (!hasToken) {
        setPendingFormState({ mode: 'create', defaultSourceFile });
        setLoginOpen(true);
      } else {
        setFormState({ mode: 'create', defaultSourceFile });
      }
    },
    [hasToken]
  );

  const handleLogin = async (password) => {
    await login(password);
    setLoginOpen(false);
    if (pendingFormState) {
      setFormState(pendingFormState);
      setPendingFormState(null);
    }
  };

  const handleLoginCancel = () => {
    setLoginOpen(false);
    setPendingFormState(null);
  };

  const requestLogin = useCallback(() => setLoginOpen(true), []);

  if (!hasToken) {
    return <LoginModal onLogin={handleLogin} canCancel={false} />;
  }

  return (
    <>
      <Outlet context={{ requestEdit, requestCreate, requestLogin, hasToken, token, logout }} />

      <button
        onClick={() => requestCreate()}
        aria-label="Nouvelle carte"
        title="Nouvelle carte"
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--accent)',
          color: '#1f1f2e',
          fontSize: 32,
          fontWeight: 700,
          border: 'none',
          cursor: 'pointer',
          zIndex: 50,
          boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
          lineHeight: 1,
        }}
      >
        +
      </button>

      {formState && token && (
        <CardForm
          mode={formState.mode}
          card={formState.card}
          defaultSourceFile={formState.defaultSourceFile}
          wikiFiles={wikiFiles}
          token={token}
          onClose={() => setFormState(null)}
        />
      )}

      {loginOpen && (
        <LoginModal onLogin={handleLogin} onClose={handleLoginCancel} />
      )}
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardScreen />} />
        <Route path="/review" element={<ReviewScreen />} />
        <Route path="/summary" element={<SummaryScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
