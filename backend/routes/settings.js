import { Router } from 'express';
import { query } from '../db/client.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT new_cards_per_day FROM user_settings WHERE id = 1');
    res.json(rows[0] ?? { new_cards_per_day: 20 });
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  const value = Number(req.body?.new_cards_per_day);
  if (!Number.isInteger(value) || value < 0 || value > 500) {
    return res.status(400).json({ error: 'new_cards_per_day must be an integer between 0 and 500' });
  }
  try {
    await query(
      `UPDATE user_settings SET new_cards_per_day = $1, updated_at = NOW() WHERE id = 1`,
      [value]
    );
    res.json({ new_cards_per_day: value });
  } catch (err) {
    next(err);
  }
});

export default router;
