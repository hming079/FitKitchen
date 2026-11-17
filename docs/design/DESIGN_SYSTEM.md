# FitKitchen design system

## Product and scope

FitKitchen provides meals for fitness goals: Cut, Bulk, and Maintain. Customer UI helps people browse meals, understand prices and calories/macros, select meals, place orders, and track plans and personal information. Admin helps operators find data, read statuses, and act accurately. Customer screens may emphasize food photography; Admin prioritizes information density, tables, search, and actions. Both share a **fresh, practical, food-focused** foundation: deep green, slightly warm light backgrounds, restrained lime accents, and clear layouts.

The current application also displays FitFuel/BepFit names; this document does not change the logo or brand identity. Read the [root instructions](../../AGENTS.md) and [frontend/AGENTS.md](../../frontend/AGENTS.md), especially the Lovable boundaries, before making changes.

Sources of truth: [styles.css](../../frontend/src/styles.css) for tokens and [components/ui](../../frontend/src/components/ui) for primitives. Apply this standard incrementally; existing screens are not all compliant. The reference implementation is `/admin` → Customers: a guarded, API-backed directory with search, status filtering, pagination, customer history and audited lock/unlock actions. See [Admin integration and demo setup](../ADMIN_CUSTOMERS.md) for the current JWT/login boundary and database fixtures.

## Semantic colors

CSS color values must use `oklch()`. Do not copy HEX values or token values into components. Existing background/foreground/primary/secondary/muted/lime colors already approximate the chosen direction and are retained to limit global impact. `lime` is a compatibility alias for `brand-highlight`; new code should use semantic names with the correct foreground. Do not choose a new palette for each page.

| Role                          | Background utility                                      | Matching text utility             | Usage                                                                                       |
| ----------------------------- | ------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| Slightly warm page background | `bg-background`                                         | `text-foreground`                 | Main content and Customer/Admin layouts                                                     |
| Independent surface           | `bg-card`                                               | `text-card-foreground`            | Meals and directories that need a boundary                                                  |
| Floating surface              | `bg-popover`                                            | `text-popover-foreground`         | Select, popover, and menu content                                                           |
| Primary action                | `bg-primary`                                            | `text-primary-foreground`         | Default `Button`; one primary emphasis per region                                           |
| Secondary surface             | `bg-secondary`                                          | `text-secondary-foreground`       | Supporting regions and secondary actions                                                    |
| Muted surface                 | `bg-muted`                                              | `text-muted-foreground`           | Table headers and readable metadata; main content still uses foreground                     |
| Subtle interaction            | `bg-accent`                                             | `text-accent-foreground`          | Primitive hover/selection, not business status                                              |
| Brand highlight               | `bg-brand-highlight`                                    | `text-brand-highlight-foreground` | Restrained lime; avoid white text or small lime text on light backgrounds                   |
| Success                       | `bg-success-muted`                                      | `text-success`                    | Completed/active **when confirmed by data**                                                 |
| Warning                       | `bg-warning-muted`                                      | `text-warning`                    | Attention needed, such as unfinished orders                                                 |
| Subtle error/destructive      | `bg-destructive-muted`                                  | `text-destructive`                | Errors or a confirmed locked account                                                        |
| Information                   | `bg-info-muted`                                         | `text-info`                       | Supporting information and clearly labeled preview notes                                    |
| Solid status                  | `bg-success`, `bg-warning`, `bg-info`, `bg-destructive` | `text-<status>-foreground`        | Always use the matching pair; destructive actions use `Button variant="destructive"`        |
| Grouping border               | `border-border`                                         | —                                 | Subtle separators; insufficient as the sole input-identification cue                        |
| Control border                | `border-input`                                          | —                                 | Stronger than the grouping border so controls are recognizable                              |
| Focus                         | `ring-ring` + offset                                    | —                                 | Button/Input use a 2px ring with a 2px background offset; inspect rendered focus in context |

