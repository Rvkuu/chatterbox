# Security and dependency review (S7-2)

Date of the review: 2026-10-19. Scope: the code and configuration in this repository at the commit that contains this file, against [security.md](security.md) and the security cases SEC-T1 to SEC-T14. Every result below comes from a command or test that was actually run; the command is given so it can be repeated. Things that were **not** checked are listed in section 7.

## 1. Dependency audit

| Check | Command | Result |
|---|---|---|
| Known vulnerabilities, all dependencies | `npm audit` | `found 0 vulnerabilities` |
| Known vulnerabilities, what ships (no dev tools) | `npm audit --omit=dev` | `found 0 vulnerabilities` |
| Size of the dependency tree | `npm audit --json` | 586 packages: 244 production and 342 development (npm also counts 82 optional packages) |
| Versions pinned | search every `package.json` for `^` or `~` | none: every dependency is pinned to an exact version, and `package-lock.json` is committed |
| Run in CI | `.github/workflows/ci.yml`, job `audit` | `npm audit --audit-level=high` on every push and pull request |

**Triage:** there are no findings to triage. New findings will fail the CI job at `high` and above.

**Install scripts:** newer npm versions (11.x) print `npm warn install-scripts` for dependency install scripts that are not approved yet (for example the Prisma and esbuild packages). The scripts still run on the npm versions used here, and the build works. If a later npm blocks them, they are approved with `npm install-scripts approve`, as recorded in ADR-0008. This is a maintenance note, not a vulnerability.

**Native code:** `argon2` contains native code (ADR-0004). It was verified to work in the Alpine-based Docker image: registration and login pass in the end-to-end tests, which run against that image.

## 2. Secrets

| Check | Command | Result |
|---|---|---|
| No `.env` file tracked, no secret patterns in current files, `.env` ignored | `node scripts/check-secrets.mjs` | `No committed secrets and no tracked .env file found.` |
| The same across the whole Git history | `node scripts/check-secrets.mjs --history` | `No committed secrets and no tracked .env file found.` |
| The check really detects problems | a temporary Compose file with a hard-coded password was added | reported `DB_PASSWORD has a value that is not a placeholder`; then removed |
| Configuration comes from the environment, nothing hard-coded | `node scripts/check-config.mjs` | every variable the code and Compose files read is in `.env.example`; no hard-coded credentials or ports in the Compose files |
| `.env.example` holds placeholders only | read the file | `change-me-local-only` and `replace-with-a-long-random-string` |
| Production refuses a placeholder secret | unit tests (SEC-T12) and a real start of the Docker stack with the placeholder | the API container exited with `SESSION_SECRET is still a placeholder`, and the stack did not come up |
| No secrets in images | listed the files of the built API and web images | no `.env` file, and the placeholder password does not appear in the web image |

The checks run in CI (`npm run verify:ci`) and as part of `npm run check`.

## 3. Behaviour checks

These were verified by automated tests that run against a real PostgreSQL database (API), against the real Docker stack in a real browser (end-to-end), and by hand in the browser.

