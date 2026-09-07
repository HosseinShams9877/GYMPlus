# GymPlus+ Coach Panel — Workout Program Story ("The Green Notebook")

**Source:** Coach Workout Program Story PDF (PDF 2)
**Analysis status:** Consolidated against the current `coach-dashboard.tsx` implementation.

---

## 1. The narrative in one paragraph

A coach keeps a "green notebook" of training programs. The pain is that every new student starts from scratch and good programs live only in his head. The scenario shows the coach defining the **building blocks once** (settings), keeping a reusable **exercise bank**, and assembling programs in a **3-column builder** that only ever offers the exercises relevant to the day he is editing. Templates let a good program be re-instantiated per student without ever mutating the original. Nothing important is ever silently deleted.

## 2. Feature-by-feature spec (verbatim scenario → requirement)

### 2.1 Settings — muscle groups
- Muscle groups with **8 sensible defaults** provided out of the box.
- Rename is supported and **migrates** exercises tagged with the old name (no orphaned tags).
- Deleting a group that has exercises is **guarded**: the flow surfaces how many exercises are under it and requires the coach to **move them to another group** before the delete completes.

### 2.2 Settings — day structure
- Days are created/named and given a **muscle composition**, e.g. "Day 1 = Chest + Arms + Abs".
- Days can be **drag-reordered** ("Day 4" moving to position 2); numbering follows the order.

### 2.3 Settings — equipment & execution units
- An **equipment** list (e.g. barbell, dumbbell, machine, bodyweight) — add/remove.
- **Execution units**: Reps, Seconds, Minutes, Meters — with custom additions allowed; **defaults are protected** from deletion.

### 2.4 Exercise Bank (بانک حرکات)
- **Quick-entry bar**: a settings strip (Group / Equipment / Unit) above a single **big text field**; Enter adds the exercise and the field **refocuses** for the next entry.
- **Multi-line paste → bulk add** with a Persian summary toast (e.g. `۹ مورد اضافه شد`).
- **Inline syntax** one-per-line: `Plank | Seconds | Strength` — parses name, unit, and goal.
- **"Added this session" strip**: rows added just now stay visible so a mis-picked unit (Plank→`Reps` by mistake) can be fixed on the spot.
- **Management table**: search/filter, **multi-select + bulk actions** (e.g. move 40 exercises to "Legs" in one action), per-row edit.
- **Disable ≠ delete**: exercises are disabled, not removed — they stay in the bank but are **hidden while building programs** (bank shrinks from 48 to a relevant set; nothing is lost).

### 2.5 3-column builder — workout
- **Right column = days** (from the day structure); active day highlighted.
- **Middle column = exercises** of the active day.
- **Left column = the exercise bank**, but **filtered by the active day's muscle groups** and by the plan **goal** (e.g. a fat-loss goal hides volume-oriented items) — "Ali searches through nine, not 48."
- Rows: **sets × reps**, **rest** between sets, an **inline note** per exercise, and an **alternative exercise** (flagged, for athletes with knee/shoulder issues).
- **Unit auto-set**: adding "Plank" yields a row in **Seconds**; "Treadmill" in **Minutes** — the unit travels from the bank item.
- **Volume preview**: each day shows its **total set count**; the coach trims "Day 4" from 24 sets to 18 before saving.
- **Template**: the finished program can be saved as **"برنامه کلی"**; instantiating it for a student produces an **independent deep copy** — editing the copy never touches the template.

### 2.6 Safe delete (shared rule)
- Delete flows present usage counts and offer choices; a silent destroy of live data is never acceptable.

## 3. Gap vs. current code (verified in `coach-dashboard.tsx`)

| Requirement | Current code | Gap |
|---|---|---|
| Muscle groups + defaults | Not present (only `ServiceCategory` pattern exists) | New |
| Day structure w/ muscle tags + reorder | `WorkoutDay={id,plan,index,name,exercises}` — name only, static | New model + UI |
| Equipment / execution units | Not present | New |
| Unit-aware exercise rows | `WorkoutExercise={name,sets,reps,note}` — reps only | Unit field needed |
| Exercise bank + quick entry | Not present | New |
| Disable toggle / bulk actions | None (single delete/edit) | New |
| 3-column builder | `WorkoutModal` (accordion modal builder) | New full-page layout |
| Goal filter | `plan.goal` exists; bank items have no goal tag | Add tag |
| Templates | `/plans/:id/clone/` exists; `WorkoutPlan` has **no** `is_template` | Add flag + UX |
| Safe delete | Single `CoachConfirmDialog` confirm | Counts + choices |

## 4. Backend surface needed
Resource families mirroring the existing `/service-categories/` + `/services/` pattern:
`/coach/muscle-groups/`, `/coach/equipment/`, `/coach/execution-units/`, `/coach/exercise-bank/` (item fields: group, equipment, unit, goal tag, `disabled`); plus extensions on plan days (muscles[]) and exercises (unit, rest_seconds, alternative, note). See consolidated-roadmap.md for the full list.
