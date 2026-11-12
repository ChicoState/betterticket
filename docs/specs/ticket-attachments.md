# Spec: Ticket Creation Attachments

## Objective

Let a signed-in ticket creator attach screenshots and common support files while creating a ticket.
Attachments appear on the ticket detail page and inherit the ticket's visibility. Anonymous visitors
may still create tickets, but cannot upload files.

## Contract

`POST /api/tickets` continues to accept the existing JSON body when no files are selected. An
authenticated client may instead send `multipart/form-data` with the existing ticket fields and one
to five repeated `attachments` file parts.

- Maximum file size: 10 MiB.
- Maximum combined attachment size: 25 MiB.
- Allowed images: PNG, JPEG, WebP, and GIF.
- Allowed documents: PDF, UTF-8 `.txt`/`.log`, DOCX, XLSX, and PPTX.
- SVG, HTML, archives, executables, legacy or macro-enabled Office files, unknown types, and files
  whose detected content conflicts with their extension are rejected.
- Display filenames are normalized, stripped of path/control characters, and limited to 255
  characters. Storage keys are opaque and never derived from filenames.

The server validates every ticket field and file before storing anything. It uploads validated files
to private S3-compatible object storage, then creates the ticket and attachment metadata in one
PostgreSQL transaction. If an upload or database write fails, the request fails, no ticket metadata
is committed, and already-uploaded objects are removed best-effort. The completed browser form and
selected files remain available for another attempt.

`GET /api/tickets/:ticketId/attachments` returns:

```json
{
  "attachments": [
    {
      "id": "uuid",
      "fileName": "screenshot.png",
      "contentType": "image/png",
      "sizeBytes": 1234,
      "createdAt": "2026-11-11T18:00:00.000Z"
    }
  ]
}
```

`GET /api/tickets/:ticketId/attachments/:attachmentId` streams the file as a download. The optional
`?preview=true` query is accepted only for approved image types. Unauthorized or mismatched ticket
and attachment IDs return the generic attachment-not-found response.

## Security and Access

- Creating a multipart ticket requires a valid server-side session; a client-provided identity is
  never accepted.
- Attachment reads use the ticket's existing visibility policy: public attachments are public,
  authenticated attachments require a session, and private attachments are limited to their creator
  and technicians.
- The bucket remains private. File responses use the server-detected content type, safe
  `Content-Disposition`, `X-Content-Type-Options: nosniff`, restrictive content-security headers,
  and private/no-store caching.
- Only approved images render inline. Documents are downloads and are not interpreted by the app.
- The limits are enforced while parsing, not only by browser validation.

## User Experience

The attachment control appears immediately after ticket visibility and before the submit button. It
supports a native file picker and drag-and-drop, shows selected filenames and sizes, allows removal,
and reports validation failures accessibly. Anonymous visitors see a sign-in notice instead.

Ticket detail pages load attachments independently so a storage failure cannot hide ticket text.
Approved images have lazy thumbnail previews and every attachment has a download link.

## Testing Strategy

- Unit tests cover content detection, filename normalization, and every size/count/type boundary.
- API tests cover JSON compatibility, multipart authentication, stable validation errors, cleanup,
  visibility, not-found behavior, and response headers.
- PostgreSQL and S3-compatible integration tests cover metadata transactions and object lifecycle.
- React tests cover selection, drop, removal, error retention, anonymous messaging, previews, and
  downloads. A real-browser check covers keyboard and drag/drop behavior.

## Boundaries

- Always: validate on the server, keep the bucket private, authorize every metadata/content read,
  and avoid logging filenames or content.
- Ask first: add attachments after creation, attach files to replies, delete attachments, add signed
  object URLs, or integrate malware scanning.
- Never: serve user-supplied HTML/SVG inline, trust browser MIME values, or expose object keys.

## Success Criteria

- A signed-in user can create a ticket with up to five approved files from the picker or drop zone.
- A failed file prevents ticket creation and leaves the form ready to retry.
- Authorized viewers see image previews and can download every attachment.
- Anonymous creation without attachments and every existing ticket workflow continue to work.
- Migration, quality, coverage, build, browser, and smoke checks pass.

## Out of Scope

Reply attachments, post-creation attachment changes, document previews, antivirus integration,
public object URLs, and production bucket provisioning are deferred.
