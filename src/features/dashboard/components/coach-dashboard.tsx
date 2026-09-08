"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { handleUnauthorized } from "@/lib/auth-session";
import { formatPersianDate as formatApiPersianDate, dateInputProps, todayApiDate } from "@/lib/persian-date";
import { fetchNutritionPlans, fetchWorkoutPlans } from "@/services/fetchService";
import { ProgramWorkspace } from "./coach/program/components/ProgramWorkspace";

import styles from "./coach-dashboard.module.css";

const API_BASE = "https://api.gympluspro.ir/api/v1";

type IconName =
  | "alert"
  | "arrow"
  | "bell"
  | "calendar"
  | "chart"
  | "check"
  | "close"
  | "dashboard"
  | "edit"
  | "enter"
  | "filter"
  | "food"
  | "grid"
  | "help"
  | "home"
  | "info"
  | "link"
  | "logout"
  | "menu"
  | "money"
  | "plus"
  | "qr"
  | "refresh"
  | "search"
  | "settings"
  | "students"
  | "training"
  | "trash";

type User = {
  id: number;
  phone: string;
  full_name: string;
  role: string;
};

type CoachProfile = {
  id: number;
  user: User;
  code: string;
  specialty?: string;
  bio?: string;
  plan?: string;
  plan_expires_at?: string | null;
  is_plan_active?: boolean;
  stability_excellent?: number;
  stability_good?: number;
  stability_average?: number;
};

type RosterAthlete = {
  id: number;
  user: User;
  age?: number;
  gender?: string;
  height?: number | null;
  weight?: number | null;
  goal?: string;
  level?: string;
  training_days?: number;
  injuries?: string;
  is_active?: boolean;
  last_workout_on?: string | null;
  debt?: number;
  workouts_last_30d?: number;
  workouts_this_month?: number;
  adherence_pct?: number | null;
  nutrition_pct?: number | null;
  progress_pct?: number | null;
  stability_band?: string;
  program_expires_at?: string | null;
  program_expiring?: boolean;
  status?: string;
};

type CoachTask = {
  id: number;
  auto?: boolean;
  kind: string;
  action_type?: string;
  title: string;
  note?: string;
  athlete?: number | null;
  athlete_name?: string;
  athlete_phone?: string;
  due_date?: string;
  status?: "open" | "incomplete" | "done";
  created_at?: string;
  completed_at?: string | null;
  completed_on?: string | null;
};

type CoachDashboardData = {
  total_athletes: number;
  active_athletes: number;
  total_athletes_change_pct?: number | null;
  active_athletes_change_pct?: number | null;
  inactive_athletes_change_pct?: number | null;
  needs_follow_up: number;
  income_this_month: number;
  expected_receivable: number;
  expenses_this_month: number;
  net_income: number | null;
  outstanding_debt: number;
  overdue_invoices: number;
  dropping_count: number;
  stability_breakdown: {
    excellent: number;
    good: number;
    average: number;
    at_risk: number;
    unknown: number;
  };
  follow_up_list: RosterAthlete[];
  today_tasks: CoachTask[];
};

type FinanceReport={period_from:string|null;period_to:string|null;invoiced_total:number;paid_total:number;outstanding_total:number;open_invoices:number;overdue_invoices:number;critical_accounts:number};
type DateRange={from:string;to:string};
type CoachFinanceMetrics={monthlyClaims:number;received:number;waiting:number;overdue:number;expenses:number};

type ServiceCategory = {
  id: number;
  name: string;
  code?: string;
  is_default?: boolean;
  created_at?: string;
};

type Service = {
  id: number;
  name: string;
  category: number;
  category_name: string;
  default_price: number;
  out_of_app_price?: number;
  description?: string;
  created_at?: string;
};

type Invoice = {
  id: number;
  payer: number;
  payer_name: string;
  service?: number | null;
  service_name?: string;
  amount: number;
  discount?: number;
  due_date: string;
  kind?: string;
  status: string;
  paid_total: number;
  payable: number;
  outstanding: number;
  days_overdue: number;
  days_until_due: number;
  delay_tier?: string;
  installments?: InvoiceInstallment[];
};

function invoiceFinancialTotals(invoices: Invoice[]) {
  const open = invoices.filter((invoice) => invoice.status !== "paid");
  const overdue = open.filter(
    (invoice) => invoice.days_overdue > 0 || invoice.status === "overdue",
  );
  const waiting = open.filter(
    (invoice) => invoice.days_overdue <= 0 && invoice.status !== "overdue",
  );
  const total = (items: Invoice[]) =>
    items.reduce((sum, invoice) => sum + Number(invoice.outstanding || 0), 0);

  return { waiting: total(waiting), overdue: total(overdue), open: total(open) };
}

type InvoiceInstallment = {
  id?: number;
  amount?: number;
  due_date?: string;
  status?: string;
};

type Payment = {
  id: number;
  invoice?: number;
  payer_name?: string;
  amount: number;
  method?: string;
  paid_at?: string;
  created_at?: string;
  service_name?: string;
  due_date?: string;
  days_late?: number;
  tracking_no?: string;
};

type WorkoutPlan = {
  id: number;
  athlete?: number | null;
  athlete_name?: string | null;
  title: string;
  goal?: string;
  days_count?: number;
  duration_weeks?: number;
  sent_at?: string | null;
  expires_at?: string | null;
  days?: WorkoutDay[];
};

type WorkoutExercise={id?:number;day?:number;name:string;sets:number;reps:number;media_url?:string;note?:string};
type WorkoutDay={id?:number;plan?:number;index:number;name?:string;exercises:WorkoutExercise[]};
type WorkoutDraftDay={name:string;exercises:WorkoutExercise[]};

type NutritionPlan = {
  id: number;
  athlete?: number | null;
  athlete_name?: string | null;
  title: string;
  goal?: string;
  sent_at?: string | null;
  duration_weeks?: number;
  expires_at?: string | null;
  is_template?: boolean;
  meals?: NutritionMeal[];
  created_at?: string;
};

type NutritionMealItem = {
  id?: number;
  meal?: number;
  food?: number | null;
  name: string;
  amount_g: number;
  calories?: number;
  protein_g?: number;
  carb_g?: number;
  fat_g?: number;
};

type NutritionMeal = {
  id?: number;
  plan?: number;
  kind: string;
  index: number;
  name: string;
  items: NutritionMealItem[];
};

type NutritionMealDraft = Pick<NutritionMeal, "kind" | "name" | "items"> & { id?: number };

type AppNotification = {
  id: number;
  sender: number | null;
  receiver: number;
  message: string;
  kind: "payment" | "workout" | "new_plan" | "gym" | "system";
  read: boolean;
  created_at: string;
};

type ReminderOverride={id:number;athlete:number;excluded:boolean;remind_before:boolean|null;remind_on_due:boolean|null;remind_after:boolean|null;weight_reminder_enabled:boolean};

type PageKey =
  | "dashboard"
  | "students"
  | "actions"
  | "workout"
  | "nutrition"
  | "services"
  | "financial"
  | "income"
  | "notifications"
  | "settings";

type Paginated<T> = {
  count?: number;
  results?: T[];
};
type Json = Record<string, unknown>;

type ModalName =
  | "student"
  | "task"
  | "personalTask"
  | "service"
  | "payment"
  | "workout"
  | "nutrition"
  | "invoice"
  | "category"
  | "settings"
  | "qr"
  | "search"
  | null;

const pageConfig: Record<PageKey, { title: string; href: string; icon: IconName }> = {
  dashboard: { title: "داشبورد مربی", href: "/dashboard", icon: "dashboard" },
  students: { title: "شاگردان من", href: "/students", icon: "students" },
  actions: { title: "اقدامات", href: "/actions", icon: "calendar" },
  workout: { title: "برنامه تمرینی", href: "/workout-program", icon: "training" },
  nutrition: { title: "برنامه غذایی", href: "/nutrition-program", icon: "food" },
  services: { title: "خدمات", href: "/services", icon: "grid" },
  financial: { title: "مالی", href: "/financial", icon: "money" },
  income: { title: "گزارش درآمد", href: "/income-report", icon: "chart" },
  notifications: { title: "اعلان", href: "/notifications", icon: "bell" },
  settings: { title: "تنظیمات", href: "/settings", icon: "settings" },
};

const navOrder: PageKey[] = [
  "dashboard",
  "students",
  "actions",
  "workout",
  "nutrition",
  "services",
  "financial",
  "income",
  "notifications",
  "settings",
];

const emptyUser: User = {
  id: 0,
  phone: "",
  full_name: "",
  role: "coach",
};

const emptyCoach: CoachProfile = {
  id: 0,
  user: emptyUser,
  code: "",
};

const emptyDashboard: CoachDashboardData = {
  total_athletes: 0,
  active_athletes: 0,
  needs_follow_up: 0,
  income_this_month: 0,
  expected_receivable: 0,
  expenses_this_month: 0,
  net_income: null,
  outstanding_debt: 0,
  overdue_invoices: 0,
  dropping_count: 0,
  stability_breakdown: { excellent: 0, good: 0, average: 0, at_risk: 0, unknown: 0 },
  follow_up_list: [],
  today_tasks: [],
};

const COACH_URGENT_DISMISS_KEY = "gymplus_coach_urgent_dismissed_v1";

type DismissedUrgentActions = {
  count: number;
  itemKeys: string[];
};

function readDismissedUrgentActions(): DismissedUrgentActions | null {
  if (typeof window === "undefined") return null;

  try {
    const value = JSON.parse(localStorage.getItem(COACH_URGENT_DISMISS_KEY) || "null") as Partial<DismissedUrgentActions> | null;
    if (!value || !Array.isArray(value.itemKeys) || typeof value.count !== "number") return null;
    return { count: value.count, itemKeys: value.itemKeys.filter((item): item is string => typeof item === "string") };
  } catch {
    localStorage.removeItem(COACH_URGENT_DISMISS_KEY);
    return null;
  }
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    alert: <><path d="M12 3 3.5 18h17L12 3Z" /><path d="M12 8v4.5M12 16h.01" /></>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" /><path d="M10 19h4" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h3M13 14h3M8 17h3" /></>,
    chart: <><path d="M4 19V5" /><path d="M4 19h17" /><path d="m7 15 4-5 4 3 5-8" /></>,
    check: <path d="m4 12 5 5L20 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    dashboard: <><path d="m3 11 9-8 9 8v9H3v-9Z" /><path d="M9 17h6" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
    enter: <><path d="M20 5v5a4 4 0 0 1-4 4H5"/><path d="m9 10-4 4 4 4"/></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
    food: <><path d="M4 3v8a4 4 0 0 0 4 4h0a4 4 0 0 0 4-4V3M8 15v6M20 3c-2 1-3 3-3 6s1 5 3 5" /><path d="M17 3v18" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.4 2.4 0 1 1 3.1 2.3c-.8.3-.8 1-.8 1.7M12 17h.01" /></>,
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></>,
    logout: <><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    money: <><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v5c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 11v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    qr: <><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" /><path d="M14 14h2v2h-2zM18 14h2v6h-4v-2h2zM14 18h2v2h-2z" /></>,
    refresh: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.1 8a7 7 0 0 1 11.5-2L20 8M4 16l2.4 2a7 7 0 0 0 11.5-2"/></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    students: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
    training: <><rect x="3" y="4" width="18" height="15" rx="2" /><path d="M8 22h8M12 19v3M8 9h8M8 13h5" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" /><path d="M10 11v6M14 11v6" /></>,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function toArray<T>(value: Paginated<T> | T[] | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value?.results) {
    return value.results;
  }

  return [];
}

function formatMoney(value?: number | null) {
  return `${new Intl.NumberFormat("fa-IR").format(value ?? 0)} ت`;
}

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    active: "فعال",
    inactive: "غیرفعال",
    needs_follow_up: "نیاز به پیگیری",
    stalled: "در خطر ریزش",
    open: "باز",
    incomplete: "ناقص",
    done: "انجام شده",
    paid: "پرداخت شده",
    overdue: "معوق",
  };

  return labels[status ?? ""] ?? "در جریان";
}

function kindLabel(kind?: string) {
  const labels: Record<string, string> = {
    nutrition_plan: "برنامه غذایی",
    training_plan: "برنامه تمرینی",
    payment_follow_up: "پیگیری پرداخت",
    personal: "یادداشت شخصی",
    churn: "ریزش شاگرد",
  };

  return labels[kind ?? ""] ?? "اقدام";
}

function getToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("gymplus_access");
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("gymplus:request-start"));
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });

    if (handleUnauthorized(response.status)) {
      throw new Error("UNAUTHORIZED");
    }

    if (!response.ok) {
      const rawError = await response.text();
      let payload: unknown = rawError;
      try {
        payload = rawError ? JSON.parse(rawError) : null;
      } catch {
        // Keep a plain-text response available to the field-specific error mapper.
      }
      throw new ApiRequestError(path, response.status, payload);
    }

    if (response.status === 204 || response.status === 205) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } finally {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("gymplus:request-end"));
  }
}

class ApiRequestError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(path: string, status: number, payload: unknown) {
    super(`API ${path} failed: ${status}`);
    this.name = "ApiRequestError";
    this.status = status;
    this.payload = payload;
  }
}

function apiErrorText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(apiErrorText).filter(Boolean).join(" ");
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key} ${apiErrorText(item)}`)
      .filter(Boolean)
      .join(" ");
  }
  return value == null ? "" : String(value);
}

function normalizePhone(value: string): string {
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  const digits = value
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
    .replace(/\D/g, "");

  if (digits.startsWith("0098")) return `0${digits.slice(4)}`;
  if (digits.startsWith("98")) return `0${digits.slice(2)}`;
  return digits;
}

function studentPhoneError(error: unknown): string | null {
  if (!(error instanceof ApiRequestError)) return null;

  const text = apiErrorText(error.payload).toLowerCase();
  const phoneMentioned = /phone|mobile|موبایل|شماره/.test(text);
  const duplicateMentioned = /already|exists|unique|duplicate|taken|تکراری|قبلاً?|از قبل|وجود دارد|ثبت شده|موجود است/.test(text);

  if (error.status === 409 || (phoneMentioned && duplicateMentioned)) {
    return "این شماره موبایل قبلاً ثبت شده است و امکان ثبت مجدد آن وجود ندارد.";
  }

  if (phoneMentioned) {
    return "فرمت شماره موبایل صحیح نیست؛ شماره را با فرمت معتبر وارد کنید.";
  }

  return null;
}

function CoachRequestIndicator() {
  const [requests, setRequests] = useState(0);

  useEffect(() => {
    const start = () => setRequests((value) => value + 1);
    const end = () => setRequests((value) => Math.max(0, value - 1));
    window.addEventListener("gymplus:request-start", start);
    window.addEventListener("gymplus:request-end", end);
    return () => {
      window.removeEventListener("gymplus:request-start", start);
      window.removeEventListener("gymplus:request-end", end);
    };
  }, []);

  if (!requests) return null;
  return <div className={styles.requestIndicator} role="status" aria-live="polite">
    <span className={styles.requestSpinner} aria-hidden="true" />
    <span>در حال به‌روزرسانی</span>
  </div>;
}

function CoachPageSkeleton() {
  return <div className={styles.pageSkeleton} aria-label="در حال بارگذاری صفحه">
    <div className={styles.skeletonHeading}><span/><i/></div>
    <div className={styles.skeletonStats}><span/><span/><span/><span/></div>
    <div className={styles.skeletonSurface}><span/><span/><span/><span/><span/></div>
    <div className={styles.skeletonSurface}><span/><span/><span/></div>
  </div>;
}

type ToastTone = "success" | "error" | "info";

function showCoachToast(message: string, tone: ToastTone = "info") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("gymplus:coach-toast", { detail: { message, tone } }));
  }
}

function CoachToastViewport() {
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; tone?: ToastTone }>).detail;
      if (detail?.message) setToast({ message: detail.message, tone: detail.tone ?? "info" });
    };
    window.addEventListener("gymplus:coach-toast", handleToast);
    return () => window.removeEventListener("gymplus:coach-toast", handleToast);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return <div className={styles.toastViewport} aria-live="polite" aria-atomic="true">
    <div className={`${styles.toast} ${styles[`toast${toast.tone[0].toUpperCase()}${toast.tone.slice(1)}`]}`}>
      <Icon name={toast.tone === "success" ? "check" : toast.tone === "error" ? "alert" : "info" as IconName} />
      <span>{toast.message}</span>
      <button aria-label="بستن پیام" onClick={() => setToast(null)}><Icon name="close" /></button>
    </div>
  </div>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${styles.brand} ${compact ? styles.brandCompact : ""}`}>
      <Image src="/assets/images/mingcute_fitness.png" width={28} height={28} alt="" />
      <strong>GymPlus+</strong>
      <span>مربی</span>
    </div>
  );
}

function Avatar() {
  return (
    <span className={styles.avatar}>
      <svg viewBox="0 0 40 40">
        <circle cx="20" cy="15" r="8" fill="#efc39f" />
        <path d="M9 39c1-11 5-16 11-16s10 5 11 16" fill="#172b4d" />
        <path d="M13 13c1-8 14-9 15 1-5-1-9-2-15-1Z" fill="#202733" />
      </svg>
    </span>
  );
}

function useCoachData() {
  const [dashboard, setDashboard] = useState<CoachDashboardData>(emptyDashboard);
  const [athletes, setAthletes] = useState<RosterAthlete[]>([]);
  const [tasks, setTasks] = useState<CoachTask[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [nutritionPlans, setNutritionPlans] = useState<NutritionPlan[]>([]);
  const [coach, setCoach] = useState<CoachProfile>(emptyCoach);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    if (!getToken()) {
      setDashboard(emptyDashboard);
      setAthletes([]);
      setTasks([]);
      setServices([]);
      setCategories([]);
      setInvoices([]);
      setPayments([]);
      setWorkoutPlans([]);
      setNutritionPlans([]);
      setCoach(emptyCoach);
      setError("برای دریافت اطلاعات پنل باید وارد حساب کاربری شوید.");
      setIsLoading(false);
      return;
    }

    try {
      const [
        dashboardData,
        athleteData,
        taskData,
        serviceData,
        categoryData,
        invoiceData,
        paymentData,
        workoutData,
        nutritionData,
        coachData,
      ] = await Promise.all([
        apiFetch<CoachDashboardData>("/coach/dashboard/"),
        apiFetch<Paginated<RosterAthlete> | RosterAthlete[]>("/coach/athletes/"),
        apiFetch<Paginated<CoachTask> | CoachTask[]>("/coach/tasks/"),
        apiFetch<Paginated<Service> | Service[]>("/services/"),
        apiFetch<Paginated<ServiceCategory> | ServiceCategory[]>("/service-categories/"),
        apiFetch<Paginated<Invoice> | Invoice[]>("/invoices/"),
        apiFetch<Paginated<Payment> | Payment[]>("/payments/history/"),
        fetchWorkoutPlans<Paginated<WorkoutPlan> | WorkoutPlan[]>(),
        fetchNutritionPlans<Paginated<NutritionPlan> | NutritionPlan[]>(),
        apiFetch<CoachProfile>("/coach/me/"),
      ]);

      setDashboard(dashboardData);
      setAthletes(toArray(athleteData));
      setTasks(toArray(taskData));
      setServices(toArray(serviceData));
      setCategories(toArray(categoryData));
      setInvoices(toArray(invoiceData));
      setPayments(toArray(paymentData));
      setWorkoutPlans(toArray(workoutData));
      setNutritionPlans(toArray(nutritionData));
      setCoach(coachData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "دریافت اطلاعات پنل انجام نشد.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    dashboard,
    athletes,
    tasks,
    services,
    categories,
    invoices,
    payments,
    workoutPlans,
    nutritionPlans,
    coach,
    error,
    isLoading,
    reload: load,
  };
}

export function CoachDashboard({ page = "dashboard" }: { page?: PageKey }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activePage = useMemo<PageKey>(() => {
    if (pathname.includes("students")) return "students";
    if (pathname.includes("actions")) return "actions";
    if (pathname.includes("workout")) return "workout";
    if (pathname.includes("nutrition-program")) return "nutrition";
    if (pathname.includes("services")) return "services";
    if (pathname.includes("financial")) return "financial";
    if (pathname.includes("income")) return "income";
    if (pathname.includes("notifications")) return "notifications";
    if (pathname.includes("settings")) return "settings";
    return page;
  }, [page, pathname]);
  const data = useCoachData();
  const reloadCoachData = data.reload;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modal, setModal] = useState<ModalName>(null);
  const [alertVisible, setAlertVisible] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [handledUrgentCount, setHandledUrgentCount] = useState(0);
  const visibleUrgentCount = Math.max(0, data.dashboard.needs_follow_up - handledUrgentCount);
  const urgentActionItemKeys = useMemo(() => {
    const taskKeys = [...data.tasks, ...data.dashboard.today_tasks]
      .filter((task) => task.status !== "done" && task.auto !== false && task.kind !== "personal")
      .map((task) => `task:${task.id}`);
    const athleteKeys = data.dashboard.follow_up_list.map((athlete) => `athlete:${athlete.id}`);
    return Array.from(new Set([...taskKeys, ...athleteKeys])).sort();
  }, [data.dashboard.follow_up_list, data.dashboard.today_tasks, data.tasks]);
  useModalFocusManagement();

  useEffect(() => {
    if (data.isLoading) return;

    const urgentCount = visibleUrgentCount;
    if (urgentCount <= 0) {
      setAlertVisible(false);
      localStorage.removeItem(COACH_URGENT_DISMISS_KEY);
      return;
    }

    const dismissed = readDismissedUrgentActions();
    if (!dismissed) {
      setAlertVisible(true);
      return;
    }

    const hasNewKnownItem = urgentActionItemKeys.some((itemKey) => !dismissed.itemKeys.includes(itemKey));
    const hasNewUnknownItem = urgentActionItemKeys.length === 0 && urgentCount > dismissed.count;
    if (hasNewKnownItem || hasNewUnknownItem) {
      localStorage.removeItem(COACH_URGENT_DISMISS_KEY);
      setAlertVisible(true);
      return;
    }

    setAlertVisible(false);
  }, [data.dashboard.needs_follow_up, data.isLoading, urgentActionItemKeys, visibleUrgentCount]);

  const dismissUrgentActions = useCallback(() => {
    localStorage.setItem(COACH_URGENT_DISMISS_KEY, JSON.stringify({
      count: visibleUrgentCount,
      itemKeys: urgentActionItemKeys,
    } satisfies DismissedUrgentActions));
    setAlertVisible(false);
  }, [urgentActionItemKeys, visibleUrgentCount]);

  const handleNewNotification = useCallback(() => {
    localStorage.removeItem(COACH_URGENT_DISMISS_KEY);
    setAlertVisible(true);
    void reloadCoachData();
  }, [reloadCoachData]);

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setModal("search");
      }
    };
    document.addEventListener("keydown", openSearch);
    return () => document.removeEventListener("keydown", openSearch);
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const closeMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-profile-menu]")) setProfileMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileMenuOpen]);

  async function logout() {
    setLogoutPending(true);
    const refresh = typeof window !== "undefined" ? localStorage.getItem("gymplus_refresh") : null;

    try {
      if (refresh) {
        await apiFetch("/auth/logout/", {
          method: "POST",
          body: JSON.stringify({ refresh }),
        });
      }
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("gymplus_access");
        localStorage.removeItem("gymplus_refresh");
        localStorage.removeItem("gymplus_user");
        window.location.href = "/login";
      }
    }
  }

  return (
    <main className={styles.dashboard} dir="rtl">
      <aside className={`${styles.sidebar} ${sidebarOpen ? "" : styles.sidebarCollapsed}`}>
        <div className={styles.sidebarHead}>
          <Brand compact={!sidebarOpen} />
          <button onClick={() => setSidebarOpen((value) => !value)} aria-label="جمع کردن منو">
            <Icon name="menu" />
          </button>
        </div>
        <button
          className={styles.newStudent}
          onClick={() => {
            if (activePage === "workout" || activePage === "nutrition") {
              window.dispatchEvent(new CustomEvent("gymplus:program-new", { detail: { domain: activePage } }));
            } else {
              setModal(activePage === "services" ? "service" : "student");
            }
          }}
        >
          <Icon name="plus" />
          <span>{activePage === "services" ? "سرویس جدید" : activePage === "workout" || activePage === "nutrition" ? "برنامه جدید" : "شاگرد جدید"}</span>
        </button>
        <nav className={styles.sideNav}>
          {navOrder.map((key) => (
            <Link
              className={activePage === key ? styles.navActive : ""}
              href={pageConfig[key].href}
              key={key}
            >
              <Icon name={pageConfig[key].icon} />
              <span>{pageConfig[key].title.replace("مربی", "")}</span>
            </Link>
          ))}
        </nav>
        <div className={`${styles.profileBox} ${profileMenuOpen ? styles.profileBoxOpen : ""}`} data-profile-menu>
          <Brand />
          {profileMenuOpen ? <div className={styles.profileMenu}>
            <Link href="/settings" onClick={() => setProfileMenuOpen(false)}><Icon name="students"/><span>پروفایل من</span></Link>
            <button onClick={() => { setProfileMenuOpen(false); setModal("qr"); }}><Icon name="qr"/><span>کد اتصال شاگرد</span></button>
            <Link href="/settings" onClick={() => setProfileMenuOpen(false)}><Icon name="settings"/><span>تنظیمات حساب</span></Link>
            <button className={styles.profileMenuDanger} onClick={() => { setProfileMenuOpen(false); setLogoutConfirm(true); }}><Icon name="logout"/><span>خروج از حساب</span></button>
          </div> : null}
          <button className={styles.coach} onClick={() => setProfileMenuOpen(value => !value)} aria-expanded={profileMenuOpen} aria-label="باز کردن منوی کاربر">
            <Avatar />
            <span>
              <strong>{data.coach.user.full_name || "مربی GymPlus"}</strong>
              <small>کد: {data.coach.code}</small>
            </span>
            <i className={styles.profileChevron}>⌄</i>
          </button>
          <button onClick={() => setLogoutConfirm(true)}>
            <Icon name="logout" />
            <span>خروج از حساب</span>
          </button>
        </div>
      </aside>

      <section className={`${styles.workspace} ${sidebarOpen ? "" : styles.workspaceWide}`} aria-busy={data.isLoading}>
        <header className={styles.topbar}>
          <button className={styles.mobileMenu} onClick={() => setDrawerOpen(true)}>
            <Icon name="menu" />
          </button>
          <h1>{pageConfig[activePage].title}</h1>
          <div className={styles.topActions}>
            <button className={styles.searchBox} onClick={() => setModal("search")} aria-label="باز کردن جستجو">
              <Icon name="search" />
              <span>جستجو...</span>
              <kbd>⌘ K</kbd>
            </button>
            <NotificationBell onChanged={reloadCoachData} onNewNotification={handleNewNotification} />
            <button className={styles.mobileSearch} onClick={() => setModal("search")} aria-label="باز کردن جستجو"><Icon name="search" /></button>
            <button className={styles.help} onClick={() => { window.open("https://api.gympluspro.ir/api/docs/", "_blank", "noopener,noreferrer"); }}>
              <Icon name="help" />
              <span>راهنمایی</span>
            </button>
            <span className={styles.mobileAvatar}>
              <Avatar />
            </span>
          </div>
        </header>

        {alertVisible && visibleUrgentCount > 0 ? (
          <div className={styles.alertBar}>
            <span className={styles.alertIcon}>
              <Icon name="alert" />
            </span>
            <p>
              <strong>{visibleUrgentCount} نیاز به اقدام فوری وجود دارد!</strong>{" "}
              لطفا در اسرع وقت به آنها رسیدگی کنید
            </p>
            <button onClick={() => { window.location.href="/actions"; }}>مشاهده جزئیات</button>
            <button
              className={styles.alertClose}
              onClick={dismissUrgentActions}
              aria-label="بستن"
            >
              <Icon name="close" />
            </button>
          </div>
        ) : null}

        <div className={styles.content}>
          {data.error ? (
            <div className={styles.offlineNotice}>
              <Icon name="link" />
              <span>{data.error}</span>
              <button onClick={() => void data.reload()}><Icon name="refresh" />تلاش دوباره</button>
            </div>
          ) : null}
          {data.isLoading ? <div className={styles.loadingLine} /> : null}
          {data.isLoading ? <CoachPageSkeleton /> : <PageContent page={activePage} data={data} openModal={setModal} selectedAthleteId={Number(searchParams.get("athlete")) || null} onUrgentHandled={() => setHandledUrgentCount(count => count + 1)} />}
        </div>
      </section>

      <nav className={styles.bottomNav}>
        {(["dashboard", "students"] as PageKey[]).map((key) => (
          <Link className={activePage === key ? styles.bottomActive : ""} href={pageConfig[key].href} key={key}>
            <Icon name={pageConfig[key].icon} />
            <span>{pageConfig[key].title.replace("مربی", "")}</span>
          </Link>
        ))}
        <button
          className={styles.floatingAdd}
          aria-label={activePage === "services" ? "ساخت سرویس جدید" : activePage === "workout" || activePage === "nutrition" ? "ساخت برنامه جدید" : "ثبت شاگرد جدید"}
          onClick={() => {
            if (activePage === "workout" || activePage === "nutrition") {
              window.dispatchEvent(new CustomEvent("gymplus:program-new", { detail: { domain: activePage } }));
            } else {
              setModal(activePage === "services" ? "service" : "student");
            }
          }}
        >
          <Icon name="plus" size={30} />
        </button>
        {(["workout", "services"] as PageKey[]).map((key) => (
          <Link className={activePage === key ? styles.bottomActive : ""} href={pageConfig[key].href} key={key}>
            <Icon name={pageConfig[key].icon} />
            <span>{pageConfig[key].title}</span>
          </Link>
        ))}
      </nav>

      {drawerOpen ? (
        <MobileMenu activePage={activePage} coach={data.coach} onClose={() => setDrawerOpen(false)} onSearch={() => setModal("search")} onNewStudent={() => { setDrawerOpen(false); setModal("student"); }} onLogout={() => { setDrawerOpen(false); setLogoutConfirm(true); }} />
      ) : null}
      <AppModal
        name={modal}
        data={data}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null);
          void data.reload();
        }}
      />
      <CoachRequestIndicator />
      <CoachToastViewport />
      {logoutConfirm ? <CoachLogoutConfirm pending={logoutPending} close={() => setLogoutConfirm(false)} confirm={() => void logout()}/> : null}
    </main>
  );
}

