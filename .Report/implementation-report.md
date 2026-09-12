# GymPlus+ Program Experience Report

## What changed

### Coach and athlete panel changes (current phase)

- **Duration input on «ذخیره و ارسال برای شاگرد».** Saving a program from the Program Builder for a bound student now opens a weeks prompt before anything is sent, the same duration question the «پیش‌نمایش و ارسال» flow asks. The prompt is pre-filled with the draft's current duration, offers quick chips for 2 / 4 / 6 / 8 / 12 weeks, accepts Persian or Latin digits, and states in plain Persian how long the program will stay active for the athlete. The duration input inside «پیش‌نمایش و ارسال» is unchanged.
- **Full-screen preview from inside the Program Builder.** «پیش‌نمایش» in the builder header and in the builder footer now opens the same full-viewport read-only preview that the program cards open, instead of the previous compact modal. It renders every day or meal with all exercises, sets, repetitions, weights, rest periods, coach notes, and alternatives — built from the live draft, so unsaved edits are included.
- **Program duration in the athlete dashboard.** Both athlete panels now read the program duration from the plan payload and show it. The workout summary card gained a «مدت زمان: ۴ هفته» badge and its week counter now reads «هفته ۲ از ۴»; the nutrition hero gained the same pair of badges. When the server sends no duration at all, the badge reads «ثبت نشده» rather than a misleading zero.
- **Per-set weight recording by the athlete.** Every set row in the workout panel now has its own editable weight field (kg) instead of a single value applied to the whole exercise. The coach's prescribed weight appears as the placeholder and in the field tooltip, entries are stored per set and survive a page reload, and the heaviest set of an exercise is tracked as the personal-record candidate. Each exercise shows «رکورد شخصی» next to «سنگین‌ترین ست امروز», the heaviest set is highlighted with a «رکورد» tag, and when a newly ticked set beats the stored record the new PR is posted and the displayed record updates immediately.

### Earlier phase

- Added a dedicated full-screen, read-only coach preview for workout and nutrition cards. Workout previews show every day, exercise, set, repetition count, weight, rest period, coach note, and alternative. Nutrition previews show every meal, food, amount, calories, macros, coach note, and alternative.
- Changed card copying to happen immediately from the list. A copy is deep-cloned, appears at once with the exact ` (کپی)` suffix, remains local, and receives the «پیش‌نویس» badge without opening ProgramBuilder.
- Added equipment to the exercise-bank quick-entry flow and a bulk equipment action for all selected exercises.
- Preserved additional API fields during plan normalization and save operations, including workout weight/rest/unit/alternative and nutrition calories/macros/alternative.
- Explicitly applied Yekan Bakh to athlete workout and nutrition panels and their controls.
- Fixed athlete nutrition tracker placement: supplements are physically left and water is physically right on desktop; mobile stacks water first and supplements second.
- Replaced touched blue water-tracker accents with the application orange palette.

## Files modified

### Current phase

- `src/features/dashboard/components/coach/program/components/ProgramBuilder.tsx` — weeks prompt before a send, `requestSend` gate on the save button, duration passed explicitly into `persist`, and full-screen preview wiring for both «پیش‌نمایش» buttons.
- `src/features/dashboard/components/coach/program/program.module.css` — styling for the weeks prompt body and its quick chips, using the existing orange custom properties.
- `src/features/dashboard/components/athlete-dashboard.tsx` — duration resolution and badges for the workout and nutrition panels, per-set weight state and inputs, heaviest-set personal-record tracking, and the new optional `meta` slot on `DailyHeader`.
- `src/features/dashboard/components/athlete-dashboard.module.css` — duration badge styles for the light summary card and the dark hero, per-set weight field styles including record and completed states, the personal-record summary chips, and the responsive set-row grids.

### Earlier phase

