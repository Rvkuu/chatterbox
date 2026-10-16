# ADR-0003: Server-side sessions in PostgreSQL, not JWTs

- Status: Accepted
- Date: 2026-10-16
- Requirements: FR-02, FR-03, NFR-S2, NFR-X2

## Context
Users must be able to log in and log out, and a logged-out session must stop working immediately (FR-03.3). The API must hold no per-process state, so that it can run as several instances later (NFR-X2). The brief requires server-side sessions stored in PostgreSQL, with secure cookies.

## Decision
Use `express-session` with the `connect-pg-simple` store. Session data lives in the `session` table (see `docs/database.md`), created by Prisma migrations. The browser holds only a signed, opaque session ID in an `HttpOnly` cookie. Logging in regenerates the session ID, and logging out destroys the session row. Cookie attributes, lifetimes and the anonymous-session rule are in `docs/security.md` (SEC2 to SEC4).

## Alternatives considered
- **JWTs.** Stateless, but they cannot be revoked before they expire without adding a server-side deny list, which is server-side state again. Storing them in `localStorage` exposes them to any XSS.
- **In-memory sessions.** Lost on every restart and not shared between instances, which breaks NFR-X2 and the persistence expectations.
- **Redis as the session store.** Fast and common, but an extra service for a small app, and the brief rules out adding infrastructure without a clear need.
- **A Prisma-based session store package.** It would reuse the Prisma client, but its table layout differs from the library-default layout documented in `database.md`, and it adds a less widely used dependency.

## Consequences
- Logout and revocation are immediate, because deleting the row ends the session.
- Each authenticated request costs one indexed database read. This is acceptable at the expected scale.
- `connect-pg-simple` uses the `pg` driver, so the API has a second small connection pool next to Prisma's.
- Anonymous visitors get a short-lived session row so that they can hold a CSRF token. Their growth is limited by a 1-hour expiry and pruning (risk R1 in `docs/security.md`).
