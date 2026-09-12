"use client";

// =============================================================
// GymPlus+ Coach — 3-column program builder
//   rail   (right) : days / meals of the plan
//   center         : exercises / food items of the active row
//   bank   (left)  : reference bank filtered by active row + goal
// On phones the columns stack and the bank opens as a bottom sheet.
// Save creates/patches live plans; Preview → Send assigns+sends.
// =============================================================

import { useEffect, useMemo, useRef, useState } from "react";

import {
  BankItem,
  MODE_LABEL,
  MODE_OPTIONS,
  PlanMode,
  ProgramDay,
  ProgramDraft,
  ProgramDomain,
  ProgramExercise,
  ProgramFoodItem,
  ProgramMeal,
  StructureItem,
  UnitRefItem,
  freshKey,
  goalLabel,
} from "../program.types";
import type { ServerNutritionPlan, ServerWorkoutPlan } from "../hooks/useProgramData";
import { useProgramData } from "../hooks/useProgramData";
import type { PlanCardSource } from "./ProgramCard";
import { ProgramPreview } from "./ProgramPreview";
import {
  PrmBadge,
  PrmEmpty,
  PrmIcon,
  PrmModal,
  PrmModalHead,
  PrmNotice,
  PrmSelect,
  PrmTextInput,
} from "./programShared";
import { unitName } from "./ProgramBank";

import styles from "../program.module.css";

type ProgramApi = ReturnType<typeof useProgramData>;

export type AthleteOption = { id: number; name: string; phone?: string };

const DOMAIN_LABEL: Record<ProgramDomain, string> = { workout: "تمرین", nutrition: "تغذیه" };

function defaultAmountForUnit(code: string): number {
  if (code === "reps") return 12;
  if (code === "sec") return 30;
  if (code === "min") return 3;
  if (code === "m") return 30;
  return 12;
}

