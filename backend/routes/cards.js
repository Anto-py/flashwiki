import { Router } from 'express';
import { pool, query } from '../db/client.js';
import { requireAuth } from '../lib/auth.js';
import { recomputeIntroOrder } from '../lib/shuffle.js';

const router = Router();

const VALID_TYPES = ['recto_verso', 'cloze'];

function validateCardBody(body, { partial = false } = {}) {
  const errors = [];
  if (!partial || body.type !== undefined) {
    if (!VALID_TYPES.includes(body.type)) errors.push("type must be 'recto_verso' or 'cloze'");
  }
  if (!partial || body.front !== undefined) {
    if (typeof body.front !== 'string' || body.front.trim().length === 0) errors.push('front required');
  }
  if (!partial || body.back !== undefined) {
    if (typeof body.back !== 'string' || body.back.trim().length === 0) errors.push('back required');
  }
  return errors;
}

router.get('/wiki-files', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT id, path FROM wiki_files ORDER BY path ASC');
    res.json({ files: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  const { source_file, type, front, back, explanation } = req.body || {};
  if (typeof source_file !== 'string' || source_file.trim().length === 0) {
    return res.status(400).json({ error: 'source_file required' });
  }
  const errs = validateCardBody({ type, front, back });
  if (errs.length) return res.status(400).json({ error: errs.join('; ') });

  try {
    const check = await query('SELECT 1 FROM wiki_files WHERE path = $1', [source_file]);
    if (check.rowCount === 0) {
      return res.status(400).json({ error: 'source_file does not match any wiki_files row' });
    }
    const { rows } = await query(
      `INSERT INTO cards (source_file, type, front, back, explanation, source)
       VALUES ($1, $2, $3, $4, $5, 'manual')
       RETURNING *`,
      [source_file, type, front, back, explanation ?? null]
    );
    await recomputeIntroOrder();
    res.status(201).json({ card: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'invalid id' });

  const { type, front, back, explanation, reset_fsrs } = req.body || {};
  const errs = validateCardBody({ type, front, back }, { partial: true });
  if (errs.length) return res.status(400).json({ error: errs.join('; ') });

  const sets = [];
  const params = [];
  if (type !== undefined) { params.push(type); sets.push(`type = $${params.length}`); }
  if (front !== undefined) { params.push(front); sets.push(`front = $${params.length}`); }
  if (back !== undefined) { params.push(back); sets.push(`back = $${params.length}`); }
  if (explanation !== undefined) { params.push(explanation); sets.push(`explanation = $${params.length}`); }
  sets.push(`source = 'manual'`);

  if (reset_fsrs === true) {
    sets.push(`stability = 0`, `difficulty = 0.3`, `due_date = NOW()`, `last_review = NULL`, `state = 'new'`, `reps = 0`, `lapses = 0`);
  }

  if (sets.length === 1) return res.status(400).json({ error: 'nothing to update' });

  params.push(id);
  const sql = `UPDATE cards SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`;

  try {
    const { rows, rowCount } = await query(sql, params);
    if (rowCount === 0) return res.status(404).json({ error: 'card not found' });
    if (reset_fsrs === true) await recomputeIntroOrder();
    res.json({ card: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'invalid id' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM review_log WHERE card_id = $1', [id]);
    const del = await client.query('DELETE FROM cards WHERE id = $1', [id]);
    await client.query('COMMIT');
    if (del.rowCount === 0) return res.status(404).json({ error: 'card not found' });
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.post('/reshuffle', requireAuth, async (_req, res, next) => {
  try {
    const result = await recomputeIntroOrder();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
