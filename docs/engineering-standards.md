# Engineering Standards

## Core posture

- Components are UI boundaries, not the architecture.
- Keep decisions local until complexity proves otherwise.
- Optimize for maintainability, fast mobile flows, and low-context refactors.

## Angular application rules

- Use feature-first folders under `src/app/features`.
- Default to standalone components and lazy-loaded feature routes.
- Use signals for local state and `computed()` for derived state.
- Use `input()` and `output()` instead of decorator-based inputs and outputs.
- Use `ChangeDetectionStrategy.OnPush` on components.
- Prefer reactive forms only.
- Keep templates declarative and use native control flow.
- Do not use `@HostBinding`, `@HostListener`, `ngClass`, or `ngStyle`.

## Architecture rules

- Components should be explainable in one sentence.
- Move orchestration, domain rules, and multi-source composition out of leaf UI components.
- Facades are recommended for complex features with multiple data sources, workflows, or derived state.
- Do not force a facade into simple screens that only render one service result and local UI state.
- Split service responsibilities between:
  - data access
  - orchestration/facade state
  - pure transforms/helpers

## Styling and tokens

- New style work must use the semantic token layer from `src/styles/_tokens.scss`.
- Existing `--ui-*`, `--shell-*`, `--md-sys-*`, and `--m3-sys-*` variables are compatibility aliases during migration.
- Refactor by boundary: tokens first, then shared primitives, then feature shells, then leaf components.
- Do not introduce new Material-specific design conventions in feature work.

## Accessibility and themes

- Every feature must pass AXE and WCAG AA.
- Focus states must remain visible in both light and dark themes.
- New UI must work in both themes and avoid red as a dominant accent outside error states.

## Size thresholds

- Review components for splitting once they exceed roughly 300-400 lines.
- Review services for splitting once they exceed roughly 500-700 lines.
- Split earlier when a file becomes hard to explain, hard to test, or risky to change.

## Phase 2 refactor backlog

- `today.component.ts`: split route orchestration from logging sections, summary widgets, and sheet-driven leaf UI.
- `profile.component.ts`: separate profile forms, personalization, and trend/history presentation.
- `gym-facade.service.ts`: separate orchestration state from progress/detail filtering and pure calculations.
- `training-data.service.ts`: separate data access/caching from normalization and domain transforms.
