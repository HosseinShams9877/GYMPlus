"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import { handleUnauthorized } from "@/lib/auth-session";
import { formatPersianDate as formatApiPersianDate, dateInputProps } from "@/lib/persian-date";

import styles from "./role-dashboard.module.css";

const RolePanelLoading = () => <div className={styles.splash} aria-busy="true"><div className={styles.loading}/></div>;
const CoachDashboard = dynamic(() => import("./coach-dashboard").then(module => module.CoachDashboard), { ssr: false, loading: RolePanelLoading });
const OwnerDashboard = dynamic(() => import("./owner-dashboard").then(module => module.OwnerDashboard), { ssr: false, loading: RolePanelLoading });
const AthleteDashboard = dynamic(() => import("./athlete-dashboard").then(module => module.AthleteDashboard), { ssr: false, loading: RolePanelLoading });

const API_BASE = "https://api.gympluspro.ir/api/v1";

type Role = "admin" | "owner" | "coach" | "athlete";
type View = string;
type Json = Record<string, unknown>;

type StoredUser = { full_name?: string; phone?: string; role?: Role };
type RoleIconName = "home"|"workout"|"nutrition"|"progress"|"award"|"money"|"settings"|"members"|"accounting"|"expense"|"alert"|"discount"|"shop"|"gym"|"menu"|"search"|"bell"|"plus"|"close"|"trash";
type NavItem = { key: string; label: string; icon: RoleIconName };
type ActionKind = "athlete-request" | "member" | "expense" | "discount" | null;

const athleteNav: NavItem[] = [
  { key: "home", label: "داشبورد", icon: "home" },
  { key: "workout", label: "تمرینات", icon: "workout" },
  { key: "nutrition", label: "تغذیه", icon: "nutrition" },
  { key: "financial", label: "مالی", icon: "money" },
  { key: "progress", label: "پیشرفت من", icon: "progress" },
  { key: "achievements", label: "دستاوردها", icon: "award" },
  { key: "shop", label: "فروشگاه", icon: "shop" },
  { key: "gym-status", label: "وضعیت باشگاه", icon: "gym" },
  { key: "settings", label: "تنظیمات", icon: "settings" },
];

const ownerNav: NavItem[] = [
  { key: "home", label: "داشبورد", icon: "home" },
  { key: "members", label: "مدیریت اعضا", icon: "members" },
  { key: "accounting", label: "حسابداری", icon: "accounting" },
  { key: "expenses", label: "مدیریت هزینه‌ها", icon: "expense" },
  { key: "reports", label: "گزارش‌های مالی", icon: "progress" },
  { key: "debtors", label: "بدهکاران", icon: "alert" },
  { key: "critical", label: "حساب‌های بحرانی", icon: "alert" },
  { key: "discounts", label: "تخفیف‌ها", icon: "discount" },
  { key: "settings", label: "تنظیمات", icon: "settings" },
];

function RoleIcon({name,size=18}:{name:RoleIconName;size?:number}) {
  const paths:Record<RoleIconName,React.ReactNode>={
    home:<><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9.5 20v-6h5v6"/></>,
    workout:<><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    nutrition:<><path d="M6 3v8a3 3 0 0 0 6 0V3M9 3v18M16 3v18M16 3c3 2 3 7 0 9"/></>,
    progress:<><path d="M4 19V5M4 19h16"/><path d="m7 15 4-5 3 3 6-7"/></>,
    award:<><circle cx="12" cy="8" r="5"/><path d="m8.5 12-1 9 4.5-3 4.5 3-1-9"/></>,
    money:<><circle cx="12" cy="12" r="9"/><path d="M9 9.5c0-1 1-1.5 3-1.5s3 .5 3 1.5-1 1.5-3 2-3 1-3 2.5 1 2 3 2 3-.5 3-2M12 6v12"/></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7L10.5 2h-3l-.7 2-1.7.7-1.9-.9-2.1 2.1.9 1.9-.7 1.7-2 .7v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2h3l.7-2 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7z" transform="scale(.8) translate(3 3)"/></>,
    members:<><circle cx="9" cy="8" r="3"/><path d="M3 19c0-4 2-6 6-6s6 2 6 6M15 6a3 3 0 0 1 0 6M16 13c3 .3 5 2.2 5 6"/></>,
    accounting:<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2"/></>,
    expense:<><path d="M4 7h16v13H4zM8 7V4h8v3"/><path d="M8 12h8"/></>,
    alert:<><path d="M12 3 3.5 20h17zM12 9v4M12 17h.01"/></>,
    discount:<><circle cx="8" cy="8" r="2"/><circle cx="16" cy="16" r="2"/><path d="m18 6-12 12"/></>,
    shop:<><path d="M4 8h16l-1 12H5z"/><path d="M8 8a4 4 0 0 1 8 0"/></>,
    gym:<><path d="M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12"/></>,
    menu:<path d="M4 7h16M4 12h16M4 17h16"/>,search:<><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></>,bell:<><path d="M18 9a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M10 20h4"/></>,plus:<path d="M12 5v14M5 12h14"/>,close:<path d="m6 6 12 12M18 6 6 18"/>,trash:<><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></>,
  };
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const athletePaths: Record<string, string> = {
  home: "/athlete/dashboard/",
  workout: "/me/workout/today/",
  nutrition: "/me/nutrition/today/",
  progress: "/me/progress/",
  achievements: "/me/achievements/",
  financial: "/me/invoices/",
  settings: "/athlete/me/",
  shop: "/store/services/",
  "gym-status": "/me/gym/live/",
};

const ownerPaths: Record<string, string> = {
  home: "/owner/dashboard/",
  members: "/owner/members/page/",
  accounting: "/owner/accounting/",
  expenses: "/expenses/page/",
  reports: "/owner/reports/finance/",
  debtors: "/owner/debtors/",
  critical: "/invoices/critical/",
  discounts: "/owner/discount-codes/",
  settings: "/owner/reminder-settings/",
};

function token() {
  return typeof window === "undefined" ? "" : localStorage.getItem("gymplus_access") ?? "";
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...init?.headers,
    },
  });
  if (handleUnauthorized(response.status)) throw new Error("UNAUTHORIZED");
  if (!response.ok) throw new Error(String(response.status));
  return response.status === 204 ? ({} as T) : ((await response.json()) as T);
}

