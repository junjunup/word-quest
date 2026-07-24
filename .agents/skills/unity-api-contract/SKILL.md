---
name: unity-api-contract
description: Verify Unity HTTP, SSE, authentication, and DTO changes against Word Quest's existing Express routes and web-client adapters. Use when creating or changing files under unity-client/Assets/WordQuest/Runtime/Infrastructure/Api, adding an endpoint, changing ApiRoutes, or reviewing API parity. Prevents invented asynchronous flows, fields, headers, and response semantics.
---

# Unity API Contract

Keep the Unity client aligned with the repository's real API. The Express route
implementation is authoritative; the Vue adapter documents how the deployed
client currently calls it.

## Required inspection

Before proposing DTOs or code:

1. Read `server/src/app.js` to resolve each router's `/api/...` mount.
2. Read the matching `server/src/routes/*.js` route implementation, including
   validation and the exact response body.
3. Read the matching `client/src/api/*.js` adapter and its direct call sites.
4. Read `server/src/middleware/auth.js` for authentication behavior.
5. For chat streaming, also inspect `server/src/routes/chat.js` and the SSE
   parser in `client/src/components/ChatPanel.vue`.

Do not infer an API from a feature name. In particular, the existing social
challenge feature is synchronous HTTP unless the inspected route proves
otherwise.

## Contract record

For each Unity endpoint, record:

- HTTP method and full path, including the `/api` mount.
- Path and query parameters with exact casing.
- Request fields, optionality, types, and bounds actually enforced by Express.
- Success status and JSON envelope.
- Error statuses and JSON envelope.
- Whether `Authorization: Bearer <token>` is required.
- Whether the operation is idempotent. Never invent an idempotency header,
  background job, poll URL, or retry semantic.

Use explicit DTO field names matching JSON. If Unity `JsonUtility` cannot
represent the real structure, add a narrow wrapper or parser; do not reshape
the server contract silently.

## Change rules

- Prefer Unity-only changes. Change Express only when the requested feature
  genuinely requires a backward-compatible contract addition.
- Never include the token or password in logs, exceptions, fixtures, or docs.
- GET requests may retry only for transient transport/5xx errors. Do not
  silently retry POST, PUT, PATCH, or DELETE.
- Treat cancellation and timeout as distinct client results.
- Accept additive unknown response fields.
- Add fixture tests for request serialization and response parsing before the
  adapter implementation.

## Validation

Run:

```bash
bash unity-client/Tools/validate-api-contracts.sh
bash unity-client/Tools/validate-project.sh
```

When Unity 6000.5.3f1 is installed, also run:

```bash
bash unity-client/Tools/run-unity-tests.sh EditMode
```

If Unity is unavailable, report it as not run; static validation is not a
substitute for compilation or transport tests.
