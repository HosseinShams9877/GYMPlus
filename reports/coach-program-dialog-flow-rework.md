# GymPlus+ coach — dialog-flow rework (send-to-student, new-program wizard, responsive dialogs)

Date: 2026-09-06 · Coach `program/` module (workout + nutrition). Styles: CSS Modules, orange theme, RTL/Persian. **tsc/build NOT re-run** (user runs `! npx tsc --noEmit`).

## Issue 1 — «ارسال برای شاگرد» now opens the builder (no silent send)

- `ProgramList`'s send modal reuses the shared `StudentSelectDialog`; picking a student calls `ProgramWorkspace.openSendBuilder(item, athleteId)` (was `doSendStudent` which cloned→saved→sent immediately).
- `openSendBuilder` builds a fresh copy (`cloneDraft`, fresh keys) of the source program with `isTemplate:false`, `athlete`/`athleteName` = chosen student, `sentAt:null`, `durationWeeks` kept, and opens the builder. The coach reviews/edits, then saving delivers.
- **Delivery trigger moved to the builder.** Any draft opened bound to a student (`initial.athlete` set) auto-sends on a normal save:
  - `athleteBound = Boolean(initial?.athlete)`
  - header primary label: bound+new → «ذخیره و ارسال برای شاگرد»; bound+existing (editing a sent plan) → «ذخیره و ارسال مجدد»; else «ذخیره برنامه».
  - `persist`: `mustSend = Boolean(sendAthlete && (sendNow || athleteBound))` → after `saveDraft`, calls `sendPlan`, `sent=true`.
  - This also fixes a pre-existing bug: `persist(true)` (preview «ذخیره و ارسال») previously reported `sent` without ever calling `sendPlan`.
- Preview modal, when bound: orange notice («قبلاً ارسال…» / «با ذخیره خودکار ارسال میشود»), read-only «شاگرد» chip (`prmBoundStudent`) replaces the athlete `<select>`, and «فقط ذخیره» is hidden (single delivery button).
- Result card is «برنامه [student name]» + green «ارسالشده»; original کلی/template card stays unchanged.

## Issue 2 — «ساخت برنامه جدید» is a clean two-dialog flow

- **Dialog 1 «انتخاب شاگرد»** = new shared `components/StudentSelectDialog.tsx` (`export type StudentRow = {id,name,phone?}`): search box (reuses `.prmSearch`), scrollable rows = avatar initial dot + name + phone (phone icon+digits in `.prmWizStudentBody small`), «انصراف» footer, empty-state `PrmNotice`.
- **Dialog 2 «ساخت برنامه برای [student]»** (PrmModalHead title is a template literal):
  1. method: «استفاده از برنامه آماده» (→ list of کلی templates with name / mode / progress) or «ساخت برنامه از صفر»;
  2. goal chips حجم/کات/خنثی always shown **before** the builder opens (template pick pre-sets `goal: template.mode`);
  3. «باز کردن برنامهساز» → builder pre-loaded with student + goal; saving sends.
- Back/cancel everywhere: Dialog 2 back → `student:null` reopens Dialog 1.
- Same dialog reused by ProgramList send modal (its inline copy removed).

## Issue 3 — dialogs fully responsive (mobile-first)

- `programShared`: added `phone` icon (name + path).
- `.prmWizBody`: `flex:1 1 auto; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:14px 18px 16px;` → scrolls inside the capped modal instead of clipping.
- ≤640px: `.prmOverlay` padding 0 / stretch; `.prmModal`, `.prmModalSmall`, `.prmModalWide` become full-screen (`height:100vh; height:100dvh; max-height:…; border-radius:0`); `.prmWizStudents` `max-height:none` (outer body scrolls, no nested scrollbar); `.prmSendFields` 1 col; touch targets ≥46px (`.prmBtn*`), 44px icon buttons / close; taller `.prmWizStudent` rows; safe-area insets on `.prmModalHead` + action bars.
- 641–900px: modal widths capped (`min(520px,92vw)` / `min(680px,94vw)`).
- `.prmSearch input { color: var(--co-ink) }` for readable search text.

## Data / types

- `/coach/athletes/` mapping now also reads `phone || mobile` and falls back to `کاربر {id}` (no more repeated «شاگرد»). `AthletePick` (ProgramCard) and `AthleteOption` (ProgramBuilder) gained `phone?: string`.

## Files touched

- new `components/StudentSelectDialog.tsx`
- `ProgramList.tsx` (send modal → StudentSelectDialog; import cleanup)
- `ProgramWorkspace.tsx` (athletes+phone mapping; `openSendBuilder` replaces `doSendStudent`; wizard split into two dialogs; removed `sendingRef`; doc comment)
- `ProgramBuilder.tsx` (`athleteBound`/delivery labels; `mustSend` persist fix; preview bound chip/notice/actions; `AthleteOption` phone)
- `ProgramCard.tsx` (`AthletePick` phone)
- `programShared.tsx` (`phone` icon)
- `program.module.css` (append-only: wizard-body scroll/inset, `.prmBoundStudent`, media queries)

## Next steps

- Re-run `! npx tsc --noEmit` then `! npm run build`; confirm live `/coach/athletes/` returns phone + distinct names; visually check mobile full-screen dialogs + long student/template lists.
