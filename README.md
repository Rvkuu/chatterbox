# Chatterbox

A lightweight social media MVP: register, log in, post short text messages, and read a shared feed (newest first).

> **Status:** all stages (0 to 7) are built. What was verified, with the actual results, and what has **not** been verified yet (notably a run of the GitHub Actions workflow on GitHub, and a run on Windows) are in the [release notes](docs/release-notes.md). The [demo script](docs/demo-script.md) is a ten-minute walk through the whole application.

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
| Docker Desktop | with Docker Compose | Runs the whole stack. This is all you need to run the app |
| Node.js | 24.x | Only for development and the tests. Pinned by the project (ADR-0008) |
| npm | the version bundled with Node 24 | Used with workspaces |
| Git | any recent version | |

The project was set up with Node 24.21.0, npm 11.19.0, Docker 29.8.1, Docker Compose v5.5.1 and Git 2.56.0 on Windows. Other recent versions should work, but these are the ones that have actually been used.

## Quick start (Docker)

This starts the web app, the API and PostgreSQL. Docker Desktop must be running. Run the commands from the repository root.

**1. Create your settings file.** Docker Compose refuses to start without it.

```bash
cp .env.example .env            # macOS, Linux, Git Bash
```

```powershell
Copy-Item .env.example .env     # Windows PowerShell
```

**2. Generate a session secret.** The API runs in production mode in Docker and refuses to start while `SESSION_SECRET` is still the placeholder or shorter than 32 characters. This prints a suitable value:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Open `.env` and replace the `SESSION_SECRET=` line with the printed value. (Without Node, any 32 or more random characters will do.)

**3. Build and start.**

```bash
docker compose up --build
```

The first build downloads the Node, PostgreSQL and nginx images and can take a few minutes. When it settles, open **http://localhost:8080**. The page should say `API status: ok` at the bottom. Use `localhost`, not `127.0.0.1`: the API only accepts state-changing requests from the origin in `WEB_ORIGIN` (see Troubleshooting).

Press Ctrl+C to stop, or use the commands below.

## Running with Docker

### Start, stop and restart

| Command | What it does | Your data |
|---|---|---|
| `docker compose up --build` | Build the images and start everything, showing the logs. Ctrl+C stops it | Kept |
| `docker compose up -d --build` | The same, in the background | Kept |
| `docker compose ps` | Show the services and whether they are healthy | Kept |
| `docker compose stop` | Stop the containers. They still exist | Kept |
| `docker compose start` | Start stopped containers again | Kept |
| `docker compose restart` | Stop and start the containers | **Kept** |
| `docker compose down` | Stop and remove the containers and the network | **Kept** (the database volume stays) |
| `docker compose down -v` | Stop and remove the containers **and the database volume** | **DELETED** |

> **Warning: `docker compose down -v` deletes all stored data.** Every user, post and session is removed, and it cannot be undone. Restarting the containers, stopping them, or running plain `docker compose down` does **not** delete data, because the database files live in a named Docker volume (`chatterbox_db-data`) that outlives the containers.

### Resetting the database on purpose

To start again from an empty database, delete the volume and start the stack:

```bash
docker compose down -v
docker compose up --build
```

Do this too after changing `POSTGRES_USER`, `POSTGRES_PASSWORD` or `POSTGRES_DB` in `.env`: PostgreSQL only reads those values when it creates a new database, so an existing volume keeps the old ones.

### How the stack starts

The services start in order: the database reports healthy, then the API starts and applies any pending database migrations, then the web server starts once the API is healthy. If the database is slow the API waits for it instead of crashing. Only the web server publishes a port (`WEB_PORT`, default 8080). The API and the database are reachable only from inside Docker.

### Migrations

They run automatically every time the API container starts. To check the state by hand:

```bash
docker compose run --rm api npx --no-install prisma migrate status
```

### Logs and the database