| Area | What was checked | Evidence (test IDs) |
|---|---|---|
| Passwords | Stored only as Argon2id hashes (`$argon2id$...` with the parameters of SEC5); an older hash is replaced at the next login; a malformed stored hash never authenticates | AT-R2, SEC-T1, and the rehash and invalid-hash tests |
| Account enumeration at login | Wrong password and unknown email give the identical response; the dummy-hash path runs for an unknown email | AT-L3, SEC-T3, SEC-T4 |
| Sessions | New session ID at login and the old row deleted; cookie is `HttpOnly`, `SameSite=Lax`, host-only, 7 days (1 hour anonymous); not readable by scripts in a real browser; old cookie rejected after logout; expired sessions rejected | AT-L2, AT-L6, AT-O1, AT-O2, SEC-T5, SEC-T6, end-to-end AT-L1 |
| CSRF | Every state-changing endpoint refuses a missing or wrong token and a foreign `Origin`; a stale token after login is refused; JSON only | SEC-T7, SEC-T8, `extra:` tests for every POST route |
| Authorisation | Unauthenticated `POST /posts` gets 401 even with an old token; the author is never taken from the request; unknown fields such as `author` are rejected | AT-P2, AT-P6, SEC-T9, SEC-T10, AT-S1 |
| Validation | Strict schemas on every body; lengths counted in characters; 10 KB body limit | AT-R4, AT-R5, AT-P3, AT-P4, AT-S2 |
| Injection | SQL-looking strings are rejected or stored as plain data and all tables stay intact; post content with HTML is shown as text and no script runs in a real browser | AT-S3, AT-P8 |
| Error responses | Every error uses the documented shape with no stack trace, SQL or file path; unexpected errors give a generic 500; the database-down health check reveals no connection details | AT-S2, SEC-T11, AT-D7 |
| Logging | Passwords, cookies, CSRF tokens and query strings never appear in the log; verified again in the Docker log | AT-S5 |
| Database rules | The database itself rejects duplicate emails and usernames, blank content, an unknown author and content over 280 characters | AT-D3 |
| Browser hardening | API: `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, no `X-Powered-By`. Web server: CSP (`default-src 'self'` and `frame-ancestors 'none'`), the same other headers, no version in `Server`. The app runs in a real browser under this CSP with no violations | tests in `app.test.ts`; `curl -I` against the Docker stack; browser run |
| Network exposure | Only the web port is published. `localhost:4000` and `localhost:5432` do not answer from the host. PostgreSQL is only published by the opt-in `docker-compose.debug.yml`, on 127.0.0.1 | checked against the running stack |
| Containers | The API runs as the non-root `node` user and exits cleanly (exit code 0) on SIGTERM | checked against the running stack |

## 4. Findings during the build, and what was done

These were found by the tests and the end-to-end runs and fixed before this review. They are listed because they show what the checks were able to catch.

| # | Finding | Fix |
|---|---|---|
| 1 | With the database down, `express-session` reported a failed save only after it had already sent a `200` and a cookie for a session that was never stored | Routes now save the session explicitly, so a failed save becomes a `503` |
| 2 | With the CSRF check before authentication, replaying an old cookie on `POST /posts` after logout returned 403 instead of the 401 that AT-O2 and SEC-T6 require | Authentication now comes first on protected routes; a test checks that every POST route still checks CSRF |
| 3 | Helmet merged its default CSP directives into the API's strict policy | Defaults turned off (`useDefaults: false`) |
| 4 | A `Secure` cookie cannot work in the HTTP demo | Configurable `COOKIE_SECURE`, off in the demo, with the reason recorded in ADR-0009 |
| 5 | With the API stopped, the proxy took about 14 seconds to fail, and it kept the API's address from start-up | `proxy_connect_timeout 3s` and a re-resolving upstream; the failure now takes milliseconds, and an end-to-end test guards it |
| 6 | `npm run check` failed on a fresh clone: type-aware lint ran before the Prisma client was generated (it existed in the working copy, so the problem was hidden) | A `prelint` script generates the client first. Found by following the README in a fresh clone |

## 5. Accepted risks (unchanged from security.md section 12)

| ID | Risk | Status |
|---|---|---|
| R1 | No rate limiting: password guessing, and creating many anonymous sessions or accounts, are not throttled | Accepted for a small demo audience; needs shared state to do properly |
| R2 | Registering reveals that an email address already has an account | Accepted; cannot be hidden without email verification |
| R3 | The demo runs over HTTP, so traffic can be read on the network and the cookie is not `Secure` | Accepted for the local demo; moving to HTTPS means `COOKIE_SECURE=true` and a TLS-terminating proxy |
| R4 | No password reset, no multi-factor authentication, no "log out everywhere" | Out of scope |

## 6. README verification on a clean checkout

A fresh `git clone` of the repository was made into an empty folder and the README was followed as written.

| README section | Result |
|---|---|
| Quick start (Docker): copy `.env.example`, generate and set a secret, `docker compose up --build` | All three services healthy in about one minute. A real browser then registered, logged in and posted at http://localhost:8080 with no CSP violations |
| Development: `npm ci`, `npm run db:up`, `npm run check` | `npm ci` installed 506 packages. `npm run check` passed (153 API tests, 58 web tests, build, and the verification scripts). Running the tests a second time also passed |
| `npm run db:migrate -w apps/api` | Applied the migration |
| Docker runbook commands (`restart`, `down`, `down -v`, `logs`, `exec db psql`, `run --rm api ... migrate status`) | Each was run and behaved as documented. Data survived `restart` and `down`, and `down -v` deleted it |

The clean-clone run found finding 6 above, which is fixed. The one difference from the README text: in the test environment the image builds needed an extra Compose file and certificate to get through the network proxy of the sandbox. A normal machine does not need this.

## 7. Not checked

- **Windows and Docker Desktop.** Everything here ran on Linux with Docker 29.8.2 and Compose v5.6.0. The author's machine (Windows, Docker 29.8.1, Compose v5.5.1) should behave the same but was not used for these results.
- **GitHub Actions.** The workflow passed in every run on 2026-10-19, including all four jobs on `main` after PR #39. A deliberately failing check turning a run red has not been observed yet.
- **HTTPS and `Secure` cookies.** The `Secure` flag is covered by a test with a simulated HTTPS proxy header, not by a real HTTPS deployment.
- **Load and denial of service**, penetration testing by a third party, and browsers other than Chromium.
