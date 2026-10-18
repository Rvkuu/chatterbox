# ADR-0008: npm workspaces and Node.js 24

- Status: Accepted
- Date: 2026-10-16
- Requirements: NFR-M1, NFR-P1, NFR-T2

## Context
ADR-0001 left two points open for Stage 2: whether to use workspaces, and which package manager and Node.js version to use. The two apps share no code, but both need the same development tooling (TypeScript, ESLint, Prettier, Vitest) to be consistent (NFR-M1). Each app gets its own Docker image. The team is small and the project should avoid extra tools to install and keep in step.

The Node.js release schedule was checked on 2026-10-16 (nodejs/Release `schedule.json`): Node 24 became LTS on 2025-10-28, enters maintenance on 2026-10-20 and reaches end of life on 2028-04-30. Node 22 reaches end of life on 2027-04-30. Node 26 only becomes LTS on 2026-10-28.

## Decision
- Use **npm** with **npm workspaces**. A root `package.json` lists `apps/*` as workspaces, one `package-lock.json` at the repository root covers both apps, and shared development tooling and configuration live at the root.
- Use **Node.js 24** (the 24.x line). It is pinned in three places so they cannot drift: an `.nvmrc` file, the `engines` field in `package.json`, and the Docker base image tag.
- Do not add a task runner such as Turborepo or Nx (see ADR-0001).

The exact files and scripts are created in S2-1 and S2-2.

## Alternatives considered
- **pnpm workspaces.** Faster and stricter about undeclared imports, but it is one more tool to install and pin on every machine, in CI and in Docker. Recent pnpm versions also do not run dependency install scripts unless they are allow-listed, which adds configuration for packages such as Prisma. The speed benefit is negligible for two small apps, and an ESLint rule recovers most of the strictness.
- **Two independent npm packages (no workspaces).** The simplest Docker builds, but two lockfiles, duplicated tooling versions that can drift, and awkward sharing of lint and format configuration.
- **Yarn.** Classic Yarn is in maintenance mode, and modern Yarn's default Plug'n'Play layout breaks some tools unless switched off.
- **Bun.** A second runtime, while the project specifies Node.js.
- **Node.js 22 or 26.** Node 22 has the shorter remaining support window. Node 26 is not yet LTS.

## Consequences
- One `npm ci` at the root installs everything, and CI needs only one install step.
- Docker builds use the repository root as their build context so that they can see the root lockfile. The Dockerfiles copy the root and per-app `package.json` files first, for layer caching, and install one workspace at a time.
- npm moves shared packages to the root `node_modules`, which can hide a missing dependency in an app's own `package.json`. An ESLint rule (`import-x/no-extraneous-dependencies`, from `eslint-plugin-import-x`, the maintained fork of `eslint-plugin-import` that supports current ESLint) catches it.
- The location of Prisma's generated client interacts with this hoisting. It works, and is verified when Prisma is added in S3-1, not assumed.
- Newer npm versions (seen with 11.21) warn about dependency install scripts that have not been approved, but still run them. If a later npm version blocks them, packages such as Prisma, argon2 and esbuild are approved with `npm install-scripts approve`, which records the approval in `package.json`.
- The decision is reversible. Moving to independent packages or pnpm later changes the lockfiles, the Dockerfiles and the CI install steps, not the application code.
- Revisit this ADR before 2028-04-30, when Node 24 reaches end of life.
