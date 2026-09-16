# Infrastructure Plan

> Planning only. This document describes future infrastructure work. No installations, configuration changes, containers, workflows, deployments, or other implementation files were created by the infrastructure-planning process.

## 1. Project and User Experience

- **Application:** Public-facing, multi-user web application.
- **Primary users:** Members of the public with individual accounts.
- **Primary user task:** Not yet specified; users access shared application data through a browser.
- **Selected platform:** Browser-based web application.
- **User-experience rationale:** Immediate access from modern desktop and mobile browsers without installation.
- **Required operating systems, browsers, or devices:** Current evergreen desktop and mobile browsers.
- **Offline or native-device requirements:** No offline, mobile-native, or desktop-native requirement confirmed.

## 2. Connectivity and Application Shape

- **Connectivity model:** Multi-user web-enabled.
- **Accounts and authentication:** Required; implementation must select an account and secure session mechanism before development.
- **Backend required:** Yes; a TypeScript API owns authorization, data access, upload authorization, and business rules.
- **Cross-device persistence:** Hosted data is available after sign-in from any supported browser.
- **Interaction between accounts:** Confirmed shared or exchanged data; detailed permissions remain to be defined.
- **Primary application components:** React single-page frontend, Node.js API, PostgreSQL database, and S3-compatible object storage.

## 3. Selected Technology Stack

| Area | Selected technology | Purpose | Version policy |
|---|---|---|---|
| Primary language | TypeScript | Shared language for frontend and API | Supported stable releases |
| Frontend framework | React | Browser user interface | Current maintained major version |
| Frontend build tool | Vite | Local development and optimized static builds | Current maintained major version |
| API framework | Node.js TypeScript API; framework deferred | Authenticated API and business rules | Node.js active LTS; choose maintained framework before implementation |
| Runtime | Node.js | Runs build tooling and API | Active LTS |
| Package manager | pnpm | Deterministic JavaScript dependency management | Current maintained major version |
| Object-storage protocol | S3-compatible API | Store user-uploaded files outside PostgreSQL | Managed provider-compatible version |

## 4. Storage and Persistence

- **Storage model:** Hosted relational data plus hosted object storage.
- **Primary data store:** Managed PostgreSQL for accounts, relationships, metadata, and shared application data.
- **User files or object storage:** S3-compatible managed object storage; database stores file metadata and object keys only.
- **Local-development storage:** Containerized PostgreSQL and an S3-compatible service with persistent named volumes.
- **Production hosting model:** Managed PostgreSQL and managed object storage selected through the eventual hosting provider.
- **Schema and migration approach:** Select a TypeScript-compatible migration tool during implementation; version migrations in source control and run them once per release.
- **Backup, export, or recovery approach:** Enable provider backups; document database restore and object-storage recovery before production launch.
- **Secrets and connection-string approach:** Runtime environment variables or a provider secret manager; never commit credentials or bucket keys.
- **Reason this storage fits the access pattern:** PostgreSQL supports account and sharing relationships, while object storage handles uploads efficiently.

## 5. Testing Tools

| Test layer | Tool or library | Planned scope | Planned execution point |
|---|---|---|---|
| Unit | Vitest | Frontend utilities, API business rules, and validation | Local and pull requests |
| Component | React Testing Library | Important UI states and accessibility-oriented interactions | Local and pull requests |
| Integration | Vitest plus Testcontainers and PostgreSQL | API, authorization, persistence, and upload-metadata paths | Pull requests |
| End-to-end | Playwright | Sign-in and the highest-value public and shared-data workflows | Pull requests and release validation |

## 6. Test Analysis

| Capability | Tool | Planned policy |
|---|---|---|
| Coverage | Vitest V8 coverage | Publish frontend and API coverage artifacts from pull requests |
| Coverage threshold or regression rule | Vitest coverage thresholds | Set a modest initial project floor before branch protection; reject decreases below it |
| Mutation testing | None initially | Reconsider focused Stryker checks only for critical business-rule modules |
| Flaky-test or duration analysis | GitHub Actions test timing | Review slow or unstable tests from CI output |
| Reporting | GitHub Actions artifacts and check summaries | Retain coverage, Playwright traces, screenshots, and logs on failure |

