---
name: infra-builder
description: Implements the infrastructure described in infrastructure_plan.md: project tooling, Docker, GitHub Actions, smoke tests, README.md, and AGENTS.md. It never implements product behavior or production application code.
---

# Infrastructure Builder

## Purpose

Turn a completed `infrastructure_plan.md` at the repository root into a usable, verified development foundation. Create only the infrastructure and documentation that the plan specifies:

- language/runtime and package-tool configuration, manifests, lockfiles, and ignore files;
- testing, formatting, linting, type-checking, security, coverage, and analysis configuration;
- database/service configuration, schema or migration tooling where the plan calls for it, and development fixtures needed solely for infrastructure smoke tests;
- Dockerfiles, Compose files, dev-container files, and container hardening;
- GitHub Actions pull-request and release workflows;
- non-production smoke-test scripts and their supporting configuration;
- `README.md`; and
- `AGENTS.md`.

Do not implement product behavior, screens, API endpoints, domain models, authentication flows, business logic, or production application source code. The infrastructure must be ready for application development, not pretend that the application is complete.

## Source of Truth and Preconditions

1. Locate the repository root with `git rev-parse --show-toplevel`. Read `infrastructure_plan.md` there in full before changing anything.
2. Treat confirmed selections in the plan as authoritative. Do not substitute a preferred framework, database, test runner, package manager, hosting provider, runner, or release target.
3. Inspect existing manifests, lockfiles, Docker and Compose files, workflow files, `.gitignore`, `README.md`, `AGENTS.md`, version files, and relevant directory names before changing them. Preserve working user-authored configuration unless it conflicts with the plan.
4. Stop and ask one concise question before changing files if the plan is missing, internally inconsistent, leaves a required implementation choice open, requires unavailable credentials/accounts, or conflicts with established repository configuration. Explain the exact conflict and safe options. Do not guess.
5. If the plan says a component is not required, do not create a placeholder for it. For example, do not add a database, backend, Dockerfile, release deployment, browser tests, or mutation testing merely because such tooling is common.

If `infrastructure_plan.md` does not exist, direct the developer to run `infra-planner` first. Do not scaffold from an inferred stack.

## Non-Negotiable Boundary

This skill may install, configure, build, run, and test infrastructure. It may create project configuration and small test-only probes. It must not create production application code.

Allowed examples:

- `package.json`, a lockfile, runtime version file, and tool configurations;
- a framework's minimal configuration only when it is necessary to make the planned toolchain or container start;
- Docker and Compose files, `.dockerignore`, `.gitignore`, and `.env.example` containing names and safe non-secret examples only;
- database initialization/migration configuration where required by the selected persistence tooling, but no product schema beyond an infrastructure-owned migration-history mechanism;
- smoke-test shell scripts that check a container/service health endpoint, port, command exit status, or database readiness;
- empty test directories with an explanatory `.gitkeep` or equivalent only when a configured tool requires them;
- GitHub workflows and local scripts that invoke selected quality gates; and
- developer documentation and agent instructions.

Forbidden examples:

- pages, components, routes, controllers, handlers, API contracts, user flows, domain entities, or application services;
- authentication implementation, authorization rules, seed users, or production secrets;
- business tables, business migrations, fixtures, or sample customer data;
- product tests disguised as smoke tests;
- deployment, publishing, releases, cloud provisioning, database migration against a remote environment, store upload, registry push, or any use of a real credential;
- secret values in tracked files, workflow logs, build arguments, Docker layers, or test output; and
- unrelated cleanup or refactoring.

When a selected application framework cannot start without an application-owned entrypoint, configure its tooling but leave the framework bootstrapping to the application implementation phase. Explain this constraint in the README rather than adding a fake application.

## Safety and Installation Rules

1. Prioritize installation and configuration steps that can run in a controlled, consistent environment, such as Docker containers, before making changes to the host system.
2. Before an install or generator command, show the developer the selected package manager, exact intended command, and packages or images to be added. Use the plan's version policy; otherwise use the current supported stable/LTS line and record the choice in the README.
3. Do not use unpinned `latest` image tags. Pin Docker images to a major/minor or digest consistent with the plan, and document the update policy.
4. Use the plan's package manager exclusively. Create and retain its lockfile. Do not mix package managers.
5. Prefer official registries and first-party images. Inspect generated manifests and lockfiles for unexpected scripts, dependencies, or credentials before proceeding.
6. Never run a command that could publish, deploy, provision, authenticate, mutate a remote environment, push an image, or upload a release. Create workflow definitions for these operations only when the plan requests them; guard them with explicit release triggers, protected environments, least privileges, and named secret references.
7. Never request or print secret values. Create `.env.example` only when it lists variable names, purpose, and safe placeholders. Ensure real `.env` files are ignored.
8. Do not overwrite an existing README or AGENTS file wholesale. Merge or revise the sections controlled by this skill, preserving useful project-specific material and clearly reconciling contradictions.

