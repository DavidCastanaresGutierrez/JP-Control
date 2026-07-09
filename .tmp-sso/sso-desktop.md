---
name: sso-desktop
description: >-
  Integrate Typsa desktop apps with the corporate Lambda SSO flow using the
  sso_typsa Python package. Use when adding login to Python desktop apps,
  loopback callbacks, or custom URI scheme redirects.
---

# SSO (Desktop)

Reference implementation: `SSO-Package-Pip` (`sso_typsa` package + `desktop_app/app.py`).

## When to use

Apply when a **desktop** (Python) app must sign users in through the same Typsa Lambda SSO used by web apps.

Not for: Cursor Git sign-in (**github-auth**), npm packages (**get-github-token**), or Angular/web flows (**sso-front**).

## URL contract

The authorize request uses only:

- `email`
- `redirect_uri`

Example:

```
{SSO_AUTHORIZE_URL}?email=user@company.com&redirect_uri=http://localhost:8765/callback
```

Lambda redirects back with tokens in the callback URL query or fragment: `id_token`, `refresh_token`, optionally `access_token`.

## Configuration

The package does **not** call `load_dotenv()`. Load `.env` in the host app before `TypsaSSOClient.set_config()`.

| Variable | Required | Purpose |
|----------|----------|---------|
| `SSO_AUTHORIZE_URL` or `TYPSA_SSO_AUTHORIZE_URL` | No | Overrides packaged default authorize URL |
| `SSO_REDIRECT_URI`, `TYPSA_SSO_REDIRECT_URI`, or `SSO_CALLBACK_URL` | No | Local callback (default: `http://localhost:8765/callback`) |

Packaged default authorize URL lives in `sso_typsa.defaults.DEFAULT_SSO_AUTHORIZE_URL`.

Preferred setup:

```python
from sso_typsa import TypsaSSOClient

client = TypsaSSOClient.set_config()
tokens = client.authenticate_strict(email="user@company.com")
```

## Auth methods

| Method | Use when |
|--------|----------|
| `authenticate()` | Full loopback flow; auto-picks a free port if no redirect URI configured |
| `authenticate_strict()` | Same as `authenticate()`, but requires `id_token` and `refresh_token` |
| `start_auth()` + `open_auth_in_browser()` | Custom URI scheme; user pastes or forwards callback manually |
| `complete_auth(callback_url)` | Parsing a pasted or protocol-delivered callback URL |
| `authenticate_with_loopback()` | Explicit localhost server on a fixed port and path |

## Loopback flow

1. Bind a local HTTP server on the `redirect_uri` host, **port**, and path.
2. Open the browser to the authorize URL with `email` and `redirect_uri`.
3. Wait for the callback GET.
4. Parse query **and** fragment params.
5. Return `TokenResponse` (`id_token` required).

## Custom protocol flow

When `redirect_uri` is not `http(s)://` (e.g. `mydesktopapp://auth/callback`):

1. `start_auth()` + `open_auth_in_browser()`.
2. User completes browser auth; OS may launch a second app instance with the callback URL.
3. Forward callback to the running instance (IPC in `desktop_app/app.py`) or paste URL into UI and call `complete_auth()`.

Optional: register a Windows custom protocol so the browser opens the installed app directly.

## Web equivalent

Web (Angular):

```typescript
window.location.href = `${ssoUrl}?email=${email}&redirect_uri=${redirectUri}`;
```

Desktop:

```python
tokens = client.authenticate(email="user@company.com")
```

## Dev mock (when Lambda URL is unknown)

Use **only** for local development when `SSO_AUTHORIZE_URL` is not available. Never enable in production.

1. Confirm env is missing — `TypsaSSOClient.set_config()` fails or team has no Lambda endpoint yet.
2. Gate mock mode with an explicit flag, e.g. `SSO_DEV_MOCK=true` in `.env` (local only).
3. Skip browser + Lambda; build a fake callback URL and parse it with `complete_auth()`:

```python
import os
from urllib.parse import urlencode
from sso_typsa import TypsaSSOClient

if os.getenv("SSO_DEV_MOCK") == "true":
    # Minimal JWT-shaped strings; backend mock (sso-back) must accept the exchange if app JWT is needed.
    mock_params = urlencode({
        "id_token": "dev-mock-id-token",
        "refresh_token": "dev-mock-refresh-token",
        "access_token": "dev-mock-access-token",
    })
    callback = f"http://localhost:8765/callback?{mock_params}"
    client = TypsaSSOClient(authorize_url="http://localhost/dev-mock")
    tokens = client.complete_auth(callback)
else:
    client = TypsaSSOClient.set_config()
    tokens = client.authenticate_strict(email="user@company.com")
```

4. If the desktop app also calls a backend, pair this with the backend dev-mock route described in **sso-back**.
5. Document required env vars in `.env.example` so teammates know what to request from infra.

## Workflow

1. Check whether real Lambda URLs are configured; if not, use dev mock (above) and tell the user which env vars are missing.
2. Install package: `pip install -e .` from `SSO-Package-Pip` or consume as a dependency.
3. Choose loopback vs custom scheme based on `redirect_uri`.
4. Store tokens securely in the desktop app; do not log full values.
5. If the app needs an app JWT, exchange Cognito tokens with the backend per **sso-back**.

## Gotchas

- `redirect_uri` for loopback must include an **explicit port** (e.g. `:8765`).
- `localhost` and `127.0.0.1` are different redirect registrations.
- Desktop receives Cognito tokens directly; obtaining an app JWT is a separate backend call.
- Do not mix loopback and custom-scheme flows without handling both callback paths.
- Dev mock tokens are not valid Cognito JWTs — refresh and production middleware will reject them unless mock mode is enabled on the backend too.
- Never log or persist raw tokens in plaintext beyond what the app needs.

## Related

- [sso-front](../sso-front/SKILL.md) — Angular web login and callback.
- [sso-back](../sso-back/SKILL.md) — Express login, cookies, and JWT middleware.
