# ADR-0010: Prisma 7 with the pg driver adapter and a generated client in the API source

- Status: Accepted
- Date: 2026-10-19
- Requirements: FR-06.1, FR-06.2, NFR-S6, NFR-X2

## Context
ADR-0005 chose Prisma and left the exact version to Stage 3. The stable Prisma line at the time of writing is 7.x. It no longer ships a native query engine: the client talks to PostgreSQL through a driver adapter, and the CLI reads its connection settings from a `prisma.config.ts` file. The session store (`connect-pg-simple`) also needs a `pg` connection pool.

## Decision
- Use `prisma` and `@prisma/client` 7.10.1 with `@prisma/adapter-pg`. One `pg` connection pool is created at start-up and shared by Prisma and the session store.
- The generated client is written to `apps/api/src/generated/prisma` (git-ignored, not edited by hand) and rebuilt by `prisma generate`, which the `predev`, `pretypecheck`, `pretest` and `prebuild` scripts run automatically.
- `prisma.config.ts` reads `DATABASE_URL` from the environment and, for local development, from the root `.env` file.
- Migrations are applied with `prisma migrate deploy` in Docker and in the tests, and `prisma migrate dev` is only for local development.

## Alternatives considered
- **Prisma 6.** Still supported, but it ships native engine binaries that have to be matched to each Docker base image. 7.x removes that source of failures.
- **A second connection pool for sessions.** Simpler to read, but it doubles the number of connections for no benefit.
- **Committing the generated client.** Avoids a generate step, but adds a large generated diff to every schema change.

## Consequences
- `npm test`, `npm run typecheck` and `npm run build` work from a clean clone because they generate the client first.
- The runtime image needs the Prisma CLI, the migrations and `prisma.config.ts` so it can apply migrations at start-up (S6-1).
- Upgrading Prisma later is a change to one set of pinned versions and a regenerated client.
