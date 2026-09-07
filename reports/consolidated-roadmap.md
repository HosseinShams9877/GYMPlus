# GymPlus+ Coach Panel — Consolidated Report & Implementation Roadmap

**Scope:** Coach Workout Program Story + Coach Nutrition Program Story + Program Settings, Banks, 3-Column Builder, Templates, Safe Delete.
**Version:** Analysis phase (implementation follows in the coach/program module).

---

## 0. The one architectural conclusion

Both PDFs tell the **same product story twice** — workout ("The Green Notebook") and nutrition ("The Notebook That Didn't Work") — and both close with the same moral: build the sections to **think the same way**. Therefore:

> **Don't build a workout tool and a nutrition tool. Build one shared program-authoring system with two interchangeable domain banks.**

Each PDF follows the same 5-step loop → one shared interaction pattern:

| # | Step (shared) | Workout version | Nutrition version |
|---|---|---|---|
| 1 | **Settings** ("set once") | muscle groups (8 defaults) · day structure ("Day 1 = Chest+Arms+Abs", reorder) · equipment · execution units (Reps/Sec/Min/Meters) | food categories (4 defaults, add-many, reorder) · meal structure (meal ↔ category) · measurement units (g default, protected) |
| 2 | **Bank** ("use many") | exercise bank — quick-entry + paste bulk-add `"9 items added"`, inline `"Plank \| Seconds \| Strength"`, management table (bulk move, disable-not-delete) | food bank — quick-entry + paste `"10 added, 1 duplicate skipped"`, inline `"Haleem \| Bowl \| Volume"`, goal toggles Cut/Volume, disable |
| 3 | **Build** (3-column) | days · exercises · bank filtered by active day's muscle groups + goal; sets×reps+rest, note, alternative, unit auto-set, per-day volume preview | meals · items · bank filtered by meal's category + goal; amount+unit+kcal, note, alternative |
| 4 | **Template** | save-as-template → independent copy per student | same |
| 5 | **Safe delete** | disable / move-then-delete / delete-all with usage counts; defaults protected | same |

---

## 1. Consolidated feature scope to build

### A. Program Settings (new section — does not exist anywhere)
- **Workout settings:** muscle groups (rename w/ migration, delete guarded), day-structure editor (name + muscle-tag composition, drag-reorder), equipment list, execution-unit list.
- **Nutrition settings:** food categories (add-many, drag-reorder, three-way delete), meal-structure editor (each meal picks a food category), measurement-unit list (grams default, protected).
- Shared rules: **disable ≠ delete**, **defaults protected**, **delete shows usage counts + 3 options**.

### B. Exercise Bank & Food Bank (new)
- Quick-entry mode (group/equipment/unit or category/unit) + big text field; Enter adds + refocuses; multi-line paste → bulk add w/ Persian summary + duplicate skip; inline syntax `Name | Unit | Goal`.
- "Added this session" strip for mid-flow unit fixes.
- Management table: search/filter, **multi-select + bulk actions**, goal toggle, **disable toggle** (hidden during program creation, never lost).

### C. Program builder (upgrade of modals → 3-column authoring view)
- Columns: days/meals · active content · filtered bank.
- Bank filtering = active day's muscle groups (or active meal's category) **and** plan goal.
- Rows: sets×reps + rest (or amount + unit + kcal), inline note, alternative.
- **Unit auto-set** (Plank→Seconds, Treadmill→Minutes) from the bank item.
- **Volume preview** (per-day set count + total).
- **Save as Template** (برنامه کلی) + **Start from Template** → independent deep copy → assign to student → **Preview → Send**.

### D. Program List
- Cards with status badges (آماده / ارسالشده / پیشنویس), type (برنامه کلی vs student), goal indicator (حجم/کات/خنثی), progress ("X از ۷ وعده تکمیل", "X از ۴ روز تکمیل").