function CoachLogoutConfirm({ pending, close, confirm }: { pending: boolean; close: () => void; confirm: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !pending) close(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, pending]);
  return <div className={styles.logoutOverlay} onMouseDown={() => { if (!pending) close(); }}>
    <section className={styles.logoutDialog} role="alertdialog" aria-modal="true" aria-labelledby="coach-logout-title" onMouseDown={event => event.stopPropagation()}>
      <header><h2 id="coach-logout-title">خروج از حساب کاربری</h2><button type="button" onClick={close} disabled={pending} aria-label="بستن"><Icon name="close"/></button></header>
      <p>آیا مطمئنید که می خواهید از حساب خود خارج شوید؟</p>
      <div><button type="button" className={styles.logoutConfirmButton} onClick={confirm} disabled={pending}>{pending ? "در حال خروج..." : "بله، خروج از حساب"}</button><button type="button" className={styles.logoutCancelButton} onClick={close} disabled={pending}>انصراف</button></div>
    </section>
  </div>;
}

function useModalFocusManagement() {
  useEffect(() => {
    let activeDialog: HTMLElement | null = null;
    let returnFocus: HTMLElement | null = null;
    let focusFrame = 0;

    const visibleDialogs = () => Array.from(document.querySelectorAll<HTMLElement>(`.${styles.overlay} .${styles.modal}`));
    const syncFocus = () => {
      const dialogs = visibleDialogs();
      const nextDialog = dialogs[dialogs.length - 1] ?? null;

      if (nextDialog && nextDialog !== activeDialog) {
        if (!activeDialog) {
          returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }
        activeDialog = nextDialog;
        activeDialog.tabIndex = -1;
        activeDialog.setAttribute("role", activeDialog.getAttribute("role") || "dialog");
        activeDialog.setAttribute("aria-modal", "true");
        window.cancelAnimationFrame(focusFrame);
        focusFrame = window.requestAnimationFrame(() => {
          const firstInput = activeDialog?.querySelector<HTMLElement>("[data-autofocus], input:not([disabled]), select:not([disabled]), textarea:not([disabled])");
          (firstInput ?? activeDialog)?.focus({ preventScroll: true });
        });
        return;
      }

      if (!nextDialog && activeDialog) {
        activeDialog = null;
        if (returnFocus?.isConnected) {
          returnFocus.focus({ preventScroll: true });
        }
        returnFocus = null;
      }
    };

    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !activeDialog) return;
      const focusable = Array.from(activeDialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(element => !element.hasAttribute("hidden"));
      if (!focusable.length) {
        event.preventDefault();
        activeDialog.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const observer = new MutationObserver(syncFocus);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", keepFocusInside);
    syncFocus();
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", keepFocusInside);
      window.cancelAnimationFrame(focusFrame);
    };
  }, []);
}

function PageContent({
  page,
  data,
  openModal,
  selectedAthleteId,
  onUrgentHandled,
}: {
  page: PageKey;
  data: ReturnType<typeof useCoachData>;
  openModal: (name: ModalName) => void;
  selectedAthleteId: number | null;
  onUrgentHandled: () => void;
}) {
  if (page === "students") {
    if (selectedAthleteId) return <StudentProfile athleteId={selectedAthleteId}/>;
    return <StudentsPage athletes={data.athletes} dashboard={data.dashboard} openModal={openModal} onChanged={data.reload} />;
  }
  if (page === "actions") {
    return <ActionsPage tasks={data.tasks} openModal={openModal} onChanged={data.reload} />;
  }
  if (page === "workout") {
    return <ProgramWorkspace kind="workout" />;
  }
  if (page === "nutrition") {
    return <ProgramWorkspace kind="nutrition" />;
  }
  if (page === "services") {
    return <ServicesPage services={data.services} categories={data.categories} athletes={data.athletes} onChanged={data.reload} />;
  }
  if (page === "financial") {
    return <FinancialPage dashboard={data.dashboard} invoices={data.invoices} payments={data.payments} onChanged={data.reload} />;
  }
  if (page === "income") {
    return <IncomePage dashboard={data.dashboard} payments={data.payments} />;
  }
  if (page === "notifications") {
    return <NotificationSettings athletes={data.athletes} />;
  }
  if (page === "settings") {
    return <SettingsPage coach={data.coach} openModal={openModal} />;
  }

  return <DashboardPage data={data} openModal={openModal} onUrgentHandled={onUrgentHandled} />;
}

type DashboardPeriod = "weekly" | "monthly" | "yearly";

function DashboardPage({
  data,
  openModal,
  onUrgentHandled,
}: {
  data: ReturnType<typeof useCoachData>;
  openModal: (name: ModalName) => void;
  onUrgentHandled: () => void;
}) {
  const [period,setPeriod]=useState<DashboardPeriod>("monthly");
  const [report,setReport]=useState<FinanceReport|null>(null);
  const [reportLoading,setReportLoading]=useState(false);
  const [reportError,setReportError]=useState("");
  const range=useMemo(()=>dashboardDateRange(period),[period]);
  useEffect(()=>{let active=true;setReportLoading(true);setReportError("");apiFetch<FinanceReport>(`/reports/finance/?from=${range.from}&to=${range.to}`).then(result=>{if(active)setReport(result)}).catch(()=>{if(active)setReportError("گزارش این بازه دریافت نشد.")}).finally(()=>{if(active)setReportLoading(false)});return()=>{active=false}},[range.from,range.to]);
  if (!data.isLoading && data.dashboard.total_athletes === 0) {
    return <CoachEmptyDashboard name={data.coach.user.full_name} openModal={openModal} />;
  }

  return (
    <>
      <DashboardStudents dashboard={data.dashboard} athletes={data.athletes}/>
      <DashboardFinance dashboard={data.dashboard} invoices={data.invoices} report={report} period={period} loading={reportLoading} error={reportError} onPeriod={setPeriod}/>
      <DashboardQuickAccess openModal={openModal}/>
      <DashboardFollowups tasks={data.tasks.filter(item=>item.auto!==false&&item.kind!=="personal")} onChanged={data.reload} onUrgentHandled={onUrgentHandled}/>
      <PersonalReminders tasks={data.tasks.filter(item=>item.auto===false||item.kind==="personal")} openModal={openModal} onChanged={data.reload}/>
    </>
  );
}

function dashboardDateRange(period:DashboardPeriod){const now=new Date();const start=new Date(now);if(period==="weekly"){const sinceSaturday=(now.getDay()+1)%7;start.setDate(now.getDate()-sinceSaturday)}else if(period==="monthly"){start.setDate(1)}else{start.setMonth(0,1)}const local=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;return{from:local(start),to:local(now)}}

function DashboardFinance({dashboard,invoices,report,period,loading,error,onPeriod}:{dashboard:CoachDashboardData;invoices:Invoice[];report:FinanceReport|null;period:DashboardPeriod;loading:boolean;error:string;onPeriod:(value:DashboardPeriod)=>void}){const totals=invoiceFinancialTotals(invoices);const metrics=[{title:"پیش‌بینی‌شده",value:report?.invoiced_total??dashboard.income_this_month+totals.open},{title:"دریافت‌شده",value:report?.paid_total??dashboard.income_this_month},{title:"در راه",value:totals.waiting},{title:"معوقات",value:totals.overdue},{title:"هزینه‌کرد",value:dashboard.expenses_this_month}];return <section className={`${styles.panel} ${styles.dashboardSection}`}><div className={styles.dashboardSectionHead}><h2>وضعیت مالی</h2><PeriodTabs value={period} onChange={onPeriod}/></div>{loading?<div className={styles.dashboardSectionLoading}/>:null}{error?<p className={styles.dashboardInlineError}>{error}</p>:null}<div className={styles.dashboardFinanceGrid}>{metrics.map(item=><article key={item.title}><CardTitle detailsHref="/financial">{item.title}</CardTitle><strong>{formatMoney(item.value)}</strong></article>)}</div></section>}

function stabilityGroups(dashboard:CoachDashboardData,athletes:RosterAthlete[]){const b=dashboard.stability_breakdown;const known=b.excellent+b.good+b.average+b.at_risk;const missing=Math.max(0,dashboard.total_athletes-known);const unclassified=athletes.filter(item=>!item.stability_band&&item.status!=="stalled");return[{title:"شاگردان منظم",value:b.excellent,tone:"green",items:athletes.filter(item=>item.stability_band==="excellent")},{title:"شاگردان خوب",value:b.good,tone:"yellow",items:athletes.filter(item=>item.stability_band==="good")},{title:"شاگردان متوسط",value:b.average+missing,tone:"orange",items:[...athletes.filter(item=>item.stability_band==="average"),...unclassified]},{title:"احتمال ریزش",value:b.at_risk,tone:"red",items:athletes.filter(item=>item.stability_band==="at_risk"||item.status==="stalled")}];}
function DashboardStudents({dashboard,athletes}:{dashboard:CoachDashboardData;athletes:RosterAthlete[]}){const groups=stabilityGroups(dashboard,athletes);return <section className={`${styles.panel} ${styles.dashboardSection}`}><div className={styles.dashboardSectionHead}><h2>وضعیت شاگردان</h2><CardDetailsMenu href="/students" vertical/></div><div className={styles.dashboardStudentGrid}>{groups.map(group=><article key={group.title}><CardTitle detailsHref="/students">{group.title}</CardTitle><div><strong className={styles[`dashboardTone${group.tone}`]}>{group.value.toLocaleString("fa-IR")} نفر</strong><span className={styles.dashboardAvatarPile}>{group.items.slice(0,5).map(item=><Avatar key={item.id}/>)}</span></div></article>)}</div></section>}

function DashboardQuickAccess({openModal}:{openModal:(name:ModalName)=>void}){return <section className={`${styles.panel} ${styles.dashboardQuick}`}><div className={styles.dashboardSectionHead}><h2>دسترسی سریع</h2></div><div><button className={styles.primaryButton} onClick={()=>openModal("student")}>ثبت شاگرد</button><button onClick={()=>{window.location.href="/workout-program"}}>برنامه‌های تمرینی</button><button onClick={()=>{window.location.href="/nutrition-program"}}>برنامه‌های غذایی</button><button onClick={()=>{window.location.href="/students"}}>لیست شاگردان</button></div></section>}

function dashboardTaskPriority(task:CoachTask){const today=new Date().toISOString().slice(0,10);return task.kind==="churn"||Boolean(task.due_date&&task.due_date<=today)?"urgent":"waiting"}
function dashboardTaskTarget(task:CoachTask){return task.kind==="nutrition_plan"?"/nutrition-program":task.kind==="training_plan"?"/workout-program":task.kind==="payment_follow_up"?"/financial":task.athlete?`/students?athlete=${task.athlete}`:"/actions"}
type TaskActionMode = "complete" | "snooze";
type TaskActionPayload = { description?: string; days?: number; due_date?: string; completed_on?: string };

function localDateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function taskDefaultDate() {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  return localDateValue(date);
}

function CoachTaskActionDialog({task,mode,pending,onClose,onSubmit}:{task:CoachTask;mode:TaskActionMode;pending:boolean;onClose:()=>void;onSubmit:(payload:TaskActionPayload)=>Promise<void>}) {
  const snooze = mode === "snooze";
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await onSubmit(snooze ? {days: Number(values.days || 2), due_date: String(values.due_date || "")} : {description: String(values.description || ""), completed_on: String(values.completed_on || localDateValue())});
  };
  return <div className={styles.overlay} onMouseDown={()=>!pending&&onClose()}><section className={`${styles.modal} ${styles.modalSmall} ${styles.taskActionModal}`} onMouseDown={event=>event.stopPropagation()}><ModalHead title={snooze?"یادآوری برای بعداً":"تکمیل پیگیری"} onClose={onClose}/><form className={styles.form} onSubmit={submit}><p className={styles.taskActionContext}>پیگیری «{task.title}»</p>{snooze?<><Field name="due_date" label="تاریخ یادآوری" type="date" defaultValue={task.due_date||taskDefaultDate()} required/><Field name="days" label="تعداد روز" type="number" min={1} defaultValue="2" required/></>:<><Field name="completed_on" label="تاریخ انجام" type="date" defaultValue={localDateValue()} required/><Textarea name="description" label="توضیحات" placeholder="توضیحات انجام پیگیری را بنویسید" required/></>}<ModalActions onClose={onClose} pending={pending} submitLabel={snooze?"ثبت یادآوری":"تکمیل پیگیری"}/></form></section></div>;
}

function DashboardFollowups({tasks,onChanged,onUrgentHandled}:{tasks:CoachTask[];onChanged:()=>Promise<void>;onUrgentHandled:()=>void}){const [filter,setFilter]=useState<"all"|"urgent"|"waiting">("all");const [pending,setPending]=useState<number|null>(null);const [taskAction,setTaskAction]=useState<{task:CoachTask;mode:TaskActionMode}|null>(null);const visible=tasks.filter(task=>task.status!=="done").filter(task=>filter==="all"||dashboardTaskPriority(task)===filter).slice(0,5);const act=async(task:CoachTask,action:TaskActionMode,payload?:TaskActionPayload)=>{setPending(task.id);try{await apiFetch(`/coach/tasks/${task.id}/${action}/`,{method:"POST",body:payload?JSON.stringify(payload):undefined});if(action==="complete"&&dashboardTaskPriority(task)==="urgent")onUrgentHandled();await onChanged();setTaskAction(null);showCoachToast(action==="complete"?"پیگیری با موفقیت انجام شد.":"پیگیری برای بعداً یادآوری می‌شود.","success")}catch{showCoachToast("انجام این عملیات ممکن نشد. دوباره تلاش کنید.","error")}finally{setPending(null)}};return <section className={`${styles.panel} ${styles.dashboardFollowups}`}><div className={styles.dashboardSectionHead}><h2>جدول پیگیری‌ها</h2><DashboardTableMenu/></div><div className={styles.followupFilters}>{[["all","همه موارد"],["urgent","فوری"],["waiting","در انتظار"]].map(([key,label])=><button className={filter===key?styles.followupFilterActive:""} onClick={()=>setFilter(key as typeof filter)} key={key}>{label}</button>)}</div>{visible.length?<div className={styles.followupTable}><div><span>کاربر / کاربران</span><span>نوع تسک</span><span>توضیح کوتاه</span><span>تاریخ</span><span>اولویت</span><span>عملیات</span></div>{visible.map(task=><article key={task.id}><span><Avatar/><b>{task.athlete_name||"بدون شاگرد"}<small>{task.athlete_phone||""}</small></b></span><span>{kindLabel(task.kind)}</span><span>{task.note||task.title}</span><span>{formatPersianDate(task.due_date)}</span><Status tone={dashboardTaskPriority(task)==="urgent"?"stalled":"needs_follow_up"}>{dashboardTaskPriority(task)==="urgent"?"فوری":"در انتظار"}</Status><span><button disabled={pending===task.id} onClick={()=>setTaskAction({task,mode:"complete"})}>انجام شد</button><button disabled={pending===task.id} onClick={()=>setTaskAction({task,mode:"snooze"})}>بعداً</button><button onClick={()=>{window.location.href=dashboardTaskTarget(task)}}>بررسی</button></span></article>)}</div>:<EmptyState title="موردی برای پیگیری وجود ندارد."/>}{taskAction?<CoachTaskActionDialog task={taskAction.task} mode={taskAction.mode} pending={pending===taskAction.task.id} onClose={()=>setTaskAction(null)} onSubmit={payload=>act(taskAction.task,taskAction.mode,payload)}/>:null}</section>}

function DashboardTableMenu(){const [open,setOpen]=useState(false);const wrap=useRef<HTMLSpanElement|null>(null);useEffect(()=>{if(!open)return;const close=(event:MouseEvent|KeyboardEvent)=>{if(event instanceof KeyboardEvent){if(event.key==="Escape")setOpen(false);return}if(!wrap.current?.contains(event.target as Node))setOpen(false)};document.addEventListener("mousedown",close);document.addEventListener("keydown",close);return()=>{document.removeEventListener("mousedown",close);document.removeEventListener("keydown",close)}},[open]);return <span className={styles.dashboardTableMenu} ref={wrap}><button aria-label="منوی جدول" aria-expanded={open} onClick={()=>setOpen(value=>!value)}><MenuDots/></button><button aria-label="نمایش کارتی"><Icon name="grid"/></button>{open?<span role="menu"><button role="menuitem" onClick={()=>{window.location.href="/students"}}>ورود به بخش شاگردان</button><button role="menuitem" onClick={()=>{window.location.href="/actions"}}>مشاهده بیشتر</button></span>:null}</span>}

function PersonalReminders({tasks,openModal,onChanged}:{tasks:CoachTask[];openModal:(name:ModalName)=>void;onChanged:()=>Promise<void>}){const [edit,setEdit]=useState<CoachTask|null>(null);const [remove,setRemove]=useState<CoachTask|null>(null);const [pending,setPending]=useState(false);const [taskActionPending,setTaskActionPending]=useState<number|null>(null);const [taskAction,setTaskAction]=useState<{task:CoachTask;mode:TaskActionMode}|null>(null);const activeTasks=tasks.filter(task=>task.status!=="done");const completedTasks=tasks.filter(task=>task.status==="done");const save=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!edit)return;setPending(true);const form=new FormData(event.currentTarget);try{await apiFetch(`/coach/tasks/${edit.id}/`,{method:"PATCH",body:JSON.stringify({title:form.get("title"),kind:form.get("kind"),due_date:form.get("due_date"),note:form.get("note")})});setEdit(null);await onChanged();showCoachToast("یادآوری با موفقیت ویرایش شد.","success")}catch{showCoachToast("ذخیره یادآوری انجام نشد. دوباره تلاش کنید.","error")}finally{setPending(false)}};const destroy=async()=>{if(!remove)return;setPending(true);try{await apiFetch(`/coach/tasks/${remove.id}/`,{method:"DELETE"});setRemove(null);await onChanged();showCoachToast("یادآوری حذف شد.","success")}catch{showCoachToast("حذف یادآوری انجام نشد.","error")}finally{setPending(false)}};const act=async(payload:TaskActionPayload)=>{if(!taskAction)return;setTaskActionPending(taskAction.task.id);try{await apiFetch(`/coach/tasks/${taskAction.task.id}/${taskAction.mode}/`,{method:"POST",body:JSON.stringify(payload)});await onChanged();setTaskAction(null);showCoachToast(taskAction.mode==="complete"?"یادآوری انجام شد.":"یادآوری برای بعداً ثبت شد.","success")}catch{showCoachToast("انجام این عملیات ممکن نشد. دوباره تلاش کنید.","error")}finally{setTaskActionPending(null)}};const taskRows=(rows:CoachTask[],history=false)=><div className={styles.reminderTable}><div><span>عنوان</span><span>دسته‌بندی</span><span>{history?"تاریخ انجام":"تاریخ"}</span><span>عملیات</span></div>{rows.slice(0,6).map(task=><article key={task.id}><span>{task.title}</span><span>{kindLabel(task.kind)}</span><span>{formatPersianDate(history?(task.completed_on||task.completed_at||task.due_date):task.due_date)}</span><span className={styles.reminderActions}>{history?<button aria-label="حذف" onClick={()=>setRemove(task)}><Icon name="trash"/></button>:<><button disabled={taskActionPending===task.id} onClick={()=>setTaskAction({task,mode:"complete"})}>انجام شد</button><button disabled={taskActionPending===task.id} onClick={()=>setTaskAction({task,mode:"snooze"})}>بعداً</button><button aria-label="ویرایش" onClick={()=>setEdit(task)}><Icon name="edit"/></button><button aria-label="حذف" onClick={()=>setRemove(task)}><Icon name="trash"/></button></>}</span></article>)}</div>;return <section className={`${styles.panel} ${styles.personalReminders}`}><div className={styles.dashboardSectionHead}><h2>یادآوری‌های شخصی</h2><button onClick={()=>openModal("personalTask")}><Icon name="plus"/>تسک جدید</button></div>{activeTasks.length?taskRows(activeTasks):<EmptyState title="یادآوری شخصی ثبت نشده است." action="تسک جدید" onAction={()=>openModal("personalTask")}/>} {completedTasks.length?<><div className={styles.reminderHistoryHead}><h3>تاریخچه تسک‌های انجام‌شده</h3></div>{taskRows(completedTasks,true)}</>:null}{taskAction?<CoachTaskActionDialog task={taskAction.task} mode={taskAction.mode} pending={taskActionPending===taskAction.task.id} onClose={()=>setTaskAction(null)} onSubmit={act}/>:null}{edit?<div className={styles.overlay} onMouseDown={()=>!pending&&setEdit(null)}><section className={styles.modal} onMouseDown={event=>event.stopPropagation()}><ModalHead title="ویرایش یادآوری" onClose={()=>setEdit(null)}/><form className={styles.form} onSubmit={save}><Field name="title" label="عنوان" defaultValue={edit.title} required/><Select name="kind" label="دسته‌بندی" defaultValue={edit.kind} options={[["personal","شخصی"],["payment_follow_up","پیگیری پرداخت"],["nutrition_plan","برنامه غذایی"],["training_plan","برنامه تمرینی"]]}/><Field name="due_date" label="تاریخ" type="date" defaultValue={edit.due_date||""}/><Textarea name="note" label="توضیحات" defaultValue={edit.note||""}/><ModalActions onClose={()=>setEdit(null)} pending={pending} submitLabel="ذخیره تغییرات"/></form></section></div>:null}{remove?<CoachConfirmDialog title="حذف یادآوری؟" description={`یادآوری «${remove.title}» حذف می‌شود.`} pending={pending} onCancel={()=>setRemove(null)} onConfirm={()=>void destroy()}/>:null}</section>}

function PeriodTabs({value,onChange}:{value:DashboardPeriod;onChange?:(value:DashboardPeriod)=>void}){return <div className={styles.segmented}>{[["weekly","هفتگی"],["monthly","ماهانه"],["yearly","سالانه"]].map(([key,label])=><button className={value===key?styles.segmentedActive:""} onClick={()=>onChange?.(key as DashboardPeriod)} key={key}>{label}</button>)}</div>}

