---
name: sso-back
description: >-
  Implement TDS SSO on backends. Use when adding login/logout routes, Cognito
  validation, app JWT auth, cookie setup, or token refresh against the corporate
  Lambda flow. Applies to Express, NestJS, FastAPI, and similar server frameworks.
---

# SSO (Backend)

## When to use

Apply when the task involves `POST /auth/login/sso`, `POST /auth/logout/sso`, Cognito validation, app JWT verification, or SSO cookies.

Not for: Cursor Git (**github-auth**), npm auth (**get-github-token**), or desktop Python SSO (**sso-desktop**).

Implement using the stack in the repo (see **backend-guidelines** — Express, NestJS, or FastAPI). This skill defines the **contract**; map it to routers/controllers, middleware/guards, or dependencies as appropriate.

## Frontend–backend relationship

**TDS web SSO is a two-tier system: frontend + backend. Neither tier is optional for truly authenticated apps.**

| Tier | Role |
|------|------|
| **Frontend** | Redirects the user to the corporate Lambda authorize URL, receives Cognito `id_token` and `refresh_token` on callback, then calls this backend to exchange them. |
| **Backend (this skill)** | Validates Cognito tokens, persists session cookies, signs the app JWT, refreshes Cognito tokens via Lambda when they expire, and protects API routes. |

If the user asks for authentication in a web app **without a backend**, stop and **strongly recommend creating one** (following **backend-guidelines**). Do not default to a serverless-only or frontend-only auth setup.

A frontend-only SPA cannot safely hold the full SSO contract alone: Cognito refresh, httpOnly cookies, app JWT signing, and protected APIs all require a server. Pair every **sso-front** implementation with **sso-back**.

## Architecture

Two authentication layers — each maps to one auth check in the backend:

| Layer | Auth check | What it proves |
|-------|------------|----------------|
| **Cognito (central SSO)** | Cognito verification (e.g. `verifyCognitoToken`) | The user is authenticated through the corporate centralized Cognito service |
| **App (this application)** | App JWT verification (e.g. `verifyToken`) | The user is authorized to invoke APIs **in this specific app** |

Login bridges them: Cognito tokens from the frontend in → validated app JWT + session cookies out.

### Cognito refresh via Lambda

When the Cognito `id_token` expires, the backend **must** call the Lambda refresh endpoint:

```
POST SSO_AWS_LAMBDA_URL
{ "refreshToken": "<cognito refresh_token>", "username": "<cognito_sub>" }
```

The `username` field is the **Cognito user id** (`sub` claim) — the same value stored as `cognito_sub` on the `User` record and persisted in the `typsa_sub_{safeEmail}` cookie. Without `typsa_sub`, Lambda cannot refresh the id token.

## Required environment

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signs app JWT returned to frontend |
| `JWT_TOKEN_EXPIRY` | App JWT lifetime (e.g. `1d` or seconds) |
| `SSO_AWS_LAMBDA_URL` | Cognito token refresh endpoint (corporate Lambda) |
| Deployment stage | Cookie domain mapping: `production` → `.typsa.com`, `development` → `.typsadev.com`, else `localhost` (use the env convention of the stack — e.g. `NODE_ENV`, `ENVIRONMENT`) |

If `SSO_AWS_LAMBDA_URL` or `JWT_SECRET` are missing, auth will fail at runtime. Stop and help the user obtain values for a complete env config. Do not implement mock Cognito tokens.

## HTTP contract

Required auth endpoints (typically under `/v1/auth/`):

