# ADR-010: Suggested Solutions and Technician Endorsements

## Status

Accepted

## Date

2026-10-28

## Context

ADR-004 introduced anonymous, unlabelled replies. Readers cannot tell which reply fixes the
problem or whether IT trusts it. Since then, ADR-003 and ADR-006 have added session-verified
technician accounts, and ADR-007 and ADR-008 have added technician status updates with owner
notifications. The product owner wants technicians to endorse solutions that users submit and to
add notes when they do.

## Decision

- Give each reply a stored `kind` of `SOLUTION` or `COMMENT`, chosen when it is posted. Existing
  replies are migrated as `COMMENT`. The reply itself stays anonymous, as in ADR-004 and ADR-005.
- Store endorsements in a separate `reply_endorsements` table with one row per technician per
  solution and optional notes. Endorsements are attributed: the technician comes from the session,
  and the API shows only their display name.
- Any technician can endorse any number of solutions and can replace or withdraw only their own
  endorsement.
- An endorsement can optionally move the ticket from `IN_PROGRESS` to `RESOLVED` in the same
  transaction. This reuses the ADR-008 status logic and notification, so endorsement adds no new
  transition rule.

## Alternatives Considered

### Treat every reply as a suggested solution

Rejected because people also post questions and status chatter. Calling those "solutions" would
dilute the endorsed list.

### Allow one accepted solution per ticket

Rejected because tickets often have several valid fixes, and more than one technician may want to
confirm one. A single accepted slot would also make concurrent technicians overwrite each other.

### Store the endorsement as columns on `ticket_replies`

Rejected because it would allow only one endorser per reply and mix technician-attributed data
into a table that is deliberately anonymous.

### Resolve the ticket automatically on endorsement

Rejected because endorsing a fix is not the same as confirming the user's problem is gone. The
resolve step is offered but stays the technician's choice.

## Consequences

- Readers can see which fixes IT trusts. Technician names appear on endorsements, which is the
  first attributed content in the reply thread.
- The reply contract grows by `kind` and `endorsements`. `kind` defaults to `COMMENT` on input, so
  older clients keep working.
- The reply list now loads endorsements as well, in one extra query per list that is bounded by the
  200-reply limit.
- The rule that replies cannot be edited still holds. Endorsement notes can be edited by their
  author.
- Abuse controls from ADR-001 still apply. Endorsement is technician-only, so it adds no anonymous
  write surface.
