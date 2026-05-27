import { useCallback, useEffect, useState } from 'react';
import { login as loginRequest } from '../api/client.js';

const STORAGE_KEY = 'flash_wiki_auth_token';

export function useAuth() {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (token) localStorage.setItem(STORAGE_KEY, token);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [token]);

  const login = useCallback(async (password) => {
    const res = await loginRequest(password);
    setToken(res.token);
    return res.token;
  }, []);

  const logout = useCallback(() => setToken(null), []);

  return { token, hasToken: !!token, login, logout };
}
