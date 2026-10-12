# Spec: Public Registration and Login Gateway

## Objective

Give visitors a clear entry page: they may sign in, create a regular-user account, or continue to
the existing public ticket list without an account. Self-registration must never create a
technician or administrative privilege.

## Contract

- `/` renders the account gateway and `/tickets` renders the anonymous ticket list.
- `POST /api/users` accepts `name`, `username`, and `password`; it creates only a `USER` and
  returns the safe authenticated-user response with `201`.
- The registration request rejects unknown fields (including `role`), malformed input with `400`,
  a duplicate normalized username with `409 USERNAME_UNAVAILABLE`, and excess requests with `429`.
- Successful registration returns to the login form with the normalized username filled in. It does
  not create a session. Successful login continues to `/tickets`.
- Ticket routes resolve the current session through `GET /api/sessions/current` and show an
  account menu: signed-in visitors see their safe identity and can log out; anonymous visitors see
  a Sign in action. Settings remains visibly unavailable until a later account-management feature.

## Security and Boundaries

- Registration validates input at the HTTP boundary, uses the existing Argon2id password hashing,
  and is limited to five attempts per minute per IP.
- The API—not the browser—sets `role: "USER"`. Technician accounts remain interactive CLI
  provisions by authorized operators.
- Always: keep anonymous ticket viewing/creation public and preserve the server-side session
  protections; revalidate session status when browser history restores a page; never persist
  session tokens or identity in browser storage. Never: accept a public role field, expose
  passwords or password hashes, or log credentials/session tokens.
- Excluded: email verification, password reset, account management, ticket ownership, and a
  technician frontend.

## Verification

- Route tests prove registration cannot elevate roles, rejects role injection and duplicates, and
  is rate-limited.
- Component tests cover anonymous continuation, login, registration-to-login, and confirmation
  mismatch. Existing anonymous ticket route tests remain regression coverage.
