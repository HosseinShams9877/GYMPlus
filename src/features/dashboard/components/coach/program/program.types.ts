// =============================================================
// GymPlus+ Coach — Program domain types & constants
// Frontend milestone: bank/settings/builder UI is client-driven.
// Reference endpoints ( /coach/* ) are expected but may be offline;
// the data hook degrades to these local defaults when unavailable.
// =============================================================

export type ProgramDomain = "workout" | "nutrition";

/** The plan "هدف" concept the coach programs use (حجم / کات / خنثی). */
export type PlanMode = "volume" | "cut" | "neutral";

export const MODE_LABEL: Record<PlanMode, string> = {
  volume: "حجم",
  cut: "کات",
  neutral: "خنثی",
};

export const MODE_OPTIONS: Array<[PlanMode, string]> = [
  ["volume", "حجم"],
  ["cut", "کات"],
  ["neutral", "خنثی"],
];

/** Legacy backend goal vocabulary, kept per domain for plan payloads. */
export const WORKOUT_GOALS: Array<[string, string]> = [
  ["muscle_gain", "افزایش حجم"],
  ["weight_loss", "کاهش وزن"],
  ["strength", "قدرت"],
  ["fitness", "تناسب اندام"],
];

export const NUTRITION_GOALS: Array<[string, string]> = [
  ["muscle_gain", "افزایش حجم"],
  ["fat_loss", "کاهش وزن"],
  ["fitness", "تناسب اندام"],
  ["maintenance", "تثبیت وزن"],
];

const WORKOUT_MODE_GOAL: Record<PlanMode, string> = { volume: "muscle_gain", cut: "weight_loss", neutral: "fitness" };
const NUTRITION_MODE_GOAL: Record<PlanMode, string> = { volume: "muscle_gain", cut: "fat_loss", neutral: "maintenance" };

export function goalOfMode(domain: ProgramDomain, mode: PlanMode): string {
  return domain === "workout" ? WORKOUT_MODE_GOAL[mode] : NUTRITION_MODE_GOAL[mode];
}

export function modeOfGoal(domain: ProgramDomain, goal?: string | null): PlanMode {
  if (!goal) return "neutral";
  const g = goal.toLowerCase();
  if (domain === "workout") {
    if (g.includes("loss") || g.includes("fat")) return "cut";
    if (g.includes("gain") || g.includes("muscle") || g.includes("strength") || g.includes("power")) return "volume";
    return "neutral";
  }
  if (g.includes("loss") || g.includes("fat")) return "cut";
  if (g.includes("gain") || g.includes("muscle") || g.includes("volume")) return "volume";
  return "neutral";
}

/** Persian goal label for legacy goal values. */
export function goalLabel(goal?: string | null): string {
  const found = [...WORKOUT_GOALS, ...NUTRITION_GOALS].find(([value]) => value === goal);
  return found ? found[1] : "بدون هدف";
}

// -------------------------------------------------------------
// Reference-list items (settings + banks)
// -------------------------------------------------------------

export type RefItem = {
  key: string;
  name: string;
  isDefault?: boolean;
  disabled?: boolean;
  id?: number;
};

export type UnitRefItem = RefItem & {
  code: string;
  /** grams per 1 of this unit — used to translate nutrition amounts to grams. */
  grams?: number;
  /** calories per 100 g / per unit for foods when known (kcal100). */
  kcal100?: number;
};

export type ExecUnitItem = RefItem & { code: string };

export type BankItem = RefItem & {
  unit?: string; // key of execution/measurement unit, or free text
  group?: string; // muscle-group key (workout) — drives bank filter
  category?: string; // food-category key (nutrition)
  equipment?: string;
  goals?: PlanMode[];
  kcal100?: number;
  note?: string;
};

// -------------------------------------------------------------
// Structure (days / meals)
// -------------------------------------------------------------

export type StructureItem = {
  key: string;
  name: string;
  /** workout: selected muscle-group keys; nutrition: single food-category key */
  tags: string[];
  /** workout day / nutrition meal kind (keep semantic kind when nutrition) */
  kind?: string;
};

// -------------------------------------------------------------
// Plan records (structural supersets of the backend plan shapes)
// -------------------------------------------------------------

