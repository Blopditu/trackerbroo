# Design System Strategy: The High-Contrast Monolith

## 1. Overview & Creative North Star

The North Star for this design system is **"The Stoic Coach."**

Unlike traditional fitness apps that rely on dopamine-driven gamification, neon explosions, and chaotic progress bars, this system is rooted in **functional quietude.** It draws inspiration from high-end horology and editorial layout design: high-contrast, mathematically precise, and breathable. We break the "template" look by eschewing standard borders in favor of **Tonal Sculpting**—using varying levels of surface depth to create an interface that feels carved out of a single, solid material rather than assembled from parts.

The aesthetic goal is "MacroFactor Editorial"—a high-utility tool that feels like a premium physical object.

---

## 2. Colors & Surface Architecture

The palette is built on a "Deep Carbon" foundation with a "Bio-Electric" accent (`primary: #00e475`).

### The "No-Line" Rule

**Standard 1px borders are strictly prohibited.** To define sections, use background color shifts.

- **Surface-to-Surface Transitions:** Use `surface_container_low` for the page background and `surface_container_high` for primary cards.
- **Implicit Boundaries:** Content blocks are separated by `spacing-6` or `spacing-8` vertical voids rather than horizontal rules.

### Surface Hierarchy & Nesting

Treat the UI as a physical stack. The deeper the information, the "higher" the surface:

1.  **Base Layer:** `surface` (#0e0e0e) - The infinite void.
2.  **Section Layer:** `surface_container_low` (#131313) - Large structural groupings.
3.  **Component Layer:** `surface_container_high` (#1f2020) - The primary interaction cards.
4.  **Floating/Active Layer:** `surface_bright` (#2b2c2c) - Overlays and active states.

### The Glass & Gradient Rule

For elements that need to feel "alive" (like a current workout timer), use **Glassmorphism**:

- Background: `surface_container_highest` at 70% opacity.
- Backdrop Blur: 20px.
- **Signature Texture:** Apply a subtle linear gradient to CTAs using `primary` to `primary_container`. This prevents the "flat-and-cheap" look of solid hex fills.

---

## 3. Typography: Editorial Authority

We use **Manrope** for its technical precision and modern geometry.

- **Display (Scale: 2.25rem - 3.5rem):** Used for single, high-impact data points (e.g., total weight lifted). Use `tight` letter-spacing (-0.02em).
- **Headline (Scale: 1.5rem - 2rem):** Used for page titles. These should feel like newspaper headers—direct and unmissable.
- **Body (Scale: 0.875rem - 1rem):** High-readability weight. Ensure `on_surface_variant` is used for secondary data to maintain a clear hierarchy against `on_surface` primary text.
- **Label (Scale: 0.6875rem - 0.75rem):** Always uppercase with `+0.05em` letter-spacing. Labels are functional signposts, not just small text.

---

## 4. Elevation & Depth

Depth is achieved through **Tonal Layering**, not structural scaffolding.

- **The Layering Principle:** A "Daily Habit" card should be `surface_container_highest` sitting on a `surface_dim` background. This provides a soft, sophisticated lift.
- **Ambient Shadows:** For floating action buttons (FABs) or modals, use an extra-diffused shadow: `box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4)`. Avoid pure black shadows; let them feel like a natural occlusion of light.
- **The "Ghost Border" Fallback:** If a layout requires a boundary for accessibility (e.g., input fields), use `outline_variant` at **15% opacity**. It should be felt, not seen.

---

## 5. Signature Components

### Buttons

- **Primary:** `primary` background with `on_primary` text. Use `rounded-lg` (1rem). Apply a subtle inner glow (top-down) for a tactile feel.
- **Secondary:** `surface_container_highest` background. No border.
- **Tertiary:** Ghost style. `on_surface` text with no container. Use for low-priority actions like "Cancel" or "Edit."

### Cards & Progress Tracking

- **The "No-Divider" Card:** Group related data (e.g., Set 1, Set 2, Set 3) within a single `surface_container_high` card. Use `spacing-4` to separate rows. Never use a line to separate list items.
- **Micro-Progress Bars:** Instead of heavy bars, use a 2px `primary` line at the very bottom of a card or a `surface_tint` circular ring for habit completion.

### Input Fields

- **The Minimalist Input:** A solid block of `surface_container_highest` with a `rounded-md` (0.75rem) corner. The label sits _above_ the field in `label-sm` uppercase. The cursor should always be the `primary` color.

### Data Visualization (Fitness Context)

- **Trend Sparklines:** Use a `primary_dim` stroke. Avoid fills under the line to keep the interface clean and breathable.

---

## 6. Do's and Don'ts

### Do

- **Do** use extreme white space. If a screen feels "empty," it’s working.
- **Do** use `primary_fixed` for inactive but completed states to provide a sense of "dimmed success."
- **Do** ensure all touch targets are at least 48px, even if the visual element (like a small icon) is smaller.

### Don't

- **Don't** use Red for errors. Use `error` (#ee7d77) which is a sophisticated coral, maintaining the "calm" vibe while signaling caution.
- **Don't** use icons with varying stroke weights. Stick to a 2px consistent stroke to match Manrope’s geometry.
- **Don't** use cards-on-cards. If you need a sub-section, use a background color shift (e.g., a `surface_container_lowest` inset within a `surface_container_high` card).
- **Don't** use standard "drop shadows" on every element. Let the color tokens handle the depth. Only the highest-level floating elements deserve a shadow.
