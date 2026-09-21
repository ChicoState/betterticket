# BetterTicket

BetterTicket is a future public, multi-user web application. This repository currently provides its development infrastructure only; no production frontend, API, authentication, database schema, or product workflows have been implemented.

## Repository map

| Location                    | Purpose                                                              |
| --------------------------- | -------------------------------------------------------------------- |
| `apps/web`                  | Planned React/Vite frontend; not created yet.                        |
| `apps/api`                  | Planned Fastify API; not created yet.                                |
| `docker/` and `compose.yml` | Pinned Docker toolchain and local PostgreSQL/S3-compatible services. |
| `scripts/smoke.sh`          | Disposable infrastructure smoke test.                                |
| `.github/workflows/`        | Pull-request checks and scheduled CodeQL analysis.                   |
| `.agents/skills/`           | Repository-specific Codex skills.                                    |
| `infrastructure_plan.md`    | Approved infrastructure decisions and deferred product decisions.    |

## Getting started

1. Install [Git](https://git-scm.com/downloads), [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine with Compose), and a current evergreen browser. Node.js and pnpm run inside Docker; they are not host prerequisites.
2. Clone the repository and create local-only service settings:

   ```sh
   cp .env.example .env
   ```

   The example values are safe local development credentials. Keep real service credentials in the untracked `.env` file or a provider secret manager.

3. Build the pinned Node 24.21.0/pnpm 10.34.5 toolchain and install the lockfile:

   ```sh
   docker compose --profile tools build toolchain
   docker compose --profile tools run --rm toolchain pnpm install --frozen-lockfile
   ```

4. Run local PostgreSQL and S3-compatible object storage. Ports bind only to `localhost`:

   ```sh
   docker compose up --detach postgres object-storage
   ```

5. Run the available quality checks in the toolchain container, then the host Docker smoke test:

   ```sh
   docker compose --profile tools run --rm toolchain pnpm format:check
   docker compose --profile tools run --rm toolchain pnpm lint
   docker compose --profile tools run --rm toolchain pnpm typecheck
   docker compose --profile tools run --rm toolchain pnpm test
   docker compose --profile tools run --rm toolchain pnpm coverage
   bash scripts/smoke.sh
   ```

   With no application tests yet, Vitest validates the configured harness and exits successfully with no test files. Coverage thresholds take effect once application source is added.

6. Stop the long-lived local services when finished:

   ```sh
   docker compose down
   ```

   To discard their local data as well, use `docker compose down --volumes`.

## Tooling and CI

The root package is a pnpm workspace reserved for future `apps/web` and `apps/api` packages. React/Vite and Fastify are recorded in the workspace catalog but no application packages or entrypoints exist yet. Drizzle ORM/Kit is available for the future PostgreSQL migration workflow; no business schema or migrations exist.

Pull requests run locked installation, formatting, linting, type checking, the empty test harness, coverage, Compose validation, the infrastructure smoke test, and Gitleaks. CodeQL runs weekly and on manual dispatch. Dependabot tracks npm, Docker, and GitHub Actions updates. Playwright, API integration, application builds, Trivy scanning, deployment, and release workflows begin only after application code and provider choices exist.

Docker image tags are deliberately pinned. Dependabot proposes updates; review and test them before merging.

## GitHub setup still required

Before enabling a release workflow, select the static host, API container host, registry, PostgreSQL provider, object-storage provider, and release owner. Then configure protected `staging` and `production` environments and the named secrets/variables listed in `infrastructure_plan.md`—including `API_CONTAINER_REGISTRY_TOKEN`, `API_DEPLOY_TOKEN`, `FRONTEND_DEPLOY_TOKEN`, `DATABASE_URL`, object-storage settings, and `AUTH_SECRET`. No release workflow is present yet because these providers have not been selected.

## Troubleshooting

- If Docker cannot connect, start Docker Desktop and rerun `docker compose config --quiet`.
- If ports 5432 or 8333 are occupied, stop the conflicting local service or change the loopback mapping in `compose.yml`.
- If Docker reports a bind-mount permission issue, grant Docker Desktop access to this repository and rerun the command.
- If a locked install fails after changing dependencies, regenerate `pnpm-lock.yaml` from the toolchain with `docker compose --profile tools run --rm toolchain pnpm install`, review the diff, then rerun with `--frozen-lockfile`.