## 7. Static Analysis and Security

| Check | Tool | Planned enforcement |
|---|---|---|
| Formatting | Prettier | Verify on every pull request |
| Linting | ESLint | Block pull requests on errors |
| Type checking or compiler warnings | TypeScript compiler | Block pull requests on errors |
| Anti-pattern or maintainability analysis | ESLint rules | Block established high-signal rules; avoid noisy rules initially |
| Dependency vulnerability scanning | Dependabot | Create update pull requests; review before merge |
| Secret scanning | Gitleaks | Block pull requests that contain detected secrets |
| Static security analysis | CodeQL | Run scheduled and before releases; triage findings before release |
| Container scanning | Trivy | Scan future API production image before publishing |

## 8. Development Technologies Requiring Manual Installation

These are developer-workstation prerequisites that will not be supplied by the planned Docker environment.

| Technology | Why it is needed | Required on which machines | Version policy | Planned installation or verification method | Why Docker does not provide it |
|---|---|---|---|---|---|
| Git | Source control and GitHub workflow | All developer machines | Supported stable release | Future installation or version check | Host source-control integration remains local |
| Docker Desktop or Docker Engine with Compose | Run reproducible development services and application containers | All developer machines | Current supported release | Future installation and Compose verification | Docker requires a host engine |
| Browser | Manual UI checks and Playwright browser support | All developer machines | Current evergreen version | Future browser verification | GUI browser access is host-provided |

### Host tools intentionally not required

- **Not required because Docker supplies them:** Node.js, pnpm, PostgreSQL, and local S3-compatible storage for the selected reproducible development environment.
- **Not required for this platform:** Xcode, Android Studio, mobile SDKs, desktop SDKs, and native code-signing tools.

## 9. Docker Plan

- **Planned Docker role:** Reproducible development environment; production container for the API is recommended.
- **Future files that would be created during implementation:** `Dockerfile` files, `compose.yml`, `.dockerignore`, and example environment documentation.
- **Planned images and services:** Frontend development container, Node.js API container, PostgreSQL, and an S3-compatible local object-storage service.
- **Development container behavior:** Bind-mount source code for live reload; install dependencies in container-managed volumes to avoid host-platform conflicts.
- **Ports:** Define only documented development ports during implementation; do not expose databases publicly.
- **Bind mounts and named volumes:** Bind mounts for source; named volumes for dependency caches, PostgreSQL data, and local object-storage data.
- **Environment-variable and secret handling:** Use uncommitted local environment values; production injects secrets through the host or secret manager.
- **Local database or service containers:** PostgreSQL and object storage are available to integration tests and local development.
- **Production image or non-container release path:** Build static frontend assets for managed web hosting; use a multi-stage, non-root, minimal API image for a managed container host.
- **Build stages and hardening:** Use `.dockerignore`, lockfile-only installs, minimal runtime image, non-root user, health checks, no embedded secrets, and Trivy scanning.
- **Planned future development command:** `docker compose up --build` (do not run until implementation).
- **Planned future production command:** `docker build` and provider-specific deployment command (do not run until provider selection).

## 10. GitHub Actions Plan

### A. Automated pull-request checks

- **Future workflow file:** `.github/workflows/pr-checks.yml`
- **Trigger:** `pull_request`.
- **Runner or matrix:** Ubuntu latest; use the selected Node.js active LTS release.
- **Permissions:** Read-only `contents`; grant only the minimum write permission needed to publish check summaries or artifacts.
- **Planned jobs in order:**
  1. Checkout, set up Node.js, and restore pnpm dependency cache.
  2. Install dependencies with the lockfile enforced; verify Prettier, ESLint, and TypeScript.
  3. Run unit and component tests with coverage.
  4. Run API integration tests against PostgreSQL and S3-compatible service containers or Testcontainers.
  5. Build frontend and API; run Playwright workflows after required services are ready.
  6. Run Gitleaks; upload coverage and failed Playwright traces, screenshots, and logs.
