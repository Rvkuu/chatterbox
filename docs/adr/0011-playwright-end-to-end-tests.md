# ADR-0011: Playwright end-to-end tests against a private Docker stack

- Status: Accepted
- Date: 2026-10-19
- Requirements: NFR-T1, NFR-T2, NFR-R3, FR-06.3, FR-06.4

## Context
`docs/architecture.md` deferred the choice of end-to-end test tool to Stage 7. The end-to-end tests must drive a real browser against the real stack, and some of them must restart containers, stop the database and delete the database volume (AT-D4 to AT-D8). Deleting a volume is dangerous if it can ever reach a developer's own data (`docs/acceptance-tests.md` section 3).

## Decision
- Use **Playwright** (`@playwright/test`) in its own workspace, `apps/e2e`, with one worker because the tests share one stack.
- The tests control Docker Compose themselves, through a small module (`tests/stack.ts`). The stack is **private to the tests**: its own Compose project name (`chatterbox-e2e`), so its own network and database volume; its own web port (18080); and its own settings in a temporary file with a generated secret. Compose is told to ignore the developer's `.env`.
- The workspace has no `test` script, only `e2e`, so `npm test` and `npm run check` stay fast and need no browser or Docker. The end-to-end suite runs as its own job in CI.

## Alternatives considered
- **Cypress.** Capable, but it controls the browser from inside the page, which makes tests that restart containers and then continue in the same browser awkward.
- **Selenium or WebdriverIO.** More set-up for the same result, and no built-in waiting and assertion helpers.
- **Running the tests against the developer's own stack.** Simpler, but the volume-deletion test would then be able to delete real data. A private stack removes that risk entirely.
- **A `test` script in the workspace.** It would make `npm test` require Docker and a browser, which would break the fast local loop and the CI check job.

## Consequences
- The suite needs Docker running and a browser (`npx playwright install chromium`), and its first run builds the images.
- Tests that destroy data can only ever act on `chatterbox-e2e`. The teardown removes that stack and volume.
- The same module can be reused by the release check (NC9) to run the persistence scenarios.
