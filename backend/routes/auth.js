import { Router } from 'express';
import { checkPassword } from '../lib/auth.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  const password = req.body?.password;
  if (typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ error: 'password required' });
  }
  try {
    const ok = await checkPassword(password);
    if (!ok) return res.status(401).json({ error: 'invalid password' });
    res.json({ ok: true, token: password });
  } catch (err) {
    next(err);
  }
});

export default router;
