FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.31.0 --activate
WORKDIR /workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY patches patches
RUN pnpm install --frozen-lockfile
COPY frontend frontend
COPY backend backend
WORKDIR /workspace/frontend
ARG NEXT_PUBLIC_API_WS_URL=""
ENV NEXT_PUBLIC_API_WS_URL=$NEXT_PUBLIC_API_WS_URL
ENV API_PROXY_TARGET=http://backend:3000
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3001
WORKDIR /workspace
COPY --from=build --chown=node:node /workspace/frontend/.next/standalone ./
COPY --from=build --chown=node:node /workspace/frontend/.next/static ./frontend/.next/static
COPY --from=build --chown=node:node /workspace/frontend/public ./frontend/public
USER node
EXPOSE 3001
CMD ["node", "frontend/server.js"]