function readUser(): StoredUser {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem("gymplus_user") ?? "{}"); } catch { return {}; }
}

function money(value: unknown) {
  return `${Number(value ?? 0).toLocaleString("fa-IR")} ت`;
}

function value(data: Json | null, key: string) {
  return data?.[key] ?? null;
}

function rows(data: unknown): Json[] {
  if (Array.isArray(data)) return data as Json[];
  if (data && typeof data === "object" && Array.isArray((data as Json).results)) return (data as Json).results as Json[];
  return [];
}

async function loadAthleteView(view: string): Promise<unknown> {
  if (view === "home") {
    const [dashboard, workout, nutrition, progress, invoices, busyChart] = await Promise.all([
      api<Json>("/athlete/dashboard/"),
      api<Json>("/me/workout/today/").catch(() => ({})),
      api<Json>("/me/nutrition/today/").catch(() => ({})),
      api<Json>("/me/progress/").catch(() => ({})),
      api<unknown>("/me/invoices/").catch(() => []),
      api<unknown>("/me/gym/busy-chart/").catch(() => []),
    ]);
    return { ...dashboard, todayWorkout: workout, todayNutrition: nutrition, progress, invoices, busyChart };
  }
  if (view === "nutrition") {
    const [today, plan, adherence] = await Promise.all([
      api<Json>("/me/nutrition/today/"),
      api<Json>("/me/nutrition/plan/").catch(() => ({})),
      api<Json>("/me/nutrition/adherence/").catch(() => ({})),
    ]);
    return { ...today, plan, adherence };
  }
  if (view === "progress") {
    const [summary, history, measurements] = await Promise.all([
      api<Json>("/me/progress/"),
      api<unknown>("/me/progress/history/").catch(() => []),
      api<unknown>("/me/measurements/chart/").catch(() => []),
    ]);
    return { ...summary, history, measurements };
  }
  if (view === "achievements") {
    const [achievements, endorsements] = await Promise.all([
      api<unknown>("/me/achievements/"),
      api<unknown>("/me/endorsements/").catch(() => []),
    ]);
    return { achievements, endorsements };
  }
  if (view === "financial") {
    const [invoices, pending, transactions] = await Promise.all([
      api<unknown>("/me/invoices/"),
      api<unknown>("/me/invoices/pending/").catch(() => []),
      api<unknown>("/me/transactions/").catch(() => []),
    ]);
    return { invoices, pending, transactions };
  }
  if (view === "shop") {
    const [services, categories, purchases, paymentOptions] = await Promise.all([
      api<unknown>("/store/services/"),
      api<unknown>("/store/categories/").catch(() => []),
      api<unknown>("/store/purchases/").catch(() => []),
      api<Json>("/store/payment-options/").catch(() => ({})),
    ]);
    return { services, categories, purchases, paymentOptions };
  }
  if (view === "gym-status") {
    const [live, busyChart, membership] = await Promise.all([
      api<Json>("/me/gym/live/"),
      api<unknown>("/me/gym/busy-chart/").catch(() => []),
      api<unknown>("/me/membership/").catch(() => []),
    ]);
    return { live, busyChart, membership };
  }
  return api(athletePaths[view]);
}

function Empty({ text = "اطلاعاتی برای نمایش وجود ندارد" }: { text?: string }) {
  return <div className={styles.empty}><span>＋</span><strong>{text}</strong><small>پس از ثبت اطلاعات، این بخش به‌روز می‌شود.</small></div>;
}

function Spinner() { return <span className={styles.spinner} aria-hidden="true"/>; }

