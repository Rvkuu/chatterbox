# Build context is the repository root (see docker-compose.yml), so that the root
# package-lock.json is visible (ADR-0008).
FROM node:24-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# TypeScript is a root dev dependency, so the build stage installs the root as well.
RUN npm ci -w apps/api --include-workspace-root
COPY tsconfig.base.json ./
COPY apps/api apps/api
# The build generates the Prisma client first (the "prebuild" script), then compiles to dist/.
RUN npm run build -w apps/api

FROM node:24-alpine AS run
ENV NODE_ENV=production
WORKDIR /repo
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w apps/api --omit=dev && npm cache clean --force
COPY --from=build /repo/apps/api/dist apps/api/dist
# The migrations and the Prisma CLI are needed at start-up to apply them (S6-1).
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
USER node
WORKDIR /repo/apps/api
EXPOSE 4000
# Apply any pending migrations, then start. If the migration fails the container exits.
CMD ["sh", "-c", "npx --no-install prisma migrate deploy && exec node dist/server.js"]
