const BASE = '/api';
const TOKEN_STORAGE_KEY = 'flash_wiki_auth_token';

function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

async function request(path, options = {}, token = undefined) {
  const effectiveToken = token !== undefined ? token : getStoredToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (effectiveToken) headers['X-Auth-Token'] = effectiveToken;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    if (res.status === 401) {
      try { localStorage.removeItem(TOKEN_STORAGE_KEY); } catch {}
    }
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const getDashboard = () => request('/dashboard');
export const getSessionCards = (limit, theme, ahead = false) => {
  const params = new URLSearchParams();
  if (limit) params.set('limit', limit);
  if (theme) params.set('theme', theme);
  if (ahead) params.set('ahead', '1');
  const qs = params.toString();
  return request(`/session/cards${qs ? `?${qs}` : ''}`);
};
export const rateCard = (id, rating, reviewedAt) =>
  request(`/session/cards/${id}/rate`, {
    method: 'POST',
    body: JSON.stringify({ rating, reviewed_at: reviewedAt ?? new Date().toISOString() }),
  });
export const getSummary = (cardIds) =>
  request(`/summary?card_ids=${encodeURIComponent(cardIds.join(','))}`);
export const getSettings = () => request('/settings');
export const updateSettings = (data) =>
  request('/settings', { method: 'PUT', body: JSON.stringify(data) });

export const login = (password) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }, null);

export const getWikiFiles = () => request('/cards/wiki-files');

export const createCard = (payload, token) =>
  request('/cards', { method: 'POST', body: JSON.stringify(payload) }, token);

export const updateCard = (id, payload, token) =>
  request(`/cards/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, token);

export const deleteCard = (id, token) =>
  request(`/cards/${id}`, { method: 'DELETE' }, token);

export const reshuffleCards = (token) =>
  request('/cards/reshuffle', { method: 'POST' }, token);
