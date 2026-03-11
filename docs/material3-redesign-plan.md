# Material 3 Redesign Plan

## Goal
Redesign the app to align closely with Material 3 (M3) foundations and interaction philosophy:
- clear hierarchy
- predictable navigation
- consistent component behavior
- dynamic color personalization per user
- accessibility-first defaults

## Foundation Decisions

### 1) Color (M3 Dynamic Color)
- Use a user-selected **seed color** (`theme_seed_color`) from profile.
- Generate dark theme roles from the seed using Material color utilities (`SchemeTonalSpot`).
- Apply generated roles as global CSS variables (`--m3-sys-color-*`).
- Keep default seed as a cool blue: `#4c8dff`.

### 2) Typography
- Keep existing type family initially for rollout safety.
- Move scale and semantic text usage to M3-style hierarchy:
  - screen title (`headline`)
  - section title (`title`)
  - body copy (`body`)
  - labels (`label`)

### 3) Shape
- Increase corner radius scale to match M3 feel:
  - small 8
  - medium 12
  - large 16
  - full/pill 999

### 4) Elevation + Surfaces
- Use surface container roles (`surface-container`, `-high`, etc.) instead of arbitrary dark boxes.
- Distinguish:
  - page background
  - cards/sheets
  - emphasized containers

### 5) Motion
- Keep subtle transitions and respect reduced-motion preference.
- Use stateful feedback over decorative animation.

## UX / Layout Plan

### Phase A: App Shell and Navigation
- Top app bar: stable height, clear title container.
- Bottom navigation: M3-like active container indicator and stronger selected state.
- Global spacing and tap target rules:
  - minimum 44px controls
  - consistent section spacing

### Phase B: Shared Components
- Buttons: filled + tonal/outlined roles via shared tokens.
- Inputs/select/textarea: one visual model for all forms.
- Bottom sheet/modal: M3 shape + surface + focus behavior.
- Chips/badges/list rows: token-based colors only.

### Phase C: Feature Screens
- Today:
  - unify hero, bars, lists to tokenized color roles
  - improve scanability with section hierarchy
- Gym:
  - execution-first active session mode
  - maintain reduced-scroll flow
- Library:
  - form-heavy flow standardized with shared control visuals
- Profile:
  - add personalization section for theme seed

### Phase D: Accessibility and QA
- Validate contrast in all generated seed themes.
- Keyboard focus and visible focus ring across controls.
- AXE run per feature route.

## Component-by-Component Migration Checklist
- [x] Global token layer in `styles.scss`
- [x] App shell (`app.scss`, top bar, bottom nav)
- [x] Bottom sheet visual model
- [x] Amount picker/habit/macro/ring token migration
- [x] Profile theme seed picker + presets + persistence
- [x] Today: section hierarchy + quick actions + tokenized state colors
- [x] Gym: quick-start strip + tokenized completion/recommendation states
- [x] Community/Profile: migrated to shared `action-btn` variants and tokenized surfaces
- [x] Introduced shared reusable variants (`action-btn.tonal`, `.danger`, section head/meta utilities)
- [x] Library: final component-level harmonization pass (field density + sheet actions)

## Data / Persistence Plan
- Add `profiles.theme_seed_color` column with validation constraint.
- On app startup:
  - apply locally stored seed immediately
  - replace with profile seed after auth/profile load
- On profile save:
  - persist seed
  - apply theme instantly

## Rollout Strategy
1. Merge foundation layer and seed-color persistence.
2. Migrate shared components first (highest consistency gain).
3. Migrate route by route (Today -> Gym -> Library -> Community/Profile cleanup).
4. Add visual regression snapshots for key screens.
5. Run accessibility and performance checks before release.
