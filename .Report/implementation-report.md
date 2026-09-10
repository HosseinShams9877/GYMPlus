# GymPlus+ Program Experience Report

## What changed

- Added a dedicated full-screen, read-only coach preview for workout and nutrition cards. Workout previews show every day, exercise, set, repetition count, weight, rest period, coach note, and alternative. Nutrition previews show every meal, food, amount, calories, macros, coach note, and alternative.
- Changed card copying to happen immediately from the list. A copy is deep-cloned, appears at once with the exact ` (کپی)` suffix, remains local, and receives the «پیش‌نویس» badge without opening ProgramBuilder.
- Added equipment to the exercise-bank quick-entry flow and a bulk equipment action for all selected exercises.
- Preserved additional API fields during plan normalization and save operations, including workout weight/rest/unit/alternative and nutrition calories/macros/alternative.
- Explicitly applied Yekan Bakh to athlete workout and nutrition panels and their controls.
- Fixed athlete nutrition tracker placement: supplements are physically left and water is physically right on desktop; mobile stacks water first and supplements second.
- Replaced touched blue water-tracker accents with the application orange palette.

## Files modified

- `src/features/dashboard/components/coach/program/components/ProgramPreview.tsx` — new read-only full-screen preview.
- `src/features/dashboard/components/coach/program/components/ProgramWorkspace.tsx` — preview orchestration, API normalization, immediate cloning, and persisted clone status.
- `src/features/dashboard/components/coach/program/components/ProgramCard.tsx` — draft badge support.
- `src/features/dashboard/components/coach/program/components/ProgramBank.tsx` — bulk equipment reassignment and final exercise-bank typing cleanup.
- `src/features/dashboard/components/coach/program/components/ProgramBuilder.tsx` — removed obsolete clone helper.
- `src/features/dashboard/components/coach/program/hooks/useProgramData.ts` — expanded server shapes and save payloads.
- `src/features/dashboard/components/coach/program/program.types.ts` — set detail, weight, macro, and local card-status types.
- `src/features/dashboard/components/coach/program/program.module.css` — responsive full-viewport preview styling.
- `src/features/dashboard/components/athlete-dashboard.module.css` — Yekan Bakh scope, tracker positions, responsive rules, and orange water state.
- `src/features/dashboard/components/athlete-dashboard.tsx` — contains the related athlete workout/nutrition presentation changes already present in the working tree and validated with this implementation.

## Why changes were made

The previous preview was a compact summary modal and exposed an edit action, so it could not reproduce the athlete-visible program or satisfy read-only behavior. The new component renders domain data directly in a viewport overlay and contains no editing controls.

The previous copy handler opened ProgramBuilder. Moving the operation to a state-first deep clone keeps the coach on the list and provides immediate feedback. A persisted `cardStatus` field distinguishes explicit copies from normal reusable templates, avoiding misuse of the broader `isNew` lifecycle flag.

The exercise bank already supported multi-selection and equipment on individual items, but lacked a bulk equipment operation. The new action reuses the existing bank update API for every selected key.

The athlete tracker used RTL-dependent implicit placement and blue water accents. Explicit physical grid columns and internal RTL direction make desktop placement deterministic while preserving the intended mobile order and orange design language.

## Code structure

`ProgramWorkspace` owns list state and opens `ProgramPreview` with a complete `PlanCardSource`. `ProgramPreview` separates workout exercise rendering from nutrition food rendering, locks body scrolling, closes on Escape, and uses CSS Module classes for responsive presentation.

Local copies are produced by `cloneDraft`, which refreshes nested keys, clears server identifiers and athlete/send metadata, and stores an explicit `cardStatus`. Templates are persisted through the existing `gymplus:program-templates:v1` localStorage path.

`ProgramBank` keeps selected keys in its existing `Set<string>`. The bulk picker now has separate `group` and `equipment` modes, both funneled through the existing bulk action and `bankUpdate` mutation.

Plan normalization maps server aliases into `ProgramExercise` and `ProgramFoodItem`; save routines serialize the enriched values back to workout and nutrition endpoints.

## Validation

- `npm run typecheck` — passed.
- `npm run lint` — passed with 13 pre-existing warnings and no errors. After focused cleanup, warnings in touched program files were reduced; unrelated dashboard warnings remain.
- `npm run build` — passed; Next.js production build compiled, type-checked, generated pages, and completed successfully. It reported existing lint warnings only.
- `git diff --check` — passed after removing an end-of-file whitespace issue.
- Focused Prettier check for `ProgramPreview.tsx` — passed.
- Repository-wide `npm run format:check` — did not pass because 42 existing files are not Prettier-formatted, including many files outside this change. The new preview component itself is formatted.

No commit or push was performed.