### E. Safe Delete
- Three options: Disable only / Move then delete / Delete everything. Usage counts shown. Defaults protected.

---

## 2. Verified gap table (current code → target)

| Target | Current code (verified) | Gap |
|---|---|---|
| Programs/Bank/Settings sub-sections | One combined programs list page (`WorkoutPage` ~1561) with all/workout/nutrition tabs; no bank/settings views | New IA |
| Nutrition in nav | `navOrder` (~323) omits `nutrition` (`PageKey` ~282 exists) | Add nav entry |
| Settings banks | Coach "settings" = account/profile only (~1150) | New |
| Category+item manager w/ defaults & delete guard | **Exists** for services: `ServicesPage` ~1612, `ServiceCard` ~1632, `CategoryModal` ~2253, `ServiceModal` ~2223 | Pattern to **generalize** into banks |
| Quick-entry / paste / inline syntax | None | New |
| Bulk multi-select + disable | None | New |
| Day structure w/ muscle tags + reorder | `WorkoutDay` flat (`~225`); `WorkoutDaysEditor` ~2304 static | Extend |
| Unit-aware exercise | `WorkoutExercise` ~224 reps-only; weight column literal `-` (~2309) | Model + UI |
| Nutrition meal↔category | Hard-coded `mealKinds` ~2331 | New link |
| Food items amount+unit | `NutritionMealItem` ~242 grams-only | Extend |
| Goal filter of bank | `plan.goal` exists; no bank-item goal tag | Add |
| Templates | clone (`/plans/:id/clone/`, ~1597) + assign + send; `NutritionPlan.is_template` ~237; WorkoutPlan none | Real gallery + independent copy UX |
| Safe-delete 3-way + counts | Single `CoachConfirmDialog` (~1628) | Add |
| Notes / alternatives on rows | `note` in types but **no editor field**; alternatives absent | Row editors + backend |
| 3-column builder as page | Builders are modals only: `WorkoutModal` ~2316, `NutritionCreateModal` ~2345 | New full-page shell |

---

## 3. Implementation roadmap (build order)

- **Stage 1 — Foundation (data model + IA).** Confirm backend resources; extend frontend types (`is_template` on WorkoutPlan, bank item types, units/categories/muscle-groups, `muscles[]` on day, rest/alternative on rows, amount+unit on food); add the workout/nutrition × programs/bank/settings sub-IA; wire endpoints into `useCoachData`.
- **Stage 2 — Settings banks (generic, built once).** `SettingsBankSection` config-driven, instantiated for both domains: muscle groups → day structure → equipment → units; categories → meal↔category → units. Rename-with-migration, add-many, drag-reorder, `SafeDeleteDialog`.
- **Stage 3 — Banks.** Generic `BankManager` (ServicesPage DNA): quick-entry toolbar, parser, session strip, bulk bar, disable toggle, duplicate-skip toasts. Instantiated twice.
- **Stage 4 — 3-column builder.** `BuilderPage`: right = days/meals (accordion DNA of `WorkoutDaysEditor`/`NutritionMealsEditor`), middle = rows, left = filtered bank; live volume strip; mobile = stacked + bank bottom-sheet. Then templates (save-as-template + start-from-template deep copy) and send via existing endpoints.
- **Stage 5 — Hardening.** Safe-delete audit, responsive QA, RTL audit, scenario test pass against both PDFs.

---

## 4. Reusable existing components / patterns (coach module)

