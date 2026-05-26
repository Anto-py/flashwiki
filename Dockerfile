# syntax=docker/dockerfile:1

# Stage 1 — build du frontend Vite
# --include=dev force l'installation des devDependencies même si
# NODE_ENV=production est injecté par l'environnement de build (Coolify).
# Sans ça, vite (devDep) n'est pas installé et `npm run build` plante.
FROM node:20-alpine AS frontend-builder
WORKDIR /build
ENV NODE_ENV=development
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --include=dev
COPY frontend/ ./
RUN npm run build

# Stage 2 — dépendances backend (prod only)
FROM node:20-alpine AS backend-deps
WORKDIR /build
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev

# Stage 3 — runner final
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY backend/ ./backend/
COPY --from=backend-deps /build/node_modules ./backend/node_modules
COPY --from=frontend-builder /build/dist ./frontend/dist

WORKDIR /app/backend
EXPOSE 3000
CMD ["sh", "-c", "node db/migrate.js && node server.js"]
