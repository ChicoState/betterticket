# ADR-010: Technician Status Updates with Polled Owner Notifications

## Status

Accepted

## Date

2026-10-19

## Context

Issues #9 and #8 ask that users see updates on their tickets. ADR-007 added the technician-only
`PATCH /api/tickets/:ticketId/status` endpoint, which advances a ticket one adjacent stage at a
time through `COMPLETED` and explicitly excluded notifications. ADR-005 added a private
`creatorUserId`. Those are enough to define who should hear about a status change.

## Decision

- Keep ADR-007's endpoint, authorization, adjacent-stage rule, `400 INVALID_STATUS_TRANSITION`
  response, and idempotent same-status success.
- Supersede ADR-007 in one respect: technicians may advance a ticket only as far as `RESOLVED`. `COMPLETED` is reached only by the
  owner's confirmation or by automatic completion after a set period, both defined in the issue #8
  follow-up. This keeps a ticket from closing before its owner agrees the problem is fixed.
- Each status change (not an idempotent same-status request) stores one notification for the ticket's `creatorUserId`, if one exists and
  is not the actor. The notification is written in the same transaction as the status change.
- Notifications are private to their recipient. Anonymous-post creators are still notified,
  because the notification never reveals their identity publicly.
- The browser polls `GET /api/notifications` while signed in. Real-time push is deferred.
- The notification rows serve as the minimal status audit trail for owned tickets. A general
  status history remains deferred.

## Alternatives Considered

### Server-sent events or WebSockets

Deferred. Both need long-lived connection handling and proxy configuration that the current
Compose and Vite setup does not have. Polling meets the sprint need with the existing request
model.

### Derive notifications from `updatedAt` without storing them

Rejected. Replies and assignment also change tickets, the previous status would be lost, and
read state could not be tracked per user.

### Notify all viewers of a ticket

Rejected. Tickets have no follower model, and notifying unrelated users is noise.

## Consequences

- PostgreSQL gains a `notifications` table that cascades on user and ticket deletion.
- Tickets submitted without signing in cannot receive notifications. The UI should encourage
  signing in for updates.
- Until the #8 follow-up ships, tickets stop at `RESOLVED`. The technician UI hides the
  "Move to Completed" control.
- Owner confirmation and automatic completion (#8) can reuse this notification path.