- `src/features/dashboard/components/coach/program/components/ProgramPreview.tsx` — new read-only full-screen preview.
- `src/features/dashboard/components/coach/program/components/ProgramWorkspace.tsx` — preview orchestration, API normalization, immediate cloning, and persisted clone status.
- `src/features/dashboard/components/coach/program/components/ProgramCard.tsx` — draft badge support.
- `src/features/dashboard/components/coach/program/components/ProgramBank.tsx` — bulk equipment reassignment and final exercise-bank typing cleanup.
- `src/features/dashboard/components/coach/program/hooks/useProgramData.ts` — expanded server shapes and save payloads.
- `src/features/dashboard/components/coach/program/program.types.ts` — set detail, weight, macro, and local card-status types.
- `src/features/dashboard/components/coach/program/program.module.css` — responsive full-viewport preview styling.
- `src/features/dashboard/components/athlete-dashboard.module.css` — Yekan Bakh scope, tracker positions, responsive rules, and orange water state.
- `src/features/dashboard/components/athlete-dashboard.tsx` — athlete workout/nutrition presentation changes.

## Why changes were made

**Duration on save-and-send.** «ذخیره و ارسال برای شاگرد» called the save routine directly, so a program bound to a student was delivered with whatever `durationWeeks` the draft happened to carry — usually the default. Since the athlete panel reads that value back as `duration_weeks`, the coach had no chance to set the number that the athlete would actually see. The prompt now sits in front of the send, and the chosen value is threaded through as an argument rather than read from state, because the prompt resolves after the save closure has already captured the draft.

**Full-screen preview in the builder.** The builder's own preview was a compact summary modal, so a coach checking their work mid-edit saw less than the athlete would. Reusing `ProgramPreview` — the component the cards already open — means one implementation of "what the athlete sees", and building its input from the live draft means the preview reflects unsaved edits.

**Duration in the athlete dashboard.** The athlete workout summary displayed only «هفته N» and the nutrition hero displayed no duration at all, because `duration_weeks` was never read anywhere in `athlete-dashboard.tsx`. The `?? 0` fallback in `role-dashboard.tsx` is not what an athlete sees: that route renders `AthleteDashboard`, which is why the value always appeared as zero. The duration is now resolved from the plan payload with a shared helper, which also checks a nested `plan` object, the selected day, and the raw response, since the field's position differs between the "today" and "plan" endpoints. When no duration is present the helper derives it from the plan's start and end dates, and only falls back to «ثبت نشده» when neither is available.

**Per-set weights.** The weight column was read-only, weights were held in one entry per exercise, and the record check only fired when an entire exercise was completed — so an athlete could not record what they actually lifted set by set, and a heavy single set never became a PR. Weights are now keyed per set, so each set keeps its own load; the heaviest set is the natural PR candidate; and the check runs whenever a set is newly ticked. Weights live in the same localStorage-backed daily state as the set checkmarks and water intake, so a refresh in the middle of a workout no longer discards logged loads. A failed record post no longer rolls back the set state, since ticking the set and saving the record are independent outcomes and the set was already accepted by the server.

## Code structure

### Current phase

`ProgramBuilder` holds `durationPrompt` and `durationInput` alongside its existing save state. The primary save button calls `requestSend`, which validates the title, saves directly when no student is bound, and otherwise seeds the input from the draft and opens the prompt. `persist(sendNow, weeksOverride?)` takes the confirmed duration as an optional argument, normalizes it through `normalizeWeeks` — whole weeks, Persian digits accepted, clamped to 1–104 with a default of 4 — writes it into the saved payload, mirrors it back into the draft, and passes it to `api.sendPlan`. `previewSource` is a `useMemo` that projects the live draft into the `PlanCardSource` shape `ProgramPreview` expects, so both «پیش‌نمایش» buttons open the same full-screen overlay the cards use.

In `athlete-dashboard.tsx`, duration resolution is a pair of module-level helpers: `planDurationWeeks(...sources)` scans an alias list (`duration_weeks` first, then the historical spellings) across each candidate source, then falls back to `weeksBetween` on the plan's start and end dates; `durationText` formats the result in Persian digits or returns «ثبت نشده». Both panels call it with the sources relevant to their endpoint, and the nutrition panel passes its badges to `DailyHeader` through a new optional `meta` slot so the hero markup stays shared.