function CoachEmptyDashboard({
  name,
  openModal,
}: {
  name?: string;
  openModal: (name: ModalName) => void;
}) {
  const firstName = name?.trim().split(" ")[0] || "مربی";

  return (
    <section className={styles.emptyDashboard}>
      <div className={styles.emptyDecoration} />
      <div className={styles.emptyWelcome}>
        <Image
          src="/assets/images/coach-empty-dashboard.png"
          width={168}
          height={168}
          alt=""
          priority
        />
        <h2>خوش اومدی {firstName}!</h2>
        <p>
          فعلا شاگردی نداری، ولی بجاش میتونی موارد زیر رو آماده کنی تا وقتی شاگرد جدید
          گرفتی آماده باشن.
        </p>
      </div>
      <div className={styles.emptySteps}>
        <article>
          <span>گام اول</span>
          <h3>آماده کردن برنامه تمرینی</h3>
          <p>برنامه تمرینی را تنظیم کنید تا برای اختصاص به شاگردان جدید آماده باشد.</p>
          <button onClick={() => openModal("workout")}><Icon name="check" /> آماده‌سازی</button>
        </article>
        <article>
          <span>گام دوم</span>
          <h3>آماده کردن برنامه غذایی</h3>
          <p>برنامه غذایی را تنظیم کنید تا متناسب با وضعیت شاگردان اختصاص دهید.</p>
          <button onClick={() => openModal("workout")}><Icon name="check" /> آماده‌سازی</button>
        </article>
        <article>
          <span>گام سوم</span>
          <h3>آماده کردن پلن‌های خدماتی</h3>
          <p>پلن‌های خدماتی خود را آماده کنید تا شاگردان از شرایط آنها مطلع باشند.</p>
          <button onClick={() => openModal("service")}>ساخت پلن</button>
        </article>
      </div>
    </section>
  );
}

function CardTitle({ children,detailsHref }: { children: React.ReactNode;detailsHref?:string }) {
  return (
    <div className={styles.cardTitle}>
      <h3>{children}</h3>
      <CardDetailsMenu href={detailsHref}/>
    </div>
  );
}

function MenuDots(){return <span className={styles.menuDots} aria-hidden="true"><i/><i/><i/></span>}

function CardDetailsMenu({href,vertical=false}:{href?:string;vertical?:boolean}){const [open,setOpen]=useState(false);const wrap=useRef<HTMLSpanElement|null>(null);useEffect(()=>{if(!open)return;const close=(event:MouseEvent|KeyboardEvent)=>{if(event instanceof KeyboardEvent){if(event.key==="Escape")setOpen(false);return}if(!wrap.current?.contains(event.target as Node))setOpen(false)};document.addEventListener("mousedown",close);document.addEventListener("keydown",close);return()=>{document.removeEventListener("mousedown",close);document.removeEventListener("keydown",close)}},[open]);return <span className={`${styles.cardMenu} ${vertical?styles.cardMenuVertical:""}`} ref={wrap}><button aria-label="منوی کارت" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(value=>!value)}><MenuDots/></button>{open?<span className={styles.cardMenuPopover} role="menu"><button role="menuitem" disabled={!href} onClick={()=>{if(href)window.location.href=href}}><Icon name="link"/>مشاهده جزئیات</button></span>:null}</span>}

function StudentProfile({athleteId}:{athleteId:number}) {
  const searchParams=useSearchParams();
  const [data,setData]=useState<Json|null>(null);
  const [logs,setLogs]=useState<Json[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [tab,setTab]=useState<"progress"|"plans"|"financial"|"notes">("progress");
  const [sessionOpen,setSessionOpen]=useState(searchParams.get("session")==="1");
  const [sessionPending,setSessionPending]=useState(false);
  const [sessionError,setSessionError]=useState("");
  const [editOpen,setEditOpen]=useState(searchParams.get("edit")==="1");
  const [editPending,setEditPending]=useState(false);
  const [editError,setEditError]=useState("");
  const load=useCallback(async()=>{setLoading(true);setError("");try{const [dossier,workoutLogs]=await Promise.all([apiFetch<Json>(`/coach/athletes/${athleteId}/dossier/`),apiFetch<Paginated<Json>|Json[]>("/coach/workout-logs/").catch(()=>[])]);setData(dossier);setLogs(toArray(workoutLogs).filter(item=>Number(item.athlete)===athleteId));}catch{setError("دریافت پرونده شاگرد انجام نشد.")}finally{setLoading(false)}},[athleteId]);
  useEffect(()=>{void load()},[load]);
  if(loading)return <div className={styles.loadingLine}/>;
  if(error||!data)return <div className={styles.emptyState}><Icon name="alert" size={32}/><p>{error||"پرونده‌ای دریافت نشد."}</p><button onClick={()=>{window.location.href="/students"}}>بازگشت به شاگردان</button></div>;
  const athlete=(data.athlete??{}) as Json;
  const user=(athlete.user??{}) as Json;
  const plans=toArray<Json>(data.plans as Json[]);
  const invoices=toArray<Json>(data.pending_invoices as Json[]);
  const payments=toArray<Json>(data.payment_history as Json[]);
  const outstanding=invoices.reduce((sum,item)=>sum+Number(item.outstanding??0),0);
  const paid=payments.reduce((sum,item)=>sum+Number(item.amount??0),0);
  const weightHistory=toArray<Json>((athlete.weight_history??athlete.measurements) as Json[]).map(item=>Number(item.weight??item.value)).filter(Number.isFinite);
  const submitSession=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();setSessionPending(true);setSessionError("");const values=Object.fromEntries(new FormData(event.currentTarget).entries());try{await apiFetch("/coach/workout-logs/",{method:"POST",body:JSON.stringify({...values,athlete:athleteId,duration_min:Number(values.duration_min||0),calories:Number(values.calories||0)})});setSessionOpen(false);await load()}catch{setSessionError("ثبت جلسه انجام نشد. اطلاعات را بررسی و دوباره تلاش کنید.")}finally{setSessionPending(false)}};
  const closeEdit=()=>{setEditOpen(false);window.history.replaceState({},"",`/students?athlete=${athleteId}`)};
  const submitEdit=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();setEditPending(true);setEditError("");const values=Object.fromEntries(new FormData(event.currentTarget).entries());const numeric=(name:string)=>values[name]===""?null:Number(values[name]);try{await apiFetch(`/coach/athletes/${athleteId}/`,{method:"PATCH",body:JSON.stringify({height:numeric("height"),weight:numeric("weight"),target_weight:numeric("target_weight"),training_days:numeric("training_days"),goal:values.goal,level:values.level,injuries:values.injuries})});closeEdit();await load()}catch{setEditError("ذخیره اطلاعات شاگرد انجام نشد.")}finally{setEditPending(false)}};
  return <>
    <section className={`${styles.panel} ${styles.studentProfileHero}`}>
      <div className={styles.studentProfileTitle}><button onClick={()=>{window.location.href="/students"}} aria-label="بازگشت"><Icon name="arrow"/></button><h2>پروفایل شاگرد</h2><button aria-label="منوی پروفایل"><MenuDots/></button></div>
      <div className={styles.studentProfileIntro}><div className={styles.profileIdentity}><Avatar/><div><h2>{String(user.full_name??"شاگرد")}</h2><span>آخرین حضور: {String(athlete.last_workout_on??"ثبت نشده")}</span><div className={styles.profileBadges}><Status tone={String(athlete.status??"")}>{statusLabel(String(athlete.status??""))}</Status><span>{goalLabel(String(athlete.goal??""))}</span><span>{levelLabel(String(athlete.level??""))}</span></div><small>{String(user.phone??"")} <i/> {String(athlete.age??"-")} سال <i/> {genderLabel(String(athlete.gender??""))}</small></div></div><div className={styles.profileQuickActions}><button className={styles.primaryButton} onClick={()=>setSessionOpen(true)}><Icon name="plus"/>ثبت جلسه</button><button className={styles.profileDarkButton} onClick={()=>{window.location.href="/services"}}>ثبت سرویس</button><button onClick={()=>{window.location.href=`/workout-program?athlete=${athleteId}`}}>ارسال برنامه</button><button aria-label="ارسال پیام"><Icon name="students"/></button></div></div>
      <div className={styles.studentMetricGrid}><article><CardTitle>وزن فعلی</CardTitle><strong>{athlete.weight!=null?`${athlete.weight} کیلوگرم`:"-"}</strong><span>هدف: {String(athlete.target_weight??"-")} کیلوگرم</span></article><article><CardTitle>پیشرفت</CardTitle><strong>{String(athlete.progress_pct??"-")}٪</strong><i><b style={{width:`${Number(athlete.progress_pct??0)}%`}}/></i></article><article><CardTitle>پایبندی</CardTitle><strong>{String(athlete.adherence_pct??"-")}٪</strong><Status tone={String(athlete.adherence_band??"")}>{adherenceLabel(String(athlete.adherence_band??""))}</Status></article></div>
    </section>
    <div className={styles.profileInfoGrid}><section className={styles.panel}><div className={styles.profileSectionHead}><h2>اطلاعات فیزیکی</h2><button onClick={()=>setEditOpen(true)}>ویرایش</button></div><div className={styles.physicalRows}>{[["قد",unit(athlete.height,"سانتی متر")],["وزن شروع",unit(athlete.start_weight??athlete.initial_weight,"کیلوگرم")],["وزن هدف",unit(athlete.target_weight,"کیلوگرم")],["درصد چربی",unit(athlete.body_fat_pct,"٪")],["دور سینه",unit(athlete.chest_cm,"سانتی متر")],["دور کمر",unit(athlete.waist_cm,"سانتی متر")],["دور بازو",unit(athlete.arm_cm,"سانتی متر")],["دور ران",unit(athlete.thigh_cm,"سانتی متر")],["روز تمرین در هفته",unit(athlete.training_days,"روز")]].map(([label,val])=><p key={String(label)}><span>{String(label)}</span><b>{String(val)}</b></p>)}</div></section><section className={styles.panel}><div className={styles.profileSectionHead}><h2>وضعیت مالی</h2></div><div className={styles.financialSummary}><p><span>بدهی از قبل</span><b>{formatMoney(Number(athlete.debt??0))}</b></p><p><span>در انتظار (ماه جاری)</span><b>{formatMoney(outstanding)}</b></p><p><span>پرداخت شده</span><b>{formatMoney(paid)}</b></p></div><button className={styles.financialDetails} onClick={()=>setTab("financial")}>جزئیات مالی</button></section></div>
    <div className={styles.profileTabs}>{[["progress","پیشرفت"],["plans","برنامه"],["financial","مالی"],["notes","یادداشت"]].map(([key,label])=><button key={key} className={tab===key?styles.profileTabActive:""} onClick={()=>setTab(key as typeof tab)}>{label}</button>)}</div>
    {tab==="progress"?<><section className={styles.panel}><div className={styles.profileSectionHead}><h2>نمودار وزن</h2><select aria-label="ماه نمودار"><option>تیرماه</option></select></div><ProfileWeightChart values={weightHistory}/></section><SessionHistory logs={logs} athlete={athlete} user={user} onAdd={()=>setSessionOpen(true)}/></>:null}
    {tab==="plans"?<DossierRows title="تاریخچه برنامه‌ها" items={plans}/>:null}
    {tab==="financial"?<><DossierRows title="در انتظار پرداخت" items={invoices}/><DossierRows title="سابقه پرداخت" items={payments}/></>:null}
    {tab==="notes"?<section className={styles.panel}><PanelHead title="یادداشت‌ها"/><div className={styles.profileNotes}>{athlete.injuries?<p>{String(athlete.injuries)}</p>:<EmptyState title="یادداشتی برای این شاگرد ثبت نشده است."/>}</div></section>:null}
    {sessionOpen?<div className={styles.overlay} onMouseDown={()=>!sessionPending&&setSessionOpen(false)}><section className={styles.modal} onMouseDown={event=>event.stopPropagation()}><ModalHead title="ثبت جلسه جدید" onClose={()=>setSessionOpen(false)}/><form className={styles.form} onSubmit={submitSession}><div className={styles.formGrid}><Select label="نوع تمرین" name="kind" options={[["strength","قدرتی"],["cardio","هوازی"],["other","سایر"]]}/><Field label="تاریخ جلسه" name="logged_on" type="date" required/><Field label="مدت تمرین (دقیقه)" name="duration_min" type="number" min="0"/><Field label="کالری مصرفی" name="calories" type="number" min="0"/></div><Textarea label="یادداشت" name="note"/>{sessionError?<p className={styles.formError}>{sessionError}</p>:null}<ModalActions onClose={()=>setSessionOpen(false)} pending={sessionPending} submitLabel="ثبت جلسه"/></form></section></div>:null}
    {editOpen?<div className={styles.overlay} onMouseDown={()=>!editPending&&closeEdit()}><section className={styles.modal} onMouseDown={event=>event.stopPropagation()}><ModalHead title="ویرایش اطلاعات شاگرد" onClose={closeEdit}/><form className={styles.form} onSubmit={submitEdit}><div className={styles.formGrid}><Field label="قد (سانتی متر)" name="height" type="number" min="0" step="0.1" defaultValue={String(athlete.height??"")}/><Field label="وزن فعلی (کیلوگرم)" name="weight" type="number" min="0" step="0.1" defaultValue={String(athlete.weight??"")}/><Field label="وزن هدف (کیلوگرم)" name="target_weight" type="number" min="0" step="0.1" defaultValue={String(athlete.target_weight??"")}/><Field label="روز تمرین در هفته" name="training_days" type="number" min="0" max="7" defaultValue={String(athlete.training_days??"")}/><Select label="هدف" name="goal" defaultValue={String(athlete.goal??"")} options={[["weight_loss","کاهش وزن"],["muscle_gain","افزایش حجم"],["fitness","تناسب اندام"],["maintenance","حفظ وزن"]]}/><Select label="سطح" name="level" defaultValue={String(athlete.level??"")} options={[["beginner","مبتدی"],["intermediate","متوسط"],["advanced","حرفه‌ای"]]}/></div><Textarea label="آسیب‌دیدگی و محدودیت‌ها" name="injuries" defaultValue={String(athlete.injuries??"")}/><FormError error={editError}/><ModalActions onClose={closeEdit} pending={editPending} submitLabel="ذخیره تغییرات"/></form></section></div>:null}
  </>;
}

function goalLabel(value:string){return ({weight_loss:"کاهش وزن",muscle_gain:"افزایش حجم",fitness:"تناسب اندام",maintenance:"حفظ وزن"} as Record<string,string>)[value]??(value||"هدف ثبت نشده")}
function levelLabel(value:string){return ({beginner:"مبتدی",intermediate:"متوسط",advanced:"حرفه‌ای"} as Record<string,string>)[value]??(value||"سطح ثبت نشده")}
function genderLabel(value:string){return value==="male"?"مرد":value==="female"?"زن":"-"}
function adherenceLabel(value:string){return ({excellent:"عالی",good:"خوب",average:"متوسط",at_risk:"ضعیف"} as Record<string,string>)[value]??"نامشخص"}
function unit(value:unknown,label:string){return value==null||value===""?"-":`${String(value)} ${label}`}
function weekdayLabel(value:unknown){if(!value)return "-";const date=new Date(`${String(value)}T12:00:00`);return Number.isNaN(date.getTime())?"-":new Intl.DateTimeFormat("fa-IR-u-ca-persian",{weekday:"long"}).format(date)}

function ProfileWeightChart({values}:{values:number[]}) { if(values.length<2)return <EmptyState title="تاریخچه وزن از وب‌سرویس دریافت نشده است."/>; const max=Math.max(...values);const min=Math.min(...values);const range=Math.max(1,max-min);const points=values.map((item,index)=>`${index*100/(values.length-1)},${90-(item-min)*70/range}`).join(" ");return <div className={styles.profileWeightChart}><svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="weight-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#22a778" stopOpacity=".18"/><stop offset="1" stopColor="#22a778" stopOpacity="0"/></linearGradient></defs><polygon points={`0,100 ${points} 100,100`} fill="url(#weight-fill)"/><polyline points={points} fill="none" stroke="#18a673" strokeWidth="1.2" vectorEffect="non-scaling-stroke"/></svg></div> }

function SessionHistory({logs,athlete,user,onAdd}:{logs:Json[];athlete:Json;user:Json;onAdd:()=>void}) { return <section className={styles.panel}><div className={styles.sessionHead}><h2>تاریخچه جلسات</h2><button className={styles.primaryButton} onClick={onAdd}><Icon name="plus"/>ثبت جلسه</button></div>{logs.length?<div className={styles.sessionTable}><div><b>کاربر</b><b>تاریخ</b><b>روز</b><b>وضعیت</b></div>{logs.map((item,index)=><div key={String(item.id??index)}><span className={styles.studentIdentity}><Avatar/><b>{String(user.full_name??"شاگرد")}<small>{String(user.phone??"")}</small></b></span><span>{formatPersianDate(String(item.logged_on??""))}</span><span>{weekdayLabel(item.logged_on)}</span><Status tone="active">{Number(item.duration_min??0)>0?"حضور":"ثبت شده"}</Status></div>)}</div>:<EmptyState title={`جلسه‌ای برای ${String((athlete.user as Json)?.full_name??user.full_name??"این شاگرد")} ثبت نشده است.`}/>}</section> }

function DossierRows({title,items}:{title:string;items:Json[]}) { const keys=items.length?Object.keys(items[0]).filter(key=>!['id'].includes(key)).slice(0,6):[]; return <section className={styles.panel}><PanelHead title={title}/>{items.length?<div className={styles.dossierTable}><div>{keys.map(key=><b key={key}>{key.replaceAll("_"," ")}</b>)}</div>{items.map((item,index)=><div key={String(item.id??index)}>{keys.map(key=><span key={key}>{typeof item[key]==="object"?"-":String(item[key]??"-")}</span>)}</div>)}</div>:<EmptyState title="اطلاعاتی از وب‌سرویس دریافت نشده است."/>}</section> }

function StudentsPage({
  athletes,
  dashboard,
  openModal,
  onChanged,
}: {
  athletes: RosterAthlete[];
  dashboard: CoachDashboardData;
  openModal: (name: ModalName) => void;
  onChanged: () => Promise<void>;
}) {
  const inactive = Math.max(0, dashboard.total_athletes - dashboard.active_athletes);
  const totalShare = dashboard.total_athletes > 0 ? 100 : null;
  const activeShare = dashboard.total_athletes > 0 ? Math.round((dashboard.active_athletes / dashboard.total_athletes) * 100) : null;
  const inactiveShare = dashboard.total_athletes > 0 ? Math.round((inactive / dashboard.total_athletes) * 100) : null;
  return (
    <>
      <section className={`${styles.panel} ${styles.studentsOverview}`}>
        <PanelHead title="مروری بر آمار" />
        <div className={styles.summaryGrid}>
          <SummaryCard title="همه شاگردان" value={`${dashboard.total_athletes} نفر`} change={dashboard.total_athletes_change_pct ?? totalShare} changeLabel={dashboard.total_athletes_change_pct == null ? "از کل شاگردان" : "نسبت به ماه پیش"} />
          <SummaryCard title="شاگردان فعال" value={`${dashboard.active_athletes} نفر`} tone="green" change={dashboard.active_athletes_change_pct ?? activeShare} changeLabel={dashboard.active_athletes_change_pct == null ? "از کل شاگردان" : "نسبت به ماه پیش"} />
          <SummaryCard title="شاگردان غیرفعال" value={`${inactive} نفر`} change={dashboard.inactive_athletes_change_pct ?? inactiveShare} changeLabel={dashboard.inactive_athletes_change_pct == null ? "از کل شاگردان" : "نسبت به ماه پیش"} />
        </div>
      </section>
      <section className={`${styles.panel} ${styles.stabilityPanel}`}>
        <PanelHead title="وضعیت شاگردان" />
        <div className={styles.stabilityCards}>
          {stabilityGroups(dashboard, athletes).map(group => <StabilityCard key={group.title} title={group.title} count={group.value} tone={group.tone as "green"|"yellow"|"orange"|"red"} athletes={group.items}/>)}
        </div>
      </section>
      <StudentDirectory athletes={athletes} openModal={openModal} onChanged={onChanged}/>
    </>
  );
}

function StabilityCard({title,count,tone,athletes}:{title:string;count:number;tone:"green"|"yellow"|"orange"|"red";athletes:RosterAthlete[]}) {
  return <article className={styles.stabilityCard}><header><span>{title}</span><CardDetailsMenu href="/students"/></header><div><strong className={styles[`stability${tone}`]}>{count.toLocaleString("fa-IR")} نفر</strong><span className={styles.avatarPile}>{athletes.slice(0,5).map(item=><Avatar key={item.id}/>)}</span></div></article>;
}

function StudentDirectory({athletes,openModal,onChanged}:{athletes:RosterAthlete[];openModal:(name:ModalName)=>void;onChanged:()=>Promise<void>}) {
  const [view,setView]=useState<"list"|"grid">("list");
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState("all");
  const [display,setDisplay]=useState<"active"|"inactive">("active");
  const [sort,setSort]=useState("priority");
  const [sortOpen,setSortOpen]=useState(false);
  const filtered=useMemo(()=>athletes.filter(athlete=>{
    const matchesQuery=!query||`${athlete.user.full_name} ${athlete.user.phone}`.includes(query);
    const matchesFilter=filter==="all"||(filter==="excellent"&&athlete.stability_band==="excellent")||(filter==="good"&&athlete.stability_band==="good")||(filter==="average"&&athlete.stability_band==="average")||(filter==="at_risk"&&(athlete.stability_band==="at_risk"||athlete.status==="stalled"));
    return matchesQuery&&matchesFilter&&Boolean(athlete.is_active)!==(display==="inactive");
  }).sort((a,b)=>{if(sort==="priority"){const rank:Record<string,number>={at_risk:0,average:1,good:2,excellent:3};return (rank[a.stability_band??""]??4)-(rank[b.stability_band??""]??4)}if(sort==="name")return a.user.full_name.localeCompare(b.user.full_name,"fa");if(sort==="debt")return Number(b.debt??0)-Number(a.debt??0);if(sort==="progress")return Number(b.progress_pct??b.adherence_pct??0)-Number(a.progress_pct??a.adherence_pct??0);if(sort==="workout")return String(a.last_workout_on??"").localeCompare(String(b.last_workout_on??""));return 0}),[athletes,display,filter,query,sort]);
  const sortOptions=[["priority","در خطرها در ابتدا"],["name","بر اساس نام"],["debt","بیشترین بدهی"],["workout","قدیمی‌ترین تمرین"],["progress","بیشترین پیشرفت"]];
  return <section className={`${styles.panel} ${styles.studentDirectory}`}>
    <div className={styles.studentDirectoryHead}><h2>شاگردان من</h2><div><button className={view==="list"?styles.viewActive:""} onClick={()=>setView("list")} aria-label="نمایش لیستی"><Icon name="menu"/></button><button className={view==="grid"?styles.viewActive:""} onClick={()=>setView("grid")} aria-label="نمایش کارتی"><Icon name="grid"/></button><button aria-label="منوی شاگردان"><MenuDots/></button></div></div>
    <div className={styles.studentTools}><div className={styles.sortWrap}><button className={sortOpen?styles.sortButtonOpen:""} onClick={()=>setSortOpen(value=>!value)}><Icon name="filter"/>{sortOptions.find(item=>item[0]===sort)?.[1]}</button>{sortOpen?<div className={styles.sortMenu}>{sortOptions.map(([key,label])=><button className={sort===key?styles.sortSelected:""} key={key} onClick={()=>{setSort(key);setSortOpen(false)}}>{label}{sort===key?<Icon name="check"/>:null}</button>)}</div>:null}</div><label className={styles.studentSearch}><Icon name="search"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="جستجو نام، موبایل یا..."/></label></div>
    <div className={styles.studentFilterRows}><div className={styles.studentFilters}>{[["all","همه"],["excellent","منظم"],["good","خوب"],["average","متوسط"],["at_risk","در خطر"]].map(([key,label])=><button className={filter===key?styles.studentFilterActive:""} onClick={()=>setFilter(key)} key={key}>{label}</button>)}</div><div className={styles.studentFilters}><button className={display==="active"?styles.studentFilterActive:""} onClick={()=>setDisplay("active")}>فعال‌ها</button><button className={display==="inactive"?styles.studentFilterActive:""} onClick={()=>setDisplay("inactive")}>غیرفعال‌ها / از دست‌رفته</button></div></div>
    {filtered.length?view==="list"?<StudentsTable athletes={filtered} onChanged={onChanged}/>:<StudentGrid athletes={filtered} openModal={openModal} onChanged={onChanged}/>:<EmptyState title="شاگردی با این مشخصات پیدا نشد." action="شاگرد جدید" onAction={()=>openModal("student")}/>} 
  </section>;
}

