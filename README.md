# Chatterbox

A lightweight social media MVP: register, log in, post short text messages, and read a shared feed (newest first).

> **Status:** planning is complete (Stages 0 and 1), and the application is being built in stages. Stage 2 (scaffolding and CI) is under way. **Only skeletons of the API and the web app exist so far**: the API answers a health check, and the web page shows whether it can reach the API. Docker Compose starts both together with an empty database, which the API does not use yet. Run instructions are added only for files that exist.

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
apps/web/            React frontend (a page that shows the API status so far)
apps/api/            Express REST API (health check only so far)
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

```bash
npm ci                     # install exactly what package-lock.json lists
npm run check              # lint, format check, type check, tests and build
npm run dev -w apps/api    # start the API with auto-reload
npm run dev -w apps/web    # start the web app (run it in a second terminal)
```

With the API running, open http://127.0.0.1:4000/api/health. It should show `{"status":"ok"}`. The health check does not look at the database yet. With both running, open http://localhost:5173. The page should say `API status: ok`.

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
docker compose up --build
```

Open http://localhost:8080. The page should say `API status: ok`. Press Ctrl+C to stop, or run `docker compose down` in another terminal.

- Only the web app is published to your machine (port 8080, or `WEB_PORT` in `.env`). It also forwards `/api` to the API, so the browser sees one address (ADR-0006). The API and the database are reachable only from inside Docker.
- The services start in order: the database reports healthy, then the API, then the web app.
- The database files live in a named volume, so they survive `docker compose down`. `docker compose down -v` deletes them.
- Compose builds the images from the repository root and reads every setting from `.env`. If you change a password after the database has been created once, run `docker compose down -v` so the database is created again with the new value.
- The API does not use the database yet. That arrives in Stage 3. Compose already starts it so that the setup is in place.
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