# ADR-0006: One browser-facing origin with an /api proxy

- Status: Accepted
- Date: 2026-10-16
- Requirements: NFR-S5, FR-02.2

## Context
The frontend and API are separate programs. The browser must reach both, and the session cookie must be sent with API calls. The two common setups are different origins with CORS, or a single origin that forwards API calls.

## Decision
The browser talks to one origin. The web server serves the static frontend and proxies requests under `/api` to the API. In development, Vite's dev server does the same proxying. The API sends no CORS headers. `WEB_ORIGIN` is used only for the `Origin` check described in ADR-0007.

## Alternatives considered
- **Separate origins with CORS and credentials.** Works, but it needs an exact allow-list of origins, credentials sent explicitly on every call and care with cookie attributes. Each of those is a place to make a mistake that weakens security.
- **Serving the frontend from the API process.** Removes the proxy, but couples the two apps' deployment, and gives up the clean separation in ADR-0001.

## Consequences
- Cookies are host-only and same-origin, with no cross-origin configuration to get wrong.
- The web container needs a proxy rule, and the Vite dev server needs a matching one. Both are set up in Stage 2.
- The frontend calls relative paths. `VITE_API_URL` in `.env.example` changes to `/api` when Stage 2 sets this up.
- If a different origin for the frontend is ever needed, it needs a new ADR covering the allowed origins and credential handling.