function StudentsTable({ athletes, compact = false, onChanged }: { athletes: RosterAthlete[]; compact?: boolean; onChanged?: () => Promise<void> }) {
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<RosterAthlete | null>(null);
  const toggleArchive = async (athlete: RosterAthlete) => {
    const id=athlete.id;
    setPendingId(id);
    try { await apiFetch(`/coach/athletes/${id}/${athlete.is_active===false?"unarchive":"archive"}/`, { method: "POST" }); await onChanged?.(); }
    finally { setPendingId(null); }
  };
  if (athletes.length === 0) {
    return (
      <section className={compact ? styles.panel : styles.studentsSurface}>
        {compact ? <PanelHead title="شاگردان اخیر" /> : null}
        <EmptyState title="هنوز شاگردی از وب‌سرویس دریافت نشده است." />
      </section>
    );
  }

  return (
    <section className={compact ? styles.panel : styles.studentsSurface}>
      {compact ? <PanelHead title="شاگردان اخیر" /> : null}
      <div className={styles.studentsTable}>
        <div className={styles.tableHeader}>
          <span>کاربر</span>
          <span>آخرین تمرین</span>
          <span>پایداری</span>
          <span>مالی</span>
          <span>برنامه</span>
          <span>پیشرفت</span>
          <span>عملیات</span>
        </div>
        {athletes.map((athlete) => (
          <div className={styles.studentRow} key={athlete.id}>
            <span className={styles.studentIdentity}>
              <Avatar />
              <b>
                {athlete.user.full_name}
                <small>{athlete.user.phone}</small>
              </b>
            </span>
            <span>{athlete.last_workout_on ?? "ثبت نشده"}</span>
            <Status tone={athlete.stability_band === "at_risk" ? "stalled" : athlete.stability_band === "excellent" ? "active" : undefined}>{stabilityLabel(athlete.stability_band)}</Status>
            <span className={`${styles.financialCell} ${Number(athlete.debt??0)>0?styles.debtText:""}`}>
              {Number(athlete.debt??0)>0?<><strong>{formatMoney(athlete.debt)}</strong><small>بدهکار</small></>:<span>-</span>}
            </span>
            <Status tone={athlete.program_expiring?"needs_follow_up":athlete.is_active?"active":"inactive"}>{athlete.program_expiring?"رو به انقضا":athlete.is_active?"فعال":"غیرفعال"}</Status>
            <span className={styles.progress}>
              <i><b style={{ width: `${athlete.progress_pct ?? athlete.adherence_pct ?? 0}%` }} /></i>
              {athlete.progress_pct ?? athlete.adherence_pct ?? "-"}٪
            </span>
            <span className={styles.rowActions}>
              <button aria-label="نمایش پرونده" onClick={() => { window.location.href = `/students?athlete=${athlete.id}`; }}><Icon name="students" /></button>
              <button aria-label="ویرایش شاگرد" onClick={() => { window.location.href = `/students?athlete=${athlete.id}&edit=1`; }}><Icon name="edit" /></button>
              <button className={athlete.is_active===false?styles.restoreAction:styles.dangerAction} aria-label={athlete.is_active===false?"فعال کردن":"غیرفعال کردن"} disabled={pendingId === athlete.id} onClick={() => setArchiveTarget(athlete)}><Icon name={athlete.is_active===false?"refresh":"trash"} /></button>
            </span>
          </div>
        ))}
      </div>
      {archiveTarget ? <CoachConfirmDialog title={archiveTarget.is_active===false?"فعال کردن مجدد شاگرد؟":"غیرفعال کردن شاگرد؟"} description={archiveTarget.is_active===false?`${archiveTarget.user.full_name} دوباره به فهرست شاگردان فعال برمی‌گردد.`:`داده‌های ${archiveTarget.user.full_name} حذف نمی‌شود، اما برنامه‌ها و تسک‌های فعال او متوقف می‌شوند.`} pending={pendingId === archiveTarget.id} onCancel={() => setArchiveTarget(null)} onConfirm={() => void toggleArchive(archiveTarget).then(() => setArchiveTarget(null))} /> : null}
    </section>
  );
}

function stabilityLabel(band?:string){return ({excellent:"منظم",good:"خوب",average:"متوسط",at_risk:"در خطر"} as Record<string,string>)[band??""]??"نامشخص"}

function StudentGrid({athletes,openModal,onChanged}:{athletes:RosterAthlete[];openModal:(name:ModalName)=>void;onChanged:()=>Promise<void>}) {
  const [target,setTarget]=useState<RosterAthlete|null>(null); const [pending,setPending]=useState(false);
  const archive=async()=>{if(!target)return;setPending(true);try{await apiFetch(`/coach/athletes/${target.id}/${target.is_active===false?"unarchive":"archive"}/`,{method:"POST"});setTarget(null);await onChanged()}finally{setPending(false)}};
  return <><div className={styles.studentGrid}>{athletes.map(athlete=><article key={athlete.id}><header><Avatar/><div><b>{athlete.user.full_name}</b><small>آخرین تمرین: {athlete.last_workout_on??"ثبت نشده"}</small></div><span className={styles.progressRing}>{athlete.progress_pct??athlete.adherence_pct??"-"}٪</span></header><div className={styles.studentCardMeta}><Status tone={athlete.stability_band==="at_risk"?"stalled":athlete.stability_band==="excellent"?"active":undefined}>{stabilityLabel(athlete.stability_band)}</Status><span>{athlete.goal||"هدف ثبت نشده"}</span></div><footer><button aria-label="پرونده" onClick={()=>{window.location.href=`/students?athlete=${athlete.id}`}}><Icon name="students"/></button><button aria-label="ویرایش" onClick={()=>openModal("student")}><Icon name="edit"/></button><button className={athlete.is_active===false?styles.restoreAction:styles.dangerAction} aria-label={athlete.is_active===false?"فعال کردن":"غیرفعال کردن"} onClick={()=>setTarget(athlete)}><Icon name={athlete.is_active===false?"refresh":"trash"}/></button></footer></article>)}</div>{target?<CoachConfirmDialog title={target.is_active===false?"فعال کردن مجدد شاگرد؟":"غیرفعال کردن شاگرد؟"} description={`آیا از تغییر وضعیت ${target.user.full_name} مطمئن هستید؟`} pending={pending} onCancel={()=>setTarget(null)} onConfirm={()=>void archive()}/>:null}</>;
}

function ActionsPage({ tasks, openModal, onChanged }: { tasks: CoachTask[]; openModal: (name: ModalName) => void; onChanged?: () => Promise<void> }) {
  const [scope,setScope]=useState<"today"|"upcoming"|"open"|"done">("today");
  const [query,setQuery]=useState("");
  const [sort,setSort]=useState<"default"|"date"|"priority">("default");
  const today=new Date().toISOString().slice(0,10);
  const personal=tasks.filter(task=>task.auto===false||task.kind==="personal");
  const system=tasks.filter(task=>task.auto!==false&&task.kind!=="personal");
  const normalized=normalizeSearch(query);
  const visible=system.filter(task=>scope==="done"?task.status==="done":scope==="open"?task.status!=="done":scope==="upcoming"?task.status!=="done"&&Boolean(task.due_date&&task.due_date>today):task.status!=="done"&&(!task.due_date||task.due_date<=today)).filter(task=>!normalized||normalizeSearch(`${task.title} ${task.note??""} ${task.athlete_name??""} ${kindLabel(task.kind)}`).includes(normalized)).sort((a,b)=>{if(sort==="date")return String(a.due_date??"9999").localeCompare(String(b.due_date??"9999"));if(sort==="priority"){const rank:Record<string,number>={churn:0,payment_follow_up:1,training_plan:2,nutrition_plan:3};return(rank[a.kind]??4)-(rank[b.kind]??4)}return a.id-b.id});
  return (
    <>
      <section className={`${styles.panel} ${styles.actionsPanel}`}>
        <div className={styles.actionsHead}><h2>تسک‌های سیستمی</h2><button aria-label="منوی تسک‌های سیستمی"><MenuDots/></button></div>
        <div className={styles.actionsToolbar}>
          <label><Icon name="search"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="جستجو کنید..." aria-label="جستجو در اقدامات"/>{query?<button onClick={()=>setQuery("")} aria-label="پاک کردن جستجو"><Icon name="close"/></button>:null}</label>
          <label className={styles.actionsSort}><Icon name="filter"/><select value={sort} onChange={event=>setSort(event.target.value as typeof sort)} aria-label="مرتب‌سازی اقدامات"><option value="default">پیش‌فرض</option><option value="date">نزدیک‌ترین تاریخ</option><option value="priority">اولویت</option></select></label>
        </div>
        <div className={styles.actionsTabs}>{[["today","امروز"],["upcoming","آینده"],["open","باز"],["done","انجام شده"]].map(([key,label])=><button key={key} className={scope===key?styles.actionsTabActive:""} onClick={()=>setScope(key as typeof scope)}>{label}</button>)}</div>
        <div className={styles.actionsTaskGrid}>
          {visible.length ? visible.map((task) => (
            <TaskCard task={task} key={task.id} onChanged={onChanged} />
          )) : <ActionsEmpty hasQuery={Boolean(normalized)} />}
        </div>
      </section>
      <ActionsPersonalReminders tasks={personal} openModal={openModal} onChanged={onChanged??(async()=>{})}/>
    </>
  );
}

function ActionsEmpty({hasQuery}:{hasQuery:boolean}){return <div className={styles.actionsEmpty}><Image src="/assets/images/coach-empty-dashboard.png" width={118} height={118} alt=""/><h3>{hasQuery?"نتیجه‌ای پیدا نشد":"خوش آمدی مربی!"}</h3><p>{hasQuery?"عبارت یا فیلتر دیگری را امتحان کنید.":"تسک‌های سیستمی بعد از ثبت شاگرد و برنامه‌ریزی فعالیت‌ها اینجا نمایش داده می‌شوند."}</p></div>}

function ActionsPersonalReminders({tasks,openModal,onChanged}:{tasks:CoachTask[];openModal:(name:ModalName)=>void;onChanged:()=>Promise<void>}){
  const [edit,setEdit]=useState<CoachTask|null>(null);const [remove,setRemove]=useState<CoachTask|null>(null);const [pending,setPending]=useState<number|null>(null);const [error,setError]=useState("");
  const act=async(task:CoachTask,action:"complete"|"snooze")=>{setPending(task.id);try{await apiFetch(`/coach/tasks/${task.id}/${action}/`,{method:"POST",body:action==="snooze"?JSON.stringify({days:1}):undefined});await onChanged()}finally{setPending(null)}};
  const save=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!edit)return;setPending(edit.id);setError("");const form=new FormData(event.currentTarget);try{await apiFetch(`/coach/tasks/${edit.id}/`,{method:"PATCH",body:JSON.stringify({title:form.get("title"),kind:form.get("kind"),due_date:form.get("due_date")||null,note:form.get("note")})});setEdit(null);await onChanged()}catch{setError("ویرایش یادآوری انجام نشد.")}finally{setPending(null)}};
  const destroy=async()=>{if(!remove)return;setPending(remove.id);try{await apiFetch(`/coach/tasks/${remove.id}/`,{method:"DELETE"});setRemove(null);await onChanged()}finally{setPending(null)}};
  return <section className={`${styles.panel} ${styles.actionsPersonal}`}><div className={styles.actionsPersonalHead}><h2>یادآوری‌های شخصی</h2><button onClick={()=>openModal("personalTask")}><Icon name="plus"/>تسک جدید</button></div>{tasks.length?<div className={styles.actionsPersonalTable}><div><span>عنوان</span><span>کاربر</span><span>تاریخ</span><span>یادداشت</span><span>عملیات</span></div>{tasks.map(task=><article key={task.id}><span>{task.title}</span><span><Avatar/>{task.athlete_name||"بدون شاگرد"}</span><span>{formatPersianDate(task.due_date)}</span><span>{task.note||"-"}</span><span><button disabled={pending===task.id||task.status==="done"} onClick={()=>void act(task,"complete")}>انجام شد</button><button disabled={pending===task.id||task.status==="done"} onClick={()=>void act(task,"snooze")}>بعداً</button><button aria-label="ویرایش" disabled={pending===task.id} onClick={()=>setEdit(task)}><Icon name="edit"/></button><button aria-label="حذف" disabled={pending===task.id} onClick={()=>setRemove(task)}><Icon name="trash"/></button></span></article>)}</div>:<EmptyState title="یادآوری شخصی ثبت نشده است." action="تسک جدید" onAction={()=>openModal("personalTask")}/>} {edit?<div className={styles.overlay} onMouseDown={()=>pending===null&&setEdit(null)}><section className={styles.modal} onMouseDown={event=>event.stopPropagation()}><ModalHead title="ویرایش یادآوری" onClose={()=>setEdit(null)}/><form className={styles.form} onSubmit={save}><Field name="title" label="عنوان" defaultValue={edit.title} required/><Select name="kind" label="دسته‌بندی" defaultValue={edit.kind} options={[["personal","شخصی"],["payment_follow_up","پیگیری پرداخت"],["nutrition_plan","برنامه غذایی"],["training_plan","برنامه تمرینی"]]}/><Field name="due_date" label="تاریخ" type="date" defaultValue={edit.due_date||""}/><Textarea name="note" label="توضیحات" defaultValue={edit.note||""}/><FormError error={error}/><ModalActions onClose={()=>setEdit(null)} pending={pending!==null} submitLabel="ذخیره تغییرات"/></form></section></div>:null}{remove?<CoachConfirmDialog title="حذف یادآوری؟" description={`یادآوری «${remove.title}» حذف می‌شود.`} pending={pending===remove.id} onCancel={()=>setRemove(null)} onConfirm={()=>void destroy()}/>:null}</section>
}

function TaskCard({ task, compact = false, onChanged }: { task: CoachTask; compact?: boolean; onChanged?: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [editing,setEditing]=useState(false);
  const [error,setError]=useState("");
  const act = async (action: "complete" | "snooze") => {
    setPending(true);
    try {
      await apiFetch(`/coach/tasks/${task.id}/${action}/`, { method: "POST", body: action === "snooze" ? JSON.stringify({ days: 1 }) : undefined });
      await onChanged?.();
    } finally {
      setPending(false);
    }
  };
  const save=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();setPending(true);setError("");const form=new FormData(event.currentTarget);try{await apiFetch(`/coach/tasks/${task.id}/`,{method:"PATCH",body:JSON.stringify({title:form.get("title"),due_date:form.get("due_date")||null,note:form.get("note")})});setEditing(false);await onChanged?.()}catch{setError("ویرایش اقدام انجام نشد.")}finally{setPending(false)}};
  return (
    <><article className={`${styles.actionTaskCard} ${compact ? styles.taskCardCompact : ""}`}>
      <div className={styles.actionTaskMain}><header><span className={styles.actionTaskIcon}><Icon name="link"/></span><span><strong>{task.title}</strong><small>{kindLabel(task.kind)}</small></span></header><span className={styles.actionTaskOwner}><Avatar/>تحویل به {task.athlete_name||"بدون شاگرد"}</span></div>
      <div className={styles.actionTaskDetails}><span><Icon name="calendar"/>{formatPersianDate(task.due_date)}</span><Status tone={task.status}>{statusLabel(task.status)}</Status></div>
      <footer><button disabled={pending||task.status==="done"} onClick={()=>void act("complete")}>انجام شد</button><button disabled={pending||task.status==="done"} onClick={()=>void act("snooze")}>بعداً</button><button disabled={pending} onClick={()=>setEditing(true)}>ویرایش</button></footer>
    </article>{editing?<div className={styles.overlay} onMouseDown={()=>!pending&&setEditing(false)}><section className={styles.modal} onMouseDown={event=>event.stopPropagation()}><ModalHead title="ویرایش اقدام" onClose={()=>setEditing(false)}/><form className={styles.form} onSubmit={save}><Field name="title" label="عنوان" defaultValue={task.title} required/><Field name="due_date" label="تاریخ" type="date" defaultValue={task.due_date||""}/><Textarea name="note" label="توضیحات" defaultValue={task.note||""}/><FormError error={error}/><ModalActions onClose={()=>setEditing(false)} pending={pending} submitLabel="ذخیره تغییرات"/></form></section></div>:null}</>
  );
}

function formatPersianDate(value?:string|null){return formatApiPersianDate(value,"بدون تاریخ")}

function WorkoutPage({
  plans,
  nutritionPlans,
  athletes,
  openModal,
  onChanged,
  initialTab = "all",
}: {
  plans: WorkoutPlan[];
  nutritionPlans: NutritionPlan[];
  athletes: RosterAthlete[];
  openModal: (name: ModalName) => void;
  onChanged: () => Promise<void>;
  initialTab?: "all" | "workout" | "nutrition";
}) {
  const [tab,setTab]=useState<"all"|"workout"|"nutrition">(initialTab);
  const [query,setQuery]=useState("");
  const [sort,setSort]=useState<"default"|"newest"|"title">("default");
  const normalized=normalizeSearch(query);
  const workoutVisible=plans.filter(plan=>!plan.sent_at).filter(plan=>!normalized||normalizeSearch(`${plan.title} ${plan.goal??""} ${plan.athlete_name??""}`).includes(normalized)).sort((a,b)=>sort==="title"?a.title.localeCompare(b.title,"fa"):sort==="newest"?b.id-a.id:a.id-b.id);
  const nutritionVisible=nutritionPlans.filter(plan=>!plan.sent_at).filter(plan=>!normalized||normalizeSearch(`${plan.title} ${plan.goal??""} ${plan.athlete_name??""}`).includes(normalized)).sort((a,b)=>sort==="title"?a.title.localeCompare(b.title,"fa"):sort==="newest"?b.id-a.id:a.id-b.id);
  const workoutHistory=plans.filter(plan=>Boolean(plan.sent_at)).filter(plan=>!normalized||normalizeSearch(`${plan.title} ${plan.goal??""} ${plan.athlete_name??""}`).includes(normalized));
  const nutritionHistory=nutritionPlans.filter(plan=>Boolean(plan.sent_at)).filter(plan=>!normalized||normalizeSearch(`${plan.title} ${plan.goal??""} ${plan.athlete_name??""}`).includes(normalized));
  const hasPrograms=(tab!=="nutrition"&&workoutVisible.length>0)||(tab!=="workout"&&nutritionVisible.length>0);
  const hasHistory=(tab!=="nutrition"&&workoutHistory.length>0)||(tab!=="workout"&&nutritionHistory.length>0);
  const createProgram=()=>openModal(tab==="nutrition"?"nutrition":"workout");
  return (
    <>
      <section className={`${styles.panel} ${styles.workoutPanel}`}>
        <div className={styles.workoutHead}><h2>برنامه‌ها</h2><span><button aria-label="نمایش لیستی"><Icon name="menu"/></button><button aria-label="منوی برنامه‌ها"><MenuDots/></button></span></div>
        <div className={styles.workoutTabs}><button className={tab==="all"?styles.workoutTabActive:""} onClick={()=>setTab("all")}>همه موارد</button><button className={tab==="workout"?styles.workoutTabActive:""} onClick={()=>setTab("workout")}>برنامه‌های تمرینی</button><button className={tab==="nutrition"?styles.workoutTabActive:""} onClick={()=>setTab("nutrition")}>برنامه‌های غذایی</button></div>
        <WorkoutToolbar query={query} sort={sort} onQuery={setQuery} onSort={setSort}/>
        <div className={styles.workoutGrid}>{hasPrograms?<>{tab!=="nutrition"?workoutVisible.map(plan=><ProgramCard plan={plan} athletes={athletes} key={`workout-${plan.id}`} onChanged={onChanged}/>):null}{tab!=="workout"?nutritionVisible.map(plan=><NutritionCard key={`nutrition-${plan.id}`} plan={plan} athletes={athletes} onChanged={onChanged}/>):null}</>:<EmptyState title="برنامه‌ای در این بخش وجود ندارد." action="برنامه جدید" onAction={createProgram}/>}</div>
      </section>
      <section className={`${styles.panel} ${styles.workoutHistory}`}>
        <div className={styles.workoutHead}><h2>تاریخچه ارسال</h2><span><button aria-label="نمایش جدولی"><Icon name="grid"/></button><button aria-label="منوی تاریخچه"><MenuDots/></button></span></div>
        <div className={styles.workoutTabs}><button className={tab==="all"?styles.workoutTabActive:""} onClick={()=>setTab("all")}>همه موارد</button><button className={tab==="workout"?styles.workoutTabActive:""} onClick={()=>setTab("workout")}>برنامه‌های تمرینی</button><button className={tab==="nutrition"?styles.workoutTabActive:""} onClick={()=>setTab("nutrition")}>برنامه‌های غذایی</button></div>
        <WorkoutToolbar query={query} sort={sort} onQuery={setQuery} onSort={setSort}/>
        {hasHistory?<div className={styles.workoutHistoryTable}><div><span>کاربر</span><span>نام برنامه</span><span>دسته‌بندی</span><span>تاریخ ارسال</span><span>عملیات</span></div>{tab!=="nutrition"?workoutHistory.map(plan=><article key={`workout-${plan.id}`}><span><Avatar/>{plan.athlete_name||"بدون شاگرد"}</span><span>{plan.title}</span><span>برنامه تمرینی</span><span>{formatPersianDate(plan.sent_at?.slice(0,10))}</span><button onClick={()=>{window.location.href=`/students?athlete=${plan.athlete??""}`}}>مشاهده</button></article>):null}{tab!=="workout"?nutritionHistory.map(plan=><article key={`nutrition-${plan.id}`}><span><Avatar/>{plan.athlete_name||"بدون شاگرد"}</span><span>{plan.title}</span><span>برنامه غذایی</span><span>{formatPersianDate(plan.sent_at?.slice(0,10))}</span><button onClick={()=>{window.location.href=`/students?athlete=${plan.athlete??""}`}}>مشاهده</button></article>):null}</div>:<EmptyState title="هنوز برنامه‌ای ارسال نشده است."/>}
      </section>
    </>
  );
}

function WorkoutToolbar({query,sort,onQuery,onSort}:{query:string;sort:"default"|"newest"|"title";onQuery:(value:string)=>void;onSort:(value:"default"|"newest"|"title")=>void}){return <div className={styles.workoutToolbar}><label><Icon name="search"/><input value={query} onChange={event=>onQuery(event.target.value)} placeholder="جستجو برنامه..."/>{query?<button onClick={()=>onQuery("")} aria-label="پاک کردن"><Icon name="close"/></button>:null}</label><label><Icon name="filter"/><select value={sort} onChange={event=>onSort(event.target.value as typeof sort)}><option value="default">پیش‌فرض</option><option value="newest">جدیدترین</option><option value="title">نام برنامه</option></select></label></div>}

function ProgramCard({ plan, athletes, onChanged }: { plan: WorkoutPlan; athletes:RosterAthlete[]; onChanged: () => Promise<void> }) {
  const [pending,setPending]=useState(false);const [athlete,setAthlete]=useState(plan.athlete?String(plan.athlete):"");const [sendConfirm,setSendConfirm]=useState(false);const [deleteConfirm,setDeleteConfirm]=useState(false);const [editing,setEditing]=useState(false);
  const send=async()=>{if(!athlete)return;setPending(true);try{let target=plan;if(!plan.athlete)target=await apiFetch<WorkoutPlan>(`/plans/${plan.id}/assign/`,{method:"POST",body:JSON.stringify({athlete:Number(athlete)})});await apiFetch(`/plans/${target.id}/send/`,{method:"POST",body:JSON.stringify({duration_weeks:plan.duration_weeks??4})});setSendConfirm(false);await onChanged()}finally{setPending(false)}};
  const clone=async()=>{setPending(true);try{await apiFetch(`/plans/${plan.id}/clone/`,{method:"POST"});await onChanged()}finally{setPending(false)}};
  const remove=async()=>{setPending(true);try{await apiFetch(`/plans/${plan.id}/`,{method:"DELETE"});setDeleteConfirm(false);await onChanged()}finally{setPending(false)}};
  const days=(plan.days??[]).slice(0,3);
  return <><article className={styles.workoutCard}><header><span className={styles.workoutCardIcon}><Icon name="training"/></span><span><b>{plan.title}</b><small>{plan.goal||"هدف ثبت نشده"}</small></span><Status tone={plan.sent_at?"active":"needs_follow_up"}>{plan.sent_at?"فعال":"پیش‌نویس"}</Status></header><p>{plan.duration_weeks??4} هفته · {plan.days_count??days.length} روز · {plan.athlete_name||"قالب قابل استفاده"}</p><div className={styles.workoutDayPills}>{days.length?days.map(day=><span key={day.id??day.index}>روز {day.index}: {day.name||`${day.exercises.length} حرکت`}</span>):<span>{plan.days_count??0} روز تمرین</span>}</div>{!plan.athlete?<select value={athlete} onChange={event=>setAthlete(event.target.value)}><option value="">انتخاب شاگرد برای ارسال</option>{athletes.filter(item=>item.is_active!==false).map(item=><option key={item.id} value={item.id}>{item.user.full_name}</option>)}</select>:null}<footer><button className={styles.primaryButton} disabled={pending||Boolean(plan.sent_at)||!athlete} onClick={()=>setSendConfirm(true)}>ارسال برنامه</button><button aria-label="کپی برنامه" disabled={pending} onClick={()=>void clone()}><Icon name="link"/></button><button aria-label="ویرایش برنامه" disabled={pending} onClick={()=>setEditing(true)}><Icon name="edit"/></button><button aria-label="حذف برنامه" disabled={pending} onClick={()=>setDeleteConfirm(true)}><Icon name="trash"/></button></footer></article>{sendConfirm?<CoachConfirmDialog title="ارسال برنامه؟" description={`برنامه «${plan.title}» برای شاگرد انتخاب‌شده ارسال می‌شود.`} pending={pending} onCancel={()=>setSendConfirm(false)} onConfirm={()=>void send()}/>:null}{deleteConfirm?<CoachConfirmDialog title="حذف برنامه؟" description={`برنامه «${plan.title}» و روزهای تمرینی آن حذف می‌شود.`} pending={pending} onCancel={()=>setDeleteConfirm(false)} onConfirm={()=>void remove()}/>:null}{editing?<WorkoutEditModal plan={plan} pending={pending} setPending={setPending} onClose={()=>setEditing(false)} onSaved={async()=>{setEditing(false);await onChanged()}}/>:null}</>;
}

