# ADR-012: Store Ticket Attachments Privately and Authorize Reads Through the API

## Status

Accepted

## Date

2026-11-11

## Context

Signed-in users need to attach screenshots and common files while creating tickets. File bytes are
not suitable for PostgreSQL, public object URLs would bypass ticket visibility, and creation spans
two persistence systems that cannot share one transaction.

## Decision

- Store attachment metadata in PostgreSQL and bytes in the approved private S3-compatible object
  storage service.
- Accept attachments only during authenticated ticket creation. Existing JSON creation remains
  available to anonymous visitors.
- Use opaque random object keys and never expose those keys to clients.
- Return metadata and bytes only through API routes that apply the ticket's stored visibility policy.
- Allow inline responses only for validated PNG, JPEG, WebP, and GIF images; force every other
  allowed type to download.
- Validate all fields and bounded file buffers first, upload objects second, and commit the ticket
  and metadata together last. Clean up uploaded objects best-effort when later work fails.

## Alternatives Considered

### Public or presigned object URLs

Rejected because URL possession could outlive or bypass later authorization decisions and would add
browser/object-storage CORS configuration.

### Store bytes in PostgreSQL

Rejected because it would inflate backups and database I/O despite approved object storage already
being present.

### Upload after creating the ticket

Rejected because the requested failure behavior is an all-or-nothing submission from the user's
perspective.

## Consequences

The API carries attachment bandwidth and must have object-storage access. Cross-store rollback is
compensating rather than perfectly transactional, so a cleanup outage can leave an inaccessible
orphan object that operators may remove later. Future ticket deletion must remove associated objects
as well as cascading metadata.