`coral`, `fresh`, `lime`, and chart/sidebar tokens remain for compatibility. Legacy coral/fresh/lime brand colors **do not replace** success/warning/info/destructive and do not automatically provide sufficient contrast for small text. Existing chart/sidebar implementations have not been fully migrated. Global color adjustments in this change are limited to destructive, input, and ring; brand values are retained with additional role-based names.

### Adding tokens and checking contrast

1. Look for an equivalent token first. If a role is missing, add variables to both `:root` and `.dark` in `styles.css`.
2. Register `--color-<role>: var(--<role>)` in `@theme inline` to provide `bg-*`, `text-*`, and `border-*`; see [Tailwind theme variables](https://tailwindcss.com/docs/theme).
3. Check foreground/background pairs, including secondary surfaces, hover, disabled, and focus. Target ≥4.5:1 for ordinary text under [WCAG contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html); meaningful control/focus cues need ≥3:1 against adjacent colors under [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). Add text or another appropriate cue rather than communicating status through color alone.
4. Run the contrast script described under verification, then inspect the browser. Opacity, images, and blended backgrounds require separate measurements. Passing token pairs do not establish that every utility combination passes.

### Light and dark

Light is the default interface. Existing `.dark` variables and the Tailwind dark variant support alternate values. New dark status tokens use light text on muted dark surfaces and dark foregrounds on solid status colors. `brand-highlight-foreground` stays dark so text remains readable on lime in both themes. No theme switcher is added. Test `.dark` with local fixtures/browser tooling rather than adding persistent preferences or changing user workflows for a demonstration.

The whole website has not been reviewed in dark mode: legacy `bg-white`, hard-coded colors, and `bg-lime text-foreground` may become unsuitable when foreground turns light. Do not claim complete dark-mode support; inspect affected screens before enabling it application-wide.

## Typography, spacing, and surfaces

- **DM Sans / `font-sans`:** body, tables, forms, labels, and buttons. **Space Grotesk / `font-display`:** page headings or meal names. Fonts load through a `<link>` in `src/routes/__root.tsx`; preserve sans-serif fallbacks and avoid remote CSS font imports or new font families.
- Prefer `text-base` (16px) for body/mobile inputs, `text-sm` (14px) for tables/supporting content, and `text-xs` (12px) for short metadata. Do not shrink essential information to fit more fields. Region headings use `text-base font-semibold`; page headings commonly use `text-2xl`/`text-3xl font-display`. Use `leading-relaxed` for longer text and `tabular-nums` for comparable numbers.
- Use the existing Tailwind scale with a 4px base: 1/2/3/4/5/6/8/10/12 = 4/8/12/16/20/24/32/40/48px. Typical gaps are 2–3 within a group, 4–6 between groups, and 6–8 between sections; gutters are 4 on mobile and 6–8 on wider screens. Do not create a per-page scale. Specialized layout values, such as sidebar columns or aspect ratios, need a reason.
- `--radius` is currently 0.625rem; token-based `rounded-sm/md/lg` correspond to 6/8/10px. Use `rounded-lg` for data regions and `rounded-md` for primitives. Reserve `rounded-full` for meaningful shapes such as avatars/toggles, rather than turning all metadata into pills.
- Use thin 1px borders and prefer spacing/alignment over extra boxes. Keep existing primitive shadows; avoid shadows on every row/section. Dialogs/popovers need elevation; ordinary lists usually do not.
- The existing icon library is `lucide-react`, using its default stroke. Prefer 16px beside text, 20px for navigation/actions, and 24px when justified. Icon-only actions need accessible names; decorative SVGs use `aria-hidden`. Do not automatically put heading/KPI icons inside colored circles.

## Responsive and accessibility baseline

Use existing Tailwind breakpoints: `sm` 640, `md` 768, `lg` 1024, and `xl` 1280. Prioritize information according to the mobile task instead of merely stacking desktop content. Customers uses a table from `md` and a labeled contact list below it; name and fitness goal precede email/phone, while all information remains available. Comparison tables that need horizontal space may scroll within their own region without overflowing the page.

Check at least desktop and 320–390px mobile layouts; include tablet/200% zoom when layout is affected. Use 16px mobile inputs, prioritize controls ≥44px high, and provide targets of at least 24px with adequate spacing. Keep decision-critical information visible. Forms need associated labels and field errors; asynchronous states use `role="status"`/`alert` according to urgency. Static notes should not be live alerts. Preserve heading hierarchy, table captions/column headers, and list labels when needed. Check Tab, Enter/Space, Escape, and focus restoration for relevant dialogs/menus. Motion should be brief and support interaction; use `motion-reduce`/`motion-safe` for nonessential movement.

The Admin shell shares navigation content between a persistent sidebar at `lg` and a mobile `Sheet` below it. The Sheet traps focus, closes with Escape or section selection, restores focus to its trigger, and dismisses when the viewport switches to desktop. Shared Dialog/Sheet animations run only with `prefers-reduced-motion: no-preference`. Test customer names up to 150 characters and long email addresses: flex/grid children must shrink and wrap without horizontal page or dialog overflow.

## Components and extensions

Reuse in this order: **domain → shared → primitive → extend an existing component → create only when missing**. Read implementations/props before use. A wrapper that only renames something is not a useful abstraction. Semantic native elements such as `section`, `dl`, and `ul` do not require their own components.

| Existing primitive in `frontend/src/components/ui` | Usage and notes                                                                                                                                                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Button`                                           | Default for primary actions; outline/secondary for supporting actions; ghost for low emphasis; link for text navigation; destructive for risky operations in the appropriate context. Keep disabled/pending states real and labels concrete.                                   |
| `Input`, `Textarea`, `Label`, `Form`               | Labeled forms with field-level guidance/errors. Do not rebuild controls and lose focus behavior merely for a different appearance.                                                                                                                                             |
| `Select`, `Checkbox`, `RadioGroup`, `Switch`       | One choice from a list; multiple choices; one of a few options; immediate on/off. Do not replace checkboxes with semantically empty pills.                                                                                                                                     |
| `Dialog`, `AlertDialog`, `Sheet`                   | Focused details/tasks; consequential confirmations; edge panels/mobile navigation. Reuse primitive focus management rather than drawing a custom modal.                                                                                                                        |
| `Table` + subcomponents                            | Column comparison; descriptive captions and scoped headers. A simple directory does not need a new DataTable engine.                                                                                                                                                           |
| `Tabs`                                             | Peer panels within one task; do not replace URL navigation when routes are needed.                                                                                                                                                                                             |
| `Badge`                                            | Short statuses: default/secondary/outline/destructive plus success/warning/info. A static badge is not a button; always provide text and avoid badges for ordinary metadata.                                                                                                   |
| `Card` + subcomponents                             | An independent object/group; a section and spacing may be sufficient without a card.                                                                                                                                                                                           |
| `Alert` + description/title                        | Decision-relevant notices: default/destructive and success/warning/info. Defaults to `role="alert"`; override static notes with `role="note"`, and consider `role="status"` for nonurgent outcomes. Add a title only when useful; avoid an h5 that disrupts heading hierarchy. |
| `Skeleton`, `Progress`, `sonner`                   | Real loading/progress/toasts; do not replace persistent field errors with a transient toast.                                                                                                                                                                                   |
| `DropdownMenu`, `Tooltip`, `Popover`, `Pagination` | Infrequent actions, supplementary explanations, floating content, and actual data pagination. Tooltips must not hide essential information.                                                                                                                                    |

Existing domain/shared components in `frontend/src/components` include `MealCard`, `DemoMealCard`, `MealCustomizationDialog`, `CartDrawer`, `StoreHeader`, and `SubscriptionPlans`. They preserve Shopify catalog/cart behavior and preview conventions; do not duplicate them for new pages. `admin/CustomerDirectory` owns the customer search/filter/page state and server queries. `CustomerDetails` and `CustomerStatusDialog` compose independent history reads and reason/confirmation handling using shared primitives; account state comes from the backend. Legacy Admin helpers `Panel`, `DataTable`, `SearchBox`, and `Modal` remain local to `admin.tsx`; these are legacy implementations rather than the primitives to use on new screens. Migrate them incrementally when an authorized task touches their scope instead of reproducing them elsewhere.

### States

Show loading only while work is actually pending; preserve content placement and provide a readable status. Distinguish an empty dataset from unmatched search and offer an appropriate recovery step without inventing numbers. Errors explain what failed and how to retry when retry behavior exists; success requires confirmed completion. Do not turn missing data into `0` or `0` into “—”. Explain unavailable actions when users need to understand why, and do not invent actions just to demonstrate disabled states. Customers uses asynchronous reads and mutations, so its states include loading, filtered/empty results, independently recoverable history errors, and pending/success/error account changes. Unfinished-order warnings and confirmations come from server checks.

## FitKitchen examples

The snippets below illustrate design-system usage. Customers now connects account statuses and unfinished-order warnings to the backend; continue to source these values from actual responses rather than assigning them to unrelated fixtures.

```tsx
// Example statuses when the data source actually provides account status.
<Badge variant="success">Active</Badge>
<Badge variant="destructive">Locked</Badge>

// Example warning, only when unfinished orders have been confirmed.
<Alert variant="warning" role="note">
  <AlertDescription>This customer has unfinished orders. Review them before locking the account.</AlertDescription>
</Alert>

// Visual/disabled example. The implemented flow uses Dialog, the customer and
// consequences, a reason, explicit unfinished-order confirmation and pending/error states.
<Button variant="destructive" disabled>Lock account</Button>
```

For the actual directory/empty state, see [CustomerDirectory](../../frontend/src/components/admin/customer-directory.tsx). Search and filtering have labels, counts preserve `0`, and empty/error results provide recovery. Contact details, goals and account statuses come from the customer API. Details and status actions use shared Dialog focus management; they preserve address/order/plan empty states and require a reason for account changes.

Customer UI should reuse `MealCard`/`DemoMealCard` with sourced meal images, names, prices, Cut/Bulk/Maintain goals, calories in `kcal`, and protein/carbs/fat in `g`. Use readable text for values and muted foreground for metadata; reserve badges for meaningful status. This example illustrates rendering; `meal` must come from existing data:

```tsx
<p className="text-sm text-foreground">
  {meal.calories == null ? "Calories unavailable" : `${meal.calories} kcal`}
  {" · "}
  {meal.protein == null ? "Protein unavailable" : `${meal.protein}g protein`}
</p>
```

Legacy meal components still use brand colors for some small text and truthy fallbacks; they have not all been migrated in this change. These examples do not establish that those components have been fixed.

## Using skills and verifying changes

- For UI work, read [fitkitchen-ui](../../.agents/skills/fitkitchen-ui/SKILL.md), then [fitkitchen-ui-review](../../.agents/skills/fitkitchen-ui-review/SKILL.md) before completion. Environments that support skill invocation may use `$fitkitchen-ui` / `$fitkitchen-ui-review`; otherwise request the files explicitly. No personal installation is needed, and automatic discovery is not guaranteed for every tool.
- From `frontend`, `bun install --frozen-lockfile` uses the existing lockfile. Available commands include `bun run dev`, `bun run lint`, `bun run test`, and `bun run build`. `build:dev`, `preview`, `test:watch`, and `format` also exist in package.json. There is no `typecheck` or `format:check` script; use local tools: `bunx --no-install tsc --noEmit` and `bunx --no-install prettier --check <changed files>`. Avoid `format` because it writes across the repository.
- Check tokens without extra dependencies using `node scripts/check-design-tokens.mjs` from `frontend`. It reads CSS and verifies theme mappings, light/dark values, and sRGB contrast for defined pairs. Blended/image backgrounds, actual focus, and components still need browser inspection.
- Recheck token/component changes and record actual results and limitations directly in the PR description, distinguishing baseline failures with evidence.
