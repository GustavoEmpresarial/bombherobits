FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.12.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web apps/web
RUN pnpm --filter @herobits/api db:generate && pnpm --filter @herobits/shared build && pnpm --filter @herobits/api build
ENV VITE_API_URL=/api
RUN pnpm --filter @herobits/web build
RUN node -e 'const fs=require("fs");const p="packages/shared/package.json";const j=JSON.parse(fs.readFileSync(p));j.main="./dist/index.js";j.exports["."].import="./dist/index.js";j.exports["."].default="./dist/index.js";fs.writeFileSync(p,JSON.stringify(j));'

FROM build AS api
ENV NODE_ENV=production
USER node
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]

FROM nginx:1.27-alpine AS web
COPY deploy/web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