function NutritionCard({plan,athletes,onChanged}:{plan:NutritionPlan;athletes:RosterAthlete[];onChanged:()=>Promise<void>}){
  const [pending,setPending]=useState(false);const [athlete,setAthlete]=useState(plan.athlete?String(plan.athlete):"");const [sendConfirm,setSendConfirm]=useState(false);const [deleteConfirm,setDeleteConfirm]=useState(false);const [editing,setEditing]=useState(false);
  const send=async()=>{if(!athlete)return;setPending(true);try{let target=plan;if(!plan.athlete)target=await apiFetch<NutritionPlan>(`/nutrition-plans/${plan.id}/assign/`,{method:"POST",body:JSON.stringify({athlete:Number(athlete)})});await apiFetch(`/nutrition-plans/${target.id}/send/`,{method:"POST",body:JSON.stringify({duration_weeks:plan.duration_weeks??4})});setSendConfirm(false);await onChanged()}finally{setPending(false)}};
  const clone=async()=>{setPending(true);try{await apiFetch(`/nutrition-plans/${plan.id}/clone/`,{method:"POST"});await onChanged()}finally{setPending(false)}};
  const remove=async()=>{setPending(true);try{await apiFetch(`/nutrition-plans/${plan.id}/`,{method:"DELETE"});setDeleteConfirm(false);await onChanged()}finally{setPending(false)}};
  const meals=(plan.meals??[]).slice(0,3);
  return <><article className={`${styles.workoutCard} ${styles.nutritionCard}`}><header><span className={`${styles.workoutCardIcon} ${styles.nutritionCardIcon}`}><Icon name="grid"/></span><span><b>{plan.title}</b><small>{plan.goal||"هدف ثبت نشده"}</small></span><Status tone={plan.sent_at?"active":"needs_follow_up"}>{plan.sent_at?"فعال":"پیش‌نویس"}</Status></header><p>{plan.duration_weeks??4} هفته · {(plan.meals??[]).length.toLocaleString("fa-IR")} وعده · {plan.athlete_name||"قالب قابل استفاده"}</p><div className={styles.workoutDayPills}>{meals.length?meals.map(meal=><span key={meal.id??meal.index}>{meal.name||mealKindLabel(meal.kind)} · {meal.items.length.toLocaleString("fa-IR")} مورد</span>):<span>بدون وعده غذایی</span>}</div>{!plan.athlete?<select value={athlete} onChange={event=>setAthlete(event.target.value)}><option value="">انتخاب شاگرد برای ارسال</option>{athletes.filter(item=>item.is_active!==false).map(item=><option key={item.id} value={item.id}>{item.user.full_name}</option>)}</select>:null}<footer><button className={styles.primaryButton} disabled={pending||Boolean(plan.sent_at)||!athlete} onClick={()=>setSendConfirm(true)}>ارسال برنامه</button><button aria-label="کپی برنامه غذایی" disabled={pending} onClick={()=>void clone()}><Icon name="link"/></button><button aria-label="ویرایش برنامه غذایی" disabled={pending} onClick={()=>setEditing(true)}><Icon name="edit"/></button><button aria-label="حذف برنامه غذایی" disabled={pending} onClick={()=>setDeleteConfirm(true)}><Icon name="trash"/></button></footer></article>{sendConfirm?<CoachConfirmDialog title="ارسال برنامه غذایی؟" description={`برنامه «${plan.title}» برای شاگرد انتخاب‌شده ارسال می‌شود.`} pending={pending} onCancel={()=>setSendConfirm(false)} onConfirm={()=>void send()}/>:null}{deleteConfirm?<CoachConfirmDialog title="حذف برنامه غذایی؟" description={`برنامه «${plan.title}» و همه وعده‌های آن حذف می‌شود.`} pending={pending} onCancel={()=>setDeleteConfirm(false)} onConfirm={()=>void remove()}/>:null}{editing?<NutritionEditModal plan={plan} pending={pending} setPending={setPending} onClose={()=>setEditing(false)} onSaved={async()=>{setEditing(false);await onChanged()}}/>:null}</>;
}

function ServicesPage({
  services,
  categories,
  athletes,
  onChanged,
}: {
  services: Service[];
  categories: ServiceCategory[];
  athletes: RosterAthlete[];
  onChanged: () => Promise<void>;
}) {
  const [category,setCategory]=useState("all");const [serviceDialog,setServiceDialog]=useState<Service|"new"|null>(null);const [invoiceService,setInvoiceService]=useState<Service|null>(null);const [categoryDialog,setCategoryDialog]=useState<ServiceCategory|"new"|null>(null);const [removeCategory,setRemoveCategory]=useState<ServiceCategory|null>(null);const [pending,setPending]=useState(false);
  const visible=category==="all"?services:services.filter(service=>String(service.category)===category);
  const closeAndReload=async()=>{setServiceDialog(null);setInvoiceService(null);setCategoryDialog(null);await onChanged()};
  const destroyCategory=async()=>{if(!removeCategory)return;setPending(true);try{await apiFetch(`/service-categories/${removeCategory.id}/`,{method:"DELETE"});setRemoveCategory(null);if(category===String(removeCategory.id))setCategory("all");await onChanged()}finally{setPending(false)}};
  return (
    <><section className={`${styles.panel} ${styles.serviceCategoriesPanel}`}><div className={styles.servicesSectionHead}><h2>دسته‌بندی‌ها</h2><button onClick={()=>setCategoryDialog("new")}><Icon name="plus"/>دسته جدید</button></div><div className={styles.serviceCategoryGrid}>{categories.length?categories.map(item=>{const children=services.filter(service=>service.category===item.id);return <article className={styles.serviceCategoryCard} key={item.id}><header><span><b>{item.name}</b><small>ساخته شده: {formatPersianDate(item.created_at?.slice(0,10))}</small></span><span><button aria-label={`ویرایش دسته ${item.name}`} onClick={()=>setCategoryDialog(item)}><Icon name="edit"/></button><button aria-label={`حذف دسته ${item.name}`} disabled={item.is_default} onClick={()=>setRemoveCategory(item)}><Icon name="trash"/></button></span></header><div>{children.length?children.slice(0,3).map(service=><button key={service.id} onClick={()=>setServiceDialog(service)}><span className={styles.categoryServiceIcon}><Icon name="link"/></span><span><b>{service.name}</b><small>{item.name}</small></span></button>):<p>موردی اضافه نشده</p>}</div></article>}):<EmptyState title="دسته‌بندی ثبت نشده است." action="دسته جدید" onAction={()=>setCategoryDialog("new")}/>}</div></section><section className={`${styles.panel} ${styles.myServicesPanel}`}><div className={styles.servicesSectionHead}><h2>خدمات من</h2><button onClick={()=>setServiceDialog("new")}><Icon name="plus"/>سرویس جدید</button></div><div className={styles.serviceTabs}><button className={category==="all"?styles.serviceTabActive:""} onClick={()=>setCategory("all")}>همه</button>{categories.map(item=><button key={item.id} className={category===String(item.id)?styles.serviceTabActive:""} onClick={()=>setCategory(String(item.id))}>{item.name}</button>)}</div><div className={styles.serviceGrid}>{visible.length?visible.map(service=><ServiceCard service={service} key={service.id} onInvoice={()=>setInvoiceService(service)} onEdit={()=>setServiceDialog(service)} onChanged={onChanged}/>):<EmptyState title="در این دسته خدمتی وجود ندارد." action="سرویس جدید" onAction={()=>setServiceDialog("new")}/>}</div></section>{serviceDialog?<ModalShell onClose={()=>setServiceDialog(null)}><ServiceModal onClose={()=>setServiceDialog(null)} onSaved={()=>void closeAndReload()} categories={categories} service={serviceDialog==="new"?undefined:serviceDialog}/></ModalShell>:null}{invoiceService?<ModalShell onClose={()=>setInvoiceService(null)}><InvoiceModal onClose={()=>setInvoiceService(null)} onSaved={()=>void closeAndReload()} athletes={athletes} services={services} defaultService={invoiceService}/></ModalShell>:null}{categoryDialog?<ModalShell onClose={()=>setCategoryDialog(null)} small><CategoryModal onClose={()=>setCategoryDialog(null)} onSaved={()=>void closeAndReload()} category={categoryDialog==="new"?undefined:categoryDialog}/></ModalShell>:null}{removeCategory?<CoachConfirmDialog title="حذف دسته‌بندی؟" description={`دسته «${removeCategory.name}» حذف می‌شود. ابتدا مطمئن شوید خدمتی در آن باقی نمانده است.`} pending={pending} onCancel={()=>setRemoveCategory(null)} onConfirm={()=>void destroyCategory()}/>:null}</>
  );
}

function ServiceCard({service,onInvoice,onEdit,onChanged}:{service:Service;onInvoice:()=>void;onEdit:()=>void;onChanged:()=>Promise<void>}) {
  const [pending,setPending]=useState(false); const [confirming,setConfirming]=useState(false); const remove=async()=>{setPending(true);try{await apiFetch(`/services/${service.id}/`,{method:"DELETE"});setConfirming(false);await onChanged();}finally{setPending(false)}};
  return <article className={styles.serviceCard}>
            <header><span className={styles.serviceIcon}><Icon name="training" /></span><span><h3>{service.name}</h3><small>{service.category_name}</small></span></header>
            <p><b>{formatMoney(service.default_price)}</b><span>{service.description || "توضیحی ثبت نشده است."}</span></p>
            <div className={styles.cardActions}>
              <button className={styles.primaryButton} onClick={onInvoice}>صدور فاکتور</button>
              <button aria-label="ویرایش سرویس" onClick={onEdit}><Icon name="edit" /></button>
              <button aria-label="حذف سرویس" disabled={pending} onClick={()=>setConfirming(true)}><Icon name="trash" /></button>
            </div>
            {confirming ? <CoachConfirmDialog title="حذف سرویس؟" description={`سرویس «${service.name}» حذف می‌شود و این عملیات قابل بازگشت نیست.`} pending={pending} onCancel={()=>setConfirming(false)} onConfirm={()=>void remove()} /> : null}
          </article>;
}

function FinancialPage({
  dashboard,
  invoices,
  payments,
  onChanged,
}: {
  dashboard: CoachDashboardData;
  invoices: Invoice[];
  payments: Payment[];
  onChanged: () => Promise<void>;
}) {
  const [invoiceTab,setInvoiceTab]=useState<"all"|"paid"|"pending"|"overdue">("all");const [paymentTab,setPaymentTab]=useState<"all"|"cash"|"card_transfer"|"pos"|"gateway">("all");const [invoiceQuery,setInvoiceQuery]=useState("");const [paymentQuery,setPaymentQuery]=useState("");const [invoiceSort,setInvoiceSort]=useState("default");const [paymentSort,setPaymentSort]=useState("default");const [payingInvoice,setPayingInvoice]=useState<Invoice|null>(null);const [editingPayment,setEditingPayment]=useState<Payment|null>(null);
  const normalizedInvoice=normalizeSearch(invoiceQuery);const normalizedPayment=normalizeSearch(paymentQuery);
  const filtered=invoices.filter(invoice=>{const matches=!normalizedInvoice||normalizeSearch(`${invoice.payer_name} ${invoice.service_name||""}`).includes(normalizedInvoice);const overdue=invoice.days_overdue>0||invoice.status==="overdue";const matchesTab=invoiceTab==="all"||invoiceTab==="paid"&&invoice.status==="paid"||invoiceTab==="overdue"&&overdue||invoiceTab==="pending"&&invoice.status!=="paid"&&!overdue;return matches&&matchesTab}).sort((a,b)=>invoiceSort==="amount"?b.outstanding-a.outstanding:invoiceSort==="name"?a.payer_name.localeCompare(b.payer_name,"fa"):invoiceSort==="due"?a.due_date.localeCompare(b.due_date):b.id-a.id);
  const filteredPayments=payments.filter(payment=>(paymentTab==="all"||payment.method===paymentTab)&&(!normalizedPayment||normalizeSearch(`${payment.payer_name||""} ${payment.service_name||""}`).includes(normalizedPayment))).sort((a,b)=>paymentSort==="amount"?b.amount-a.amount:paymentSort==="name"?(a.payer_name||"").localeCompare(b.payer_name||"","fa"):paymentSort==="date"?(b.paid_at||"").localeCompare(a.paid_at||""):b.id-a.id);
  const invoiceTotals=invoiceFinancialTotals(invoices);
  const overdueAmount=invoiceTotals.overdue;
  const pendingAmount=invoiceTotals.waiting;
  const paidInvoices=invoices.filter(item=>item.status==="paid").length;
  const closePayment=async()=>{setPayingInvoice(null);setEditingPayment(null);await onChanged()};
  return (
    <><section className={`${styles.panel} ${styles.financeSummaryPanel}`}><div className={styles.financeSectionHead}><h2>آمار کلی</h2><MenuDots/></div><div className={styles.financeSummaryGrid}><SummaryCard title="وصول شده" value={formatMoney(dashboard.income_this_month)} tone="green" meta={`${payments.length.toLocaleString("fa-IR")} پرداخت ثبت شده`}/><SummaryCard title="در انتظار" value={formatMoney(pendingAmount||dashboard.expected_receivable)} tone="orange" meta={`${invoices.length-paidInvoices} فاکتور باز`}/><SummaryCard title="معوق" value={formatMoney(overdueAmount)} meta={`${dashboard.overdue_invoices} مورد نیازمند پیگیری`}/><SummaryCard title="فاکتورها" value={`${invoices.length.toLocaleString("fa-IR")} فاکتور`} meta={`${paidInvoices.toLocaleString("fa-IR")} فاکتور تسویه شده`}/></div></section><section className={`${styles.panel} ${styles.financeListPanel}`}><div className={styles.financeSectionHead}><h2>فاکتورها</h2><span><button aria-label="نمایش جدولی"><Icon name="grid"/></button><MenuDots/></span></div><div className={styles.financeTabs}><button className={invoiceTab==="all"?styles.financeTabActive:""} onClick={()=>setInvoiceTab("all")}>همه موارد</button><button className={invoiceTab==="paid"?styles.financeTabActive:""} onClick={()=>setInvoiceTab("paid")}>پرداخت شده</button><button className={invoiceTab==="pending"?styles.financeTabActive:""} onClick={()=>setInvoiceTab("pending")}>در انتظار پرداخت</button><button className={invoiceTab==="overdue"?styles.financeTabActive:""} onClick={()=>setInvoiceTab("overdue")}>عقب افتاده</button></div><FinanceToolbar query={invoiceQuery} onQuery={setInvoiceQuery} sort={invoiceSort} onSort={setInvoiceSort}/><InvoiceTable invoices={filtered} onPay={setPayingInvoice}/></section><section className={`${styles.panel} ${styles.financeListPanel}`}><div className={styles.financeSectionHead}><h2>تاریخچه پرداخت</h2><span><button aria-label="نمایش جدولی"><Icon name="grid"/></button><MenuDots/></span></div><div className={styles.financeTabs}><button className={paymentTab==="all"?styles.financeTabActive:""} onClick={()=>setPaymentTab("all")}>همه موارد</button><button className={paymentTab==="cash"?styles.financeTabActive:""} onClick={()=>setPaymentTab("cash")}>نقدی</button><button className={paymentTab==="card_transfer"?styles.financeTabActive:""} onClick={()=>setPaymentTab("card_transfer")}>انتقال</button><button className={paymentTab==="pos"?styles.financeTabActive:""} onClick={()=>setPaymentTab("pos")}>کارت‌خوان</button><button className={paymentTab==="gateway"?styles.financeTabActive:""} onClick={()=>setPaymentTab("gateway")}>آنلاین</button></div><FinanceToolbar query={paymentQuery} onQuery={setPaymentQuery} sort={paymentSort} onSort={setPaymentSort}/><PaymentHistoryTable payments={filteredPayments} onEdit={setEditingPayment}/></section>{payingInvoice?<ModalShell onClose={()=>setPayingInvoice(null)}><PaymentModal onClose={()=>setPayingInvoice(null)} onSaved={()=>void closePayment()} invoices={invoices} defaultInvoice={payingInvoice}/></ModalShell>:null}{editingPayment?<ModalShell onClose={()=>setEditingPayment(null)}><PaymentModal onClose={()=>setEditingPayment(null)} onSaved={()=>void closePayment()} invoices={invoices} payment={editingPayment}/></ModalShell>:null}</>
  );
}

function FinanceToolbar({query,onQuery,sort,onSort}:{query:string;onQuery:(value:string)=>void;sort:string;onSort:(value:string)=>void}){return <div className={styles.financeToolbar}><label><Icon name="search"/><input value={query} onChange={event=>onQuery(event.target.value)} placeholder="جستجو نام، سرویس یا..."/>{query?<button onClick={()=>onQuery("")} aria-label="پاک کردن جستجو"><Icon name="close"/></button>:null}</label><label><Icon name="filter"/><select value={sort} onChange={event=>onSort(event.target.value)}><option value="default">پیش‌فرض</option><option value="due">نزدیک‌ترین سررسید</option><option value="date">جدیدترین پرداخت</option><option value="amount">بیشترین مبلغ</option><option value="name">نام شاگرد</option></select></label></div>}

function IncomePage({
  dashboard,
  payments,
}: {
  dashboard: CoachDashboardData;
  payments: Payment[];
}) {
  const [report,setReport]=useState<FinanceReport|null>(null);
  const [incomePayments,setIncomePayments]=useState(payments);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const loadReport=useCallback(async()=>{setLoading(true);setError("");const [financeResult,historyResult]=await Promise.allSettled([apiFetch<FinanceReport>("/reports/finance/"),fetchAllPaymentHistory()]);if(financeResult.status==="fulfilled")setReport(financeResult.value);if(historyResult.status==="fulfilled")setIncomePayments(historyResult.value);const rejected=[financeResult,historyResult].find(result=>result.status==="rejected");if(rejected&&String((rejected as PromiseRejectedResult).reason?.message)!=="UNAUTHORIZED")setError("بخشی از گزارش درآمد از وب‌سرویس دریافت نشد.");setLoading(false)},[]);
  useEffect(()=>{void loadReport()},[loadReport]);

  const paid=report?.paid_total??dashboard.income_this_month;
  const outstanding=report?.outstanding_total??dashboard.expected_receivable;
  const invoiced=report?.invoiced_total??paid+outstanding;
  const collectionRate=invoiced>0?Math.round(paid/invoiced*100):0;
  const average=incomePayments.length?Math.round(paid/incomePayments.length):0;
  const serviceIncome=useMemo(()=>aggregateServiceIncome(incomePayments),[incomePayments]);
  const topPayers=useMemo(()=>aggregateTopPayers(incomePayments),[incomePayments]);

  return (
    <>
      {loading?<div className={styles.loadingLine}/>:null}
      {error?<div className={styles.incomeError}><span>{error}</span><button onClick={()=>void loadReport()}>تلاش دوباره</button></div>:null}
      <section className={`${styles.panel} ${styles.incomeSummaryPanel}`}>
        <IncomePanelHead title="آمار کلی" />
        <div className={styles.incomeSummaryGrid}>
          <IncomeSummaryCard title="وصول شده" value={formatMoney(paid)} meta={`نرخ وصول ${collectionRate.toLocaleString("fa-IR")}٪`} positive />
          <IncomeSummaryCard title="درانتظار وصول" value={formatMoney(outstanding)} meta={`${(report?.open_invoices??dashboard.overdue_invoices).toLocaleString("fa-IR")} فاکتور باز`} />
          <IncomeSummaryCard title="میانگین" value={formatMoney(average)} meta="در هر پرداخت" />
        </div>
      </section>
      <section className={`${styles.panel} ${styles.incomeAnalysisPanel}`}>
        <IncomePanelHead title="خلاصه تحلیل" />
        <div className={styles.incomeAnalysisRows}>
          <p><span>نرخ وصول</span><b>{collectionRate.toLocaleString("fa-IR")}٪</b></p>
          <p><span>وصول شده</span><b>{formatMoney(paid)}</b></p>
          <p><span>در انتظار</span><b>{formatMoney(outstanding)}</b></p>
          <p><span>تعداد پرداخت</span><b>{incomePayments.length.toLocaleString("fa-IR")} پرداخت</b></p>
        </div>
      </section>
      <section className={`${styles.panel} ${styles.incomeBreakdownPanel}`}>
        <IncomePanelHead title="درآمد به تفکیک هر سرویس" withListIcon />
        <IncomeServiceBreakdown items={serviceIncome} />
      </section>
      <section className={`${styles.panel} ${styles.incomeTopPanel}`}>
        <IncomePanelHead title="خوش حساب ترین شاگردان" />
        <IncomeTopPayers items={topPayers} />
      </section>
    </>
  );
}

type IncomeServiceItem={name:string;amount:number;percentage:number;color:string};
type IncomePayerItem={name:string;amount:number;count:number;lastPaidAt?:string};
const incomeColors=["#35a183","#f8bd33","#b9d917","#ff8238","#6a9ee8","#ef6c72"];

async function fetchAllPaymentHistory(){
  const first=await apiFetch<Paginated<Payment>|Payment[]>("/payments/history/?page=1");
  if(Array.isArray(first))return first;
  const firstPage=toArray(first);
  const pageSize=firstPage.length;
  const pageCount=pageSize?Math.ceil((first.count??firstPage.length)/pageSize):1;
  if(pageCount<=1)return firstPage;
  const rest=await Promise.all(Array.from({length:pageCount-1},(_,index)=>apiFetch<Paginated<Payment>|Payment[]>(`/payments/history/?page=${index+2}`)));
  return [firstPage,...rest.map(toArray)].flat();
}

function aggregateServiceIncome(payments:Payment[]):IncomeServiceItem[]{
  const totals=new Map<string,number>();
  payments.forEach(payment=>{const name=payment.service_name?.trim()||"سایر خدمات";totals.set(name,(totals.get(name)||0)+Number(payment.amount||0))});
  const rows=[...totals.entries()].sort((a,b)=>b[1]-a[1]);
  const total=rows.reduce((sum,[,amount])=>sum+amount,0);
  return rows.map(([name,amount],index)=>({name,amount,percentage:total?amount/total*100:0,color:incomeColors[index%incomeColors.length]}));
}

function aggregateTopPayers(payments:Payment[]):IncomePayerItem[]{
  const totals=new Map<string,IncomePayerItem>();
  payments.forEach(payment=>{const name=payment.payer_name?.trim()||"شاگرد";const current=totals.get(name);const paidAt=payment.paid_at||payment.created_at;if(!current){totals.set(name,{name,amount:Number(payment.amount||0),count:1,lastPaidAt:paidAt});return}current.amount+=Number(payment.amount||0);current.count+=1;if(paidAt&&(!current.lastPaidAt||paidAt>current.lastPaidAt))current.lastPaidAt=paidAt});
  return [...totals.values()].sort((a,b)=>b.amount-a.amount).slice(0,3);
}

function IncomePanelHead({title,withListIcon=false}:{title:string;withListIcon?:boolean}){
  return <header className={styles.incomePanelHead}><h2>{title}</h2><span>{withListIcon?<i><Icon name="menu"/></i>:null}<MenuDots/></span></header>;
}

function IncomeSummaryCard({title,value,meta,positive=false}:{title:string;value:string;meta:string;positive?:boolean}){
  return <article className={styles.incomeSummaryCard}><CardTitle>{title}</CardTitle><div><strong>{value}</strong><span className={positive?styles.incomePositive:""}>{positive?<b>↗</b>:null}{meta}</span></div></article>;
}

function IncomeServiceBreakdown({items}:{items:IncomeServiceItem[]}){
  if(!items.length)return <EmptyState title="هنوز پرداختی برای تفکیک درآمد سرویس‌ها ثبت نشده است."/>;
  let cursor=0;
  const segments=items.map(item=>{const start=cursor;cursor+=item.percentage;return `${item.color} ${start}% ${Math.max(start,cursor-.8)}%, #fff ${Math.max(start,cursor-.8)}% ${cursor}%`});
  return <div className={styles.incomeBreakdownBody}><div className={styles.incomeDonut} style={{background:`conic-gradient(${segments.join(",")})`}} aria-label="نمودار سهم درآمد سرویس‌ها"/><div className={styles.incomeServiceRows}>{items.map(item=><p key={item.name}><i style={{background:item.color}}/><b>{item.name}</b><span>{formatMoney(item.amount)}</span><em>{Math.round(item.percentage).toLocaleString("fa-IR")}٪</em></p>)}</div></div>;
}

function IncomeTopPayers({items}:{items:IncomePayerItem[]}){
  if(!items.length)return <EmptyState title="هنوز پرداختی برای رتبه‌بندی شاگردان ثبت نشده است."/>;
  return <div className={styles.incomeTopRows}>{items.map(item=><article key={item.name}><span><Avatar/><span><b>{item.name}</b><small>{item.lastPaidAt?`آخرین پرداخت ${formatPersianDate(item.lastPaidAt.slice(0,10))}`:`${item.count.toLocaleString("fa-IR")} پرداخت`}</small></span></span><strong>{formatMoney(item.amount)}</strong></article>)}</div>;
}

function SettingsPage({ coach, openModal }: { coach: CoachProfile; openModal: (name: ModalName) => void }) {
  const [tab,setTab]=useState<"profile"|"subscription"|"qr"|"financial">("profile");
  return (
    <>
      <div className={styles.settingsTabs}>
        <button className={tab === "profile" ? styles.settingsTabActive : ""} onClick={()=>setTab("profile")}>پروفایل</button>
        <button className={tab === "subscription" ? styles.settingsTabActive : ""} onClick={()=>setTab("subscription")}>اشتراک</button>
        <button className={tab === "qr" ? styles.settingsTabActive : ""} onClick={()=>setTab("qr")}>لینک و QR</button>
        <button className={tab === "financial" ? styles.settingsTabActive : ""} onClick={()=>setTab("financial")}>مالی</button>
      </div>
      {tab === "subscription" ? <section className={styles.panel}><PanelHead title="اشتراک"/><InfoGrid items={[["پلن فعلی",coach.plan||"ثبت نشده"],["تاریخ انقضا",coach.plan_expires_at||"ثبت نشده"],["وضعیت",coach.is_plan_active?"فعال":"غیرفعال"]]}/></section> : null}
      {tab === "qr" ? <section className={styles.panel}><PanelHead title="لینک و کد اتصال" action="نمایش کد اتصال" onAction={()=>openModal("qr")}/><div className={styles.settingsForm}><p className={styles.bioBox}>کد اتصال فعلی: {coach.code||"دریافت نشده"}</p></div></section> : null}
      {tab === "financial" ? <section className={styles.panel}><PanelHead title="تنظیمات مالی"/><div className={styles.settingsForm}><p className={styles.bioBox}>اطلاعات تسویه و کیف پول از بخش مالی حساب شما مدیریت می‌شود.</p></div></section> : null}
      {tab === "profile" ? (
      <section className={styles.panel}>
        <PanelHead title="پروفایل" action="ذخیره تغییرات" onAction={() => openModal("settings")} />
        <div className={styles.settingsForm}>
          <div className={styles.profileHero}>
            <Avatar />
            <span>
              <strong>{coach.user.full_name}</strong>
              <small>{coach.specialty || "تخصص ثبت نشده"}</small>
            </span>
            <button onClick={() => openModal("qr")}><Icon name="qr" /> کد اتصال</button>
          </div>
          <InfoGrid
            items={[
              ["شماره موبایل", coach.user.phone],
              ["کد مربی", coach.code],
              ["پلن", coach.plan || "پایه"],
              ["تاریخ انقضا", coach.plan_expires_at || "ثبت نشده"],
            ]}
          />
          <p className={styles.bioBox}>{coach.bio || "بیوگرافی مربی هنوز ثبت نشده است."}</p>
        </div>
      </section>
      ) : null}
      {tab === "profile" ? (
      <section className={styles.panel}>
        <PanelHead title="شاخص پایداری" />
        <div className={styles.thresholdGrid}>
          <SummaryCard title="عالی" value={`${coach.stability_excellent ?? 0}٪`} tone="green" meta="شاخص پایداری" />
          <SummaryCard title="خوب" value={`${coach.stability_good ?? 0}٪`} tone="orange" meta="شاخص پایداری" />
          <SummaryCard title="متوسط" value={`${coach.stability_average ?? 0}٪`} meta="شاخص پایداری" />
        </div>
      </section>
      ) : null}
    </>
  );
}

