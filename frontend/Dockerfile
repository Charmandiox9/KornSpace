FROM node:22-alpine AS development
RUN corepack enable && corepack prepare pnpm@10.31.0 --activate
WORKDIR /workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN pnpm install --frozen-lockfile
COPY frontend frontend
COPY backend backend
WORKDIR /workspace/frontend
EXPOSE 5173
CMD ["pnpm", "dev"]