export type ProgramExercise = {
  key: string;
  name: string;
  sets: number;
  reps: number;
  unit: string; // execution-unit code — e.g. reps | sec | min | m
  restSec: number;
  note: string;
  alternative: string; // name of alternative exercise (from bank)
  alternativeKey?: string;
  /** exercise bank key when inserted from bank (kept additive) */
  bankKey?: string;
  /** id on the server when this row was loaded from an existing plan */
  serverId?: number;
};

export type ProgramFoodItem = {
  key: string;
  name: string;
  amount: number;
  unit: string; // measurement-unit code
  kcal: number;
  note: string;
  alternative: string;
  alternativeKey?: string;
  bankKey?: string;
  grams: number; // derived grams = amount * unit.grams
  /** id on the server when this item was loaded from an existing plan */
  serverId?: number;
};

export type ProgramDay = {
  key: string;
  name: string;
  muscles: string[]; // muscle-group keys for the day
  exercises: ProgramExercise[];
  /** id on the server when this day was loaded from an existing plan */
  serverId?: number;
};

export type ProgramMeal = {
  key: string;
  kind: string;
  name: string;
  category: string; // food-category key
  items: ProgramFoodItem[];
  /** id on the server when this meal was loaded from an existing plan */
  serverId?: number;
};

export type ProgramDraft = {
  id?: number;
  isNew: boolean;
  domain: ProgramDomain;
  title: string;
  mode: PlanMode;
  goal?: string;
  athlete?: number | null;
  durationWeeks: number;
  isTemplate: boolean;
  sentAt?: string | null;
  athleteName?: string | null;
  structure: ProgramDay[] | ProgramMeal[];
};

export function isWorkoutDraft(draft: ProgramDraft): draft is ProgramDraft & { structure: ProgramDay[] } {
  return draft.domain === "workout";
}

// -------------------------------------------------------------
// Local reference defaults (shown until the /coach/* API is ready)
// -------------------------------------------------------------

