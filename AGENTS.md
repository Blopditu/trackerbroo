
You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.
- Do not write arrow functions in templates (they are not supported).

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

## Design Context

### Users
Tracker Broo is primarily for a small friend group of around seven people who already motivate each other through a WhatsApp gym and protein-tracking habit. They use the app in the context of everyday life, often on mobile, to quickly log food, track gym consistency, and check simple progress graphs without friction.

The core job to be done is to provide a free, all-in-one tracker that is easier and faster to use than juggling chat groups and multiple apps. The experience should help users stay consistent with gym attendance and protein intake, then quickly review progress over time.

### Brand Personality
The brand personality is intuitive, quick, and consistency-driven. The voice should feel direct, calm, and supportive rather than loud or pushy.

Emotionally, the interface should primarily evoke confidence and calm. The product should reinforce the motto "consistency is key" by making regular tracking feel easy, reliable, and sustainable.

### Aesthetic Direction
The design direction should support both light mode and dark mode. Visually, it should prioritize fast logging, clear information hierarchy, and readable graphs.

MacroFactor is the main reference for interaction quality, specifically its quick log flow and graph clarity. The app should explicitly avoid looking overly gamified, overly competitive, or excessively playful. Red should generally be avoided as a dominant brand color or key UI accent unless there is a functional error-state reason to use it.

### Design Principles
- Optimize for speed first. Core tracking actions should be available with minimal steps, minimal cognitive load, and strong mobile ergonomics.
- Design for consistency, not intensity. Encourage repeat use through clarity and calm feedback rather than streak pressure, competition, or game-like reward systems.
- Keep graphs and summaries immediately legible. Progress views should surface trends quickly without visual noise or decorative complexity.
- Preserve a friendly group feel without turning the product into a social game. Community elements should support accountability and shared progress, not competition.
- Support a polished dual-theme system. New UI should work cleanly in both light and dark themes and avoid red-led palettes unless semantically necessary.
