import crypto from 'node:crypto';
import { query } from '../db/client.js';

let cachedHash = null;
let cachedAt = 0;
const CACHE_MS = 60_000;

async function getStoredHash() {
  const now = Date.now();
  if (cachedHash && now - cachedAt < CACHE_MS) return cachedHash;
  const { rows } = await query('SELECT password_hash FROM user_settings WHERE id = 1');
  cachedHash = rows[0]?.password_hash || null;
  cachedAt = now;
  return cachedHash;
}

export function verifyPassword(plain, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes('$')) return false;
  const [salt, hashHex] = stored.split('$');
  const computed = crypto.scryptSync(plain, salt, 64).toString('hex');
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(hashHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function checkPassword(plain) {
  const stored = await getStoredHash();
  return verifyPassword(plain, stored);
}

export async function requireAuth(req, res, next) {
  const token = req.header('X-Auth-Token');
  if (!token) return res.status(401).json({ error: 'auth required' });
  try {
    const ok = await checkPassword(token);
    if (!ok) return res.status(401).json({ error: 'invalid token' });
    next();
  } catch (err) {
    next(err);
  }
}