export function ProgramBuilder({
  kind,
  api,
  initial,
  snapshot,
  athletes,
  onExit,
  onSaved,
  onSaveTemplate,
}: {
  kind: ProgramDomain;
  api: ProgramApi;
  initial: ProgramDraft | null;
  snapshot?: ServerWorkoutPlan | ServerNutritionPlan | null;
  athletes: AthleteOption[];
  onExit: () => void;
  onSaved: (id: number, sent: boolean) => void;
  onSaveTemplate?: (draft: ProgramDraft) => void;
}) {
  const [draft, setDraft] = useState<ProgramDraft>(() => {
    if (initial) return deepCopyDraft(initial, false);
    return blankFromStructure(kind, api.state.structure);
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const [goalChip, setGoalChip] = useState<PlanMode | "all">("all");
  const [bankQuery, setBankQuery] = useState("");
  const [showBank, setShowBank] = useState(false); // mobile bottom-sheet
  const [preview, setPreview] = useState(false); // «پیش‌نمایش و ارسال» dialog
  const [fullPreview, setFullPreview] = useState(false); // read-only full-screen preview
  /**
   * «ذخیره و ارسال برای شاگرد» must ask for the plan length before it sends,
   * exactly like the send dialog does. This holds the raw text of that prompt.
   */
  const [durationPrompt, setDurationPrompt] = useState(false);
  const [durationInput, setDurationInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sendAthlete, setSendAthlete] = useState(initial?.athlete ? String(initial.athlete) : "");

  useEffect(() => {
    if (!showBank) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowBank(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showBank]);

  /** Guards against a second persist (double-click / Enter) creating two plans. */
  const persisting = useRef(false);
  /**
   * Remembers the server plan id when a save CREATES a new plan. The builder's
   * draft keeps no id until it closes, and saveWorkout/NutritionPlan decides
   * POST-vs-PATCH from draft.id alone — so without this, a save whose send step
   * fails mid-flight (network) lets the coach retry and accidentally POST a
   * SECOND identical plan (two «برنامه [name]» cards after reload). With this
   * ref the retry PATCHes the plan that was already created instead.
   */
  const createdPlanId = useRef<number | null>(null);
  /**
   * A draft opened for a specific student (initial.athlete set) is a delivery:
   * a plain save assigns + sends it, so the resulting card shows «ارسال‌شده».
   * Covers a fresh wizard/«ارسال برای شاگرد» copy (isNew → «ذخیره و ارسال
   * برای شاگرد») and an already-sent program edited from its card (resend →
   * «ذخیره و ارسال مجدد»).
   */
  const athleteBound = Boolean(initial?.athlete);
  const resendOnSave = Boolean(athleteBound && !initial?.isNew);

  const structureCount = draft.structure.length;
  const activeIndexSafe = Math.min(activeIndex, Math.max(0, structureCount - 1));
  const workout = draft.domain === "workout";
  const days = draft.structure as ProgramDay[];
  const meals = draft.structure as ProgramMeal[];

  const activeTag = () => {
    if (workout) {
      const day = days[activeIndexSafe];
      return day?.muscles ?? [];
    }
    const meal = meals[activeIndexSafe];
    return meal?.category ? [meal.category] : [];
  };

  // ------------------------------------------------------------ helpers
  const unitGramsOf = (code: string): number => {
    const unit = api.state.units.find((entry) => (entry as UnitRefItem).code === code) as UnitRefItem | undefined;
    return unit && unit.grams ? unit.grams : 1;
  };

  const caloriesOf = (grams: number, kcal100?: number): number => {
    if (!kcal100) return 0;
    return Math.round((grams / 100) * kcal100);
  };

  const groupNameOf = (key?: string) => api.state.groups.find((item) => item.key === key)?.name ?? key ?? "—";

  const setStructure = (next: ProgramDay[] | ProgramMeal[]) => setDraft((current) => ({ ...current, structure: next }));

  const updateDay = (dayKey: string, fn: (day: ProgramDay) => ProgramDay) =>
    setStructure(days.map((day) => (day.key === dayKey ? fn(day) : day)));

  const updateMeal = (mealKey: string, fn: (meal: ProgramMeal) => ProgramMeal) =>
    setStructure(meals.map((meal) => (meal.key === mealKey ? fn(meal) : meal)));

  const insertBank = (item: BankItem) => {
    if (workout) {
      const dayKey = days[activeIndexSafe]?.key;
      if (!dayKey) return;
      const row: ProgramExercise = {
        key: freshKey("ex"),
        name: item.name,
        sets: 3,
        reps: defaultAmountForUnit(item.unit ?? "reps"),
        unit: item.unit ?? "reps",
        restSec: 60,
        note: "",
        alternative: "",
        bankKey: item.key,
      };
      updateDay(dayKey, (day) => ({ ...day, exercises: [...day.exercises, row] }));
    } else {
      const mealKey = meals[activeIndexSafe]?.key;
      if (!mealKey) return;
      const unit = item.unit ?? "g";
      const gramsPer = unitGramsOf(unit);
      const amount = unit === "g" ? 100 : 1;
      const grams = amount * gramsPer;
      const row: ProgramFoodItem = {
        key: freshKey("food"),
        name: item.name,
        amount,
        unit,
        grams,
        kcal: caloriesOf(grams, item.kcal100),
        note: "",
        alternative: "",
        bankKey: item.key,
      };
      updateMeal(mealKey, (meal) => ({ ...meal, items: [...meal.items, row] }));
    }
  };

  const addEmptyRow = () => {
    if (workout) {
      const dayKey = days[activeIndexSafe]?.key;
      if (!dayKey) return;
      updateDay(dayKey, (day) => ({
        ...day,
        exercises: [...day.exercises, { key: freshKey("ex"), name: "", sets: 3, reps: 12, unit: "reps", restSec: 60, note: "", alternative: "" }],
      }));
    } else {
      const mealKey = meals[activeIndexSafe]?.key;
      if (!mealKey) return;
      updateMeal(mealKey, (meal) => ({
        ...meal,
        items: [...meal.items, { key: freshKey("food"), name: "", amount: 1, unit: "g", grams: 100, kcal: 0, note: "", alternative: "" }],
      }));
    }
  };

  const addStructureRow = () => {
    if (workout) {
      setStructure([...days, { key: freshKey("day"), name: `روز ${structureCount + 1}`, muscles: [], exercises: [] }]);
      setActiveIndex(structureCount);
    } else {
      setStructure([...meals, { key: freshKey("meal"), kind: "supplement", name: `وعده ${structureCount + 1}`, category: "", items: [] }]);
      setActiveIndex(structureCount);
    }
  };

  const removeStructureRow = (key: string) => {
    const index = Math.max(0, (workout ? days.findIndex((day) => day.key === key) : meals.findIndex((meal) => meal.key === key)) - 1);
    const next: ProgramDay[] | ProgramMeal[] = workout ? days.filter((day) => day.key !== key) : meals.filter((meal) => meal.key !== key);
    setStructure(next);
    setActiveIndex(Math.min(index, Math.max(0, next.length - 1)));
  };

  const moveRow = (from: number, to: number) => {
    if (from === to) return;
    if (workout) {
      const rows = [...days];
      const [moved] = rows.splice(from, 1);
      rows.splice(to, 0, moved);
      setStructure(rows);
    } else {
      const rows = [...meals];
      const [moved] = rows.splice(from, 1);
      rows.splice(to, 0, moved);
      setStructure(rows);
    }
  };

  // ------------------------------------------------------------ bank list
  const bankItems = useMemo(() => {
    const q = bankQuery.trim().toLocaleLowerCase("fa-IR");
    const tag = activeTag();
    return api.state.bank.filter((item) => {
      if (item.disabled) return false;
      if (goalChip !== "all" && item.goals?.length && !item.goals.includes(goalChip)) return false;
      if (workout) {
        if (tag.length && item.group && !tag.includes(item.group)) return false;
      } else if (tag.length && item.category && item.category !== tag[0]) return false;
      if (q && !item.name.toLocaleLowerCase("fa-IR").includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.state.bank, api.state.groups, goalChip, bankQuery, activeIndexSafe, workout, draft.structure]);

  // ------------------------------------------------------------ totals
  const activeSet = (() => {
    if (workout) {
      const exercises = days[activeIndexSafe]?.exercises ?? [];
      const sets = exercises.reduce((sum, row) => sum + (Number.isFinite(row.sets) ? row.sets : 0), 0);
      return { count: exercises.length, sets, label: `${sets.toLocaleString("fa-IR")} ست · ${exercises.length.toLocaleString("fa-IR")} حرکت` };
    }
    const items = meals[activeIndexSafe]?.items ?? [];
    const kcal = items.reduce((sum, row) => sum + (Number.isFinite(row.kcal) ? row.kcal : 0), 0);
    const grams = items.reduce((sum, row) => sum + (Number.isFinite(row.grams) ? row.grams : 0), 0);
    return { count: items.length, kcal, grams, label: `${kcal.toLocaleString("fa-IR")} کیلوکالری · ${grams.toLocaleString("fa-IR")} گرم` };
  })();

  const totalBadge = (() => {
    if (workout) {
      const sets = days.reduce((sum, day) => sum + day.exercises.reduce((s, row) => s + (Number.isFinite(row.sets) ? row.sets : 0), 0), 0);
      return `${sets.toLocaleString("fa-IR")} ست`;
    }
    const kcal = meals.reduce((sum, meal) => sum + meal.items.reduce((s, row) => s + (Number.isFinite(row.kcal) ? row.kcal : 0), 0), 0);
    return `${kcal.toLocaleString("fa-IR")} کیلوکالری`;
  })();

  const doneCount = (workout ? days : meals).filter((row) => (workout ? (row as ProgramDay).exercises : (row as ProgramMeal).items).length > 0).length;
  const completedLabel = `${doneCount.toLocaleString("fa-IR")} از ${structureCount.toLocaleString("fa-IR")} ${workout ? "روز" : "وعده"} تکمیل`;

  /**
   * The full-screen preview (the one program cards open) renders a saved list
   * card. The builder has no card — only the live draft — so project the draft
   * into the same shape. Rebuilt on every draft change so the preview always
   * shows what is on screen right now, including unsaved edits.
   */
  const previewSource = useMemo<PlanCardSource>(
    () => ({
      uid: `builder-${draft.id ?? "new"}`,
      local: true,
      draft,
      id: draft.id ?? 0,
      title: draft.title,
      mode: draft.mode,
      goal: draft.goal ?? null,
      sentAt: draft.sentAt ?? null,
      athlete: draft.athlete ?? null,
      athleteName: draft.athleteName ?? null,
      durationWeeks: draft.durationWeeks,
      doneCount: (draft.structure as (ProgramDay | ProgramMeal)[]).filter(
        (row) => ((row as ProgramDay).exercises ?? (row as ProgramMeal).items ?? []).length > 0,
      ).length,
      totalCount: draft.structure.length,
      status: draft.sentAt ? "sent" : draft.cardStatus ?? "ready",
    }),
    [draft],
  );

  /** Duration is always a whole number of weeks, never zero. */
  const normalizeWeeks = (value: number | string | undefined) => {
    const parsed = Math.round(Number(String(value ?? "").replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))));
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 104) : 4;
  };

  /** Opens the weeks prompt for a send, or saves straight away when nothing is sent. */
  const requestSend = () => {
    if (!draft.title.trim()) {
      setError("برای برنامه یک عنوان بنویسید.");
      return;
    }
    if (!athleteBound) {
      void persist(false);
      return;
    }
    setError("");
    setDurationInput(String(draft.durationWeeks || 4));
    setDurationPrompt(true);
  };

  // active structure row — guard against an empty structure before rendering
  const activeDay = workout ? days[activeIndexSafe] : undefined;
  const activeMeal = !workout ? meals[activeIndexSafe] : undefined;
  const activeTitle = workout ? activeDay?.name || `روز ${activeIndexSafe + 1}` : activeMeal?.name || "وعده";
  const activeComposition = workout
    ? activeDay && activeDay.muscles.length
      ? activeDay.muscles.map(groupNameOf).join(" + ")
      : "ترکیب عضلانی از «تنظیمات» تعیین می‌شود"
    : `دسته: ${groupNameOf(activeMeal?.category)}`;

  const persist = async (sendNow: boolean, weeksOverride?: number) => {
    if (persisting.current) return; // never create a program twice
    if (!draft.title.trim()) {
      setError("برای برنامه یک عنوان بنویسید.");
      setPreview(false);
      return;
    }
    if (sendNow && !sendAthlete) {
      setError("برای ارسال، شاگرد را انتخاب کنید.");
      return;
    }
    persisting.current = true;
    setSaving(true);
    setError("");
    try {
      const planSnapshot = snapshot ? (workout ? { workout: snapshot as ServerWorkoutPlan } : { nutrition: snapshot as ServerNutritionPlan }) : undefined;
      // The weeks prompt resolves after this closure captured `draft`, so the
      // chosen value arrives as an argument and is written into the payload —
      // the athlete panel reads it back as `duration_weeks`.
      const weeks = weeksOverride === undefined ? normalizeWeeks(draft.durationWeeks) : normalizeWeeks(weeksOverride);
      // Retry of an interrupted create: reuse the id we already got so we PATCH
      // the same plan instead of POSTing a duplicate.
      const base = createdPlanId.current && !draft.id ? { ...draft, id: createdPlanId.current } : draft;
      const toSave = { ...base, durationWeeks: weeks };
      const alreadyAssigned = Boolean(toSave.athlete);
      const { id } = await api.saveDraft(toSave, planSnapshot);
      if (createdPlanId.current === null) createdPlanId.current = id;
      // Mirror the id and the confirmed duration into state so any later read
      // of the draft stays correct.
      setDraft((current) => ({ ...current, id: current.id ?? id, durationWeeks: weeks }));
      // Deliver the program whenever the coach asked to send (preview «ذخیره
      // و ارسال») OR the draft was opened bound to a student (wizard copy /
      // «ارسال برای شاگرد» / editing a sent card) — a plain save then
      // assigns + sends, so the resulting card keeps the «ارسال‌شده» badge.
      const mustSend = Boolean(sendAthlete && (sendNow || athleteBound));
      let sent = false;
      if (mustSend) {
        await api.sendPlan(kind, id, Number(sendAthlete), weeks, alreadyAssigned);
        sent = true;
      }
      onSaved(id, sent);
    } catch {
      setError("ذخیره انجام نشد. اگر وب‌سرویس در دسترس نیست، داده فعلاً محلی می‌ماند.");
      setSaving(false);
    } finally {
      persisting.current = false;
    }
  };


  // ------------------------------------------------------------ render
  return (
    <div className={styles.prmBuilder}>
      <div className={styles.prmBuilderTop}>
        <button type="button" className={styles.prmIconBtn} onClick={onExit} aria-label="بازگشت به برنامه‌ها">
          <PrmIcon name="close" />
        </button>
       <div className={styles.prmBuilderTitle}>
  {initial?.athleteName ? (
    <small className={styles.prmBuilderStudentName}>
      👤 ساخت برنامه برای <strong>{initial.athleteName}</strong>
    </small>
  ) : null}
  <PrmTextInput
    value={draft.title}
    placeholder={workout ? "عنوان برنامه تمرین..." : "عنوان برنامه غذایی..."}
    onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
  />
  <small>{completedLabel} · {workout ? "تمرین" : "تغذیه"} {MODE_LABEL[draft.mode]}</small>
</div>
        <div className={styles.prmModeSeg} role="tablist" aria-label="هدف برنامه">
          {MODE_OPTIONS.map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={draft.mode === mode}
              data-mode={mode}
              className={`${styles.prmModeChip} ${draft.mode === mode ? styles.prmModeChipActive : ""}`}
              onClick={() => setDraft((current) => ({ ...current, mode, goal: undefined }))}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.prmBuilderActions}>
          {onSaveTemplate ? (
            <button
              type="button"
              className={styles.prmBtn}
              onClick={() => {
                if (!draft.title.trim()) {
                  setError("برای ذخیره به‌عنوان قالب، اول عنوان بنویسید.");
                  return;
                }
                onSaveTemplate(draft);
              }}
              title="بدون ارسال، یک نسخه به عنوان «برنامه کلی» ذخیره می‌شود"
            >
              <PrmIcon name="copy" /> ذخیره به‌عنوان قالب
            </button>
          ) : null}
          {initial && !initial.isNew && snapshot ? (
            <button type="button" className={styles.prmBtn} onClick={() => setPreview(true)}>
              <PrmIcon name="send" /> پیش‌نمایش و ارسال
            </button>
          ) : (
            <button type="button" className={styles.prmBtn} onClick={() => setFullPreview(true)}>
              <PrmIcon name="eye" /> پیش‌نمایش
            </button>
          )}
          <button type="button" className={styles.prmBtnPrimary} onClick={requestSend} disabled={saving} title={athleteBound ? "ذخیره و ارسال برای شاگرد" : undefined}>
            {saving ? "در حال ذخیره..." : athleteBound ? (initial?.isNew ? "ذخیره و ارسال برای شاگرد" : "ذخیره و ارسال مجدد") : "ذخیره برنامه"}
          </button>
        </div>
      </div>
      {error ? (
        <div className={styles.prmBuilderError}>
          <PrmNotice tone="red">{error}</PrmNotice>
        </div>
      ) : null}

      <div className={styles.prmBuilderGrid}>
        {/* right: structure rail */}
        <aside className={styles.prmBuilderRail}>
          <div className={styles.prmRailList}>
            {(workout ? days : meals).map((row, index) => {
              const active = index === activeIndexSafe;
              const isDay = workout;
              const rows = (row as ProgramDay).exercises ?? (row as ProgramMeal).items ?? [];
              return (
                <div key={row.key} className={`${styles.prmRailItem} ${active ? styles.prmRailActive : ""}`}>
                  <button type="button" className={styles.prmRailMain} onClick={() => setActiveIndex(index)}>
                    <span className={styles.prmRailIndex}>{(index + 1).toLocaleString("fa-IR")}</span>
                    <span className={styles.prmRailBody}>
                      <b>{row.name || (isDay ? `روز ${index + 1}` : "وعده")}</b>
                      <small>
                        {isDay
                          ? (row as ProgramDay).muscles.map((key) => groupNameOf(key)).join(" · ") || "بدون گروه عضلانی"
                          : groupNameOf((row as ProgramMeal).category)}
                      </small>
                      <span className={styles.prmRailMeta}>
                        {rows.length > 0 ? <PrmBadge tone="green">{(rows.length).toLocaleString("fa-IR")} {isDay ? "حرکت" : "ماده"}</PrmBadge> : <PrmBadge tone="gray">خالی</PrmBadge>}
                      </span>
                    </span>
                  </button>
                  <span className={styles.prmRailActions}>
                    {index > 0 ? (
                      <button type="button" className={styles.prmIconBtn} onClick={() => moveRow(index, index - 1)} aria-label="جابه‌جایی به بالا">
                        <PrmIcon name="caret" />
                      </button>
                    ) : null}
                    <button type="button" className={styles.prmIconBtn} onClick={() => removeStructureRow(row.key)} aria-label="حذف">
                      <PrmIcon name="trash" />
                    </button>
                  </span>
                </div>
              );
            })}
            {!structureCount ? (
              <div className={styles.prmRailEmpty}>{workout ? "روزی اضافه نکرده‌اید." : "وعده‌ای اضافه نکرده‌اید."}</div>
            ) : null}
          </div>
         
        </aside>

        {/* center: rows of the active structure item */}
        <section className={styles.prmBuilderCenter}>
          {structureCount === 0 ? (
            <PrmEmpty
              icon={workout ? "training" : "food"}
              title={workout ? "اولین روز تمرین را بسازید" : "اولین وعده را بسازید"}
              hint="از ستون کناری روز/وعده اضافه کنید، بعد از پایین اینجا آیتم بیاورید."
              action={workout ? "افزودن روز" : "افزودن وعده"}
              onAction={addStructureRow}
            />
          ) : (
            <>
              <header className={styles.prmColHead}>
                <span>
                  <h3>{activeTitle}</h3>
                  <small>{activeComposition}</small>
                </span>
                <PrmBadge tone="orange">{activeSet.label}</PrmBadge>
                <button
                  type="button"
                  className={styles.prmBuilderOpenBank}
                  onClick={() => setShowBank(true)}
                  aria-expanded={showBank}
                  aria-controls="program-builder-bank"
                >
                  <PrmIcon name={workout ? "training" : "food"} />
                  {workout ? "بانک حرکات" : "بانک مواد غذایی"}
                </button>
              </header>

              <div className={styles.prmRows}>
                {workout
                  ? activeDay?.exercises.map((exercise, index) => (
                      <ExerciseRow
                        key={exercise.key}
                        api={api}
                        index={index}
                        row={exercise}
                        onChange={(patch) =>
                          updateDay(activeDay!.key, (day) => ({
                            ...day,
                            exercises: day.exercises.map((entry) => (entry.key === exercise.key ? { ...entry, ...patch } : entry)),
                          }))
                        }
                        onRemove={() =>
                          updateDay(activeDay!.key, (day) => ({ ...day, exercises: day.exercises.filter((entry) => entry.key !== exercise.key) }))
                        }
                      />
                    ))
                  : activeMeal?.items.map((item, index) => (
                      <FoodRow
                        key={item.key}
                        api={api}
                        index={index}
                        row={item}
                        onChange={(patch) =>
                          updateMeal(activeMeal!.key, (meal) => ({
                            ...meal,
                            items: meal.items.map((entry) => (entry.key === item.key ? { ...entry, ...patch } : entry)),
                          }))
                        }
                        onRemove={() =>
                          updateMeal(activeMeal!.key, (meal) => ({ ...meal, items: meal.items.filter((entry) => entry.key !== item.key) }))
                        }
                      />
                    ))}
                {workout && !(activeDay?.exercises.length) ? <RowsEmpty label="هنوز حرکتی اضافه نشده است؛ از ستون بانک انتخاب کنید." /> : null}
                {!workout && !(activeMeal?.items.length) ? <RowsEmpty label="هنوز ماده‌ای اضافه نشده است؛ از ستون بانک انتخاب کنید." /> : null}
              </div>
            </>
          )}
        </section>

        {/* left: bank */}
        <aside
          id="program-builder-bank"
          className={`${styles.prmBuilderBank} ${showBank ? styles.prmBuilderBankOpen : ""}`}
        >
          {showBank ? (
            <button type="button" className={styles.prmBankSheetClose} onClick={() => setShowBank(false)} aria-label="بستن بانک">
              <PrmIcon name="close" />
            </button>
          ) : null}
          <div className={styles.prmBankPickHead}>
            <h3>{workout ? "بانک حرکات" : "بانک مواد غذایی"}</h3>
            <small>با هر کلیک، آیتم به {workout ? "روز فعال" : "وعده فعال"} اضافه می‌شود.</small>
            <label className={styles.prmSearch}>
              <PrmIcon name="search" />
              <input value={bankQuery} onChange={(event) => setBankQuery(event.target.value)} placeholder="جستجو..." />
            </label>
            <div className={styles.prmBankTabs}>
              <button type="button" className={goalChip === "all" ? styles.prmChipActive : styles.prmChip} onClick={() => setGoalChip("all")}>
                همه
              </button>
              {MODE_OPTIONS.map(([mode, label]) => (
                <button key={mode} type="button" className={goalChip === mode ? styles.prmChipActive : styles.prmChip} onClick={() => setGoalChip(goalChip === mode ? "all" : mode)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.prmBankPickList}>
            {bankItems.map((item) => (
              <button key={item.key} type="button" className={styles.prmBankPick} onClick={() => insertBank(item)}>
                <span className={styles.prmBankPickBody}>
                  <b>{item.name}</b>
                  <small>{groupNameOf(workout ? item.group : item.category)}</small>
                </span>
                <span className={styles.prmBankPickUnit}>{unitName(api, item.unit ?? "")}</span>
                <span className={styles.prmBankPickAdd}>
                  <PrmIcon name="plus" />
                </span>
              </button>
            ))}
            {!bankItems.length ? (
              <div className={styles.prmBankPickEmpty}>موردی در این فیلتر نیست. به «بانک» بروید و آیتم اضافه کنید.</div>
            ) : null}
          </div>
        </aside>
      </div>

      {showBank ? <div className={styles.prmSheetOverlay} onClick={() => setShowBank(false)} /> : null}

      {preview ? (
        <PrmModal onClose={() => !saving && setPreview(false)} wide>
          <PrmModalHead title="پیش‌نمایش برنامه" onClose={() => !saving && setPreview(false)} subtitle={draft.title || "بدون عنوان"} />
          <div className={styles.prmPreviewBody}>
            <div className={styles.prmPreviewMeta}>
              <PrmBadge tone="orange">{MODE_LABEL[draft.mode]}</PrmBadge>
              {draft.goal ? <PrmBadge tone="gray">{goalLabel(draft.goal)}</PrmBadge> : null}
              <PrmBadge tone="gray">{draft.durationWeeks.toLocaleString("fa-IR")} هفته</PrmBadge>
              <PrmBadge tone="green">{totalBadge} کل</PrmBadge>
              <PrmBadge tone="gray">{completedLabel}</PrmBadge>
            </div>
            <div className={styles.prmPreviewList}>
              {(workout ? days : meals).map((row, index) => {
                const rows = workout ? (row as ProgramDay).exercises : (row as ProgramMeal).items;
                const sum = workout
                  ? (rows as ProgramExercise[]).reduce((s, r) => s + (r.sets || 0), 0)
                  : (rows as ProgramFoodItem[]).reduce((s, r) => s + (r.kcal || 0), 0);
                return (
                  <div key={row.key} className={styles.prmPreviewRow}>
                    <span className={styles.prmPreviewIndex}>{(index + 1).toLocaleString("fa-IR")}</span>
                    <span className={styles.prmPreviewMain}>
                      <b>{row.name || `${workout ? "روز" : "وعده"} ${index + 1}`}</b>
                      <small>
                        {rows.length} {workout ? "حرکت" : "ماده"} · {workout ? `${sum} ست` : `${sum} کیلوکالری`}
                      </small>
                    </span>
                    {rows.length === 0 ? <PrmBadge tone="red">ناقص</PrmBadge> : <PrmBadge tone="green">تکمیل</PrmBadge>}
                  </div>
                );
              })}
            </div>
            {athleteBound ? (
              <PrmNotice tone="orange">
                {resendOnSave
                  ? `این برنامه قبلاً برای ${initial?.athleteName ?? "شاگرد"} ارسال شده است؛ با ذخیره، نسخهٔ تازه خودکار دوباره برای او ارسال می‌شود.`
                  : `این برنامه برای ${initial?.athleteName ?? "شاگرد"} ساخته می‌شود و به‌محض «ذخیره» خودکار برای او ارسال می‌شود.`}
              </PrmNotice>
            ) : null}
            <div className={styles.prmSendFields}>
              {athleteBound ? (
                <div className={styles.prmBoundStudent}>
                  <span className={styles.prmWizTemplateIcon}>
                    <PrmIcon name="user" size={16} />
                  </span>
                  <span className={styles.prmWizTemplateBody}>
                    <small>شاگرد</small>
                    <b>{initial?.athleteName ?? "شاگرد"}</b>
                  </span>
                </div>
              ) : (
                <label className={styles.prmField}>
                  <span>شاگرد (برای ارسال)</span>
                  <PrmSelect
                    value={sendAthlete}
                    onChange={setSendAthlete}
                    options={athletes.map((athlete) => [String(athlete.id), athlete.name])}
                    placeholder="انتخاب شاگرد..."
                  />
                </label>
              )}
              <label className={styles.prmField}>
                <span>مدت (هفته)</span>
                <input className={styles.prmInput} type="number" min={1} value={draft.durationWeeks} onChange={(event) => setDraft((current) => ({ ...current, durationWeeks: Math.max(1, Number(event.target.value) || 4) }))} />
              </label>
            </div>
            {error ? <PrmNotice tone="red">{error}</PrmNotice> : null}
          </div>
          <div className={styles.prmPreviewActions}>
            <button type="button" className={styles.prmBtn} onClick={() => setFullPreview(true)} disabled={saving}>
              <PrmIcon name="eye" /> نمایش تمام‌صفحه
            </button>
            {!athleteBound ? (
              <button type="button" className={styles.prmBtn} onClick={() => void persist(false)} disabled={saving}>
                {saving ? "..." : "فقط ذخیره"}
              </button>
            ) : null}
            <button type="button" className={styles.prmBtnPrimary} onClick={() => void persist(true)} disabled={saving || !sendAthlete}>
              <PrmIcon name="send" /> {saving ? "در حال ارسال..." : athleteBound ? (resendOnSave ? "ذخیره و ارسال مجدد" : "ذخیره و ارسال برای شاگرد") : "ذخیره و ارسال"}
            </button>
          </div>
        </PrmModal>
      ) : null}

      {/* «پیش‌نمایش» — the same read-only full-screen view program cards open. */}
      {fullPreview ? <ProgramPreview item={previewSource} onClose={() => setFullPreview(false)} /> : null}

      {/* «ذخیره و ارسال برای شاگرد» — confirm the plan length before sending. */}
      {durationPrompt ? (
        <PrmModal onClose={() => !saving && setDurationPrompt(false)} small>
          <PrmModalHead
            title={resendOnSave ? "ارسال مجدد برنامه" : "ارسال برنامه برای شاگرد"}
            subtitle={draft.title || "بدون عنوان"}
            onClose={() => !saving && setDurationPrompt(false)}
          />
          <div className={styles.prmDurationBody}>
            <div className={styles.prmBoundStudent}>
              <span className={styles.prmWizTemplateIcon}>
                <PrmIcon name="user" size={16} />
              </span>
              <span className={styles.prmWizTemplateBody}>
                <small>شاگرد</small>
                <b>{initial?.athleteName ?? draft.athleteName ?? "شاگرد"}</b>
              </span>
            </div>
            <label className={styles.prmField}>
              <span>مدت زمان (هفته)</span>
              <input
                className={styles.prmInput}
                type="number"
                min={1}
                max={104}
                autoFocus
                value={durationInput}
                onChange={(event) => setDurationInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    setDurationPrompt(false);
                    void persist(false, normalizeWeeks(durationInput));
                  }
                }}
              />
            </label>
            <div className={styles.prmDurationChips}>
              {[2, 4, 6, 8, 12].map((weeks) => (
                <button
                  key={weeks}
                  type="button"
                  className={`${styles.prmDurationChip} ${normalizeWeeks(durationInput) === weeks ? styles.prmDurationChipActive : ""}`}
                  onClick={() => setDurationInput(String(weeks))}
                >
                  {weeks.toLocaleString("fa-IR")} هفته
                </button>
              ))}
            </div>
            <PrmNotice tone="orange">
              برنامه به مدت <b>{normalizeWeeks(durationInput).toLocaleString("fa-IR")} هفته</b> برای شاگرد فعال می‌شود و همین مدت در پنل او نمایش داده می‌شود.
            </PrmNotice>
            {error ? <PrmNotice tone="red">{error}</PrmNotice> : null}
          </div>
          <div className={styles.prmPreviewActions}>
            <button type="button" className={styles.prmBtn} onClick={() => setDurationPrompt(false)} disabled={saving}>
              انصراف
            </button>
            <button
              type="button"
              className={styles.prmBtnPrimary}
              disabled={saving}
              onClick={() => {
                setDurationPrompt(false);
                void persist(false, normalizeWeeks(durationInput));
              }}
            >
              <PrmIcon name="send" /> {saving ? "در حال ارسال..." : resendOnSave ? "ذخیره و ارسال مجدد" : "ذخیره و ارسال برای شاگرد"}
            </button>
          </div>
        </PrmModal>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------
// Row editors
// ------------------------------------------------------------------

function ExerciseRow({ api, index, row, onChange, onRemove }: { api: ProgramApi; index: number; row: ProgramExercise; onChange: (patch: Partial<ProgramExercise>) => void; onRemove: () => void }) {
  const numeric = (value: string) => Number(value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
  return (
    <div className={styles.prmRow}>
      <div className={styles.prmRowMain}>
        <div className={styles.prmBRowFields}>
          <span className={styles.prmBRowIndex}>{(index + 1).toLocaleString("fa-IR")}</span>
          <PrmTextInput className={styles.prmBRowName} value={row.name} placeholder="نام حرکت..." onChange={(event) => onChange({ name: event.target.value })} />
          <label className={styles.prmBRowNum}>
            <span>ست</span>
            <input type="number" min={1} value={row.sets} onChange={(event) => onChange({ sets: Math.max(1, numeric(event.target.value) || 1) })} />
          </label>
          <label className={styles.prmBRowNum}>
            <span>{unitName(api, row.unit)}</span>
            <input type="number" min={0} value={row.reps} onChange={(event) => onChange({ reps: Math.max(0, numeric(event.target.value)) })} />
          </label>
          <PrmSelect value={row.unit} onChange={(unit) => onChange({ unit, reps: unit === row.unit ? row.reps : defaultAmountForUnit(unit) })} options={api.state.units.map((unit) => [(unit as { code?: string }).code ?? unit.key, unit.name])} placeholder="واحد" />
          <label className={styles.prmBRowRest}>
            <span>استراحت</span>
            <input type="number" min={0} value={row.restSec} onChange={(event) => onChange({ restSec: Math.max(0, numeric(event.target.value)) })} />
            <em>ث</em>
          </label>
          <button type="button" className={styles.prmIconBtn} onClick={onRemove} aria-label="حذف حرکت">
            <PrmIcon name="trash" />
          </button>
        </div>
        <div className={styles.prmBRowNotes}>
          <input className={styles.prmBRowNote} value={row.note} placeholder="یادداشت مربی (اختیاری)..." onChange={(event) => onChange({ note: event.target.value })} />
          <input className={styles.prmBRowNote} value={row.alternative} placeholder="حرکت جایگزین (اختیاری)..." onChange={(event) => onChange({ alternative: event.target.value })} />
        </div>
      </div>
    </div>
  );
}

function FoodRow({ api, index, row, onChange, onRemove }: { api: ProgramApi; index: number; row: ProgramFoodItem; onChange: (patch: Partial<ProgramFoodItem>) => void; onRemove: () => void }) {
  const gramsPer = (unit: string) => {
    const unitRow = api.state.units.find((entry) => (entry as UnitRefItem).code === unit) as UnitRefItem | undefined;
    return unitRow && unitRow.grams ? unitRow.grams : 1;
  };
  const applyAmount = (amount: number, unit: string) => {
    const grams = Math.round(amount * gramsPer(unit));
    onChange({ amount, unit, grams, kcal: row.kcal });
  };
  const recalc = (amount: number, unit: string, kcal100?: number) => {
    const grams = Math.round(amount * gramsPer(unit));
    const kcal = kcal100 ? Math.round((grams / 100) * kcal100) : row.kcal;
    onChange({ amount, unit, grams, kcal });
  };
  return (
    <div className={styles.prmRow}>
      <div className={styles.prmRowMain}>
        <div className={styles.prmBRowFields}>
          <span className={styles.prmBRowIndex}>{(index + 1).toLocaleString("fa-IR")}</span>
          <PrmTextInput className={styles.prmBRowName} value={row.name} placeholder="نام ماده غذایی..." onChange={(event) => onChange({ name: event.target.value })} />
          <label className={styles.prmBRowNum}>
            <span>مقدار</span>
            <input type="number" min={0} value={row.amount} onChange={(event) => applyAmount(Math.max(0, Number(event.target.value)), row.unit)} />
          </label>
          <PrmSelect value={row.unit} onChange={(unit) => recalc(row.amount, unit)} options={api.state.units.map((unit) => [(unit as UnitRefItem).code ?? unit.key, unit.name])} placeholder="واحد" />
         
          <button type="button" className={styles.prmIconBtn} onClick={onRemove} aria-label="حذف ماده">
            <PrmIcon name="trash" />
          </button>
        </div>
        <div className={styles.prmBRowNotes}>
          <input className={styles.prmBRowNote} value={row.note} placeholder="یادداشت (اختیاری)..." onChange={(event) => onChange({ note: event.target.value })} />
          <input className={styles.prmBRowNote} value={row.alternative} placeholder="جایگزین (اختیاری)..." onChange={(event) => onChange({ alternative: event.target.value })} />
        </div>
      </div>
    </div>
  );
}

function RowsEmpty({ label }: { label: string }) {
  return <div className={styles.prmRowsEmpty}>{label}</div>;
}

// ------------------------------------------------------------------
// Deep copy helpers (fresh keys → safe to reuse as template)
// ------------------------------------------------------------------

function deepCopyDraft(draft: ProgramDraft, asNew: boolean): ProgramDraft {
  const newId = asNew ? undefined : draft.id;
  if (draft.domain === "workout") {
    const days = (draft.structure as ProgramDay[]).map((day) => ({
      ...day,
      key: freshKey("day"),
      serverId: asNew ? undefined : day.serverId,
      exercises: (day.exercises ?? []).map((exercise) => ({ ...exercise, key: freshKey("ex"), serverId: asNew ? undefined : exercise.serverId })),
    }));
    return { ...draft, id: newId, isNew: asNew ? true : draft.isNew, structure: days };
  }
  const meals = (draft.structure as ProgramMeal[]).map((meal) => ({
    ...meal,
    key: freshKey("meal"),
    serverId: asNew ? undefined : meal.serverId,
    items: (meal.items ?? []).map((item) => ({ ...item, key: freshKey("food"), serverId: asNew ? undefined : item.serverId })),
  }));
  return { ...draft, id: newId, isNew: asNew ? true : draft.isNew, structure: meals };
}

export function blankFromStructure(kind: ProgramDomain, structure: StructureItem[]): ProgramDraft {
  if (kind === "workout") {
    const source = structure.length ? structure : [{ key: "day", name: "روز ۱", tags: [] }];
    const days: ProgramDay[] = source.map((row, index) => ({
      key: freshKey("day"),
      name: row.name || `روز ${index + 1}`,
      muscles: [...row.tags],
      exercises: [],
    }));
    return { id: undefined, isNew: true, domain: "workout", title: "", mode: "volume", goal: undefined, athlete: null, durationWeeks: 4, isTemplate: false, sentAt: null, athleteName: null, structure: days };
  }
  const source = structure.length ? structure : [{ key: "meal", name: "وعده ۱", tags: ["breakfast"], kind: "breakfast" }];
  const meals: ProgramMeal[] = source.map((row, index) => ({
    key: freshKey("meal"),
    kind: row.kind ?? "extra",
    name: row.name || `وعده ${index + 1}`,
    category: row.tags[0] ?? "",
    items: [],
  }));
  return { id: undefined, isNew: true, domain: "nutrition", title: "", mode: "neutral", goal: undefined, athlete: null, durationWeeks: 4, isTemplate: false, sentAt: null, athleteName: null, structure: meals };
}