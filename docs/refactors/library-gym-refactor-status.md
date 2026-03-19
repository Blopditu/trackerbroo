# Library and Gym Refactor Status

## Current architecture
- `library` has a route shell, facade, tab components, editors, and split cache loaders.
- `gym` has a route shell, facade, extracted child components, and targeted specs.

## Completed
- Library slice loading exists in `LibraryDataService` via `loadIngredients()`, `loadMeals()`, and compatibility `loadLibrary()`.
- Library UI is split into route shell, ingredients tab, meals tab, ingredient editor, meal editor, and action sheet.
- Library shell now uses external template/style files.
- Library facade now delegates macro parsing, form construction, optimistic patching, and cache-sync work to focused helper modules.
- Library feature now has targeted specs for the data service, facade, ingredient editor, and meals tab.
- Gym UI is already split into route shell plus focused child components.
- Gym shell now uses external template/style files.
- Gym facade now delegates builder-state, session-state, share-copy, tracker selection, and progress-boundary helpers to focused modules.

## In progress
- Further reduce gym facade size by extracting more async loader orchestration only if needed.

## Current slice
- Feature: `gym`
- Files in scope:
  - `src/app/features/gym/gym.component.*`
  - `src/app/features/gym/gym-facade.service.ts`
  - `src/app/features/gym/gym-*.ts`
  - existing gym specs

## Next exact slice
1. Keep gym loader orchestration in the facade unless a concrete render or maintenance issue remains.
2. Add more gym-only helper specs if later extractions touch behavior.
3. Continue future refactor turns with a 2-4 file maximum plus this status doc.

## Verification
- `npx tsc -p tsconfig.app.json --noEmit`
- `npx tsc -p tsconfig.spec.json --noEmit`
- targeted library specs
- `npm test -- --watch=false` after the library milestone and after the gym milestone
