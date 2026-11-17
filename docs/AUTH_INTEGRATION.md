# Login and account-module integration

This is a handoff for the teammate implementing registration/login/password reset and personal profiles/addresses. It describes the existing Admin integration contract, not a completed login implementation.

## Existing code to reuse

| Concern                                   | Source                                                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Configuration loading                     | [backend/src/config/env.js](../backend/src/config/env.js)                                                                    |
| Password hashing                          | [backend/src/modules/user/user.security.js](../backend/src/modules/user/user.security.js)                                    |
| Registration/profile validation           | [backend/src/modules/user/user.validation.js](../backend/src/modules/user/user.validation.js)                                |
| User/address persistence and ownership    | [user.service.js](../backend/src/modules/user/user.service.js), [user.routes.js](../backend/src/modules/user/user.routes.js) |
| JWT/account/role checks                   | [backend/src/middleware/auth.js](../backend/src/middleware/auth.js)                                                          |
| Session endpoint and module registration  | [backend/src/app.js](../backend/src/app.js)                                                                                  |
| Browser token storage and request adapter | [frontend/src/lib/admin-api.ts](../frontend/src/lib/admin-api.ts)                                                            |
| Admin route/session guard                 | [frontend/src/components/admin/admin-access.tsx](../frontend/src/components/admin/admin-access.tsx)                          |
| Login UI preview                          | [frontend/src/routes/login.tsx](../frontend/src/routes/login.tsx)                                                            |

The Express backend is CommonJS. Reuse the existing PostgreSQL pool and guards rather than introducing a parallel auth/session implementation. No login endpoint path, request contract, response token-field name, refresh endpoint or password-reset lifecycle has been defined in this branch; agree those contracts before wiring the UI.

## Password compatibility

Current user creation, local seed and internal Admin provisioning call `hashPassword` and save:

```text
scrypt:<salt-as-hex-text>:<64-byte-derived-key-as-hex>
```

For a password verifier added to the existing security module:

1. Validate the stored scheme, 32-character hexadecimal salt and 128-character hexadecimal derived key. Existing bootstrap values such as `hashed_pass_admin` are placeholders, not valid hashes; reject them as credentials rather than treating the string as a password.
2. Call asynchronous `crypto.scrypt(candidatePassword, saltText, 64, callback)` using the same settings as `hashPassword`.
3. **Pass the salt as its stored text string.** The existing hash function passes the hexadecimal string to scrypt as UTF-8 text; decoding the salt into raw hex bytes would produce a different hash.
4. Decode the stored derived key into a 64-byte Buffer and compare equal-length buffers with `crypto.timingSafeEqual`. Do not compare hex strings with `===` or log either password/hash.
5. Normalize email consistently with existing registration: trim and lowercase. Preserve case and whitespace in the password itself.

Customer creation currently requires at least eight password characters. Internal Admin provisioning accepts 12–128. Do not reject an existing valid password at login simply because a new registration policy is stronger. If the team chooses another hash scheme, define compatibility/migration explicitly; do not silently replace the helper and break seeded/provisioned accounts.

## JWT issuance contract

The current verifier requires:

| Field/configuration | Required value                                                                    |
| ------------------- | --------------------------------------------------------------------------------- |
| Transport           | `Authorization: Bearer <JWT>`                                                     |
| Signing algorithm   | HS256; verification explicitly allowlists it                                      |
| `sub`               | String containing the positive PostgreSQL bigint user ID; preserve it as a string |
| `exp`               | Numeric expiration claim; required, with expiry checked by the library            |
| `iss`               | `JWT_ISSUER`, default `fitkitchen`                                                |
| `aud`               | `JWT_AUDIENCE`, default `fitkitchen-api`                                          |
| Secret              | The backend's `JWT_SECRET`, at least 32 characters, with no source-code fallback  |

Use the shared environment loader before importing modules that need configuration. Process variables override `backend/.env`, which overrides repository-root `.env` for missing keys. An explicitly empty value also takes precedence. Frontend configuration must never contain the signing secret or provisioning key.

The CLI fixture has a 30-minute expiry; this is not an agreed production access-token lifetime. Choose the runtime lifetime with the team. If the signing algorithm/claim contract changes, update the single verifier, frontend integration, fixtures, tests and documentation together.

After verifying email/password, reject locked accounts before issuing a token. Use a generic authentication failure for invalid credentials; do not mask database failures as incorrect passwords. A real login response should expose only necessary safe account fields and credentials intended for the client, never `password_hash`.

## Backend authorization invariants

`authenticate` verifies the JWT, loads the current account from `users`, and provides:

