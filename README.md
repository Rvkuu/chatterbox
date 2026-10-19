# Chatterbox

A lightweight social media MVP: register, log in, post short text messages, and read a shared feed (newest first).

> **Status:** planning is complete (Stages 0 and 1), and the application is being built in stages. Stage 2 (scaffolding and CI) is under way. **Only skeletons of the API and the web app exist so far**: the API handles registration, login and logout, and the web app has the register, login and logout screens. Docker Compose starts both together with PostgreSQL, and the API checks the database and keeps sessions in it. Run instructions are added only for files that exist.

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
apps/web/            React frontend (register, login and logout so far)
apps/api/            Express REST API (health, sessions, register, login, logout)
docs/                Requirements, architecture, ADRs, workflow
.github/             CI workflows and issue/PR templates
docker-compose.yml   The web, api and database containers
package.json         npm workspaces and the shared scripts
.nvmrc               The Node.js version (24)
```

## Configuration

Copy the example file and edit it. Never commit `.env`.

```bash
cp .env.example .env
```

The web app reads the same `.env` file. `VITE_API_URL=/api` makes the browser call `/api` on its own address, and the Vite dev server forwards that to the API (ADR-0006). If your `.env` has an older `VITE_API_URL=http://localhost:4000`, change it to `/api`.

## Development

Use Node 24 (see `.nvmrc`). Other major versions are refused on purpose.

The API and the tests need PostgreSQL. Docker runs it for you, and `npm run db:up` publishes it on `127.0.0.1:5432` only (it is not published in the normal stack):

```bash
cp .env.example .env       # once
npm ci                     # install exactly what package-lock.json lists
npm run db:up              # start PostgreSQL in Docker and wait until it is healthy
npm run check              # lint, format check, type check, tests and build
npm run db:migrate -w apps/api   # create the tables in the development database
npm run dev -w apps/api    # start the API with auto-reload
npm run dev -w apps/web    # start the web app (run it in a second terminal)
```

With the API running, open http://127.0.0.1:4000/api/health. It should show `{"status":"ok","database":"up"}`. With both running, open http://localhost:5173. The page should say `API status: ok`. Stop the database with `npm run db:down`.

### Running the tests

The tests use their own database, `chatterbox_test`, on the same PostgreSQL. It is created and migrated automatically, and its tables are emptied between tests, so it never touches your development data. Its address is `TEST_DATABASE_URL` in `.env` (the name must end in `_test`). In CI the same variable points at the workflow's PostgreSQL service.

| Command | What it does |
|---|---|
| `npm run lint` | ESLint over the whole repository |
| `npm run format` / `npm run format:check` | Prettier: fix files / only check them |
| `npm run typecheck` | TypeScript type check in every app |
| `npm test` | Run the tests in every app |
| `npm run build` | Build every app |
| `npm run check` | All of the above, in order |
| `npm run dev -w apps/api` | Start the API with auto-reload |
| `npm run dev -w apps/web` | Start the web app on http://localhost:5173 |
| `npm run build -w apps/api` then `npm start -w apps/api` | Run the built API |
| `npm run db:up` / `npm run db:down` | Start / stop PostgreSQL in Docker for local development |
| `npm run db:migrate -w apps/api` | Apply the migrations to the database in `DATABASE_URL` |
| `docker compose up --build` | Build and start web, api and the database |
| `docker compose down` | Stop the containers. The database data is kept |
| `docker compose down -v` | Stop the containers and delete the database data |

Messages you may see and can ignore:
- `npm warn install-scripts ...`: newer npm versions list dependency install scripts that are not approved yet. The scripts still run.
- `../../.env not found. Continuing without it.`: you have not created a `.env` file. The defaults work.

## Running with Docker

This starts the whole stack: the web app, the API and PostgreSQL. Docker Desktop must be running.

```bash
cp .env.example .env        # once. Docker Compose refuses to start without it
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # prints a secret
```

Put the printed value in `.env` as `SESSION_SECRET=...`. In Docker the API runs in production mode and refuses to start while `SESSION_SECRET` is still the placeholder or shorter than 32 characters. Then:

```bash
docker compose up --build
```

Open http://localhost:8080. The page should say `API status: ok`. Press Ctrl+C to stop, or run `docker compose down` in another terminal.

- Only the web app is published to your machine (port 8080, or `WEB_PORT` in `.env`). It also forwards `/api` to the API, so the browser sees one address (ADR-0006). The API and the database are reachable only from inside Docker.
- The services start in order: the database reports healthy, then the API, then the web app.
- The database files live in a named volume, so they survive `docker compose down`. `docker compose down -v` deletes them.
- Compose builds the images from the repository root and reads every setting from `.env`. If you change a password after the database has been created once, run `docker compose down -v` so the database is created again with the new value.
- The API applies any pending database migrations each time it starts, then serves requests.
- The demo runs over HTTP, so Compose sets `COOKIE_SECURE=false` (see ADR-0009). Set `COOKIE_SECURE=true` in `.env` only when you serve the stack over HTTPS.
- In Docker the API runs with `NODE_ENV=production`, whatever `.env` says.
- The first build downloads the Node, PostgreSQL and nginx images and can take a few minutes.

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