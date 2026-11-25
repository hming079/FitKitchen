# FitKitchen

FitKitchen is a fitness meal delivery project with a customer storefront and a separate Admin workspace. The UI also uses the FitFuel/BepFit names inherited from the existing frontend.

## Current implementation

| Area                       | What works in this branch                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer menu/cart/orders  | PostgreSQL menu, customer-owned cart, COD checkout, saved delivery addresses, and customer order history. Sample meals are labeled previews; subscription add-on selections remain estimates. |
| Online payment             | Backend VNPay Sandbox flow: signed payment URL, IPN that updates payment status, and return redirect. The storefront still checks out with COD until its payment UI ships; see [docs/PAYMENT_VNPAY.md](docs/PAYMENT_VNPAY.md). |
| Admin Customers            | PostgreSQL-backed search, status filtering, pagination, profiles/addresses, order history, current plans, and audited lock/unlock.                                      |
| Authorization              | JWT verification, database-backed ADMIN/CUSTOMER roles, account-lock enforcement, and user/address ownership checks.                                                    |
| Email/password login       | **Not implemented yet.** `/login` is a visual preview. Admin records and JWT fixtures do not replace a real login flow.                                                 |
| Other Admin tabs/dashboard | Existing demo/preview screens; do not treat their local data or actions as PostgreSQL operations.                                                                       |

## Repository map

```text
backend/
  src/app.js                 Express routes and error handling
  src/config/                Environment loading and PostgreSQL pool
  src/middleware/auth.js     JWT verification, role and ownership guards
  src/modules/               User/address, meal and Admin modules
  db/init/                   Fresh PostgreSQL volume initialization
  db/migrations/             Existing-database upgrades
  scripts/                   Migration, local seed and JWT fixture commands
  test/                      Node unit and PostgreSQL/HTTP integration tests
frontend/
  src/routes/                TanStack Router pages
  src/components/admin/      Customer-management components and access guard
  src/components/ui/         Shared UI primitives
  src/lib/admin-api.ts       Admin/session HTTP adapter and token storage bridge
  src/styles.css             Global design tokens and Tailwind theme mappings
  bun.lock                   Frontend dependency lockfile
  src/test/                  Vitest tests
```

Read [AGENTS.md](AGENTS.md) and [frontend/AGENTS.md](frontend/AGENTS.md) before contributing. See the [design system](docs/design/DESIGN_SYSTEM.md) and [routing conventions](frontend/src/routes/README.md).

## Local development

### Prerequisites

