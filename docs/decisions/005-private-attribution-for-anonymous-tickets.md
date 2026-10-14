# ADR-005: Retain Private Attribution for Anonymous Ticket Posts

## Status

Accepted

## Date

2026-10-12

## Context

BetterTicket tickets are public, and signed-in visitors need to decide whether their display name is shown with a submission. Future ownership features need a durable link to the submitting account without exposing an anonymous poster's identity.

## Decision

- A ticket stores a nullable creator-user foreign key and an anonymous-post flag.
- Signed-in posts are publicly labeled with the creator's display name unless `postAnonymously` is selected.
- Anonymous posts retain the creator ID privately but return a null `createdByName` and display as `Anonymous` in public views.
- Unsigned and historic tickets have no creator ID and also display as `Anonymous`.
- The API never accepts a browser-supplied creator ID, username, or display name, and exposes no creator identifier other than an attributed display name.

## Consequences

- The ticket API adds nullable `createdByName`; list and detail views can identify attributed submitters without exposing usernames or IDs.
- Deleting a user clears creator attribution through the foreign key and makes affected public tickets anonymous.
- The private creator relationship is available to a later, separately designed ownership and authorization feature.
