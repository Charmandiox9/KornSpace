FROM node:22-alpine AS development
RUN corepack enable && corepack prepare pnpm@10.31.0 --activate
WORKDIR /workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN pnpm install --frozen-lockfile
COPY frontend frontend
COPY backend backend
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" DATABASE_URL_UNPOOLED="postgresql://build:build@localhost:5432/build" pnpm --filter kornspace-backend prisma:generate
COPY backend/docker-entrypoint.sh /usr/local/bin/kornspace-backend-entrypoint
RUN chmod +x /usr/local/bin/kornspace-backend-entrypoint
WORKDIR /workspace/backend
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/kornspace-backend-entrypoint"]
CMD ["pnpm", "start:dev"]

FROM development AS production
ENV NODE_ENV=production
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" DATABASE_URL_UNPOOLED="postgresql://build:build@localhost:5432/build" pnpm --filter kornspace-backend build
CMD ["pnpm", "start:prod"]
