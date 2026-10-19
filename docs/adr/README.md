# Architecture Decision Records

An ADR records one significant technical decision: the situation, what was chosen, what was rejected and what follows from it. ADRs are short and are not edited once accepted. To change a decision, write a new ADR that supersedes the old one.

## Index

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-monorepo-structure.md) | One repository with separate `web` and `api` apps | Accepted |
| [0002](0002-core-technology-stack.md) | React, Vite, Express, TypeScript and PostgreSQL | Accepted |
| [0003](0003-server-side-sessions-in-postgresql.md) | Server-side sessions in PostgreSQL, not JWTs | Accepted |
| [0004](0004-argon2id-password-hashing.md) | Argon2id with stated parameters | Accepted |
| [0005](0005-prisma-and-migrations.md) | Prisma ORM with version-controlled migrations | Accepted |
| [0006](0006-single-origin-api-proxy.md) | One browser-facing origin with an `/api` proxy | Accepted |
| [0007](0007-layered-csrf-protection.md) | Layered CSRF protection with a session token | Accepted |
| [0008](0008-npm-workspaces-and-node-24.md) | npm workspaces and Node.js 24 | Accepted |
| [0009](0009-configurable-secure-cookie-flag.md) | The Secure cookie flag is configurable, and off for the HTTP demo | Accepted |
| [0010](0010-prisma-7-driver-adapter.md) | Prisma 7 with the pg driver adapter and a generated client in the API source | Accepted |
| [0011](0011-playwright-end-to-end-tests.md) | Playwright end-to-end tests against a private Docker stack | Accepted |

## Statuses

`Proposed` (under discussion), `Accepted` (in force), `Superseded by ADR-NNNN`.

## Template for new ADRs

Copy this into `NNNN-short-title.md`, using the next number:

```markdown
# ADR-NNNN: Title

- Status: Proposed
- Date: YYYY-MM-DD
- Requirements: the requirement IDs this serves

## Context
What situation or constraint forces a decision?

## Decision
What we chose, stated plainly.

## Alternatives considered
Each option and why it was not chosen.

## Consequences
What gets easier, what gets harder, and what we now have to do.
```