```js
req.user = { id, full_name, role, is_locked };
```

- A missing/deleted account is rejected with `401 UNAUTHENTICATED`.
- A locked account is rejected with `403 ACCOUNT_LOCKED` on its next authenticated request, even if the token remains valid.
- A wrong role or foreign resource owner receives `403 FORBIDDEN`.
- Missing/invalid/expired tokens receive `401 UNAUTHENTICATED`; missing/short JWT configuration receives `503 AUTH_NOT_CONFIGURED`.
- Error envelopes on this authentication boundary are `{ success: false, code, message }`. Existing user-controller validation errors still use their original message/errors shape.
- `requireRole('ADMIN')` and `requireSelf(...)` run **after** authentication. Do not replace database role/lock fields with token claims or client-submitted values.

Current route policy:

| Operation                                            | Policy                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| `POST /api/users`                                    | Public Customer creation; cannot assign ADMIN or account lock state             |
| `GET /api/users`                                     | ADMIN only                                                                      |
| `GET/PATCH /api/users/:id`                           | Authenticated account's own ID, including when the caller is ADMIN              |
| `/api/users/:userId/addresses` and address mutations | Authenticated account's own user ID; SQL also scopes the address to that user   |
| `DELETE /api/users/:id`                              | ADMIN only; audit foreign keys prevent deleting retained actors/targets         |
| `/api/admin/customers...`                            | ADMIN only; customer-support reads go through these routes                      |
| Meal GET routes                                      | Public                                                                          |
| Meal POST/PATCH/DELETE                               | ADMIN only                                                                      |
| `GET /api/session`                                   | Any authenticated, unlocked account; returns the current database identity/role |

Preserve these policies when integrating new auth, profile or address routes. Apply the same current-account check to future protected routers. Public registration must continue creating CUSTOMER only. Internal provisioning is a separate, disabled-by-default local administrative tool; never expose it as public registration or use its key as a user's login credential.

## Frontend integration

On successful real login:

1. Pass the returned token to `setAccessToken(token)` in `frontend/src/lib/admin-api.ts`. This writes the current sessionStorage slot and dispatches the session-change event used to invalidate Admin query data. Do not only write storage directly from the login UI.
2. Fetch `GET /api/session` through the shared `api` adapter and `sessionSchema` to get the verified identity/role. The response is `{ success: true, data: { id, full_name, role, is_locked } }`.
3. Navigate ADMIN to `/admin`; coordinate the Customer destination with the account UI owner. Existing `/dashboard` content is a preview, not proof of a completed personal-account flow.
4. Display expired-session, locked-account and insufficient-role failures distinctly. The Admin adapter already notifies the guard for 401 and `ACCOUNT_LOCKED`; preserve that behavior.
5. On client sign-out, call `setAccessToken(null)` to clear the storage bridge and notify the guard.

The storage key is `fitkitchen.access-token`; it is scoped to the tab and origin. `localhost:5173` and `127.0.0.1:5173` are different origins. Browser storage is accessible to same-origin scripts, not an HttpOnly cookie. The preview's "Login as Admin" toggle only changes presentation and never grants a role.

## Decisions still needed

- Login/register/reset endpoint contracts and frontend response fields.
- Token lifetime, refresh strategy and server-side logout/revocation requirements.
- Whether password change/reset should invalidate outstanding JWTs. The current verifier does not track token versions or sessions; browser sign-out alone does not revoke an issued token. Locking or deleting an account does block subsequent requests.
- Whether to keep Bearer/sessionStorage or adopt HttpOnly cookies. Cookies require coordinated changes to the adapter, credentials/CORS settings and CSRF protection; the current implementation does not provide a drop-in cookie flow.

## Acceptance checks for the integrated login

- Passwords created through Customer registration, seed and internal Admin provisioning verify correctly; wrong passwords and placeholder hashes fail without returning hashes.
- Both real ADMIN and CUSTOMER accounts can log in; a locked account cannot obtain or use a valid session.
- A token issued by real login is accepted by `/api/session`; wrong signature, missing/expired `exp`, wrong issuer/audience or a deleted account is rejected.
- A CUSTOMER cannot call Admin APIs, assign ADMIN during registration/profile updates, or access another account's profile/address.
- Lock an already signed-in Customer: the next protected request returns `403 ACCOUNT_LOCKED`; unlock restores access for an otherwise-valid token.
- Successful login, client sign-out, expired session and any chosen refresh/reset behavior are tested end to end, including Admin cache clearing when accounts change.

Use the [development guide](../README.md#checks) for available test commands. Existing JWT fixture tests prove verification/RBAC, not password-authenticated login.