function NotificationBell({onChanged,onNewNotification}:{onChanged?:()=>void|Promise<void>;onNewNotification?:()=>void}) {
  type NotificationTab="all"|"unread"|"read";
  const [open,setOpen]=useState(false);
  const [items,setItems]=useState<AppNotification[]>([]);
  const [unread,setUnread]=useState(0);
  const [tab,setTab]=useState<NotificationTab>("all");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [markingAll,setMarkingAll]=useState(false);
  const lastUnreadRef=useRef<number|null>(null);
  const readStorageKey = `gymplus:read-notifications:${(getToken() ?? "").slice(-16)}`;
  const rememberedRead = () => { try { return new Set<number>(JSON.parse(localStorage.getItem(readStorageKey) ?? "[]")); } catch { return new Set<number>(); } };
  const rememberRead = (ids:number[]) => { try { const next = new Set([...rememberedRead(), ...ids]); localStorage.setItem(readStorageKey, JSON.stringify([...next])); } catch {} };

  const loadCount=useCallback(async()=>{try{const result=await apiFetch<{unread:number}>("/notifications/unread_count/");const previous=lastUnreadRef.current;lastUnreadRef.current=result.unread;setUnread(result.unread);if(previous!==null&&result.unread>previous)onNewNotification?.()}catch{/* The main dashboard remains usable if notifications are unavailable. */}},[onNewNotification]);
  const loadItems=useCallback(async()=>{setLoading(true);setError("");try{const list=await apiFetch<Paginated<AppNotification>|AppNotification[]>("/notifications/");const previous=lastUnreadRef.current;const remembered=rememberedRead();const loaded=toArray(list).map(item=>remembered.has(item.id)?{...item,read:true}:item);const loadedUnread=loaded.filter(item=>!item.read).length;setItems(loaded);lastUnreadRef.current=loadedUnread;setUnread(loadedUnread);if(previous!==null&&loadedUnread>previous)onNewNotification?.()}catch{setError("دریافت اعلان‌ها انجام نشد.")}finally{setLoading(false)}},[onNewNotification]);

  useEffect(()=>{void loadCount();const timer=window.setInterval(()=>void loadCount(),60000);return()=>window.clearInterval(timer)},[loadCount]);
  useEffect(()=>{if(!open)return;const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close)},[open]);

  const toggle=()=>{if(open){setOpen(false);return}setTab("all");setOpen(true);void loadItems()};
  const markOne=async(item:AppNotification)=>{if(item.read)return;try{await apiFetch<AppNotification>(`/notifications/${item.id}/`);rememberRead([item.id]);setItems(current=>current.map(notification=>notification.id===item.id?{...notification,read:true}:notification));setUnread(current=>{const next=Math.max(0,current-1);lastUnreadRef.current=next;return next});await onChanged?.()}catch{setError(`اعلان «${notificationKindLabel(item.kind)}»: خوانده‌شدن ثبت نشد.`)}};
  const markAll=async()=>{if(!unread)return;setMarkingAll(true);setError("");try{await apiFetch("/notifications/read/",{method:"POST"});setItems(current=>{rememberRead(current.map(item=>item.id));return current.map(item=>({...item,read:true}))});lastUnreadRef.current=0;setUnread(0);await onChanged?.()}catch{setError("اعلان‌ها: خوانده‌شدن همه موارد انجام نشد.")}finally{setMarkingAll(false)}};
  const visibleItems=items.filter(item=>tab==="all"||(tab==="unread"?!item.read:item.read));
  const openItem=async(item:AppNotification)=>{await markOne(item);setOpen(false);window.location.href=notificationTarget(item.kind)};

  return <div className={styles.notificationWrap}>
    <button className={styles.notification} aria-label={unread?`${unread} اعلان خوانده‌نشده`:"اعلان‌ها"} aria-expanded={open} aria-haspopup="dialog" onClick={toggle}>
      <Icon name="bell"/><span>اعلانات</span>{unread>0?<i/>:null}
    </button>
    {open?<><span className={styles.notificationDismiss} onMouseDown={()=>setOpen(false)}/><section className={styles.notificationPanel} role="dialog" aria-label="اعلان‌های من">
      <header><h2>اعلانات</h2><span><button disabled={!unread||markingAll} onClick={()=>void markAll()} aria-label="خواندن همه اعلان‌ها"><Icon name="filter"/></button><i/><button onClick={()=>setOpen(false)} aria-label="بستن اعلان‌ها"><Icon name="close"/></button></span></header>
      <div className={styles.notificationTabs}>{([['all','همه اعلانات'],['unread',`خوانده نشده (${unread.toLocaleString('fa-IR')})`],['read','خوانده شده']] as Array<[NotificationTab,string]>).map(([key,label])=><button className={tab===key?styles.notificationTabActive:""} key={key} onClick={()=>setTab(key)}>{label}</button>)}</div>
      {loading?<div className={styles.notificationLoading}><span/><span/><span/></div>:error&&!items.length?<div className={styles.notificationError}><Icon name="alert"/><span>{error}</span><button onClick={()=>void loadItems()}>تلاش دوباره</button></div>:visibleItems.length?<div className={styles.notificationList}>{visibleItems.map(item=><article className={item.read?styles.notificationRead:styles.notificationUnread} data-kind={item.kind} key={item.id}><header><span><Avatar/><span><b>{notificationKindLabel(item.kind)}</b><small>{notificationContext(item.kind)}</small></span>{!item.read?<i/>:null}</span><time>{formatNotificationRelative(item.created_at)}</time></header><p>{item.message}</p><footer><button onClick={()=>void markOne(item)} disabled={item.read}>{item.read?"خوانده شده":"خواندم"}</button><button className={styles.primaryButton} onClick={()=>void openItem(item)}>مشاهده</button></footer></article>)}</div>:<div className={styles.notificationEmpty}><span><Icon name="bell" size={26}/></span><b>اعلانی در این بخش ندارید</b><small>اعلان‌های جدید حساب شما اینجا نمایش داده می‌شوند.</small></div>}
      {error?<p className={styles.notificationInlineError} role="alert"><Icon name="alert"/>{error}</p>:null}
    </section></>:null}
  </div>;
}

function notificationKindLabel(kind:AppNotification["kind"]){return ({payment:"امور مالی",workout:"یادآوری تمرین",new_plan:"برنامه جدید",gym:"باشگاه",system:"پیام سیستم"} as Record<AppNotification["kind"],string>)[kind]}
function notificationContext(kind:AppNotification["kind"]){return ({payment:"وضعیت پرداخت و سررسید",workout:"آخرین وضعیت تمرین",new_plan:"برنامه تازه اختصاص‌یافته",gym:"پیام مجموعه",system:"اطلاع‌رسانی حساب"} as Record<AppNotification["kind"],string>)[kind]}
function notificationTarget(kind:AppNotification["kind"]){return kind==="payment"?"/financial":kind==="workout"||kind==="new_plan"?"/workout-program":kind==="gym"?"/settings":"/dashboard"}
function formatNotificationRelative(value:string){const date=new Date(value);if(Number.isNaN(date.getTime()))return"";const minutes=Math.max(0,Math.floor((Date.now()-date.getTime())/60000));if(minutes<1)return"همین حالا";if(minutes<60)return`${minutes.toLocaleString("fa-IR")} دقیقه پیش`;const hours=Math.floor(minutes/60);if(hours<24)return`${hours.toLocaleString("fa-IR")} ساعت پیش`;return`${Math.floor(hours/24).toLocaleString("fa-IR")} روز پیش`}

function NotificationSettings({athletes}:{athletes:RosterAthlete[]}) {
  const [form, setForm] = useState({
    payment_reminders: false,
    workout_reminders: false,
    remind_before: false,
    days_before_due: 0,
    remind_on_due: false,
    remind_after: false,
    days_after_due: 0,
    follow_up_days: 0,
    payment_message_before: "",
    payment_message_on_due: "",
    payment_message_after: "",
  });
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [overrides,setOverrides]=useState<ReminderOverride[]>([]);
  const [overridePending,setOverridePending]=useState<number|null>(null);

  useEffect(() => {
    Promise.all([apiFetch<Partial<typeof form>>("/reminder-settings/me/"),apiFetch<Paginated<ReminderOverride>|ReminderOverride[]>("/reminder-overrides/")])
      .then(([result,rows]) => {setForm((current) => ({ ...current, ...result }));setOverrides(toArray(rows))})
      .catch(() => setMessage("دریافت تنظیمات اعلان انجام نشد."))
      .finally(() => setLoading(false));
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      await apiFetch("/reminder-settings/me/", { method: "PUT", body: JSON.stringify(form) });
      setMessage("تنظیمات اعلان ذخیره شد.");
    } catch {
      setMessage("ذخیره تنظیمات اعلان انجام نشد.");
    } finally {
      setPending(false);
    }
  };

  const addOverride=async(athleteId:number)=>{if(!athleteId||overrides.some(item=>item.athlete===athleteId))return;setOverridePending(athleteId);setMessage("");try{const created=await apiFetch<ReminderOverride>("/reminder-overrides/",{method:"POST",body:JSON.stringify({athlete:athleteId,excluded:true,remind_before:null,remind_on_due:null,remind_after:null,weight_reminder_enabled:true})});setOverrides(current=>[...current,created]);setMessage("استثنای شاگرد ذخیره شد.")}catch{setMessage("ثبت استثنای شاگرد انجام نشد.")}finally{setOverridePending(null)}};
  const patchOverride=async(item:ReminderOverride,patch:Partial<ReminderOverride>)=>{setOverridePending(item.id);setMessage("");try{const updated=await apiFetch<ReminderOverride>(`/reminder-overrides/${item.id}/`,{method:"PATCH",body:JSON.stringify(patch)});setOverrides(current=>current.map(row=>row.id===item.id?updated:row));setMessage("تنظیم اختصاصی شاگرد ذخیره شد.")}catch{setMessage("ذخیره تنظیم اختصاصی انجام نشد.")}finally{setOverridePending(null)}};
  const athleteName=(id:number)=>athletes.find(item=>item.id===id)?.user.full_name||"شاگرد";

  if (loading) return <div className={styles.loadingLine} />;

  return (
    <section className={styles.panel}>
      <PanelHead title="تنظیمات اعلان" />
      <form className={styles.notificationForm} onSubmit={submit}>
        <NotificationToggle label="یادآوری پرداخت" checked={form.payment_reminders} onChange={(checked) => setForm({ ...form, payment_reminders: checked })} />
        <NotificationToggle label="یادآوری تمرین" checked={form.workout_reminders} onChange={(checked) => setForm({ ...form, workout_reminders: checked })} />
        <NotificationToggle label="یادآوری پیش از سررسید" checked={form.remind_before} onChange={(checked) => setForm({ ...form, remind_before: checked })} />
        <label><span>روز قبل از سررسید</span><input type="number" min="0" value={form.days_before_due} onChange={(event) => setForm({ ...form, days_before_due: Number(event.target.value) })} /></label>
        <NotificationToggle label="یادآوری روز سررسید" checked={form.remind_on_due} onChange={(checked) => setForm({ ...form, remind_on_due: checked })} />
        <NotificationToggle label="یادآوری پس از سررسید" checked={form.remind_after} onChange={(checked) => setForm({ ...form, remind_after: checked })} />
        <label><span>روز بعد از سررسید</span><input type="number" min="0" value={form.days_after_due} onChange={(event) => setForm({ ...form, days_after_due: Number(event.target.value) })} /></label>
        <label><span>دوره پیگیری شاگرد غیرفعال</span><input type="number" min="0" value={form.follow_up_days} onChange={(event) => setForm({ ...form, follow_up_days: Number(event.target.value) })} /></label>
        <label className={styles.reminderMessage}><span>متن پیش از سررسید</span><textarea value={form.payment_message_before} onChange={event=>setForm({...form,payment_message_before:event.target.value})} placeholder="سلام {athlete_name}، سررسید {service_type} در تاریخ {due_date} است."/></label>
        <label className={styles.reminderMessage}><span>متن روز سررسید</span><textarea value={form.payment_message_on_due} onChange={event=>setForm({...form,payment_message_on_due:event.target.value})} placeholder="یادآوری پرداخت مبلغ {amount} برای {service_type}"/></label>
        <label className={styles.reminderMessage}><span>متن پس از سررسید</span><textarea value={form.payment_message_after} onChange={event=>setForm({...form,payment_message_after:event.target.value})} placeholder="پرداخت {service_type} شما از تاریخ {due_date} گذشته است."/></label>
        <p className={styles.reminderHint}>متغیرهای قابل استفاده: {"{athlete_name}"}، {"{service_type}"}، {"{due_date}"} و {"{amount}"}</p>
        <section className={styles.reminderOverrides}><div><b>استثناهای شاگردان</b><select defaultValue="" onChange={event=>{void addOverride(Number(event.target.value));event.currentTarget.value=""}} disabled={overridePending!==null}><option value="">افزودن شاگرد...</option>{athletes.filter(item=>item.is_active!==false&&!overrides.some(row=>row.athlete===item.id)).map(item=><option key={item.id} value={item.id}>{item.user.full_name}</option>)}</select></div>{overrides.length?overrides.map(item=><article key={item.id}><span><Avatar/><b>{athleteName(item.athlete)}</b></span><label>قبل<select value={item.remind_before===null?"inherit":String(item.remind_before)} onChange={event=>void patchOverride(item,{remind_before:event.target.value==="inherit"?null:event.target.value==="true"})}><option value="inherit">عمومی</option><option value="true">فعال</option><option value="false">غیرفعال</option></select></label><label>سررسید<select value={item.remind_on_due===null?"inherit":String(item.remind_on_due)} onChange={event=>void patchOverride(item,{remind_on_due:event.target.value==="inherit"?null:event.target.value==="true"})}><option value="inherit">عمومی</option><option value="true">فعال</option><option value="false">غیرفعال</option></select></label><label>بعد<select value={item.remind_after===null?"inherit":String(item.remind_after)} onChange={event=>void patchOverride(item,{remind_after:event.target.value==="inherit"?null:event.target.value==="true"})}><option value="inherit">عمومی</option><option value="true">فعال</option><option value="false">غیرفعال</option></select></label><button type="button" disabled={overridePending!==null} className={item.excluded?styles.overrideExcluded:""} onClick={()=>void patchOverride(item,{excluded:!item.excluded})}>{item.excluded?"مستثنا از ارسال":"ارسال فعال"}</button></article>):<p>برای هیچ شاگردی تنظیم اختصاصی ثبت نشده است.</p>}</section>
        <div className={styles.notificationActions}>{message ? <span>{message}</span> : null}<button className={styles.primaryButton} disabled={pending}>{pending ? "در حال ذخیره..." : "ذخیره تنظیمات"}</button></div>
      </form>
    </section>
  );
}

function NotificationToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className={styles.notificationToggle}><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></label>;
}

function SummaryCard({ title, value, meta, change, changeLabel, tone }: { title: string; value: string; meta?: string; change?: number | null; changeLabel?: string; tone?: "green" | "orange" }) {
  return (
    <article className={`${styles.summaryCard} ${tone === "green" ? styles.summaryGreen : ""} ${tone === "orange" ? styles.summaryOrange : ""}`}>
      <CardTitle>{title}</CardTitle>
      <div className={styles.summaryCardValue}>
        <strong>{value}</strong>
        {change != null ? <span className={styles.summaryChange}><b>↗ {new Intl.NumberFormat("fa-IR").format(change)}٪</b><small>{changeLabel}</small></span> : <small className={styles.summaryChangeEmpty}>{meta ?? "اطلاعات درصدی ثبت نشده است"}</small>}
      </div>
    </article>
  );
}

function Status({ tone, children }: { tone?: string; children: React.ReactNode }) {
  const normalized = tone === "done" || tone === "paid" || tone === "active" ? "green" : tone === "open" || tone === "needs_follow_up" || tone === "incomplete" ? "yellow" : tone === "stalled" || tone === "overdue" ? "red" : "blue";
  return <span className={`${styles.status} ${styles[`status${normalized}`]}`}><i />{children}</span>;
}

function EmptyState({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className={styles.emptyState}>
      <Icon name="search" size={32} />
      <p>{title}</p>
      {action ? <button className={styles.primaryButton} onClick={onAction}>{action}</button> : null}
    </div>
  );
}

function PanelHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className={styles.blockHead}>
      <h2>{title}</h2>
      {action ? <button className={styles.primaryButton} onClick={onAction}><Icon name="plus" />{action}</button> : <button aria-label="منو"><MenuDots/></button>}
    </div>
  );
}

function InvoiceTable({ invoices, onPay }: { invoices: Invoice[]; onPay?: (invoice:Invoice) => void }) {
  if (invoices.length === 0) {
    return <EmptyState title="هیچ فاکتوری از وب‌سرویس دریافت نشده است." />;
  }

  return (
    <div className={`${styles.invoiceTable} ${styles.financeInvoiceTable}`}>
      <div className={styles.invoiceHeader}><span>کاربر</span><span>سرویس</span><span>مبلغ</span><span>سررسید</span><span>مانده تا سررسید</span><span>نوع</span><span>عملیات</span></div>
      {invoices.map((invoice) => (
        <div className={styles.invoiceRow} key={invoice.id}>
          <span className={styles.financePerson}><Avatar/><span><b>{invoice.payer_name}</b><small>فاکتور #{invoice.id.toLocaleString("fa-IR")}</small></span></span>
          <span>{invoice.service_name || "سرویس"}</span>
          <span>{formatMoney(invoice.payable || invoice.amount)}</span>
          <span>{formatPersianDate(invoice.due_date)}</span>
          <span>{invoice.status==="paid"?<Status tone="paid">پرداخت شده</Status>:invoice.days_overdue>0?<Status tone="overdue">{invoice.days_overdue.toLocaleString("fa-IR")} روز معوق</Status>:`${Math.max(0,invoice.days_until_due).toLocaleString("fa-IR")} روز`}</span>
          <span>{invoice.status==="paid"?"تسویه":invoice.installments?.length?"اقساطی":"بدهکار"}</span>
          <button className={styles.primaryButton} disabled={invoice.status==="paid"} onClick={()=>onPay?.(invoice)}>{invoice.status==="paid"?"تسویه شده":"ثبت پرداخت"}</button>
        </div>
      ))}
    </div>
  );
}

function PaymentHistoryTable({payments,onEdit}:{payments:Payment[];onEdit?:(payment:Payment)=>void}) {
  if(!payments.length)return <EmptyState title="سابقه پرداختی از وب‌سرویس دریافت نشده است."/>;
  return <div className={`${styles.invoiceTable} ${styles.paymentHistoryTable} ${styles.financePaymentTable}`}>
    <div className={styles.invoiceHeader}><span>کاربر</span><span>سرویس</span><span>مبلغ</span><span>سررسید</span><span>تاریخ پرداخت</span><span>روش پرداخت</span><span>عملیات</span></div>
    {payments.map(payment=><div className={styles.invoiceRow} key={payment.id}><span className={styles.financePerson}><Avatar/><span><b>{payment.payer_name||"شاگرد"}</b><small>پرداخت #{payment.id.toLocaleString("fa-IR")}</small></span></span><span>{payment.service_name||"-"}</span><span>{formatMoney(payment.amount)}</span><span>{formatPersianDate(payment.due_date)}</span><span>{formatPersianDate(payment.paid_at)}</span><span>{paymentMethodLabel(payment.method)}</span><button aria-label="ویرایش پرداخت" onClick={()=>onEdit?.(payment)}><Icon name="edit"/></button></div>)}
  </div>;
}

function paymentMethodLabel(method?:string){return ({cash:"نقدی",pos:"کارت‌خوان",card_transfer:"کارت به کارت",gateway:"درگاه پرداخت"} as Record<string,string>)[method||""]||method||"ثبت نشده"}

function InfoGrid({ items }: { items: [string, string][] }) {
  return (
    <div className={styles.infoGrid}>
      {items.map(([label, value]) => (
        <p key={label}><span>{label}</span><b>{value}</b></p>
      ))}
    </div>
  );
}

function AppModal({
  name,
  data,
  onClose,
  onSaved,
}: {
  name: ModalName;
  data: ReturnType<typeof useCoachData>;
  onClose: () => void;
  onSaved: () => void;
}) {
  if (!name) {
    return null;
  }

  if (name === "search") {
    return <SearchOverlay onClose={onClose} data={data} />;
  }

  if (name === "qr") {
    return <ModalShell onClose={onClose} small><QrModal coach={data.coach} onClose={onClose} /></ModalShell>;
  }

  return (
    <ModalShell onClose={onClose}>
      {name === "student" ? <StudentModal onClose={onClose} onSaved={onSaved} athletes={data.athletes} /> : null}
      {name === "task" ? <TaskModal onClose={onClose} onSaved={onSaved} athletes={data.athletes} /> : null}
      {name === "personalTask" ? <TaskModal onClose={onClose} onSaved={onSaved} athletes={data.athletes} defaultKind="personal" /> : null}
      {name === "service" ? <ServiceModal onClose={onClose} onSaved={onSaved} categories={data.categories} /> : null}
      {name === "category" ? <CategoryModal onClose={onClose} onSaved={onSaved} /> : null}
      {name === "invoice" ? <InvoiceModal onClose={onClose} onSaved={onSaved} athletes={data.athletes} services={data.services} /> : null}
      {name === "payment" ? <PaymentModal onClose={onClose} onSaved={onSaved} invoices={data.invoices} /> : null}
      {name === "workout" ? <WorkoutModal onClose={onClose} onSaved={onSaved} athletes={data.athletes} initialType="workout" /> : null}
      {name === "nutrition" ? <WorkoutModal onClose={onClose} onSaved={onSaved} athletes={data.athletes} initialType="nutrition" /> : null}
      {name === "settings" ? <SettingsModal onClose={onClose} onSaved={onSaved} coach={data.coach} /> : null}
    </ModalShell>
  );
}

function ModalShell({ children, onClose, small = false }: { children: React.ReactNode; onClose: () => void; small?: boolean }) {
  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={`${styles.modal} ${small ? styles.modalSmall : ""}`} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className={styles.modalHead}>
      <h2>{title}</h2>
      <button onClick={onClose}><Icon name="close" /></button>
    </div>
  );
}

function useSubmit(onSaved: () => void, mapError?: (error: unknown) => string | undefined) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = useCallback(async (path: string, body: Record<string, unknown>, method = "POST") => {
    setPending(true);
    setError("");
    try {
      await apiFetch(path, { method, body: JSON.stringify(body) });
      onSaved();
    } catch (submitError) {
      const mappedError = mapError?.(submitError);
      if (mappedError) {
        setError(mappedError);
      } else {
        const detail = submitError instanceof Error && submitError.message.includes("400")
          ? "اطلاعات واردشده را بررسی کنید."
          : "ارتباط با سرور برقرار نشد.";
        setError(`ثبت اطلاعات: ${detail}`);
      }
    } finally {
      setPending(false);
    }
  }, [mapError, onSaved]);

  return { error, pending, submit, setError };
}

function StudentModal({ onClose, onSaved, athletes }: { onClose: () => void; onSaved: () => void; athletes: RosterAthlete[] }) {
  const [phoneError, setPhoneError] = useState("");
  const mapStudentError = useCallback((submitError: unknown) => {
    const message = studentPhoneError(submitError);
    if (!message) return undefined;
    setPhoneError(message);
    return `ثبت شاگرد: ${message}`;
  }, []);
  const { error, pending, submit, setError } = useSubmit(onSaved, mapStudentError);
  return (
    <>
      <ModalHead title="ثبت شاگرد جدید" onClose={onClose} />
      <form className={`${styles.form} ${styles.studentForm}`} onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const firstName = String(form.get("first_name") || "").trim();
        const lastName = String(form.get("last_name") || "").trim();
        const phone = String(form.get("phone") || "").trim();
        setPhoneError("");
        if (!firstName || !lastName || !phone) {
          setError("ثبت شاگرد: نام، نام خانوادگی و شماره موبایل را وارد کنید.");
          if (!phone) setPhoneError("وارد کردن شماره موبایل الزامی است.");
          return;
        }
        const normalizedPhone = normalizePhone(phone);
        const phoneAlreadyRegistered = normalizedPhone.length > 0 && athletes.some((athlete) => normalizePhone(athlete.user.phone) === normalizedPhone);
        if (phoneAlreadyRegistered) {
          const message = "این شماره موبایل قبلاً ثبت شده است و امکان ثبت مجدد آن وجود ندارد.";
          setPhoneError(message);
          setError(`ثبت شاگرد: ${message}`);
          return;
        }
        void submit("/coach/athletes/", {
          full_name: `${firstName} ${lastName}`,
          phone,
          age: form.get("age") ? Number(form.get("age")) : undefined,
          height: form.get("height") ? Number(form.get("height")) : undefined,
          weight: form.get("weight") ? Number(form.get("weight")) : undefined,
          gender: form.get("gender"),
          goal: form.get("goal"),
          level: form.get("level"),
          training_days: Number(form.get("training_days") || 3),
          injuries: form.get("injuries"),
          is_active: true,
        });
      }}>
        <div className={styles.formGrid}>
          <Field name="first_name" label="نام" placeholder="مثال: علی" required />
          <Field name="last_name" label="نام خانوادگی" placeholder="مثال: حسینی" required />
        </div>
        <div className={styles.formGrid}>
          <Field
            name="phone"
            label="موبایل"
            inputMode="tel"
            placeholder="مثال: 09120000000"
            required
            error={phoneError}
            onChange={() => { if (phoneError) setPhoneError(""); }}
          />
          <Field name="age" label="سن" type="number" min={1} placeholder="انتخاب کنید" />
        </div>
        <div className={styles.formGrid}>
          <Select name="gender" label="جنسیت" options={[["male", "آقا"], ["female", "خانم"]]} />
          <Field name="weight" label="وزن (کیلوگرم)" type="number" min={1} placeholder="انتخاب کنید" />
        </div>
        <div className={styles.formGrid}>
          <Field name="height" label="قد (سانتی‌متر)" type="number" min={1} placeholder="انتخاب کنید" />
          <Select name="goal" label="هدف" options={[["fat_loss", "کاهش وزن"], ["muscle_gain", "افزایش حجم"], ["strength", "قدرت"]]} />
        </div>
        <div className={styles.formGrid}>
          <Field name="training_days" label="روز تمرین در هفته" type="number" min={1} max={7} placeholder="انتخاب کنید" />
          <Select name="level" label="سطح" options={[["beginner", "مبتدی"], ["intermediate", "متوسط"], ["advanced", "حرفه‌ای"]]} />
        </div>
        <Textarea name="injuries" label="آسیب‌دیدگی یا توضیحات" />
        <FormError error={error} />
        <ModalActions onClose={onClose} pending={pending} submitLabel="ثبت شاگرد" />
      </form>
    </>
  );
}

