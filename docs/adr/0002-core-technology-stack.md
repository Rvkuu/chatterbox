# ADR-0002: React, Vite, Express, TypeScript and PostgreSQL

- Status: Accepted
- Date: 2026-10-16
- Requirements: NFR-M1, NFR-T1, NFR-P1, FR-06

## Context
The project brief specifies the stack unless a documented constraint justifies a change. The application is a small, form-and-list style app that does not need server-side rendering and must run locally in Docker with persistent storage.

## Decision
- **Frontend:** React with Vite and TypeScript, tested with Vitest and React Testing Library.
- **Backend:** Node.js with Express and TypeScript, exposing a REST API, with Zod for request validation.
- **Database:** PostgreSQL.
- **Tooling:** ESLint, Prettier, Docker, Docker Compose and GitHub Actions.

Exact versions are chosen in Stage 2. They must be stable, mutually compatible releases, pinned by the lockfile. The Node.js version is an active LTS release, recorded in the repository and the Docker image.

## Alternatives considered
- **Next.js or another server-rendering framework.** It would bring a second server runtime and tie the UI to its routing. Chatterbox needs no SEO or server rendering.
- **NestJS or Fastify instead of Express.** Both are reasonable. Express matches the brief and is the most widely understood, which keeps the project approachable.
- **SQLite instead of PostgreSQL.** Simpler to start, but the brief requires PostgreSQL, and it better reflects a real deployment with a separate database container.
- **Plain JavaScript.** Rejected, since consistent TypeScript is a requirement and catches errors earlier.

## Consequences
- Both apps share one language, so contributors move between them easily.
- Types do not cross the HTTP boundary automatically. The API contract in `docs/api.md` is the source of truth, and each app defines its own types from it.
- Several moving parts (two Node apps and a database) are kept manageable by Docker Compose.
