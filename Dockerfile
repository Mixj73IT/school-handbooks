FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-fund --no-audit

COPY src ./src
COPY views ./views
COPY public ./public
COPY seed.js ./

ENV NODE_ENV=production \
    PORT=4321 \
    DATA_DIR=/app/data

# Seed only creates sample content when no users exist, so this is safe on restarts.
RUN node seed.js || true

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://127.0.0.1:4321/api/health || exit 1

CMD ["node", "src/server.js"]
