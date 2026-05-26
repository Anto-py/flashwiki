# syntax=docker/dockerfile:1

# Stage 1 — build du frontend Vite
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
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