function TaskModal({ onClose, onSaved, athletes, defaultKind = "training_plan" }: { onClose: () => void; onSaved: () => void; athletes: RosterAthlete[]; defaultKind?: string }) {
  const { error, pending, submit } = useSubmit(onSaved);
  return (
    <>
      <ModalHead title="اقدام جدید" onClose={onClose} />
      <form className={styles.form} onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void submit("/coach/tasks/", {
          title: form.get("title"),
          kind: form.get("kind"),
          athlete: Number(form.get("athlete") || 0) || null,
          due_date: form.get("due_date"),
          note: form.get("note"),
        });
      }}>
        <Field name="title" label="عنوان اقدام" required />
        <div className={styles.formGrid}>
          <Select name="kind" label="نوع" defaultValue={defaultKind} options={[["training_plan", "برنامه تمرینی"], ["nutrition_plan", "برنامه غذایی"], ["payment_follow_up", "پیگیری پرداخت"], ["personal", "شخصی"], ["churn", "ریزش"]]} />
          <Select name="athlete" label="شاگرد" options={athletes.map((athlete) => [String(athlete.id), athlete.user.full_name])} />
        </div>
        <Field name="due_date" label="تاریخ" type="date" />
        <Textarea name="note" label="توضیحات" />
        <FormError error={error} />
        <ModalActions onClose={onClose} pending={pending} submitLabel="ثبت اقدام" />
      </form>
    </>
  );
}

function ServiceModal({ onClose, onSaved, categories, service }: { onClose: () => void; onSaved: () => void; categories: ServiceCategory[]; service?: Service }) {
  const { error, pending, submit } = useSubmit(onSaved);
  return (
    <>
      <ModalHead title={service?"ویرایش سرویس":"سرویس جدید"} onClose={onClose} />
      <form className={styles.form} onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void submit(service?`/services/${service.id}/`:"/services/", {
          name: form.get("name"),
          category: Number(form.get("category")),
          default_price: Number(form.get("default_price") || 0),
          out_of_app_price: Number(form.get("out_of_app_price") || 0),
          description: form.get("description"),
        },service?"PATCH":"POST");
      }}>
        <Field name="name" label="نام سرویس" defaultValue={service?.name||""} required />
        <Select name="category" label="دسته‌بندی" defaultValue={service?String(service.category):""} options={categories.map((category) => [String(category.id), category.name])} />
        <div className={styles.formGrid}>
          <Field name="default_price" label="قیمت داخل اپ" type="number" defaultValue={service?String(service.default_price):""} required />
          <Field name="out_of_app_price" label="قیمت خارج از اپ" type="number" defaultValue={service?.out_of_app_price?String(service.out_of_app_price):""} />
        </div>
        <Textarea name="description" label="توضیحات" defaultValue={service?.description||""} />
        <FormError error={error} />
        <ModalActions onClose={onClose} pending={pending} submitLabel={service?"اعمال تغییرات":"ثبت سرویس"} />
      </form>
    </>
  );
}

function CategoryModal({onClose,onSaved,category}:{onClose:()=>void;onSaved:()=>void;category?:ServiceCategory}) {
  const {error,pending,submit}=useSubmit(onSaved);
  return <><ModalHead title={category?"ویرایش دسته‌بندی":"دسته‌بندی جدید"} onClose={onClose}/><form className={styles.form} onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);void submit(category?`/service-categories/${category.id}/`:"/service-categories/",{name:form.get("name")},category?"PATCH":"POST")}}><Field name="name" label="نام دسته‌بندی" defaultValue={category?.name||""} required/><FormError error={error}/><ModalActions onClose={onClose} pending={pending} submitLabel={category?"اعمال تغییرات":"ثبت دسته‌بندی"}/></form></>;
}

type InstallmentDraft={amount:string;due_date:string};
function InvoiceModal({onClose,onSaved,athletes,services,defaultService}:{onClose:()=>void;onSaved:()=>void;athletes:RosterAthlete[];services:Service[];defaultService?:Service}) {
  const [payer,setPayer]=useState("");const [serviceId,setServiceId]=useState(defaultService?String(defaultService.id):"");const [amount,setAmount]=useState(defaultService?String(defaultService.default_price):"");const [dueDate,setDueDate]=useState(new Date().toISOString().slice(0,10));const [priceMode,setPriceMode]=useState<"in_app"|"out_of_app">("in_app");const [mode,setMode]=useState<"debtor"|"settled"|"installments">("settled");
  const [installments,setInstallments]=useState<InstallmentDraft[]>([{amount:"",due_date:""}]);
  const [pending,setPending]=useState(false);const [error,setError]=useState("");
  const selectedService=services.find(service=>String(service.id)===serviceId);const payable=Number(amount||0);const installmentTotal=installments.reduce((sum,item)=>sum+Number(item.amount||0),0);
  const chooseService=(service:Service)=>{setServiceId(String(service.id));setPriceMode("in_app");setAmount(String(service.default_price))};
  const changePriceMode=(value:"in_app"|"out_of_app")=>{setPriceMode(value);if(selectedService)setAmount(String(value==="out_of_app"?(selectedService.out_of_app_price??selectedService.default_price):selectedService.default_price))};
  const submit=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();setError("");const form=new FormData(event.currentTarget);if(!serviceId||payable<=0){setError("خدمت و مبلغ را کامل کنید.");return}if(!form.get("payer")){setError("شاگرد را انتخاب کنید.");return}if(mode==="installments"&&(installmentTotal!==payable||!installments.every(item=>item.due_date&&Number(item.amount)>0))){setError("جمع اقساط باید دقیقاً با مبلغ نهایی برابر باشد.");return}setPending(true);try{await apiFetch("/invoices/",{method:"POST",body:JSON.stringify({payer:Number(form.get("payer")),items:[{service:Number(serviceId),amount:payable,price_mode:priceMode}],discount:0,due_date:form.get("due_date"),kind:"one_off",payment_mode:mode,...(mode==="installments"?{installment_plan:installments.map(item=>({amount:Number(item.amount),due_date:item.due_date}))}:{})})});onSaved()}catch(error){setError(error instanceof ApiRequestError?apiErrorText(error.payload):error instanceof Error?error.message:"صدور فاکتور انجام نشد؛ اطلاعات واردشده را بررسی کنید.")}finally{setPending(false)}};
  return <><ModalHead title="صدور فاکتور" onClose={onClose}/><form className={`${styles.form} ${styles.invoiceForm} ${styles.serviceInvoiceForm}`} onSubmit={submit}><Select name="payer" label="شاگرد" options={athletes.filter(item=>item.is_active!==false).map(item=>[String(item.user.id),item.user.full_name])} value={payer} onChange={event=>setPayer(event.target.value)}/><div className={styles.invoiceServiceBlock}><span>انتخاب خدمت</span><div className={styles.invoiceServiceChoices}>{services.map(service=><button type="button" className={serviceId===String(service.id)?styles.invoiceServiceActive:""} onClick={()=>chooseService(service)} key={service.id}><span className={styles.serviceIcon}><Icon name="training"/></span><span><b>{service.name}</b><small>{formatMoney(service.default_price)}</small></span></button>)}</div></div><div className={styles.formGrid}><Field name="amount" label="مبلغ" type="number" min="1" value={amount} onChange={event=>setAmount(event.target.value)} required/><Field name="due_date" label="سررسید پرداخت" type="date" value={dueDate} onChange={event=>setDueDate(event.target.value)} disabled={mode!=="debtor"} required={mode==="debtor"}/></div>{selectedService?.out_of_app_price!==undefined?<div className={styles.invoicePriceModes}><button type="button" className={priceMode==="in_app"?styles.paymentModeActive:""} onClick={()=>changePriceMode("in_app")}>قیمت داخل اپ</button><button type="button" className={priceMode==="out_of_app"?styles.paymentModeActive:""} onClick={()=>changePriceMode("out_of_app")}>قیمت خارج از اپ</button></div>:null}<div><span className={styles.invoiceSectionLabel}>نوع پرداخت</span><div className={styles.invoicePaymentModes}><button type="button" className={mode==="settled"?styles.invoicePaymentActive:""} onClick={()=>setMode("settled")}><Icon name="check"/><b>تسویه شده</b><small>همین لحظه</small></button><button type="button" className={mode==="debtor"?styles.invoicePaymentActive:""} onClick={()=>setMode("debtor")}><Icon name="calendar"/><b>بدهکار</b><small>با سررسید</small></button><button type="button" className={mode==="installments"?styles.invoicePaymentActive:""} onClick={()=>setMode("installments")}><Icon name="calendar"/><b>اقساطی</b><small>چند قسط</small></button></div></div>{mode==="installments"?<div className={styles.installments}><div className={styles.invoiceItemsHead}><b>برنامه اقساط</b><button type="button" onClick={()=>setInstallments(current=>[...current,{amount:"",due_date:""}])}><Icon name="plus"/>افزودن قسط</button></div>{installments.map((item,index)=><div key={index}><input type="number" min="1" value={item.amount} onChange={event=>setInstallments(current=>current.map((row,rowIndex)=>rowIndex===index?{...row,amount:event.target.value}:row))} placeholder="مبلغ قسط"/><input type="date" {...dateInputProps()} value={item.due_date} onChange={event=>setInstallments(current=>current.map((row,rowIndex)=>rowIndex===index?{...row,due_date:event.target.value}:row))}/><button type="button" disabled={installments.length===1} onClick={()=>setInstallments(current=>current.filter((_,rowIndex)=>rowIndex!==index))}><Icon name="trash"/></button></div>)}<p className={installmentTotal===payable?styles.totalValid:styles.totalInvalid}>جمع اقساط: {formatMoney(installmentTotal)} از {formatMoney(payable)}</p></div>:null}<div className={styles.serviceInvoiceSummary}><span>شاگرد<b>{athletes.find(item=>String(item.user.id)===payer)?.user.full_name||"انتخاب نشده"}</b></span><span>خدمت<b>{selectedService?.name||"انتخاب نشده"}</b></span><span>سررسید<b>{mode==="settled"?"همین لحظه":formatPersianDate(dueDate)}</b></span><span>مبلغ نهایی<b>{formatMoney(payable)}</b></span></div><FormError error={error}/><ModalActions onClose={onClose} pending={pending} submitLabel="صدور فاکتور"/></form></>;
}

function PaymentModal({ onClose, onSaved, invoices, defaultInvoice, payment }: { onClose: () => void; onSaved: () => void; invoices: Invoice[]; defaultInvoice?:Invoice; payment?:Payment }) {
  const { error, pending, submit } = useSubmit(onSaved);
  const [invoiceId,setInvoiceId]=useState(payment?.invoice?String(payment.invoice):defaultInvoice?String(defaultInvoice.id):"");const selectedInvoice=invoices.find(invoice=>String(invoice.id)===invoiceId);const [amount,setAmount]=useState(payment?String(payment.amount):defaultInvoice?String(defaultInvoice.outstanding):"");const [paidAt,setPaidAt]=useState(payment?.paid_at||new Date().toISOString().slice(0,10));const [method,setMethod]=useState(payment?.method||"");
  return (
    <>
      <ModalHead title={payment?"ویرایش پرداخت":"ثبت پرداخت"} onClose={onClose} />
      <form className={styles.form} onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void submit(payment?`/payments/${payment.id}/`:"/payments/", {
          invoice: Number(invoiceId),
          amount: Number(amount || 0),
          method,
          tracking_no: form.get("tracking_no"),
          paid_at: paidAt,
        },payment?"PATCH":"POST");
      }}>
        {selectedInvoice?<div className={styles.paymentInvoicePreview}><span className={styles.serviceIcon}><Icon name="money"/></span><span><b>{selectedInvoice.service_name||"فاکتور خدمات"}</b><small>{selectedInvoice.payer_name} · سررسید {formatPersianDate(selectedInvoice.due_date)}</small></span><strong>{formatMoney(selectedInvoice.outstanding)}</strong></div>:<Select name="invoice" label="فاکتور" options={invoices.filter(invoice=>invoice.status!=="paid").map((invoice) => [String(invoice.id), `${invoice.payer_name} - ${invoice.service_name||"سرویس"} - ${formatMoney(invoice.outstanding)}`])} value={invoiceId} onChange={event=>{const value=event.target.value;setInvoiceId(value);const invoice=invoices.find(item=>String(item.id)===value);setAmount(invoice?String(invoice.outstanding):"")}} />}
        <div className={styles.formGrid}>
          <Field name="amount" label="مبلغ دریافتی" type="number" value={amount} onChange={event=>setAmount(event.target.value)} required />
          <Field name="paid_at" label="تاریخ" type="date" value={paidAt} onChange={event=>setPaidAt(event.target.value)} required/>
        </div>
        <Select name="method" label="روش پرداخت" options={[["cash", "نقدی"], ["pos", "کارت‌خوان"], ["card_transfer", "کارت به کارت"], ["gateway", "درگاه پرداخت"]]} value={method} onChange={event=>setMethod(event.target.value)}/>
        <Textarea name="tracking_no" label="توضیحات یا شماره پیگیری (اختیاری)" defaultValue={payment?.tracking_no||""}/>
        <FormError error={error} />
        <ModalActions onClose={onClose} pending={pending} submitLabel={payment?"اعمال تغییرات":"ثبت پرداخت"} />
      </form>
    </>
  );
}

function emptyWorkoutDays(count:number):WorkoutDraftDay[]{return Array.from({length:count},(_,index)=>({name:`روز ${index+1}`,exercises:[]}))}
function resizeWorkoutDays(days:WorkoutDraftDay[],count:number){return Array.from({length:count},(_,index)=>days[index]??{name:`روز ${index+1}`,exercises:[]})}

function WorkoutDaysEditor({days,onChange,onRemoveExercise}:{days:WorkoutDraftDay[];onChange:(days:WorkoutDraftDay[])=>void;onRemoveExercise?:(exercise:WorkoutExercise)=>void}){
  const [openDay,setOpenDay]=useState(0);
  useEffect(()=>{if(openDay>=days.length)setOpenDay(Math.max(0,days.length-1))},[days.length,openDay]);
  const updateExercise=(dayIndex:number,exerciseIndex:number,patch:Partial<WorkoutExercise>)=>onChange(days.map((day,index)=>index===dayIndex?{...day,exercises:day.exercises.map((exercise,itemIndex)=>itemIndex===exerciseIndex?{...exercise,...patch}:exercise)}:day));
  const removeExercise=(dayIndex:number,exerciseIndex:number)=>{const target=days[dayIndex].exercises[exerciseIndex];onRemoveExercise?.(target);onChange(days.map((day,index)=>index===dayIndex?{...day,exercises:day.exercises.filter((_,itemIndex)=>itemIndex!==exerciseIndex)}:day))};
  return <div className={styles.workoutDaysEditor}>{days.map((day,dayIndex)=><section key={dayIndex}><button type="button" className={styles.workoutDayHead} onClick={()=>setOpenDay(dayIndex)}><span>{day.name||`روز ${dayIndex+1}`}</span><small>{day.exercises.length.toLocaleString("fa-IR")} حرکت</small><i>{openDay===dayIndex?"⌃":"⌄"}</i></button>{openDay===dayIndex?<div className={styles.workoutExerciseTable}><div><span>عنوان</span><span>تعداد ست</span><span>تعداد تکرار</span><span>وزن</span><span/></div>{day.exercises.map((exercise,exerciseIndex)=><div key={exercise.id??exerciseIndex}><input value={exercise.name} onChange={event=>updateExercise(dayIndex,exerciseIndex,{name:event.target.value})} placeholder="نام حرکت"/><input type="number" min="1" value={exercise.sets} onChange={event=>updateExercise(dayIndex,exerciseIndex,{sets:Number(event.target.value)})}/><input type="number" min="1" value={exercise.reps} onChange={event=>updateExercise(dayIndex,exerciseIndex,{reps:Number(event.target.value)})}/><span>-</span><button type="button" aria-label="حذف حرکت" onClick={()=>removeExercise(dayIndex,exerciseIndex)}><Icon name="trash"/></button></div>)}<button type="button" className={styles.addWorkoutExercise} onClick={()=>onChange(days.map((item,index)=>index===dayIndex?{...item,exercises:[...item.exercises,{name:"",sets:3,reps:12}]}:item))}><Icon name="plus"/>حرکت</button></div>:null}</section>)}</div>
}

function ProgramTypeSelector({value,onChange}:{value:"workout"|"nutrition";onChange:(value:"workout"|"nutrition")=>void}){
  return <><div className={styles.workoutTypeLabel}>نوع برنامه</div><div className={styles.workoutTypeCards}><button type="button" className={value==="workout"?styles.workoutTypeActive:""} onClick={()=>onChange("workout")}><span><Icon name="training"/></span>برنامه تمرینی</button><button type="button" className={value==="nutrition"?styles.workoutTypeActive:""} onClick={()=>onChange("nutrition")}><span className={styles.workoutFoodIcon}><Icon name="grid"/></span>برنامه غذایی</button></div></>;
}

function WorkoutModal({ onClose, onSaved, athletes, initialType = "workout" }: { onClose: () => void; onSaved: () => void; athletes: RosterAthlete[]; initialType?: "workout" | "nutrition" }) {
  const [programType,setProgramType]=useState<"workout"|"nutrition">(initialType);const [athlete,setAthlete]=useState("");const [days,setDays]=useState<WorkoutDraftDay[]>(emptyWorkoutDays(1));const [pending,setPending]=useState(false);const [error,setError]=useState("");const [intent,setIntent]=useState<"save"|"send">("save");
  const submit=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();if(intent==="send"&&!athlete){setError("برای ثبت و ارسال، شاگرد را انتخاب کنید.");return}if(days.some(day=>day.exercises.some(exercise=>!exercise.name.trim()))){setError("نام همه حرکات را کامل کنید.");return}setPending(true);setError("");const form=new FormData(event.currentTarget);try{const plan=await apiFetch<WorkoutPlan>("/plans/",{method:"POST",body:JSON.stringify({title:form.get("title"),athlete:Number(athlete)||null,goal:form.get("goal"),days_count:days.length,duration_weeks:Number(form.get("duration_weeks")||4)})});for(let index=0;index<days.length;index++){const day=await apiFetch<WorkoutDay>("/workout-days/",{method:"POST",body:JSON.stringify({plan:plan.id,index:index+1,name:days[index].name})});for(const exercise of days[index].exercises)await apiFetch("/exercises/",{method:"POST",body:JSON.stringify({day:day.id,name:exercise.name,sets:exercise.sets,reps:exercise.reps,note:exercise.note||""})})}if(intent==="send")await apiFetch(`/plans/${plan.id}/send/`,{method:"POST",body:JSON.stringify({duration_weeks:Number(form.get("duration_weeks")||4)})});onSaved()}catch{setError("ذخیره برنامه کامل نشد؛ اطلاعات روزها و حرکات را بررسی کنید.")}finally{setPending(false)}};
  if(programType==="nutrition")return <NutritionCreateModal onClose={onClose} onSaved={onSaved} athletes={athletes} onTypeChange={setProgramType}/>;
  return <><ModalHead title="ساخت برنامه جدید" onClose={onClose}/><form className={`${styles.form} ${styles.workoutBuilderForm}`} onSubmit={submit}><ProgramTypeSelector value={programType} onChange={setProgramType}/><div className={styles.formGrid}><Field name="title" label="نام برنامه" placeholder="مثال: برنامه کاهش وزن مبتدی" required/><Select name="goal" label="دسته‌بندی" options={[["weight_loss","کاهش وزن"],["muscle_gain","افزایش حجم"],["strength","قدرت"],["fitness","تناسب اندام"]]}/></div><div className={styles.formGrid}><Select name="athlete" label="شاگرد (اختیاری)" options={athletes.filter(item=>item.is_active!==false).map(item=>[String(item.id),item.user.full_name])} value={athlete} onChange={event=>setAthlete(event.target.value)}/><Field name="duration_weeks" label="مدت اعتبار (هفته)" type="number" min="1" defaultValue="4"/></div><div className={styles.workoutDayCount}><span>تعداد روز در هفته</span><div>{[1,2,3,4,5,6].map(count=><button type="button" className={days.length===count?styles.workoutDayCountActive:""} onClick={()=>setDays(current=>resizeWorkoutDays(current,count))} key={count}>{count.toLocaleString("fa-IR")} روز</button>)}</div></div><WorkoutDaysEditor days={days} onChange={setDays}/><FormError error={error}/><div className={styles.workoutBuilderActions}><button type="button" onClick={onClose}>انصراف</button><button type="submit" className={styles.workoutDarkButton} disabled={pending} onClick={()=>setIntent("send")}>ثبت و ارسال</button><button type="submit" className={styles.primaryButton} disabled={pending} onClick={()=>setIntent("save")}>ثبت برنامه</button></div></form></>;
}

function WorkoutEditModal({plan,pending,setPending,onClose,onSaved}:{plan:WorkoutPlan;pending:boolean;setPending:(value:boolean)=>void;onClose:()=>void;onSaved:()=>Promise<void>}){
  const initial=(plan.days??[]).map(day=>({name:day.name||`روز ${day.index}`,exercises:day.exercises.map(exercise=>({...exercise}))}));const [days,setDays]=useState<WorkoutDraftDay[]>(initial.length?initial:emptyWorkoutDays(Math.max(1,plan.days_count??1)));const [removedExercises,setRemovedExercises]=useState<number[]>([]);const [removedDays,setRemovedDays]=useState<number[]>([]);const [error,setError]=useState("");const [deleteConfirm,setDeleteConfirm]=useState(false);
  const changeDayCount=(count:number)=>{setDays(current=>Array.from({length:count},(_,index)=>current[index]??initial[index]??{name:`روز ${index+1}`,exercises:[]}));setRemovedDays((plan.days??[]).slice(count).flatMap(day=>day.id?[day.id]:[]))};
  const save=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();setPending(true);setError("");const form=new FormData(event.currentTarget);try{await apiFetch(`/plans/${plan.id}/`,{method:"PATCH",body:JSON.stringify({title:form.get("title"),goal:form.get("goal"),days_count:days.length,duration_weeks:Number(form.get("duration_weeks")||4)})});for(const id of removedExercises)await apiFetch(`/exercises/${id}/`,{method:"DELETE"});for(const id of removedDays)await apiFetch(`/workout-days/${id}/`,{method:"DELETE"});for(let index=0;index<days.length;index++){const source=plan.days?.[index];const day=source?.id?await apiFetch<WorkoutDay>(`/workout-days/${source.id}/`,{method:"PATCH",body:JSON.stringify({index:index+1,name:days[index].name})}):await apiFetch<WorkoutDay>("/workout-days/",{method:"POST",body:JSON.stringify({plan:plan.id,index:index+1,name:days[index].name})});for(const exercise of days[index].exercises){const body=JSON.stringify({day:day.id,name:exercise.name,sets:exercise.sets,reps:exercise.reps,note:exercise.note||""});await apiFetch(exercise.id?`/exercises/${exercise.id}/`:"/exercises/",{method:exercise.id?"PATCH":"POST",body})}}await onSaved()}catch{setError("اعمال تغییرات برنامه انجام نشد.")}finally{setPending(false)}};
  const destroy=async()=>{setPending(true);try{await apiFetch(`/plans/${plan.id}/`,{method:"DELETE"});setDeleteConfirm(false);await onSaved()}catch{setError("حذف برنامه انجام نشد.")}finally{setPending(false)}};
  return <><div className={styles.overlay} onMouseDown={()=>!pending&&onClose()}><section className={`${styles.modal} ${styles.workoutEditModal}`} onMouseDown={event=>event.stopPropagation()}><ModalHead title="ویرایش برنامه" onClose={onClose}/><form className={`${styles.form} ${styles.workoutBuilderForm}`} onSubmit={save}><div className={styles.formGrid}><Field name="title" label="نام برنامه" defaultValue={plan.title} required/><Select name="goal" label="دسته‌بندی" defaultValue={plan.goal||""} options={[["weight_loss","کاهش وزن"],["muscle_gain","افزایش حجم"],["strength","قدرت"],["fitness","تناسب اندام"]]}/></div><Field name="duration_weeks" label="مدت اعتبار (هفته)" type="number" min="1" defaultValue={String(plan.duration_weeks??4)}/><div className={styles.workoutDayCount}><span>تعداد روز در هفته</span><div>{[1,2,3,4,5,6].map(count=><button type="button" className={days.length===count?styles.workoutDayCountActive:""} onClick={()=>changeDayCount(count)} key={count}>{count.toLocaleString("fa-IR")} روز</button>)}</div></div><WorkoutDaysEditor days={days} onChange={setDays} onRemoveExercise={exercise=>{if(exercise.id)setRemovedExercises(current=>[...current,exercise.id!])}}/><FormError error={error}/><div className={styles.workoutBuilderActions}><button type="button" onClick={onClose}>انصراف</button><button type="button" className={styles.dangerButton} onClick={()=>setDeleteConfirm(true)}>حذف برنامه</button><button className={styles.primaryButton} disabled={pending}>اعمال تغییرات</button></div></form></section></div>{deleteConfirm?<CoachConfirmDialog title="حذف برنامه؟" description={`برنامه «${plan.title}» و تمام روزها و حرکات آن حذف می‌شود.`} pending={pending} onCancel={()=>setDeleteConfirm(false)} onConfirm={()=>void destroy()}/>:null}</>
}

