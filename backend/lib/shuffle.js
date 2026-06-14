import { pool } from '../db/client.js';

function topicOf(sourceFile) {
  if (!sourceFile) return '_root_';
  // Thème = dossier parent de la fiche (hors namespace hérité « Memoire/_wiki/ »).
  // Granularité équilibrée pour l'entrelacement — surtout PAS le dossier de 1er
  // niveau, où « pedagogie » écrase tout (~80 % des cartes).
  const rel = sourceFile.replace(/^Memoire\/_wiki\//, '');
  const parts = rel.split('/');
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '_root_';
}

function fisherYates(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function interleave(packs) {
  const topics = Object.keys(packs);
  for (const t of topics) fisherYates(packs[t]);

  // Entrelacement pondéré : à chaque pas, une carte du thème le plus fourni
  // PARMI ceux différents du précédent. Garantit zéro thème répété d'affilée
  // tant qu'aucun thème ne dépasse la moitié des cartes restantes ; sinon la
  // traîne de ce thème majoritaire sort en fin de liste (inévitable). Un simple
  // round-robin entasse au contraire tout le gros thème à la fin.
  const out = [];
  let prev = null;
  while (true) {
    const avail = topics.filter((t) => packs[t].length > 0);
    if (avail.length === 0) break;
    let cands = avail.filter((t) => t !== prev);
    if (cands.length === 0) cands = avail; // forcé : un seul thème restant
    cands.sort((a, b) => packs[b].length - packs[a].length);
    const pick = cands[0];
    out.push(packs[pick].shift());
    prev = pick;
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

  const orderedIds = interleave(packs);

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
