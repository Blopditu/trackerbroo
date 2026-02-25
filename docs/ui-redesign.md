# UI Audit + Redesign Plan

## Current UI issues found
- Inconsistent visual language: mixed card depths, border weights, and button styles.
- Multiple style intents across screens (different emphasis patterns and spacing cadence).
- Light-heavy palette while product requires dark-first behavior.
- Repeated per-screen color constants instead of shared design tokens.
- Feedback patterns were inconsistent (alerts/messages rendered differently by screen).
- Navigation hierarchy was crowded and not uniformly thumb-first.

## Standardization goals
- Dark-first visual system with one accent color and restrained contrast.
- Single font family across all surfaces and components.
- Tokenized spacing, radius, typography, borders, and semantic colors.
- Shared primitives across screens:
  - Card/panel
  - Button (`primary`, `secondary`, `ghost`)
  - Inputs/select/textarea
  - Segmented control
  - Toast (`error`/`success`)
  - Skeleton
  - Empty state
- Mobile-first interaction at 360-430px with 44px minimum tap targets.

## Token system
- Colors:
  - `--bg-page`, `--bg-shell`, `--bg-surface-1`, `--bg-surface-2`
  - `--ink-900`, `--ink-700`, `--ink-500`
  - `--accent-500`, `--accent-soft`
  - `--success-500`, `--danger-500`
- Spacing: `--space-1` to `--space-6`
- Radius: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-pill`
- Type: `--text-xs`, `--text-sm`, `--text-md`, `--text-lg`, `--text-xl`
- Elevation: subtle single shadow token (`--shadow-soft`)

## Component rules
- No gradients for base UI.
- No icon dependency added; text labels prioritized.
- Use borders + muted surfaces for structure, not heavy glow/shadow.
- Compact information density for logging workflows.
- Pixel/shounen accents limited to Today and Community only.

## Step plan
1. Tokens + base dark primitives
2. Shell: top bar + bottom nav
3. Today
4. Library
5. Stats
6. Community
7. Profile

## Manual QA checklist

### Shell
- Mobile layout (360/390/430 widths)
- Top bar group selector and manage action usable with thumb
- Bottom nav labels visible and active state clear
- Focus ring visible via keyboard navigation
- No clipping with safe-area insets

### Today
- Macro header readability in dark mode
- Quick add sheet workflow in <=3 taps after search
- Empty/loading/error visual consistency
- Delete affordance works and is clearly destructive
- Inputs usable from keyboard on mobile

### Library
- Segmented switch works with visible active state
- Ingredient search + market filter usable on small width
- Form readability with compact numeric entry
- Meal builder rows stay legible and tappable
- Empty/loading/error states consistent

### Stats
- 7-bar chart remains legible on 360px
- Summary cards stay compact without overlap
- Empty/loading/error states consistent

### Community
- Composer fields usable one-handed
- Feed cards hierarchy clear (author/date/note/photo)
- Leaderboard 7/14/30 toggle readable and operable
- Empty/loading/error states consistent

### Profile
- Header, avatar UI, and form grouping readable on small screens
- Weight quick add + trend sparkline visible without zoom
- Empty/loading/error states consistent
- Keyboard focus states visible for all form controls