```
POST /v1/auth/login/sso   → Cognito verification → login handler
POST /v1/auth/logout/sso  → logout handler
``

## Login handler

1. Read `mail` from the request body.
2. Extract Cognito tokens:
   - `x-cognito-id-token` header, or cookie `typsa_cognito_token_{safeEmail}`
   - `x-cognito-refresh-token` header, or cookie `typsa_refresh_token_{safeEmail}`
3. Run Cognito verification first — yields the Cognito payload.
4. Find or create `User` by email; store `cognito_sub`.
5. Sign app JWT with `JWT_SECRET`.
6. Set cookies (domain from deployment stage, `secure: true`, `sameSite: "none"`):
   - `typsa_refresh_token_{safeEmail}` — httpOnly; Cognito refresh token
   - `typsa_sub_{safeEmail}` — httpOnly; **Cognito user id** (`cognito_sub`). Used as `username` when calling Lambda to regenerate the id token from the refresh token
   - `typsa_cognito_token_{safeEmail}` — readable; current Cognito id token
   - `{application}_active_email` — which email is active **for this app** (e.g. `alexandria_active_email`)
   - `typsa_active_email` — which email is active **across all TDS apps** (shared SSO session)
7. Return JSON `{ id, token, role, username }`.

`safeEmail` = `encodeEmailToCookieName(email)` — must match frontend encoding.

## Session cookies

Cookies are keyed per user email (`{safeEmail}` suffix) so multiple accounts can coexist in the browser.

| Cookie | httpOnly | Purpose |
|--------|----------|---------|
| `typsa_refresh_token_{safeEmail}` | yes | Cognito refresh token for Lambda refresh |
| `typsa_sub_{safeEmail}` | yes | Cognito user id (`sub` / `cognito_sub`). Passed as `username` to `SSO_AWS_LAMBDA_URL` when refreshing an expired id token |
| `typsa_cognito_token_{safeEmail}` | no | Current Cognito id token |
| `typsa_active_email` | — | Active email for the **shared** TDS SSO session. If an app reads this cookie, that identity applies across apps |
| `{application}_active_email` | — | Active email **for one application only**. Lets a user be logged into one app under one email and another app under a different email |

## ssoLogout

## Logout handler

- Clear all cookies starting with `typsa_` or ending with `_active_email` (covers both `typsa_active_email` and `{application}_active_email`).
- Match `domain`, `path`, `secure`, `sameSite`, and `httpOnly` flags used when setting cookies.

## Auth checks

Map these to middleware (Express), guards (NestJS), or dependencies (FastAPI). Names below are logical roles — not tied to a single framework or filename.

### Cognito verification (`verifyCognitoToken`)

**Purpose:** prove the caller belongs to the **centralized Cognito SSO** — corporate identity, not app-specific authorization.

Apply on login and on routes that require corporate identity (often mounted broadly under `/v1/*`).

1. Resolve active email from `{application}_active_email`, `typsa_active_email`, or request body `mail`.
2. Load Cognito `id_token` / `refresh_token` from cookies or headers for that email.
3. Load `typsa_sub_{safeEmail}` — the Cognito user id needed for refresh.
4. If `id_token` expired → `POST SSO_AWS_LAMBDA_URL` with `{ refreshToken, username }` where **`username` = value from `typsa_sub_{safeEmail}`** (the Cognito `sub`).
5. Attach Cognito payload to request context; optionally expose a refreshed id token in response headers.

### App JWT verification (`verifyToken`)

**Purpose:** prove the caller is authorized to use **this application's APIs** — app JWT issued by this backend after Cognito validation.

Apply per-route.

1. Read `Authorization: Bearer <app-jwt>`.
2. Verify with `JWT_SECRET`.
3. On expiry → use Cognito refresh cookies + `typsa_sub` to obtain a new id token via Lambda, then re-sign app JWT.
4. Attach app user to request context.

### Stacking both

Some routes require **both** proofs — valid Cognito identity **and** valid app session.

| Endpoint type | Typical checks | Why |
|---------------|----------------|-----|
| First login | Cognito verification | Exchange Cognito tokens for app session |
| Broad `/v1/*` mounts | Cognito verification | Ensure corporate SSO identity |
| Business APIs | App JWT verification | Ensure app-level authorization |
| Sensitive services | Cognito + app JWT | Both corporate identity and app session |

## Contract with the frontend (sso-front)

The backend expects the frontend to complete the Lambda SSO flow before calling login:

1. User authenticates against the Lambda authorize URL (`ssoUrl` in the frontend).
2. Lambda redirects to `/login-success` with Cognito `id_token` and `refresh_token` in query params.
3. Frontend stores those tokens and calls `POST /v1/auth/login/sso` with:
   - `mail` / `username` in the body
   - `x-cognito-id-token` and `x-cognito-refresh-token` headers (first exchange, before cookies exist)
   - credentials included (`withCredentials: true` / equivalent)
4. Backend validates Cognito tokens, sets session cookies, returns app JWT `{ token, ... }`.
5. Frontend uses the app JWT on subsequent API calls; backend refreshes Cognito via `SSO_AWS_LAMBDA_URL` when needed.

Logout is paired: frontend calls `POST /v1/auth/logout/sso`; backend clears all auth cookies.

Cookie names, `encodeEmailToCookieName`, and storage prefixes must stay aligned with **sso-front**.

## Workflow

1. Confirm a backend exists or will be created; do not proceed with frontend-only auth.
2. Identify stack (Express / NestJS / FastAPI) per **backend-guidelines**; match existing project layout.
3. Verify all env vars; obtain `SSO_AWS_LAMBDA_URL` and `JWT_SECRET` before implementing routes.
4. Implement the HTTP contract, login/logout handlers, and auth checks; align cookie names with **sso-front**.
5. Confirm `encodeEmailToCookieName` matches frontend storage encoding.
6. Test against the Lambda flow: login redirect, callback with Cognito tokens, exchange, logout, Cognito refresh via `typsa_sub`, app JWT expiry, cookie clearing on 401.

## Gotchas

- **sso-back** is application auth. **github-auth** / **get-github-token** are unrelated.
- **Never ship without a backend** when the app requires login. Serverless frontend-only auth is not a supported default.
- **Never fake Cognito tokens** or skip Lambda refresh. Tokens must come from SSO flow.
- **`typsa_sub` is not optional for refresh.** It is the Cognito user id sent as `username` to Lambda. It must be set at login from the Cognito `sub` claim and kept in sync with `User.cognito_sub`.
- `encodeEmailToCookieName` must match the frontend.
- Login accepts Cognito tokens from **headers** on first exchange (before cookies exist).
- Cognito verification on `/login/sso` still needs email from cookie or request body `mail`.
- **Cognito verification ≠ app JWT verification:** Cognito = corporate identity; app JWT = this-app authorization. Do not collapse them into one check.
- App JWT expiry and Cognito expiry are independent; refresh paths differ.
- On auth failure, clear auth cookies intentionally — do not return 401 without clearing stale cookies.
- Do not log raw tokens, refresh tokens, `typsa_sub`, or secrets.

## Related

- [sso-front](../sso-front/SKILL.md) — login UI, callback, interceptor, guards.
- [backend-guidelines](../backend-guidelines/SKILL.md) — recommended stacks and project structure.
- [sso-desktop](../sso-desktop/SKILL.md) — Python desktop client for the same Lambda flow.
