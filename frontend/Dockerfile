# Interface Comptapilot — image construite depuis la racine du monorepo :
#   docker build -f frontend/Dockerfile .
# Vite produit des fichiers statiques servis par nginx, qui relaie /api vers le backend.

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY moteurs/package.json moteurs/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w moteurs -w frontend --no-audit --no-fund
COPY moteurs moteurs
COPY frontend frontend
# Le moteur est compilé pour ses déclarations de types, utilisées par la vérification tsc du frontend.
RUN npm run build -w moteurs && npm run build -w frontend

FROM nginx:1.27-alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/en-tetes-securite.conf /etc/nginx/snippets/en-tetes-securite.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
