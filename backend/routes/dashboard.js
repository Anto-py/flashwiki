import { Router } from 'express';
import { query } from '../db/client.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const settingsRes = await query('SELECT new_cards_per_day FROM user_settings WHERE id = 1');
    const newCardsPerDay = settingsRes.rows[0]?.new_cards_per_day ?? 20;

    const dueRes = await query(
      `SELECT COUNT(*)::int AS count
         FROM cards
        WHERE state != 'new' AND due_date <= NOW()`
    );
    const dueCount = dueRes.rows[0].count;

    const introRes = await query(
      `SELECT COUNT(DISTINCT card_id)::int AS count
         FROM review_log
        WHERE reviewed_at::date = CURRENT_DATE
          AND id = (SELECT MIN(id) FROM review_log rl2 WHERE rl2.card_id = review_log.card_id)`
    );
    const introducedToday = introRes.rows[0].count;
    const newQuotaLeft = Math.max(0, newCardsPerDay - introducedToday);
    const newInStockRes = await query(`SELECT COUNT(*)::int AS count FROM cards WHERE state = 'new'`);
    const newInStock = newInStockRes.rows[0].count;
    const newAvailable = Math.min(newQuotaLeft, newInStock);

    const aheadRes = await query(
      `SELECT COUNT(*)::int AS count FROM cards WHERE state != 'new' AND due_date > NOW()`
    );
    const aheadCount = aheadRes.rows[0].count;

    const totalAvailable = dueCount + newAvailable;
    const estimatedMinutes = Math.round((totalAvailable * 15) / 60);

    const weekRes = await query(
      `SELECT DISTINCT reviewed_at::date AS d
         FROM review_log
        WHERE reviewed_at >= date_trunc('week', CURRENT_DATE)`
    );
    const reviewedDates = new Set(weekRes.rows.map((r) => r.d.toISOString().slice(0, 10)));
    const weekStart = new Date();
    const day = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - day);
    const daysReviewedThisWeek = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      daysReviewedThisWeek.push(reviewedDates.has(d.toISOString().slice(0, 10)));
    }

    const themesRes = await query(
      `SELECT
         COALESCE(
           NULLIF(split_part(replace(source_file, 'Memoire/_wiki/', ''), '/', 1), ''),
           'autres'
         ) AS theme,
         COUNT(*) FILTER (WHERE state != 'new' AND due_date <= NOW())::int AS due,
         COUNT(*)::int AS total
       FROM cards
       GROUP BY theme
       ORDER BY due DESC, theme ASC`
    );

    res.json({
      due_count: dueCount,
      new_available: newAvailable,
      ahead_count: aheadCount,
      estimated_minutes: estimatedMinutes,
      days_reviewed_this_week: daysReviewedThisWeek,
      themes: themesRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
