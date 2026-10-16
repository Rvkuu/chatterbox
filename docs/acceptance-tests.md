# Chatterbox Acceptance Tests

Status: Draft for review · Defines **what must be true** for each requirement in [requirements.md](requirements.md). Nothing in this document has been implemented or run yet. Every scenario below is planned work.

## 1. Purpose and how to read this

Each scenario is a short *Given / When / Then* statement. It says what the starting situation is, what happens, and what must be observed. Scenarios are written to be implemented as automated tests at the layers shown, so the same behaviour is checked as cheaply as possible and again end to end where it matters.

- **Scenario IDs** look like `AT-R1`. The letter is the group (R registration, L login, O logout, F feed, P posts, D data and operations, S security, J journeys).
- **Test names must start with the scenario ID**, for example `it("AT-R1: registers a new account")`. That lets a script confirm that every scenario has a test.
- Security test cases `SEC-T1` to `SEC-T14` are defined in [security.md](security.md) section 13 and are part of this acceptance suite. They appear in the traceability matrix.
- Non-functional requirements that are checked by a review or a CI result, not a test case, are listed as `NC1` to `NC9` in section 5.

## 2. Test layers

| Layer | What it tests | Where the scenarios run |
|---|---|---|
| Unit | Single functions with no I/O: validation rules, trimming and length counting, email normalisation | Vitest, in each app |
| Integration | The API over HTTP against a real PostgreSQL test database | Vitest in the API app, and in CI with a PostgreSQL service |
| Frontend | React components with the API mocked | Vitest with React Testing Library |
| End-to-end | The full stack in a browser against Docker Compose | Tool chosen in S7-1 |
| Review | Checked by reading the documents or configuration | Pull request review |

## 3. Test data and isolation

| Rule | Detail |
|---|---|
| Fixed fixtures | USER_A: email `ada@example.com`, username `ada_l`, password `correct horse battery staple`. USER_B: email `grace@example.com`, username `grace_h`, password `another long test passphrase`. These are test-only values, not real accounts |
| Controlled time | Ordering tests create posts with explicit creation times or a controlled clock. No test uses `sleep` to separate posts |
| Own database | Tests use a dedicated test database, never a developer's data. The database name and credentials come from the environment |
| Clean state | Every test starts from known state: tables are emptied before each test, or the test runs inside its own transaction. Tests never depend on the order they run in |
| End-to-end isolation | End-to-end runs use their own Compose project name and volume, so removing that volume can never touch a developer's data |
| Slow hashing | Argon2id hashing takes noticeable time. Fixtures are created once per test file where possible. Production hashing parameters are never weakened for tests |

## 4. Scenarios

Layers: **U** unit, **I** integration, **F** frontend, **E** end-to-end, **R** review.

### Registration (FR-01)

