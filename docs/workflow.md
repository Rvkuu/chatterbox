# Development workflow

## Roles and ownership
Roles: Product Manager, Backend, Frontend, DevOps, QA. Roles describe responsibility, not hard boundaries.
Every issue names one **responsible role** and one **reviewer role**.

## Branches
- `main` is always stable; no direct commits once CI exists.
- One branch per task or closely related group: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `chore/<topic>`, `test/<topic>`.
- Merge by pull request after review and passing checks.

## Commits (Conventional Commits)
`type(scope): summary`, using types `feat`, `fix`, `docs`, `test`, `build`, `chore`, `refactor`. Keep commits small and coherent.
Never commit secrets, `.env`, or build artifacts.

## Pull requests
Use the PR template. A PR links its issue (`Closes #n`), lists the tests run, and notes security or documentation impact.

## Kanban (GitHub Projects)
Columns: **Backlog → Ready → In Progress → Review / Testing → Done**.
WIP limits (team rule): In Progress ≤ 3, Review / Testing ≤ 3.
- *Ready*: acceptance criteria clear, dependencies done.
- *Review / Testing*: PR open, awaiting review and QA verification.
- *Done*: merged, checks green, acceptance criteria verified.

## Labels
Type: `feature`, `bug`, `documentation`, `testing`, `infrastructure`, `security`.
Priority: `priority-high`, `priority-medium`, `priority-low`.

## Definition of done
Acceptance criteria met · tests added and passing · docs updated · reviewed · no secrets committed.

## Scope control
Features outside the MVP scope need a written proposal (value, cost, risk, schedule impact) before entering the backlog.