function ConfirmDialog({title,description,pending,onCancel,onConfirm}:{title:string;description:string;pending:boolean;onCancel:()=>void;onConfirm:()=>void}) {
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!pending)onCancel()};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close)},[onCancel,pending]);
  return <div className={styles.modalBackdrop} onClick={()=>!pending&&onCancel()}><section className={`${styles.modal} ${styles.confirmModal}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={event=>event.stopPropagation()}><header><h2 id="confirm-title">{title}</h2><button disabled={pending} onClick={onCancel} aria-label="بستن"><RoleIcon name="close"/></button></header><div className={styles.confirmBody}><span className={`${styles.confirmIcon} ${styles.dangerIcon}`}><RoleIcon name="trash" size={26}/></span><p>{description}</p></div><footer className={styles.dialogActions}><button className={styles.outline} disabled={pending} onClick={onCancel}>انصراف</button><button className={styles.dangerButton} disabled={pending} onClick={onConfirm}>{pending?<><Spinner/>در حال حذف</>:"بله، حذف شود"}</button></footer></section></div>;
}

function Brand({ badge }: { badge: string }) {
  return <div className={styles.brand}><Image src="/assets/images/mingcute_fitness.png" alt="" width={30} height={30} /><b>GymPlus+</b><em>{badge}</em></div>;
}

function Shell({ role, user, nav, view, onView, onPrimary, primaryLabel, children }: { role: Role; user: StoredUser; nav: NavItem[]; view: View; onView: (view: View) => void; onPrimary: () => void; primaryLabel: string; children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(true);
  const logout = async () => {
    try { await api("/auth/logout/", { method: "POST", body: JSON.stringify({ refresh: localStorage.getItem("gymplus_refresh") }) }); } catch {}
    localStorage.removeItem("gymplus_access"); localStorage.removeItem("gymplus_refresh"); localStorage.removeItem("gymplus_user"); location.href = "/login";
  };
  const badge = role === "athlete" ? "پنل ورزشکار" : "پنل باشگاه";
  return <main className={styles.app} dir="rtl">
    <aside className={styles.sidebar}>
      <div className={styles.sideHead}><Brand badge={badge} /></div>
      <button className={styles.primary} onClick={onPrimary}><RoleIcon name="plus"/> {primaryLabel}</button>
      <nav>{nav.map((item) => <button key={item.key} className={view === item.key ? styles.active : ""} onClick={() => onView(item.key)}><i><RoleIcon name={item.icon}/></i><span>{item.label}</span></button>)}</nav>
      <div className={styles.profile}><Brand badge={badge} /><p><span className={styles.avatar}>{(user.full_name || "ک").slice(0, 1)}</span><b>{user.full_name || "کاربر GymPlus"}</b></p><button onClick={logout}>خروج از حساب</button></div>
    </aside>
    <section className={styles.workspace}>
      <header className={styles.topbar}><button className={styles.mobileMenu} onClick={() => setDrawerOpen(true)} aria-label="باز کردن منو"><RoleIcon name="menu" size={20}/></button><h1>{nav.find((item) => item.key === view)?.label}</h1><div><button onClick={() => onView(role === "athlete" ? "progress" : "members")}><RoleIcon name="search" size={16}/> <span>جستجو...</span></button><button onClick={() => onView("settings")} aria-label="اعلان‌ها"><RoleIcon name="bell" size={18}/></button><span className={styles.avatar}>{(user.full_name || "ک").slice(0, 1)}</span></div></header>
      {noticeOpen ? <div className={styles.notice}><button onClick={() => setNoticeOpen(false)} aria-label="بستن"><RoleIcon name="close" size={18}/></button><span className={styles.sun}><RoleIcon name="alert" size={18}/></span><p>برای استفاده بهتر از امکانات GymPlus، اطلاعات حساب خود را کامل کنید.</p><button onClick={() => onView("settings")}>مشاهده جزئیات</button></div> : null}
      <div className={styles.content}>{children}</div>
    </section>
    <nav className={styles.bottomNav}>{nav.slice(0, 2).map((item) => <button key={item.key} className={view === item.key ? styles.bottomActive : ""} onClick={() => onView(item.key)}><i><RoleIcon name={item.icon} size={24}/></i><span>{item.label}</span></button>)}<button className={styles.addMobile} onClick={onPrimary}><RoleIcon name="plus" size={34}/></button>{nav.slice(2,4).map((item) => <button key={item.key} className={view === item.key ? styles.bottomActive : ""} onClick={() => onView(item.key)}><i><RoleIcon name={item.icon} size={24}/></i><span>{item.label}</span></button>)}</nav>
    {drawerOpen ? <div className={styles.drawerBackdrop} onClick={() => setDrawerOpen(false)}><aside className={styles.drawer} onClick={(event) => event.stopPropagation()}><div className={styles.drawerHead}><Brand badge={badge}/><button onClick={() => setDrawerOpen(false)} aria-label="بستن منو"><RoleIcon name="close" size={20}/></button></div><button className={styles.primary} onClick={() => { setDrawerOpen(false); onPrimary(); }}><RoleIcon name="plus"/> {primaryLabel}</button><nav>{nav.map((item) => <button key={item.key} className={view === item.key ? styles.active : ""} onClick={() => { onView(item.key); setDrawerOpen(false); }}><i><RoleIcon name={item.icon}/></i><span>{item.label}</span></button>)}</nav><button className={styles.drawerLogout} onClick={logout}>خروج از حساب</button></aside></div> : null}
  </main>;
}

function Stat({ title, amount, hint, tone }: { title: string; amount: React.ReactNode; hint?: string; tone?: string }) {
  return <article className={`${styles.stat} ${tone ? styles[tone] : ""}`}><header><span>{title}</span><button>•••</button></header><strong>{amount}</strong>{hint && <small>{hint}</small>}</article>;
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className={styles.panel}><header><h2>{title}</h2>{action}</header>{children}</section>;
}

function Bars({ values }: { values: number[] }) {
  if (!values.length) return <Empty text="داده‌ای برای نمودار دریافت نشده است" />;
  const maximum = Math.max(...values, 1);
  return <div className={styles.bars}>{values.map((amount, index) => <i key={index} style={{ height: `${Math.max(8, amount / maximum * 100)}%` }} />)}</div>;
}

function series(source: unknown, keys: string[]) {
  return rows(source).map((item) => Number(keys.map((key) => item[key]).find((entry) => typeof entry === "number") ?? 0));
}

function LineChart({ values }: { values: number[] }) {
  if (!values.length) return <Empty text="داده‌ای برای نمودار دریافت نشده است" />;
  const maximum = Math.max(...values, 1);
  const points = values.map((amount, index) => `${values.length === 1 ? 300 : index * 600 / (values.length - 1)},${160 - amount / maximum * 130}`).join(" ");
  return <div className={styles.lineChart}><svg viewBox="0 0 600 180" preserveAspectRatio="none"><polyline points={points} fill="none" stroke="#35a985" strokeWidth="3"/></svg></div>;
}

// Legacy implementation retained for older dashboard snapshots.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AthletePanel({ user }: { user: StoredUser }) {
  const [view, setView] = useState("home");
  const [data, setData] = useState<Json | null>(null);
  const [secondary, setSecondary] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<ActionKind>(null);
  const load = useCallback(async () => { setLoading(true); setError(""); try { const result = await loadAthleteView(view); setData((result && typeof result === "object" && !Array.isArray(result) ? result : null) as Json | null); setSecondary(result); } catch { setData(null); setSecondary(null); setError("دریافت اطلاعات از وب‌سرویس انجام نشد."); } finally { setLoading(false); } }, [view]);
  useEffect(() => { void load(); }, [load]);
  return <Shell role="athlete" user={user} nav={athleteNav} view={view} onView={setView} onPrimary={() => setAction("athlete-request")} primaryLabel="درخواست از مربی">{loading ? <div className={styles.loading}/> : error ? <div className={styles.error}>{error}<button onClick={load}>تلاش دوباره</button></div> : <AthleteView view={view} data={data} raw={secondary} onSaved={load} />}{action ? <ActionModal kind={action} onClose={() => setAction(null)} onSaved={() => { setAction(null); void load(); }} /> : null}</Shell>;
}

function AthleteView({ view, data, raw, onSaved }: { view: string; data: Json | null; raw: unknown; onSaved: () => Promise<void> }) {
  if (view === "home") {
    const workout=(value(data,"todayWorkout")??{}) as Json; const workoutDays=rows(workout.days); const exercises=workoutDays.flatMap(day=>rows(day.exercises));
    const nutrition=(value(data,"todayNutrition")??{}) as Json; const meals=rows(nutrition.meals); const progress=(value(data,"progress")??{}) as Json; const invoices=rows(value(data,"invoices")); const busy=rows(value(data,"busyChart"));
    return <>
      <div className={styles.dashboardWelcome}><span className={styles.welcomeMark}><RoleIcon name="workout"/></span><b>سلام، امروز قوی‌تر از دیروزی!</b></div>
      <div className={styles.twoCols}><Panel title="برنامه امروز"><div className={styles.todayPlan}><div><h2>{String(workout.title??"برای امروز برنامه‌ای ثبت نشده")}</h2><p>{String(workout.goal??"برنامه فعال خود را از بخش تمرینات ببینید.")}</p><strong>{exercises.length.toLocaleString("fa-IR")} حرکت</strong></div><button className={styles.primary}>شروع تمرین</button></div></Panel><Panel title="وضعیت باشگاه"><div className={styles.gymSnapshot}><strong>{busy.length?`${Number(busy.at(-1)?.count??busy.at(-1)?.value??0).toLocaleString("fa-IR")} نفر در باشگاه`:"اطلاعات لحظه‌ای موجود نیست"}</strong><Bars values={series(busy,["count","value","occupancy"])}/></div></Panel></div>
      <Panel title="مروری بر آمار"><div className={styles.homeStats}><Stat title="شاخص پیشرفت کلی" amount={value(data,"progress_pct")!=null?`${value(data,"progress_pct")}٪`:"-"} hint="نسبت به ماه پیش" tone="green"/><Stat title="وزن فعلی" amount={progress.current_weight!=null?`${progress.current_weight} کیلوگرم`:"-"}/><Stat title="پایبندی تمرین" amount={value(data,"adherence_pct")!=null?`${value(data,"adherence_pct")}٪`:"-"} hint={`${value(data,"workouts_this_month")??0} جلسه این ماه`}/><Stat title="پایبندی تغذیه" amount={String((nutrition.adherence_pct??"-")+"٪")}/></div></Panel>
      <Panel title="تمرین امروز" action={<button className={styles.outline}>مشاهده کامل</button>}>{exercises.length?<ExerciseList items={exercises}/>:<Empty text="برای امروز تمرینی ثبت نشده است"/>}</Panel>
      <div className={styles.twoCols}><Panel title="تغذیه امروز" action={<button className={styles.outline}>مشاهده کامل</button>}>{meals.length?<DataTable items={meals}/>:<Empty text="وعده‌ای برای امروز ثبت نشده است"/>}</Panel><Panel title="رکوردهای شخصی" action={<button className={styles.outline}>مشاهده کامل</button>}>{rows(progress.personal_records).length?<DataTable items={rows(progress.personal_records)}/>:<Empty text="هنوز رکوردی ثبت نشده است"/>}</Panel></div>
      <Panel title="نمودار تغییرات وزن"><LineChart values={series(progress.weight_series,["weight","value"])}/></Panel>
      <Panel title="وضعیت مالی">{invoices.length?<DataTable items={invoices}/>:<Empty text="فاکتوری برای نمایش وجود ندارد"/>}</Panel>
    </>;
  }
  if (view === "workout") {
    const days = rows(value(data, "days"));
    const exercises = days.flatMap((day) => rows(day.exercises));
    return <>
      <div className={styles.pageTitle}><div><h2>{String(value(data,"title") ?? "برنامه تمرینی")}</h2><p>{String(value(data,"goal") ?? "برنامه امروز شما")}</p></div></div>
      <div className={styles.statGrid}><Stat title="تعداد روزهای تمرین" amount={String(value(data,"days_count") ?? days.length)} /><Stat title="مدت برنامه" amount={`${String(value(data,"duration_weeks") ?? 0)} هفته`} /><Stat title="تعداد حرکت‌ها" amount={String(exercises.length)} tone="green" /></div>
      <Panel title="تمرین امروز" action={<button className={styles.outline}>مشاهده برنامه کامل</button>}>{exercises.length ? <ExerciseList items={exercises}/> : <Empty text="برای امروز تمرینی ثبت نشده است"/>}</Panel>
    </>;
  }
  if (view === "nutrition") {
    const target=(value(data,"target") ?? {}) as Json; const consumed=(value(data,"consumed") ?? {}) as Json; const meals=rows(value(data,"meals"));
    return <>
      <div className={styles.statGrid}><Stat title="کالری مصرف‌شده" amount={`${Number(consumed.calories ?? 0).toLocaleString("fa-IR")} کالری`} hint={`هدف: ${Number(target.calories ?? 0).toLocaleString("fa-IR")}`} tone="green"/><Stat title="آب مصرف‌شده" amount={`${Number(value(data,"water_ml") ?? 0).toLocaleString("fa-IR")} میلی‌لیتر`} /><Stat title="وعده‌های امروز" amount={String(meals.length)} /></div>
      <Panel title="درشت‌مغذی‌های امروز"><div className={styles.macroGrid}>{[["پروتئین","protein"],["کربوهیدرات","carbs"],["چربی","fat"]].map(([label,key])=><article key={key}><span>{label}</span><strong>{Number(consumed[key] ?? 0).toLocaleString("fa-IR")} گرم</strong><i><b style={{width:`${Math.min(100,Number(consumed[key]??0)/Math.max(1,Number(target[key]??1))*100)}%`}}/></i></article>)}</div></Panel>
      <Panel title="وعده‌های غذایی امروز">{meals.length?<DataTable items={meals}/>:<Empty text="هنوز وعده‌ای برای امروز ثبت نشده است"/>}</Panel>
    </>;
  }
  if (view === "progress") return <><div className={styles.statGrid}><Stat title="وزن فعلی" amount={`${value(data,"current_weight") ?? "-"} کیلوگرم`} /><Stat title="شاخص توده بدنی" amount={String(value(data,"bmi") ?? "-")} tone="green"/><Stat title="تعداد تمرین" amount={String(value(data,"workout_count") ?? 0)} /></div><Panel title="روند تغییرات وزن"><LineChart values={series(value(data,"weight_series"),["weight","value"])}/></Panel><Panel title="رکوردهای شخصی">{rows(value(data,"personal_records")).length ? <DataTable items={rows(value(data,"personal_records"))}/> : <Empty text="هنوز رکوردی ثبت نشده است"/>}</Panel></>;
  if (view === "achievements") { const achievements=rows(value(data,"achievements")); return <Panel title="دستاوردهای من">{achievements.length ? <div className={styles.badges}>{achievements.map((item,index)=><article key={String(item.id ?? index)}><span><RoleIcon name="award" size={32}/></span><b>{String(item.title ?? item.name ?? "دستاورد")}</b><small>{String(item.description ?? "")}</small>{item.progress_pct != null?<i className={styles.badgeProgress}><b style={{width:`${Number(item.progress_pct)}%`}}/></i>:null}</article>)}</div> : <Empty text="هنوز دستاوردی دریافت نکرده‌اید"/>}</Panel>; }
  if (view === "financial") { const invoices=rows(value(data,"invoices")); const pending=rows(value(data,"pending")); return <><div className={styles.statGrid}><Stat title="فاکتورهای در انتظار" amount={String(pending.length)} tone="orange"/><Stat title="مجموع بدهی" amount={money(pending.reduce((sum,item)=>sum+Number(item.amount??item.balance??0),0))}/><Stat title="تعداد تراکنش‌ها" amount={String(rows(value(data,"transactions")).length)} tone="green"/></div><Panel title="وضعیت مالی">{invoices.length?<DataTable items={invoices}/>:<Empty text="هنوز فاکتوری ثبت نشده است"/>}</Panel></>; }
  if (view === "shop") return <ShopView data={data} onSaved={onSaved}/>;
  if (view === "gym-status") { const live=(value(data,"live")??{}) as Json; const chart=rows(value(data,"busyChart")); return <><div className={styles.statGrid}><Stat title="افراد حاضر در باشگاه" amount={String(live.current_count ?? live.count ?? 0)} hint={String(live.status_label ?? "وضعیت لحظه‌ای")} tone="green"/><Stat title="ظرفیت باشگاه" amount={String(live.capacity ?? "-")} /><Stat title="بهترین زمان مراجعه" amount={String(live.recommended_time ?? "-")} /></div><Panel title="میزان شلوغی باشگاه"><Bars values={series(chart,["count","value","occupancy"])}/></Panel></>; }
  if (view === "settings") return <AthleteSettings data={data} onSaved={onSaved}/>;
  const list = rows(raw);
  return <Panel title={athleteNav.find(x=>x.key===view)?.label ?? "اطلاعات"} action={<button className={styles.outline}>فیلتر</button>}>{list.length ? <DataTable items={list}/> : data && Object.keys(data).length ? <ObjectCards data={data}/> : <Empty/>}</Panel>;
}

function ExerciseList({items}:{items:Json[]}) { return <div className={styles.exerciseList}>{items.map((item,index)=><article key={String(item.id??index)}><label><input type="checkbox"/><i/></label><div><b>{String(item.exercise_name??item.name??item.title??"حرکت تمرینی")}</b><small>{String(item.notes??"")}</small></div><span>{String(item.sets??"-")} ست</span><span>{String(item.reps??item.repetitions??"-")} تکرار</span>{item.video_url?<a href={String(item.video_url)} target="_blank" rel="noreferrer">فیلم آموزشی</a>:null}</article>)}</div> }

function ShopView({data,onSaved}:{data:Json|null;onSaved:()=>Promise<void>}) {
  const services=rows(value(data,"services")); const categories=rows(value(data,"categories"));
  const [category,setCategory]=useState<number|null>(null); const [buying,setBuying]=useState<Json|null>(null); const [pending,setPending]=useState(false); const [error,setError]=useState("");
  const visible=category==null?services:services.filter(item=>Number(item.category)===category);
  const buy=async(paymentType:string)=>{if(!buying)return;setPending(true);setError("");try{await api(`/store/services/${buying.id}/buy/`,{method:"POST",body:JSON.stringify({payment_type:paymentType})});setBuying(null);await onSaved();}catch{setError("خرید سرویس انجام نشد. روش پرداخت را بررسی کنید.");}finally{setPending(false)}};
  return <><Panel title="فروشگاه" action={<div className={styles.chips}><button className={category==null?styles.chipActive:""} onClick={()=>setCategory(null)}>همه</button>{categories.map(item=><button key={String(item.id)} className={category===Number(item.id)?styles.chipActive:""} onClick={()=>setCategory(Number(item.id))}>{String(item.name)}</button>)}</div>}>{visible.length?<div className={styles.shopGrid}>{visible.map(item=><article key={String(item.id)}><span className={styles.serviceGlyph}><RoleIcon name="shop" size={24}/></span><div><small>{String(item.category_name??"")}</small><h3>{String(item.name??"سرویس")}</h3><p>{String(item.description??"")}</p></div><strong>{money(item.price)}</strong><button className={styles.primary} onClick={()=>setBuying(item)}>خرید سرویس</button></article>)}</div>:<Empty text="مربی شما هنوز خدمتی تعریف نکرده است"/>}</Panel>{buying?<div className={styles.modalBackdrop} onClick={()=>!pending&&setBuying(null)}><section className={`${styles.modal} ${styles.confirmModal}`} onClick={event=>event.stopPropagation()}><header><h2>خرید {String(buying.name)}</h2><button disabled={pending} onClick={()=>setBuying(null)} aria-label="بستن"><RoleIcon name="close"/></button></header><div className={styles.confirmBody}><span className={styles.confirmIcon}><RoleIcon name="money" size={26}/></span><p>روش پرداخت این سرویس را انتخاب کنید.</p>{error?<p className={styles.modalError}>{error}</p>:null}</div><footer className={styles.dialogActions}><button className={styles.outline} disabled={pending} onClick={()=>void buy("cash")}>پرداخت نقدی</button><button className={styles.primary} disabled={pending} onClick={()=>void buy("debt")}>{pending?<><Spinner/>در حال ثبت</>:"ثبت به‌صورت بدهی"}</button></footer></section></div>:null}</>;
}

// Kept temporarily for routes that still import the legacy all-role dashboard bundle.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function OwnerPanel({ user }: { user: StoredUser }) {
  const [view, setView] = useState("home"); const [data,setData]=useState<unknown>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  const [action,setAction]=useState<ActionKind>(null);
  const load=useCallback(async()=>{setLoading(true);setError("");try{setData(await api(ownerPaths[view]));}catch{setData(null);setError("دریافت اطلاعات از وب‌سرویس انجام نشد.");}finally{setLoading(false)}},[view]); useEffect(()=>{void load()},[load]);
  const primaryAction = () => setAction(view === "expenses" ? "expense" : view === "discounts" ? "discount" : "member");
  return <Shell role="owner" user={user} nav={ownerNav} view={view} onView={setView} onPrimary={primaryAction} primaryLabel={view === "expenses" ? "ثبت هزینه" : view === "discounts" ? "کد تخفیف" : "عضو جدید"}>{loading?<div className={styles.loading}/>:error?<div className={styles.error}>{error}<button onClick={load}>تلاش دوباره</button></div>:<OwnerView view={view} raw={data} onAction={primaryAction} onSaved={load}/>} {action ? <ActionModal kind={action} onClose={() => setAction(null)} onSaved={() => { setAction(null); void load(); }}/> : null}</Shell>;
}

function OwnerView({view,raw,onAction,onSaved}:{view:string;raw:unknown;onAction:()=>void;onSaved:()=>Promise<void>}) { const data=(raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{}) as Json; const financials=(data.financials ?? data.cards ?? {}) as Json;
  if(view==="home") return <><div className={styles.pageTitle}><div><h2>نمای کلی باشگاه</h2><p>وضعیت مالی و اعضا در یک نگاه</p></div><button className={styles.primary} onClick={onAction}>ثبت عضو جدید ＋</button></div><div className={styles.ownerStats}><Stat title="درآمد این ماه" amount={money(financials.income ?? financials.total_income)} tone="green"/><Stat title="دریافت‌شده" amount={money(financials.received ?? financials.collected)} /><Stat title="مطالبات" amount={money(financials.receivable ?? financials.outstanding)} tone="orange"/><Stat title="هزینه‌ها" amount={money(financials.expenses)} /><Stat title="سود خالص" amount={money(financials.net_profit)} tone="green"/></div><div className={styles.twoCols}><Panel title="درآمد و هزینه"><Empty text="نمودار در پاسخ داشبورد موجود نیست" /></Panel><Panel title="وضعیت اعضا"><div className={styles.memberSummary}><strong>{String(((data.members ?? {}) as Json).total ?? 0)}</strong><span>کل اعضا</span><p><b>{String(((data.members ?? {}) as Json).active ?? 0)}</b> عضو فعال</p><p><b>{String(((data.members ?? {}) as Json).new_this_month ?? 0)}</b> عضو جدید این ماه</p></div></Panel></div></>;
  if(view==="accounting") return <><div className={styles.ownerStats}>{["income","received","outstanding","expenses","net_profit"].map((key)=><Stat key={key} title={({income:"درآمد",received:"دریافتی",outstanding:"مطالبات",expenses:"هزینه",net_profit:"سود خالص"} as Record<string,string>)[key]} amount={money(financials[key])}/>)}</div><Panel title="نمودار مالی"><div className={styles.chartCombo}><Bars values={series(data.chart,["income","received"])}/><LineChart values={series(data.chart,["expenses","outstanding"])}/></div></Panel><Panel title="وضعیت پرداخت اعضا">{rows(data.overdue_members).length?<DataTable items={rows(data.overdue_members)}/>:<Empty/>}</Panel></>;
  if(view==="reports") return <><div className={styles.statGrid}><Stat title="کل درآمد" amount={money(data.income)} tone="green"/><Stat title="کل هزینه" amount={money(data.expenses)} tone="orange"/><Stat title="سود خالص" amount={money(data.net_profit)} /></div><Panel title="گزارش سود و زیان"><Empty text="این گزارش فقط مقادیر تجمیعی برمی‌گرداند" /></Panel></>;
  if(view==="settings") return <OwnerSettings data={data} onSaved={onSaved}/>;
  const list=rows(data.results ?? raw); return <Panel title={ownerNav.find(x=>x.key===view)?.label ?? "اطلاعات"} action={<div className={styles.actions}><button className={styles.outline}>فیلتر</button><button className={styles.primary} onClick={onAction}>ثبت جدید ＋</button></div>}>{list.length?<OwnerRecords items={list} view={view} onSaved={onSaved}/>:data&&Object.keys(data).length?<ObjectCards data={data}/>:<Empty/>}</Panel>;
}

function OwnerRecords({items,view,onSaved}:{items:Json[];view:string;onSaved:()=>Promise<void>}) {
  const [target,setTarget]=useState<Json|null>(null); const [pending,setPending]=useState(false);
  const canDelete=view==="expenses"||view==="discounts";
  const remove=async()=>{if(!target)return;setPending(true);try{await api(view==="expenses"?`/expenses/${target.id}/`:`/owner/discount-codes/${target.id}/`,{method:"DELETE"});setTarget(null);await onSaved();}finally{setPending(false)}};
  return <>{canDelete?<div className={styles.recordList}>{items.map((item,index)=><article key={String(item.id??index)}><div><b>{String(item.title??item.code??item.name??"رکورد")}</b><small>{String(item.category_name??item.kind??(item.spent_on?formatApiPersianDate(item.spent_on):""))}</small></div><strong>{item.amount!=null?money(item.amount):item.value!=null?String(item.value):""}</strong><button className={styles.iconButton} onClick={()=>setTarget(item)} aria-label="حذف"><RoleIcon name="trash"/></button></article>)}</div>:<DataTable items={items}/>} {target?<ConfirmDialog title="حذف این مورد؟" description="این عملیات قابل بازگشت نیست. آیا از حذف این مورد مطمئن هستید؟" pending={pending} onCancel={()=>setTarget(null)} onConfirm={()=>void remove()}/>:null}</>;
}

function AthleteSettings({ data, onSaved }: { data: Json | null; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    birth_date: String(value(data,"birth_date") ?? ""),
    gender: String(value(data,"gender") ?? ""),
    height: String(value(data,"height") ?? ""),
    weight: String(value(data,"weight") ?? ""),
    target_weight: String(value(data,"target_weight") ?? ""),
  });
  const [message,setMessage]=useState(""); const [pending,setPending]=useState(false);
  const submit=async(event:React.FormEvent)=>{event.preventDefault();setPending(true);setMessage("");try{await api("/athlete/me/",{method:"PATCH",body:JSON.stringify({...form,height:form.height?Number(form.height):null,weight:form.weight?Number(form.weight):null,target_weight:form.target_weight?Number(form.target_weight):null})});setMessage("تغییرات با موفقیت ذخیره شد.");await onSaved();}catch{setMessage("ذخیره تغییرات انجام نشد.");}finally{setPending(false)}};
  return <Panel title="اطلاعات حساب"><form className={styles.formGrid} onSubmit={submit}><label><span>تاریخ تولد</span><input type="date" {...dateInputProps()} value={form.birth_date} onChange={e=>setForm({...form,birth_date:e.target.value})}/></label><label><span>جنسیت</span><select value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}><option value="">انتخاب کنید</option><option value="male">مرد</option><option value="female">زن</option></select></label><label><span>قد (سانتی‌متر)</span><input type="number" value={form.height} onChange={e=>setForm({...form,height:e.target.value})}/></label><label><span>وزن (کیلوگرم)</span><input type="number" value={form.weight} onChange={e=>setForm({...form,weight:e.target.value})}/></label><label><span>وزن هدف</span><input type="number" value={form.target_weight} onChange={e=>setForm({...form,target_weight:e.target.value})}/></label><div className={styles.formFooter}>{message?<span>{message}</span>:null}<button className={styles.primary} disabled={pending}>{pending?"در حال ذخیره...":"ذخیره تغییرات"}</button></div></form></Panel>;
}

function OwnerSettings({ data, onSaved }: { data: Json; onSaved: () => Promise<void> }) {
  const setting=(data.setting ?? data) as Json;
  const [form,setForm]=useState({payment_reminders:Boolean(setting.payment_reminders),workout_reminders:Boolean(setting.workout_reminders),remind_before:Boolean(setting.remind_before),days_before_due:Number(setting.days_before_due??0),remind_on_due:Boolean(setting.remind_on_due),remind_after:Boolean(setting.remind_after),days_after_due:Number(setting.days_after_due??0),follow_up_days:Number(setting.follow_up_days??0)});
  const [message,setMessage]=useState(""); const [pending,setPending]=useState(false);
  const submit=async(event:React.FormEvent)=>{event.preventDefault();setPending(true);setMessage("");try{await api("/owner/reminder-settings/",{method:"PUT",body:JSON.stringify(form)});setMessage("تنظیمات یادآوری ذخیره شد.");await onSaved();}catch{setMessage("ذخیره تنظیمات انجام نشد.");}finally{setPending(false)}};
  return <Panel title="تنظیمات یادآوری"><form className={styles.settingForm} onSubmit={submit}><Toggle label="یادآوری پرداخت" checked={form.payment_reminders} onChange={checked=>setForm({...form,payment_reminders:checked})}/><Toggle label="یادآوری تمرین" checked={form.workout_reminders} onChange={checked=>setForm({...form,workout_reminders:checked})}/><Toggle label="یادآوری قبل از سررسید" checked={form.remind_before} onChange={checked=>setForm({...form,remind_before:checked})}/><label><span>تعداد روز قبل از سررسید</span><input type="number" min="0" value={form.days_before_due} onChange={e=>setForm({...form,days_before_due:Number(e.target.value)})}/></label><Toggle label="یادآوری روز سررسید" checked={form.remind_on_due} onChange={checked=>setForm({...form,remind_on_due:checked})}/><Toggle label="یادآوری بعد از سررسید" checked={form.remind_after} onChange={checked=>setForm({...form,remind_after:checked})}/><label><span>تعداد روز بعد از سررسید</span><input type="number" min="0" value={form.days_after_due} onChange={e=>setForm({...form,days_after_due:Number(e.target.value)})}/></label><label><span>دوره پیگیری ورزشکار غیرفعال</span><input type="number" min="0" value={form.follow_up_days} onChange={e=>setForm({...form,follow_up_days:Number(e.target.value)})}/></label><div className={styles.formFooter}>{message?<span>{message}</span>:null}<button className={styles.primary} disabled={pending}>{pending?"در حال ذخیره...":"ذخیره تنظیمات"}</button></div></form></Panel>;
}

function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(checked:boolean)=>void}) { return <label className={styles.toggleRow}><span>{label}</span><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)}/><i/></label> }

function ActionModal({ kind, onClose, onSaved }: { kind: Exclude<ActionKind,null>; onClose: () => void; onSaved: () => void }) {
  const [pending,setPending]=useState(false); const [error,setError]=useState(""); const [gyms,setGyms]=useState<Json[]>([]);
  useEffect(()=>{if(kind==="member"||kind==="expense"){api<unknown>("/gyms/").then(result=>setGyms(rows(result))).catch(()=>setGyms([]))}},[kind]);
  const title={"athlete-request":"درخواست از مربی",member:"ثبت عضو جدید",expense:"ثبت هزینه",discount:"ساخت کد تخفیف"}[kind];
  const submit=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();setPending(true);setError("");const values=Object.fromEntries(new FormData(event.currentTarget).entries());try{if(kind==="athlete-request")await api("/athlete/requests/",{method:"POST",body:JSON.stringify(values)});if(kind==="member")await api("/owner/members/",{method:"POST",body:JSON.stringify({...values,gym:Number(values.gym),monthly_fee:Number(values.monthly_fee||0),is_active:true})});if(kind==="expense")await api("/expenses/",{method:"POST",body:JSON.stringify({...values,gym:Number(values.gym),amount:Number(values.amount)})});if(kind==="discount")await api("/owner/discount-codes/",{method:"POST",body:JSON.stringify({...values,value:Number(values.value),max_uses:values.max_uses?Number(values.max_uses):null,per_member_limit:values.per_member_limit?Number(values.per_member_limit):null})});onSaved();}catch{setError("ثبت اطلاعات انجام نشد. فیلدهای الزامی را بررسی کنید.");}finally{setPending(false)}};
  return <div className={styles.modalBackdrop} onClick={onClose}><section className={styles.modal} onClick={event=>event.stopPropagation()}><header><h2>{title}</h2><button onClick={onClose} aria-label="بستن">×</button></header><form onSubmit={submit}>{kind==="athlete-request"?<><label><span>نوع درخواست</span><select name="kind" required><option value="training_plan">برنامه تمرینی</option><option value="nutrition_plan">برنامه غذایی</option><option value="private_session">جلسه خصوصی</option><option value="supplement">مکمل</option></select></label><label><span>توضیحات</span><textarea name="note" placeholder="درخواست خود را بنویسید..."/></label></>:null}{kind==="member"?<><label><span>باشگاه</span><GymSelect gyms={gyms}/></label><label><span>نام و نام خانوادگی</span><input name="full_name" required/></label><label><span>شماره موبایل</span><input name="phone" inputMode="tel" required/></label><div className={styles.modalGrid}><label><span>دوره عضویت</span><select name="term"><option value="monthly">ماهانه</option><option value="quarterly">سه ماهه</option><option value="yearly">سالانه</option></select></label><label><span>شهریه ماهانه</span><input name="monthly_fee" type="number" min="0"/></label></div><label><span>تاریخ شروع</span><input name="start_date" type="date" {...dateInputProps()}/></label></>:null}{kind==="expense"?<><label><span>باشگاه</span><GymSelect gyms={gyms}/></label><label><span>عنوان هزینه</span><input name="title" required/></label><label><span>مبلغ (تومان)</span><input name="amount" type="number" min="0" required/></label><label><span>تاریخ پرداخت</span><input name="spent_on" type="date" {...dateInputProps()} required/></label></>:null}{kind==="discount"?<><label><span>کد تخفیف</span><input name="code" required/></label><div className={styles.modalGrid}><label><span>نوع</span><select name="kind"><option value="percent">درصدی</option><option value="fixed">مبلغ ثابت</option></select></label><label><span>مقدار</span><input name="value" type="number" min="0" required/></label></div><label><span>محدوده اعمال</span><select name="scope"><option value="all">همه خدمات</option><option value="service">سرویس خاص</option><option value="category">دسته‌بندی</option></select></label><div className={styles.modalGrid}><label><span>حداکثر استفاده</span><input name="max_uses" type="number" min="0"/></label><label><span>سقف هر عضو</span><input name="per_member_limit" type="number" min="0"/></label></div><label><span>تاریخ انقضا</span><input name="expires_at" type="date" {...dateInputProps()}/></label></>:null}{error?<p className={styles.modalError}>{error}</p>:null}<footer><button type="button" className={styles.outline} onClick={onClose}>انصراف</button><button className={styles.primary} disabled={pending}>{pending?"در حال ثبت...":"ثبت اطلاعات"}</button></footer></form></section></div>;
}

function GymSelect({gyms}:{gyms:Json[]}) { return <select name="gym" required><option value="">انتخاب باشگاه</option>{gyms.map(gym=><option key={String(gym.id)} value={String(gym.id)}>{String(gym.name??gym.title??"باشگاه")}</option>)}</select> }

function DataTable({items}:{items:Json[]}) { const keys=useMemo(()=>Object.keys(items[0]??{}).filter(k=>!["id","image","avatar"].includes(k)).slice(0,6),[items]); const dateKey=(key:string)=>/(^|_)(date|at|on|from|to|expires|start|end|birth|spent|paid|due|created|updated)($|_)/i.test(key); return <div className={styles.table}><div className={styles.tableHead}>{keys.map(k=><span key={k}>{k.replaceAll("_"," ")}</span>)}</div>{items.map((item,index)=><div className={styles.tableRow} key={String(item.id??index)}>{keys.map(k=><span key={k}>{typeof item[k]==="object"?"-":dateKey(k)?formatApiPersianDate(item[k]):String(item[k]??"-")}</span>)}</div>)}</div> }
function ObjectCards({data}:{data:Json}) { return <div className={styles.objectGrid}>{Object.entries(data).filter(([,v])=>typeof v!=="object").map(([k,v])=><article key={k}><span>{k.replaceAll("_"," ")}</span><b>{String(v??"-")}</b></article>)}</div> }

export function RoleDashboard() {
  const [user,setUser]=useState<StoredUser|null>(null); const [resolvedRole,setResolvedRole]=useState<Role|null>(null);
  useEffect(()=>{const stored=readUser(); setUser(stored); if(stored.role){setResolvedRole(stored.role);return} if(!token()){setResolvedRole("coach");return} api<StoredUser>("/auth/me/").then(current=>{localStorage.setItem("gymplus_user",JSON.stringify(current));setUser(current);setResolvedRole(current.role??"coach")}).catch(()=>setResolvedRole("coach"))},[]);
  if(!resolvedRole||!user) return <div className={styles.splash}><Brand badge="در حال بارگذاری"/><div className={styles.loading}/></div>;
  if(resolvedRole==="athlete") return <AthleteDashboard user={user}/>;
  if(resolvedRole==="owner"||resolvedRole==="admin") return <OwnerDashboard user={user}/>;
  return <CoachDashboard/>;
}