const mealKinds=[["breakfast","صبحانه"],["morning_snack","میان‌وعده صبح"],["lunch","ناهار"],["afternoon_snack","عصرانه"],["dinner","شام"],["post_workout","بعد از تمرین"],["supplement","مکمل"]] as const;
function mealKindLabel(kind:string){return mealKinds.find(item=>item[0]===kind)?.[1]??"وعده غذایی"}
function emptyNutritionMeals():NutritionMealDraft[]{return [{kind:"breakfast",name:"صبحانه",items:[]},{kind:"lunch",name:"ناهار",items:[]},{kind:"dinner",name:"شام",items:[]}]}

function NutritionMealsEditor({meals,onChange,onRemoveMeal,onRemoveItem}:{meals:NutritionMealDraft[];onChange:(meals:NutritionMealDraft[])=>void;onRemoveMeal?:(meal:NutritionMealDraft)=>void;onRemoveItem?:(item:NutritionMealItem)=>void}){
  const [openMeal,setOpenMeal]=useState(0);
  useEffect(()=>{if(openMeal>=meals.length)setOpenMeal(Math.max(0,meals.length-1))},[meals.length,openMeal]);
  const updateMeal=(index:number,patch:Partial<NutritionMealDraft>)=>onChange(meals.map((meal,itemIndex)=>itemIndex===index?{...meal,...patch}:meal));
  const updateItem=(mealIndex:number,itemIndex:number,patch:Partial<NutritionMealItem>)=>onChange(meals.map((meal,index)=>index===mealIndex?{...meal,items:meal.items.map((item,current)=>current===itemIndex?{...item,...patch}:item)}:meal));
  const removeItem=(mealIndex:number,itemIndex:number)=>{onRemoveItem?.(meals[mealIndex].items[itemIndex]);onChange(meals.map((meal,index)=>index===mealIndex?{...meal,items:meal.items.filter((_,current)=>current!==itemIndex)}:meal))};
  const removeMeal=(index:number)=>{onRemoveMeal?.(meals[index]);onChange(meals.filter((_,current)=>current!==index));setOpenMeal(Math.max(0,index-1))};
  return <div className={`${styles.workoutDaysEditor} ${styles.nutritionMealsEditor}`}>{meals.map((meal,mealIndex)=><section key={meal.id??mealIndex}><button type="button" className={styles.workoutDayHead} onClick={()=>setOpenMeal(mealIndex)}><span>{meal.name||mealKindLabel(meal.kind)}</span><small>{meal.items.length.toLocaleString("fa-IR")} مورد</small><i>{openMeal===mealIndex?"⌃":"⌄"}</i></button>{openMeal===mealIndex?<div className={styles.nutritionMealBody}><div className={styles.formGrid}><Select name={`meal_kind_${mealIndex}`} label="نوع وعده" options={mealKinds.map(item=>[item[0],item[1]])} value={meal.kind} onChange={event=>updateMeal(mealIndex,{kind:event.target.value,name:meal.name||mealKindLabel(event.target.value)})}/><label className={styles.inlineField}><span>نام وعده</span><input value={meal.name} onChange={event=>updateMeal(mealIndex,{name:event.target.value})}/></label></div><div className={styles.nutritionItemsTable}><div><span>ماده غذایی</span><span>مقدار (گرم)</span><span/></div>{meal.items.map((item,itemIndex)=><div key={item.id??itemIndex}><input value={item.name} placeholder="مثال: سینه مرغ" onChange={event=>updateItem(mealIndex,itemIndex,{name:event.target.value})}/><input type="number" min="1" value={item.amount_g} onChange={event=>updateItem(mealIndex,itemIndex,{amount_g:Number(event.target.value)})}/><button type="button" aria-label="حذف ماده غذایی" onClick={()=>removeItem(mealIndex,itemIndex)}><Icon name="trash"/></button></div>)}</div><div className={styles.nutritionMealActions}><button type="button" onClick={()=>updateMeal(mealIndex,{items:[...meal.items,{name:"",amount_g:100}]})}><Icon name="plus"/>افزودن ماده غذایی</button>{meals.length>1?<button type="button" onClick={()=>removeMeal(mealIndex)}><Icon name="trash"/>حذف وعده</button>:null}</div></div>:null}</section>)}<button type="button" className={styles.addNutritionMeal} onClick={()=>{onChange([...meals,{kind:"morning_snack",name:"میان‌وعده",items:[]}]);setOpenMeal(meals.length)}}><Icon name="plus"/>افزودن وعده</button></div>;
}

function NutritionCreateModal({onClose,onSaved,athletes,onTypeChange}:{onClose:()=>void;onSaved:()=>void;athletes:RosterAthlete[];onTypeChange:(value:"workout"|"nutrition")=>void}){
  const [athlete,setAthlete]=useState("");const [meals,setMeals]=useState<NutritionMealDraft[]>(emptyNutritionMeals());const [pending,setPending]=useState(false);const [error,setError]=useState("");const [intent,setIntent]=useState<"save"|"send">("save");
  const submit=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();if(intent==="send"&&!athlete){setError("برای ثبت و ارسال، شاگرد را انتخاب کنید.");return}if(meals.some(meal=>!meal.name.trim()||meal.items.some(item=>!item.name.trim()||item.amount_g<1))){setError("نام وعده‌ها و مواد غذایی و مقدار آن‌ها را کامل کنید.");return}setPending(true);setError("");const form=new FormData(event.currentTarget);try{const plan=await apiFetch<NutritionPlan>("/nutrition-plans/",{method:"POST",body:JSON.stringify({title:form.get("title"),athlete:Number(athlete)||null,goal:form.get("goal"),duration_weeks:Number(form.get("duration_weeks")||4)})});for(let index=0;index<meals.length;index++){const meal=await apiFetch<NutritionMeal>("/nutrition-meals/",{method:"POST",body:JSON.stringify({plan:plan.id,kind:meals[index].kind,index:index+1,name:meals[index].name})});for(const item of meals[index].items)await apiFetch("/nutrition-meal-items/",{method:"POST",body:JSON.stringify({meal:meal.id,food:null,name:item.name,amount_g:item.amount_g})})}if(intent==="send")await apiFetch(`/nutrition-plans/${plan.id}/send/`,{method:"POST",body:JSON.stringify({duration_weeks:Number(form.get("duration_weeks")||4)})});onSaved()}catch{setError("ذخیره برنامه غذایی کامل نشد؛ وعده‌ها و مواد غذایی را بررسی کنید.")}finally{setPending(false)}};
  return <><ModalHead title="ساخت برنامه جدید" onClose={onClose}/><form className={`${styles.form} ${styles.workoutBuilderForm}`} onSubmit={submit}><ProgramTypeSelector value="nutrition" onChange={onTypeChange}/><div className={styles.formGrid}><Field name="title" label="نام برنامه" placeholder="مثال: برنامه غذایی کاهش وزن" required/><Select name="goal" label="دسته‌بندی" options={[["fat_loss","کاهش وزن"],["muscle_gain","افزایش حجم"],["fitness","تناسب اندام"],["maintenance","تثبیت وزن"]]}/></div><div className={styles.formGrid}><Select name="athlete" label="شاگرد (اختیاری)" options={athletes.filter(item=>item.is_active!==false).map(item=>[String(item.id),item.user.full_name])} value={athlete} onChange={event=>setAthlete(event.target.value)}/><Field name="duration_weeks" label="مدت اعتبار (هفته)" type="number" min="1" defaultValue="4"/></div><NutritionMealsEditor meals={meals} onChange={setMeals}/><FormError error={error}/><div className={styles.workoutBuilderActions}><button type="button" onClick={onClose}>انصراف</button><button type="submit" className={styles.workoutDarkButton} disabled={pending} onClick={()=>setIntent("send")}>ثبت و ارسال</button><button type="submit" className={styles.primaryButton} disabled={pending} onClick={()=>setIntent("save")}>ثبت برنامه</button></div></form></>;
}

function NutritionEditModal({plan,pending,setPending,onClose,onSaved}:{plan:NutritionPlan;pending:boolean;setPending:(value:boolean)=>void;onClose:()=>void;onSaved:()=>Promise<void>}){
  const initial=(plan.meals??[]).map(meal=>({id:meal.id,kind:meal.kind,name:meal.name,items:meal.items.map(item=>({...item}))}));const [meals,setMeals]=useState<NutritionMealDraft[]>(initial.length?initial:emptyNutritionMeals());const [removedMeals,setRemovedMeals]=useState<number[]>([]);const [removedItems,setRemovedItems]=useState<number[]>([]);const [error,setError]=useState("");const [deleteConfirm,setDeleteConfirm]=useState(false);
  const save=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();if(meals.some(meal=>!meal.name.trim()||meal.items.some(item=>!item.name.trim()||item.amount_g<1))){setError("اطلاعات وعده‌ها و مواد غذایی را کامل کنید.");return}setPending(true);setError("");const form=new FormData(event.currentTarget);try{await apiFetch(`/nutrition-plans/${plan.id}/`,{method:"PATCH",body:JSON.stringify({title:form.get("title"),goal:form.get("goal"),duration_weeks:Number(form.get("duration_weeks")||4)})});for(const id of removedItems)await apiFetch(`/nutrition-meal-items/${id}/`,{method:"DELETE"});for(const id of removedMeals)await apiFetch(`/nutrition-meals/${id}/`,{method:"DELETE"});for(let index=0;index<meals.length;index++){const draft=meals[index];const meal=draft.id?await apiFetch<NutritionMeal>(`/nutrition-meals/${draft.id}/`,{method:"PATCH",body:JSON.stringify({kind:draft.kind,index:index+1,name:draft.name})}):await apiFetch<NutritionMeal>("/nutrition-meals/",{method:"POST",body:JSON.stringify({plan:plan.id,kind:draft.kind,index:index+1,name:draft.name})});for(const item of draft.items){const body=JSON.stringify({meal:meal.id,food:item.food??null,name:item.name,amount_g:item.amount_g});await apiFetch(item.id?`/nutrition-meal-items/${item.id}/`:"/nutrition-meal-items/",{method:item.id?"PATCH":"POST",body})}}await onSaved()}catch{setError("اعمال تغییرات برنامه غذایی انجام نشد.")}finally{setPending(false)}};
  const destroy=async()=>{setPending(true);try{await apiFetch(`/nutrition-plans/${plan.id}/`,{method:"DELETE"});setDeleteConfirm(false);await onSaved()}catch{setError("حذف برنامه غذایی انجام نشد.")}finally{setPending(false)}};
  return <><div className={styles.overlay} onMouseDown={()=>!pending&&onClose()}><section className={`${styles.modal} ${styles.workoutEditModal}`} onMouseDown={event=>event.stopPropagation()}><ModalHead title="ویرایش برنامه غذایی" onClose={onClose}/><form className={`${styles.form} ${styles.workoutBuilderForm}`} onSubmit={save}><div className={styles.formGrid}><Field name="title" label="نام برنامه" defaultValue={plan.title} required/><Select name="goal" label="دسته‌بندی" defaultValue={plan.goal||""} options={[["fat_loss","کاهش وزن"],["muscle_gain","افزایش حجم"],["fitness","تناسب اندام"],["maintenance","تثبیت وزن"]]}/></div><Field name="duration_weeks" label="مدت اعتبار (هفته)" type="number" min="1" defaultValue={String(plan.duration_weeks??4)}/><NutritionMealsEditor meals={meals} onChange={setMeals} onRemoveMeal={meal=>{if(meal.id)setRemovedMeals(current=>[...current,meal.id!])}} onRemoveItem={item=>{if(item.id)setRemovedItems(current=>[...current,item.id!])}}/><FormError error={error}/><div className={styles.workoutBuilderActions}><button type="button" onClick={onClose}>انصراف</button><button type="button" className={styles.dangerButton} onClick={()=>setDeleteConfirm(true)}>حذف برنامه</button><button className={styles.primaryButton} disabled={pending}>اعمال تغییرات</button></div></form></section></div>{deleteConfirm?<CoachConfirmDialog title="حذف برنامه غذایی؟" description={`برنامه «${plan.title}» و تمام وعده‌های آن حذف می‌شود.`} pending={pending} onCancel={()=>setDeleteConfirm(false)} onConfirm={()=>void destroy()}/>:null}</>;
}

function SettingsModal({ onClose, onSaved, coach }: { onClose: () => void; onSaved: () => void; coach: CoachProfile }) {
  const { error, pending, submit } = useSubmit(onSaved);
  return (
    <>
      <ModalHead title="ویرایش پروفایل" onClose={onClose} />
      <form className={styles.form} onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void submit("/coach/me/", {
          specialty: form.get("specialty"),
          bio: form.get("bio"),
          stability_excellent: Number(form.get("stability_excellent") || 0),
          stability_good: Number(form.get("stability_good") || 0),
          stability_average: Number(form.get("stability_average") || 0),
        }, "PATCH");
      }}>
        <Field name="specialty" label="تخصص" defaultValue={coach.specialty || ""} />
        <Textarea name="bio" label="بیوگرافی" defaultValue={coach.bio || ""} />
        <div className={styles.formGrid}>
          <Field name="stability_excellent" label="عالی" type="number" defaultValue={String(coach.stability_excellent ?? 0)} />
          <Field name="stability_good" label="خوب" type="number" defaultValue={String(coach.stability_good ?? 0)} />
        </div>
        <Field name="stability_average" label="متوسط" type="number" defaultValue={String(coach.stability_average ?? 0)} />
        <FormError error={error} />
        <ModalActions onClose={onClose} pending={pending} submitLabel="ذخیره" />
      </form>
    </>
  );
}

function QrModal({ coach, onClose }: { coach: CoachProfile; onClose: () => void }) {
  type CoachQr={code:string;join_url:string;qr_payload:string};
  const [qr,setQr]=useState<CoachQr|null>(null);
  const [qrImage,setQrImage]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [copied,setCopied]=useState<"url"|"code"|null>(null);
  const load=useCallback(async()=>{setLoading(true);setError("");try{const result=await apiFetch<CoachQr>("/coach/qr/");const joinUrl=connectionUrlForCurrentHost(result.code);const localized={...result,join_url:joinUrl,qr_payload:joinUrl};const image=await QRCode.toDataURL(joinUrl,{width:256,margin:2,errorCorrectionLevel:"M",color:{dark:"#171622",light:"#ffffff"}});setQr(localized);setQrImage(image)}catch{setQr(null);setQrImage("");setError("دریافت کد اتصال از وب‌سرویس انجام نشد.")}finally{setLoading(false)}},[]);
  useEffect(()=>{void load()},[load]);
  const copy=async(value:string,kind:"url"|"code")=>{try{await navigator.clipboard.writeText(value);setCopied(kind);window.setTimeout(()=>setCopied(null),1800)}catch{setError("کپی‌کردن اطلاعات اتصال انجام نشد.")}};
  return (
    <>
      <ModalHead title="کد اتصال شاگردان" onClose={onClose} />
      {loading?<div className={styles.qrLoading}><span/><i/><i/></div>:error&&!qr?<div className={styles.qrError}><Icon name="alert" size={30}/><p>{error}</p><button onClick={()=>void load()}>تلاش دوباره</button></div>:qr?<div className={styles.qrBox}>
        <div className={styles.qrImage}>{qrImage?<Image src={qrImage} width={224} height={224} unoptimized alt={`QR کد اتصال ${coach.user.full_name}`}/>:null}</div>
        <div className={styles.connectionCode}><span>کد اتصال</span><strong dir="ltr">{qr.code}</strong><button onClick={()=>void copy(qr.code,"code")}><Icon name={copied==="code"?"check":"link"}/>{copied==="code"?"کپی شد":"کپی کد"}</button></div>
        <div className={styles.joinUrl}><span>آدرس اتصال وب</span><a href={qr.join_url} target="_blank" rel="noopener noreferrer" dir="ltr">{qr.join_url}</a></div>
        {error?<p className={styles.formError}>{error}</p>:null}
        <div className={styles.qrActions}><button onClick={()=>void copy(qr.join_url,"url")}><Icon name={copied==="url"?"check":"link"}/>{copied==="url"?"آدرس کپی شد":"کپی آدرس"}</button><a className={styles.primaryButton} href={qr.join_url} target="_blank" rel="noopener noreferrer">بازکردن آدرس وب</a></div>
      </div>:null}
    </>
  );
}

function connectionUrlForCurrentHost(code:string){
  const url=new URL("/join",window.location.origin);
  url.searchParams.set("code",code);
  return url.toString();
}

function Field({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: string }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input {...props} aria-invalid={error ? true : undefined} {...(props.type === "date" ? dateInputProps() : {})} />
      {error ? <small className={styles.fieldErrorMessage} role="alert">{error}</small> : null}
    </label>
  );
}

function Textarea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; name: string }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <textarea {...props} />
    </label>
  );
}

function Select({ label, name, options, defaultValue = "", value, onChange }: { label: string; name: string; options: string[][]; defaultValue?: string;value?:string;onChange?:React.ChangeEventHandler<HTMLSelectElement> }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <select name={name} defaultValue={value===undefined?defaultValue:undefined} value={value} onChange={onChange}>
        <option value="">انتخاب کنید</option>
        {options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}
      </select>
    </label>
  );
}

function FormError({ error }: { error: string }) {
  return error ? <p className={styles.formError}>{error}</p> : null;
}

function ModalActions({ onClose, pending, submitLabel }: { onClose: () => void; pending: boolean; submitLabel: string }) {
  return (
    <div className={styles.modalActions}>
      <button type="button" onClick={onClose}>انصراف</button>
      <button className={styles.primaryButton} disabled={pending}>{pending ? "در حال ارسال..." : submitLabel}</button>
    </div>
  );
}

function CoachConfirmDialog({title,description,pending,onCancel,onConfirm}:{title:string;description:string;pending:boolean;onCancel:()=>void;onConfirm:()=>void}) {
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!pending)onCancel()};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close)},[onCancel,pending]);
  return <div className={styles.overlay} onMouseDown={()=>!pending&&onCancel()}><section className={`${styles.modal} ${styles.modalSmall} ${styles.confirmModal}`} role="alertdialog" aria-modal="true" onMouseDown={event=>event.stopPropagation()}><ModalHead title={title} onClose={onCancel}/><div className={styles.confirmBody}><span className={styles.confirmDanger}><Icon name="trash" size={26}/></span><p>{description}</p></div><div className={styles.confirmActions}><button disabled={pending} onClick={onCancel}>انصراف</button><button className={styles.dangerButton} disabled={pending} onClick={onConfirm}>{pending?"در حال انجام...":"تأیید و ادامه"}</button></div></section></div>;
}

function SearchOverlay({ onClose, data }: { onClose: () => void; data: ReturnType<typeof useCoachData> }) {
  type SearchFilter = "all" | "athlete" | "task" | "plan" | "service";
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<SearchFilter>("all");
  const [activeIndex,setActiveIndex]=useState(0);
  const items=useMemo(()=>[
    ...data.athletes.map(item=>({id:`athlete-${item.id}`,title:item.user.full_name,subtitle:item.user.phone,meta:"شاگرد",kind:"athlete" as const,href:`/students?athlete=${item.id}`,keywords:`${item.user.phone} ${item.goal??""}`,athlete:item})),
    ...data.tasks.map(item=>({id:`task-${item.id}`,title:item.title,subtitle:item.athlete_name||item.note||"",meta:"اقدام",kind:"task" as const,href:`/actions?task=${item.id}`,keywords:`${item.athlete_name??""} ${item.athlete_phone??""} ${item.note??""}`})),
    ...data.workoutPlans.map(item=>({id:`plan-${item.id}`,title:item.title,subtitle:item.athlete_name||"قالب عمومی",meta:"برنامه",kind:"plan" as const,href:`/workout-program?plan=${item.id}`,keywords:`${item.athlete_name??""} ${item.goal??""}`})),
    ...data.services.map(item=>({id:`service-${item.id}`,title:item.name,subtitle:item.category_name||"خدمت",meta:"خدمت",kind:"service" as const,href:`/services?service=${item.id}`,keywords:`${item.category_name??""} ${item.description??""}`})),
  ],[data.athletes,data.services,data.tasks,data.workoutPlans]);
  const normalized=normalizeSearch(query);
  const results=useMemo(()=>normalized?items.filter(item=>(filter==="all"||item.kind===filter)&&normalizeSearch(`${item.title} ${item.subtitle} ${item.keywords}`).includes(normalized)).slice(0,12):[],[filter,items,normalized]);
  useEffect(()=>setActiveIndex(0),[filter,query]);
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose()};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close)},[onClose]);
  const choose=(href:string)=>{onClose();window.location.href=href};
  const keyboard=(event:React.KeyboardEvent<HTMLInputElement>)=>{if(event.key==="ArrowDown"){event.preventDefault();setActiveIndex(index=>Math.min(index+1,results.length-1))}else if(event.key==="ArrowUp"){event.preventDefault();setActiveIndex(index=>Math.max(index-1,0))}else if(event.key==="Enter"&&results[activeIndex]){event.preventDefault();choose(results[activeIndex].href)}};
  const filters:Array<[SearchFilter,string,IconName]>=[["all","همه موارد","grid"],["athlete","شاگردان","students"],["task","اقدامات","calendar"],["plan","برنامه‌ها","training"],["service","خدمات","grid"]];

  return (
    <div className={styles.searchOverlay} onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="جستجوی سراسری">
      <div className={styles.searchPanel} onMouseDown={(event) => event.stopPropagation()}>
        <section className={styles.searchHeader}>
          <div className={styles.searchInput}>
            <Icon name="search" />
            <input autoFocus value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={keyboard} placeholder="جستجو کن..." aria-label="عبارت جستجو" />
            {query?<button onClick={()=>setQuery("")} aria-label="پاک کردن جستجو"><Icon name="close" /></button>:<kbd>⌘ K</kbd>}
          </div>
          <footer className={styles.searchFooter}><span><kbd>↓</kbd><kbd>↑</kbd>حرکت</span><span><kbd><Icon name="enter" size={16}/></kbd>انتخاب</span><span><kbd>Esc</kbd>خروج</span></footer>
        </section>
        <section className={styles.searchBody}>
          <nav className={styles.searchFilters} aria-label="دسته‌بندی جستجو">
            {filters.map(([key,label,icon])=><button key={key} className={filter===key?styles.searchFilterActive:""} onClick={()=>setFilter(key)}><Icon name={icon}/>{label}</button>)}
          </nav>
          <div className={styles.searchResults}>
            {results.length ? results.map((item,index)=>item.kind==="athlete"&&item.athlete?<SearchAthleteResult active={index===activeIndex} athlete={item.athlete} key={item.id} onActive={()=>setActiveIndex(index)} onChoose={choose}/>:<button className={index===activeIndex?styles.searchResultActive:""} key={item.id} onMouseEnter={()=>setActiveIndex(index)} onClick={()=>choose(item.href)}><span className={styles.searchResultIcon}><Icon name={item.kind==="task"?"calendar":item.kind==="plan"?"training":"grid"}/></span><span><b>{item.title}</b><small>{item.subtitle||item.meta}</small></span><em>{item.meta}</em></button>) : (
              <SearchEmpty hasQuery={Boolean(query)}/>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SearchAthleteResult({athlete,active,onActive,onChoose}:{athlete:RosterAthlete;active:boolean;onActive:()=>void;onChoose:(href:string)=>void}){
  const profileHref=`/students?athlete=${athlete.id}`;
  const sessionHref=`${profileHref}&session=1`;
  return <article className={`${styles.searchAthleteCard} ${active?styles.searchResultActive:""}`} onMouseEnter={onActive}>
    <button className={styles.searchAthleteIdentity} onClick={()=>onChoose(profileHref)}>
      <Avatar/>
      <span><b>{athlete.user.full_name}</b><small>آخرین تمرین: {formatLastWorkout(athlete.last_workout_on)}</small></span>
    </button>
    <footer><button onClick={()=>onChoose(sessionHref)}><Icon name="plus"/>ثبت جلسه</button><button onClick={()=>onChoose(profileHref)}>پروفایل</button></footer>
  </article>
}

function SearchEmpty({hasQuery}:{hasQuery:boolean}){
  return <div className={styles.searchEmpty}><Image src="/assets/images/search-empty-reference.png" width={170} height={130} alt=""/><b>{hasQuery?"نتیجه‌ای پیدا نشد":"جستجو کنید"}</b><span>{hasQuery?"عبارت دیگری را برای جستجو امتحان کنید":"پس از جستجو نتایج اینجا نمایش داده می شود"}</span></div>
}

function normalizeSearch(value:string){return value.trim().toLocaleLowerCase("fa-IR").replaceAll("ي","ی").replaceAll("ك","ک").replace(/[۰-۹]/g,digit=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))}

function formatLastWorkout(value?:string|null){if(!value)return"ثبت نشده";const date=new Date(`${value}T12:00:00`);if(Number.isNaN(date.getTime()))return value;const days=Math.max(0,Math.floor((Date.now()-date.getTime())/86400000));if(days===0)return"امروز";if(days<7)return`${days.toLocaleString("fa-IR")} روز پیش`;if(days<30)return`${Math.floor(days/7).toLocaleString("fa-IR")} هفته پیش`;return`${Math.floor(days/30).toLocaleString("fa-IR")} ماه پیش`}

function MobileMenu({ activePage, coach, onClose, onSearch, onNewStudent, onLogout }: { activePage: PageKey; coach: CoachProfile; onClose: () => void; onSearch: () => void; onNewStudent: () => void; onLogout: () => void }) {
  return (
    <div className={styles.mobileDrawerOverlay} onMouseDown={onClose}>
      <aside className={styles.mobileDrawer} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.drawerHead}>
          <Brand />
          <button onClick={onClose}><Icon name="close" /></button>
        </div>
        <button className={styles.newStudent} onClick={onNewStudent}><Icon name="plus" />شاگرد جدید</button>
        <button className={styles.drawerSearch} onClick={onSearch}><Icon name="search" />جستجو...</button>
        {navOrder.map((key) => (
          <Link className={activePage === key ? styles.navActive : ""} href={pageConfig[key].href} key={key}>
            <Icon name={pageConfig[key].icon} />
            {pageConfig[key].title}
          </Link>
        ))}
        <div className={styles.drawerProfile}>
          <Brand />
          <div className={styles.drawerProfileUser}><Avatar/><span><strong>{coach.user.full_name || "مربی GymPlus"}</strong><small>کد: {coach.code}</small></span></div>
          <button onClick={onLogout}><Icon name="logout"/>خروج از حساب</button>
        </div>
      </aside>
    </div>
  );
}