- **Service containers:** PostgreSQL and S3-compatible object storage when Testcontainers is not used by the test suite.
- **Caching:** Cache pnpm store using the lockfile hash; do not cache credentials or generated production artifacts.
- **Coverage and analysis reporting:** Upload coverage summary; Dependabot supplies dependency-update alerts; CodeQL runs on a scheduled workflow and pre-release validation.
- **Failure artifacts:** Coverage output, Playwright trace ZIPs, screenshots, browser logs, and relevant test logs.
- **Checks that should block merging:** Lockfile install, formatting, linting, type checking, unit/component/integration tests, coverage threshold, build, Playwright, and Gitleaks.
- **Proposed branch-protection settings:** Require the listed checks, at least one approving review, resolved conversations, and an up-to-date branch before merge.

### B. New-release deployment

- **Future workflow file:** `.github/workflows/release.yml`
- **Release trigger:** Protected `v*` tag or `workflow_dispatch` with an explicit version.
- **Release destination:** Managed static web host for Vite assets plus a managed API container host; managed PostgreSQL and S3-compatible object storage.
- **Runner or matrix:** Ubuntu latest with the selected Node.js active LTS release.
- **Planned jobs in order:**
  1. Verify tag/version, install locked dependencies, and repeat required checks.
  2. Run production build, integration tests, and selected Playwright smoke flows.
  3. Build and Trivy-scan the API image; publish it to the selected registry and deploy it through a protected environment.
  4. Deploy versioned frontend assets to the managed web host and invalidate or update its deployment as required.
  5. Run approved database migrations once, then run authenticated and public smoke checks.
- **Build artifacts:** Versioned static frontend assets, API image digest, coverage/test reports, and release notes.
- **Signing, notarization, or store requirements:** No native signing or store submission for this browser platform; provider deployment credentials are required.
- **Database migration step:** Required only after a reviewed, backward-compatible migration is bundled with the release.
- **Environment approval:** Use protected `staging` and `production` GitHub environments; production requires manual approval.
- **Post-deployment verification:** Check frontend availability, API health endpoint, database connectivity, and one key end-to-end workflow.
- **Failed-release or rollback approach:** Re-deploy the previous static asset version and API image digest; restore database only through the managed-provider recovery process when necessary.

### GitHub configuration required later

| Name | Type | Purpose |
|---|---|---|
| `API_CONTAINER_REGISTRY_TOKEN` | Secret | Authenticate CI to the chosen API container registry |
| `API_DEPLOY_TOKEN` | Secret | Authorize deployment to the managed API container host |
| `FRONTEND_DEPLOY_TOKEN` | Secret | Authorize deployment to the managed static web host |
| `DATABASE_URL` | Production environment secret | API database connection string |
| `OBJECT_STORAGE_ENDPOINT` | Production environment variable | Object-storage service endpoint |
| `OBJECT_STORAGE_BUCKET` | Production environment variable | Upload bucket name |
| `OBJECT_STORAGE_ACCESS_KEY` | Production environment secret | Object-storage access credential |
| `OBJECT_STORAGE_SECRET_KEY` | Production environment secret | Object-storage secret credential |
| `AUTH_SECRET` | Production environment secret | Sign or encrypt application session data |
| Managed hosting accounts | Provider accounts | Supply database, object storage, static hosting, and API container hosting |

## 11. Planned Repository Artifacts - Not Created by This Skill

- [ ] Application manifests and pnpm lockfile.
- [ ] React/Vite frontend and Node.js API source directories.
- [ ] Test and coverage configuration.
- [ ] Prettier, ESLint, TypeScript, Gitleaks, and CodeQL configuration where needed.
- [ ] `Dockerfile` files, `compose.yml`, and `.dockerignore`.
- [ ] `.github/workflows/pr-checks.yml`.
- [ ] `.github/workflows/release.yml`.
- [ ] Provider deployment and environment configuration.

## 12. Assumptions and Open Items

- **Assumptions:** Modern-browser support is sufficient; users need accounts and may upload files; one frontend and one API are preferable to microservices.
- **Decisions still requiring an external account, credential, certificate, or organizational approval:** Static-host, container-host, PostgreSQL, object-storage providers; DNS domain; deployment tokens; storage credentials; and production environment approvers.
- **Items to confirm before implementation begins:** Primary user task, authorization model, authentication/session design, API framework, exact providers, retention/backups, file limits and allowed types, accessibility requirements, coverage floor, and release ownership.
