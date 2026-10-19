# Chatterbox MVP: release notes

Release check date: 2026-10-19. This document says what was delivered, what was verified and how, and what was not. Results come from runs that were actually made; where something was not run, it says so.

## 1. What was delivered

A lightweight social feed that runs locally with one command (`docker compose up --build`).

| Feature | What a user can do |
|---|---|
| Registration (FR-01) | Create an account with an email, a username (3 to 30 letters, numbers or underscores, unique ignoring case) and a password (12 to 128 characters). The server validates everything and shows field-level messages. Passwords are stored only as Argon2id hashes |
| Login and logout (FR-02, FR-03) | Log in with email and password; a server-side session is stored in PostgreSQL and the browser holds only an `HttpOnly`, `SameSite=Lax` cookie. A wrong password and an unknown email give the identical message. Logging out destroys the session |
| Feed (FR-04) | Anyone can read the newest 100 posts, newest first, each with the author's username, the text and the date and time. The page has loading, empty and error states, with a retry |
| Posting (FR-05) | A logged-in user writes a post of 1 to 280 characters (counted as characters, so an emoji is one). The author and the time are set by the server. The post appears at the top at once |
| Persistence (FR-06) | Users, posts and sessions are in PostgreSQL, created by version-controlled migrations. Data survives container restarts while the database volume is kept |

Around it: a database-aware health check (`GET /api/health`), the migrations applied automatically when the API starts, CSRF protection, security headers, a GitHub Actions workflow, 11 architecture decision records, and the documents in `docs/`.

## 2. Verification results

All numbers below are from actual runs on 2026-10-19 on Linux (Node 24.22.0, npm 11.21.1, Docker 29.8.2, Docker Compose v5.6.0, PostgreSQL 16, Chromium 141).

| Check | Result |
|---|---|
| `npm run check` (lint, format, type check, tests, build, verification scripts) | Passed, including from a fresh clone of the repository |
| API tests (11 files, real PostgreSQL, production Argon2id settings) | 153 passed |
| Web tests (5 files, React Testing Library) | 58 passed |
| End-to-end tests (Playwright, real browser, real Docker stack) | 18 passed in 2.4 minutes (17 acceptance scenarios plus one extra check) |
| Tests run a second time in a row (NC4) | Passed (API and web suites) |
| Acceptance scenarios with a test in every layer the document names | 54 of 54 (`node scripts/check-traceability.mjs`); the check was shown to fail when a test name was changed |
| Security cases SEC-T1 to SEC-T14 | 14 of 14 have tests or a script (see the traceability check) |
| `npm audit` | 0 vulnerabilities (586 packages) |
| Secrets in the repository and its whole history | None found (`node scripts/check-secrets.mjs --history`) |
| Configuration | Every variable documented, nothing hard-coded in the Compose files (`node scripts/check-config.mjs`) |
| README followed on a clean checkout | Docker Quick start and the development workflow both worked as written (details in [security-review.md](security-review.md), section 6) |
| Demo script followed step by step | Every step and every "Expected" result passed in a real browser (see section 4) |

The tests are named after the scenarios in [acceptance-tests.md](acceptance-tests.md), so a failing test points straight at the requirement it protects.

### Requirement checks that are not tests (NC1 to NC9)

| Check | Status |
|---|---|
| NC1 Lint, format and type check pass (NFR-M1) | Passed locally and in the clean clone. The CI workflow runs the same commands. It has **not yet been run on GitHub** |
| NC2 ADRs index every significant decision (NFR-M2) | 11 ADRs indexed in `docs/adr/README.md`; ADRs 0009 to 0011 were added during the build |
| NC3 Unit, integration, frontend and end-to-end suites exist and run (NFR-T1) | Yes: all four ran |
| NC4 Tests pass twice in a row with no leftover state (NFR-T2) | Passed twice locally. On a CI runner: not yet run |
| NC5 The README commands start the full stack on a clean clone (NFR-P1) | Passed on Linux. Not run on Windows |
| NC6 No hard-coded ports, URLs or credentials; `.env.example` lists every variable (NFR-P2) | Passed (`check-config`) |
| NC7 The schema matches `database.md` and is not shaped around out-of-scope features (NFR-X1) | The generated migration was read against the document: tables, unique indexes, the feed index, `ON DELETE RESTRICT` and the blank-content check all match |
| NC8 No secrets committed; production refuses a placeholder secret (NFR-S3) | Passed (`check-secrets`, SEC-T12, and a real refusal in Docker) |
| NC9 The release check runs D1, D2 and D4 and records the results (NFR-R3) | AT-D1 and AT-D2 passed in the API suite; AT-D4 passed end to end. See section 3 |

