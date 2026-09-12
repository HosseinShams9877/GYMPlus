"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { handleUnauthorized } from "@/lib/auth-session";
import { formatPersianDate as formatApiPersianDate, dateInputProps, todayApiDate } from "@/lib/persian-date";

import styles from "./athlete-dashboard.module.css";

const API_BASE = "https://api.gympluspro.ir/api/v1";

type Json = Record<string, unknown>;
type User = { full_name?: string; phone?: string; avatar?: string; avatar_url?: string; profile_image?: string };
type View = "home" | "workout" | "nutrition" | "financial" | "progress" | "achievements" | "shop" | "gym" | "settings";
type IconName = View | "search" | "bell" | "menu" | "sidebar" | "close" | "plus" | "arrow" | "check" | "play" | "more" | "logout" | "calendar" | "clock" | "coach" | "card" | "filter" | "edit" | "camera" | "empty";

const nav: { key: View; label: string; icon: IconName }[] = [
  { key: "home", label: "داشبورد", icon: "home" },
  { key: "workout", label: "تمرینات", icon: "workout" },
  { key: "nutrition", label: "تغذیه", icon: "nutrition" },
  { key: "financial", label: "مالی", icon: "financial" },
  { key: "progress", label: "پیشرفت من", icon: "progress" },
  { key: "achievements", label: "دستاوردها", icon: "achievements" },
  { key: "shop", label: "فروشگاه", icon: "shop" },
  { key: "gym", label: "وضعیت باشگاه", icon: "gym" },
  { key: "settings", label: "تنظیمات", icon: "settings" },
];

const navGroups: View[][] = [
  ["home", "workout", "nutrition"],
  ["financial", "progress", "achievements"],
  ["shop", "gym"],
  ["settings"],
];

function token() {
  return typeof window === "undefined" ? "" : localStorage.getItem("gymplus_access") ?? "";
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...init.headers,
    },
  });
  if (handleUnauthorized(response.status)) throw new Error("UNAUTHORIZED");
  if (!response.ok) throw new Error(String(response.status));
  return response.status === 204 ? ({} as T) : (await response.json()) as T;
}

function rows(value: unknown): Json[] {
  if (Array.isArray(value)) return value as Json[];
  if (value && typeof value === "object" && Array.isArray((value as Json).results)) return (value as Json).results as Json[];
  return [];
}

function object(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}

function fa(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString("fa-IR") : String(value);
}

function money(value: unknown) {
  return `${fa(Number(value ?? 0))} تومان`;
}

function date(value: unknown) {
  return formatApiPersianDate(value, "-");
}

function today() {
  return todayApiDate();
}

function persianDayParts(value: unknown, fallback: string) {
  if (!value) return { weekday: fallback, date: "روز تمرین" };
  const raw = String(value).slice(0, 10);
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : String(value));
  if (Number.isNaN(parsed.getTime())) return { weekday: fallback, date: "روز تمرین" };
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return { weekday: part("weekday") || fallback, date: `${part("day")} ${part("month")}`.trim() };
}

function timerText(seconds: number) {
  const minute = Math.floor(seconds / 60).toLocaleString("fa-IR");
  const second = (seconds % 60).toLocaleString("fa-IR", { minimumIntegerDigits: 2 });
  return `${minute}:${second}`;
}

type PanelTimer = { remaining: number; total: number; running: boolean; done: boolean };
// `weights` is keyed per set (`<exerciseKey>:<setIndex>`) so every set keeps its own logged load.
type PanelDailyState = { sets: Record<string, boolean>; foods: Record<string, boolean>; water: number; supplements: Record<string, boolean>; expanded: Record<string, boolean>; timers: Record<string, PanelTimer>; celebrations: Record<string, boolean>; weights: Record<string, string> };
const EMPTY_DAILY_STATE: PanelDailyState = { sets: {}, foods: {}, water: 0, supplements: {}, expanded: {}, timers: {}, celebrations: {}, weights: {} };

