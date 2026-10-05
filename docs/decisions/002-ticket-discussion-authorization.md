# ADR-002: Authenticate Discussion Participants and Use Role-Based IT Approval

## Status

Accepted

## Date

2026-10-03

## Context

The anonymous creation baseline has no identity, ownership, or authorization model. Discussion, moderation, approved solutions, and participant notifications require a reliable actor identity.

## Decision

New tickets require a signed-in owner. Accounts have `USER`, `IT_MEMBER`, and `ADMIN` roles. All signed-in users can read and comment on tickets; authors can edit/delete their own posts; IT members can moderate, spotlight, approve solutions, and reopen tickets. Legacy anonymous tickets remain visible but ownerless.

## Alternatives Considered

Continue anonymous discussion was rejected because it cannot safely authorize moderation or notification recipients. Per-ticket private visibility was rejected for this shared-support release.

## Consequences

The application requires session authentication before ticket creation and discussion. Existing anonymous tickets do not gain synthetic owners. Email delivery is configuration-dependent; in-app notifications remain durable.
