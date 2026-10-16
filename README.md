# Chatterbox

A lightweight social media MVP: register, log in, post short text messages, and read a shared feed (newest first).

> **Status:** planning is complete (Stages 0 and 1), and the application is being built in stages. Stage 2 (scaffolding and CI) is under way. **There is nothing to run yet.** Run instructions are added only for files that exist.

## Documentation

| Document | What it covers |
|---|---|
| [docs/requirements.md](docs/requirements.md) | Functional and non-functional requirements, scope and known limitations |
| [docs/architecture.md](docs/architecture.md) | Components, data flows and how the pieces fit |
| [docs/adr/](docs/adr/README.md) | Architecture decision records and why each choice was made |
| [docs/api.md](docs/api.md) | The REST API contract and error format |
| [docs/database.md](docs/database.md) | Tables, constraints, indexes and the migration policy |
| [docs/security.md](docs/security.md) | Authentication, sessions, CSRF, threats and security test cases |
| [docs/acceptance-tests.md](docs/acceptance-tests.md) | Acceptance scenarios and the requirement traceability matrix |
| [docs/workflow.md](docs/workflow.md) | Branch, commit, review and Kanban conventions |

## Technology

React, Vite and TypeScript (web) · Node.js 24 and Express with TypeScript (API) · PostgreSQL with Prisma · Argon2id and server-side sessions · npm workspaces · Docker Compose · GitHub Actions. The choices and their reasons are in the [ADRs](docs/adr/README.md).

## Required software

| Tool | Version | Notes |
|---|---|---|
| Node.js | 24.x | Pinned by the project (ADR-0008) |
| npm | the version bundled with Node 24 | Used with workspaces |
| Docker Desktop | with Docker Compose | Runs the full stack and the database |
| Git | any recent version | |

The project was set up with Node 24.21.0, npm 11.19.0, Docker 29.8.1, Docker Compose v5.5.1 and Git 2.56.0 on Windows. Other recent versions should work, but these are the ones that have actually been used.

## Repository layout

```
apps/web/      React frontend (Stage 2)
apps/api/      Express REST API (Stage 2)
docs/          Requirements, architecture, ADRs, workflow
.github/       CI workflows and issue/PR templates
```

## Configuration

Copy the example file and edit it. Never commit `.env`.

```bash
cp .env.example .env
```

## Progress

| Stage | Scope | State |
|---|---|---|
| 0 | Repository and workflow setup | Done |
| 1 | Requirements and architecture | Done |
| 2 | Application scaffolding and CI | In progress |
| 3 | Database and session foundation | Planned |
| 4 | Authentication | Planned |
| 5 | Post creation and feed | Planned |
| 6 | Docker integration and persistence | Planned |
| 7 | QA, security review and release | Planned |

## Contributing

See [docs/workflow.md](docs/workflow.md) for the branch, commit, review and Kanban conventions.
