# GymPlus+ coach — compact cards, delete confirm, send-duplicate fix

Date: 2026-09-07 · Coach `program/` module (workout + nutrition). CSS Modules, orange theme, RTL/Persian. **tsc/build NOT re-run** (user runs `! npx tsc --noEmit`).

## Issue 1 — card is now a compact full-width single-row bar

`ProgramCard.tsx` rewritten (layout classes still live in `program.module.css` — the project centralizes styles in that one module; no separate `ProgramCard.module.css` was created, per that convention).

- **Removed** the «X از Y روز/وعده تکمیل» meta line and the progress bar/percent entirely (`prmCard2Meta`, `prmCard2Prog`, `prmCard2Pct` no longer rendered; unused CSS left in place, harmless).
- **One row** per card, full container width (`.prmCards` grid overridden to `grid-template-columns: 1fr`):
  `[icon] [heading] [آماده/ارسالشده badge] [tag: قالب کلی / شاگرد]  …gap…  [🗑 delete] [✏️ edit — templates only] [👁 preview] [📋 clone] [orange CTA]`
- Icon tile shrunk 44 → 38 px; action icons 30 px refined; CTA shortened (padding-block 6px) so the bar stays short; status badge + new neutral category chip (`.prmCard2Tag`).
- Icon order changed so 🗑 delete is first in the cluster; student/sent cards keep only 🗑 👁 📋 + «ویرایش» CTA (no ✏️), exactly the mockup.
- Heading logic unchanged: template → its title; sent → «برنامه [شاگرد]».
- Responsive: ≤640px keeps the bar compact with bigger touch icons (36 px); ≤420px hides the redundant category chip so the line still fits.

## Issue 2 — delete now confirms before deleting (was bypassed)

Root cause: in `ProgramList.tsx` the card map passed the raw workspace delete straight through (`onDelete={onDelete}`), so the existing `deleting` state + `PrmConfirm` were dead code.

- Card map now wired `onDelete={setDeleting}` → delete icon only opens the confirm.
- Confirm copy updated to the requested spec: title «حذف برنامه؟», message «آیا از حذف برنامه «[name]» مطمئن هستید؟», confirm button «تأیید حذف» (red/danger via `tone="red"`), «انصراف» cancels. Real delete fires only after confirm. A short second sentence keeps the old nuance (local template vs already-sent vs never-sent).

## Issue 3 — send no longer creates two identical cards

Root cause (client, real): `ProgramBuilder.persist` never wrote the returned server plan id back onto the draft, and `saveWorkoutPlan`/`saveNutritionPlan` choose PATCH-vs-POST **only from `draft.id`**. So if a save succeeded in POSTing the plan but a later step failed mid-flight (e.g. `/send/` hiccup), the error path let the coach click save again → the hook **POSTed a second identical plan** → two «برنامه [شاگرد]» cards after reload.

Fixes:
- `ProgramBuilder.tsx`: new `createdPlanId` ref. On a retry of an interrupted create it reuses the id (`{...draft, id}` → PATCH) instead of re-POSTing, and mirrors `id` into draft state.
- `useProgramData.ts`: the save functions now write back the server ids returned when creating child rows (`day.serverId`, `meal.serverId`, `exercise.serverId`, `item.serverId`), so a retry after a mid-flight failure updates those rows instead of duplicating them inside the plan.
- Combined with the existing `persisting` ref (double-click guard), one «ذخیره و ارسال» now yields exactly one new student card; the original template card stays unchanged.

## Files touched

- `components/ProgramCard.tsx` — single-row bar, tags, delete-first icons.
- `components/ProgramList.tsx` — delete confirm wiring + copy; `cardHeading` helper.
- `components/ProgramBuilder.tsx` — `createdPlanId` retry dedupe.
- `hooks/useProgramData.ts` — child server-id write-backs.
- `program.module.css` — `.prmCards` 1fr; compact card overrides + `.prmCard2Tag`/`.prmCard2Actions`; mobile tweaks (append-only, orange theme, no blue).

## Next steps

Re-run `! npx tsc --noEmit` then `! npm run build`; visually check the single-row bars on desktop + phones and confirm send creates exactly one «برنامه [شاگرد]» card.