## 3. How persistence was demonstrated

Persistence is only claimed because it was checked (FR-06.5).

**By hand, through the real API in the Docker stack** (a cookie-jar client, so it behaves like a browser):

1. Register `ada_l`, log in, post "This must survive a restart". Feed: `ada_l: This must survive a restart`.
2. `docker compose restart`. The feed still showed the post, and the **same cookie** was still logged in (`GET /api/auth/me` returned 200).
3. `docker compose down` then `docker compose up -d --wait`. The volume `cbfull_db-data` was listed in between. The post and the same cookie were still valid, and logging in again with the password worked.
4. `docker compose down -v`. The volume was gone. After `up`, the feed was `(no posts)`, the old cookie got 401 and the old password got "Email or password is incorrect."

**By the automated end-to-end tests**, against a private stack (its own project name, port and volume):

| Test | What it proves |
|---|---|
| AT-D4 | Data survives `docker compose restart`, and `down` followed by `up` with the volume kept |
| AT-J1 | The primary journey, including restarting the containers and finding the post afterwards |
| AT-D6 | A login session survives an API restart (sessions are in PostgreSQL, not in memory) |
| AT-D5 | Deleting the volume deletes the data, which confirms the warning in the README |
| AT-D8 | A cold start (no containers, no volume) brings up all three services with no crash loop, and the API applies the migrations itself |
| AT-D7 | The health check reports `{"status":"ok","database":"up"}`, turns to `503` with `{"status":"degraded","database":"down"}` when the database is stopped, reveals nothing else, and recovers when it is started |

## 4. The demo

[demo-script.md](demo-script.md) is a step-by-step, repeatable script. It was executed from an empty database in a real browser, with each terminal command run as written and each "Expected" result checked: all passed. That is a scripted run, not a person from the team following it, so the first person to follow it by hand is the real confirmation (S7-3's testing expectation).

Running the script found a real defect: with the API stopped, the web server took about 14 seconds to give up, leaving visitors on "Loading posts…". It now fails in milliseconds and the page shows its error state with a **Try again** button. An end-to-end test guards it.

## 5. Known limitations

From [requirements.md](requirements.md) section 8 and [security.md](security.md) section 12:

- The feed shows only the newest 100 posts; there is no pagination.
- No password reset, no email verification, no multi-factor authentication, no "log out everywhere".
- Posts cannot be edited or deleted, and accounts cannot be deleted.
- **No rate limiting** (R1): password guessing and bulk sign-ups are not throttled.
- Registering reveals whether an email address already has an account (R2).
- **The demo runs over HTTP** (R3): traffic on the network is readable, and the session cookie is not marked `Secure`. Moving to HTTPS means a TLS-terminating proxy and `COOKIE_SECURE=true`.

Also worth knowing:

- Open the app as `http://localhost:<WEB_PORT>`. Using `127.0.0.1` makes the API refuse logins and posts, because its `Origin` check expects the address in `WEB_ORIGIN`.
- One API instance and one database are run. Sessions are stored in PostgreSQL, so more API instances could be added behind a load balancer without code changes (NFR-X2).
- Out-of-scope features (likes, comments, following, uploads, notifications and so on) were not built. The design keeps room for them: new tables and routes can be added without changing existing ones ([database.md](database.md) section 8).

## 6. Not verified

- **Windows and Docker Desktop** (the developer's machine): all results are from Linux.
- **GitHub Actions:** the workflow passes `actionlint` and every command in it was run locally, but no run on GitHub has been seen. The S2-4 acceptance criteria (a green run, and a deliberately failing check turning it red) are still open until the first push is observed.
- A real **HTTPS** deployment, browsers other than Chromium, load behaviour, and third-party penetration testing.

## 7. Problems found and fixed during the build

Listed in full in [security-review.md](security-review.md) section 4. The ones that mattered most: a session could be reported as saved when it was not (database down); an old cookie replayed after logout got the wrong status code; the web proxy was slow to fail and cached the API's address; and `npm run check` failed on a fresh clone because the Prisma client was generated too late (found only by following the README in a clean checkout).
