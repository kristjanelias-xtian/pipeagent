FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS build
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
COPY apps/server/package.json apps/server/tsconfig.json apps/server/
RUN pnpm install --frozen-lockfile
COPY packages/shared/src packages/shared/src
COPY apps/server/src apps/server/src
RUN pnpm --filter @pipeagent/shared build
RUN pnpm --filter @pipeagent/server build

FROM base AS runtime
WORKDIR /app
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/server/package.json apps/server/
COPY --from=build /app/apps/server/dist apps/server/dist
RUN pnpm install --frozen-lockfile --prod
EXPOSE 3001
CMD ["node", "apps/server/dist/server.js"]
