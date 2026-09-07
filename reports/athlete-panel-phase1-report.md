# GymPlus+ Athlete Panel — Phase 1 (MVP) Consolidated Report & Implementation Roadmap

**Persona:** Alireza · **Platform:** Mobile-first · **Source:** GymPlus+ Athlete Panel Scenario Document (PDF 1)

> Status: Analysis / roadmap only. No code was changed for this panel. Phase 2 & 3 explicitly excluded.

---

## 1. What the PDF actually specifies (consolidated)

The Athlete Panel PDF describes a **mobile daily tracker** that turns a coach-assigned program into a "today" screen the athlete ticks off at the gym and at meals. The MVP (Phase 1) is two trackers:

### 1a. Workout tracker (MVP)
- A **"today" workout screen** showing the exercises of today's session (from the assigned program), with per-exercise completeness.
- **Rest/timer-oriented session flow** as described in the PDF personas (session start → exercises → finish), attendance-gated.
- Progress feedback (e.g. `progressBar`) and the ability to see what remains.
- Records/attendance hooks that already exist in the backend.

### 1b. Nutrition tracker (MVP)
- A **"today" meal view** organized by meal (صبحانه/ناهار/شام/میانوعدهها), showing target calories/macros vs. consumed.
- Meal completion marking — today the UI **bulk-marks a whole meal** as done (item-level completion exists in the backend but is not exposed per item in the UI).
- A weekly/nutrition overview helper.

### 1c. Data-model honesty (verified against code)
The PDF scenario prose implies **per-set** and **per-food-item** granular tracking (sets, reps-per-set, rest timers; per-item amounts, water, supplements). The **current code tracks coarser units**:

| PDF assumes | Current athlete code (verified) |
|---|---|
| Per-set completion + rest timer | Whole-exercise completion only (`completionByExercise` map) |
| Per-item food completion | Whole-meal bulk-marking |
| Progress ring / streak / water / supplements | Absent |
| Attendance gate on tracking | Present (`attendance?.is_active`) |

This mismatch is the central risk of the panel and is why the roadmap leads with a **Stage-0 contract alignment gate**.

---

## 2. Implementation roadmap — Phase 1 MVP build order

- **Stage 0 — Contract alignment gate (top dependency).** Decide the unit of tracking with the product + backend team: keep *whole-exercise / whole-meal* ticks (matches current `/me/exercise-completions/`, `/me/meal-completions/`) or move to *per-set / per-item* (requires new or enriched endpoints). The rest of the roadmap is written to fit whichever is chosen, but every estimate changes at this gate.
- **Stage 1 — Data plumbing.** Wire `today` screens to `/me/workout/today/`, `/me/nutrition/today/`, `/me/nutrition/target/`, using the existing `api()`/`rows()` helpers and Persian date helpers.
- **Stage 2 — Workout today screen.** Day/exercise list, progress, attendance gating, complete/un-complete toggles (POST/DELETE to exercise-completions).
- **Stage 3 — Nutrition today screen.** Meal cards with target vs. consumed (calories/macros), meal completion toggle + `/bulk/`.
- **Stage 4 — Polish.** Empty states (no program / no attendance / rest day), loading skeletons, RTL/number formatting audit, mobile-first QA.

Build order rationale: the completion **unit** decision (Stage 0) gates the UI; the two screens share the same plumbing and only then diverge; polish is last.

---

## 3. Reusable existing components (verified, `athlete-dashboard.tsx`)

| Reuse | Where | Notes |
|---|---|---|
| `api()` / `rows()` / `object()` / `fa()` helpers | top of file | All API + Persian formatting goes through these |
| `today()` / `date()` | top of file | Persian date for the "today" header |
| `Card` | ~line 244 | Generic panel card |
| `Dialog` | ~line 687 | Modal shell |
| `RequestDialog` | ~line 812 | Existing requests (training plan / nutrition plan / private session / supplement) — reuse for any "ask coach" action |
| `BottomNav` | ~line 224 | Mobile shell bottom nav + central orange add |
| `Workout()` | ~line 316 | Exercise tick logic (completionByExercise map, gated by attendance) |
| `Nutrition()` | ~line 379 | Meal bulk-mark logic |
| `mealIcon` / `mealLabel` / `nutritionWeek` | ~438–439 / 434 | Meal emoji + labels |
| `.progressBar`, light-theme tokens (`--orange:#f45b0b`) | `athlete-dashboard.module.css` | Orange/yellow/red reusable progress |

---

## 4. New components needed (Phase 1 MVP)

- `TodayHeader` — date, athlete context, attendance state.
- `SessionCard` — exercise rows with done-state + any unit/rest display (depends on Stage 0 decision).
- `MealCard` — meal title/icon, kcal + macro target-vs-consumed, mark-done action.
- `ProgressSummary` — remaining-vs-done summary strip.
- `EmptyProgram` / `RestDay` empty states.

---

## 5. Blockers & dependencies

1. **Stage-0 unit decision** (whole-exercise/meal vs. per-set/per-item) — the single biggest dependency; drives endpoints, types, and UI.
2. **Backend parity** — confirm `/me/workout/today/`, `/me/nutrition/today/`, `/me/nutrition/target/`, `/me/meal-completions/bulk/` shapes and attendance gating semantics.
3. **Model gaps** — per-set/rest/water/supplements don't exist; decide explicitly to cut from MVP or schedule later.
4. **Cross-panel** — anything the coach authors today (alternatives, unit-aware values, notes) is what the athlete renders; payloads must stay additive.

---

*Phase 2/3 features (streaks, social, challenges, advanced analytics, supplements water logging per item, progress ring) are intentionally excluded per the MVP-only request.*