Implemented in: S4-1 (#14) for the API, S4-3 (#16) for the form.

| ID | Scenario | Layers | Covers |
|---|---|---|---|
| AT-R1 | **Successful registration.** Given no account exists. When a visitor registers with USER_A's email, username and password. Then the API returns 201 with only `id`, `username` and `createdAt` (no email, hash or password), and USER_A can then log in. | I, F, E | FR-01.1, FR-01.5 |
| AT-R2 | **Password stored only as an Argon2id hash.** Given USER_A is registered. When the `users` row is read directly from the database. Then `passwordHash` starts with `$argon2id$`, differs from the password, and the password text appears nowhere in the row. Also SEC-T1. | I | FR-01.4 |
| AT-R3 | **Email is normalised.** Given no account exists. When a visitor registers with the email `  Ada@Example.COM ` (spaces and capitals). Then the stored email is `ada@example.com`, and logging in with `ada@example.com` succeeds. | U, I | FR-01.2, FR-01.3 |
| AT-R4 | **Field validation.** Given no account exists. When registration is attempted with each invalid input: a missing field, a wrong type, an email with no `@` or over 254 characters, a username of 2 or 31 characters, a username containing a space or hyphen, a password of 11 or 129 characters. Then each returns 400 `VALIDATION_ERROR` with `fields` naming the offending field, and no account is created. | U, I, F | FR-01.2, FR-01.6 |
| AT-R5 | **Unknown fields are rejected.** Given no account exists. When the body contains an extra field such as `role: "admin"`. Then the API returns 400 and no account is created. | I | FR-01.2 |
| AT-R6 | **Duplicate email.** Given USER_A exists. When someone registers the same email in any capitalisation with a different username. Then the API returns 409 `CONFLICT` with `fields.email`, no second row exists, and the form shows the message at the email field. | I, F | FR-01.3 |
| AT-R7 | **Duplicate username in any case.** Given USER_A exists. When someone registers the username `ADA_L` with a different email. Then the API returns 409 with `fields.username`. Also SEC-T13. | I | FR-01.3 |
| AT-R8 | **Simultaneous duplicate registrations.** Given no account exists. When two identical registrations are sent at the same moment. Then exactly one returns 201, the other returns 409 (never 500), and one row exists. | I | FR-01.3 |
| AT-R9 | **Registering does not log the user in.** Given a visitor registers successfully. When `GET /auth/me` is called with that visitor's cookie. Then it returns 401. | I | FR-01.1 |
| AT-R10 | **Registration form behaviour.** Given the registration form is shown. When the inputs are invalid, or the API returns 400 or 409, or the network fails. Then messages appear next to the right fields, a general message appears for network failure, and the submit button cannot be used twice while a request is in flight. | F | FR-01.2, FR-01.6 |

### Login (FR-02)

Implemented in: S4-2 (#15) for the API, S4-3 (#16) for the form.

| ID | Scenario | Layers | Covers |
|---|---|---|---|
| AT-L1 | **Successful login.** Given USER_A is registered. When USER_A logs in with the correct credentials. Then the API returns 200 with the user (no email), `Set-Cookie` for `chatterbox.sid` includes `HttpOnly` and `SameSite=Lax`, a session row for the user exists, and the UI shows the logged-in state. Also SEC-T5. | I, F, E | FR-02.1, FR-02.2 |
| AT-L2 | **Session ID is regenerated at login.** Given a visitor holds an anonymous session cookie. When the visitor logs in. Then the new cookie value differs from the old one and the old session row no longer exists. | I | FR-02.3 |
| AT-L3 | **Failed login is generic.** Given USER_A is registered. When a login uses a wrong password, and another uses an unknown email. Then both return the identical 401 `INVALID_CREDENTIALS` response, and the UI shows the same single message for both. Server-side checks are SEC-T3 and SEC-T4. | I, F | FR-02.4 |
| AT-L4 | **Malformed login request.** Given no session. When the login body has a missing field, a wrong type or an unknown field. Then the API returns 400 `VALIDATION_ERROR` and no session is created. | I | NFR-S1 |
| AT-L5 | **Current user.** Given USER_A is logged in. When `GET /auth/me` is called, and the page is reloaded. Then the API returns 200 with the user and the UI is still logged in after the reload. Without a session the API returns 401. | I, F, E | FR-02.2 |
| AT-L6 | **Session expiry.** Given USER_A is logged in. When the session's expiry time has passed (by moving the test clock or the row's `expire` value into the past). Then protected endpoints return 401 `UNAUTHENTICATED`. | I | NFR-S2 |

### Logout and session invalidation (FR-03)

Implemented in: S4-2 (#15), S4-3 (#16), and S7-1 (#21) for the end-to-end check.

| ID | Scenario | Layers | Covers |
|---|---|---|---|
| AT-O1 | **Logout.** Given USER_A is logged in. When USER_A logs out with a valid CSRF token. Then the API returns 204, the cookie is cleared, and the session row is deleted. | I, E | FR-03.1, FR-03.2 |
| AT-O2 | **Old cookie no longer works.** Given USER_A logged in, a copy of the cookie was saved, and USER_A then logged out. When the saved cookie is replayed on `GET /auth/me` and on `POST /posts`. Then both return 401. Also SEC-T6. | I | FR-03.3 |
| AT-O3 | **Logout without a session.** Given a visitor with no session and a valid anonymous CSRF token. When the visitor calls logout. Then the API returns 204 and no error. | I | FR-03.1 |
| AT-O4 | **Interface after logout.** Given USER_A is logged in. When USER_A clicks log out and then reloads the page. Then the composer is gone, the login and register links are shown, and the visitor is still logged out after the reload. | F, E | FR-03.1, FR-03.3 |

### Viewing the feed (FR-04)

Implemented in: S5-1 (#17) for the API, S5-2 (#18) for the UI.

| ID | Scenario | Layers | Covers |
|---|---|---|---|
| AT-F1 | **The feed is public.** Given a visitor with no session. When `GET /posts` is called, and the home page is opened. Then the API returns 200 and the page shows the feed. | I, E | FR-04.1 |
| AT-F2 | **Newest first, across users.** Given posts by USER_A and USER_B with distinct, known creation times. When the feed is loaded. Then every post is present, ordered by creation time descending, and the UI renders them in that order. | I, F, E | FR-04.2 |
| AT-F3 | **Stable order for equal timestamps.** Given two posts with an identical `createdAt`. When the feed is requested repeatedly. Then the order is identical every time (ties are broken by `id` descending, as in `database.md`). | I | FR-04.2 |
| AT-F4 | **Each post shows author, content and date.** Given a post by USER_A. When the feed is loaded. Then the post shows USER_A's username, the content and a readable creation date and time, and the API payload contains no email or hash. | I, F | FR-04.3 |
| AT-F5 | **The feed is limited to 100 posts.** Given 105 posts exist. When the feed is requested. Then exactly the 100 newest are returned and the 5 oldest are absent. | I | FR-04.6 |
| AT-F6 | **Empty feed.** Given no posts exist. When the feed is loaded. Then the API returns 200 with an empty `posts` array and the UI shows an empty-state message. | I, F | FR-04.4 |
| AT-F7 | **Loading state.** Given the API response is delayed. When the feed screen opens. Then a loading indicator is shown until the data arrives, and then removed. | F | FR-04.5 |
| AT-F8 | **Failure states.** Given the API returns 500, returns 503, or cannot be reached. When the feed is loaded. Then an error message with a retry action is shown, the app does not crash, and retrying after recovery loads the feed. | F | FR-04.5 |
| AT-F9 | **List responses are objects.** Given any posts exist. When `GET /posts` is called. Then the body is an object with a `posts` array, never a bare array. | I | NFR-X3 |

### Creating posts (FR-05)

Implemented in: S5-1 (#17) for the API, S5-2 (#18) for the UI.

| ID | Scenario | Layers | Covers |
|---|---|---|---|
| AT-P1 | **Create a post.** Given USER_A is logged in. When USER_A submits "Hello, Chatterbox!". Then the API returns 201 with a post whose author is USER_A, and the post appears at the top of the feed without a manual reload. | I, F, E | FR-05.1, FR-05.3, FR-05.5, FR-05.6 |
| AT-P2 | **Unauthenticated creation is refused.** Given a visitor with no session and a valid anonymous CSRF token. When the visitor posts to `/posts`. Then the API returns 401 `UNAUTHENTICATED`, no row is created, and the UI does not show a composer. Also SEC-T10. | I, E | FR-05.1 |
| AT-P3 | **Blank content is refused.** Given USER_A is logged in. When the content is an empty string, only spaces, or only tabs and newlines. Then the API returns 400 `VALIDATION_ERROR`, no row is created, and the UI shows a message. | U, I, F | FR-05.2 |
| AT-P4 | **Length boundary.** Given USER_A is logged in. When the content is 280 ASCII characters, 281 ASCII characters, 280 emoji, 281 emoji, or 280 characters surrounded by spaces. Then the first, third and fifth are accepted and the second and fourth are rejected (length is counted in characters after trimming, per DB4). | U, I | FR-05.2 |
| AT-P5 | **Content is trimmed.** Given USER_A is logged in. When the content is `  hi  `. Then the stored and returned content is `hi`. | I | FR-05.2 |
| AT-P6 | **The author cannot be supplied.** Given USER_A is logged in. When the body includes `author`, `authorId`, `id` or `createdAt`. Then the API returns 400 for the unknown field and no row is created. Also SEC-T9. | I | FR-05.3 |
| AT-P7 | **The timestamp comes from the server.** Given USER_A is logged in. When a post is created. Then `createdAt` lies between the times just before and just after the request, in UTC ISO 8601 format. | I | FR-05.4 |
| AT-P8 | **Content is shown as text.** Given USER_A posts `<script>alert(1)</script><b>x</b>`. When the feed is displayed. Then the characters are stored unchanged and shown literally, no script runs and no `script` or `b` element is created. | F, E | NFR-S1 |
| AT-P9 | **Composer behaviour.** Given USER_A is logged in. When a submission succeeds, fails validation, fails on the network, or the session has expired (the client retries once after a CSRF error, then receives 401). Then success clears the field and shows the post, failures keep the typed text and show an error, and expiry returns the UI to the logged-out state. | F | FR-05.5, FR-05.6 |

### Persistence, migrations and operations (FR-06, NFR-R)

Implemented in: S3-1 (#12), S3-2 (#13), S6-1 (#19), S6-2 (#20) and S7-1 (#21).

| ID | Scenario | Layers | Covers |
|---|---|---|---|
| AT-D1 | **Migrations build the schema.** Given an empty database. When migrations are deployed. Then the `users`, `posts` and `session` tables exist with the constraints and indexes described in `database.md` (unique email, unique `usernameKey`, feed index, blank-content check). | I | FR-06.1, FR-06.2 |
| AT-D2 | **Migrations are repeatable.** Given a migrated database. When migrations are deployed again. Then nothing changes and there is no error. | I | FR-06.2 |
| AT-D3 | **The database enforces its own rules.** Given a migrated database. When rows are inserted directly with a duplicate email, whitespace-only post content, or a post whose author does not exist. Then the database rejects each insert. | I | FR-06.1, NFR-S6 |
| AT-D4 | **Data survives a restart.** Given the stack is running with USER_A and one post. When the containers are restarted, and separately when the stack is brought down and up again without removing the volume. Then USER_A can log in and the post is still in the feed. | E | FR-06.3 |
| AT-D5 | **Deleting the volume deletes the data.** Given data exists in the dedicated test stack. When that stack is brought down with its volume removed and started again. Then there are no users or posts, which confirms the documented warning. This only ever runs against the test stack. | E | FR-06.4, FR-06.5 |
| AT-D6 | **Sessions survive an API restart.** Given USER_A is logged in. When the API process or container is restarted. Then the same cookie is still accepted. | I, E | NFR-X2 |
| AT-D7 | **Health check.** Given the stack is running. When `GET /health` is called with the database up, and again with it stopped. Then the first returns 200 with `{ status: "ok", database: "up" }`, the second returns 503 with `{ status: "degraded", database: "down" }`, and neither body contains connection strings or versions. | I, E | NFR-R1, NFR-S4 |
| AT-D8 | **Startup order.** Given no containers are running. When the stack is started from cold. Then the API only serves once the database is healthy, there is no crash loop, and the web app is reachable. | E | NFR-R2, NFR-P1 |
| AT-D9 | **Documentation matches behaviour.** Given the README. When it is reviewed during S6-2 and S7-2. Then it distinguishes restarting containers from deleting the volume and warns that deleting the volume deletes the stored data. | R | FR-06.4 |

### Security and robustness (NFR-S), in addition to SEC-T1 to SEC-T14

Implemented in: S4-2 (#15), S5-1 (#17) and S7-2 (#22).

| ID | Scenario | Layers | Covers |
|---|---|---|---|
| AT-S1 | **Protected endpoints.** Given each endpoint in `api.md` section 4. When it is called with no session and with a valid session. Then the results match the Auth column of that table. | I | NFR-S2 |
| AT-S2 | **Uniform error format.** Given the API is running. When an unknown route, malformed JSON, a wrong content type, a body over 10 KB, and an invalid body are sent. Then the responses are 404 `NOT_FOUND`, 400, 415, 400 and 400, each in the documented error shape with no stack trace, SQL or file path. | I | NFR-S1, NFR-S4 |
| AT-S3 | **Injection strings are only data.** Given strings such as `'; DROP TABLE users; --` and `" OR 1=1 --`. When they are used as email, username, password and post content. Then each is rejected by validation or stored unchanged as data, and all tables remain intact. | I | NFR-S1, NFR-S6 |
| AT-S4 | **CSRF handling in the browser.** Given the frontend's API client. When a `POST` receives 403 `CSRF_INVALID`, and after login and after logout. Then it fetches a new token and retries once, shows an error if the retry also fails, and always uses a fresh token after the session changes. Server-side checks are SEC-T7 and SEC-T8. | F | NFR-S5 |
| AT-S5 | **No secrets in logs.** Given requests that carry passwords, cookies and CSRF tokens. When the API's captured log output for the test run is searched. Then it contains none of those values. | I | FR-01.4, NFR-S4 |

### End-to-end journeys

Implemented in: S7-1 (#21).

| ID | Scenario | Layers | Covers |
|---|---|---|---|
| AT-J1 | **Primary journey.** Given a freshly started stack with an empty database. When the steps below are followed in order. Then every expectation holds. Steps: (1) open the app, expect the empty state and no composer; (2) register USER_A; (3) log in; (4) post "First post"; (5) expect it in the feed; (6) log out, expect the composer gone and a direct `POST /api/posts` to return 401; (7) restart the containers; (8) log in again and expect the post still present. | E | FR-01.1, FR-02.1, FR-03.1, FR-03.3, FR-04.2, FR-05.1, FR-06.3 |
| AT-J2 | **Two users share one feed.** Given USER_A and USER_B in separate browser contexts. When each posts once, USER_A first. Then both users see both posts, newest first, each under the correct author. | E | FR-04.2, FR-05.3 |

## 5. Non-functional checks

These requirements are shown to be met by a review or a CI result.

| ID | Requirement | Check | Done in |
|---|---|---|---|
| NC1 | NFR-M1 | CI runs lint, format check and type check for both apps, and they pass. | S2-4 (#11) |
| NC2 | NFR-M2 | `docs/adr/README.md` indexes an ADR for every significant decision, and new decisions in later stages add one. | each PR, final check S7-2 (#22) |
| NC3 | NFR-T1 | Unit, integration, frontend and end-to-end suites all exist and run (the end-to-end suite at least as part of the release check). | S2-4 (#11), S7-1 (#21) |
| NC4 | NFR-T2 | The test suites pass twice in a row on a clean CI runner that has only the PostgreSQL service container, and never read a developer's `.env` or personal database. | S2-4 (#11) |
| NC5 | NFR-P1 | On a clean clone, following only the README commands starts the full stack and the app works. | S7-2 (#22) |
| NC6 | NFR-P2 | A search of the source and Compose files finds no hard-coded ports, URLs or credentials beyond environment references, and `.env.example` lists every variable the apps read. | S6-1 (#19), S7-2 (#22) |
| NC7 | NFR-X1 | When the schema is implemented, it matches `database.md`, and no table is shaped around a specific out-of-scope feature, so section 8 of that document still holds. | S3-1 (#12) review |
| NC8 | NFR-S3 | No `.env` file and no secret is committed, and the production start refuses a placeholder secret. Also SEC-T12 and SEC-T14. | S2-4 (#11), S7-2 (#22) |
| NC9 | NFR-R3 | The release check runs D1, D2 and D4 and records the results. | S7-1 (#21) |

## 6. Traceability matrix

Every requirement ID in `requirements.md` and the scenarios, checks or security cases that cover it. A requirement with no entry would be a defect in this document.

| Requirement | Covered by |
|---|---|
| FR-01.1 | AT-R1, AT-R9, AT-J1 |
| FR-01.2 | AT-R3, AT-R4, AT-R5, AT-R10 |
| FR-01.3 | AT-R3, AT-R6, AT-R7, AT-R8, SEC-T13 |
| FR-01.4 | AT-R2, AT-S5, SEC-T1 |
| FR-01.5 | AT-R1, SEC-T2 |
| FR-01.6 | AT-R4, AT-R10 |
| FR-02.1 | AT-L1, AT-J1 |
| FR-02.2 | AT-L1, AT-L5, SEC-T5 |
| FR-02.3 | AT-L2, SEC-T5 |
| FR-02.4 | AT-L3, SEC-T3, SEC-T4 |
| FR-03.1 | AT-O1, AT-O3, AT-O4, AT-J1 |
| FR-03.2 | AT-O1 |
| FR-03.3 | AT-O2, AT-O4, AT-J1, SEC-T6 |
| FR-04.1 | AT-F1 |
| FR-04.2 | AT-F2, AT-F3, AT-J1, AT-J2 |
| FR-04.3 | AT-F4 |
| FR-04.4 | AT-F6 |
| FR-04.5 | AT-F7, AT-F8 |
| FR-04.6 | AT-F5 |
| FR-05.1 | AT-P1, AT-P2, AT-J1, SEC-T10 |
| FR-05.2 | AT-P3, AT-P4, AT-P5 |
| FR-05.3 | AT-P1, AT-P6, AT-J2, SEC-T9 |
| FR-05.4 | AT-P7 |
| FR-05.5 | AT-P1, AT-P9 |
| FR-05.6 | AT-P1, AT-P9 |
| FR-06.1 | AT-D1, AT-D3 |
| FR-06.2 | AT-D1, AT-D2 |
| FR-06.3 | AT-D4, AT-J1 |
| FR-06.4 | AT-D5, AT-D9 |
| FR-06.5 | AT-D5 |
| NFR-S1 | AT-L4, AT-P8, AT-S2, AT-S3 |
| NFR-S2 | AT-L6, AT-S1 |
| NFR-S3 | NC8, SEC-T12, SEC-T14 |
| NFR-S4 | AT-D7, AT-S2, AT-S5, SEC-T11 |
| NFR-S5 | AT-S4, SEC-T7, SEC-T8 |
| NFR-S6 | AT-D3, AT-S3 |
| NFR-M1 | NC1 |
| NFR-M2 | NC2 |
| NFR-T1 | NC3 |
| NFR-T2 | NC4 |
| NFR-P1 | AT-D8, NC5 |
| NFR-P2 | NC6 |
| NFR-R1 | AT-D7 |
| NFR-R2 | AT-D8 |
| NFR-R3 | NC9 |
| NFR-X1 | NC7 |
| NFR-X2 | AT-D6 |
| NFR-X3 | AT-F9 |

## 7. Pass criteria

- A scenario passes when its automated test (or its review, for layer R) passes. A scenario is not "done" until a test with its ID in the name exists and passes.
- The acceptance suite passes when **every** scenario, NC check and SEC-T case in this document passes. A failure in any of them blocks the release in Stage 7.
- Results are reported from actual runs. A scenario that has not run is reported as not run, never as passed.

## 8. Counts

This document defines 54 scenarios (AT-R1 to AT-J2), 9 non-functional checks (NC1 to NC9), and uses the 14 security cases from `security.md`. They cover 48 requirement IDs.
