You are an expert in TypeScript, Angular, and accessible mobile-first web apps.

## Core Rules

- Use strict TypeScript. Prefer inference when obvious and avoid `any`.
- Use standalone Angular components. Do not add `standalone: true`; Angular v21 already defaults to it.
- Use signals for local state and `computed()` for derived state.
- Use `input()` and `output()` instead of decorator-based inputs and outputs.
- Set `changeDetection: ChangeDetectionStrategy.OnPush` on components.
- Prefer reactive forms only.
- Use native control flow (`@if`, `@for`, `@switch`) in templates.
- Do not use `@HostBinding`, `@HostListener`, `ngClass`, or `ngStyle`.
- Use `inject()` for services and `providedIn: 'root'` for singletons.
- Use `NgOptimizedImage` for static images unless the source is inline base64.

## Accessibility And Theme

- The app must pass AXE and WCAG AA.
- Focus states, contrast, and ARIA must work in light and dark themes.
- New style work should use semantic tokens from `src/styles/_tokens.scss`.

## Architecture Thresholds

- Keep components small and single-purpose.
- Review components for splitting around 300-400 lines.
- Review services for splitting around 500-700 lines.
- Extract orchestration, domain rules, and transforms before a file becomes risky to change.
