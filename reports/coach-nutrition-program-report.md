# GymPlus+ Coach Panel — Nutrition Program Story ("The Notebook That Didn't Work")

**Source:** Coach Nutrition Program Story PDF (PDF 3)
**Analysis status:** Consolidated against the current `coach-dashboard.tsx` implementation.

---

## 1. The narrative in one paragraph

The coach's old notebook "didn't work" because each diet was a one-off with no shared memory: the same foods were re-typed for every student, meal plans and food lists were tangled together, and nothing could be reused. The fix is the **"Set once, use many times"** architecture: a small set of **settings** (categories, meal structure, units), a **food bank** that is the single source of truth for foods, and a **3-column builder** where the middle column (the meal being built) draws only from the bank slice that matches that meal's food category and the plan's goal. The coach's breakthrough moment is that a 900-item list becomes the 15 items relevant to "Before Bed."

## 2. Feature-by-feature spec

### 2.1 Settings — food categories
- **Defaults** provided out of the box (e.g. proteins, carbs, fats, snacks…).
- **Add many at once** (a multi-line add) — with duplicate handling.
- **Drag reorder** of categories.
- **Delete is guarded**: three-way choice with usage counts (see §2.6).

### 2.2 Meal structure ↔ category separation
- The *meal plan* (صبحانه، ناهار، شام، ۲ میانوعده، قبل خواب) is **separated from the *food list***: each **meal picks a food category** so two snacks can both read from the shared "میانوعده/سنک" bank.
- This separation is the core structural idea — the bank belongs to the category, not to any single meal plan.

### 2.3 Settings — measurement units
- **grams** is the default; the default is **protected from deletion**.
- Additional practical units: tablespoon (قاشق غذاخوری), palm (مشت), handful, slice — add/remove freely.
- Units are **fixable mid-flow** (a food added with the wrong unit can be corrected without starting over).

### 2.4 Food Bank (بانک مواد غذایی)
- **Quick-entry bar**: Category / Unit selectors + a **big text field**; Enter adds + refocuses.
- **Multi-line paste → bulk add** with a summary that counts skips: `۱۰ مورد اضافه شد، ۱ مورد تکراری حذف شد`.
- **Inline syntax**: `Haleem | Bowl | Volume` (name | unit | goal).
- **Goal toggles per food**: each food can be tagged for a goal (کات / حجم). Foods can carry multiple or none; goal tags drive builder filtering.
- **Management table**: search/filter, multi-select + **bulk category move**, disable toggle.

### 2.5 3-column builder — nutrition
- **Right column = meals**; active meal highlighted.
- **Middle column = food items** of the active meal (amount + unit + kcal).
- **Left column = food bank filtered by the active meal's food category** and the plan goal.
- Rows carry an **inline note** and can have an **alternative food** (e.g. جو نان → نان جو for a wheat-sensitive student).
- **Calorie/target context** visible so the coach sees the meal balance while building.
- **Templates**: save a full diet as **"برنامه کلی"**; instantiating creates independent copies. Scenario shows editing one student's copy in ~2 minutes without touching the template.

### 2.6 Safe delete — "No deletion should silently destroy live data"
The PDF is explicit and names the failure of the old notebook: deleting something that is in use should never be a silent, destructive surprise. Required behaviour is a **three-way choice**:
1. **Disable only** — the item stays, is hidden from building.
2. **Move then delete** — the item's usages are re-pointed (exercises/foods moved to another group/category), then it is deleted.
3. **Delete everything** — explicit, confirmed, shows exactly how much live data will be destroyed.
Defaults (grams, the stock categories) are **protected**.

## 3. Gap vs. current code (verified in `coach-dashboard.tsx`)

| Requirement | Current code | Gap |
|---|---|---|
| Food categories + defaults + add-many + reorder | Not present (`mealKinds` is a **hard-coded array**, ~line 2331, no category concept) | New |
| Meal structure ↔ category | Hard-coded meal kinds; no link to a category | New model + UI |
| Measurement units | `NutritionMealItem={name, amount_g, …}` — grams only | Unit list + amount field |
| Food bank + quick entry + inline syntax | Not present | New |
| Goal toggles (کات/حجم) on foods | Only `plan.goal`; no per-food tag | New |
| Bulk category move / disable | None | New |
| 3-column builder | `NutritionCreateModal` (accordion modal) | New full-page layout |
| Category-filtered bank column | — | New |
| Templates | `NutritionPlan.is_template?` exists; clone endpoint exists | Gallery + independent instantiation UX |
| Three-way delete | Single `CoachConfirmDialog` | Counts + 3 options |

## 4. Backend surface needed
`/coach/food-categories/`, `/coach/measurement-units/`, `/coach/food-bank/` (fields: category, unit, goal tags, `disabled`); meal structure gains a `category` link; plan items gain amount+unit (beyond `amount_g`), note, alternative. See consolidated-roadmap.md for the full endpoint list.
