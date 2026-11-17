# Admin customer management

## Repository survey and scope

The starting branch had Express 5/CommonJS, `pg`, PostgreSQL initialization SQL, and user/address/meal CRUD modules. Every CRUD route was public; user payloads accepted `role`. Password creation already used `user.security.js` and Node `scrypt`. There was **no login, JWT issuance/verification, password-reset module, or frontend session store**. `/login` was a visual preview; its Admin switch navigated directly to `/admin`. The Admin workspace and Customers tab used local fixtures. The storefront/cart use Shopify independently and remain separate.

This change adds JWT **verification**, database-backed role/account checks, Admin customer APIs, and the connected Customers tab. It does not implement the other member's registration/login/reset/profile/address project. Existing registration, profile and address handlers are reused with small authorization/validation changes. Other Admin tabs still use their existing demo data, identified in the workspace footer; the subscription preview tab is distinct from a customer's database-backed current plans.

The existing schema provides:

- `users`: bigint ID, email, password hash, name, phone, fitness goal, target calories, role, timestamps; now also `is_locked`.
- `user_addresses`: user FK, recipient, phone, full address and default flag.
- `customer_orders`: user/address FKs, amount, order/payment statuses and method, delivery date/slot and creation time.
- `order_items`: order/meal FKs, quantity, unit price, nutrition/options snapshots and expected delivery date. Item details are outside this task.
- `user_subscriptions`: user/plan/address FKs, date range, status, payment fields, amount and renewal flag.
- `subscription_plans`: name, duration, meals per day, price and availability.

The UI composes the existing directory, semantic tokens, Button, Input, Select, Badge, Dialog, Checkbox, Textarea, Alert and Table. It uses the existing React Query provider and Zod for response validation. No new UI library or design palette is introduced.

## Authentication integration contract

