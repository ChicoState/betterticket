# Implementation Plan: Ticket Creation Attachments

## Architecture Decisions

- Preserve the JSON ticket-creation contract and add authenticated multipart handling on the same
  resource only when files are selected.
- Store metadata in PostgreSQL and bytes in the existing private S3-compatible object store.
- Put object storage behind an injected interface so routes use fakes in focused tests and the S3
  adapter is covered separately against SeaweedFS.
- Proxy attachment reads through the API so the existing ticket visibility policy is always applied.

## Task List

### Phase 1: Contract and persistence

- [x] Add attachment types, validation helpers, metadata schema, and migration.
- [x] Extend ticket persistence with transactional attachment metadata and add the S3 adapter.
- [x] Verify content validation, database round trips, object lifecycle, and cleanup failures.

### Phase 2: API

- [x] Accept authenticated multipart creation while preserving anonymous JSON creation.
- [x] Add authorized attachment-list and content routes with safe response headers.
- [x] Verify validation, stable errors, visibility behavior, and failure atomicity.

### Phase 3: UI and delivery

- [x] Add the accessible picker/drop zone and multipart client request.
- [x] Add ticket-detail previews, downloads, and independent loading/error states.
- [x] Wire local/CI object-storage configuration and update project documentation.

### Checkpoint: Complete

- [ ] Run migration, format, lint, typecheck, tests, coverage, build, browser verification,
      infrastructure smoke, dependency audit, and `git diff --check`.

## Risks and Mitigations

| Risk                           | Impact | Mitigation                                                                                      |
| ------------------------------ | ------ | ----------------------------------------------------------------------------------------------- |
| Malicious or disguised content | High   | Detect content, require matching extension, block active formats, and force document downloads. |
| Partial cross-store writes     | High   | Validate first, transact metadata, and delete uploaded objects on failure.                      |
| Visibility bypass              | High   | Resolve the ticket and apply its canonical access policy before metadata or bytes are returned. |
| Resource exhaustion            | High   | Enforce file, count, combined-size, part, and filename limits while parsing.                    |
| Storage outage hiding tickets  | Medium | Load attachments separately and keep ticket text usable.                                        |

## Open Questions

None for this slice.
