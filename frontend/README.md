# FitKitchen frontend

React/TypeScript with TanStack Router/Start, Tailwind CSS v4, existing UI primitives, React Query and Zustand. This directory owns `bun.lock`; the backend is a separate Node/Express application.

Start with the [repository development guide](../README.md) for prerequisites, environment setup, PostgreSQL, backend startup and current feature limitations.

## Run locally

From this directory, with Bun installed:

```bash
bun install --frozen-lockfile
bun run dev -- --port 5173
```

Open http://localhost:5173. The development proxy forwards `/api` to http://127.0.0.1:3000; start the backend separately. Use Bun for dependency changes and preserve `bun.lock`.

## Checks

```bash
bun run test
bun run lint
bunx --no-install tsc --noEmit
bun run build
node scripts/check-design-tokens.mjs
```

Format only changed files. Some repository-wide lint failures predate the Admin feature; do not suppress checks or change unrelated files to hide them.

## Where to work

- [Frontend instructions](AGENTS.md): Lovable boundaries, generated files and UI review.
- [Routing conventions](src/routes/README.md): file-based routes and root Outlet.
- [Design system](../docs/design/DESIGN_SYSTEM.md): semantic tokens, typography, primitives and responsive behavior. Global token values are in [src/styles.css](src/styles.css).

The storefront/cart uses Shopify, while Admin Customers uses the Node/PostgreSQL API. Subscription/add-on selections remain previews until real products are configured. `/login` currently has no email/password backend integration; login and account-creation decisions belong to the account-module owner. Never expose backend signing secrets through `VITE_*` variables.
