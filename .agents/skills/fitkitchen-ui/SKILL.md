---
name: fitkitchen-ui
description: Design, build, or update FitKitchen frontend UI using the shared design system. Apply to Customer and Admin interfaces, including work without mockups.
---

# Build FitKitchen UI

Code paths below are relative to the repository root. This skill does not authorize additional business logic, APIs, data, or workflow changes beyond the requested task.

1. Read `AGENTS.md`, `frontend/AGENTS.md`, and any other applicable instructions. Read [DESIGN_SYSTEM.md](../../../docs/design/DESIGN_SYSTEM.md); `frontend/src/styles.css` is the source of token values. Respect Lovable-managed boundaries and existing changes.
2. Inspect the current screen or its closest equivalent in both code and the running application. Briefly identify its users, primary task, information needed to decide, and primary/secondary actions. Missing mockups are not a reason to invent KPIs, heroes, or cards.
3. Search with `rg` and reuse in this order: existing domain component → shared component → primitive in `frontend/src/components/ui` → extension of an existing component/variant → new component only if the preceding options cannot meet the need. Explain any new component; avoid wrappers that merely rename a primitive.
4. Follow the fresh, practical, food-focused direction: slightly warm light backgrounds, deep green, and restrained lime accents. Customer UI prioritizes meals, prices, calories/macros, fitness goals, and meal selection; Admin prioritizes readable data, search, status, and actions. Keep the documented fonts, icon library, spacing, radii, and shadows. Pair semantic foreground/background tokens correctly; do not use lime as a status color or small text on a light background.
5. Identify and implement states that actually belong to the task: default, hover, keyboard focus, disabled/pending, and loading/empty/error/success when the flow can produce them. Preserve input labels, status text, focus order, responsive behavior, and reduced-motion support. Do not add fake loading/error screens to a synchronous flow just to complete a checklist.
6. Use FitKitchen-specific content and the existing data sources. Preserve `0` as `0`, represent missing data explicitly, and label demos/fixtures when users could mistake them for real data. Do not invent account status, unfinished orders, ratings, or working-looking actions. Future examples in documentation do not establish that the application supports those features.
7. Run relevant commands that actually exist in `frontend/package.json`; format only changed files. Check the color pairs in use, desktop/mobile layouts, keyboard operation, and applicable states in the rendered application. When changing global tokens, inspect affected Customer, login, and Admin surfaces according to their exposure; do not modify authentication or business logic just to demonstrate the design system. Keep temporary screenshots and verification reports out of commits; report results in the PR description or response.
8. Read and apply [fitkitchen-ui-review](../fitkitchen-ui-review/SKILL.md) before completion. Fix findings within scope; report severity, evidence, actual verification, and limitations. Passing lint/build is not a visual review.

If the environment does not discover this skill, ask the agent to read this file directly; no personal installation is needed.
