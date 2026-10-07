# BetterTicket

BetterTicket is a public ticketing web application. The first product slices support anonymous ticket creation and viewing through a React frontend and Fastify API, with tickets stored in PostgreSQL. Authentication and technician workflows are not implemented yet.

## Repository map

| Location                    | Purpose                                                              |
| --------------------------- | -------------------------------------------------------------------- |
| `apps/web`                  | React/Vite ticket list and creation frontend with component tests.   |
| `apps/api`                  | Fastify API, Drizzle schema/migrations, and API/database tests.      |
| `docker/` and `compose.yml` | Pinned Docker toolchain and local PostgreSQL/S3-compatible services. |
| `scripts/smoke.sh`          | Disposable infrastructure smoke test.                                |
| `.github/workflows/`        | Pull-request checks and scheduled CodeQL analysis.                   |
| `.agents/skills/`           | Repository-specific Codex skills.                                    |
| `docs/`                     | Product specs, implementation plans, and architecture decisions.     |
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

5. Apply the versioned PostgreSQL migrations, then start the frontend and API in the pinned toolchain. Vite serves the application at `http://localhost:5173` and proxies `/api` to Fastify on port 3000:

   ```sh
   docker compose --profile tools run --rm toolchain pnpm db:migrate
   docker compose --profile tools run --rm --service-ports toolchain pnpm dev
   ```

6. Run the quality checks in the toolchain container, then the host Docker smoke test. PostgreSQL must be running because the API suite includes a real persistence test:

   ```sh
   docker compose --profile tools run --rm toolchain pnpm format:check
   docker compose --profile tools run --rm toolchain pnpm lint
   docker compose --profile tools run --rm toolchain pnpm typecheck
   docker compose --profile tools run --rm toolchain pnpm test
   docker compose --profile tools run --rm toolchain pnpm coverage
   docker compose --profile tools run --rm toolchain pnpm build
   bash scripts/smoke.sh
   ```

7. Stop the long-lived local services when finished:

   ```sh
   docker compose down
   ```

   To discard their local data as well, use `docker compose down --volumes`.

## Ticket creation baseline

Anonymous visitors can submit a title, issue description, setup details, and optional additional information. `POST /api/tickets` validates the request, rejects unknown fields, and stores the ticket with a generated UUID, `OPEN` status, and timestamps. See [the feature spec](docs/specs/ticket-creation.md) and [ADR-001](docs/decisions/001-anonymous-ticket-creation.md) for scope and rationale.

## Ticket viewer baseline

The homepage (`/`) lists submitted tickets, newest first, without signing in; each ticket opens on its own page at `/tickets/:id`, and the ticket form lives at `/new`. `GET /api/tickets` returns the 100 most recently created tickets as `{ "tickets": [...] }`, and `GET /api/tickets/:id` returns one ticket or a `404`. Everything a visitor submits is publicly visible. See [the feature spec](docs/specs/ticket-viewer.md) and [ADR-002](docs/decisions/002-anonymous-ticket-viewing.md) for scope and rationale.

## Tooling and CI

The pnpm workspace contains React/Vite and Fastify packages. Drizzle schema files are the database source of truth, and generated SQL migrations are committed under `apps/api/drizzle`.

Pull requests run locked installation, formatting, linting, type checking, migrations against PostgreSQL, unit/component/integration tests, coverage, application builds, Compose validation, the infrastructure smoke test, and Gitleaks. CodeQL runs weekly and on manual dispatch. Dependabot tracks npm, Docker, and GitHub Actions updates. Playwright, Trivy scanning, deployment, and release workflows remain deferred.

Docker image tags are deliberately pinned. Dependabot proposes updates; review and test them before merging.

## GitHub setup still required

Before enabling a release workflow, select the static host, API container host, registry, PostgreSQL provider, object-storage provider, and release owner. Then configure protected `staging` and `production` environments and the named secrets/variables listed in `infrastructure_plan.md`—including `API_CONTAINER_REGISTRY_TOKEN`, `API_DEPLOY_TOKEN`, `FRONTEND_DEPLOY_TOKEN`, `DATABASE_URL`, object-storage settings, and `AUTH_SECRET`. No release workflow is present yet because these providers have not been selected.

## Troubleshooting

- If Docker cannot connect, start Docker Desktop and rerun `docker compose config --quiet`.
- If ports 5432 or 8333 are occupied, stop the conflicting local service or change the loopback mapping in `compose.yml`.
- If Docker reports a bind-mount permission issue, grant Docker Desktop access to this repository and rerun the command.
- If tests report that the `tickets` relation does not exist, run `docker compose --profile tools run --rm toolchain pnpm db:migrate`.
- If ports 3000 or 5173 are occupied, stop the conflicting application before running the development command.
- If a locked install fails after changing dependencies, regenerate `pnpm-lock.yaml` from the toolchain with `docker compose --profile tools run --rm toolchain pnpm install`, review the diff, then rerun with `--frozen-lockfile`.