function pick(source: Json | null | undefined, ...keys: string[]) { for (const key of keys) if (source?.[key] !== null && source?.[key] !== undefined && source[key] !== "") return source[key]; return undefined; }
function textOf(source: Json | null | undefined, keys: string[], fallback = "") { const value = pick(source, ...keys); return value === undefined ? fallback : String(value); }
function numberOf(source: Json | null | undefined, keys: string[], fallback = 0) { const value = Number(pick(source, ...keys)); return Number.isFinite(value) ? value : fallback; }
type NutrientKey = "calories" | "protein" | "carbs" | "fat";
type ItemNutrition = Record<NutrientKey, number | null>;
const nutrientTotalAliases: Record<NutrientKey, string[]> = {
  calories: ["calories", "kcal", "calorie", "total_calories", "total_kcal"],
  protein: ["protein_g", "protein", "protein_grams", "protein_total"],
  carbs: ["carb_g", "carbs_g", "carbs", "carb", "carbohydrate", "carbohydrates", "carb_grams", "carbohydrate_g"],
  fat: ["fat_g", "fat", "fats", "fat_grams", "fat_total"],
};
const nutrientPer100Aliases: Record<NutrientKey, string[]> = {
  calories: ["kcal100", "calories_per_100g", "kcal_per_100g", "calories_100g", "kcal_100g"],
  protein: ["protein100", "protein_per_100g", "protein_g_per_100g", "protein_100g"],
  carbs: ["carb100", "carbs100", "carb_per_100g", "carbs_per_100g", "carb_g_per_100g", "carbs_100g"],
  fat: ["fat100", "fat_per_100g", "fat_g_per_100g", "fat_100g"],
};
function nutritionNumber(source: Json, keys: string[]) {
  for (const key of keys) {
    if (source[key] === null || source[key] === undefined || source[key] === "") continue;
    const value = Number(source[key]);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return null;
}
function itemNutrition(item: Json): ItemNutrition {
  const quantityGrams = nutritionNumber(item, ["amount_g", "grams"]);
  const linked = [object(item.food), object(item.nutrition), object(item.nutrients), object(item.macros)].filter(source => Object.keys(source).length);
  const totalSources = [item, ...linked];
  const per100Containers = totalSources.map(source => object(source.per_100g)).filter(source => Object.keys(source).length);
  return Object.fromEntries((Object.keys(nutrientTotalAliases) as NutrientKey[]).map(key => {
    const direct = totalSources.map(source => nutritionNumber(source, nutrientTotalAliases[key])).find(value => value !== null) ?? null;
    if (direct !== null) return [key, direct];
    const namedPer100 = totalSources.map(source => nutritionNumber(source, nutrientPer100Aliases[key])).find(value => value !== null) ?? null;
    const containedPer100 = per100Containers.map(source => nutritionNumber(source, [...nutrientTotalAliases[key], ...nutrientPer100Aliases[key]])).find(value => value !== null) ?? null;
    const per100 = namedPer100 ?? containedPer100;
    const value = per100 !== null && quantityGrams !== null ? per100 * quantityGrams / 100 : null;
    return [key, value === null ? null : Math.round(value * 10) / 10];
  })) as ItemNutrition;
}
function listOf(source: Json | null | undefined, ...keys: string[]) { for (const key of keys) { const list = rows(source?.[key]); if (list.length) return list; } return []; }
function stableKey(prefix: string, source: Json | null | undefined, index = 0) { const identity = pick(source, "id", "server_id", "key", "uuid", "slug"); return identity === undefined ? `${prefix}:${textOf(source, ["name", "title"], "item")}:${index}` : `${prefix}:${String(identity)}`; }
function planExpired(plan: Json) { const end = pick(plan, "expires_at", "end_date", "valid_until"); return Boolean(plan.is_expired) || Boolean(end && new Date(String(end)) < new Date()); }
/* `duration_weeks` is the field the coach panel writes when a program is sent; the aliases cover
   older payloads, and the start/end fallback keeps the badge useful when the API omits the number. */
const DURATION_WEEK_KEYS = ["duration_weeks", "durationWeeks", "duration_week", "total_weeks", "weeks_total", "week_count", "weeks_count", "weeks", "duration"];
function weeksBetween(start: unknown, end: unknown) {
  if (!start || !end) return 0;
  const from = new Date(String(start)).getTime(), to = new Date(String(end)).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;
  return Math.max(1, Math.round((to - from) / 604800000));
}
function planDurationWeeks(...sources: (Json | null | undefined)[]) {
  for (const source of sources) { const weeks = Math.round(numberOf(source, DURATION_WEEK_KEYS, 0)); if (weeks > 0) return weeks; }
  for (const source of sources) { const weeks = weeksBetween(pick(source, "start_date", "started_at", "sent_at", "assigned_at", "created_at"), pick(source, "expires_at", "end_date", "valid_until", "finish_date")); if (weeks > 0) return weeks; }
  return 0;
}
function durationText(weeks: number) { return weeks > 0 ? `${fa(weeks)} هفته` : "ثبت نشده"; }
/* Accepts Persian digits and stray characters so a typed «۸۰ کیلو» still becomes 80. */
function parseWeight(value: unknown) {
  const raw = String(value ?? "").replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[^\d.]/g, "");
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
function panelStorageKey(kind: "workout" | "nutrition", planId: unknown, day = today()) { return `gymplus_athlete_${kind}_${planId ?? "daily"}_${day}`; }
function readPanelState(key: string): PanelDailyState {
  try { const saved = JSON.parse(localStorage.getItem(key) ?? "{}") as Partial<PanelDailyState>; return { sets: saved.sets ?? {}, foods: saved.foods ?? {}, water: Math.max(0, Math.min(10, Number(saved.water) || 0)), supplements: saved.supplements ?? {}, expanded: saved.expanded ?? {}, timers: saved.timers ?? {}, celebrations: saved.celebrations ?? {}, weights: saved.weights ?? {} }; }
  catch { return { ...EMPTY_DAILY_STATE }; }
}
function persistPanelState(key: string, value: PanelDailyState) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function clampPercent(value: unknown, total: unknown) { const maximum = Number(total) || 0; return maximum ? Math.max(0, Math.min(100, Math.round((Number(value) || 0) / maximum * 100))) : 0; }

function Ring({ value, label, tone = "orange" }: { value: number; label: React.ReactNode; tone?: "orange" | "green" }) {
  const radius = 42, circle = 2 * Math.PI * radius, safe = Math.max(0, Math.min(100, value));
  return <div className={`${styles.dailyRing} ${tone === "green" ? styles.dailyRingGreen : ""}`}><svg viewBox="0 0 100 100" aria-hidden="true"><circle className={styles.dailyRingTrack} cx="50" cy="50" r={radius}/><circle className={styles.dailyRingValue} cx="50" cy="50" r={radius} strokeDasharray={circle} strokeDashoffset={circle - circle * safe / 100}/></svg><span>{label}</span></div>;
}

function DailyHeader({ kind, user, go, title, eyebrow, detail, progress, ringLabel, streak = 0, compact = false, meta = null }: { kind: "workout" | "nutrition"; user: User; go: (view: View) => void; title: string; eyebrow: string; detail: string; progress: number; ringLabel: React.ReactNode; streak?: number; compact?: boolean; meta?: React.ReactNode }) {
  if (!compact) return <section className={`${styles.dailyHero} ${kind === "nutrition" ? styles.dailyHeroNutrition : ""}`}><div className={styles.dailyBrandRow}><span className={styles.dailyBrand}><Image src="/assets/images/mingcute_fitness.png" width={24} height={24} alt=""/><b>GymPlus+</b></span><span className={styles.dailyStreak}>🔥 {fa(streak)} روز</span><UserAvatar user={user} className={styles.dailyAvatar}/></div><div className={styles.dailyTabs} role="tablist" aria-label="برنامه روزانه"><button type="button" role="tab" aria-selected={kind === "workout"} className={kind === "workout" ? styles.dailyTabActive : ""} onClick={() => go("workout")}>تمرین</button><button type="button" role="tab" aria-selected={kind === "nutrition"} className={kind === "nutrition" ? styles.dailyTabActive : ""} onClick={() => go("nutrition")}>تغذیه</button></div><div className={styles.dailyHeroContent}><div><span>{eyebrow}</span><h2>{title}</h2><p>{detail}</p>{meta}</div><Ring value={progress} tone={kind === "nutrition" ? "green" : "orange"} label={ringLabel}/></div></section>;
  return <section className={`${styles.dailyHero} ${styles.dailyHeroCompact} ${kind === "nutrition" ? styles.dailyHeroNutrition : ""}`}>
    <div className={styles.dailyBrandRow}>
      <span className={styles.dailyPanelIdentity}><i>+G</i><b>پنل ورزشکار</b></span>
      <span className={styles.dailyBrand}><b>GymPlus+</b></span>
      <span className={styles.dailyAthleteIdentity}><span className={styles.dailyStreak}>🔥 {fa(streak)} روز</span><UserAvatar user={user} className={styles.dailyAvatar}/></span>
    </div>
    <div className={styles.dailyTabs} role="tablist" aria-label="برنامه روزانه">
      <button type="button" role="tab" aria-selected className={styles.dailyTabActive} onClick={() => go("workout")}>برنامه تمرینی</button>
      <button type="button" role="tab" aria-selected={false} onClick={() => go("nutrition")}>برنامه غذایی</button>
    </div>
  </section>;
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    workout: <path fill="currentColor" stroke="none" d="M11.879 5.5c-.955.117-1.86.456-2.242.77-2.228 1.842-3.486 4.277-4.139 6.4a13.8 13.8 0 0 0-.562 2.763c-.034.383-.065.784-.007 1.167.383.434.925.749 1.428 1.019 1.051.565 2.63 1.151 4.753 1.387 1.202.134 2.72.21 4.12.098 1.453-.117 2.567-.422 3.145-.885.974-.779 1.22-1.688 1.131-2.484-.095-.856-.576-1.58-1.06-1.903-.835-.556-1.775-.612-2.661-.38-.912.24-1.661.76-2.015 1.186a1 1 0 0 1-1.477.069c-.55-.55-1.485-.71-2.738.125a1 1 0 0 1-1.536-.636c-.286-1.434-.137-2.958.127-4.215.266-1.259.666-2.342.96-2.928a1 1 0 0 1 1.788 0c.203.404.574.766 1.006.918.335-.211.626-.506.862-.821.434-.578.579-1.125.386-1.608-.392-.14-.867-.091-1.27-.042Zm1.483-1.964c.484.093 1.191.335 1.532 1.017.747 1.494.13 2.914-.532 3.797-.432.576-.988 1.118-1.635 1.45-.135.07-.41.2-.727.2-.591 0-1.17-.269-1.645-.605-.09.306-.177.642-.252.998a10.6 10.6 0 0 0-.24 2.078c1.053-.34 2.13-.304 3.058.22a6.5 6.5 0 0 1 2.357-1.173c1.3-.341 2.86-.294 4.277.65 1.015.677 1.784 1.952 1.939 3.347.162 1.454-.343 3.044-1.87 4.266-1.078.862-2.721 1.195-4.233 1.316-1.565.126-3.218.04-4.501-.103-2.378-.264-4.204-.928-5.48-1.613-.837-.45-1.982-1.072-2.345-2.025-.245-.646-.181-1.43-.121-2.102.08-.881.276-1.981.643-3.173.732-2.379 2.165-5.194 4.776-7.352.803-.664 2.147-1.076 3.272-1.214.58-.071 1.19-.081 1.727.021"/>,
    nutrition: <path fill="currentColor" stroke="none" transform="scale(.09375)" d="M224 104h-8.37a88 88 0 0 0-175.26 0H32a8 8 0 0 0-8 8 104.35 104.35 0 0 0 56 92.28V208a16 16 0 0 0 16 16h64a16 16 0 0 0 16-16v-3.72A104.35 104.35 0 0 0 232 112a8 8 0 0 0-8-8m-24.46 0h-51.42a71.84 71.84 0 0 1 41.27-29.57A71.45 71.45 0 0 1 199.54 104m-26.06-47.77q2.75 2.25 5.27 4.75a87.92 87.92 0 0 0-49.15 43h-29.5A72.26 72.26 0 0 1 168 56c1.83 0 3.66.09 5.48.23M128 40a72 72 0 0 1 19 2.57A88.36 88.36 0 0 0 83.33 104H56.46A72.08 72.08 0 0 1 128 40m36.66 152a8 8 0 0 0-4.66 7.3v8.7H96v-8.7a8 8 0 0 0-4.66-7.3 88.29 88.29 0 0 1-51-72h175.29a88.29 88.29 0 0 1-50.97 72"/>,
    financial: <><ellipse cx="12" cy="7" rx="8" ry="4"/><path d="M4 7v5c0 2 3.6 4 8 4s8-2 8-4V7M4 12v5c0 2 3.6 4 8 4s8-2 8-4v-5"/></>,
    progress: <><path d="M4 20V5M4 20h16"/><path d="m7 16 4-5 3 3 6-8"/></>,
    achievements: <><circle cx="12" cy="8" r="5"/><path d="m8.5 12-1 9 4.5-3 4.5 3-1-9"/></>,
    shop: <path d="M19.996 10.621V19a2 2 0 0 1-2 2H6.004a2 2 0 0 1-1.999-2v-8.379M16.498 8.75c0 3.176 5.155 2.52 4.433-.248l-1.045-4.007A2 2 0 0 0 17.952 3H6.048a2 2 0 0 0-1.934 1.495L3.069 8.502c-.722 2.769 4.433 3.424 4.433.248l.5-5.75m-.5 5.75c0 2.902 4.498 2.902 4.498 0m0 0V3m3.998 0l.5 5.75c0 2.902-4.498 2.902-4.498 0"/>,
    gym: <><path d="M4 20V7l8-4 8 4v13M8 20v-5h8v5M8 9h.01M12 9h.01M16 9h.01"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7L10.5 2h-3l-.7 2-1.7.7-1.9-.9-2.1 2.1.9 1.9-.7 1.7-2 .7v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2h3l.7-2 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7z" transform="scale(.8) translate(3 3)"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></>, bell: <><path d="M18 9a6 6 0 0 0-12 0c0 5-2 7-2 7h16s-2-2-2-7"/><path d="M10 20h4"/></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>, sidebar: <path d="M9 3.5v17M3 9.4c0-2.24 0-3.36.436-4.216a4 4 0 0 1 1.748-1.748C6.04 3 7.16 3 9.4 3h5.2c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748C21 6.04 21 7.16 21 9.4v5.2c0 2.24 0 3.36-.436 4.216a4 4 0 0 1-1.748 1.748C17.96 21 16.84 21 14.6 21H9.4c-2.24 0-3.36 0-4.216-.436a4 4 0 0 1-1.748-1.748C3 17.96 3 16.84 3 14.6z"/>, close: <path d="m6 6 12 12M18 6 6 18"/>, plus: <path d="M12 5v14M5 12h14"/>, arrow: <path d="m15 18-6-6 6-6"/>, check: <path d="m5 12 4 4L19 6"/>, play: <path fill="currentColor" stroke="none" d="m12.503 7.01-.066-.04c-.748-.455-1.406-.856-1.97-1.058a2.4 2.4 0 0 0-.976-.157 1.8 1.8 0 0 0-.963.37c-.579.434-.829 1.073-.966 1.78-.133.685-.184 1.577-.247 2.663l-.003.056c-.038.65-.062 1.293-.062 1.876s.024 1.227.062 1.877l.003.055c.063 1.086.114 1.978.247 2.662.137.708.387 1.346.966 1.781.286.215.607.343.963.37.342.025.67-.047.976-.157.564-.202 1.222-.603 1.97-1.057l.066-.04c.426-.26.844-.527 1.217-.79a24 24 0 0 0 1.335-1.022l.05-.041c.764-.623 1.412-1.152 1.86-1.672.488-.57.785-1.182.785-1.966s-.297-1.397-.786-1.966c-.447-.52-1.095-1.05-1.858-1.672l-.05-.041c-.454-.37-.91-.724-1.336-1.022a23 23 0 0 0-1.217-.79"/>, more: <><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"/></>, calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>, clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, coach: <><circle cx="12" cy="8" r="4"/><path d="M5 21c0-5 2.5-8 7-8s7 3 7 8"/></>, card: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>, filter: <path d="M4 5h16M7 10h10M10 15h4"/>, edit: <><path d="m4 20 4-.8L19 8l-3-3L4.8 16.2zM14 7l3 3"/></>, camera: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="m8 7 1.5-3h5L16 7"/><circle cx="12" cy="13" r="3"/></>, empty: <><path d="M5 5h14v12H5zM9 21h6M12 17v4"/><path d="m8 12 2-2 2 2 3-3 2 2"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

async function loadView(view: View): Promise<Json> {
  if (view === "home") {
    const [dashboard, workout, nutrition, progress, invoices, live, chart, personalRecords] = await Promise.all([
      api<Json>("/athlete/dashboard/"), api<Json>("/me/workout/today/").catch(() => ({})), api<Json>("/me/nutrition/today/").catch(() => ({})), api<Json>("/me/progress/").catch(() => ({})), api<unknown>("/me/invoices/pending/").catch(() => []), api<Json>("/me/gym/live/").catch(() => ({})), api<Json>("/me/gym/busy-chart/").catch(() => ({})), api<unknown>("/me/records/").catch(() => []),
    ]);
    return { ...dashboard, workout, nutrition, progress, invoices, live, chart, personal_records: personalRecords };
  }
  if (view === "workout") {
    const [plan, completions, history, attendance, live, records] = await Promise.all([api<Json>("/me/workout/today/"), api<unknown>("/me/exercise-completions/").catch(() => []), api<unknown>("/me/plan-history/").catch(() => []), api<Json|null>("/me/attendance/active/").catch(() => null), api<Json>("/me/gym/live/").catch(() => ({})), api<unknown>("/me/records/").catch(() => [])]);
    return { plan, completions, history, attendance, live, records };
  }
  if (view === "nutrition") {
    const [todayData, plan, target, adherence, completions] = await Promise.all([api<Json>("/me/nutrition/today/"), api<Json>("/me/nutrition/plan/").catch(() => ({})), api<Json>("/me/nutrition/target/").catch(() => ({})), api<Json>("/me/nutrition/adherence/").catch(() => ({})), api<unknown>("/me/meal-completions/").catch(() => [])]);
    return { today: todayData, plan, target, adherence, completions };
  }
  if (view === "financial") {
    const [invoices, pending, transactions, payments] = await Promise.all([api<unknown>("/me/invoices/"), api<unknown>("/me/invoices/pending/").catch(() => []), api<unknown>("/me/transactions/").catch(() => []), api<unknown>("/me/payments/history/").catch(() => [])]);
    return { invoices, pending, transactions, payments };
  }
  if (view === "progress") {
    const [summary, history, weights, goal] = await Promise.all([api<Json>("/me/progress/"), api<unknown>("/me/progress/history/").catch(() => []), api<unknown>("/weights/").catch(() => []), api<Json>("/me/weekly-goals/current/").catch(() => ({}))]);
    return { summary, history, weights, goal };
  }
  if (view === "achievements") {
    const [achievements, endorsements, records] = await Promise.all([api<unknown>("/me/achievements/"), api<unknown>("/me/endorsements/"), api<unknown>("/me/records/").catch(() => [])]);
    return { achievements, endorsements, records };
  }
  if (view === "shop") {
    const [services, categories, purchases, options] = await Promise.all([api<unknown>("/store/services/"), api<unknown>("/store/categories/"), api<unknown>("/store/purchases/"), api<Json>("/store/payment-options/").catch(() => ({}))]);
    return { services, categories, purchases, options };
  }
  if (view === "gym") {
    try {
      const [live, chart, membership, attendance] = await Promise.all([api<Json>("/me/gym/live/"), api<Json>("/me/gym/busy-chart/"), api<unknown>("/me/membership/").catch(() => []), api<Json | null>("/me/attendance/active/").catch(() => null)]);
      return { live, chart, membership, attendance };
    } catch (reason) {
      if ((reason as Error).message === "403") return { restricted: true };
      throw reason;
    }
  }
  const [profile, account, membership] = await Promise.all([api<Json>("/athlete/me/"), api<Json>("/auth/me/"), api<unknown>("/me/membership/").catch(() => ({}))]);
  return { ...profile, account, membership };
}

export function AthleteDashboard({ user }: { user: User }) {
  const [view, setView] = useState<View>("home");
  const [data, setData] = useState<Json>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [request, setRequest] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [noticeVisible, setNoticeVisible] = useState(true);
  const load = useCallback(async () => { setLoading(true); setError(""); try { setData(await loadView(view)); } catch (reason) { if ((reason as Error).message !== "UNAUTHORIZED") setError("دریافت اطلاعات این بخش انجام نشد."); } finally { setLoading(false); } }, [view]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearch(true);
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  const go = (next: View) => { setView(next); setDrawer(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const logout = async () => { setLogoutPending(true); try { await api("/auth/logout/", { method: "POST", body: JSON.stringify({ refresh: localStorage.getItem("gymplus_refresh") }) }); } catch {} finally { localStorage.removeItem("gymplus_access"); localStorage.removeItem("gymplus_refresh"); localStorage.removeItem("gymplus_user"); location.href = "/login"; } };
  return <main className={`${styles.app} ${sidebarOpen ? "" : styles.appCollapsed}`} dir="rtl">
    <Sidebar user={user} view={view} go={go} open={sidebarOpen} onToggle={() => setSidebarOpen(value => !value)} onRequest={() => setRequest(true)} onLogout={() => setLogoutConfirm(true)}/>
    <section className={styles.workspace}>
      <Topbar title={view === "home" ? "داشبورد ورزشکار" : nav.find(item => item.key === view)?.label ?? "داشبورد"} user={user} go={go} onMenu={() => setDrawer(true)} onSearch={() => setSearch(true)}/>
      {noticeVisible ? <div className={styles.notice}><span>☀</span><p>سلام {(user.full_name || "ورزشکار").split(" ")[0]} جان، خوش اومدی؛ برنامه امروزت آماده است.</p><button className={styles.noticeAction} onClick={() => go("workout")}>مشاهده برنامه</button><button className={styles.noticeClose} onClick={() => setNoticeVisible(false)} aria-label="بستن پیام"><Icon name="close" size={16}/></button></div> : null}
      <div className={styles.content}>{loading ? <Loading/> : error ? <ErrorState message={error} retry={() => void load()}/> : <AthletePage view={view} data={data} user={user} go={go} reload={load}/>}</div>
    </section>
    <BottomNav view={view} go={go} onRequest={() => setRequest(true)}/>
    {drawer ? <MobileDrawer user={user} view={view} go={go} close={() => setDrawer(false)} onRequest={() => setRequest(true)} onLogout={() => { setDrawer(false); setLogoutConfirm(true); }}/> : null}
    {search ? <SearchDialog close={() => setSearch(false)} go={go}/> : null}
    {request ? <RequestDialog close={() => setRequest(false)} saved={() => { setRequest(false); void load(); }}/> : null}
    {logoutConfirm ? <LogoutConfirm pending={logoutPending} close={() => setLogoutConfirm(false)} confirm={() => void logout()}/> : null}
  </main>;
}

function LogoutConfirm({ pending, close, confirm }: { pending: boolean; close: () => void; confirm: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !pending) close(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, pending]);
  return <div className={styles.logoutOverlay} onMouseDown={() => { if (!pending) close(); }}>
    <section className={styles.logoutDialog} role="alertdialog" aria-modal="true" aria-labelledby="athlete-logout-title" onMouseDown={event => event.stopPropagation()}>
      <header><h2 id="athlete-logout-title">خروج از حساب کاربری</h2><button type="button" onClick={close} disabled={pending} aria-label="بستن"><Icon name="close"/></button></header>
      <p>آیا مطمئنید که می خواهید از حساب خود خارج شوید؟</p>
      <div><button type="button" className={styles.logoutConfirmButton} onClick={confirm} disabled={pending}>{pending ? "در حال خروج..." : "بله، خروج از حساب"}</button><button type="button" className={styles.logoutCancelButton} onClick={close} disabled={pending}>انصراف</button></div>
    </section>
  </div>;
}

function Brand({ compact = false }: { compact?: boolean }) { return <div className={`${styles.brand} ${compact ? styles.brandCompact : ""}`}><Image src="/assets/images/mingcute_fitness.png" width={28} height={28} alt=""/><b>GymPlus+</b><em>ورزشکار</em></div>; }

function UserAvatar({ user, className = "" }: { user: User; className?: string }) {
  const image = user.avatar_url || user.avatar || user.profile_image;
  return <span className={`${styles.avatar} ${className}`} style={image ? { backgroundImage: `url(${image})` } : undefined}>{image ? null : (user.full_name || "و").slice(0, 1)}</span>;
}

function AthleteNavigation({ view, go, compact = false }: { view: View; go: (view: View) => void; compact?: boolean }) {
  return <nav aria-label="منوی ورزشکار">{navGroups.map((group, groupIndex) => <div className={styles.navGroup} key={groupIndex}>{group.map(key => { const item = nav.find(entry => entry.key === key); if (!item) return null; return <button key={item.key} className={view === item.key ? styles.active : ""} onClick={() => go(item.key)} title={compact ? item.label : undefined} aria-current={view === item.key ? "page" : undefined}><Icon name={item.icon}/><span>{item.label}</span></button>; })}</div>)}</nav>;
}

function Sidebar({ user, view, go, open, onToggle, onRequest, onLogout }: { user: User; view: View; go: (view: View) => void; open: boolean; onToggle: () => void; onRequest: () => void; onLogout: () => void }) {
  const startWorkout = view === "home" || view === "workout";
  return <aside className={`${styles.sidebar} ${open ? "" : styles.sidebarCollapsed}`}><div className={styles.sidebarHead}><Brand compact={!open}/><button onClick={onToggle} aria-label={open ? "جمع کردن منو" : "باز کردن منو"} aria-expanded={open}><Icon name="sidebar"/></button></div><button className={styles.primaryWide} onClick={() => startWorkout ? go("workout") : onRequest()} title={!open ? (startWorkout ? "شروع تمرین" : "درخواست جدید") : undefined}><Icon name={startWorkout ? "play" : "plus"}/><span>{startWorkout ? "شروع تمرین" : "درخواست جدید"}</span></button><AthleteNavigation view={view} go={go} compact={!open}/><Profile user={user} onLogout={onLogout}/></aside>;
}

function Profile({ user, onLogout }: { user: User; onLogout: () => void }) { const [expanded, setExpanded] = useState(false); return <div className={styles.profile}><Brand/><button type="button" className={styles.profileIdentity} onClick={() => setExpanded(value => !value)} aria-expanded={expanded}><UserAvatar user={user}/><p><b>{user.full_name || "ورزشکار GymPlus"}</b><small>ورزشکار</small></p><Icon name="arrow" size={14}/></button>{expanded && user.phone ? <div className={styles.profileDetails}>{user.phone}</div> : null}<button type="button" className={styles.profileLogout} onClick={onLogout}><Icon name="logout"/> خروج از حساب</button></div>; }

function Topbar({ title, user, go, onMenu, onSearch }: { title: string; user: User; go: (view: View) => void; onMenu: () => void; onSearch: () => void }) {
  return <header className={styles.topbar}><div className={styles.title}><button className={styles.menuButton} onClick={onMenu} aria-label="باز کردن منو"><Icon name="sidebar"/></button><h1>{title}</h1></div><div className={styles.topActions}><button className={styles.searchButton} onClick={onSearch}><Icon name="search"/><span>جستجو...</span><kbd>⌘ K</kbd></button><AthleteNotificationBell user={user} go={go}/><UserAvatar user={user}/></div></header>;
}

function BottomNav({ view, go }: { view: View; go: (view: View) => void; onRequest: () => void }) { const items = [nav[0], nav[1], nav[2], nav[6]]; return <nav className={styles.bottomNav}>{items.slice(0,2).map(item => <button key={item.key} className={view === item.key ? styles.bottomActive : ""} onClick={() => go(item.key)}><Icon name={item.icon} size={24}/><span>{item.label}</span></button>)}<button className={styles.mobileAdd} onClick={() => go("workout")} aria-label="شروع تمرین"><Icon name="play" size={36}/></button>{items.slice(2).map(item => <button key={item.key} className={view === item.key ? styles.bottomActive : ""} onClick={() => go(item.key)}><Icon name={item.icon} size={24}/><span>{item.label}</span></button>)}</nav>; }

function MobileDrawer({ user, view, go, close, onRequest, onLogout }: { user: User; view: View; go: (view: View) => void; close: () => void; onRequest: () => void; onLogout: () => void }) { const startWorkout = view === "home" || view === "workout"; return <div className={styles.backdrop} onMouseDown={close}><aside className={styles.drawer} onMouseDown={event => event.stopPropagation()}><header><Brand/><button onClick={close} aria-label="بستن منو"><Icon name="close"/></button></header><button className={styles.primaryWide} onClick={() => { if (startWorkout) go("workout"); else onRequest(); }}><Icon name={startWorkout ? "play" : "plus"}/> {startWorkout ? "شروع تمرین" : "درخواست جدید"}</button><AthleteNavigation view={view} go={go}/><Profile user={user} onLogout={onLogout}/></aside></div>; }

function Loading() { return <div className={styles.loading}><i/><span>در حال دریافت اطلاعات...</span></div>; }
function ErrorState({ message, retry }: { message: string; retry: () => void }) { return <div className={styles.errorState}><Icon name="empty" size={48}/><b>{message}</b><button onClick={retry}>تلاش دوباره</button></div>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className={styles.empty}><Icon name="empty" size={64}/><b>{title}</b><p>{text}</p></div>; }

function AthletePage({ view, data, user, go, reload }: { view: View; data: Json; user: User; go: (view: View) => void; reload: () => Promise<void> }) {
  if (view === "home") return <Home data={data} go={go}/>;
  if (view === "workout") return <Workout data={data} user={user} go={go} reload={reload}/>;
  if (view === "nutrition") return <Nutrition data={data} user={user} go={go} reload={reload}/>;
  if (view === "financial") return <Financial data={data}/>;
  if (view === "progress") return <Progress data={data} reload={reload}/>;
  if (view === "achievements") return <Achievements data={data}/>;
  if (view === "shop") return <Shop data={data} reload={reload}/>;
  if (view === "gym") return <GymStatus data={data} reload={reload} go={go}/>;
  return <Settings data={data} reload={reload} go={go}/>;
}

function Card({ title, action, children, className = "" }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) { return <section className={`${styles.card} ${className}`}><header>{title ? <h2>{title}</h2> : <span/>}{action}</header>{children}</section>; }
function MoreButton() { return <button className={styles.moreButton} aria-label="بیشتر"><Icon name="more"/></button>; }
function HomeCardTitle({ icon, children, tone = "orange" }: { icon: IconName; children: React.ReactNode; tone?: "orange" | "green" }) { return <span className={`${styles.homeCardTitle} ${tone === "green" ? styles.homeCardTitleGreen : ""}`}><Icon name={icon} size={18}/>{children}</span>; }

function Home({ data, go }: { data: Json; go: (view: View) => void }) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [starting,setStarting]=useState(false);
  const workout = object(data.workout);
  const workoutDays = rows(workout.days);
  const selectedDay = workoutDays.find(day => String(day.date ?? "").slice(0, 10) === today()) ?? workoutDays[0] ?? workout;
  const exercises = rows(selectedDay.exercises).length ? rows(selectedDay.exercises) : workoutDays.flatMap(day => rows(day.exercises));
  const nutrition = object(data.nutrition);
  const nutritionPlan = object(nutrition.plan);
  const meals = rows(nutrition.meals).length ? rows(nutrition.meals) : rows(nutritionPlan.meals);
  const progress = object(data.progress);
  const periodData = object(data[period === "week" ? "weekly" : "monthly"]);
  const live = object(data.live);
  const busyHours = rows(object(data.chart).hours).length ? rows(object(data.chart).hours) : rows(data.chart);
  const invoices = rows(data.invoices);
  const records = rows(progress.personal_records).length ? rows(progress.personal_records) : rows(data.personal_records);
  const weightSeries = rows(progress.weight_series).length ? rows(progress.weight_series) : rows(data.weight_series);
  const weight = weightSeries.map(item => Number(item.weight ?? item.value ?? 0)).filter(Number.isFinite);
  const value = (key: string, fallback?: unknown) => periodData[key] ?? data[key] ?? progress[key] ?? fallback;
  const pay = async (item: Json) => { const result = await api<Json>(`/me/invoices/${item.id}/pay-online/`, { method: "POST" }); const url = String(result.payment_url ?? result.url ?? ""); if (url) location.href = url; };
  const startWorkout=async()=>{setStarting(true);try{await api("/me/attendance/start/",{method:"POST"});go("workout")}finally{setStarting(false)}};
  return <div className={styles.athleteHome}>
    <div className={styles.homeTopGrid}>
      <Card className={styles.todayProgram} title="برنامه امروز" action={<MoreButton/>}>
        <div className={styles.todayProgramBody}>
          <div className={styles.programCopy}><span className={styles.programBadge}>آماده تمرین</span><h2>{String(selectedDay.title ?? workout.title ?? "برای امروز برنامه‌ای ثبت نشده")}</h2><p>{exercises.length ? `${fa(exercises.length)} حرکت در برنامه امروزت قرار دارد.` : "پس از ثبت برنامه توسط مربی، جزئیات تمرین اینجا نمایش داده می‌شود."}</p><div className={styles.programMeta}><span><Icon name="calendar" size={16}/>{fa(workout.completed_sessions ?? data.completed_sessions ?? 0)} جلسه متوالی</span>{data.adherence_band ? <em>{String(data.adherence_band)}</em> : null}</div><button className={styles.homePrimary} disabled={starting||!exercises.length} onClick={()=>void startWorkout()}><Icon name="play" size={17}/>{starting?"در حال شروع...":"شروع تمرین"}</button></div>
          <div className={styles.programVisual}><Icon name="workout" size={58}/></div>
        </div>
      </Card>
      <Card className={styles.gymOverview} title="وضعیت باشگاه" action={<button className={styles.textButton} onClick={() => go("gym")}>مشاهده جزئیات</button>}>
        <div className={styles.gymSummary}><div><span className={styles.livePulse}/><p><strong>{live.present_count == null ? "-" : `${fa(live.present_count)} نفر`}</strong><small>در حال حاضر در باشگاه</small></p></div><span className={styles.calmBadge}>{String(live.busy_label ?? live.status_label ?? "وضعیت لحظه‌ای")}</span></div>
        {busyHours.length ? <div className={styles.homeBusyChart}>{busyHours.slice(0, 12).map((item, index) => { const amount = Number(item.avg_count ?? item.value ?? item.count ?? 0); const max=Math.max(...busyHours.map(entry=>Number(entry.avg_count??entry.value??entry.count??0)),1); const level=String(item.busy_level??""); return <div key={String(item.id ?? index)}><i className={["busy","high","very_busy"].includes(level)?styles.busyHigh:["normal","medium"].includes(level)?styles.busyMedium:""} style={{ height: `${Math.max(10, Math.min(100,amount/max*100))}%` }}/><span>{String(item.label ?? item.hour ?? index + 8)}</span></div>; })}</div> : <HomeEmpty text="اطلاعات شلوغی باشگاه در دسترس نیست."/>}
      </Card>
    </div>

    <Card className={styles.homeOverview} title="مروری بر آمار" action={<div className={styles.homePeriod}><button className={period === "week" ? styles.periodActive : ""} onClick={() => setPeriod("week")}>هفتگی</button><button className={period === "month" ? styles.periodActive : ""} onClick={() => setPeriod("month")}>ماهانه</button></div>}>
      <div className={styles.homeStatsGrid}>
        <HomeStat label="شاخص پیشرفت کلی" value={value("progress_pct")} suffix="٪" hint={value("progress_delta")}/>
        <HomeStat label="وزن فعلی" value={value("current_weight", data.weight)} suffix=" کیلوگرم" hint={value("weight_delta")}/>
        <HomeStat label="پایبندی تمرین" value={value("adherence_pct")} suffix="٪" hint={value("adherence_delta")}/>
        <HomeStat label="پایبندی تغذیه" value={value("nutrition_pct", nutrition.adherence_pct)} suffix="٪" hint={value("nutrition_delta")}/>
      </div>
    </Card>

    <Card className={styles.homeTableCard} title={<HomeCardTitle icon="workout">تمرین امروز</HomeCardTitle>} action={<button className={styles.textButton} onClick={() => go("workout")}>مشاهده کامل</button>}>
      {exercises.length ? <div className={styles.homeTable}><div className={styles.homeTableHead}><span>حرکت</span><span>ست و تکرار</span><span>استراحت</span></div>{exercises.slice(0, 5).map((item, index) => <div className={styles.homeTableRow} key={String(item.id ?? index)}><p><b>{String(item.name ?? item.exercise_name ?? "حرکت تمرینی")}</b><small>حرکت {fa(index + 1)}</small></p><span>{fa(item.sets)} ست × {fa(item.reps)} تکرار</span><span>{item.rest_seconds == null ? "-" : `${fa(item.rest_seconds)} ثانیه`}</span></div>)}</div> : <HomeEmpty text="برای امروز تمرینی ثبت نشده است."/>}
    </Card>

    <div className={styles.homeMiddleGrid}>
      <Card className={styles.homeTableCard} title={<HomeCardTitle icon="nutrition" tone="green">تغذیه امروز</HomeCardTitle>} action={<button className={styles.textButton} onClick={() => go("nutrition")}>مشاهده کامل</button>}>
        {meals.length ? <div className={styles.homeTable}><div className={styles.homeTableHead}><span>وعده</span><span>مواد غذایی</span><span>کالری</span></div>{meals.slice(0, 5).map((meal, index) => <div className={styles.homeTableRow} key={String(meal.id ?? index)}><p><b>{String(meal.name ?? mealLabel(String(meal.kind)))}</b><small>{mealIcon(String(meal.kind))} {fa(rows(meal.items).length)} مورد</small></p><span>{rows(meal.items).slice(0, 2).map(item => String(item.name ?? item.food_name ?? "")).filter(Boolean).join("، ") || "-"}</span><span>{meal.calories == null ? "-" : fa(meal.calories)}</span></div>)}</div> : <HomeEmpty text="برنامه غذایی امروز ثبت نشده است."/>}
      </Card>
      <Card className={styles.homeTableCard} title={<HomeCardTitle icon="achievements">رکوردهای شخصی</HomeCardTitle>} action={<button className={styles.textButton} onClick={() => go("progress")}>مشاهده کامل</button>}>
        {records.length ? <div className={styles.recordList}>{records.slice(0, 4).map((record, index) => <article key={String(record.id ?? index)}><span>{fa(index + 1)}</span><p><b>{String(record.exercise_name ?? record.title ?? "رکورد ورزشی")}</b><small>{date(record.recorded_at ?? record.date)}</small></p><strong>{fa(record.value)} {String(record.unit ?? "")}</strong></article>)}</div> : <HomeEmpty text="هنوز رکوردی برای شما ثبت نشده است."/>}
      </Card>
    </div>

    <Card className={styles.homeWeightCard} title="روند تغییرات وزن" action={<button className={styles.textButton} onClick={() => go("progress")}>مشاهده جزئیات</button>}>{weight.length ? <Line values={weight}/> : <HomeEmpty text="برای نمایش نمودار، وزن خود را ثبت کنید."/>}</Card>

    <Card className={styles.homeFinanceCard} title="وضعیت مالی" action={<MoreButton/>}>
      {invoices.length ? <><div className={styles.financeWarning}><span>!</span><p>شما فاکتور پرداخت‌نشده دارید. لطفاً هرچه سریع‌تر برای پرداخت آن اقدام کنید.</p><button type="button" onClick={() => void pay(invoices[0])}>پرداخت</button></div><div className={styles.financeTable}><div className={styles.financeHead}><span>شرح</span><span>سررسید</span><span>مبلغ</span><span>وضعیت</span><span/></div>{invoices.slice(0, 5).map((item, index) => <div className={styles.financeRow} key={String(item.id ?? index)}><p><b>{String(item.service_name ?? item.title ?? `فاکتور ${fa(item.id)}`)}</b><small>{String(item.invoice_number ?? "")}</small></p><span>{date(item.due_date)}</span><strong>{money(item.outstanding ?? item.payable ?? item.amount)}</strong><span className={styles.financeStatus}>{statusLabel(item.status)}</span><button className={styles.payButton} onClick={() => void pay(item)}>پرداخت</button></div>)}</div></> : <HomeEmpty text="در حال حاضر فاکتور پرداخت‌نشده‌ای ندارید."/>}
    </Card>
  </div>;
}

function HomeStat({ label, value, suffix, hint }: { label: string; value: unknown; suffix: string; hint?: unknown }) { const empty = value === null || value === undefined || value === ""; return <article className={styles.homeStat}><span>{label}</span><strong>{empty ? "-" : `${fa(value)}${suffix}`}</strong>{hint !== null && hint !== undefined && hint !== "" ? <small>{Number(hint) > 0 ? "+" : ""}{fa(hint)} نسبت به دوره قبل</small> : <small>اطلاعات دوره جاری</small>}</article>; }
function HomeEmpty({ text }: { text: string }) { return <div className={styles.homeEmpty}><Icon name="empty" size={30}/><span>{text}</span></div>; }

function Workout({ data, user, go, reload }: { data: Json; user: User; go: (view: View) => void; reload: () => Promise<void> }) {
  const plan=object(data.plan),days=listOf(plan,"days","sessions","workout_days"),completions=rows(data.completions),attendance=data.attendance?object(data.attendance):null,records=rows(data.records);
  const [dayId,setDayId]=useState(String(pick(days[0],"id","key")??"0")),[video,setVideo]=useState<Json|null>(null),[swap,setSwap]=useState(false),[finish,setFinish]=useState(false),[recordSuccess,setRecordSuccess]=useState<{name:string;value:number}|null>(null),[pending,setPending]=useState(false),[pendingExercise,setPendingExercise]=useState<string|null>(null),[newRecords,setNewRecords]=useState<Record<string,number>>({}),[daily,setDaily]=useState<PanelDailyState>(EMPTY_DAILY_STATE),[actionError,setActionError]=useState(""),[serverDone,setServerDone]=useState<Record<string,boolean>>({}),[serverCompletionIds,setServerCompletionIds]=useState<Record<string,number>>({}),[streakAwarded,setStreakAwarded]=useState(false);
  const selected=days.find(item=>String(pick(item,"id","key"))===dayId)??days[0],exercises=listOf(selected,"exercises","items","movements"),storageKey=panelStorageKey("workout",pick(plan,"id","key"),`${today()}-${pick(selected,"id","key")??"today"}`),completionByExercise=new Map(completions.filter(item=>item.done!==false).map(item=>[String(pick(item,"exercise","exercise_id")),item]));
  const exerciseKey=(exercise:Json,index=0)=>stableKey("exercise",exercise,index),setCount=(exercise:Json)=>Math.max(1,numberOf(exercise,["sets","set_count","total_sets"],1)),isServerDone=(exercise:Json)=>{const id=String(pick(exercise,"id","exercise_id"));return serverDone[id]??completionByExercise.has(id)},setDone=(exercise:Json,index:number,exerciseIndex=0)=>daily.sets[`${exerciseKey(exercise,exerciseIndex)}:${index}`]??isServerDone(exercise);
  /* REQ 4 — per-set weight logging: every set owns a `<exerciseKey>:<setIndex>` entry in `daily.weights`,
     the heaviest entry of an exercise is its candidate PR, and `bestRecord` merges server records with
     PRs saved in this session so the displayed record updates without waiting for a reload. */
  const setDetail=(exercise:Json,index:number)=>listOf(exercise,"set_details","sets_detail","set_types")[index]??{};
  const weightKey=(key:string,index:number)=>`${key}:${index}`,setWeight=(key:string,index:number)=>daily.weights[weightKey(key,index)]??"";
  const plannedWeight=(exercise:Json,index:number)=>pick(setDetail(exercise,index),"weight","kg","load")??pick(exercise,"weight","kg","load");
  const writeWeight=(key:string,index:number,value:string)=>setDaily(current=>({...current,weights:{...current.weights,[weightKey(key,index)]:value}}));
  const heaviestSet=(exercise:Json,key:string)=>Math.max(0,...Array.from({length:setCount(exercise)},(_,index)=>parseWeight(setWeight(key,index))));
  const bestRecord=(name:string)=>Math.max(0,newRecords[name]??0,...records.filter(item=>textOf(item,["exercise_name","name"])===name).map(item=>numberOf(item,["value","weight"])));
  const durationWeeks=planDurationWeeks(plan,object(plan.plan),object(selected?.plan),data);
  const totalSets=exercises.reduce((sum,item)=>sum+setCount(item),0),checkedSets=exercises.reduce((sum,item,exerciseIndex)=>sum+Array.from({length:setCount(item)},(_,index)=>setDone(item,index,exerciseIndex)?1:0).reduce<number>((a,b)=>a+b,0),0),expired=planExpired(plan),progress=clampPercent(checkedSets,totalSets),allDone=totalSets>0&&checkedSets===totalSets,restDay=Boolean(selected?.is_rest_day)||(!exercises.length&&Boolean(pick(selected,"rest_day","is_rest"))),backendStreak=numberOf(data,["streak","workout_streak","consecutive_days"]),visibleStreak=backendStreak+(streakAwarded||allDone?1:0);
  useEffect(()=>setDaily(readPanelState(storageKey)),[storageKey]); useEffect(()=>persistPanelState(storageKey,daily),[storageKey,daily]);
  useEffect(()=>{setStreakAwarded(Boolean(readPanelState(storageKey).celebrations.streakAwarded))},[storageKey]);
  useEffect(()=>{if(allDone&&!streakAwarded){setStreakAwarded(true);setDaily(current=>({...current,celebrations:{...current.celebrations,streakAwarded:true}}))}},[allDone,streakAwarded]);
  useEffect(()=>{const id=window.setInterval(()=>setDaily(current=>{let changed=false;const timers={...current.timers};for(const [key,timer] of Object.entries(timers))if(timer.running&&timer.remaining>0){const remaining=timer.remaining-1;timers[key]={...timer,remaining,running:remaining>0,done:remaining===0};changed=true}return changed?{...current,timers}:current}),1000);return()=>window.clearInterval(id)},[]);
  const startWorkout=async()=>{setPending(true);setActionError("");try{await api("/me/attendance/start/",{method:"POST"});await reload()}catch{setActionError("شروع تمرین ثبت نشد. اتصال اینترنت را بررسی و دوباره تلاش کن.")}finally{setPending(false)}};
  const finishWorkout=async()=>{setPending(true);setActionError("");try{await api("/me/attendance/end/",{method:"POST"});setFinish(false);await reload()}catch{setActionError("پایان تمرین ثبت نشد؛ دوباره تلاش کن.")}finally{setPending(false)}};
  const syncExercise=async(exercise:Json,complete:boolean)=>{const id=pick(exercise,"id","exercise_id");if(id===undefined)return;const idKey=String(id),completion=completionByExercise.get(idKey),completionId=serverCompletionIds[idKey]??Number(completion?.id);if(complete&&!isServerDone(exercise)){const created=await api<Json>("/me/exercise-completions/",{method:"POST",body:JSON.stringify({exercise:Number(id),done:true,completed_on:today()})});const createdId=Number(pick(created,"id","completion_id"));if(Number.isFinite(createdId))setServerCompletionIds(current=>({...current,[idKey]:createdId}))}if(!complete&&isServerDone(exercise)&&Number.isFinite(completionId))await api(`/me/exercise-completions/${completionId}/`,{method:"DELETE"})};
  const saveRecord=async(exercise:Json,key:string)=>{const name=textOf(exercise,["name","exercise_name","title"],"حرکت تمرینی"),entered=heaviestSet(exercise,key),previous=bestRecord(name);if(entered<=0||entered<=previous)return;await api("/me/records/",{method:"POST",body:JSON.stringify({exercise_name:name,value:entered,unit:"کیلوگرم",achieved_on:today()})});setNewRecords(current=>({...current,[name]:Math.max(entered,current[name]??0)}));setRecordSuccess({name,value:entered})};
  const toggleSet=async(exercise:Json,index:number,exerciseIndex:number)=>{if(expired)return;const key=exerciseKey(exercise,exerciseIndex),setKey=`${key}:${index}`,current=setDone(exercise,index,exerciseIndex),wasComplete=Array.from({length:setCount(exercise)},(_,i)=>setDone(exercise,i,exerciseIndex)).every(Boolean),materialized=Object.fromEntries(Array.from({length:setCount(exercise)},(_,i)=>[`${key}:${i}`,setDone(exercise,i,exerciseIndex)])),nextSets={...daily.sets,...materialized,[setKey]:!current},complete=Array.from({length:setCount(exercise)},(_,i)=>Boolean(nextSets[`${key}:${i}`])).every(Boolean),superset=pick(exercise,"superset_with","superset_id","paired_exercise"),total=Math.max(10,numberOf(exercise,["rest_seconds","rest_sec","restSec","rest"],60));setActionError("");setDaily(value=>{const timers={...value.timers};if(!current&&!superset){for(const timerKey of Object.keys(timers))timers[timerKey]={...timers[timerKey],running:false};timers[key]={remaining:total,total,running:true,done:false}}return{...value,sets:{...value.sets,...materialized,[setKey]:!current},timers}});
    /* A newly ticked set is the moment to look for a PR, even when the exercise is not finished yet. */
    const checkRecord=async()=>{if(current)return;try{await saveRecord(exercise,key)}catch{setActionError("ثبت رکورد جدید انجام نشد؛ وضعیت ست‌ها تغییری نکرد.")}};
    if(complete===wasComplete){await checkRecord();return}setPendingExercise(key);try{await syncExercise(exercise,complete);const exerciseId=String(pick(exercise,"id","exercise_id"));setServerDone(value=>({...value,[exerciseId]:complete}));await checkRecord()}catch{setDaily(value=>({...value,sets:{...value.sets,...Object.fromEntries(Array.from({length:setCount(exercise)},(_,i)=>[`${key}:${i}`,Boolean(materialized[`${key}:${i}`])]))}}));setActionError("ثبت وضعیت حرکت انجام نشد؛ وضعیت قبلی بازیابی شد.")}finally{setPendingExercise(null)}};
  const changeTimer=(key:string,action:"toggle"|"reset"|"skip")=>setDaily(current=>{const timer=current.timers[key];if(!timer)return current;const next=action==="toggle"?{...timer,running:!timer.running&&timer.remaining>0}:action==="reset"?{...timer,remaining:timer.total,running:true,done:false}:{...timer,remaining:0,running:false,done:true};return{...current,timers:{...current.timers,[key]:next}}});
  const setType=(exercise:Json,index:number)=>{const detail=listOf(exercise,"set_details","sets_detail","set_types")[index],raw=textOf(detail,["type","set_type","kind"],"");if(["warmup","warm_up"].includes(raw)||(!raw&&index===0&&setCount(exercise)>2))return"گرم‌کردن";if(["drop","drop_set"].includes(raw))return"دراپ";if(["failure","to_failure"].includes(raw))return"تا ناتوانی";return"اصلی"};
  const runningTimerEntry=Object.entries(daily.timers).find(([,timer])=>timer.running),activeTimerEntry=runningTimerEntry??Object.entries(daily.timers).find(([,timer])=>timer.done)??Object.entries(daily.timers).find(([,timer])=>timer.remaining>0);
  const activeTimer=activeTimerEntry?.[1],activeTimerKey=activeTimerEntry?.[0],activeTimerExercise=activeTimerKey?exercises.find((item,itemIndex)=>exerciseKey(item,itemIndex)===activeTimerKey):undefined;
  if(!days.length)return <div className={styles.dailyPanel}><DailyHeader kind="workout" user={user} go={go} title="برنامه تمرینی" eyebrow={`امروز · ${date(today())}`} detail="هنوز برنامه فعالی برای امروز نداری." progress={0} ringLabel={<><b>۰٪</b><small>پیشرفت</small></>}/><Empty title="برنامه تمرینی فعالی نداری" text="وقتی مربی برنامه جدیدی ارسال کند، تمرین روزانه‌ات اینجا نمایش داده می‌شود."/></div>;
  return <div className={styles.dailyPanel}>
    <DailyHeader kind="workout" user={user} go={go} title="" eyebrow="" detail="" progress={progress} streak={visibleStreak} ringLabel={null} compact/>
    <section className={styles.workoutSummary}><div><small>برنامه تمرینی امروز</small><h2>{textOf(plan,["title","name"],"برنامه تمرینی")}</h2><p><b>{textOf(plan,["coach_name","trainer_name"],"مربی شما")}</b><span className={styles.planDuration}><Icon name="calendar" size={12}/> مدت زمان: {durationText(durationWeeks)}</span><span>هفته {fa(pick(plan,"current_week","week")??1)}{durationWeeks>0?` از ${fa(durationWeeks)}`:""}</span><span>{fa(checkedSets)} / {fa(totalSets)} ست</span></p></div><Ring value={progress} label={<><b>{fa(progress)}٪</b><small>پیشرفت</small></>}/></section>
    {Boolean(plan.is_new)||Boolean(plan.updated_at&&plan.seen_at&&String(plan.updated_at)>String(plan.seen_at))?<div className={styles.dailyBanner}><Icon name="bell"/> برنامه تمرینی شما به‌روزرسانی شده است.</div>:null}{actionError?<div className={styles.dailyError}><span>{actionError}</span><button onClick={()=>void reload()}>تلاش دوباره</button></div>:null}
    <div className={styles.dailyActions}><button className={styles.outline} disabled={days.length<2||expired} onClick={()=>setSwap(true)}><Icon name="clock"/> جابه‌جایی روز</button>{attendance?.is_active?<button className={styles.danger} disabled={pending} onClick={()=>setFinish(true)}><Icon name="check"/> پایان تمرین</button>:<button className={styles.primary} disabled={pending||expired||!exercises.length} onClick={()=>void startWorkout()}><Icon name="play"/> {pending?"در حال شروع...":"شروع تمرین"}</button>}</div>
    <div className={styles.dailyChips}>{days.map((day,index)=>{const id=String(pick(day,"id","key")??index),active=id===String(pick(selected,"id","key")??0),items=listOf(day,"exercises","items","movements"),done=items.length>0&&items.every(isServerDone),rest=Boolean(day.is_rest_day)||(!items.length&&Boolean(pick(day,"rest_day","is_rest"))),parts=persianDayParts(pick(day,"date","workout_date","scheduled_for","day_date","start_date"),textOf(day,["title","name"],`روز ${fa(index+1)}`));return <button type="button" key={id} disabled={expired&&!active} className={`${active?styles.dailyChipActive:""} ${done?styles.dailyChipDone:""} ${rest?styles.dailyChipRest:""}`} onClick={()=>setDayId(id)}><b>{parts.weekday}</b><small>{rest?"روز استراحت":parts.date}</small></button>})}</div>
    {activeTimer&&activeTimerKey?<div className={`${styles.exerciseTimer} ${activeTimer.remaining<=10&&activeTimer.remaining>0?styles.timerWarning:""} ${activeTimer.done?styles.timerDone:""}`}><div className={styles.timerControls}><button type="button" onClick={()=>setDaily(current=>{const timers={...current.timers};delete timers[activeTimerKey];return{...current,timers}})} aria-label="بستن زمان‌سنج">×</button><button type="button" onClick={()=>changeTimer(activeTimerKey,"reset")} aria-label="شروع دوباره">↺</button><button type="button" onClick={()=>changeTimer(activeTimerKey,"toggle")} aria-label={activeTimer.running?"توقف زمان‌سنج":"ادامه زمان‌سنج"}>{activeTimer.running?"Ⅱ":"▶"}</button></div><p><b>{activeTimer.done?"تموم شد — ست بعدی!":"استراحت بین ست‌ها"}</b><small>{textOf(activeTimerExercise,["name","exercise_name","title"],"حرکت تمرینی")}</small></p><div className={styles.timerDial} style={{"--timer-progress":`${clampPercent(activeTimer.remaining,activeTimer.total)}%`} as React.CSSProperties}><strong>{timerText(activeTimer.remaining)}</strong></div></div>:null}
    {restDay?<div className={styles.dailyRestDay}><span>🌿</span><b>امروز روز استراحت است</b><p>ریکاوری، آب کافی و خواب باکیفیت را جدی بگیر.</p></div>:<section className={styles.dailyList}>{exercises.map((exercise,exerciseIndex)=>{const key=exerciseKey(exercise,exerciseIndex),sets=setCount(exercise),done=Array.from({length:sets},(_,index)=>setDone(exercise,index,exerciseIndex)).every(Boolean),open=daily.expanded[key]??exerciseIndex===0,name=textOf(exercise,["name","exercise_name","title"],"حرکت تمرینی"),note=textOf(exercise,["note","notes","coach_note"]),alternative=textOf(exercise,["alternative","alternative_name"]),muscle=textOf(exercise,["muscle","muscle_group","target_muscle"]),warmup=textOf(exercise,["warmup","warm_up","warmup_note"]),previous=bestRecord(name),todayBest=heaviestSet(exercise,key),timer=daily.timers[key],superset=textOf(exercise,["superset_name","superset_with_name","paired_exercise_name"],pick(exercise,"superset_with","superset_id")?"حرکت بعدی":"");return <article className={`${styles.dailyAccordion} ${done?styles.dailyAccordionDone:""}`} key={key}><button type="button" className={styles.dailyAccordionHead} aria-expanded={open} onClick={event=>{event.preventDefault();setDaily(current=>({...current,expanded:{...current.expanded,[key]:!open}}))}}><span>{done?<Icon name="check" size={18}/>:fa(exerciseIndex+1)}</span><p><b>{name}</b><small>{fa(sets)} ست × {fa(pick(exercise,"reps","repetitions")??"-")} تکرار {superset?"· سوپرست":""}</small></p><em className={styles.accordionChevron}>⌄</em></button>{open?<div className={styles.dailyAccordionBody}>{muscle||warmup?<div className={styles.dailyTags}>{muscle?<span>{muscle}</span>:null}{warmup?<span>گرم‌کردن: {warmup}</span>:null}</div>:null}{note?<p className={styles.coachNote}><Icon name="coach" size={15}/>{note}</p>:null}{superset?<p className={styles.supersetLink}>بدون استراحت با <b>{superset}</b></p>:null}<div className={styles.setList}>{Array.from({length:sets},(_,setIndex)=>{const checked=setDone(exercise,setIndex,exerciseIndex),detail=setDetail(exercise,setIndex),reps=pick(detail,"reps","repetitions")??pick(exercise,"reps","repetitions")??"-",planned=plannedWeight(exercise,setIndex),logged=setWeight(key,setIndex),loggedValue=parseWeight(logged),isRecord=loggedValue>0&&loggedValue===todayBest&&loggedValue>=previous,type=setType(exercise,setIndex);return <label className={checked?styles.setDone:""} key={setIndex}><input type="checkbox" checked={checked} disabled={pendingExercise===key||expired} onChange={event=>{event.preventDefault();void toggleSet(exercise,setIndex,exerciseIndex)}}/><b>{fa(setIndex+1)}</b><span><em className={type==="گرم‌کردن"?styles.setTypeWarm:type==="اصلی"?styles.setTypeWork:styles.setTypeDanger}>{type}</em></span><small><b>{fa(reps)}</b> تکرار</small><span className={`${styles.setWeightField} ${isRecord?styles.setWeightRecord:""}`}><input className={styles.setWeightInput} type="text" inputMode="decimal" autoComplete="off" value={logged} placeholder={planned!==undefined?fa(planned):"وزنه"} disabled={expired||pendingExercise===key} aria-label={`وزنه ست ${fa(setIndex+1)} حرکت ${name} به کیلوگرم`} title={planned!==undefined?`وزنه پیشنهادی مربی: ${fa(planned)} کیلوگرم`:"وزنه این ست را ثبت کن"} onClick={event=>event.stopPropagation()} onChange={event=>writeWeight(key,setIndex,event.target.value)}/><em>{isRecord?"رکورد":"کیلوگرم"}</em></span></label>})}</div>{!activeTimer&&timer?<div className={`${styles.exerciseTimer} ${timer.remaining<=10&&timer.remaining>0?styles.timerWarning:""} ${timer.done?styles.timerDone:""}`}><p><Icon name="clock"/><b>{timer.done?"استراحت تمام شد":`${fa(Math.floor(timer.remaining/60))}:${String(timer.remaining%60).padStart(2,"0")}`}</b><small>استراحت {name}</small></p><div><button onClick={()=>changeTimer(key,"toggle")}>{timer.running?"توقف":"ادامه"}</button><button onClick={()=>changeTimer(key,"reset")}>از نو</button><button onClick={()=>changeTimer(key,"skip")}>رد کردن</button></div></div>:null}<div className={styles.dailyExerciseTools}><span className={styles.exercisePr}><small>رکورد شخصی</small><b>{previous>0?`${fa(previous)} کیلوگرم`:"ثبت نشده"}</b></span><span className={`${styles.exercisePr} ${todayBest>0&&todayBest>=previous?styles.exercisePrHit:""}`}><small>سنگین‌ترین ست امروز</small><b>{todayBest>0?`${fa(todayBest)} کیلوگرم`:"ثبت نشده"}</b></span><small>وزنه هر ست را جداگانه ثبت کن؛ سنگین‌ترین وزنه به‌عنوان رکورد جدید ذخیره می‌شود.</small>{alternative?<small>جایگزین: {alternative}</small>:null}{pick(exercise,"media_url","video_url","media")?<button onClick={()=>setVideo(exercise)}><Icon name="play" size={14}/> فیلم آموزشی</button>:null}</div></div>:null}</article>})}</section>}
    {allDone&&!daily.celebrations.workout?<div className={styles.dailyCelebration}><span>🎉</span><p><b>تمرین امروز کامل شد!</b><small>تمام ست‌ها را با موفقیت انجام دادی.</small></p><div><button className={styles.celebrationUndo} disabled={pendingExercise!==null} onClick={()=>{const last=exercises.at(-1);if(last)void toggleSet(last,setCount(last)-1,exercises.length-1)}}>لغو آخرین ست</button><button onClick={()=>setDaily(current=>({...current,celebrations:{...current.celebrations,workout:true}}))}>ادامه</button></div></div>:null}
    {video?<VideoDialog item={video} close={()=>setVideo(null)}/>:null}{swap?<SwapDialog days={days} close={()=>setSwap(false)} saved={()=>{setSwap(false);void reload()}}/>:null}{finish?<WorkoutFinishDialog day={selected??{}} exercises={exercises} pending={pending} close={()=>setFinish(false)} finish={()=>void finishWorkout()}/>:null}{recordSuccess?<RecordSuccessDialog record={recordSuccess} close={()=>setRecordSuccess(null)}/>:null}
  </div>;
}

function VideoDialog({ item, close }: { item: Json; close: () => void }) { const url = String(item.media_url ?? item.video_url ?? ""); return <Dialog title="ویدیوی آموزشی حرکت" close={close}><div className={styles.videoFrame}><video src={url} controls autoPlay={false}/></div><p className={styles.dialogNote}>{String(item.note ?? item.notes ?? "حرکت را دقیق و کنترل‌شده انجام بده.")}</p><div className={styles.videoActions}><button className={styles.primary} onClick={close}>متوجه شدم</button><button className={styles.outline} onClick={close}>بستن ویدئو</button></div></Dialog>; }

function WorkoutFinishDialog({ day, exercises, pending, close, finish }: { day: Json; exercises: Json[]; pending: boolean; close: () => void; finish: () => void }) { return <Dialog title="پایان تمرین" close={close}><div className={styles.workoutFinish}><p>آیا از ثبت پایان تمرین امروز مطمئن هستی؟</p><div><span className={styles.workoutPlanIcon}><Icon name="workout"/></span><p><b>{String(day.title ?? day.name ?? "تمرین امروز")}</b><small>{fa(exercises.length)} حرکت برای امروز</small></p></div><div className={styles.workoutFinishStats}><span>{fa(exercises.reduce((sum, item) => sum + Number(item.sets ?? 0), 0))} ست</span><span>{fa(exercises.length)} حرکت</span></div><div className={styles.dialogButtons}><button className={styles.outline} onClick={close}>انصراف</button><button className={styles.primary} disabled={pending} onClick={finish}>{pending ? "در حال ثبت..." : "تایید و پایان تمرین"}</button></div></div></Dialog>; }

function RecordSuccessDialog({ record, close }: { record: { name: string; value: number }; close: () => void }) { return <Dialog title="رکورد جدید" close={close}><div className={styles.recordSuccess}><span><Icon name="achievements" size={34}/></span><b>تبریک! رکورد جدید ثبت شد</b><p>رکورد {record.name} با وزن {fa(record.value)} کیلوگرم برای شما ثبت شد.</p><button className={styles.primary} onClick={close}>متوجه شدم</button></div></Dialog>; }

function SwapDialog({ days, close, saved }: { days: Json[]; close: () => void; saved: () => void }) { const [first,setFirst]=useState(String(days[0]?.id ?? "")); const [second,setSecond]=useState(String(days[1]?.id ?? "")); const [pending,setPending]=useState(false); const submit=async(e:React.FormEvent)=>{e.preventDefault();setPending(true);try{await api("/me/workout/swap/",{method:"POST",body:JSON.stringify({day_a:Number(first),day_b:Number(second)})});saved();}finally{setPending(false)}}; return <Dialog title="جابه‌جایی روز" close={close}><form className={styles.dialogForm} onSubmit={submit}><p className={styles.swapHint}>روزهایی که می‌خواهی جای آن‌ها عوض شود انتخاب کن.</p><div className={styles.swapChoices}>{days.map((day,index)=><button type="button" key={String(day.id)} className={first===String(day.id)||second===String(day.id)?styles.swapSelected:""} onClick={()=>{const id=String(day.id);if(first===id)setFirst("");else if(second===id)setSecond("");else if(!first)setFirst(id);else setSecond(id)}}><span>{first===String(day.id)||second===String(day.id)?<Icon name="check"/>:null}</span><p><b>{String(day.title??day.name??"روز تمرین")}</b><small>روز {fa(index+1)}</small></p></button>)}</div><div className={styles.dialogButtons}><button type="button" className={styles.outline} onClick={close}>انصراف</button><button className={styles.primary} disabled={pending||!first||!second||first===second}>{pending?"در حال ثبت...":"تایید جابه‌جایی"}</button></div></form></Dialog>; }

function Nutrition({ data, user, go, reload }: { data: Json; user: User; go: (view: View) => void; reload: () => Promise<void> }) {
  const plan=object(data.plan),baseCurrent=object(data.today),adherence=object(data.adherence),completions=rows(data.completions);
  const [selectedDate,setSelectedDate]=useState(today()),[dayData,setDayData]=useState(baseCurrent),[dayLoading,setDayLoading]=useState(false),[pendingMeal,setPendingMeal]=useState<string|null>(null),[pendingFood,setPendingFood]=useState<string|null>(null),[newPlan,setNewPlan]=useState(false),[daily,setDaily]=useState<PanelDailyState>(EMPTY_DAILY_STATE),[actionError,setActionError]=useState("");
  useEffect(()=>{setDayData(object(data.today))},[data.today]); useEffect(()=>{if(plan.is_new===true||plan.requires_confirmation===true||data.new_plan===true)setNewPlan(true)},[data.new_plan,plan.is_new,plan.requires_confirmation]);
  const selectDay=async(value:string)=>{setSelectedDate(value);setActionError("");if(value===today()){setDayData(baseCurrent);return}setDayLoading(true);try{setDayData(await api<Json>(`/me/nutrition/today/?date=${encodeURIComponent(value)}`))}catch{setActionError("اطلاعات این روز دریافت نشد. دوباره تلاش کن.")}finally{setDayLoading(false)}};
  const current=dayData,target=Object.keys(object(data.target)).length?object(data.target):object(current.target),sourceMeals=listOf(current,"meals","meal_plans").length?listOf(current,"meals","meal_plans"):listOf(plan,"meals","meal_plans"),supplementMeals=sourceMeals.filter(meal=>textOf(meal,["kind","meal_type"]).toLowerCase()==="supplement"),meals=sourceMeals.filter(meal=>textOf(meal,["kind","meal_type"]).toLowerCase()!=="supplement"),currentSupplements=listOf(current,"supplements"),planSupplements=listOf(plan,"supplements"),supplements=currentSupplements.length?currentSupplements:planSupplements.length?planSupplements:supplementMeals.flatMap(meal=>listOf(meal,"items","foods","food_items")),storageKey=panelStorageKey("nutrition",pick(plan,"id","key"),selectedDate),editable=selectedDate===today(),selectedCompletions=completions.filter(item=>!pick(item,"completed_on","date")||String(pick(item,"completed_on","date")).slice(0,10)===selectedDate),completionByItem=new Map(selectedCompletions.filter(item=>item.done!==false).map(item=>[String(pick(item,"item","item_id","food_item")),item])),week=nutritionWeek(rows(adherence.series)),expired=planExpired(plan);
  useEffect(()=>setDaily(readPanelState(storageKey)),[storageKey]);useEffect(()=>persistPanelState(storageKey,daily),[storageKey,daily]);
  const foodKey=(item:Json,mealIndex=0,itemIndex=0)=>`${stableKey("meal",meals[mealIndex],mealIndex)}:${stableKey("food",item,itemIndex)}`,foodDone=(item:Json,mealIndex:number,itemIndex:number)=>completionByItem.has(String(pick(item,"id","item_id")))||Boolean(daily.foods[foodKey(item,mealIndex,itemIndex)]),itemCalories=(item:Json)=>itemNutrition(item).calories??0,calorieTargetSources=[target,object(target.macros),object(target.nutrients)],targetCalories=calorieTargetSources.map(source=>nutritionNumber(source,["calorie_target","calories_target","calories_goal","calorie_goal","daily_calories","target_calories","calories","kcal"])).find(value=>value!==null)??0;
  const consumed=meals.reduce((sum,meal,mealIndex)=>sum+listOf(meal,"items","foods","food_items").reduce((inner,item,itemIndex)=>inner+(foodDone(item,mealIndex,itemIndex)?itemCalories(item):0),0),0),allCalories=meals.reduce((sum,meal)=>sum+listOf(meal,"items","foods","food_items").reduce((inner,item)=>inner+itemCalories(item),0),0),calorieProgress=targetCalories?clampPercent(consumed,targetCalories):allCalories?clampPercent(consumed,allCalories):0;
  const targetSources=[target,object(target.macros),object(target.nutrients)],targetValue=(keys:string[])=>targetSources.map(source=>nutritionNumber(source,keys)).find(value=>value!==null)??0,targetAliases:Record<Exclude<NutrientKey,"calories">,string[]>={protein:["protein_target","protein_target_g","protein_goal","daily_protein","daily_protein_g","target_protein","target_protein_g","protein_g","protein_grams","protein"],carbs:["carbs_target","carbs_target_g","carb_target","carb_target_g","carbohydrate_target","carbs_goal","carb_goal","daily_carbs","daily_carbs_g","daily_carb","target_carbs","target_carbs_g","target_carb","target_carb_g","carb_g","carbs_g","carb_grams","carbs","carb","carbohydrate","carbohydrates"],fat:["fat_target","fat_target_g","fats_target","fat_goal","daily_fat","daily_fat_g","target_fat","target_fat_g","fat_g","fat_grams","fat","fats"]},macro=(name:Exclude<NutrientKey,"calories">)=>{const resolvedTarget=targetValue(targetAliases[name]),currentValue=meals.reduce((sum,meal,mealIndex)=>sum+listOf(meal,"items","foods","food_items").reduce((inner,item,itemIndex)=>inner+(foodDone(item,mealIndex,itemIndex)?(itemNutrition(item)[name]??0):0),0),0),percentage=resolvedTarget>0?clampPercent(currentValue,resolvedTarget):0;return{target:resolvedTarget,current:Math.round(currentValue*10)/10,percentage}},macros=([{label:"پروتئین",name:"protein",tone:"protein"},{label:"کربوهیدرات",name:"carbs",tone:"carbs"},{label:"چربی",name:"fat",tone:"fat"}] as const).map(item=>({...item,...macro(item.name)}));
  const mealItems=(meal:Json)=>listOf(meal,"items","foods","food_items"),mealDone=(meal:Json,mealIndex:number)=>{const items=mealItems(meal);return items.length>0&&items.every((item,itemIndex)=>foodDone(item,mealIndex,itemIndex))};
  const toggleFood=async(item:Json,mealIndex:number,itemIndex:number)=>{if(!editable||expired)return;const key=foodKey(item,mealIndex,itemIndex),itemId=String(pick(item,"id","item_id")),completion=completionByItem.get(itemId),before=daily;setPendingFood(key);setActionError("");if(completion){setDaily(current=>({...current,foods:{...current.foods,[key]:false}}));try{await api(`/me/meal-completions/${Number(completion.id)}/`,{method:"DELETE"});await reload()}catch{setDaily(before);setActionError("لغو ثبت ماده غذایی انجام نشد.")}finally{setPendingFood(null)}return}setDaily(current=>({...current,foods:{...current.foods,[key]:!current.foods[key]}}));setPendingFood(null)};
  const markMeal=async(meal:Json,mealIndex:number)=>{if(!editable||expired)return;const items=mealItems(meal),done=mealDone(meal,mealIndex),mealKey=stableKey("meal",meal,mealIndex),before=daily;setPendingMeal(mealKey);setActionError("");try{if(done){const saved=items.map(item=>completionByItem.get(String(pick(item,"id","item_id")))).filter(Boolean);if(saved.length)await Promise.all(saved.map(item=>api(`/me/meal-completions/${Number(item?.id)}/`,{method:"DELETE"})));setDaily(current=>({...current,foods:{...current.foods,...Object.fromEntries(items.map((item,itemIndex)=>[foodKey(item,mealIndex,itemIndex),false]))}}))}else{const id=pick(meal,"id","meal_id");if(id!==undefined)await api("/me/meal-completions/bulk/",{method:"POST",body:JSON.stringify({meal_id:Number(id),date:selectedDate,done:true})});setDaily(current=>({...current,foods:{...current.foods,...Object.fromEntries(items.map((item,itemIndex)=>[foodKey(item,mealIndex,itemIndex),true]))}}))}await reload()}catch{setDaily(before);setActionError("ثبت وعده انجام نشد؛ وضعیت قبلی بازیابی شد.")}finally{setPendingMeal(null)}};
  const completedMeals=meals.filter(mealDone).length,allDone=meals.length>0&&completedMeals===meals.length,durationWeeks=planDurationWeeks(plan,object(plan.plan),object(current.plan),current,data);
  const durationMeta=<div className={styles.dailyHeroMeta}><span className={styles.planDurationDark}><Icon name="calendar" size={12}/> مدت زمان: {durationText(durationWeeks)}</span><span>هفته {fa(pick(plan,"current_week","week")??1)}{durationWeeks>0?` از ${fa(durationWeeks)}`:""}</span></div>;
  if(!meals.length&&!supplements.length)return <div className={styles.dailyPanel}><DailyHeader kind="nutrition" user={user} go={go} title="برنامه غذایی" eyebrow={`امروز · ${date(selectedDate)}`} detail="هنوز برنامه غذایی فعالی نداری." progress={0} ringLabel={<><b>۰٪</b><small>کالری</small></>}/><Empty title={expired?"برنامه غذایی منقضی شده است":"برنامه غذایی فعالی نداری"} text="پس از ارسال برنامه توسط مربی، وعده‌ها و ردیاب روزانه اینجا نمایش داده می‌شوند."/>{newPlan?<NutritionPlanDialog plan={plan} close={()=>setNewPlan(false)} accept={()=>{if(plan.id)localStorage.setItem("gymplus_seen_nutrition_plan",String(plan.id));setNewPlan(false)}}/>:null}</div>;
  return <div className={styles.dailyPanel}>
    <DailyHeader kind="nutrition" user={user} go={go} title={textOf(plan,["title","name"],"برنامه غذایی روزانه")} eyebrow={`تغذیه ${editable?"امروز":"روز انتخاب‌شده"} · ${date(selectedDate)}`} detail={`${fa(completedMeals)} از ${fa(meals.length)} وعده تکمیل شده`} meta={durationMeta} progress={calorieProgress} streak={numberOf(data,["streak","nutrition_streak","consecutive_days"])} ringLabel={<><b>{targetCalories?fa(consumed):`${fa(calorieProgress)}٪`}</b><small>{targetCalories?`از ${fa(targetCalories)} کالری`:"کالری ثبت‌شده"}</small></>}/>
    {!editable?<div className={styles.dailyBanner}><Icon name="calendar"/> روزهای گذشته فقط برای مشاهده هستند.</div>:null}{Boolean(plan.is_new)||Boolean(plan.requires_confirmation)?<div className={styles.dailyBanner}><Icon name="bell"/> برنامه غذایی جدید آماده بررسی است.</div>:null}{actionError?<div className={styles.dailyError}><span>{actionError}</span><button onClick={()=>void selectDay(selectedDate)}>تلاش دوباره</button></div>:null}
    <div className={styles.nutritionWeek}>{week.map(item=><button type="button" key={item.date} className={`${item.date===selectedDate?styles.nutritionDayActive:""} ${item.done?styles.nutritionDayDone:""} ${item.partial?styles.nutritionDayPartial:""}`} onClick={()=>void selectDay(item.date)}><b>{item.label}</b><span>{item.date===today()?"امروز":item.done?"انجام شد":item.partial?"ناقص":"روز دیگر"}</span></button>)}</div>
    <section className={styles.nutritionOverview}><div className={styles.macroBars}>{macros.map(item=><div key={item.name}><p><span>{item.label}</span><b>{item.target>0?`${fa(item.current)} / ${fa(item.target)} گرم · ${fa(item.percentage)}٪`:item.current>0?`${fa(item.current)} گرم · هدف ثبت نشده`:"ثبت نشده"}</b></p><i><em className={styles[`macro_${item.tone}`]??""} style={{width:`${item.percentage}%`}}/></i></div>)}</div><div className={styles.trackerGrid}><section className={`${styles.trackerCard} ${styles.waterTracker}`}><header><p><b>آب روزانه</b><small>{fa(daily.water)} از ۱۰ لیوان</small></p><span aria-hidden="true">💧</span></header><div className={styles.waterGrid}>{Array.from({length:10},(_,index)=><button key={index} type="button" disabled={!editable||expired} className={index<daily.water?styles.trackerOn:""} onClick={()=>setDaily(current=>({...current,water:index<current.water?index:index+1}))} aria-pressed={index<daily.water} aria-label={`لیوان آب ${fa(index+1)}`}>💧</button>)}</div></section><section className={`${styles.trackerCard} ${styles.supplementTracker}`}><header><p><b>مکمل‌های روزانه</b><small>{supplements.length?`${fa(supplements.length)} مورد طبق برنامه مربی`:"موردی ثبت نشده"}</small></p></header>{supplements.length?<div className={styles.supplementList}>{supplements.map((item,index)=>{const key=stableKey("supplement",item,index),checked=Boolean(daily.supplements[key]),amount=pick(item,"amount_g","amount","quantity","grams","dose"),unit=textOf(item,["unit_name","unit"],amount!==undefined?"گرم":""),note=textOf(item,["note","description","timing","time"]),detail=[amount!==undefined?`${fa(amount)} ${unit}`.trim():"",note].filter(Boolean).join(" · ");return <label key={key}><input type="checkbox" checked={checked} disabled={!editable||expired} onChange={()=>setDaily(current=>({...current,supplements:{...current.supplements,[key]:!checked}}))}/><span><b>{textOf(item,["name","food_name","title"],"مکمل")}</b><small>{detail||"طبق برنامه مربی"}</small></span></label>})}</div>:<p className={styles.supplementEmpty}>مکملی برای این روز در برنامه ثبت نشده است.</p>}</section></div></section>
    <section className={styles.dailyList}>{dayLoading?<Loading/>:meals.map((meal,mealIndex)=>{const items=mealItems(meal),done=mealDone(meal,mealIndex),mealKey=stableKey("meal",meal,mealIndex),open=daily.expanded[mealKey]!==false,calories=items.reduce((sum,item)=>sum+itemCalories(item),0),note=textOf(meal,["note","description","coach_note"]);return <article className={`${styles.dailyAccordion} ${done?styles.dailyAccordionDone:""}`} key={mealKey}><button className={styles.dailyAccordionHead} aria-expanded={open} onClick={()=>setDaily(current=>({...current,expanded:{...current.expanded,[mealKey]:!open}}))}><span>{mealIcon(textOf(meal,["kind","meal_type"]))}</span><p><b>{textOf(meal,["name","title"],mealLabel(textOf(meal,["kind","meal_type"])))}</b><small>{fa(items.filter((item,itemIndex)=>foodDone(item,mealIndex,itemIndex)).length)} از {fa(items.length)} مورد · {calories?`${fa(calories)} کالری`:"کالری ثبت نشده"}</small></p><em>{open?"⌃":"⌄"}</em></button>{open?<div className={styles.dailyAccordionBody}><div className={styles.foodList}>{items.map((item,itemIndex)=>{const key=foodKey(item,mealIndex,itemIndex),checked=foodDone(item,mealIndex,itemIndex),alternative=textOf(item,["alternative","alternative_name"]),nutrition=itemNutrition(item),amount=pick(item,"amount_g","grams","amount","quantity"),unit=textOf(item,["unit_name","unit"],pick(item,"amount_g")!==undefined?"گرم":""),macroDetail=[nutrition.protein!==null?`پروتئین ${fa(nutrition.protein)}`:"پروتئین -",nutrition.carbs!==null?`کربوهیدرات ${fa(nutrition.carbs)}`:"کربوهیدرات -",nutrition.fat!==null?`چربی ${fa(nutrition.fat)}`:"چربی -"].join(" · ");return <label className={checked?styles.foodDone:""} key={key}><input type="checkbox" checked={checked} disabled={!editable||expired||pendingFood===key} onChange={()=>void toggleFood(item,mealIndex,itemIndex)}/><p><b>{textOf(item,["name","food_name","title"],"ماده غذایی")}</b><small>{fa(amount??"-")} {unit}{alternative?` · جایگزین: ${alternative}`:""}</small><em>{macroDetail} گرم</em></p><span>{nutrition.calories!==null?`${fa(nutrition.calories)} کالری`:"-"}</span></label>})}</div>{note?<p className={styles.coachNote}><Icon name="coach" size={15}/>{note}</p>:null}<button className={styles.mealComplete} disabled={!editable||expired||pendingMeal===mealKey} onClick={()=>void markMeal(meal,mealIndex)}>{pendingMeal===mealKey?"در حال ثبت...":done?"لغو ثبت وعده":"ثبت مصرف وعده"}</button></div>:null}</article>})}</section>
    {allDone&&!daily.celebrations.nutrition?<div className={styles.dailyCelebration}><span>🌟</span><p><b>برنامه غذایی امروز کامل شد!</b><small>همه وعده‌های امروز را ثبت کردی.</small></p><div><button className={styles.celebrationUndo} disabled={pendingMeal!==null} onClick={()=>{const last=meals.at(-1);if(last)void markMeal(last,meals.length-1)}}>لغو آخرین وعده</button><button onClick={()=>setDaily(current=>({...current,celebrations:{...current.celebrations,nutrition:true}}))}>ادامه</button></div></div>:null}{newPlan?<NutritionPlanDialog plan={plan} close={()=>setNewPlan(false)} accept={()=>{if(plan.id)localStorage.setItem("gymplus_seen_nutrition_plan",String(plan.id));setNewPlan(false)}}/>:null}
  </div>;
}

function nutritionWeek(series: Json[]) { const labels = ["شنبه","یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه"]; const now = new Date(); const saturday = new Date(now); saturday.setDate(now.getDate() - ((now.getDay() + 1) % 7)); return labels.map((label,index)=>{const day=new Date(saturday);day.setDate(saturday.getDate()+index);const value=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,"0")}-${String(day.getDate()).padStart(2,"0")}`;const entry=series.find(item=>String(item.date??item.day??"").slice(0,10)===value)??{};const completed=Number(entry.completed??entry.done??entry.completed_count??0);const total=Number(entry.total??entry.total_count??0);const pct=Number(entry.pct??entry.percentage??(total?completed/total*100:0));return {date:value,label,done:(total>0&&completed>=total)||pct>=100,partial:completed>0||pct>0}}); }

function NutritionPlanDialog({plan,close,accept}:{plan:Json;close:()=>void;accept:()=>void}) { return <Dialog title="برنامه جدید" close={close}><div className={styles.newNutritionPlan}><p>مربی شما برنامه غذایی جدیدی برایتان آماده کرده است. آیا برنامه جدید را تأیید و جایگزین می‌کنید؟</p><div><span className={styles.nutritionPlanIcon}><Icon name="nutrition"/></span><p><b>{String(plan.title??"برنامه غذایی جدید")}</b><small>{String(plan.goal??"")}</small></p><em>● فعال</em></div><div className={styles.newNutritionMeta}><span><Icon name="coach"/><b>{String(plan.coach_name??"مربی")}</b><small>مربی</small></span><span><Icon name="calendar"/><b>{date(plan.sent_at??plan.start_date)}</b><small>تاریخ شروع</small></span><span><Icon name="calendar"/><b>{date(plan.expires_at)}</b><small>تاریخ پایان</small></span></div><div className={styles.dialogButtons}><button className={styles.outline} onClick={close}>انصراف</button><button className={styles.primary} onClick={accept}>تأیید و جایگزینی</button></div></div></Dialog>; }

function mealIcon(kind:string){return ({breakfast:"☕",morning_snack:"🍏",lunch:"🍽",afternoon_snack:"🥜",dinner:"🥗",post_workout:"⚡",supplement:"＋"} as Record<string,string>)[kind]??"🍽"}
function mealLabel(kind:string){return ({breakfast:"صبحانه",morning_snack:"میان‌وعده صبح",lunch:"ناهار",afternoon_snack:"عصرانه",dinner:"شام",post_workout:"بعد از تمرین",supplement:"مکمل"} as Record<string,string>)[kind]??"وعده غذایی"}
function Financial({data}:{data:Json}){
  const invoices=rows(data.invoices);
  const pending=rows(data.pending);
  const payments=rows(data.payments);
  const overdue=pending.filter(item=>String(item.status)==="overdue"||Number(item.days_overdue??0)>0);
  const upcoming=pending.filter(item=>!overdue.includes(item));
  const overdueDebt=overdue.reduce((sum,item)=>sum+Number(item.outstanding??item.payable??item.amount??0),0);
  const upcomingAmount=upcoming.reduce((sum,item)=>sum+Number(item.outstanding??item.payable??item.amount??0),0);
  const paidTotal=payments.reduce((sum,item)=>sum+Number(item.amount??0),0);
  const nextInvoice=[...pending].sort((a,b)=>String(a.due_date??"").localeCompare(String(b.due_date??"")))[0];
  const [paying,setPaying]=useState<number|null>(null);
  const [paymentError,setPaymentError]=useState("");
  const pay=async(item:Json)=>{setPaying(Number(item.id));setPaymentError("");try{const result=await api<Json>(`/me/invoices/${item.id}/pay-online/`,{method:"POST"});const url=String(result.pay_url??result.payment_url??result.startpay_url??result.url??"");if(url){location.href=url;return}setPaymentError("آدرس درگاه پرداخت دریافت نشد.")}catch{setPaymentError("اتصال به درگاه پرداخت انجام نشد.")}finally{setPaying(null)}};
  return <div className={styles.financialPage}>
    <Card title="وضعیت مالی شما" action={<MoreButton/>} className={styles.financialStatusCard}>
      {overdueDebt>0?<div className={styles.financialDebtState}><span><Icon name="financial" size={34}/></span><p><b>{money(overdueDebt)} بدهی معوق</b><small>{fa(overdue.length)} فاکتور نیاز به پرداخت دارد.</small></p><button className={styles.primary} disabled={paying!==null} onClick={()=>void pay(overdue[0])}>{paying===Number(overdue[0]?.id)?"در حال اتصال...":"پرداخت بدهی"}</button></div>:<div className={styles.financialClearState}><span>💸</span><p>در حال حاضر بدهی ندارید!</p></div>}
      {paymentError?<p className={styles.financialError}>{paymentError}</p>:null}
    </Card>
    <Card title="مروری بر آمار" className={styles.financialOverview}>
      <div className={styles.financialStats}>
        <FinancialStat label="پرداخت‌های پیش رو" value={money(upcomingAmount)} hint={`${fa(upcoming.length)} مورد`}/>
        <FinancialStat label="بدهی" value={money(overdueDebt)} hint={overdue.length?`${fa(overdue.length)} مورد معوق`:"موردی وجود ندارد"}/>
        <FinancialStat label="کل پرداخت شده‌ها" value={money(paidTotal)} hint={`${fa(payments.length)} مورد`}/>
        <FinancialStat label="سررسید بعدی" value={nextInvoice?dueLabel(nextInvoice):"-"} hint={nextInvoice?date(nextInvoice.due_date):"سررسیدی وجود ندارد"}/>
      </div>
    </Card>
    <Card title="فاکتورهای من" action={<div className={styles.financialCardActions}><button className={styles.financialViewButton} aria-label="نمایش جدولی"><Icon name="card"/></button><MoreButton/></div>} className={styles.financialInvoicesCard}>
      {invoices.length?<FinancialInvoiceTable items={invoices} paying={paying} pay={pay}/>:<Empty title="فاکتوری ندارید" text="فاکتورهای خدمات و عضویت شما در این بخش نمایش داده می‌شوند."/>}
    </Card>
  </div>
}

function FinancialStat({label,value,hint}:{label:string;value:string;hint:string}){return <article><header><span>{label}</span><MoreButton/></header><strong>{value}</strong><small>{hint}</small></article>}
function dueLabel(item:Json){const days=Number(item.days_until_due??0);if(days<0)return `${fa(Math.abs(days))} روز گذشته`;if(days===0)return "امروز";return `${fa(days)} روز دیگر`}
function financialCategory(item:Json){if(item.category_name)return String(item.category_name);if(String(item.kind)==="subscription")return "شهریه ماهانه";return String(rows(item.items)[0]?.category_name??"خدمات")}
function FinancialInvoiceTable({items,paying,pay}:{items:Json[];paying:number|null;pay:(item:Json)=>Promise<void>}){return <div className={styles.financialTable}><div className={styles.financialTableHead}><span>سرویس</span><span>دسته‌بندی</span><span>مبلغ</span><span>سررسید</span><span>تأخیر</span><span>وضعیت</span><span>عملیات</span></div>{items.map((item,index)=><article key={String(item.id??index)}><b>{String(item.service_name??rows(item.items)[0]?.service_name??`فاکتور ${fa(item.id)}`)}</b><span>{financialCategory(item)}</span><strong>{money(String(item.status)==="paid"?item.amount:(item.outstanding??item.payable??item.amount))}</strong><span>{date(item.due_date)}</span><em className={Number(item.days_overdue??0)>0?styles.financialLate:""}>{Number(item.days_overdue??0)>0?`${fa(item.days_overdue)} روز`:"-"}</em><i className={`${styles.financialInvoiceStatus} ${styles[`invoice_${String(item.status)}`]??""}`}>{statusLabel(item.status)}</i>{String(item.status)!=="paid"?<button disabled={paying!==null} onClick={()=>void pay(item)}>{paying===Number(item.id)?"در حال اتصال...":"پرداخت"}</button>:<span className={styles.financialPaidMark}><Icon name="check"/> تسویه</span>}</article>)}</div>}
function statusLabel(value:unknown){return ({open:"بدهکار",partial:"نیمه پرداخت",overdue:"معوق",paid:"پرداخت شده",unpaid:"در انتظار پرداخت",pending:"در حال بررسی",failed:"ناموفق",cancelled:"لغو شده",canceled:"لغو شده"} as Record<string,string>)[String(value)]??String(value??"نامشخص")}
function Progress({data,reload}:{data:Json;reload:()=>Promise<void>}) {
  const summary=object(data.summary);
  const goal=object(data.goal);
  const history=rows(data.history).slice().sort((a,b)=>String(a.date??"").localeCompare(String(b.date??"")));
  const apiWeights=rows(data.weights);
  const weights=(apiWeights.length?apiWeights:rows(summary.weight_series)).slice().sort((a,b)=>String(a.logged_on??"").localeCompare(String(b.logged_on??"")));
  const [period,setPeriod]=useState<"week"|"month">("month");
  const [weightDialog,setWeightDialog]=useState(false);
  const [weightSaved,setWeightSaved]=useState(false);
  const days=period==="week"?7:30;
  const cutoff=new Date();
  cutoff.setDate(cutoff.getDate()-days);
  const selected=history.filter(item=>!item.date||new Date(String(item.date))>=cutoff);
  const visible=selected.length?selected:history.slice(-(period==="week"?7:30));
  const progressValues=metricValues(visible,"progress");
  const workoutValues=metricValues(visible,"stability");
  const nutritionValues=metricValues(visible,"nutrition");
  const currentProgress=lastMetric(progressValues);
  const currentWorkout=lastMetric(workoutValues);
  const currentNutrition=lastMetric(nutritionValues);
  const currentWeight=nullableNumber(summary.current_weight??weights.at(-1)?.value);
  const previousWeight=nullableNumber(weights.at(-2)?.value);
  const periodLabel=period==="week"?"هفته":"ماه";
  const workoutHint=goal.workouts_done!=null&&goal.target_workouts!=null?`${fa(goal.workouts_done)} جلسه از ${fa(goal.target_workouts)} جلسه`:`${fa(summary.workout_count)} جلسه ثبت‌شده`;
  return <div className={styles.progressPage}>
    <Card title="مروری بر آمار" action={<div className={styles.progressPeriod}><button className={period==="week"?styles.progressPeriodActive:""} onClick={()=>setPeriod("week")}>هفتگی</button><button className={period==="month"?styles.progressPeriodActive:""} onClick={()=>setPeriod("month")}>ماهانه</button></div>} className={styles.progressOverview}>
      <div className={styles.progressStats}>
        <ProgressStat title="شاخص پیشرفت کلی" value={currentProgress} suffix="" delta={metricDelta(progressValues)} period={periodLabel} accent="blue"/>
        <ProgressStat title="پایبندی تمرین" value={currentWorkout} suffix="٪" hint={workoutHint}/>
        <ProgressStat title="پایبندی تغذیه" value={currentNutrition} suffix="٪" hint="بر اساس وعده‌های ثبت‌شده"/>
        <ProgressStat title="وزن فعلی" value={currentWeight} suffix=" کیلوگرم" delta={currentWeight!=null&&previousWeight!=null?currentWeight-previousWeight:null} period={periodLabel} weight/>
      </div>
    </Card>
    <Card title="آمار و ارقام" action={<MoreButton/>} className={styles.progressFigures}>
      <div className={styles.progressCharts}>
        <ProgressChartCard title="شاخص پیشرفت کلی" value={currentProgress} delta={metricDelta(progressValues)} period={periodLabel}><ProgressLineChart items={visible} field="progress"/></ProgressChartCard>
        <ProgressChartCard title={`پایبندی تمرین ${period==="month"?"ماهانه":"هفتگی"}`} value={currentWorkout} suffix="٪" delta={metricDelta(workoutValues)} period={periodLabel}><ProgressBarChart values={workoutValues}/></ProgressChartCard>
        <ProgressChartCard title={`پایبندی تغذیه ${period==="month"?"ماهانه":"هفتگی"}`} value={currentNutrition} suffix="٪" delta={metricDelta(nutritionValues)} period={periodLabel}><ProgressBarChart values={nutritionValues}/></ProgressChartCard>
      </div>
    </Card>
    <Card title="نمودار روند وزن" action={<button className={styles.progressWeightButton} onClick={()=>setWeightDialog(true)}>ثبت وزن</button>} className={styles.progressWeightCard}>
      <WeightTrendChart items={weights}/>
    </Card>
    {weightDialog?<WeightDialog current={currentWeight} close={()=>setWeightDialog(false)} saved={async()=>{setWeightDialog(false);await reload();setWeightSaved(true)}}/>:null}
    {weightSaved?<WeightSuccess close={()=>setWeightSaved(false)}/>:null}
  </div>
}

function nullableNumber(value:unknown){if(value===null||value===undefined||value==="")return null;const number=Number(value);return Number.isFinite(number)?number:null}
function metricValues(items:Json[],field:string){return items.map(item=>nullableNumber(item[field])).filter((value):value is number=>value!==null)}
function lastMetric(values:number[]){return values.length?values.at(-1)??null:null}
function metricDelta(values:number[]){return values.length>1?values[values.length-1]-values[values.length-2]:null}
function ProgressStat({title,value,suffix,delta,period,hint,accent,weight=false}:{title:string;value:number|null;suffix:string;delta?:number|null;period?:string;hint?:string;accent?:string;weight?:boolean}){return <article className={styles.progressStat}><header><span>{title}</span><MoreButton/></header><div><strong className={accent?styles.progressBlue:""}>{value==null?"-":`${fa(value)}${suffix}`}</strong>{hint?<small>{hint}</small>:delta!=null?<small className={delta>=0?styles.progressUp:styles.progressDown}>{delta>=0?"↗":"↘"} {weight?`${fa(Math.abs(delta))} کیلوگرم`:`${fa(Math.abs(delta))}٪`} <em>نسبت به {period} پیش</em></small>:<small>اطلاعات مقایسه‌ای موجود نیست</small>}</div></article>}
function ProgressChartCard({title,value,suffix="",delta,period,children}:{title:string;value:number|null;suffix?:string;delta:number|null;period:string;children:React.ReactNode}){return <article className={styles.progressChartCard}><header><h3>{title}</h3><MoreButton/></header><div className={styles.progressChartValue}><strong>{value==null?"-":`${fa(value)}${suffix}`}</strong>{delta!=null?<small className={delta>=0?styles.progressUp:styles.progressDown}>{delta>=0?"↗":"↘"} {fa(Math.abs(delta))}٪ <em>نسبت به {period} پیش</em></small>:null}</div>{children}</article>}
function chartLabel(value:unknown){if(!value)return "";try{return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{month:"short"}).format(new Date(String(value)))}catch{return ""}}
function ProgressLineChart({items,field}:{items:Json[];field:string}){const pointsData=items.map(item=>({value:nullableNumber(item[field]),label:chartLabel(item.date)})).filter((item):item is {value:number;label:string}=>item.value!==null).slice(-7);if(!pointsData.length)return <div className={styles.progressChartEmpty}>داده‌ای برای نمایش ثبت نشده است.</div>;const values=pointsData.map(item=>item.value),max=Math.max(...values,1),min=Math.min(...values),range=Math.max(max-min,1);const points=values.map((value,index)=>`${values.length===1?300:index*600/(values.length-1)},${112-(value-min)/range*75}`).join(" ");return <div className={styles.progressMiniLine}><svg viewBox="0 0 600 140" preserveAspectRatio="none"><defs><linearGradient id="progressOrange" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff6a22" stopOpacity=".2"/><stop offset="1" stopColor="#ff6a22" stopOpacity="0"/></linearGradient></defs><polygon points={`0,125 ${points} 600,125`} fill="url(#progressOrange)"/><polyline points={points} fill="none" stroke="#ff6a22" strokeWidth="3"/>{values.map((value,index)=>{const [x,y]=points.split(" ")[index].split(",");return <circle key={index} cx={x} cy={y} r="5" fill="#ff6a22"/>})}</svg><div>{pointsData.map((item,index)=><span key={index}>{item.label}</span>)}</div></div>}
function ProgressBarChart({values}:{values:number[]}){const shown=values.slice(-7);if(!shown.length)return <div className={styles.progressChartEmpty}>داده‌ای برای نمایش ثبت نشده است.</div>;return <div className={styles.progressBars}>{shown.map((value,index)=><i key={index} className={value>=75?styles.progressBarGood:value>=50?styles.progressBarMedium:styles.progressBarLow} style={{height:`${Math.max(8,Math.min(100,value))}%`}}/>)}</div>}
function WeightTrendChart({items}:{items:Json[]}){const shown=items.map(item=>({value:nullableNumber(item.value??item.weight),label:date(item.logged_on)})).filter((item):item is {value:number;label:string}=>item.value!==null).slice(-15);if(!shown.length)return <div className={styles.progressWeightEmpty}><Icon name="progress" size={36}/><b>هنوز وزنی ثبت نشده است</b><span>با ثبت وزن، روند تغییرات شما در اینجا نمایش داده می‌شود.</span></div>;const values=shown.map(item=>item.value),max=Math.max(...values),min=Math.min(...values),range=Math.max(max-min,1),points=values.map((value,index)=>`${values.length===1?300:index*600/(values.length-1)},${150-(value-min)/range*105}`).join(" ");return <div className={styles.progressWeightChart}><svg viewBox="0 0 600 190" preserveAspectRatio="none"><defs><linearGradient id="progressWeight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#18a876" stopOpacity=".2"/><stop offset="1" stopColor="#18a876" stopOpacity="0"/></linearGradient></defs><polygon points={`0,170 ${points} 600,170`} fill="url(#progressWeight)"/><polyline points={points} fill="none" stroke="#18a876" strokeWidth="3"/></svg><div>{shown.map((item,index)=><span key={index}>{index%2===0||shown.length<8?item.label:""}</span>)}</div></div>}
function WeightDialog({current,close,saved}:{current:number|null;close:()=>void;saved:()=>Promise<void>}){const [pending,setPending]=useState(false);const [error,setError]=useState("");const submit=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();setPending(true);setError("");const form=new FormData(e.currentTarget);try{await api("/weights/",{method:"POST",body:JSON.stringify({value:Number(form.get("value")),logged_on:String(form.get("logged_on"))})});await saved()}catch{setError("ثبت وزن انجام نشد. دوباره تلاش کنید.")}finally{setPending(false)}};return <Dialog title="ثبت وزن" close={close}><form className={styles.weightDialogForm} onSubmit={submit}><label>وزن (کیلوگرم)<input name="value" type="number" min="20" max="400" step="0.1" defaultValue={current??""} placeholder="وزن خود را وارد کنید" required/></label><label>تاریخ ثبت<input name="logged_on" type="date" {...dateInputProps()} defaultValue={today()} required/></label>{error?<p className={styles.formError}>{error}</p>:null}<div className={styles.dialogButtons}><button type="button" className={styles.outline} onClick={close}>انصراف</button><button className={styles.primary} disabled={pending}>{pending?"در حال ثبت...":"ثبت"}</button></div></form></Dialog>}
function WeightSuccess({close}:{close:()=>void}){return <Dialog title="" close={close}><div className={styles.weightSuccess}><span><Icon name="progress" size={38}/></span><h3>وزنت ثبت شد!</h3><p>وزن جدید با موفقیت ثبت شد و نمودار روند وزن به‌روزرسانی شد.</p><button className={styles.primary} onClick={close}>مشاهده روند</button></div></Dialog>}
function Line({values}:{values:number[]}){if(!values.length)return <Empty title="داده کافی نیست" text="پس از ثبت چند رکورد، نمودار در این بخش ساخته می‌شود."/>;const max=Math.max(...values,1),min=Math.min(...values);const range=Math.max(max-min,1);const points=values.map((v,i)=>`${values.length===1?300:i*600/(values.length-1)},${150-(v-min)/range*110}`).join(" ");return <div className={styles.lineChart}><svg viewBox="0 0 600 180" preserveAspectRatio="none"><defs><linearGradient id="athleteLine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#36ad84" stopOpacity=".22"/><stop offset="1" stopColor="#36ad84" stopOpacity="0"/></linearGradient></defs><polygon points={`0,170 ${points} 600,170`} fill="url(#athleteLine)"/><polyline points={points} fill="none" stroke="#2daa7d" strokeWidth="3"/></svg></div>}

function Achievements({data}:{data:Json}){
  const records=rows(data.records);
  const achievements=rows(data.achievements);
  const endorsements=rows(data.endorsements);
  const [recordQuery,setRecordQuery]=useState("");
  const [badgeQuery,setBadgeQuery]=useState("");
  const [recordSort,setRecordSort]=useState<"default"|"newest"|"highest">("default");
  const [badgeSort,setBadgeSort]=useState<"default"|"progress"|"earned">("default");
  const [category,setCategory]=useState("all");
  const [visibleBadges,setVisibleBadges]=useState(6);
  const recordItems=records.filter(item=>String(item.exercise_name??"").includes(recordQuery.trim())).sort((a,b)=>recordSort==="newest"?String(b.achieved_on??"").localeCompare(String(a.achieved_on??"")):recordSort==="highest"?Number(b.value??0)-Number(a.value??0):0);
  const categories=Array.from(new Set(achievements.map(item=>String(item.category??"")).filter(Boolean)));
  const badgeItems=achievements.filter(item=>(category==="all"||String(item.category)===category)&&String(item.label??"").includes(badgeQuery.trim())).sort((a,b)=>badgeSort==="progress"?Number(b.progress_pct??0)-Number(a.progress_pct??0):badgeSort==="earned"?Number(Boolean(b.earned))-Number(Boolean(a.earned)):0);
  const empty=!records.length&&!achievements.length&&!endorsements.length;
  if(empty)return <div className={styles.achievementPage}><AchievementEmptyCard title="دستاوردها" icon="📜" text="فعلاً دستاوردی برات ثبت نشده!"/><AchievementEmptyCard title="نشان‌ها" icon="🏆" text="هنوز موفق به کسب نشانی نشدی!"/><AchievementEmptyCard title="تاییدیه‌های مربی" icon="💬" text="تا الان مربیت برات تاییدیه ثبت نکرده"/></div>;
  return <div className={styles.achievementPage}>
    <Card title="دستاوردها" action={<MoreButton/>} className={styles.achievementRecordsCard}>
      <AchievementTools query={recordQuery} setQuery={setRecordQuery} placeholder="جستجو حرکت..." value={recordSort} setValue={value=>setRecordSort(value as typeof recordSort)} options={[{value:"default",label:"پیش فرض"},{value:"newest",label:"جدیدترین"},{value:"highest",label:"بالاترین رکورد"}]}/>
      {recordItems.length?<div className={styles.achievementRecords}>{recordItems.map((item,index)=><article key={String(item.id??index)}><span className={styles.recordIcon}><Icon name="workout" size={23}/></span><p><b>{String(item.exercise_name??"رکورد تمرینی")}</b><small>{recordDateLabel(item.achieved_on)}</small></p><strong>{fa(item.value)} {String(item.unit??"")}</strong></article>)}</div>:<AchievementSectionEmpty text="رکوردی مطابق جستجوی شما پیدا نشد."/>}
    </Card>
    <Card title="نشان‌ها" action={<MoreButton/>} className={styles.achievementBadgesCard}>
      <AchievementTools query={badgeQuery} setQuery={setBadgeQuery} placeholder="جستجو نشان..." value={badgeSort} setValue={value=>setBadgeSort(value as typeof badgeSort)} options={[{value:"default",label:"پیش فرض"},{value:"progress",label:"بیشترین پیشرفت"},{value:"earned",label:"دریافت شده‌ها"}]}/>
      <div className={styles.achievementCategories}><button className={category==="all"?styles.achievementCategoryActive:""} onClick={()=>{setCategory("all");setVisibleBadges(6)}}>همه موارد</button>{categories.map(item=><button key={item} className={category===item?styles.achievementCategoryActive:""} onClick={()=>{setCategory(item);setVisibleBadges(6)}}>{achievementCategory(item)}</button>)}</div>
      {badgeItems.length?<><div className={styles.achievementBadges}>{badgeItems.slice(0,visibleBadges).map((item,index)=><AchievementBadge key={String(item.slug??index)} item={item}/>)}</div>{visibleBadges<badgeItems.length?<button className={styles.showMoreAchievements} onClick={()=>setVisibleBadges(value=>value+6)}>نمایش بیشتر <span>⌄</span></button>:null}</>:<AchievementSectionEmpty text="نشانی مطابق فیلتر انتخاب‌شده پیدا نشد."/>}
    </Card>
    <Card title="تاییدیه‌های مربی" action={<MoreButton/>} className={styles.achievementEndorsementsCard}>
      {endorsements.length?<div className={styles.achievementEndorsements}>{endorsements.map((item,index)=><article key={String(item.id??index)}><div className={styles.endorsementHead}><span className={styles.endorsementAvatar}><Icon name="coach" size={20}/></span><p><b>مربی {String(item.coach_name??"شما")}</b><small>درباره عملکرد شما</small></p><time>{date(item.created_at)}</time></div><div className={styles.endorsementText}><Icon name="card" size={15}/><span>«{String(item.text??"")}»</span></div></article>)}</div>:<AchievementSectionEmpty icon="💬" text="تا الان مربیت برات تاییدیه ثبت نکرده"/>}
    </Card>
  </div>
}
function AchievementEmptyCard({title,icon,text}:{title:string;icon:string;text:string}){return <Card title={title} action={<MoreButton/>} className={styles.achievementEmptyCard}><div><span>{icon}</span><p>{text}</p></div></Card>}
function AchievementSectionEmpty({text,icon}:{text:string;icon?:string}){return <div className={styles.achievementSectionEmpty}>{icon?<span>{icon}</span>:<Icon name="search" size={28}/>}<p>{text}</p></div>}
function AchievementTools({query,setQuery,placeholder,value,setValue,options}:{query:string;setQuery:(value:string)=>void;placeholder:string;value:string;setValue:(value:string)=>void;options:{value:string;label:string}[]}){return <div className={styles.achievementTools}><label><Icon name="search" size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={placeholder}/></label><div><Icon name="filter" size={17}/><select value={value} onChange={event=>setValue(event.target.value)}>{options.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</select></div></div>}
function AchievementBadge({item}:{item:Json}){const earned=item.earned!==false;const progress=Math.max(0,Math.min(100,Number(item.progress_pct??0)));const badgeIcon=String(item.icon??"");return <article className={earned?styles.badgeEarned:styles.badgeLocked}><div className={styles.badgeHead}><span className={styles.badgeIcon}>{badgeIcon&&Array.from(badgeIcon).length<=4?badgeIcon:<Icon name="achievements" size={26}/>}</span><p><b>{String(item.label??"نشان ورزشی")}</b><small>{badgeDescription(item)}</small></p><em>{item.earned_on?date(item.earned_on):"-"}</em></div><div className={styles.badgeProgress}><i><b style={{width:`${progress}%`}}/></i><span>{fa(progress)}٪</span></div></article>}
function achievementCategory(value:string){return ({workout:"تمرین",training:"تمرین",nutrition:"تغذیه",body:"پیشرفت بدنی",body_progress:"پیشرفت بدنی",progress:"پیشرفت بدنی"} as Record<string,string>)[value]??value}
function badgeDescription(item:Json){const current=fa(item.current),target=fa(item.target),category=achievementCategory(String(item.category??""));return item.target!=null?`${current} از ${target} ${category}`:category}
function recordDateLabel(value:unknown){if(!value)return "تاریخ ثبت نشده";const raw=new Date(String(value));const now=new Date();const diff=Math.floor((now.getTime()-raw.getTime())/86400000);if(diff===0)return "امروز";if(diff>0&&diff<30)return `${fa(diff)} روز پیش`;return date(value)}

function Shop({data,reload}:{data:Json;reload:()=>Promise<void>}){
  const services=rows(data.services);
  const categories=rows(data.categories);
  const purchases=rows(data.purchases);
  const options=object(data.options);
  const [category,setCategory]=useState<number|null>(null);
  const [purchaseCategory,setPurchaseCategory]=useState<number|null>(null);
  const [serviceQuery,setServiceQuery]=useState("");
  const [purchaseQuery,setPurchaseQuery]=useState("");
  const [serviceSort,setServiceSort]=useState<"default"|"cheap"|"expensive">("default");
  const [purchaseSort,setPurchaseSort]=useState<"newest"|"oldest">("newest");
  const [visibleCount,setVisibleCount]=useState(8);
  const [buying,setBuying]=useState<Json|null>(null);
  const [month,setMonth]=useState("all");
  const serviceCategory=new Map(services.map(item=>[String(item.name??""),Number(item.category)]));
  const visibleServices=services.filter(item=>(category===null||Number(item.category)===category)&&`${String(item.name??"")} ${String(item.description??"")}`.includes(serviceQuery.trim())).sort((a,b)=>serviceSort==="cheap"?Number(a.price??0)-Number(b.price??0):serviceSort==="expensive"?Number(b.price??0)-Number(a.price??0):0);
  const monthOptions=Array.from(new Set(purchases.map(item=>String(item.created_at??"").slice(0,7)).filter(Boolean)));
  const visiblePurchases=purchases.filter(item=>(purchaseCategory===null||serviceCategory.get(String(item.service_name??""))===purchaseCategory)&&(month==="all"||String(item.created_at??"").startsWith(month))&&`${String(item.service_name??"")} ${date(item.created_at)}`.includes(purchaseQuery.trim())).sort((a,b)=>purchaseSort==="oldest"?String(a.created_at??"").localeCompare(String(b.created_at??"")):String(b.created_at??"").localeCompare(String(a.created_at??"")));
  return <div className={styles.shopPage}>
    <Card title="خدمات تعریف شده توسط مربی" action={<div className={styles.shopHeaderActions}><button aria-label="نمایش فهرستی"><Icon name="card"/></button><MoreButton/></div>} className={styles.shopServicesCard}>
      {services.length?<><ShopCategories categories={categories} active={category} select={value=>{setCategory(value);setVisibleCount(8)}}/><ShopTools query={serviceQuery} setQuery={setServiceQuery} placeholder="جستجو..." value={serviceSort} setValue={value=>setServiceSort(value as typeof serviceSort)} options={[{value:"default",label:"پیش فرض"},{value:"cheap",label:"کمترین قیمت"},{value:"expensive",label:"بیشترین قیمت"}]}/>{visibleServices.length?<><div className={styles.shopServices}>{visibleServices.slice(0,visibleCount).map(item=><ShopServiceCard key={String(item.id)} item={item} buy={()=>setBuying(item)}/>)}</div>{visibleCount<visibleServices.length?<button className={styles.shopShowMore} onClick={()=>setVisibleCount(value=>value+4)}>نمایش بیشتر <span>⌄</span></button>:null}</>:<ShopEmpty icon="search" title="سرویسی پیدا نشد" text="عبارت جستجو یا دسته‌بندی را تغییر دهید."/>}</>:<ShopEmpty icon="shop" title="مربیت هنوز خدمتی تعریف نکرده" text="بعد از تعریف سرویس توسط مربی، خدمات قابل خرید اینجا نمایش داده می‌شوند."/>}
    </Card>
    <Card title="تاریخچه خریدها" action={<select className={styles.shopMonth} value={month} onChange={event=>setMonth(event.target.value)}><option value="all">همه تاریخ‌ها</option>{monthOptions.map(item=><option value={item} key={item}>{monthLabel(item)}</option>)}</select>} className={styles.shopPurchasesCard}>
      {purchases.length?<><ShopCategories categories={categories} active={purchaseCategory} select={setPurchaseCategory}/><ShopTools query={purchaseQuery} setQuery={setPurchaseQuery} placeholder="جستجو نام، سرویس یا تاریخ..." value={purchaseSort} setValue={value=>setPurchaseSort(value as typeof purchaseSort)} options={[{value:"newest",label:"جدیدترین"},{value:"oldest",label:"قدیمی‌ترین"}]}/>{visiblePurchases.length?<ShopPurchaseTable items={visiblePurchases}/>:<ShopEmpty icon="search" title="خریدی پیدا نشد" text="فیلتر یا عبارت جستجو را تغییر دهید."/>}</>:<ShopEmpty icon="card" title="هنوز خریدی ثبت نشده" text="پس از خرید سرویس، وضعیت آن را از این بخش دنبال کنید."/>}
    </Card>
    {buying?<ShopBuyDialog service={buying} options={options} close={()=>setBuying(null)} saved={()=>{setBuying(null);void reload()}}/>:null}
  </div>
}
function ShopCategories({categories,active,select}:{categories:Json[];active:number|null;select:(value:number|null)=>void}){return <div className={styles.shopCategories}><button className={active===null?styles.shopCategoryActive:""} onClick={()=>select(null)}>همه موارد</button>{categories.map(item=><button key={String(item.id)} className={active===Number(item.id)?styles.shopCategoryActive:""} onClick={()=>select(Number(item.id))}>{String(item.name)}</button>)}</div>}
function ShopTools({query,setQuery,placeholder,value,setValue,options}:{query:string;setQuery:(value:string)=>void;placeholder:string;value:string;setValue:(value:string)=>void;options:{value:string;label:string}[]}){return <div className={styles.shopTools}><label><Icon name="search" size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={placeholder}/></label><div><Icon name="filter" size={17}/><select value={value} onChange={event=>setValue(event.target.value)}>{options.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</select></div></div>}
function ShopServiceCard({item,buy}:{item:Json;buy:()=>void}){const category=String(item.category_name??"خدمات");return <article><div className={styles.shopServiceHead}><ShopGlyph category={category}/><p><b>{String(item.name??"سرویس")}</b><small>{category}</small></p></div><div className={styles.shopServiceDescription}>{String(item.description??"")||"توضیحی برای این سرویس ثبت نشده است."}</div><button onClick={buy}>خرید | {money(item.price)}</button></article>}
function ShopGlyph({category}:{category:string}){const normalized=category.toLowerCase();const name:IconName=normalized.includes("غذا")||normalized.includes("تغذ")?"nutrition":normalized.includes("تمرین")?"workout":normalized.includes("جلسه")?"coach":"shop";return <span className={`${styles.shopGlyph} ${styles[`shopGlyph_${name}`]??""}`}><Icon name={name} size={22}/></span>}
function ShopPurchaseTable({items}:{items:Json[]}){return <div className={styles.shopPurchaseTable}><div className={styles.shopPurchaseHead}><span>سرویس</span><span>مبلغ</span><span>تاریخ پرداخت</span><span>روش پرداخت</span><span>وضعیت</span></div>{items.map((item,index)=><article key={String(item.id??index)}><b>{String(item.service_name??"خرید سرویس")}</b><strong>{money(item.amount)}</strong><span>{date(item.created_at)}</span><span>{paymentLabel(String(item.payment_type??""))}</span><em className={String(item.payment_status)==="paid"?styles.shopPurchasePaid:styles.shopPurchasePending}>● {statusLabel(item.payment_status)}</em></article>)}</div>}
function ShopEmpty({icon,title,text}:{icon:IconName;title:string;text:string}){return <div className={styles.shopEmpty}><span><Icon name={icon} size={42}/></span><b>{title}</b><p>{text}</p></div>}
function paymentLabel(value:string){return ({cash:"آنلاین",debt:"پرداخت در آینده",installment:"اقساطی"} as Record<string,string>)[value]??value}
function monthLabel(value:string){if(!value)return "-";try{return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{month:"long",year:"numeric"}).format(new Date(`${value}-01`))}catch{return value}}
function ShopBuyDialog({service,options,close,saved}:{service:Json;options:Json;close:()=>void;saved:()=>void}){const allowed=Array.isArray(options.allowed_types)?options.allowed_types.map(String):[];const [method,setMethod]=useState(allowed[0]??"");const [pending,setPending]=useState(false);const [success,setSuccess]=useState(false);const [error,setError]=useState("");const submit=async()=>{if(!method){setError("روش پرداختی برای این سرویس فعال نیست.");return}setPending(true);setError("");try{const result=await api<Json>(`/store/services/${service.id}/buy/`,{method:"POST",body:JSON.stringify({payment_type:method})});const url=String(result.payment_url??result.url??"");if(url){location.href=url;return}setSuccess(true)}catch{setError("ثبت خرید انجام نشد. دوباره تلاش کنید.")}finally{setPending(false)}};if(success)return <Dialog title="" close={saved}><div className={styles.shopSuccess}><div><Icon name="check" size={28}/><ShopGlyph category={String(service.category_name??"")}/></div><h3>{shopSuccessTitle(String(service.category_name??""))}</h3><p>خرید شما با موفقیت ثبت شد و وضعیت آن از تاریخچه خریدها قابل پیگیری است.</p><button className={styles.primary} onClick={saved}>مشاهده خریدها</button></div></Dialog>;return <Dialog title="خرید آیتم" close={close}><div className={styles.shopCheckout}><div className={styles.shopCheckoutService}><ShopGlyph category={String(service.category_name??"")}/><p><b>{String(service.name)}</b><small>{String(service.category_name??"")}</small></p><strong>{money(service.price)}</strong></div><label>روش پرداخت<select value={method} onChange={event=>setMethod(event.target.value)}><option value="">انتخاب کنید...</option>{allowed.map(type=><option value={type} key={type}>{paymentLabel(type)}{type==="debt"?` - مهلت ${fa(options.debt_due_days)} روز`:type==="installment"?` - ${fa(options.installment_count)} قسط`:""}</option>)}</select></label>{error?<p className={styles.formError}>{error}</p>:null}<div className={styles.dialogButtons}><button className={styles.outline} onClick={close}>انصراف</button><button className={styles.primary} disabled={pending||!allowed.length} onClick={()=>void submit()}>{pending?"در حال ثبت...":`پرداخت | ${money(service.price)}`}</button></div></div></Dialog>}
function shopSuccessTitle(category:string){return category.includes("غذا")||category.includes("تغذ")?"برنامه غذایی با موفقیت خریداری شد":category.includes("تمرین")?"برنامه تمرینی با موفقیت خریداری شد":category.includes("مکمل")?"خرید مکمل با موفقیت ثبت شد":"خرید شما با موفقیت ثبت شد"}

function GymStatus({data,go}:{data:Json;reload:()=>Promise<void>;go:(view:View)=>void}){
  const live=object(data.live);
  const chart=object(data.chart);
  const hours=rows(chart.hours);
  const suggested=suggestedGymTime(hours);
  const level=String(live.busy_level??"");
  const restricted=Boolean(data.restricted);
  return <div className={styles.gymStatusPage}>
    <Card title="شلوغی باشگاه" action={<MoreButton/>} className={styles.gymLiveCard}>
      <div className={styles.gymLiveSummary}>
        <div className={styles.gymPeople}><span><Icon name="coach" size={23}/></span><p><strong>{live.present_count==null?"وضعیت نامشخص":`${fa(live.present_count)} نفر`}</strong><small>{live.present_count==null?"باشگاهی به حساب شما متصل نیست":`در حال حاضر در ${String(live.gym_name??"باشگاه شما")} مشغول تمرین هستند`}</small></p></div>
        {live.busy_level?<span className={`${styles.gymLevelBadge} ${styles[`gymLevel_${level}`]??""}`}>{busySentence(level)}</span>:null}
      </div>
      <div className={styles.gymSuggestedTime}>
        <span><Icon name="clock" size={18}/></span><p><strong>{suggested}</strong><small>بهترین زمان امروز برای حضور در باشگاه</small></p><time>ساعت: {new Intl.DateTimeFormat("fa-IR-u-ca-persian",{hour:"2-digit",minute:"2-digit"}).format(new Date())}</time>
      </div>
    </Card>
    <Card title="نمودار شلوغی روزانه (میانگین ۴ هفته)" action={<MoreButton/>} className={styles.gymChartCard}>
      {chart.enough_data===false||!hours.length?<Empty title="داده کافی نیست" text={String(chart.message??"برای نمایش نمودار، سابقه حضور بیشتری لازم است.")}/>:<GymBusyLineChart items={hours} capacity={Number(live.capacity??0)}/>}
    </Card>
    {restricted?<Dialog title="" close={()=>go("home")}><div className={styles.gymSubscription}><span>👑</span><h3>نیاز به خرید اشتراک</h3><p>برای دسترسی به این بخش و مشاهده وضعیت لحظه‌ای باشگاه، ابتدا یکی از خدمات فعال را تهیه کنید.</p><div className={styles.dialogButtons}><button className={styles.outline} onClick={()=>go("home")}>انصراف</button><button className={styles.primary} onClick={()=>go("shop")}>مشاهده خدمات</button></div></div></Dialog>:null}
  </div>
}
function GymBusyLineChart({items,capacity}:{items:Json[];capacity:number}){
  const [active,setActive]=useState<number|null>(null);
  const values=items.map(item=>Math.max(0,Number(item.avg_count??0)));
  const max=Math.max(capacity,...values,1);
  const points=values.map((value,index)=>({x:58+(index/Math.max(values.length-1,1))*902,y:284-(value/max)*228,value,index}));
  const selected=active==null?null:points[active];
  return <div className={styles.gymLineChart} onMouseLeave={()=>setActive(null)}>
    {selected?<div className={styles.gymChartTooltip} style={{left:`${selected.x/10}%`,top:`${Math.max(8,selected.y/3.3-11)}%`}}><small>{fa(items[selected.index].hour)}:۰۰</small><strong>{busyLabel(String(items[selected.index].busy_level??""))}</strong><b>{fa(selected.value)} نفر</b></div>:null}
    <svg viewBox="0 0 1000 330" role="img" aria-label="نمودار میانگین شلوغی باشگاه">
      {[0,1,2,3,4].map(step=><g key={step}><line x1="55" y1={56+step*57} x2="965" y2={56+step*57} className={styles.gymGridLine}/><text x="20" y={61+step*57}>{fa(Math.round(max-(max/4)*step))}</text></g>)}
      {points.slice(1).map((point,index)=><line key={index} x1={points[index].x} y1={points[index].y} x2={point.x} y2={point.y} className={styles[`gymLine_${String(items[index+1].busy_level??"normal")}`]??styles.gymLine_normal}/>) }
      {points.map((point,index)=><circle key={index} cx={point.x} cy={point.y} r="16" className={styles.gymChartHit} onMouseEnter={()=>setActive(index)} onClick={()=>setActive(index)}/>)}
    </svg>
    <div className={styles.gymChartHours}>{items.map((item,index)=><span key={index}>{fa(item.hour)}</span>)}</div>
    <div className={styles.gymChartLegend}><span><i className={styles.gymLegendQuiet}/>خلوت</span><span><i className={styles.gymLegendNormal}/>متوسط</span><span><i className={styles.gymLegendBusy}/>شلوغ</span></div>
  </div>
}
function suggestedGymTime(items:Json[]){if(!items.length)return "زمان پیشنهادی ثبت نشده";const quiet=items.filter(item=>["quiet","low"].includes(String(item.busy_level??""))).sort((a,b)=>Number(a.avg_count??0)-Number(b.avg_count??0));const first=quiet[0]??[...items].sort((a,b)=>Number(a.avg_count??0)-Number(b.avg_count??0))[0];const start=Number(first?.hour);return Number.isFinite(start)?`${fa(start)} الی ${fa(Math.min(start+2,23))}`:"زمان پیشنهادی ثبت نشده"}
function busySentence(value:string){return ({quiet:"باشگاه خلوت است",low:"باشگاه خلوت است",normal:"شلوغی متوسط است",medium:"شلوغی متوسط است",busy:"باشگاه شلوغ است",high:"باشگاه شلوغ است",very_busy:"باشگاه خیلی شلوغ است"} as Record<string,string>)[value]??"وضعیت نامشخص"}
function busyLabel(value:string){return ({quiet:"خلوت",normal:"عادی",busy:"شلوغ",very_busy:"خیلی شلوغ",low:"خلوت",medium:"عادی",high:"شلوغ"} as Record<string,string>)[value]??"وضعیت لحظه‌ای"}

type SettingsTab="profile"|"preferences"|"subscription"|"support";
function Settings({data,reload,go}:{data:Json;reload:()=>Promise<void>;go:(view:View)=>void}){
  const account=object(data.account);
  const embeddedUser=object(data.user);
  const fullName=String(account.full_name??embeddedUser.full_name??"");
  const nameParts=fullName.trim().split(/\s+/);
  const membershipData=object(data.membership);
  const membership=rows(membershipData.memberships)[0]??{};
  const [tab,setTab]=useState<SettingsTab>("profile");
  const [message,setMessage]=useState("");
  const [pending,setPending]=useState(false);
  const [passwordOpen,setPasswordOpen]=useState(false);
  const submitProfile=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();setPending(true);setMessage("");const form=Object.fromEntries(new FormData(event.currentTarget).entries());const name=`${String(form.first_name??"").trim()} ${String(form.last_name??"").trim()}`.trim();const numeric=(value:FormDataEntryValue|undefined)=>value==null||value===""?null:Number(value);try{await Promise.all([api("/auth/me/",{method:"PATCH",body:JSON.stringify({full_name:name})}),api("/athlete/me/",{method:"PATCH",body:JSON.stringify({birth_date:form.birth_date||null,gender:form.gender??"",height:numeric(form.height),weight:numeric(form.weight),target_weight:numeric(form.target_weight),injuries:String(form.injuries??"")})})]);setMessage("اطلاعات با موفقیت ذخیره شد.");await reload()}catch{setMessage("ذخیره اطلاعات انجام نشد. دوباره تلاش کنید.")}finally{setPending(false)}};
  const tabs:{key:SettingsTab;label:string;icon:IconName}[]=[{key:"profile",label:"پروفایل",icon:"coach"},{key:"preferences",label:"تنظیمات",icon:"settings"},{key:"subscription",label:"اشتراک",icon:"card"},{key:"support",label:"پشتیبانی",icon:"empty"}];
  return <div className={styles.athleteSettingsPage}>
    <aside className={styles.athleteSettingsNav}>{tabs.map(item=><button key={item.key} className={tab===item.key?styles.settingsNavActive:""} onClick={()=>{setTab(item.key);setMessage("")}}><Icon name={item.icon} size={18}/><span>{item.label}</span></button>)}</aside>
    <div className={styles.athleteSettingsContent}>
      {tab==="profile"?<Card className={styles.settingsProfileCard}><div className={styles.settingsIntro}><h2>پروفایل</h2><p>مشخصات و پروفایل کاربری خود را مدیریت کنید</p></div><form className={styles.athleteProfileForm} onSubmit={submitProfile}><div className={styles.settingsIdentity}><span className={styles.settingsAvatar}>{fullName.slice(0,1)||"و"}<i><Icon name="camera" size={12}/></i></span><p><b>{fullName||"ورزشکار GymPlus"}</b><small>{membership.gym_name?`ورزشکار ${String(membership.gym_name)}`:"ورزشکار GymPlus"}</small></p></div><div className={styles.settingsFields}><label>نام<input name="first_name" defaultValue={nameParts[0]??""}/><Icon name="edit" size={15}/></label><label>نام خانوادگی<input name="last_name" defaultValue={nameParts.slice(1).join(" ")}/><Icon name="edit" size={15}/></label><label>شماره موبایل<input value={String(account.phone??embeddedUser.phone??"")} readOnly/><Icon name="edit" size={15}/></label><label>تاریخ تولد<input name="birth_date" type="date" {...dateInputProps()} defaultValue={String(data.birth_date??"")}/><Icon name="edit" size={15}/></label><label>جنسیت<select name="gender" defaultValue={String(data.gender??"")}><option value="">انتخاب کنید</option><option value="male">مرد</option><option value="female">زن</option><option value="other">سایر</option></select></label><label>قد (سانتی‌متر)<input name="height" type="number" defaultValue={String(data.height??"")}/></label><label>وزن فعلی<input name="weight" type="number" step="0.1" defaultValue={String(data.weight??"")}/></label><label>وزن هدف<input name="target_weight" type="number" step="0.1" defaultValue={String(data.target_weight??"")}/></label><label className={styles.settingsAbout}>درباره من<textarea name="injuries" rows={3} defaultValue={String(data.injuries??"")} placeholder="محدودیت‌ها یا نکات مهم تمرینی خود را بنویسید..."/><Icon name="edit" size={15}/></label></div>{message?<p className={styles.settingsMessage}>{message}</p>:null}<div className={styles.settingsActions}><button type="reset" className={styles.outline} onClick={()=>setMessage("")}>انصراف</button><button className={styles.primary} disabled={pending}>{pending?"در حال ذخیره...":"ذخیره اطلاعات"}</button></div></form></Card>:null}
      {tab==="preferences"?<Card className={styles.settingsPreferencesCard}><div className={styles.settingsIntro}><h2>تنظیمات</h2><p>تنظیمات سیستم را تغییر دهید</p></div><div className={styles.settingsPreferences}><label><span><b>زبان سیستم</b><small>زبان مورد نظر را انتخاب کنید</small></span><select defaultValue="fa"><option value="fa">فارسی</option></select></label><label><span><b>تم نمایش</b><small>حالت نمایش پنل را مشخص کنید</small></span><select defaultValue="light"><option value="light">روشن</option></select></label><div className={styles.passwordSetting}><span><b>تغییر رمز عبور</b><small>برای امنیت حساب، رمز عبور خود را به‌صورت دوره‌ای تغییر دهید</small></span><button className={styles.outline} onClick={()=>setPasswordOpen(true)}>تعیین رمز عبور/تغییر رمز عبور</button><span className={styles.passwordArt}>🔐</span></div></div><div className={styles.settingsActions}><button className={styles.outline}>انصراف</button><button className={styles.primary} onClick={()=>setMessage("تنظیمات نمایش ذخیره شد.")}>ذخیره اطلاعات</button></div>{message?<p className={styles.settingsMessage}>{message}</p>:null}</Card>:null}
      {tab==="subscription"?<Card className={styles.settingsSubscriptionCard}><div className={styles.settingsIntro}><h2>اشتراک</h2><p>وضعیت عضویت باشگاه خود را مشاهده کنید</p></div>{membership.id?<div className={styles.subscriptionBox}><span className={styles.subscriptionIcon}>✦</span><p><b>{String(membership.gym_name??"عضویت باشگاه")}</b><small className={membership.is_active?styles.subscriptionActive:styles.subscriptionExpired}>{membership.is_active?"فعال":"منقضی شده"}</small></p><dl><div><dt>تاریخ شروع</dt><dd>{date(membership.start_date)}</dd></div><div><dt>تاریخ پایان</dt><dd>{date(membership.end_date)}</dd></div><div><dt>زمان باقی‌مانده</dt><dd>{fa(membership.days_remaining)} روز</dd></div><div><dt>شهریه</dt><dd>{money(membership.monthly_fee)}</dd></div></dl></div>:<div className={styles.subscriptionEmpty}><Icon name="card" size={38}/><b>اشتراک فعالی ندارید</b><p>برای مشاهده خدمات قابل خرید به فروشگاه بروید.</p></div>}<div className={styles.settingsActions}><button className={styles.primary} onClick={()=>go("shop")}>{membership.is_active?"تمدید اشتراک":"مشاهده خدمات"}</button></div></Card>:null}
      {tab==="support"?<Card className={styles.settingsSupportCard}><div className={styles.settingsIntro}><h2>پشتیبانی</h2><p>برای دریافت راهنمایی با تیم پشتیبانی در ارتباط باشید</p></div><div className={styles.settingsSupport}><span><Icon name="empty" size={34}/></span><b>چطور می‌توانیم کمکتان کنیم؟</b><p>پرسش یا مشکل خود را از طریق ایمیل برای تیم پشتیبانی ارسال کنید.</p><a href="mailto:support@gympluspro.ir">ارسال ایمیل به پشتیبانی</a></div></Card>:null}
    </div>
    {passwordOpen?<PasswordDialog close={()=>setPasswordOpen(false)}/>:null}
  </div>
}
function PasswordDialog({close}:{close:()=>void}){const [pending,setPending]=useState(false);const [error,setError]=useState("");const [success,setSuccess]=useState(false);const submit=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=Object.fromEntries(new FormData(event.currentTarget).entries());if(String(form.new_password)!==String(form.confirm_password)){setError("تکرار رمز عبور با رمز جدید یکسان نیست.");return}setPending(true);setError("");try{await api("/auth/password/change/",{method:"POST",body:JSON.stringify({old_password:form.old_password,new_password:form.new_password})});setSuccess(true)}catch{setError("تغییر رمز عبور انجام نشد. رمز فعلی را بررسی کنید.")}finally{setPending(false)}};if(success)return <Dialog title="" close={close}><div className={styles.passwordSuccess}><span><Icon name="check" size={30}/></span><h3>رمز عبور تغییر کرد</h3><p>از این پس برای ورود از رمز عبور جدید استفاده کنید.</p><button className={styles.primary} onClick={close}>متوجه شدم</button></div></Dialog>;return <Dialog title="تغییر رمز عبور" close={close}><form className={styles.passwordForm} onSubmit={submit}><label>رمز عبور فعلی<input name="old_password" type="password" required autoComplete="current-password"/></label><label>رمز عبور جدید<input name="new_password" type="password" minLength={8} required autoComplete="new-password"/></label><label>تکرار رمز عبور جدید<input name="confirm_password" type="password" minLength={8} required autoComplete="new-password"/></label>{error?<p className={styles.formError}>{error}</p>:null}<div className={styles.dialogButtons}><button type="button" className={styles.outline} onClick={close}>انصراف</button><button className={styles.primary} disabled={pending}>{pending?"در حال تغییر...":"تغییر رمز عبور"}</button></div></form></Dialog>}

function Dialog({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}){useEffect(()=>{const esc=(e:KeyboardEvent)=>{if(e.key==="Escape")close()};document.addEventListener("keydown",esc);return()=>document.removeEventListener("keydown",esc)},[close]);return <div className={styles.backdrop} onMouseDown={close}><section className={styles.dialog} role="dialog" aria-modal="true" aria-label={title} onMouseDown={e=>e.stopPropagation()}><header><h2>{title}</h2><button onClick={close}><Icon name="close"/></button></header>{children}</section></div>}
type SearchCategory = "all" | "workout" | "nutrition" | "financial" | "shop";
type SearchResult = { view: View; title: string; subtitle: string; icon: IconName };

function SearchDialog({ close, go }: { close: () => void; go: (view: View) => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<SearchCategory>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const categories: { key: SearchCategory; label: string; icon: IconName }[] = [
    { key: "all", label: "همه موارد", icon: "search" },
    { key: "workout", label: "تمرینات", icon: "workout" },
    { key: "nutrition", label: "تغذیه", icon: "nutrition" },
    { key: "financial", label: "مالی", icon: "financial" },
    { key: "shop", label: "فروشگاه", icon: "shop" },
  ];

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setLoading(false); return; }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const [workoutResult, nutritionResult, invoices, services] = await Promise.all([
          api<Json>("/me/workout/today/").catch(() => ({} as Json)),
          api<Json>("/me/nutrition/plan/").catch(() => ({} as Json)),
          api<unknown>("/me/invoices/").catch(() => []),
          api<unknown>("/store/services/").catch(() => []),
        ]);
        const needle = query.trim().toLocaleLowerCase("fa");
        const matches = (value: unknown) => String(value ?? "").toLocaleLowerCase("fa").includes(needle);
        const found: SearchResult[] = [];
        const workout = object(workoutResult);
        const workoutDays = rows(workout.days).length ? rows(workout.days) : rows(object(workout.plan).days);
        workoutDays.flatMap(day => rows(day.exercises)).forEach(item => {
          const title = String(item.name ?? item.exercise_name ?? "");
          if (matches(title)) found.push({ view: "workout", title, subtitle: "حرکت برنامه تمرینی", icon: "workout" });
        });
        const nutrition = object(nutritionResult);
        rows(nutrition.meals).flatMap(meal => rows(meal.items)).forEach(item => {
          const title = String(item.name ?? item.food_name ?? "");
          if (matches(title)) found.push({ view: "nutrition", title, subtitle: "مورد برنامه غذایی", icon: "nutrition" });
        });
        rows(invoices).forEach(item => {
          const title = String(item.service_name ?? item.title ?? `فاکتور ${fa(item.id)}`);
          const subtitle = `${String(item.invoice_number ?? "فاکتور مالی")} | ${money(item.outstanding ?? item.amount)}`;
          if (matches(title) || matches(item.invoice_number)) found.push({ view: "financial", title, subtitle, icon: "financial" });
        });
        rows(services).forEach(item => {
          const title = String(item.name ?? "");
          if (matches(title) || matches(item.category_name)) found.push({ view: "shop", title, subtitle: String(item.category_name ?? "خدمات فروشگاه"), icon: "shop" });
        });
        setResults(found);
        setHighlighted(0);
      } finally { setLoading(false); }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  const visible = active === "all" ? results : results.filter(item => item.view === active);
  useEffect(() => { setHighlighted(0); }, [active]);
  const openResult = (item: SearchResult) => { go(item.view); close(); };
  const handleKeys = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (!visible.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setHighlighted(value => (value + 1) % visible.length); }
    if (event.key === "ArrowUp") { event.preventDefault(); setHighlighted(value => (value - 1 + visible.length) % visible.length); }
    if (event.key === "Enter") { event.preventDefault(); openResult(visible[highlighted] ?? visible[0]); }
  };

  return <div className={styles.searchBackdrop} onMouseDown={close} onKeyDown={handleKeys}>
    <section className={styles.commandSearch} role="dialog" aria-modal="true" aria-label="جستجو" onMouseDown={event => event.stopPropagation()}>
      <div className={styles.commandSearchTop}>
        <label className={styles.commandSearchInput}><Icon name="search" size={21}/><input ref={input} value={query} onChange={event => setQuery(event.target.value)} placeholder="جستجو کن..." aria-label="عبارت جستجو"/><kbd>⌘ K</kbd></label>
        <button type="button" onClick={close} aria-label="بستن جستجو"><Icon name="close" size={19}/></button>
      </div>
      <div className={styles.commandSearchKeys}><span>حرکت <kbd>↑</kbd><kbd>↓</kbd></span><span>انتخاب <kbd>↵</kbd></span><span>خروج <kbd>Esc</kbd></span></div>
      <div className={styles.commandSearchBody}>
        <nav className={styles.commandSearchNav} aria-label="دسته‌بندی جستجو">{categories.map(item => <button type="button" key={item.key} className={active === item.key ? styles.commandSearchNavActive : ""} onClick={() => setActive(item.key)}><Icon name={item.icon} size={18}/><span>{item.label}</span></button>)}</nav>
        <div className={styles.commandSearchPanel}>
          {loading ? <Loading/> : query.trim().length < 2 ? <div className={styles.commandSearchEmpty}><Image src="/assets/images/search-empty-reference.png" width={116} height={92} alt=""/><b>جستجو کنید</b><p>پس از جستجو نتایج اینجا نمایش داده می‌شود</p></div> : visible.length ? <div className={styles.commandSearchResults}><p>نتایج جستجو:</p>{visible.map((item, index) => <button type="button" key={`${item.view}-${item.title}-${index}`} className={highlighted === index ? styles.commandSearchResultActive : ""} onMouseEnter={() => setHighlighted(index)} onClick={() => openResult(item)}><span><Icon name={item.icon} size={18}/></span><p><b>{item.title}</b><small>{item.subtitle}</small></p><Icon name="arrow" size={16}/></button>)}</div> : <div className={styles.commandSearchEmpty}><Image src="/assets/images/search-empty-reference.png" width={116} height={92} alt=""/><b>نتیجه‌ای پیدا نشد</b><p>عبارت دیگری را جستجو کنید</p></div>}
        </div>
      </div>
    </section>
  </div>;
}

function AthleteNotificationBell({user,go}:{user:User;go:(view:View)=>void}) {
  type NotificationTab="all"|"unread"|"read";
  const [open,setOpen]=useState(false);
  const [items,setItems]=useState<Json[]>([]);
  const [unread,setUnread]=useState(0);
  const [tab,setTab]=useState<NotificationTab>("all");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [markingAll,setMarkingAll]=useState(false);
  const readStorageKey=`gymplus:read-notifications:${token().slice(-16)}`;
  const rememberedRead=()=>{try{return new Set<string>(JSON.parse(localStorage.getItem(readStorageKey)??"[]"))}catch{return new Set<string>()}};
  const rememberRead=(ids:string[])=>{try{const next=new Set([...rememberedRead(),...ids]);localStorage.setItem(readStorageKey,JSON.stringify([...next]))}catch{}};
  const loadCount=useCallback(async()=>{try{const result=await api<Json>("/notifications/unread_count/");setUnread(Number(result.unread??result.unread_count??result.count??0))}catch{/* Notifications must not block the athlete dashboard. */}},[]);
  const loadItems=useCallback(async()=>{setLoading(true);setError("");try{const list=await api<unknown>("/notifications/");const remembered=rememberedRead();const loaded=rows(list).map(item=>remembered.has(String(item.id))?{...item,read:true}:item);setItems(loaded);setUnread(loaded.filter(item=>!item.read).length)}catch{setError("دریافت اعلان‌ها انجام نشد.")}finally{setLoading(false)}},[]);
  useEffect(()=>{void loadCount();const timer=window.setInterval(()=>void loadCount(),60000);return()=>window.clearInterval(timer)},[loadCount]);
  useEffect(()=>{if(!open)return;const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close)},[open]);
  const toggle=()=>{if(open){setOpen(false);return}setTab("all");setOpen(true);void loadItems()};
  const markOne=async(item:Json)=>{if(item.read)return;try{await api(`/notifications/${item.id}/`);rememberRead([String(item.id)]);setItems(current=>current.map(notification=>notification.id===item.id?{...notification,read:true}:notification));setUnread(current=>Math.max(0,current-1))}catch{setError("ثبت وضعیت اعلان انجام نشد.")}};
  const markAll=async()=>{if(!unread)return;setMarkingAll(true);setError("");try{await api("/notifications/read/",{method:"POST"});setItems(current=>{rememberRead(current.map(item=>String(item.id)));return current.map(item=>({...item,read:true}))});setUnread(0)}catch{setError("خواندن همه اعلان‌ها انجام نشد.")}finally{setMarkingAll(false)}};
  const visible=items.filter(item=>tab==="all"||(tab==="unread"?!item.read:item.read));
  const openItem=async(item:Json)=>{await markOne(item);setOpen(false);go(notificationTarget(String(item.kind)))};
  return <div className={styles.notificationWrap}>
    <button className={styles.iconButton} onClick={toggle} aria-label={unread?`${fa(unread)} اعلان خوانده‌نشده`:"اعلان‌ها"} aria-expanded={open} aria-haspopup="dialog"><Icon name="bell"/>{unread>0?<i/>:null}</button>
    {open&&typeof document!=="undefined"?createPortal(<><button className={styles.notificationDismiss} onMouseDown={()=>setOpen(false)} aria-label="بستن اعلان‌ها"/><section className={styles.notificationPanel} role="dialog" aria-label="اعلان‌های من">
      <header><h2>اعلانات</h2><span><button disabled={!unread||markingAll} onClick={()=>void markAll()} title="خواندن همه" aria-label="خواندن همه اعلان‌ها"><Icon name="filter" size={18}/></button><i/><button onClick={()=>setOpen(false)} aria-label="بستن"><Icon name="close" size={18}/></button></span></header>
      <div className={styles.notificationTabs}>{([['all','همه اعلانات'],['unread',`خوانده نشده (${fa(unread)})`],['read','خوانده شده']] as Array<[NotificationTab,string]>).map(([key,label])=><button key={key} className={tab===key?styles.notificationTabActive:""} onClick={()=>setTab(key)}>{label}</button>)}</div>
      {loading?<div className={styles.notificationLoading}><span/><span/><span/></div>:error&&!items.length?<div className={styles.notificationError}><Icon name="bell" size={25}/><span>{error}</span><button onClick={()=>void loadItems()}>تلاش دوباره</button></div>:visible.length?<div className={styles.notificationList}>{visible.map((item,index)=><article className={item.read?styles.notificationRead:styles.notificationUnread} data-kind={String(item.kind??"system")} key={String(item.id??index)}><header><span className={styles.notificationIdentity}><UserAvatar user={user}/><span><b>{notificationTitle(String(item.kind))}</b><small>{notificationContext(String(item.kind))}</small></span>{!item.read?<i/>:null}</span><time>{relativeTime(item.created_at)}</time></header><p>{String(item.message??"")}</p><footer><button disabled={Boolean(item.read)} onClick={()=>void markOne(item)}>{item.read?"خوانده شده":"خواندم"}</button><button className={styles.primarySmall} onClick={()=>void openItem(item)}>مشاهده</button></footer></article>)}</div>:<div className={styles.notificationEmpty}><span><Icon name="bell" size={26}/></span><b>اعلانی در این بخش ندارید</b><small>پیام‌های مربی، باشگاه و پرداخت‌ها اینجا نمایش داده می‌شوند.</small></div>}
      {error&&items.length?<p className={styles.notificationInlineError}>{error}</p>:null}
    </section></>,document.body):null}
  </div>;
}
function notificationTitle(kind:string){return ({payment:"یادآوری پرداخت",workout:"یادآوری تمرین",new_plan:"برنامه جدید",nutrition:"برنامه غذایی",achievement:"دستاورد جدید",shop:"وضعیت سفارش",gym:"پیام باشگاه",system:"پیام سیستم"} as Record<string,string>)[kind]??"اعلان جدید"}
function notificationContext(kind:string){return ({payment:"وضعیت پرداخت و سررسید",workout:"آخرین وضعیت تمرین",new_plan:"برنامه تازه اختصاص‌یافته",nutrition:"برنامه غذایی",achievement:"دستاوردهای شما",shop:"سفارش و فروشگاه",gym:"پیام مجموعه",system:"اطلاع‌رسانی حساب"} as Record<string,string>)[kind]??"اطلاع‌رسانی حساب"}
function notificationTarget(kind:string):View{return kind==="payment"?"financial":kind==="workout"||kind==="new_plan"?"workout":kind==="nutrition"?"nutrition":kind==="achievement"?"achievements":kind==="shop"?"shop":kind==="gym"?"gym":"home"}
function relativeTime(value:unknown){const parsed=new Date(String(value??""));if(Number.isNaN(parsed.getTime()))return"";const minutes=Math.max(0,Math.floor((Date.now()-parsed.getTime())/60000));if(minutes<1)return"همین حالا";if(minutes<60)return`${fa(minutes)} دقیقه پیش`;const hours=Math.floor(minutes/60);if(hours<24)return`${fa(hours)} ساعت پیش`;return`${fa(Math.floor(hours/24))} روز پیش`}

function RequestDialog({close,saved}:{close:()=>void;saved:()=>void}){const [pending,setPending]=useState(false);const [error,setError]=useState("");const submit=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();setPending(true);setError("");try{await api("/athlete/requests/",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget).entries()))});saved()}catch{setError("ثبت درخواست انجام نشد. دوباره تلاش کنید.")}finally{setPending(false)}};return <Dialog title="درخواست جدید از مربی" close={close}><form className={styles.dialogForm} onSubmit={submit}><label>نوع درخواست<select name="kind"><option value="training_plan">برنامه تمرینی</option><option value="nutrition_plan">برنامه غذایی</option><option value="private_session">جلسه خصوصی</option><option value="supplement">مکمل</option></select></label><label>توضیحات<textarea name="note" rows={5} placeholder="درخواست خود را برای مربی بنویسید..."/></label>{error?<p className={styles.formError}>{error}</p>:null}<div className={styles.dialogButtons}><button type="button" className={styles.outline} onClick={close}>انصراف</button><button className={styles.primary} disabled={pending}>{pending?"در حال ارسال...":"ارسال درخواست"}</button></div></form></Dialog>}
