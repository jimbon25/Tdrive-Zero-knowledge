FROM node:22-bookworm-slim AS deps

WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY backend/package*.json ./
COPY backend/src ./src

RUN mkdir -p /app/data

EXPOSE 8787
CMD ["npm", "start"]
