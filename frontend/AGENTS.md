<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project architecture

- Read the FitKitchen menu (`/api/meals`) through a public browser-side module. Customer cart, checkout, and order history use authenticated `/api/cart` and `/api/orders` endpoints backed by PostgreSQL; prices and order snapshots are calculated by the backend.
- Require a signed-in CUSTOMER session for cart mutations and checkout. Use saved customer addresses and the supported payment methods: cash on delivery or VNPay Sandbox (`ONLINE`). Redirect only to the VNPay origin checked in `src/lib/order-api.ts`, and read payment results from `/api/payments/orders/:orderId` rather than VNPay's return query. Do not treat Shopify preview products or client-side estimates as purchasable items.
- Keep subscription selection and meal add-on estimates as clearly labeled previews until their real purchase products are configured. Keep operations management on a separate `/admin` route and do not use Admin demo records as customer catalog data.

## UI design and review

- Read [the shared design system](../docs/design/DESIGN_SYSTEM.md) before UI changes. Reuse domain/shared components, then primitives in `src/components/ui`; extend existing variants before creating a new component. Use semantic tokens rather than per-page colors or new primitives.
- Use [fitkitchen-ui](../.agents/skills/fitkitchen-ui/SKILL.md) for implementation and [fitkitchen-ui-review](../.agents/skills/fitkitchen-ui-review/SKILL.md) before completion. If skill discovery is unavailable, read both files manually.
- Verify the rendered UI on desktop and mobile, including applicable data/interaction states. State exactly what was observed and what remains unverified; keep demo data and unavailable actions honest.
