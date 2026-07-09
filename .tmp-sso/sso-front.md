---
name: sso-front
description: >-
  Implement Typsa SSO in web apps. Use when adding login, callback
  handling, token storage, interceptors, route guards, or logout for the
  Lambda-based corporate SSO flow.
---

# SSO (Frontend)

## When to use

Apply when the task involves authentication UI, Lambda redirect, callback routes, dual-token storage, HTTP interceptors, or route guards.

Not for: Cursor Git (**github-auth**), npm auth (**get-github-token**), or desktop SSO (**sso-desktop**).

## Frontend–backend relationship

**TDS web SSO is a two-tier system: this frontend skill + a backend (sso-back). Neither tier is optional for authenticated apps.**

| Tier | Role |
|------|------|
| **Frontend (this skill)** | Login UI, redirect to the corporate Lambda authorize URL, callback handling, storage of Cognito tokens, HTTP client that calls the backend exchange and attaches the app JWT. |
| **Backend (sso-back)** | Validates Cognito tokens, sets httpOnly cookies, signs the app JWT, calls Lambda for Cognito refresh, and protects API routes. |

If the user asks for authentication **without a backend**, stop and **strongly recommend creating one** (following **backend-guidelines** and **sso-back**). Do not default to a frontend-only auth setup.

The frontend must obtain **Cognito `id_token` and `refresh_token`** from Lambda SSO redirect. Those tokens are then exchanged with the backend via `POST /auth/login/sso`.

## Architecture

Typsa web SSO uses **two token layers**:

| Layer | Tokens | Stored as | Used for |
|-------|--------|-----------|----------|
| Cognito (SSO) | `id_token`, `refresh_token` | `typsa_*` keys / cookies | Login exchange, session refresh |
| App JWT | `token` from backend | `app_id_token` | `Authorization: Bearer` on API calls |

Flow:

1. User enters email on `/login`.
2. App redirects to the Lambda authorize URL (`ssoUrl`).
3. Lambda authenticates the user and redirects to `/login-success` with Cognito `id_token` and `refresh_token` in query params.
4. Frontend stores Cognito tokens and calls `POST /v1/auth/login/sso` on the backend to obtain the app JWT + backend cookies.
5. Interceptor attaches the app JWT to subsequent API requests; backend handles Cognito refresh via Lambda when tokens expire.

Steps 3–4 require provided URLs and a running backend. Do not skip the Lambda redirect or the backend exchange.

## Required environment

Configure in `environment.*.ts` (do not hardcode in services):

| Key | Purpose |
|-----|---------|
| `ssoUrl` | Lambda authorize endpoint (`.../sso`) ; user must authenticate here |
| `redirectURI` | App origin registered with SSO (e.g. `http://localhost:4200`) |
| `apiUrl` | Backend base URL (e.g. `http://localhost:3000/v1`) for token exchange |

If any are missing, stop and help the user obtain values. Do not implement mock redirects, fake Cognito tokens, or frontend-only auth workarounds.

## Login initiation

Pattern from `login.component.ts` + `auth.service.ts`:

1. Validate email format.
2. If Cognito token exists and email matches decoded token → call backend directly (skip browser redirect).
3. If email differs or no Cognito token → redirect to Lambda authorize URL:

