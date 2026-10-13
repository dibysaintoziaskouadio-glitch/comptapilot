# API Comptapilot — image construite depuis la racine du monorepo :
#   docker build -f backend/Dockerfile .
# Le backend dépend du paquet local @compta/moteurs, construit dans la même image.

FROM node:20-bookworm-slim AS base
# OpenSSL est requis par le moteur de requêtes Prisma.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- Compilation (dépendances de développement comprises)
FROM base AS build
COPY package.json package-lock.json ./
COPY moteurs/package.json moteurs/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w moteurs -w backend --no-audit --no-fund
COPY moteurs moteurs
COPY backend backend
RUN npm run build -w moteurs \
 && npx -w backend prisma generate \
 && npm run build -w backend

# --- Exécution (dépendances de production uniquement)
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY moteurs/package.json moteurs/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w moteurs -w backend --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/moteurs/dist moteurs/dist
COPY --from=build /app/backend/dist backend/dist
COPY backend/prisma backend/prisma
RUN npx -w backend prisma generate
USER node
WORKDIR /app/backend
EXPOSE 4100
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4100)+'/api/sante').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Les migrations sont appliquées à chaque démarrage (idempotent), puis l'API synchronise les barèmes.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
