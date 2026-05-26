import { Router } from 'express';
import { query } from '../db/client.js';
import { rate } from '../lib/fsrs.js';

const router = Router();

router.get('/cards', async (req, res, next) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const theme = typeof req.query.theme === 'string' ? req.query.theme : null;
  const ahead = req.query.ahead === '1' || req.query.ahead === 'true';

  try {
    const settingsRes = await query('SELECT new_cards_per_day FROM user_settings WHERE id = 1');
    const newCardsPerDay = settingsRes.rows[0]?.new_cards_per_day ?? 20;

    const newToday = await query(
      `SELECT COUNT(DISTINCT rl.card_id) AS count
       FROM review_log rl
       JOIN cards c ON c.id = rl.card_id
       WHERE rl.reviewed_at::date = CURRENT_DATE
         AND rl.id = (
           SELECT MIN(id) FROM review_log WHERE card_id = c.id
         )`
    );
    const introducedToday = Number(newToday.rows[0]?.count) || 0;
    const newQuotaLeft = Math.max(0, newCardsPerDay - introducedToday);

    const dueParams = [];
    let dueSql = `
      SELECT * FROM cards
      WHERE state != 'new' AND due_date <= NOW()
    `;
    if (theme) {
      dueParams.push(`%/${theme}/%`);
      dueSql += ` AND source_file LIKE $${dueParams.length}`;
    }
    dueSql += ` ORDER BY due_date ASC LIMIT $${dueParams.length + 1}`;
    dueParams.push(limit);
    const dueRes = await query(dueSql, dueParams);

    const remaining = limit - dueRes.rows.length;
    let newRows = [];
    if (remaining > 0 && newQuotaLeft > 0) {
      const newParams = [];
      let newSql = `SELECT * FROM cards WHERE state = 'new'`;
      if (theme) {
        newParams.push(`%/${theme}/%`);
        newSql += ` AND source_file LIKE $${newParams.length}`;
      }
      newSql += ` ORDER BY created_at ASC LIMIT $${newParams.length + 1}`;
      newParams.push(Math.min(remaining, newQuotaLeft));
      const newRes = await query(newSql, newParams);
      newRows = newRes.rows;
    }

    let aheadRows = [];
    const collected = dueRes.rows.length + newRows.length;
    if (ahead && collected < limit) {
      const aheadParams = [];
      let aheadSql = `SELECT * FROM cards WHERE state != 'new' AND due_date > NOW()`;
      if (theme) {
        aheadParams.push(`%/${theme}/%`);
        aheadSql += ` AND source_file LIKE $${aheadParams.length}`;
      }
      aheadSql += ` ORDER BY due_date ASC LIMIT $${aheadParams.length + 1}`;
      aheadParams.push(limit - collected);
      const aheadRes = await query(aheadSql, aheadParams);
      aheadRows = aheadRes.rows;
    }

    res.json({
      cards: [...dueRes.rows, ...newRows, ...aheadRows],
      meta: {
        due_count: dueRes.rows.length,
        new_count: newRows.length,
        ahead_count: aheadRows.length,
        new_quota_left: newQuotaLeft,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/cards/:id/rate', async (req, res, next) => {
  const id = Number(req.params.id);
  const rating = Number(req.body?.rating);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'invalid card id' });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 4) {
    return res.status(400).json({ error: 'rating must be 1-4' });
  }

  try {
    const cardRes = await query('SELECT * FROM cards WHERE id = $1', [id]);
    const card = cardRes.rows[0];
    if (!card) return res.status(404).json({ error: 'card not found' });

    const reviewedAt = req.body?.reviewed_at ? new Date(req.body.reviewed_at) : new Date();
    const result = rate(card, rating, reviewedAt);

    await query(
      `UPDATE cards
         SET stability = $1,
             difficulty = $2,
             due_date = $3,
             state = $4,
             reps = $5,
             lapses = $6,
             last_review = $7
       WHERE id = $8`,
      [
        result.stability,
        result.difficulty,
        result.due_date,
        result.state,
        result.reps,
        result.lapses,
        result.last_review,
        id,
      ]
    );

    await query(
      `INSERT INTO review_log (card_id, rating, reviewed_at, stability_after, difficulty_after, due_after)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, rating, reviewedAt, result.stability, result.difficulty, result.due_date]
    );

    res.json({
      id,
      next_due: result.due_date,
      stability: result.stability,
      difficulty: result.difficulty,
      state: result.state,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
