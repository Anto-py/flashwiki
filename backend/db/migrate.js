import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, waitForDb } from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '..', 'migrations');

async function run() {
  await waitForDb();

  const entries = await fs.readdir(migrationsDir);
  const files = entries.filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const full = path.join(migrationsDir, file);
    const sql = await fs.readFile(full, 'utf8');
    console.log(`[migrate] applying ${file}`);
    await pool.query(sql);
  }

  console.log(`[migrate] done — ${files.length} migration(s) applied`);
}

run()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('[migrate] failed:', err);
    await pool.end();
    process.exit(1);
  });
