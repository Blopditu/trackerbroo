# UI Audit: MacroFactor Pattern-Level Benchmark (M3-Aligned)

Basis: heuristic + implementation-informed review of current app shell and feature screens (`today`, `library`, `gym`, `community`, `profile`), including shared bottom-sheet/navigation patterns.

## Section 1: Fixed Rubric And Scoring

Scoring scale per category: `0 = poor`, `1 = weak`, `2 = acceptable`, `3 = excellent`.

Weighted categories:

- `Speed to Primary Action` 25%
- `Input Friction` 15%
- `Information Hierarchy` 15%
- `Graph Readability` 10%
- `Navigation Predictability` 10%
- `State/Feedback Clarity` 10%
- `Keyboard/Viewport Resilience` 10%
- `M3 Motion/Touch Feel` 5%
- `Accessibility Baseline` tracked as pass/fail gate (non-weighted)

Pass/fail threshold per category: `Pass` if score `>=2`, else `Fail`.

| Surface                    | Weighted Score (/100) | Accessibility Baseline |
| -------------------------- | --------------------: | ---------------------- |
| App shell + nav/top bar    |                  66.7 | Pass                   |
| Today dashboard            |                  75.0 | Pass                   |
| Today food logging sheet   |                  63.3 | Pass                   |
| Today weight logging sheet |                  75.0 | Pass                   |
| Library                    |                  50.0 | Fail                   |
| Gym                        |                  65.0 | Fail                   |
| Community                  |                  55.0 | Fail                   |
| Profile                    |                  53.3 | Fail                   |

## Section 2: Screen-By-Screen Checklist

### 1) App shell + bottom nav/top bar

Checklist pass/fail:

- `Speed Pass`
- `Input Pass`
- `Hierarchy Pass`
- `Graph Pass`
- `Navigation Pass`
- `State Pass`
- `Keyboard Pass`
- `M3 Pass`
- `A11y Pass`

Current friction points (severity-ranked):

1. `High` No universal "quick capture" action accessible from every screen context.
2. `High` Route semantics are inconsistent for user mental model (`dashboard/group` redirect behavior).
3. `Medium` Bottom nav treats all actions equally; no explicit high-priority shortcut.
4. `Medium` Keyboard-open nav/fab suppression is functional but abrupt in perceived continuity.
5. `Low` Install banner can compete with task focus on compact layout.

Concrete simplifications:

1. Add a global center `Quick Log` affordance in shell nav. Expected gain: fewer screen switches for daily logging.
2. Align route naming with visible IA labels. Expected gain: lower navigation confusion.
3. Add context subtitle in top bar by route. Expected gain: better orientation after deep links.
4. Smooth hide/show transitions for nav when keyboard opens. Expected gain: less visual jank.

MacroFactor pattern mapping: `Partial`  
Reason: strong persistent nav baseline exists, but lacks a true cross-app quick-capture shortcut.

### 2) Today dashboard

Checklist pass/fail:

- `Speed Pass`
- `Input Pass`
- `Hierarchy Pass`
- `Graph Pass`
- `Navigation Pass`
- `State Pass`
- `Keyboard Pass`
- `M3 Pass`
- `A11y Pass`

Current friction points:

1. `High` The top experience is still information-dense before core logging tasks.
2. `Medium` Entry list can be pushed below fold by secondary panels.
3. `Medium` Common entry actions are hidden behind `Mehr`.
4. `Medium` Weight sparkline lacks quick timeframe context and explicit comparative labels.

Concrete simplifications:

1. Add top `Daily Quick Strip` (remaining kcal/protein + `Log Food` + `Log Weight`). Expected gain: faster first action.
2. Move `today entries` above habit/trend sections. Expected gain: reduced scroll for daily review.
3. Add direct swipe/inline entry actions for edit/delete/copy. Expected gain: fewer taps.
4. Expand trend card with `7/30` toggle and clear delta label. Expected gain: faster interpretation.

MacroFactor pattern mapping: `Partial`  
Reason: good actionability and visual hierarchy base, but not yet optimized for "first 5-second decision."

### 3) Today food logging sheet

Checklist pass/fail:

- `Speed Pass`
- `Input Pass`
- `Hierarchy Pass`
- `Graph Fail`
- `Navigation Pass`
- `State Pass`
- `Keyboard Pass`
- `M3 Pass`
- `A11y Pass`