- Program list & lifecycle: `WorkoutPage` tabs ~1561–1586; `ProgramCard`/`NutritionCard` ~1594/1603 (assign `/assign/`, send `/send/`, clone `/clone/`, edit, delete-confirm, "قالب قابل استفاده" empty-athlete state).
- **Category+item manager blueprint:** `ServicesPage` ~1612–1630 (category cards w/ `is_default` delete-guard, `.serviceTabs`, item cards, empty states), `ServiceCard` ~1632, `CategoryModal` ~2253, `ServiceModal` ~2223, `CoachConfirmDialog`.
- Accordion builders: `WorkoutDaysEditor` ~2304, `NutritionMealsEditor` ~2335.
- Modals & primitives: `ModalShell`, `ModalHead`, `CoachConfirmDialog`, `EmptyState`, `Status`, `FormError`, `Field`/`Textarea`/`Select`, `useSubmit`, `Icon`.
- UI idioms: `.panel`, `.formGrid`, `.workoutTabs`/`.workoutTabActive`, `.workoutDayPills`, `.workoutCard`, `.statusBadge`, `.primaryButton`, `.dangerButton`; coach tokens `--orange:#e85d2a`, `--green:#168a68`; Yekan Bakh; RTL.
- Plumbing: `useCoachData` loader (~714), `apiFetch`, `handleUnauthorized`, `formatPersianDate`.

---

## 5. New components to create (CSS-Module-scoped, same idiom)

**Generic (both domains):** `ProgramAreaTabs`, `SettingsBankSection`, `ReorderableList`, `AddManyInput`, `SafeDeleteDialog`, `DefaultLockBadge`, `BankManager`, `QuickEntryToolbar`, `InlineRowParser`, `SessionStrip`, `BulkBar`, `DisableToggle`, `GoalToggle`, `DuplicateNoticeToast`, `BuilderPage`, `BuilderColumn`, `BankFilterTabs`, `RowEditor`, `AlternativePicker`, `VolumeBadge`, `TemplatePicker`, `SaveAsTemplateButton`, `StudentTargetSelect`, `ProgramPreview`, mobile `BankSheet`.

**Proposed module location:** `src/features/dashboard/components/coach/program/` (types, hooks, components split per file, each with its own `.module.css`).

---

## 6. Blockers & dependencies (act first)

1. **Backend contract.** None of the new resource types exist in frontend code today; whether the backend exposes muscle-groups/equipment/execution-units/food-categories/measurement-units/exercise-bank/food-bank (with goal+disabled+duplicates) and the day/row extensions is unknown. Inventory the live API; mirror `/service-categories/` + `/services/`. **Frontend will follow existing `apiFetch()` + Bearer + `https://api.gympluspro.ir/api/v1` patterns and call the expected new endpoints.**
2. **IA decision.** Workout+nutrition share one list page and nutrition has no nav item — restructure + add nav.
3. **Model gaps to fill regardless:** `is_template` on `WorkoutPlan`, unit on exercise rows, category link on meals, amount+unit on food, per-item goal tags mapped to existing `plan.goal` vocabulary.
4. **Safe-delete counts** — client-side counting over loaded plans feasible for MVP.
5. **Builder modal vs page** — recommend dedicated full-page view.
6. **Single-file growth** — extract the program domain into its own folder (recommended structure above).
7. **No drag/drop or multi-select dependency** — stay vanilla (HTML5 drag + checkbox bulk bar).
8. **Downstream coupling to athlete panel** — authored alternatives/units/notes must be additive payloads so athlete screens degrade gracefully.

---

## 7. Critical implementation requirements (from the client)

1. **Fully responsive** — mobile-first; 3-column collapses to stacked on phones; bank opens as bottom sheet on mobile.
2. **Match existing theme exactly** — CSS Modules (`*.module.css`); tokens `--orange:#e85d2a`, `--green:#168a68`, background `#f6f7f9`; Yekan Bakh; patterns `.panel`, `.primaryButton`, `.modal`, `.formGrid`, `.statusBadge`.
3. **Persian / RTL mandatory** — all text Persian, `dir="rtl"`, `src/lib/persian-date.ts` for dates.
4. **Code organization** — extract program domain into `src/features/dashboard/components/coach/program/`; follow existing API/auth patterns.

---

*Reconciles both coach PDFs. Workout & nutrition built on one shared engine instantiated twice. No code changes performed in the analysis phase.*
