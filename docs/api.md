# Chatterbox API Contract

Status: Draft for review · Implements the requirements in [requirements.md](requirements.md). Requirement IDs are cited per endpoint.

## 1. Conventions

| Topic | Rule |
|---|---|
| Base path | `/api` (all endpoints below are relative to it) |
| Format | JSON requests and responses, `Content-Type: application/json` |
| Dates | ISO 8601 in UTC, for example `2026-10-16T11:19:54.000Z` |
| IDs | Opaque strings. Clients must not parse or order by them |
| Unknown fields | Rejected with `VALIDATION_ERROR` (prevents clients smuggling fields such as `author`) |
| Whitespace | The server trims `email`, `username` and post `content` before validating and storing |
| Email | Lower-cased before storage and comparison |
| Authentication | Session cookie set by login (cookie settings: see the auth strategy document, S1-4) |
| CSRF | Every state-changing request (`POST`) must send the header `X-CSRF-Token` with the value from `GET /csrf-token`. Rationale is recorded in S1-4 |
| Lists | List responses are objects, never bare arrays (NFR-X3) |

## 2. Error format

Every error uses this shape, and never includes stack traces, SQL or internal details (NFR-S4):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields are invalid.",
    "fields": {
      "username": ["Must be 3 to 30 characters."]
    }
  }
}
```

`fields` is present only for `VALIDATION_ERROR` and `CONFLICT`.

| HTTP | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body missing, malformed, wrong types, unknown fields or rule violations |
| 401 | `UNAUTHENTICATED` | No valid session on a protected endpoint |
| 401 | `INVALID_CREDENTIALS` | Login failed (same response for unknown email and wrong password) |
| 403 | `CSRF_INVALID` | Missing or wrong `X-CSRF-Token` |
| 404 | `NOT_FOUND` | Unknown route |
| 409 | `CONFLICT` | Email or username already registered |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Body is not `application/json` |
| 500 | `INTERNAL_ERROR` | Unexpected failure (generic message only) |
| 503 | `SERVICE_UNAVAILABLE` | Database unreachable on a request that needs it |

## 3. Shared objects

**User** (never includes `email` or any password data in responses)

```json
{
  "id": "u_123",
  "username": "ada_l",
  "createdAt": "2026-10-16T11:19:54.000Z"
}
```

**Post**

```json
{
  "id": "p_456",
  "content": "Hello, Chatterbox!",
  "createdAt": "2026-10-16T12:00:00.000Z",
  "author": { "id": "u_123", "username": "ada_l" }
}
```

## 4. Endpoints

| Method | Path | Auth | Purpose | Requirements |
|---|---|---|---|---|
| GET | `/health` | none | Service and database health | NFR-R1 |
| GET | `/csrf-token` | none | Get the CSRF token for the current session | NFR-S5 |
| POST | `/auth/register` | none | Create an account | FR-01 |
| POST | `/auth/login` | none | Start a session | FR-02 |
| POST | `/auth/logout` | none required | End the session | FR-03 |
| GET | `/auth/me` | session | Current user | FR-02, FR-03.3 |
| GET | `/posts` | none | Shared feed | FR-04 |
| POST | `/posts` | session | Create a post | FR-05 |

### GET /health
Returns `200` when the API and database are reachable, `503` when the database is not.

```json
{ "status": "ok", "database": "up" }
```

```json
{ "status": "degraded", "database": "down" }
```

No connection strings, versions or error text are included.

### GET /csrf-token
Returns `200`. The token is tied to the caller's session and must be sent on every `POST`. After login or logout the client fetches a new token, because the session changes.

```json
{ "csrfToken": "abc123" }
```

### POST /auth/register
Creates an account. It does **not** log the user in; the client then calls `/auth/login`.

Request:

```json
{
  "email": "ada@example.com",
  "username": "ada_l",
  "password": "correct horse battery staple"
}
```

| Field | Rule |
|---|---|
| `email` | Valid email format, at most 254 characters, unique (case-insensitive) |
| `username` | 3 to 30 characters from `A-Z a-z 0-9 _`, unique (case-insensitive) |
| `password` | 12 to 128 characters |

Responses:
- `201` with the created user:

```json
{ "user": { "id": "u_123", "username": "ada_l", "createdAt": "2026-10-16T11:19:54.000Z" } }
```

- `400 VALIDATION_ERROR` with `fields` per invalid input.
- `409 CONFLICT` when the email or username is taken:

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Could not create the account.",
    "fields": { "username": ["Already taken."] }
  }
}
```

- `403 CSRF_INVALID`.

Known limitation: a `409` on `email` confirms that an address is registered. This is accepted for the MVP, because registration cannot hide it without email verification (out of scope).

### POST /auth/login
Request:

```json
{ "email": "ada@example.com", "password": "correct horse battery staple" }
```

Responses:
- `200` with the user. A new session is created and its identifier regenerated (FR-02.3); the session cookie is set.

```json
{ "user": { "id": "u_123", "username": "ada_l", "createdAt": "2026-10-16T11:19:54.000Z" } }
```

- `400 VALIDATION_ERROR` when the body is malformed.
- `401 INVALID_CREDENTIALS` for an unknown email or wrong password, with the identical body and a similar response time (FR-02.4):

```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "Email or password is incorrect." } }
```

- `403 CSRF_INVALID`.

### POST /auth/logout
Destroys the server-side session and clears the cookie. It is idempotent: with no active session it still returns `204`.

- `204` with no body.
- `403 CSRF_INVALID`.

After a `204`, the old cookie no longer authorises any protected endpoint (FR-03.3).

### GET /auth/me
Used by the frontend on load to learn whether a session exists.

- `200` with the user (same shape as login).
- `401 UNAUTHENTICATED` when there is no valid session.

### GET /posts
Public. Returns up to the newest 100 posts, newest first (FR-04.2, FR-04.6). The response is an object so pagination can be added later without breaking clients (NFR-X3).

```json
{
  "posts": [
    {
      "id": "p_456",
      "content": "Hello, Chatterbox!",
      "createdAt": "2026-10-16T12:00:00.000Z",
      "author": { "id": "u_123", "username": "ada_l" }
    }
  ]
}
```

An empty feed returns `200` with `{ "posts": [] }`; the empty state is a UI concern (FR-04.4).

### POST /posts
Request:

```json
{ "content": "Hello, Chatterbox!" }
```

| Field | Rule |
|---|---|
| `content` | After trimming, 1 to 280 characters |

The author is always the session user. The timestamp is set by the server (FR-05.3, FR-05.4).

Responses:
- `201` with the created post:

```json
{
  "post": {
    "id": "p_456",
    "content": "Hello, Chatterbox!",
    "createdAt": "2026-10-16T12:00:00.000Z",
    "author": { "id": "u_123", "username": "ada_l" }
  }
}
```

- `400 VALIDATION_ERROR` for empty, whitespace-only, over-length content or unknown fields (including `author`).
- `401 UNAUTHENTICATED` without a valid session (FR-05.1).
- `403 CSRF_INVALID`.

## 5. Status code summary by journey

| Journey | Success | Typical failures |
|---|---|---|
| Register | 201 | 400, 409, 403 |
| Login | 200 | 400, 401, 403 |
| Logout | 204 | 403 |
| View feed | 200 | 500, 503 |
| Create post | 201 | 400, 401, 403 |
| Health | 200 | 503 |

## 6. Out of scope for this contract
Password reset, email verification, post edit and delete, pagination parameters, rate limiting. Each needs a new requirement first.