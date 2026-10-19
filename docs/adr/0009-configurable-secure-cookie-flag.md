# ADR-0009: The Secure cookie flag is configurable, and off for the HTTP demo

- Status: Accepted
- Date: 2026-10-19
- Requirements: NFR-S5, FR-02.2, NFR-P2

## Context
`docs/security.md` SEC3 says the session cookie is `Secure` in production and not on local `http://localhost`. The Docker Compose demo runs the API with `NODE_ENV=production` (it is a built image), but it is served over plain HTTP. A `Secure` cookie over HTTP is dropped by some browsers (Safari), and `express-session` refuses to set a `Secure` cookie at all when the request does not look secure. Tying the flag to `NODE_ENV` would break login in the demo.

## Decision
Add an environment variable `COOKIE_SECURE` (`true` or `false`). When it is not set, it defaults to `true` in production and `false` otherwise, which is the behaviour SEC3 describes. Docker Compose sets `COOKIE_SECURE=false` unless `.env` overrides it, because the demo is HTTP only (accepted risk R3). When it is `true`, the API trusts one proxy hop (`trust proxy`) so that it sees the original HTTPS protocol from `X-Forwarded-Proto`, which the web container sets.

## Alternatives considered
- **Always `Secure` in production.** Matches SEC3 literally, but login fails in the HTTP demo.
- **Never `Secure`.** Simple, but it makes the later move to HTTPS an easy thing to forget.
- **Generate a local HTTPS certificate for the demo.** Correct, but it adds certificate handling and browser warnings to a demo meant to start with one command.

## Consequences
- The demo works over HTTP, and the weaker setting is visible and named in the Compose file instead of hidden in code.
- Moving to HTTPS means setting `COOKIE_SECURE=true` and nothing else in the application.
- The other protections (`HttpOnly`, `SameSite=Lax`, the CSRF token) do not depend on this flag.
