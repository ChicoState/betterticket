# AGENTS.md

## Status and source of truth

BetterTicket currently has infrastructure only. `infrastructure_plan.md` is the approved source of truth; it records Fastify, a pnpm workspace, Drizzle migrations, a 50% future coverage floor, and deferred provider/release choices. Do not change those decisions without revising the plan through `planning-and-task-breakdown` or `spec-driven-development` first.

## Repository map

| Area           | Location                                                          | Status                               |
| -------------- | ----------------------------------------------------------------- | ------------------------------------ |
| Frontend       | `apps/web`                                                        | Not created yet; planned React/Vite. |
| API            | `apps/api`                                                        | Not created yet; planned Fastify.    |
| Infrastructure | `compose.yml`, `docker/`, `.env.example`                          | Present.                             |
| Scripts        | `scripts/smoke.sh`                                                | Present; infrastructure-only.        |
| Tests          | Application test directories                                      | Not created yet.                     |
| CI             | `.github/workflows/pr-checks.yml`, `.github/workflows/codeql.yml` | Present.                             |
| Docs           | `README.md`, `infrastructure_plan.md`                             | Present.                             |
| Agent skills   | `.agents/skills/`                                                 | Present.                             |

## Required reading and boundaries

Read `infrastructure_plan.md`, this file, and the relevant skill instructions before changing the repository. Infrastructure work may create tooling, services, workflows, and smoke probes only—never product pages, API handlers, database business schema, authentication, fixtures, or production secrets. Do not commit generated artifacts, local `.env` files, credentials, or data volumes.

## Skills to use

- Plan or change an architecture decision: `planning-and-task-breakdown`, `spec-driven-development`, and `documentation-and-adrs`.
- Modify Docker, local services, toolchain, or workflows: `infra-builder`, `ci-cd-and-automation`, and `git-workflow-and-versioning`.
- Implement product UI/API: `frontend-ui-engineering`, `api-and-interface-design`, `test-driven-development`, and `security-and-hardening`.
- Verify browser behavior: `browser-testing-with-devtools` or `test-in-browser` after a runnable application exists.
- Review, harden, document, or simplify a change: `code-review-and-quality`, `security-and-hardening`, `documentation-and-adrs`, or `code-simplification` as applicable.

## Local verification

Run JavaScript quality gates in the pinned toolchain:

```sh
docker compose --profile tools run --rm toolchain pnpm install --frozen-lockfile
docker compose --profile tools run --rm toolchain pnpm format:check
docker compose --profile tools run --rm toolchain pnpm lint
docker compose --profile tools run --rm toolchain pnpm typecheck
docker compose --profile tools run --rm toolchain pnpm test
docker compose --profile tools run --rm toolchain pnpm coverage
bash scripts/smoke.sh
```

These correspond to the current pull-request workflow. The smoke test uses an isolated Compose project and removes its own containers and volumes. `docker compose up --detach postgres object-storage` starts persistent local services; use `docker compose down` to stop them and add `--volumes` only when intentionally resetting local data.

## Change checklist

1. Keep the change scoped and update the plan before changing a plan decision.
2. Run the relevant verification commands and `git diff --check`.
3. Confirm `.env`, generated output, and local volumes are ignored.
4. Update README and this file whenever commands, repository paths, CI, service lifecycle, or prerequisites change.