## Implementation Workflow

### 1. Reconcile the Plan

Create a compact internal checklist from these plan sections:

- configure docker container(s)
- selected stack and version policy;
- storage and migration approach;
- test, test-analysis, static-analysis, and security tools;
- host prerequisites and Docker role;
- pull-request and release workflow requirements;
- manually supplied accounts, tokens, certificates, environments, and variables; and
- planned repository artifacts.

State the implementation boundary and any material assumptions before modifying files. A plan should normally be fully decided; do not silently convert assumptions or open items into implementation choices.

### 2. Configure Docker

Create Docker container(s) first so that installation and configuration steps can run in a controlled, consistent environment.

- For local services, use Compose with declared networks, named volumes, health checks, and dependency conditions where supported.
- For a development container, make source mounting, dependency caching, UID/GID behavior, ports, and manual host prerequisites explicit.
- For a production image, use a multi-stage build, minimal runtime image, non-root user, `.dockerignore`, explicit port/healthcheck only if an application entrypoint exists, and environment-provided configuration. Never embed a secret.
- For native desktop/mobile release plans, do not claim Docker replaces native SDKs, signing, or notarization; document those host-only requirements.

Validate Compose syntax and build images where practical. Start only local services and containers, then stop them after smoke tests unless the developer asks to keep them running.

### 3. Establish the Local Toolchain

Create or update only configurations required by the plan:

- runtime/version manager metadata and project manifest;
- lockfile and reproducible installation command;
- formatter, linter, compiler/type checker, test runner, coverage, mutation, and scan configurations;
- ignore files for dependencies, build artifacts, reports, local volumes, environment files, logs, and generated secrets;
- minimal task scripts with stable, descriptive names such as `format:check`, `lint`, `typecheck`, `test`, `test:integration`, `test:smoke`, `coverage`, `build`, `docker:up`, `docker:down`, and `verify`, but only where selected by the plan; and
- test-only configuration needed to execute those scripts.

Keep scripts composable: formatting and static checks should not require Docker; integration and smoke tests should wait for only the services they need. Do not fabricate tests just to make a test command appear green. If no application test exists yet, document that the configured test command currently validates the harness only, and make CI run the meaningful infrastructure checks available now.

### 4. Configure Storage and Local Services

Implement only the selected local development services. Use named volumes for persistent local data, health checks that represent genuine readiness, minimal exposed ports, non-secret development credentials or environment-provided values, and a documented reset procedure.

For database tooling, configure connection handling and a migration command without inventing business schema. If the plan requires a service container in CI, ensure its environment and readiness behavior match local Compose closely. Do not run migrations against any remote database.

### 5. Configure GitHub Actions

Create the plan's workflow files, normally `.github/workflows/pr-checks.yml` and `.github/workflows/release.yml`.

For pull requests:

- use `pull_request` as the primary trigger and the runners/matrix named in the plan;
- give each job the minimum permissions, normally `contents: read`;
- use lockfile-enforced installs and supported dependency caching;
- run only configured quality gates in dependency order;
- use service containers or Compose only when required;
- upload diagnostic artifacts on failure without exposing secrets; and
- make required checks clear enough for the planned branch protection.

For releases:

- use the deliberate trigger selected in the plan (`v*` tag, published release, or manual dispatch);
- validate before any publish/deploy step;
- use protected environments and least-privilege scoped tokens;
- reference named secrets and variables only; never values;
- produce artifacts, checksums, and release notes when planned;
- include smoke/health verification and a documented rollback signal where the destination supports it; and
- when external deployment credentials or provider configuration are not yet available, make the workflow fail early with a clear prerequisites check rather than silently succeeding or attempting an unsafe deployment.

Use maintained, pinned major versions of Actions. Validate workflow YAML locally when a suitable validator is available; otherwise perform a structural review and say that GitHub-hosted execution remains to be confirmed after push.

### 6. Add Infrastructure Smoke Tests

