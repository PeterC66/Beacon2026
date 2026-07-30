# beacon2026 backend image — for LOCAL development and running the E2E suite
# without a deployed staging instance. NOT used by the Render deployment
# (Render builds from source via render.yaml). Build context is the repo root
# because the backend imports shared/constants.js from the repo root.
FROM node:22-slim

WORKDIR /app

# Prisma needs OpenSSL present at build and runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first for better layer caching.
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

# Application source plus the shared constants imported via ../../../shared.
COPY backend/ ./backend/
COPY shared/ ./shared/

WORKDIR /app/backend
RUN npm run build

EXPOSE 3001
CMD ["node", "src/server.js"]
