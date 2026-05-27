import { pool } from '../db/client.js';

function topicOf(sourceFile) {
  if (!sourceFile) return '_root_';
  const parts = sourceFile.split('/');
  return parts.length > 1 ? parts[0] : '_root_';
}

function fisherYates(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function tourniquet(packs) {
  const topics = Object.keys(packs);
  fisherYates(topics);
  for (const t of topics) fisherYates(packs[t]);

  const out = [];
  let remaining = true;
  while (remaining) {
    remaining = false;
    for (const t of topics) {
      if (packs[t].length > 0) {
        out.push(packs[t].shift());
        remaining = true;
      }
    }
  }
  return out;
}

export async function recomputeIntroOrder() {
  const { rows } = await pool.query(
    "SELECT id, source_file FROM cards WHERE state = 'new'"
  );

  const packs = {};
  for (const row of rows) {
    const t = topicOf(row.source_file);
    (packs[t] ||= []).push(row.id);
  }

  const orderedIds = tourniquet(packs);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("UPDATE cards SET intro_order = NULL WHERE state = 'new'");
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query('UPDATE cards SET intro_order = $1 WHERE id = $2', [
        i + 1,
        orderedIds[i],
      ]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return {
    total: orderedIds.length,
    topics: Object.fromEntries(
      Object.entries(packs).map(([t, arr]) => [t, rows.filter((r) => topicOf(r.source_file) === t).length])
    ),
  };
}