```bash
docker compose logs -f api          # follow the API log (Ctrl+C to stop following)
docker compose logs --tail 50       # the last 50 lines of every service
docker compose exec db psql -U chatterbox -d chatterbox -c "select count(*) from posts;"
```

The API log has one JSON line per request: method, path, status, duration and a request ID. It never contains passwords, cookies, tokens or request bodies. Use the values from your own `.env` if you changed `POSTGRES_USER` or `POSTGRES_DB`.

### Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `required variable ... is missing a value: Copy .env.example to .env first` | There is no `.env` file, or it lacks that variable. Create it from `.env.example` |
| The `api` container keeps stopping and the log says `SESSION_SECRET is still a placeholder` | Put a generated secret in `.env` (Quick start, step 2) and run `docker compose up -d` again |
| `port is already allocated` or the web port is busy | Another program uses port 8080. Set `WEB_PORT=8081` in `.env` and open http://localhost:8081 |
| Logging in or posting fails with a message that the request could not be verified | You opened the app on a different address than `WEB_ORIGIN` (for example `127.0.0.1` instead of `localhost`, or a changed `WEB_PORT`). Open `http://localhost:` followed by your `WEB_PORT` |
| `Cannot connect to the Docker daemon` | Docker Desktop is not running. Start it and wait until it says it is running |
| The build fails while pulling an image, with `429 Too Many Requests` | Docker Hub is limiting anonymous pulls. Wait a few minutes, or log in with `docker login`, and run the command again |
| The database password in `.env` was changed but the old one still works | See "Resetting the database on purpose" |
| After a code change the old behaviour is still there | Run `docker compose up --build` so the images are rebuilt |

## Development without Docker for the apps

Use Node 24 (see `.nvmrc`). Other major versions are refused on purpose. PostgreSQL still runs in Docker. `npm run db:up` publishes it on `127.0.0.1:5432` only, using the opt-in `docker-compose.debug.yml` (it is not published in the normal stack).

```bash
cp .env.example .env             # once (Copy-Item on PowerShell). SESSION_SECRET can stay as is here
npm ci                           # install exactly what package-lock.json lists
npm run db:up                    # start PostgreSQL and wait until it is healthy
npm run db:migrate -w apps/api   # create the tables in the development database
npm run dev -w apps/api          # start the API with auto-reload (http://127.0.0.1:4000)
npm run dev -w apps/web          # start the web app, in a second terminal (http://localhost:5173)
```

The Vite dev server forwards `/api` to the API, so the browser sees one origin, as in Docker. Stop the database with `npm run db:down`. In development `SESSION_SECRET` may be the placeholder, because the production check only applies when `NODE_ENV=production`.

### Running the tests

```bash
npm run db:up      # the integration tests need PostgreSQL
npm run check      # lint, format check, type check, tests and build
```

The tests use their own database, `chatterbox_test`, on the same PostgreSQL. It is created and migrated automatically from the real migrations, and its tables are emptied between tests, so your development data is never touched. Its address is `TEST_DATABASE_URL` in `.env`, and the database name must end in `_test`. In CI the same variable points at the workflow's PostgreSQL service.