- Node.js 24 and npm for the backend.
- [Bun](https://bun.com/docs/installation) for the frontend; use the committed `frontend/bun.lock`.
- Docker with Compose v2 for local PostgreSQL 16.

There is no root package/workspace install command. Run dependency commands in the corresponding application directory. Do not create a frontend npm/yarn lockfile alongside `bun.lock`.

### 1. Install and configure the backend

From the repository root:

```bash
cd backend
npm ci --ignore-scripts

# Preserve an existing local configuration.
test -f .env || cp .env.example .env

# Copy the generated value into JWT_SECRET in .env.
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Edit `backend/.env` before starting the backend:

| Variable                      | Local setting / purpose                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                | `postgresql://admin:admin123@localhost:5433/eatclean_db` for the included Compose service          |
| `PORT`                        | `3000`                                                                                             |
| `JWT_SECRET`                  | Your generated secret, at least 32 characters; never commit it or put it in frontend configuration |
| `JWT_ISSUER` / `JWT_AUDIENCE` | `fitkitchen` / `fitkitchen-api`; the future login issuer must use the same values                  |
| `CORS_ORIGINS`                | `http://localhost:5173,http://127.0.0.1:5173`                                                      |
| `ADMIN_DEMO_PASSWORD`         | Optional local seed password, at least 12 characters                                               |
| `VNP_TMN_CODE`                | VNPay Sandbox terminal code (vnp_TmnCode) from the sandbox merchant registration                   |
| `VNP_HASH_SECRET`             | VNPay Sandbox hash secret for HMAC-SHA512 signing; never commit it or put it in the frontend       |
| `VNP_URL`                     | `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`                                               |
| `VNP_RETURN_URL`              | `http://localhost:3000/api/payments/vnpay/return` (browser return; display only)                   |
| `PAYMENT_RESULT_URL`          | `http://localhost:5173/payment/result` (frontend page the return endpoint redirects to)            |

The five VNPay settings are optional for local development. Without them, online payment endpoints answer `503 PAYMENT_NOT_CONFIGURED` and COD checkout keeps working. See [docs/PAYMENT_VNPAY.md](docs/PAYMENT_VNPAY.md).

Configuration precedence is **process environment → `backend/.env` → repository-root `.env` for missing keys**. A key present but empty in `backend/.env` also takes precedence over the root file. Avoid conflicting duplicate settings and restart the backend after changing configuration. Environment files are gitignored.

### 2. Start PostgreSQL and apply the schema upgrade

In `backend`:

```bash
docker compose up -d --wait postgres
npm run db:migrate
```

The database is exposed on host port **5433**, not 5432. Compose credentials are local demo defaults.

- A new empty volume runs `db/init` SQL automatically.
- Existing volumes do not rerun initialization when SQL files change. Use `npm run db:migrate` to retain existing records.
- The current migration is transactional and repeatable; the script does not yet track migration versions automatically.
- Do not delete the database volume to apply migrations.

### 3. Start the backend

In `backend`, keep this terminal running:

```bash
npm run dev
```

`npm start` runs the server without the development watcher. Verify the connection in another terminal:

```bash
curl http://localhost:3000/api/health
```

### 4. Start the frontend

In a separate terminal, from the repository root:

```bash
cd frontend
bun install --frozen-lockfile
bun run dev -- --port 5173
```

Open **http://localhost:5173**. The Vite development proxy forwards `/api` to **http://127.0.0.1:3000**. If you change the backend port, update that proxy target. For a separately hosted API, configure `VITE_API_BASE_URL` to its trusted origin before building and allow the frontend origin in backend `CORS_ORIGINS`.

Use one browser origin consistently: `localhost:5173` and `127.0.0.1:5173` have different sessionStorage. No JWT signing secret or password belongs in a `VITE_*` variable.

## Test the Admin workspace before real login exists

### Seeded demo path

Set `ADMIN_DEMO_PASSWORD` in your backend configuration, then:

```bash
cd backend
npm run demo:seed
node scripts/demo-token.js admin@admin-demo.example.test
```

The seed creates one Admin and two Customers, including a customer with an address, unfinished/completed orders and a current plan. It refuses to overwrite existing demo emails and rolls back the attempt; if the accounts already exist, reuse them. Seed dates are relative to the run date, and the plan eventually expires.

Demo account:

Username:
admin@admin-demo.example.test
active@admin-demo.example.test
orders@admin-demo.example.test
Password: Value in env ADMIN_DEMO_PASSWORD

Open `http://localhost:5173`, then paste the generated token into its browser developer console:

```js
sessionStorage.setItem("fitkitchen.access-token", "<generated local JWT>");
location.assign("/admin");
```

The JWT fixture expires in 30 minutes. Backend signature, expiry, issuer/audience, current database role and lock checks still run. This is **not email/password authentication**.

Login, registration and account-creation decisions belong to the teammate implementing the account module. The current JWT fixture is only for local verification of Admin functionality; coordinate integration with that teammate instead of adding a parallel account-creation or login flow.

## Checks

Backend, from `backend`:

```bash
npm test
# Requires a separate disposable database; never point this at shared/dev data.
TEST_DATABASE_URL='postgresql://<user>:<password>@127.0.0.1:<port>/<test_db>' npm run test:integration
```

Integration tests create and remove their own random schemas and require schema-creation permissions. They exercise real PostgreSQL, HTTP, JWT verification, migration, audit rollback and concurrency. There are no configured backend lint/build/typecheck scripts; `node --check <file.js>` checks syntax only.

Frontend, from `frontend`:

```bash
bun run test
bun run lint
bunx --no-install tsc --noEmit
bun run build
node scripts/check-design-tokens.mjs
```

Run Prettier only on changed files, for example `bunx --no-install prettier --check src/components/admin/*.tsx`. The `format` script writes across the frontend, so avoid it for a small change. Full lint currently has pre-existing failures; distinguish them from regressions and do not weaken checks to get a green result. Passing build/tests does not replace desktop/mobile UI review.

## Common startup issues

| Symptom                                                            | Check                                                                                                                                           |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun: command not found`                                           | Install Bun, reopen the terminal, or add its installation directory to PATH.                                                                    |
| `Set JWT_SECRET to at least 32 characters` / `AUTH_NOT_CONFIGURED` | Check environment-file precedence and secret length; restart the backend.                                                                       |
| PostgreSQL connection refused                                      | Start the Compose service, wait for health, and check host port 5433 / `DATABASE_URL`.                                                          |
| Missing `is_locked` or audit table                                 | Run `npm run db:migrate` against the configured database.                                                                                       |
| Admin access denied                                                | Check the browser origin/token, token expiry and database role/lock state. `/login` is not connected yet.                                       |
| API 401 / 403                                                      | 401 means missing/invalid/expired session; 403 `FORBIDDEN` means insufficient role/ownership; 403 `ACCOUNT_LOCKED` means the account is locked. |
| Port 3000/5173 is occupied                                         | Stop the previous dev process, or configure matching frontend/backend ports.                                                                    |
| Cart or order API returns 401/403                                   | Customer cart and checkout require a signed-in CUSTOMER session. Confirm the account role and session token.                                     |

## UI and team workflow

Global tokens live in [`frontend/src/styles.css`](frontend/src/styles.css): `:root` and `.dark` define values; `@theme inline` maps them to Tailwind utilities. [`__root.tsx`](frontend/src/routes/__root.tsx) loads this stylesheet for every route. Reuse domain components, then shared primitives; follow the [design system](docs/design/DESIGN_SYSTEM.md) and the repository UI/review skills.

The project is connected to [Lovable](https://lovable.dev/projects/ffa43238-ee15-47b4-8f7c-2e49ded31a75). Follow `frontend/AGENTS.md` for generated-file and Lovable-managed boundaries. Preserve `__root.tsx`'s Outlet, do not edit `routeTree.gen.ts` manually, and do not rewrite published Git history. Use feature branches and PRs; keep secrets, local credentials, screenshots, logs and temporary verification reports out of commits.
