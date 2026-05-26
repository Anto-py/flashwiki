import { Router } from 'express';
import { query } from '../db/client.js';

const router = Router();

router.get('/', async (req, res, next) => {
  const raw = typeof req.query.card_ids === 'string' ? req.query.card_ids : '';
  const ids = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (ids.length === 0) {
    return res.json({
      counts: { again: 0, hard: 0, good: 0, easy: 0 },
      total: 0,
      mature_percent: 0,
      dominant_theme: null,
    });
  }

  try {
    const ratingsRes = await query(
      `SELECT DISTINCT ON (card_id) card_id, rating
         FROM review_log
        WHERE card_id = ANY($1::int[])
        ORDER BY card_id, reviewed_at DESC`,
      [ids]
    );

    const counts = { again: 0, hard: 0, good: 0, easy: 0 };
    const map = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
    for (const row of ratingsRes.rows) {
      const key = map[row.rating];
      if (key) counts[key]++;
    }

    const themeRes = await query(
      `SELECT
         COALESCE(
           NULLIF(split_part(replace(source_file, 'Memoire/_wiki/', ''), '/', 1), ''),
           'autres'
         ) AS theme,
         COUNT(*)::int AS n
       FROM cards
       WHERE id = ANY($1::int[])
       GROUP BY theme
       ORDER BY n DESC
       LIMIT 1`,
      [ids]
    );
    const dominantTheme = themeRes.rows[0]?.theme ?? null;

    let maturePercent = 0;
    if (dominantTheme) {
      const matureRes = await query(
        `SELECT
           COUNT(*) FILTER (WHERE stability > 21)::float AS mature,
           COUNT(*)::float AS total
         FROM cards
         WHERE COALESCE(
                 NULLIF(split_part(replace(source_file, 'Memoire/_wiki/', ''), '/', 1), ''),
                 'autres'
               ) = $1`,
        [dominantTheme]
      );
      const { mature, total } = matureRes.rows[0];
      maturePercent = total > 0 ? Math.round((mature / total) * 100) : 0;
    }

    res.json({
      counts,
      total: ratingsRes.rows.length,
      mature_percent: maturePercent,
      dominant_theme: dominantTheme,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
