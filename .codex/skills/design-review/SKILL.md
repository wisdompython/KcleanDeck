---
name: design-review
description: Audit, redesign, or polish Kleandeck public-site and admin interfaces when a task calls for stronger visual hierarchy, usability, responsive behavior, accessibility, or production-ready UI implementation. Do not use for backend-only work.
---

# Design Review

Work as a product designer who can implement the recommendation, not as a stylist applying isolated decoration.

## Establish the brief

- Respect the user's requested scope. For an audit-only request, report prioritized findings without editing files. For an implementation request, carry the work through verification.
- Identify the page, user, primary task, and success signal from the request and repository. If the brief is broad, improve the smallest coherent journey with the highest user impact instead of redesigning the whole product.
- Read the applicable `AGENTS.md`, the affected components and states, `frontend/app/globals.css`, and `frontend/components/ui.ts` or `frontend/components/admin/ui.tsx` as relevant.
- Treat `pristine_corporate_precision/DESIGN.md` as the source of truth for Kleandeck's brand language. Extend its tokens and patterns rather than inventing a competing visual system.

## Inspect before deciding

- When a runnable interface is available, inspect the real page at representative phone, tablet, and desktop widths. Exercise the main interaction and important loading, empty, error, validation, success, hover, focus, disabled, and long-content states that the task touches.
- Separate observed problems from preferences. Prioritize task completion, information hierarchy, clarity, responsive behavior, and accessibility before ornamental polish.
- Preserve working behavior, data flow, permissions, and API contracts unless the user explicitly includes them in scope.

## Design direction

- Keep the established character: corporate authority, pristine whitespace, cool surfaces, deep oceanic navy, restrained emerald conversion accents, and cyan interaction cues.
- Reuse the existing Plus Jakarta Sans and Inter typography, color tokens, spacing rhythm, elevation, rounded geometry, buttons, fields, panels, cards, and status patterns.
- Use emerald for conversion or positive action, navy for structural authority, cyan for interaction or focus, amber for caution, and red only for errors or destructive actions. Keep WhatsApp green specific to WhatsApp actions.
- Favor clear grouping, deliberate alignment, strong primary actions, concise copy, and comfortable touch targets. Public pages may be expressive and spacious; admin screens should remain denser, calm, and operationally efficient.
- Avoid generic dashboard styling, excessive gradients, gratuitous animation, decorative icons without meaning, and one-off colors or arbitrary Tailwind values when an existing token expresses the intent.
- Do not introduce a component library, font, or new design dependency without user approval.

## Implement coherently

- Reuse existing components first. When a pattern repeats, improve or extract the shared primitive rather than copying variants across pages.
- Maintain semantic HTML, visible keyboard focus, sufficient contrast, useful labels and error associations, logical tab order, and reduced-motion behavior.
- Design mobile layouts intentionally; do not merely compress desktop UI. Prevent horizontal overflow and keep the primary action and critical context easy to reach.
- Keep transitions subtle and purposeful. Preserve the repository's existing motion system and `prefers-reduced-motion` handling.
- Use real product copy and realistic content lengths. Do not replace functional content with placeholder text to make a composition fit.

## Verify the result

- Reinspect the rendered result at phone, tablet, and desktop widths when possible, including keyboard navigation and the states affected by the change.
- Run the narrowest relevant checks, with `npm run lint` from `frontend` as the baseline for code changes. Run a production build or relevant Playwright coverage when the scope or risk warrants it.
- Fix regressions introduced by the work. If runtime, backend data, or credentials prevent visual verification, state that limitation precisely instead of claiming the page was visually checked.
- In the handoff, summarize the user-facing improvements, files changed, checks performed, and any remaining design risks.
