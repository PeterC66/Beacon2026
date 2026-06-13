# Beacon2 frontend image — for LOCAL development and running the E2E suite
# without a deployed staging instance. NOT used by the Vercel deployment
# (Vercel builds from source via vercel.json). Build context is the repo root
# because the frontend imports shared/constants.js from the repo root.
#
# The API URL is baked in at build time (Vite inlines VITE_* vars), so it is
# passed as a build arg and defaults to the docker-compose backend port.
FROM node:22-slim

WORKDIR /app

# Install dependencies first for better layer caching.
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

# Application source plus the shared constants imported via ../../shared.
COPY frontend/ ./frontend/
COPY shared/ ./shared/

ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app/frontend
RUN npm run build

# `vite preview` serves the production build with SPA history fallback.
EXPOSE 5173
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
