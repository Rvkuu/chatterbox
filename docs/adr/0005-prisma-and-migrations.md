# ADR-0005: Prisma ORM with version-controlled migrations

- Status: Accepted
- Date: 2026-10-16
- Requirements: FR-06.1, FR-06.2, NFR-S6, NFR-X1

## Context
The data model is small, but it will grow as features are added. The schema must be reproducible from the repository, and every query must be parameterised. The brief requires Prisma and version-controlled migrations.

## Decision
Use Prisma for schema definition and data access. The schema lives in `apps/api/prisma/`, and migrations in `apps/api/prisma/migrations/` are committed to Git. The workflow, including `migrate dev` for local development and `migrate deploy` in Docker and CI, is in `docs/database.md` section 6. Hand-written SQL inside a migration is allowed for things Prisma cannot express, such as the `CHECK` constraint on post content.

## Alternatives considered
- **Knex or Drizzle.** Good query builders with migrations, but Prisma's generated, typed client and schema file give the clearest single source of truth for a small team.
- **TypeORM.** More decorators and more ways to do the same thing, which raises the learning cost.
- **Raw SQL with `pg`.** Maximum control, but injection safety and typing then depend on discipline instead of the tool (NFR-S6).

## Consequences
- Queries are parameterised and typed by default.
- The Docker build and CI must run `prisma generate` so that the client exists.
- Migrations are the only record of how production data changed, so they are reviewed carefully and never edited after merging.
- Prisma does not model everything. Expression indexes and some constraints need hand-written SQL, which is why usernames use a separate lower-cased `usernameKey` column (`docs/database.md`, DB3).