let counter = 0;
export function freshKey(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export const DEFAULT_MUSCLE_GROUPS: RefItem[] = [
  { key: "chest", name: "سینه" },
  { key: "back", name: "پشت" },
  { key: "legs", name: "پا" },
  { key: "shoulders", name: "سرشانه" },
  { key: "biceps", name: "جلو بازو" },
  { key: "triceps", name: "پشت بازو" },
  { key: "abs", name: "شکم" },
  { key: "forearms", name: "ساعد" },
].map((item) => ({ ...item, isDefault: true }));

export const DEFAULT_EQUIPMENT: RefItem[] = [
  { key: "barbell", name: "هالتر" },
  { key: "dumbbell", name: "دمبل" },
  { key: "machine", name: "دستگاه" },
  { key: "cable", name: "سیم‌کش" },
  { key: "bodyweight", name: "وزن بدن" },
  { key: "band", name: "کش" },
].map((item) => ({ ...item, isDefault: true }));

export const DEFAULT_EXEC_UNITS: ExecUnitItem[] = [
  { key: "reps", code: "reps", name: "تکرار", isDefault: true },
  { key: "sec", code: "sec", name: "ثانیه", isDefault: true },
  { key: "min", code: "min", name: "دقیقه", isDefault: true },
  { key: "m", code: "m", name: "متر", isDefault: true },
];

export const DEFAULT_WORKOUT_STRUCTURE: StructureItem[] = [
  { key: "wday-1", name: "روز ۱", tags: ["chest", "biceps", "abs"] },
  { key: "wday-2", name: "روز ۲", tags: ["back", "triceps"] },
  { key: "wday-3", name: "روز ۳", tags: ["legs", "shoulders"] },
  { key: "wday-4", name: "روز ۴", tags: ["legs", "abs"] },
];

/**
 * Food "categories" are MEAL-BASED (صبحانه / ناهار / شام / میان‌وعده), not macro groups.
 * A nutrition meal's single tag (structure) references one of these, so the builder
 * suggests exactly the foods the coach categorized under that meal.
 */
export const DEFAULT_FOOD_CATEGORIES: RefItem[] = [
  { key: "breakfast", name: "صبحانه" },
  { key: "lunch", name: "ناهار" },
  { key: "dinner", name: "شام" },
  { key: "snack", name: "میان‌وعده" },
].map((item) => ({ ...item, isDefault: true }));

export const DEFAULT_MEASURE_UNITS: UnitRefItem[] = [
  { key: "g", code: "g", name: "گرم", grams: 1, isDefault: true },
  { key: "cup", code: "cup", name: "پیمانه", grams: 200 },
  { key: "glass", code: "glass", name: "لیوان", grams: 240 },
  { key: "piece", code: "piece", name: "عدد", grams: 40 },
  { key: "tbsp", code: "tbsp", name: "قاشق غذاخوری", grams: 15 },
  { key: "palm", code: "palm", name: "کف دست", grams: 60 },
  { key: "fist", code: "fist", name: "مشت", grams: 100 },
  { key: "slice", code: "slice", name: "برش", grams: 25 },
];

export const DEFAULT_MEAL_KINDS: Array<[string, string]> = [
  ["breakfast", "صبحانه"],
  ["morning_snack", "میان‌وعده صبح"],
  ["lunch", "ناهار"],
  ["afternoon_snack", "عصرانه"],
  ["dinner", "شام"],
  ["pre_bed", "قبل از خواب"],
];

/** Each meal kind suggests foods from one MEAL-based food category. */
const NUTRITION_CATEGORY_BY_MEAL_KIND: Record<string, string> = {
  breakfast: "breakfast",
  morning_snack: "snack",
  lunch: "lunch",
  afternoon_snack: "snack",
  dinner: "dinner",
  pre_bed: "snack",
};

export const DEFAULT_NUTRITION_STRUCTURE: StructureItem[] = DEFAULT_MEAL_KINDS.map(([kind, name]) => ({
  key: `meal-${kind}`,
  kind,
  name,
  tags: [NUTRITION_CATEGORY_BY_MEAL_KIND[kind] ?? "snack"],
}));

export const DEFAULT_EXERCISE_BANK: BankItem[] = [
  { key: "bench-press", name: "پرس سینه هالتر", unit: "reps", group: "chest", equipment: "barbell", goals: ["volume"], note: "آرنج ۴۵ درجه نسبت به بدن" },
  { key: "incline-db", name: "پرس سینه دمبل", unit: "reps", group: "chest", equipment: "dumbbell", goals: ["volume"] },
  { key: "lat-pulldown", name: "زیربغل سیم‌کش", unit: "reps", group: "back", equipment: "cable", goals: ["volume"] },
  { key: "deadlift", name: "ددلیفت", unit: "reps", group: "back", equipment: "barbell", goals: ["volume"] },
  { key: "squat", name: "اسکوات", unit: "reps", group: "legs", equipment: "barbell", goals: ["volume", "cut"] },
  { key: "leg-press", name: "پرس پا دستگاه", unit: "reps", group: "legs", equipment: "machine", goals: ["volume"] },
  { key: "shoulder-press", name: "پرس سرشانه", unit: "reps", group: "shoulders", equipment: "dumbbell", goals: ["volume"] },
  { key: "db-curl", name: "جلوبازو دمبل", unit: "reps", group: "biceps", equipment: "dumbbell", goals: ["volume"] },
  { key: "pushdown", name: "پشت‌بازو سیم‌کش", unit: "reps", group: "triceps", equipment: "cable", goals: ["volume"] },
  { key: "crunch", name: "کرانچ", unit: "reps", group: "abs", goals: ["cut"] },
  { key: "plank", name: "پلانک", unit: "sec", group: "abs", goals: ["cut", "neutral"] },
  { key: "treadmill", name: "تردمیل", unit: "min", group: "legs", equipment: "machine", goals: ["cut", "neutral"], note: "آهسته شروع کن و به‌مرور زیاد کن" },
  { key: "walking", name: "پیاده‌روی", unit: "min", group: "legs", goals: ["cut", "neutral"] },
  { key: "row-barbell", name: "نشر خم هالتر", unit: "reps", group: "back", equipment: "barbell", goals: ["volume"] },
  { key: "side-raise", name: "نشر جانب دمبل", unit: "reps", group: "shoulders", equipment: "dumbbell", goals: ["volume"] },
  { key: "leg-raise", name: "بالا آوردن پا", unit: "reps", group: "abs", goals: ["cut"] },
];

export const DEFAULT_FOOD_BANK: BankItem[] = [
  // صبحانه
  { key: "egg", name: "تخم‌مرغ", unit: "piece", category: "breakfast", kcal100: 155, goals: ["volume", "cut"] },
  { key: "oats", name: "جو دوسر", unit: "cup", category: "breakfast", kcal100: 389, goals: ["volume"] },
  { key: "bread", name: "نان جو", unit: "slice", category: "breakfast", kcal100: 247, goals: ["volume", "cut"] },
  { key: "yogurt", name: "ماست کم‌چرب", unit: "glass", category: "breakfast", kcal100: 63, goals: ["cut", "neutral"] },
  { key: "peanut-butter", name: "کره بادام‌زمینی", unit: "tbsp", category: "breakfast", kcal100: 588, goals: ["volume"] },
  // ناهار
  { key: "chicken", name: "سینه مرغ", unit: "g", category: "lunch", kcal100: 165, goals: ["volume", "cut"] },
  { key: "rice", name: "برنج سفید", unit: "cup", category: "lunch", kcal100: 130, goals: ["volume", "neutral"] },
  { key: "lentil", name: "عدس پخته", unit: "cup", category: "lunch", kcal100: 116, goals: ["cut", "neutral"] },
  { key: "potato", name: "سیب‌زمینی", unit: "g", category: "lunch", kcal100: 77, goals: ["cut", "neutral"] },
  // شام
  { key: "salmon", name: "ماهی سالمون", unit: "g", category: "dinner", kcal100: 208, goals: ["volume"] },
  { key: "tuna", name: "تن ماهی در آب", unit: "g", category: "dinner", kcal100: 116, goals: ["volume", "cut"] },
  { key: "olive-oil", name: "روغن زیتون", unit: "tbsp", category: "dinner", kcal100: 884, goals: ["volume", "cut"] },
  // میان‌وعده
  { key: "dates", name: "خرما", unit: "piece", category: "snack", kcal100: 282, goals: ["volume", "neutral"] },
  { key: "apple", name: "سیب", unit: "piece", category: "snack", kcal100: 52, goals: ["cut", "neutral"] },
  { key: "banana", name: "موز", unit: "piece", category: "snack", kcal100: 89, goals: ["volume", "neutral"] },
  { key: "walnut", name: "گردو", unit: "piece", category: "snack", kcal100: 654, goals: ["volume"] },
  { key: "whey", name: "پودر وی", unit: "g", category: "snack", kcal100: 400, goals: ["volume"] },
];

export const BANK_ITEM_DEFAULTS: Record<ProgramDomain, () => BankItem> = {
  workout: () => ({ key: freshKey("ex"), name: "", unit: "reps", group: "", equipment: "", goals: [] }),
  nutrition: () => ({ key: freshKey("food"), name: "", unit: "g", category: "", goals: [] }),
};

// -------------------------------------------------------------
// Exec / measurement unit helpers
// -------------------------------------------------------------

export const DEFAULT_REFERENCE: Record<
  ProgramDomain,
  {
    groups: RefItem[];
    units: (ExecUnitItem | UnitRefItem)[];
    structure: StructureItem[];
    extraListName: string; // equipment or “none”
  }
> = {
  workout: {
    groups: DEFAULT_MUSCLE_GROUPS,
    units: DEFAULT_EXEC_UNITS,
    structure: DEFAULT_WORKOUT_STRUCTURE,
    extraListName: "equipment",
  },
  nutrition: {
    groups: DEFAULT_FOOD_CATEGORIES,
    units: DEFAULT_MEASURE_UNITS,
    structure: DEFAULT_NUTRITION_STRUCTURE,
    extraListName: "none",
  },
};

export function unitDisplayName(units: (ExecUnitItem | UnitRefItem)[], code: string): string {
  return units.find((unit) => unit.code === code)?.name ?? code;
}