`src/middleware/auth.js` verifies `Authorization: Bearer <token>` using `jsonwebtoken`. Configure a random `JWT_SECRET` of at least 32 characters; no fallback secret exists. The provisional contract is **HS256**, string `sub` containing the PostgreSQL user ID, required numeric `exp`, issuer `JWT_ISSUER` (default `fitkitchen`), and audience `JWT_AUDIENCE` (default `fitkitchen-api`). Verification restricts algorithms, issuer and audience according to the [library's verification documentation](https://github.com/auth0/node-jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback).

Each authenticated request queries `users` and sets `req.user = { id, full_name, role, is_locked }`. Token/body/header role or status claims never grant authority. A missing user is rejected; a locked account is rejected on its **next request even with an unexpired token**. An unlocked account can reuse an otherwise valid token. `requireRole('ADMIN')` runs after `authenticate`.

Coordinate these points with the account-module owner:

1. Issue tokens with the above claims/configuration, or adapt this single verifier to the team's chosen signing contract. Do not keep two verifier implementations.
2. Reuse this database account check on every future authenticated router, including order/subscription APIs when those exist. There are currently no such routers in this branch.
3. Keep registration Customer-only. `POST /api/users` remains public, accepts ordinary profile fields and password, and always creates `CUSTOMER`. `role: ADMIN`, `is_locked`, and role changes through profile PATCH are rejected with 400.
4. `GET /api/users` is Admin-only. Profile GET/PATCH and all address CRUD require the authenticated account's own path ID, including for Admins. Admin customer support reads use `/api/admin/customers/:id`. User DELETE and meal POST/PATCH/DELETE are Admin-only. Public meal GET routes remain public.
5. Frontend login should call `setAccessToken(token)` from `src/lib/admin-api.ts`, then navigate normally. It currently uses a temporary **sessionStorage** slot, `fitkitchen.access-token`; the API adapter is the single token reader. Replace that adapter if the account module chooses a different storage or cookie contract. Browser storage is accessible to same-origin scripts; it is not an HttpOnly cookie.
6. The `/admin` guard checks `/api/session`, rechecks on focus/periodically, and hides the workspace on expired/locked sessions or insufficient role. Backend enforcement is independent. Invalid sessions clear Admin query data. The login preview's Admin switch grants no access and does not navigate into the workspace.

Email/password login and password verification against a real account module **remain unverified and unavailable**. The CLI fixture below proves signed JWT verification and RBAC, not the missing login flow.

## Database setup and migration

Use Node 24 and the backend npm lockfile:

```sh
cd backend
npm ci --ignore-scripts
cp .env.example .env
```

Set `DATABASE_URL` for your environment. Backend startup and CLI scripts resolve configuration independently of the working directory: process environment first, then `backend/.env`, then the repository-root `.env` for missing keys. Neither file is overwritten by the application, and root environment files are gitignored. For a new local database, `docker compose up -d postgres` initializes `db/init/01_schema.sql`, existing sample data, and `03_admin_customers.sql` in order. The Compose file's existing credentials are local demo settings. Do not reset an existing volume.

For **an existing database**, after configuring `.env`:

```sh
npm run db:migrate
```

`db/migrations/001_admin_customers.sql` is transactional and repeatable. It adds `is_locked NOT NULL DEFAULT FALSE`, normalizes NULL roles to CUSTOMER, enforces the two allowed roles, and creates `admin_account_audit` plus indexes. Unknown pre-existing non-NULL roles make migration fail atomically; inspect and explicitly map them before retrying. It does not delete accounts, orders, subscriptions, or addresses. Application queries require this migration before deployment. Bootstrap and upgrade paths have equivalent audit definitions and are both covered by integration tests.

Audit rows retain Admin/customer FKs with `ON DELETE RESTRICT`, action, trimmed reason, old/new lock state, and `TIMESTAMPTZ` time. Their FK constraints preserve audit history against physical account deletion. Changing status and inserting audit use one checked-out `pg` client/transaction. A user row lock serializes concurrent transitions. An already-matching status returns `changed: false` and writes no audit row. Failed changes write no audit row.

## Local demo fixtures

### Internal Admin account provisioning

`POST /api/internal/admins` creates actual database accounts with the existing scrypt password format. It does not require a JWT, issue tokens, or authenticate the supplied password as a login. The runtime login module still needs to be integrated before these accounts can sign in through the frontend.

The endpoint is disabled by default and always disabled when `NODE_ENV=production`. To use it locally, generate a **separate** random key with the secret-generation command below and configure:

```dotenv
INTERNAL_ADMIN_PROVISIONING_ENABLED=true
ADMIN_PROVISIONING_KEY=<separate random key, at least 32 characters>
```

Restart the backend. In Postman, call `POST http://localhost:3000/api/internal/admins`, set header `X-Admin-Provisioning-Key` to that key, and choose JSON body:

```json
{
  "email": "admin1@fitkitchen.example.test",
  "full_name": "Local administrator one",
  "password": "<choose a local password of 12–128 characters>"
}
```

Repeat with another email to create additional Admins. Only `email`, `full_name`, and `password` are accepted; role is assigned by the server. Success is 201 with safe account fields, never a password or hash. Invalid payloads return 400, missing/wrong keys or a non-loopback socket peer return 403, and duplicate emails return 409 without promoting a Customer or changing an existing password. A disabled/unconfigured endpoint returns 404.

This endpoint accepts only actual loopback socket peers (not forwarded-address headers). Call it on the backend machine or through an SSH tunnel; do not publish `/api/internal` through a reverse proxy or put the key in frontend configuration. Set `INTERNAL_ADMIN_PROVISIONING_ENABLED=false` and restart after creating accounts. A key does not replace network isolation for a deployed provisioning service; this endpoint is deliberately local-only.

### Seed and JWT verification fixtures

Generate a secret locally, put it in the untracked `.env`, and use the same configuration when issuing fixture tokens and starting the backend:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Set `JWT_SECRET` and choose a local-only `ADMIN_DEMO_PASSWORD` (at least 12 characters). Then:

```sh
npm run demo:seed
npm start
```

The seed transaction creates these explicitly fictional accounts:

| Email                            | Role     | Initial fixture                                                       |
| -------------------------------- | -------- | --------------------------------------------------------------------- |
| `admin@admin-demo.example.test`  | ADMIN    | Unlocked administrator                                                |
| `active@admin-demo.example.test` | CUSTOMER | Unlocked; no address, orders or current plan                          |
| `orders@admin-demo.example.test` | CUSTOMER | Unlocked; address, PREPARING and COMPLETED orders, ACTIVE 30-day plan |

Passwords use the existing `scrypt:<salt>:<derived-key>` helper, not the placeholder hashes in older mock data. No password is committed or printed by the seed. The seed refuses to overwrite existing demo emails and rolls back the whole attempt; it does not promote existing accounts or reset their passwords. Both demo scripts refuse `NODE_ENV=production`. Existing mock accounts are retained; their old placeholder hashes are not valid demo login credentials.

Until real login lands, issue a **local integration fixture**, not a password-authenticated session:

```sh
node scripts/demo-token.js admin@admin-demo.example.test
```

This offline script requires database access and the signing secret, accepts the three seeded demo emails plus the provisioned local accounts `admin1@fitkitchen.example.test` and `admin2@fitkitchen.example.test`, and prints a 30-minute signed JWT. The two local accounts must exist, be unlocked, and have database role ADMIN. For example, run `node scripts/demo-token.js admin1@fitkitchen.example.test` after internal provisioning. The script has no HTTP endpoint. Use its token as a Bearer credential in an API client. For the browser demo, open the local frontend, run the following once in its developer console with your generated fixture, then reload `/admin`:

```js
sessionStorage.setItem(
  "fitkitchen.access-token",
  "<generated local fixture JWT>",
);
location.assign("/admin");
```

The backend still verifies the signature, expiry, issuer, audience, database role and lock state. Changing browser role fields cannot grant access. Remove the fixture or use Sign out after the demo. Do not put tokens in URLs, source files, screenshots or commits.

In another terminal:

```sh
cd frontend
bun install --frozen-lockfile
bun run dev -- --port 5173
```

The Vite development proxy sends `/api` to `http://127.0.0.1:3000`. For a separately hosted backend, configure `VITE_API_BASE_URL` to its trusted origin (no trailing slash) before building. Configure backend `CORS_ORIGINS` for that frontend origin. No signing secret or demo password belongs in frontend configuration.

Demo steps:

1. Open `/admin` without a fixture: access is denied. Install the Admin fixture: Customers loads from PostgreSQL.
2. Search by name, email or phone and filter account status. Open the customer with orders to inspect contacts, default address, order history and the current plan.
3. Lock that customer, enter a reason, inspect the unfinished-order warning, check the explicit confirmation and submit. Refresh: the account remains locked.
4. Issue a fixture for the same customer and call `/api/session`: the existing token now receives `403 ACCOUNT_LOCKED`. Unlock with a reason; that same otherwise-valid token works again.
5. Use the active customer's fixture on `/api/admin/customers`: `403 FORBIDDEN` regardless of any claimed client role.
6. Inspect `SELECT * FROM admin_account_audit ORDER BY id DESC;` in your database. Each real lock/unlock has the actor, target, reason, old/new state and timestamp. No audit UI is included.
7. Open the active customer's profile to show empty address/order/plan states. Stop the backend to show load failure/retry; restart it and retry.

## Customer API

All `/api/admin/*` endpoints below require an authenticated, unlocked ADMIN. Responses use the existing `{ success, data }` convention; list/history also return `pagination`. Bigint IDs and PostgreSQL numeric amounts are strings; amounts use the existing database's VND convention. Responses exclude password hashes and unrelated personal metrics.

Calendar fields (`delivery_date`, `start_date`, `end_date`) are `YYYY-MM-DD` strings and display the same day in every browser timezone. Timestamp fields such as `created_at` remain timestamps and are formatted in the browser's local timezone. Do not convert calendar fields through JavaScript `Date` or PostgreSQL's default JavaScript date parser.

| Method / path                                | Input / result                                                                                                                                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/session`                           | Any authenticated, unlocked account; `{ success: true, data: { id, full_name, role, is_locked } }`                                                                                                                           |
| `GET /api/admin/customers`                   | Optional `search` (trimmed, max 200), `status=all\|active\|locked`, `page` (default 1, max 100000), `page_size` (default 20, max 100). Only CUSTOMER rows.                                                                   |
| `GET /api/admin/customers/:id`               | Customer contacts, goal, lock state, creation date, addresses and `unfinished_order_count`.                                                                                                                                  |
| `GET /api/admin/customers/:id/orders`        | Paginated customer orders, newest creation/ID first. ID, creation/delivery dates, amount, order status, payment method/status.                                                                                               |
| `GET /api/admin/customers/:id/subscriptions` | Paginated current plans with plan name, date range, status, amount, payment method/status. Same pagination limits.                                                                                                           |
| `PATCH /api/admin/customers/:id/status`      | `{ is_locked: boolean, reason: string, confirm_unfinished_orders?: boolean }`. Reason must contain 1–1000 characters after trim. Unknown fields are rejected. Returns `{ success: true, data: customer, changed: boolean }`. |

Customer fields: `id`, `full_name`, `email`, `phone`, `fitness_goal`, `role`, `is_locked`, `created_at`. Missing phone/goal/date remain NULL. Example list envelope:

```json
{
  "success": true,
  "data": [],
  "pagination": { "page": 1, "page_size": 20, "total": 0 }
}
```

When locking with unfinished orders, without `confirm_unfinished_orders: true`, the backend returns **409**, makes no change and writes no audit:

```json
{
  "success": false,
  "code": "UNFINISHED_ORDERS",
  "message": "This customer has unfinished orders. Confirm to lock the account.",
  "unfinished_order_count": 2
}
```

After review, resubmit the same target/reason and `confirm_unfinished_orders: true`. The backend queries unfinished orders again inside the mutation transaction; frontend preview counts are advisory. Confirmation authorizes proceeding with the current unfinished orders, rather than acknowledging a frozen count. The customer row lock serializes lock/unlock requests. Future order writers must coordinate if the team later requires no new orders between this check and commit; that order workflow is outside this task.

Error responses contain `{ success: false, code, message }`:

| HTTP | Code / meaning                                                                   |
| ---- | -------------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`: invalid ID, query or status payload                          |
| 401  | `UNAUTHENTICATED`: missing/invalid/expired JWT or deleted account                |
| 403  | `FORBIDDEN`: verified account has insufficient role or wrong resource owner      |
| 403  | `ACCOUNT_LOCKED`: current database state is locked; distinct from role rejection |
| 404  | `CUSTOMER_NOT_FOUND`: absent user or target is not CUSTOMER                      |
| 409  | `UNFINISHED_ORDERS`: explicit lock confirmation required                         |
| 500  | `INTERNAL_ERROR`: unexpected database/server failure; no raw SQL returned        |
| 503  | `AUTH_NOT_CONFIGURED`: JWT signing configuration is missing or too short         |

Legacy user/address controllers retain their original `{ success: false, message, errors? }` validation/not-found conventions; authentication/authorization failures on those paths use the codes above.

## Status rules and limits

- Unfinished orders: exactly `PENDING`, `PREPARING`, `DELIVERING`, from the existing schema comment and existing Admin order states. `COMPLETED` and `CANCELLED` are terminal. No separate waiting-for-delivery status exists; this change adds no order lifecycle. Unknown/NULL order statuses do not silently become one of the supported states.
- Current subscriptions: provisionally `status = 'ACTIVE'` and `CURRENT_DATE BETWEEN start_date AND end_date`, inclusive, using the database's timezone. The schema default is PENDING and does not define a lifecycle; the team should confirm this rule before adding subscription mutations. Payment fields are shown independently; the read does not invent a new payment eligibility rule. A plan's current catalog availability does not cancel an existing subscription.
- Locking preserves orders/plans; it does not cancel deliveries or payments. Only accounts with role CUSTOMER can be lock targets.
- Demo dates are relative to the day the seed runs. The current plan will naturally expire; prepare a new explicitly scoped fixture when needed.
- No staff management, role editing UI, dynamic permissions, audit UI, weight/macro tracking, order-item details or subscription lifecycle are included.

## Verification commands

```sh
cd backend
npm test
TEST_DATABASE_URL=postgresql://<user>:<password>@127.0.0.1:<port>/<disposable_db> npm run test:integration
```

The integration suite requires an explicit disposable database and permission to create/drop schemas. It creates random schemas, reconstructs the old schema, tests fresh initialization/migration/repeated migration and seeded fixtures, starts real HTTP, verifies real signed JWTs, injects database-trigger failures to prove rollback, and tests concurrent duplicate requests. Only its own schemas are removed; it never resets public/application tables. Expected injected failures produce sanitized server log messages.

```sh
cd frontend
bun run test
bun run lint
bunx --no-install tsc --noEmit
bun run build
node scripts/check-design-tokens.mjs
```

Use local Prettier on changed frontend files. The repository has no backend lint/build/typecheck commands; `node --check` checks changed JavaScript syntax, while HTTP/database behavior is covered by integration tests. Frontend unit tests cover malformed responses, credentials, locked-session notification, server-driven lock reconfirmation and independently recoverable profile/history sections. Browser verification must use an explicitly labeled JWT fixture until the team's real login exists; do not describe it as an email/password end-to-end test.