Smoke tests prove the foundation, not product features. Design them from the selected components, for example:

- toolchain versions and lockfile installation succeed;
- formatter/linter/type-checker configurations load;
- Compose configuration parses;
- a service container becomes healthy and accepts a readiness query;
- a database accepts a disposable connection and simple `SELECT 1` only;
- an image builds and, where a real infrastructure-owned service exists, starts and passes its health check;
- CI workflow files parse and reference existing scripts/files; and
- required environment variable names are documented without values.

Use disposable names, isolated volumes, and cleanup traps. Do not call external services, rely on a developer's production credentials, or leave containers/volumes running unintentionally. Place tests in a discoverable infrastructure-owned location such as `scripts/`, `tests/infrastructure/`, or the ecosystem-standard test directory, and explain their scope in the README.

Run the selected local quality checks plus the smoke tests. If Docker is unavailable, report the exact unavailable prerequisite, run all non-Docker checks, and provide the single command the developer should run after installing it. Do not mark the Docker verification as passed.

### 7. Write Developer Documentation

Create or update `README.md` at the repository root. It must be concise, accurate, and executable for a new developer, including:

1. project purpose/status and the explicit note that infrastructure is present but production application code may not yet exist;
2. a repository map covering source/front end, API/backend, scripts, infrastructure/Docker, tests, docs, agents/skills, and CI—mark planned or absent areas accurately rather than inventing paths;
3. `## Getting Started` section with step-by-step instructions for a new developer to set up the project locally, including the following:
  - exact manual step-by-step directions (with links and/or verbatim commands) for all prerequisites with version policy and links/names of official installers where helpful;
  - configuration steps, including copying `.env.example` if applicable and how secrets are supplied outside version control;
  - dependency installation, local service/container startup, checks, smoke tests, and cleanup commands;
  - any required GitHub configuration
4. a troubleshooting section for the most likely setup failures (runtime, Docker, port, permission, or missing environment variable) only when relevant.

Do not describe unimplemented commands as working. Label planned application commands and explain their dependency on future application code.

### 8. Write Agent Guidance

Create or update root `AGENTS.md` so both humans and agents can navigate and safely extend the repository. It must include:

- project status and the relationship between `infrastructure_plan.md` and the implemented configuration;
- a current repository map with accurate locations for application source, front end, API, scripts, Docker/infrastructure, GitHub workflows, tests, documentation, and `.agents/skills`; state `not created yet` where appropriate;
- which skills to use for planning, infrastructure changes, application implementation, tests, browser verification, security, documentation, review, CI/CD, and git workflow;
- required pre-change reading, including the plan and applicable local instructions;
- boundaries: do not implement product code while performing infrastructure-only work; do not alter plan decisions without revising the plan with the planning skill; do not commit secrets or generated artifacts;
- the standard local verification commands and CI equivalence;
- Docker/service lifecycle and cleanup expectations; and
- a short change/verification checklist and documentation-update rule.

Keep it project-specific. Do not paste every global skill instruction or claim a nonexistent directory/tool exists.

## Verification and Completion Gate

Before finishing, inspect `git diff --check`, the final changed-file list, and all newly created configuration. Then verify, in this order where applicable:

1. manifest and lockfile install reproducibly using the selected package manager;
2. format check, lint, type check, test harness, coverage/security checks selected by the plan;
3. generated configuration parses or loads;
4. Compose configuration validates; required images build; local services reach health/readiness; and cleanup completes;
5. infrastructure smoke tests pass;
6. workflow YAML is structurally valid, uses existing scripts, has least permissions, no literal secrets, and matches the plan;
7. `.gitignore` protects environment files, dependencies, build artifacts, reports, and volumes as applicable;
8. README instructions match the commands actually executed; and
9. AGENTS.md paths, workflow names, and verification instructions match the repository.

If a verification step cannot run due to a missing manual prerequisite, unavailable Docker daemon, blocked network, or intentionally unavailable external credential, do not hide it. Record the command, the reason, what was verified instead, and the exact manual action required. Treat all other failed local checks as failures to fix before completion.

## Completion Response

Respond with:

- the infrastructure created or updated, grouped by toolchain, Docker/services, CI, smoke tests, README, and AGENTS guidance;
- tests/checks that passed and any intentionally unverified external release step;
- every manual prerequisite or GitHub secret/environment/account still required; and
- an explicit confirmation that no production application code, production data, remote deployment, publishing, or real secret was created or used.
