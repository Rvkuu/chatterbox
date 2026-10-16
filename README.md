# Chatterbox

A lightweight social media MVP: register, log in, post short text messages, and read a shared feed (newest first).

> **Status: Stage 0 (repository and workflow setup).** The application is not implemented yet. Run instructions will be added as each stage lands, and only for files that exist.

## Planned stack

React, Vite and TypeScript (web) · Node.js, Express and TypeScript (API) · PostgreSQL with Prisma · Argon2id and server-side sessions · Docker Compose · GitHub Actions.

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

## Contributing

See [docs/workflow.md](docs/workflow.md) for the branch, commit, review and Kanban conventions.