Current friction points:

1. `High` Day planning, search, slot, queue, and confirmation still coexist in one crowded flow.
2. `High` Single-item logging still tends toward multi-step queue behavior.
3. `Medium` Default discovery still costs choices vs strongly prioritized recents/favorites.
4. `Medium` Copy-day controls are prominent even when user intent is quick search-and-log.
5. `Medium` Macro text in result rows has lower scan efficiency than chip-based key values.

Concrete simplifications:

1. Add true `Instant Log` path from result row (last-used amount/slot) with optional expand-to-edit. Expected gain: food log <=15s.
2. Default list to hybrid `Recent + Favorites`, keep `All` as secondary. Expected gain: lower search effort.
3. Collapse day-copy controls behind `Plan day` expander. Expected gain: reduced visual noise.
4. Convert macros to compact chips (`kcal`, `P`, `C`, `F`). Expected gain: faster scan.
5. Keep sticky action as explicit primary (`Log now`) with undo snack. Expected gain: confidence + reversibility.

MacroFactor pattern mapping: `Partial`  
Reason: close to quick-log intent, but still not a one-decision, one-primary-action flow.

### 4) Today weight logging sheet

Checklist pass/fail:

- `Speed Pass`
- `Input Pass`
- `Hierarchy Pass`
- `Graph Fail`
- `Navigation Pass`
- `State Pass`
- `Keyboard Pass`
- `M3 Pass`
- `A11y Pass`

Current friction points:

1. `Medium` Weight input is still modal-first, not fully inline-first on Today.
2. `Medium` No quick increment controls around recent value.
3. `Low` Date input is exposed for every case though most logs are `today`.
4. `Low` Post-save feedback is mostly toast-level, not strongly visual in trend context.

Concrete simplifications:

1. Add inline weight quick logger on Today hero. Expected gain: weight log <=10s.
2. Add `+0.1 / -0.1` controls with last value prefill. Expected gain: fewer keystrokes.
3. Hide date by default, reveal via `change date`. Expected gain: simpler default.
4. Animate trend card update after save. Expected gain: immediate outcome clarity.

MacroFactor pattern mapping: `Partial`  
Reason: basic speed is okay; lacks strongest frictionless weigh-in micro-flow.

### 5) Library

Checklist pass/fail:

- `Speed Fail`
- `Input Fail`
- `Hierarchy Pass`
- `Graph Fail`
- `Navigation Pass`
- `State Pass`
- `Keyboard Pass`
- `M3 Pass`
- `A11y Fail`

Current friction points:

1. `Critical` Ingredient creation/edit forms are too long for common tasks.
2. `High` High-field forms mix basic and advanced concerns in one surface.
3. `High` Common actions are behind `Mehr` instead of direct row affordances.
4. `Medium` No direct `log this now` action from list items.
5. `Medium` Tab switching interrupts creation momentum (ingredients vs meals).

Concrete simplifications:

1. Split forms into `Basic` and `Advanced` sections (collapsed advanced). Expected gain: faster item creation.
2. Add quick-create bottom sheet (`name + macros` only). Expected gain: rapid capture.
3. Add direct row actions (`Edit`, `Log Today`, `Favorite`). Expected gain: fewer taps.
4. Add meal templates with defaults. Expected gain: faster meal authoring.
5. Keep parser/import as first-class quick entry path. Expected gain: reduced manual typing.

MacroFactor pattern mapping: `Gap`  
Reason: supports power use but lacks streamlined day-to-day fast entry behavior.

### 6) Gym

Checklist pass/fail:

- `Speed Pass`
- `Input Fail`
- `Hierarchy Pass`
- `Graph Pass`
- `Navigation Pass`
- `State Pass`
- `Keyboard Pass`
- `M3 Pass`
- `A11y Fail`

Current friction points:

1. `High` Too many bottom-sheet modes create context switching overhead.
2. `High` Duplicate start affordances (`Schnellstart` vs `Start`) split intent.
3. `Medium` Tracker view has high cognitive load before action.
4. `Medium` Progress insights are not centralized enough for quick review.

Concrete simplifications:

1. Consolidate sheet modes into one `Session Hub` with sub-tabs. Expected gain: lower mode confusion.
2. Keep one canonical start CTA per day/session context. Expected gain: clearer action.
3. Reduce pre-session card density to essentials. Expected gain: quicker workout start.
4. Add dedicated progress landing with key 30-day tiles. Expected gain: faster graph checks.
5. Persist `resume active session` globally. Expected gain: interruption recovery.

