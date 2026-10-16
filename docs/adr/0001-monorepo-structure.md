# ADR-0001: One repository with separate web and api apps

- Status: Accepted
- Date: 2026-10-16
- Requirements: NFR-M1, NFR-P1, NFR-T1

## Context
Chatterbox has a React frontend and an Express API built by one small team. They share documentation, CI, Docker configuration and release timing. The project brief asks for a single repository unless there is a compelling reason otherwise.

## Decision
Keep everything in one Git repository, laid out as:

```
apps/web/     React frontend
apps/api/     Express API and Prisma schema
docs/         requirements, architecture, ADRs, API and database docs
.github/      CI workflows and templates
docker-compose.yml, .env.example
```

The two apps are separate packages with their own dependencies and scripts, and are logically independent: the web app talks to the API only through the HTTP contract in `docs/api.md`. No extra monorepo tooling is adopted. Whether to use npm workspaces for a shared lockfile is decided in Stage 2.

## Alternatives considered
- **Two repositories.** Cleaner separation, but every change to the API contract becomes two pull requests and two CI setups, which is not worth it for one team.
- **A monorepo build tool (Nx, Turborepo).** Useful at larger scale, and extra tooling to learn and maintain for two apps. It can be added later if the repository grows.

## Consequences
- One pull request can change the API, the frontend and the documentation together, so they cannot drift apart.
- One CI workflow covers both apps.
- The repository must keep the two apps independent in code. They do not import from each other.
