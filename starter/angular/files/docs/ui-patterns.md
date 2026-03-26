# UI Patterns

## Canonical tokens

- Surfaces: `--surface-page`, `--surface-shell`, `--surface-panel`, `--surface-panel-strong`, `--surface-muted`
- Text: `--text-primary`, `--text-secondary`, `--text-muted`, `--text-on-accent`
- Border: `--border-subtle`, `--border-default`, `--border-strong`
- Accent: `--accent`, `--accent-strong`, `--accent-muted`
- Feedback: `--success`, `--warning`, `--error`, `--error-muted`, `--error-text`
- Layout: `--space-1` to `--space-6`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-pill`, `--touch-target`, `--touch-target-compact`, `--shadow-soft`

## Surface patterns

- Page backgrounds should use `--surface-page`.
- Cards and sheets should use `--surface-panel` with `--border-default` and `--shadow-soft`.
- Stronger callout containers should use `--surface-panel-strong`.

## Buttons and actions

- Primary actions use `--accent` with `--text-on-accent`.
- Secondary and ghost actions use borders, muted surfaces, or text emphasis rather than extra accent fills.
- Keep tap targets at or above `--touch-target`, with compact variants never below `--touch-target-compact`.

## Inputs and forms

- Use one visual field model across screens.
- Keep numeric entry and quick-log flows compact and thumb-friendly.
- Reserve red-led treatments for semantic errors only.

## Sheets and overlays

- Bottom sheets should use `--surface-panel` or `--surface-panel-strong`, a clear drag affordance, and visible focus handling.
- Sheet actions should emphasize the primary decision without flooding the footer with competing accents.

## Charts and states

- Charts should favor immediate readability over decorative detail.
- Loading, empty, and error states should reuse the same spacing, border, and tone system as the rest of the UI.

## Spacing and motion

- Use the spacing scale instead of screen-specific magic numbers whenever practical.
- Motion should be subtle, stateful, and respect reduced-motion preferences.