MacroFactor pattern mapping: `Partial`  
Reason: strong capability depth, but too much mode complexity for quick daily usage.

### 7) Community

Checklist pass/fail:

- `Speed Fail`
- `Input Pass`
- `Hierarchy Pass`
- `Graph Fail`
- `Navigation Pass`
- `State Pass`
- `Keyboard Pass`
- `M3 Pass`
- `A11y Fail`

Current friction points:

1. `High` Feed cards are dense with multiple text layers.
2. `High` Inline comment composer expansion causes layout instability.
3. `Medium` No top-level quick filters by post type.
4. `Medium` Creation path relies heavily on FAB discovery.

Concrete simplifications:

1. Add segmented filters (`All`, `Gym`, `Protein`, `Following`). Expected gain: faster content targeting.
2. Move comment composer to sheet/modal anchored to post. Expected gain: feed stability.
3. Collapse secondary post text with `show more`. Expected gain: scan speed.
4. Add quick post chips at top. Expected gain: lower posting friction.
5. Reduce card metadata clutter to one summary line. Expected gain: readability.

MacroFactor pattern mapping: `Gap`  
Reason: current feed is social-first but not optimized for low-friction daily utility.

### 8) Profile

Checklist pass/fail:

- `Speed Fail`
- `Input Fail`
- `Hierarchy Pass`
- `Graph Pass`
- `Navigation Pass`
- `State Pass`
- `Keyboard Pass`
- `M3 Pass`
- `A11y Fail`

Current friction points:

1. `High` Single long page mixes account, goals, appearance, weight history, and danger actions.
2. `High` Too many fields for frequent-use workflows.
3. `Medium` Theme settings in the core profile form increase cognitive load.
4. `Medium` Weight history is browse-heavy and action-light.

Concrete simplifications:

1. Split into sections/tabs (`Account`, `Goals`, `Weight`, `Appearance`). Expected gain: clearer mental model.
2. Promote compact weight logger at top of Weight section. Expected gain: faster repeat use.
3. Move appearance customization behind dedicated subsection. Expected gain: reduced clutter.
4. Add inline edit/delete for recent weight entries. Expected gain: easier correction workflow.
5. Isolate danger actions into separate confirmation flow. Expected gain: safer interaction.

MacroFactor pattern mapping: `Gap`  
Reason: functionally rich but not tuned for shortest-path repeat actions.

## Section 3: Whole-App Simplification Evaluation

### Journey analysis

| Journey                       | Current State                                                    | Main Friction                                  | Simplification Target                                                            |
| ----------------------------- | ---------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| Log food quickly              | Multi-control food sheet with queue-centric pattern              | Too many concurrent decisions                  | Search-first + instant log default path in <=15s                                 |
| Log weight quickly            | Split between Today sheet and Profile form                       | Not always first-class on primary daily screen | Inline quick weight on Today in <=10s                                            |
| Check progress/graphs quickly | Graphs spread across Today/Gym/Profile with varying depth        | No single insights-first pattern               | Unified trend card model (primary metric + delta + 7/30 toggle)                  |
| Recover from interruption     | Keyboard and sheet behavior improved but flow stacks still dense | Mode switches and context loss                 | Unified sheet contract + resume states + one canonical primary action per screen |

### Cross-screen anti-pattern inventory

1. Duplicated controls for similar actions across surfaces without shared interaction contract.
2. Inconsistent primary CTA placement and prominence by screen.
3. Excessive mode switching through multiple sheet states and nested subflows.
4. Dense, low-value secondary information competing with immediate actions.
5. Uneven graph patterns (small sparklines, hidden drilldowns, inconsistent labels/timeframes).
6. Incomplete simplification of default paths for repeated daily tasks.

### Global simplification principles to enforce

1. One primary action per screen in thumb reach at all times.
2. Fastest repeat path as default; advanced controls behind progressive disclosure.
3. Search-first and recents-first for all logging workflows.
4. Single interaction contract for bottom sheets (open, drag-dismiss, keyboard-safe CTA visibility).
5. Graph pattern consistency: headline metric, delta, time toggle, tap for detail.
6. Explicit interruption recovery (`resume`, `undo`, `state persistence`).
7. Accessibility as gate: contrast, focus order, target sizes, screen-reader labels, AXE clean.