Per-set weights extend the existing `PanelDailyState` with a `weights` record keyed `` `${exerciseKey}:${setIndex}` ``, which reuses the localStorage persistence that already covers sets, timers, and expansion state. Small helpers sit next to the existing set helpers: `setWeight` and `writeWeight` read and write one set's entry, `plannedWeight` resolves the coach's prescribed load from the set detail or the exercise, `parseWeight` tolerates Persian digits and stray text, `heaviestSet` is the maximum logged load of an exercise, and `bestRecord` merges server records with PRs saved during this session so the displayed record updates without a reload. `saveRecord` posts only when the heaviest set beats that merged record, and `toggleSet` runs the check on every newly ticked set. The weight input is nested inside the set `<label>`; label activation does not apply to interactive descendants, and an explicit `stopPropagation` guard keeps typing from toggling the checkbox.

CSS follows the existing module conventions and the orange palette only. The set row's grid gains a weight column at desktop and tablet widths; below 380px the row drops to four columns and the weight field spans the full width on a second line, so the input never collapses to an unusable size.

### Earlier phase

`ProgramWorkspace` owns list state and opens `ProgramPreview` with a complete `PlanCardSource`. `ProgramPreview` separates workout exercise rendering from nutrition food rendering, locks body scrolling, closes on Escape, and uses CSS Module classes for responsive presentation.

Local copies are produced by `cloneDraft`, which refreshes nested keys, clears server identifiers and athlete/send metadata, and stores an explicit `cardStatus`. Templates are persisted through the existing `gymplus:program-templates:v1` localStorage path.

`ProgramBank` keeps selected keys in its existing `Set<string>`. The bulk picker now has separate `group` and `equipment` modes, both funneled through the existing bulk action and `bankUpdate` mutation.

Plan normalization maps server aliases into `ProgramExercise` and `ProgramFoodItem`; save routines serialize the enriched values back to workout and nutrition endpoints.

## Validation

### Current phase

- `npx tsc --noEmit` — passed, no diagnostics.
- `npx eslint` on the two touched TypeScript files — 0 errors, 3 warnings, all pre-existing and on lines this change did not touch: `athlete-dashboard.tsx` `react-hooks/exhaustive-deps` (missing `rememberedRead`), and `ProgramBuilder.tsx` unused `DOMAIN_LABEL` (line 52) and unused `addEmptyRow` (line 205).
- `git diff --check` — passed, no whitespace errors.
- Repository-wide `npm run lint` — passed with 0 errors and 9 pre-existing warnings. The three warnings in the touched files are the already documented `rememberedRead` dependency warning in `athlete-dashboard.tsx` and the unused `DOMAIN_LABEL` / `addEmptyRow` declarations in `ProgramBuilder.tsx`; the remaining six are in unrelated dashboard and settings files.
- `npm run build` — passed. Next.js compiled, type-checked, generated all static pages, and collected build traces successfully; it repeated the same 9 pre-existing ESLint warnings.
- Repository-wide `npm run format:check` — not re-run; the repository's pre-existing Prettier drift (42 files, mostly outside this change) is unchanged, and no reformatting of untouched files was performed.

### Earlier phase

- `npm run typecheck` — passed.
- `npm run lint` — passed with 13 pre-existing warnings and no errors. After focused cleanup, warnings in touched program files were reduced; unrelated dashboard warnings remain.
- `npm run build` — passed; Next.js production build compiled, type-checked, generated pages, and completed successfully. It reported existing lint warnings only.
- `git diff --check` — passed after removing an end-of-file whitespace issue.
- Focused Prettier check for `ProgramPreview.tsx` — passed.
- Repository-wide `npm run format:check` — did not pass because 42 existing files are not Prettier-formatted, including many files outside this change. The new preview component itself is formatted.

No commit or push was performed.
