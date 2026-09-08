// =============================================================
// GymPlus+ — development fallback sample data for plan lists
// -------------------------------------------------------------
// Shapes mirror the LIVE backend payloads (see the server plan
// subsets used by the app: ServerWorkoutPlan / ServerNutritionPlan
// in the coach program hooks, plus the dashboard WorkoutPlan /
// NutritionPlan). These are shown ONLY when running in development
// and the real API is unreachable, errors, or returns an empty
// list — never in production.
//
//   workout  → 1 «قالب کلی» () + 2 sent to students (ارسال‌شده)
//   nutrition→ 1 template () + 2 sent to students (ارسال‌شده)
//
// sent_at = null  → badge «»      sent_at set → badge «ارسال‌شده»
// athlete_name    → student card title «برنامه [name]»
// =============================================================

export type MockExercise = {
  id?: number;
  name: string;
  sets: number;
  reps: number;
  note?: string;
};

export type MockWorkoutDay = {
  id?: number;
  plan?: number;
  index: number;
  name?: string;
  exercises: MockExercise[];
};

export type MockWorkoutPlan = {
  id: number;
  title: string;
  goal?: string;
  athlete?: number | null;
  athlete_name?: string | null;
  days_count?: number;
  duration_weeks?: number;
  sent_at?: string | null;
  expires_at?: string | null;
  days?: MockWorkoutDay[];
};

export type MockFoodItem = {
  id?: number;
  meal?: number;
  food?: number | null;
  name: string;
  amount_g: number;
  calories?: number;
  protein_g?: number;
  carb_g?: number;
  fat_g?: number;
  note?: string;
};

export type MockMeal = {
  id?: number;
  plan?: number;
  kind?: string;
  index: number;
  name: string;
  items: MockFoodItem[];
};

export type MockNutritionPlan = {
  id: number;
  title: string;
  goal?: string;
  athlete?: number | null;
  athlete_name?: string | null;
  sent_at?: string | null;
  duration_weeks?: number;
  is_template?: boolean;
  meals?: MockMeal[];
};

// ------------------------------------------------------------------
// workout sample plans
// ------------------------------------------------------------------

function workoutDays(): MockWorkoutDay[] {
  return [
    {
      id: 101,
      index: 1,
      name: "سینه و جلو بازو",
      exercises: [
        { id: 1011, name: "پرس سینه هالتر", sets: 4, reps: 8, note: "آرنج ۴۵ درجه نسبت به بدن" },
        { id: 1012, name: "پرس سینه دمبل تخت", sets: 4, reps: 10 },
        { id: 1013, name: "جلو بازو هالتر ایستاده", sets: 3, reps: 10 },
        { id: 1014, name: "جلو بازو دمبل نشسته", sets: 3, reps: 12 },
      ],
    },
    {
      id: 102,
      index: 2,
      name: "پشت و پشت بازو",
      exercises: [
        { id: 1021, name: "زیربغل سیم‌کش", sets: 4, reps: 10 },
        { id: 1022, name: "نشر خم هالتر", sets: 4, reps: 8 },
        { id: 1023, name: "پارویی دمبل یک‌دست", sets: 3, reps: 12 },
        { id: 1024, name: "پشت بازو سیم‌کش", sets: 3, reps: 12 },
      ],
    },
    {
      id: 103,
      index: 3,
      name: "پا و سرشانه",
      exercises: [
        { id: 1031, name: "اسکوات", sets: 4, reps: 8, note: "عمق کامل و کنترل حرکت" },
        { id: 1032, name: "پرس پا دستگاه", sets: 4, reps: 10 },
        { id: 1033, name: "پرس سرشانه دمبل", sets: 3, reps: 10 },
        { id: 1034, name: "نشر جانب دمبل", sets: 3, reps: 12 },
      ],
    },
    {
      id: 104,
      index: 4,
      name: "هوازی و شکم",
      exercises: [
        { id: 1041, name: "تردمیل", sets: 1, reps: 30, note: "۲۰ دقیقه با شدت متوسط" },
        { id: 1042, name: "کرانچ", sets: 3, reps: 20 },
        { id: 1043, name: "پلانک", sets: 3, reps: 45, note: "ثانیه" },
      ],
    },
  ];
}

function fatLossDays(): MockWorkoutDay[] {
  return [
    {
      id: 201,
      index: 1,
      name: "تمام بدن (دور بالا)",
      exercises: [
        { id: 2011, name: "پرس سینه دمبل", sets: 3, reps: 12 },
        { id: 2012, name: "زیربغل سیم‌کش", sets: 3, reps: 12 },
        { id: 2013, name: "پرس سرشانه دمبل", sets: 3, reps: 12 },
      ],
    },
    {
      id: 202,
      index: 2,
      name: "دور پایین + هوازی",
      exercises: [
        { id: 2021, name: "اسکوات با وزن بدن", sets: 3, reps: 20 },
        { id: 2022, name: "لانگز", sets: 3, reps: 12 },
        { id: 2023, name: "پیاده‌روی سریع", sets: 1, reps: 40, note: "دقیقه" },
      ],
    },
  ];
}

export function buildMockWorkoutPlans(): MockWorkoutPlan[] {
  return [
    {
      id: 8001,
      title: "برنامه حجم و قدرت",
      goal: "muscle_gain",
      athlete: null,
      athlete_name: null,
      days_count: 4,
      duration_weeks: 4,
      sent_at: null,
      expires_at: null,
      days: workoutDays(),
    },
    {
      id: 8002,
      title: "برنامه تمرینی امیر",
      goal: "muscle_gain",
      athlete: 61,
      athlete_name: "امیر محمدی",
      days_count: 4,
      duration_weeks: 6,
      sent_at: "2026-09-05T09:30:00",
      days: workoutDays(),
    },
    {
      id: 8003,
      title: "برنامه چربی سوزی مهدی",
      goal: "strength",
      athlete: 58,
      athlete_name: "مهدی رضایی",
      days_count: 2,
      duration_weeks: 4,
      sent_at: "2026-09-03T11:00:00",
      days: fatLossDays(),
    },
  ];
}

