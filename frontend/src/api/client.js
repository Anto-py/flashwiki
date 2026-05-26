const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
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