The end-to-end tests drive a real browser against the Docker stack. See [End-to-end tests](#end-to-end-tests).

### Commands

| Command | What it does |
|---|---|
| `npm run lint` | ESLint over the whole repository (it generates the Prisma client first, which the type-aware rules need) |
| `npm run format` / `npm run format:check` | Prettier: fix files / only check them |
| `npm run typecheck` | TypeScript type check in every app |
| `npm test` | Run the tests in every app (needs `npm run db:up`) |
| `npm run build` | Build every app |
| `npm run check` | All of the above, in order |
| `npm run db:up` / `npm run db:down` | Start / stop PostgreSQL in Docker for local development |
| `npm run db:migrate -w apps/api` | Apply the migrations to the database in `DATABASE_URL` |
| `npm run dev -w apps/api` / `npm run dev -w apps/web` | Start the API / the web app with auto-reload |
| `npm run build -w apps/api` then `npm start -w apps/api` | Run the built API |
| `npm run e2e -w apps/e2e` | Run the end-to-end tests (see below) |

Messages you may see and can ignore:
- `npm warn install-scripts ...`: newer npm versions list dependency install scripts that are not approved yet. The scripts still run.
- `../../.env not found. Continuing without it.`: you have not created a `.env` file.

## End-to-end tests

They start their own copy of the stack under a separate Compose project name (`chatterbox-e2e`), on their own port and with their own database volume, so they can never touch your data. They register, log in, post, log out, check that protected actions are refused, restart the containers and check that the data is still there. Run them from the repository root:

```bash
npm ci
npx playwright install chromium          # once: downloads the browser the tests drive
npm run e2e -w apps/e2e
```

Docker Desktop must be running. The first run builds the images. The tests remove their own stack and volume when they finish.

## Configuration

All configuration comes from environment variables. `.env` is read by Docker Compose and by the local development commands, is ignored by Git, and must never be committed. `.env.example` lists every variable.

| Variable | Used by | Meaning |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Docker | Credentials and name of the database that Compose creates |
| `DB_PORT` | `npm run db:up` | Host port for PostgreSQL when you opt in to publishing it (127.0.0.1 only) |
| `NODE_ENV` | API | `development`, `test` or `production`. Compose always runs the API in production |
| `API_PORT`, `API_HOST` | API | Where the API listens. Docker sets the host to `0.0.0.0` |
| `DATABASE_URL` | API (local) | Connection string for local development. Compose builds its own from the `POSTGRES_*` values |
| `TEST_DATABASE_URL` | Tests | Connection string for the test database. The name must end in `_test` |
| `SESSION_SECRET` | API | At least 32 random characters. Production refuses a placeholder or a short value |
| `WEB_ORIGIN` | API | The one origin allowed to send state-changing requests. Compose sets it from `WEB_PORT` |
| `COOKIE_SECURE` | API | `true` or `false`. Default: on in production. Compose turns it off because the demo runs over HTTP ([ADR-0009](docs/adr/0009-configurable-secure-cookie-flag.md)) |
| `VITE_API_URL` | Web | Where the browser finds the API. `/api` (the same origin) is the default |
| `WEB_PORT` | Docker | The port the web app is published on. Default 8080 |

## Repository layout

```
apps/web/            React frontend (feed, composer, register, login, logout)
apps/api/            Express REST API (health, sessions, register, login, logout, posts)
apps/e2e/            End-to-end tests (Playwright, against the Docker stack)
docs/                Requirements, architecture, ADRs, workflow, release notes, demo script
.github/             CI workflow and issue/PR templates
docker-compose.yml   The web, api and database containers
package.json         npm workspaces and the shared scripts
.nvmrc               The Node.js version (24)
```

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request: lint, format check, type check, tests (twice, to show they do not depend on leftover state) and build with a PostgreSQL service container; a job that builds the Docker stack, starts it and checks it through the proxy; and `npm audit`.

## Known limitations

The full list is in [docs/requirements.md](docs/requirements.md) section 8 and [docs/security.md](docs/security.md) section 12. In short: the feed shows only the newest 100 posts; there is no password reset, email verification, post editing or deleting; there is no rate limiting; and the demo runs over HTTP, not HTTPS.

## Progress

| Stage | Scope | State |
|---|---|---|
| 0 | Repository and workflow setup | Done |
| 1 | Requirements and architecture | Done |
| 2 | Application scaffolding and CI | Done |
| 3 | Database and session foundation | Done |
| 4 | Authentication | Done |
| 5 | Post creation and feed | Done |
| 6 | Docker integration and persistence | Done |
| 7 | QA, security review and release | Done (open items are listed in the release notes) |

## Contributing

See [docs/workflow.md](docs/workflow.md) for the branch, commit, review and Kanban conventions.