## Section 4: Priority Roadmap (Impact/Effort/Dependency Ordered)

### Wave 1: Quick wins (high impact, low effort)

| Item                                                           | Target              | Impact | Effort | Dependency                 | Acceptance check                                            |
| -------------------------------------------------------------- | ------------------- | ------ | ------ | -------------------------- | ----------------------------------------------------------- |
| Add global quick-capture entrypoint in shell nav               | App shell           | High   | M      | shared nav + sheet         | Open log flow from any screen in 1 tap                      |
| Set default food discovery to `Recent + Favorites`             | Today food sheet    | High   | S      | today food state           | 80% of common logs done without switching filter            |
| Add instant single-item log from search row                    | Today food sheet    | High   | M      | log API reuse + undo toast | Single-item log path <=15s                                  |
| Standardize primary CTA style/placement across feature screens | Shell + all screens | Medium | S      | design tokens              | Primary action discoverability consistent in usability pass |
| Add clear 7/30 toggle + delta labels on trend cards            | Today/Profile/Gym   | Medium | S      | chart card components      | Graph comprehension <=5s in spot checks                     |

### Wave 2: Structural flow simplifications

| Item                                                                      | Target           | Impact | Effort | Dependency                  | Acceptance check                              |
| ------------------------------------------------------------------------- | ---------------- | ------ | ------ | --------------------------- | --------------------------------------------- |
| Re-architect food logging into staged flow (`Search`, `Queue`, `Confirm`) | Today food sheet | High   | L      | Wave 1 instant-log baseline | Reduced control clutter and lower abandonment |
| Introduce inline Today weight logger with quick increments                | Today dashboard  | High   | M      | trend update hooks          | Weight log <=10s median                       |
| Split Profile into task-focused sections                                  | Profile          | High   | M      | routing/state split         | Users reach weight task with <=2 interactions |
| Add direct `Log Today` actions from Library rows                          | Library          | High   | M      | shared log action contract  | Library-to-log path <=2 taps                  |
| Consolidate gym sheet modes into one session hub                          | Gym              | Medium | L      | gym state machine refactor  | Fewer mode transitions per workout start      |

### Wave 3: Polish + advanced graph UX

| Item                                                                | Target            | Impact | Effort | Dependency                   | Acceptance check                               |
| ------------------------------------------------------------------- | ----------------- | ------ | ------ | ---------------------------- | ---------------------------------------------- |
| Build unified insights surface for nutrition/weight/training trends | Cross-feature     | High   | L      | Wave 2 trend standardization | Cross-domain progress view in one place        |
| Add advanced drill-down chart interactions                          | Gym/Today/Profile | Medium | M      | unified chart model          | Users can inspect outliers and ranges quickly  |
| Accessibility hardening and AXE gating in CI                        | App-wide          | High   | M      | test harness updates         | AXE critical/serious violations = 0            |
| Add interaction telemetry for key journeys                          | App-wide          | Medium | M      | analytics events             | Track and improve food/weight/graph task times |

## Public APIs / Interfaces / Types

None changed in this phase (audit-only output).  
Future implementation should group changes by `shared shell`, `bottom-sheet interaction contract`, and feature flows.

## Test Cases And Scenarios (Audit Acceptance)

1. Food logging quick path: recent/favorite item logged in `<=15s`.
2. Weight logging quick path: from primary daily surface in `<=10s`.
3. Graph comprehension: key number + trend + delta understood in `<=5s`.
4. Keyboard resilience: no keyboard-covered primary action on compact mobile.
5. Reachability: primary actions one-thumb reachable on compact layout.
6. Per-surface audit completeness: each major surface has at least 3 actionable simplifications and explicit pre/post success criteria.
7. Severity discipline: each surface includes at least one `Critical`/`High` finding when justified, else explicit no major finding.

## Assumptions And Defaults Used

1. Scope includes all main screens and shared shell patterns; excludes onboarding/login.
2. Benchmark target is MacroFactor interaction principles, not visual cloning.
3. Deliverable is chat-only.
4. Compact mobile is the primary UX target; medium/expanded reviewed for major divergence only.
5. Evaluation is heuristic and implementation-informed, without live study data in this phase.
