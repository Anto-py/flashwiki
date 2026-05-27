import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitForDb } from './db/client.js';
import dashboardRouter from './routes/dashboard.js';
import sessionRouter from './routes/session.js';
import summaryRouter from './routes/summary.js';
import settingsRouter from './routes/settings.js';
import authRouter from './routes/auth.js';
import cardsRouter from './routes/cards.js';
import { requireAuth } from './lib/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PUBLIC_API_PATHS = new Set(['/api/health', '/api/auth/login']);
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  if (PUBLIC_API_PATHS.has(req.path)) return next();
  return requireAuth(req, res, next);
});

app.use('/api/dashboard', dashboardRouter);
app.use('/api/session', sessionRouter);
app.use('/api/summary', summaryRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/auth', authRouter);
app.use('/api/cards', cardsRouter);

const frontendDist = path.resolve(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) res.status(404).send('frontend build not available');
  });
});

async function start() {
  await waitForDb();
  app.listen(PORT, () => {
    console.log(`[server] listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