```typescript
const redirectUri = `${environment.redirectURI}/login-success`;
window.location.href =
  `${environment.ssoUrl}?email=${encodeURIComponent(email)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
```

## Callback (`login-success`)

Route: `/login-success` (must be registered in routing; exclude from shell UI in `app.component.ts`).

On init, read query params from the Lambda redirect:

- `id_token` (required)
- `refresh_token` (required for session refresh via backend/Lambda)
- `access_token` (optional)

Then:

1. `storageService.setCognitoToken(id_token)` and `setRefreshToken(refresh_token)`.
2. Decode `id_token` for `email`, `name`, or `cognito:username`.
3. `userService.loginSSO(mail, displayName)`.
4. On success: `setToken(user.token)`, `setUser(profile)`, navigate home.

## Backend exchange (requires sso-back)

The frontend never replaces the backend. Every successful login must call the backend with real Cognito tokens.

`user.service.ts`:

```typescript
this.http.post(`${environment.apiUrl}/auth/login/sso`, { mail, username });
```

`auth.interceptor.ts` adds **only for** URLs containing `/auth/login/sso`:

- `x-cognito-id-token`
- `x-cognito-refresh-token`

All login requests use `withCredentials: true` so the backend can set cookies.

## Storage conventions

Prefixes from `storage.service.ts`:

| Key / cookie | Prefix | Purpose |
|--------------|--------|---------|
| `app_id_token` | app | App JWT — proves access **to this app** |
| `typsa_cognito_token` | company | Cognito id token (localStorage fallback) |
| `typsa_refresh_token` | company | Cognito refresh token (localStorage fallback) |
| `typsa_cognito_token_{safeEmail}` | cookie | Cognito id token set by backend |

### Backend-managed (httpOnly — frontend must not read)

| Cookie | Purpose |
|--------|---------|
| `typsa_sub_{safeEmail}` | **Cognito user id** (`sub`). Backend sends this as `username` to Lambda when refreshing an expired id token with the refresh token. Set at login from `User.cognito_sub` |
| `typsa_refresh_token_{safeEmail}` | Cognito refresh token for Lambda refresh |

### Active email cookies

Active email tells the backend **which account** to use when multiple users could be logged in.

| Cookie | Scope | Purpose |
|--------|-------|---------|
| `typsa_active_email` | **All TDS apps** (shared SSO) | If an app triggers auth using this cookie, that email applies across the shared SSO session |
| `{application}_active_email` | **One app only** (e.g. `alexandria_active_email`) | Per-app active email — a user can be logged into one application under one email and another under a different email |

**Future:** per-app `{application}_active_email` is the target model for multi-account scenarios. New apps should use their own `{application}_active_email`. Until all apps migrate, both cookies may coexist; the backend resolves email from either.

`safeEmail` = base64url-encoded email (must match backend `encodeEmailToCookieName`).

## Interceptor and guards

The frontend enforces **app-level** auth (app JWT). **Cognito-level** validation and Lambda refresh happen on the backend.

**Interceptor**

- Attach `Authorization: Bearer <app-jwt>` when app token exists.
- On 401 → `authService.logout()`.
- Watch response headers for refreshed tokens (`authorization`, `x-cognito-new-id-token`).

**authGuard**

- Valid app JWT → allow.
- Expired app JWT + valid Cognito → re-call `loginSSO`, then allow.
- Otherwise → `/login`.

**loginGuard**

- Inverse of authGuard: authenticated users skip `/login`.

## Logout

1. `POST ${apiUrl}/auth/logout/sso`.
2. `storageService.clearAuth()` in `finalize` (always runs).
3. Navigate to `/login`.

Alexandria does not redirect to Microsoft logout — local + backend cookie cleanup only.

## Workflow

1. Confirm a backend exists or will be created (**sso-back**); do not proceed with frontend-only auth.
2. Verify `environment` has `ssoUrl`, `redirectURI`, and `apiUrl` from infra.
3. Implement login redirect to the Lambda URL, `login-success` callback, interceptor, and guards. 
4. Test the full end-to-end flow: Lambda redirect → Cognito tokens on callback → backend exchange → API calls with app JWT → logout.

## Gotchas

- Serverless frontend-only auth is not the default and should not be proposed for authenticated apps.
- Two token sets, two jobs: Cognito for SSO exchange/refresh (via backend + Lambda); app JWT for most API routes.
- In the interceptor, the variable holding the app JWT may be named `idToken`. It is not the Cognito id token.
- Cognito headers go only to `/auth/login/sso`, not every request.
- `withCredentials: true` is required for cross-subdomain cookie refresh.
- Cookie encoding (`safeEmail`) and storage prefixes must match **sso-back** exactly.

## Related

- [sso-back](../sso-back/SKILL.md) — login/logout routes, cookies, middleware.
- [sso-desktop](../sso-desktop/SKILL.md) — Python desktop client for the same Lambda flow.