# ADR-0007: Layered CSRF protection with a session token

- Status: Accepted
- Date: 2026-10-16
- Requirements: NFR-S5, FR-05.1

## Context
Authentication uses a cookie, which a browser sends automatically, including from another website. Without protection, a malicious page could make a logged-in user's browser submit a post or log in as someone else (login CSRF). No single browser feature covers every case or every browser version.

## Decision
Apply several independent layers to every state-changing request (`POST`):

1. `SameSite=Lax` on the session cookie.
2. A required `Content-Type: application/json`, which a plain HTML form cannot send cross-site.
3. An `Origin` check: if the header is present it must equal `WEB_ORIGIN`.
4. A synchroniser token. The server keeps a random token in the session, returns it from `GET /api/csrf-token`, and requires it back in the `X-CSRF-Token` header, compared in constant time.

Details and failure codes are in `docs/security.md` section 6 and `docs/api.md`.

## Alternatives considered
- **`SameSite` alone.** Simple, but it depends on browser behaviour and would be the only defence.
- **Double-submit cookie.** Avoids storing a token server-side, but it needs a second cookie and careful signing. The session already exists, so storing the token in it is simpler.
- **Skipping the token on login and register.** Common, but it leaves login CSRF open. Using the same rule everywhere is easier to explain and test.

## Consequences
- The frontend must fetch a token before its first `POST`, fetch a new one after login and logout (the session changes), and retry once after a `403 CSRF_INVALID`.
- Anonymous visitors need a short-lived session to hold a token. This is accepted, with the growth limits described in ADR-0003.
- Every layer has its own test case in `docs/security.md` section 13 (SEC-T7, SEC-T8).