// ------------------------------------------------------------------
// nutrition sample plans
// ------------------------------------------------------------------

function bulkMeals(): MockMeal[] {
  return [
    {
      id: 301,
      plan: 8101,
      kind: "breakfast",
      index: 1,
      name: "صبحانه",
      items: [
        { id: 3011, name: "جو دوسر", amount_g: 60, calories: 233, protein_g: 8, carb_g: 40, fat_g: 4 },
        { id: 3012, name: "تخم‌مرغ کامل", amount_g: 100, calories: 155, protein_g: 13, carb_g: 1, fat_g: 11 },
        { id: 3013, name: "کره بادام‌زمینی", amount_g: 20, calories: 118, protein_g: 5, carb_g: 4, fat_g: 10 },
      ],
    },
    {
      id: 302,
      plan: 8101,
      kind: "morning_snack",
      index: 2,
      name: "میان‌وعده صبح",
      items: [
        { id: 3021, name: "موز", amount_g: 120, calories: 107, protein_g: 1, carb_g: 27, fat_g: 0 },
        { id: 3022, name: "گردو", amount_g: 20, calories: 131, protein_g: 3, carb_g: 3, fat_g: 13 },
      ],
    },
    {
      id: 303,
      plan: 8101,
      kind: "lunch",
      index: 3,
      name: "ناهار",
      items: [
        { id: 3031, name: "سینه مرغ گریل", amount_g: 200, calories: 330, protein_g: 62, carb_g: 0, fat_g: 7 },
        { id: 3032, name: "برنج سفید پخته", amount_g: 300, calories: 390, protein_g: 7, carb_g: 85, fat_g: 1 },
        { id: 3033, name: "روغن زیتون", amount_g: 10, calories: 88, protein_g: 0, carb_g: 0, fat_g: 10 },
      ],
    },
    {
      id: 304,
      plan: 8101,
      kind: "dinner",
      index: 4,
      name: "شام",
      items: [
        { id: 3041, name: "ماهی سالمون", amount_g: 200, calories: 416, protein_g: 40, carb_g: 0, fat_g: 28 },
        { id: 3042, name: "سیب‌زمینی پخته", amount_g: 200, calories: 174, protein_g: 4, carb_g: 40, fat_g: 0 },
      ],
    },
  ];
}

function cutMeals(): MockMeal[] {
  return [
    {
      id: 401,
      plan: 8103,
      kind: "breakfast",
      index: 1,
      name: "صبحانه",
      items: [
        { id: 4011, name: "تخم‌مرغ (سفیده)", amount_g: 120, calories: 63, protein_g: 13, carb_g: 1, fat_g: 0 },
        { id: 4012, name: "نان جو", amount_g: 50, calories: 124, protein_g: 5, carb_g: 25, fat_g: 2 },
      ],
    },
    {
      id: 402,
      plan: 8103,
      kind: "lunch",
      index: 2,
      name: "ناهار",
      items: [
        { id: 4021, name: "سینه مرغ گریل", amount_g: 150, calories: 248, protein_g: 47, carb_g: 0, fat_g: 5 },
        { id: 4022, name: "عدس پخته", amount_g: 150, calories: 174, protein_g: 13, carb_g: 30, fat_g: 1 },
      ],
    },
    {
      id: 403,
      plan: 8103,
      kind: "afternoon_snack",
      index: 3,
      name: "عصرانه",
      items: [
        { id: 4031, name: "ماست کم‌چرب", amount_g: 200, calories: 126, protein_g: 10, carb_g: 17, fat_g: 2 },
        { id: 4032, name: "سیب", amount_g: 150, calories: 78, protein_g: 0, carb_g: 21, fat_g: 0 },
      ],
    },
    {
      id: 404,
      plan: 8103,
      kind: "dinner",
      index: 4,
      name: "شام",
      items: [
        { id: 4041, name: "تن ماهی در آب", amount_g: 120, calories: 139, protein_g: 30, carb_g: 0, fat_g: 1 },
        { id: 4042, name: "سالاد سبزیجات", amount_g: 150, calories: 35, protein_g: 2, carb_g: 7, fat_g: 0 },
      ],
    },
  ];
}

export function buildMockNutritionPlans(): MockNutritionPlan[] {
  return [
    {
      id: 8101,
      title: "برنامه غذایی افزایش حجم",
      goal: "muscle_gain",
      athlete: null,
      athlete_name: null,
      duration_weeks: 4,
      is_template: true,
      sent_at: null,
      meals: bulkMeals(),
    },
    {
      id: 8102,
      title: "برنامه غذایی امیر",
      goal: "muscle_gain",
      athlete: 61,
      athlete_name: "امیر محمدی",
      duration_weeks: 6,
      sent_at: "2026-09-05T10:15:00",
      meals: bulkMeals(),
    },
    {
      id: 8103,
      title: "برنامه غذایی کاهش وزن سارا",
      goal: "fat_loss",
      athlete: 54,
      athlete_name: "سارا احمدی",
      duration_weeks: 4,
      sent_at: "2026-09-06T08:45:00",
      meals: cutMeals(),
    },
  ];
}
