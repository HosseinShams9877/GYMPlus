"use client";

// =============================================================
// GymPlus+ Coach — program workspace (orchestrator per domain)
// Views: saved plans + templates · bank · settings.
// The editor (ProgramBuilder) replaces the workspace while open.
//
// Two create entry points (top of the plans view):
//   • «ساخت برنامه کلی»    → pick goal → blank builder (no student).
//   • «ساخت برنامه جدید»   → Dialog 1: pick a student (searchable list
//      with phone) → Dialog 2 «ساخت برنامه برای [name]»: method (use a
//      saved کلی program / from scratch) → goal → builder pre-loaded with
//      the student + goal; saving assigns + sends.
// «ارسال برای شاگرد» on a program card follows the same student dialog
// and opens the builder pre-loaded with that program, never a silent send.
// Server plans persist against the live /plans/ endpoints; reusable
// «برنامه کلی» templates are kept in localStorage for the milestone.
// =============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  MODE_LABEL,
  MODE_OPTIONS,
  PlanMode,
  ProgramDay,
  ProgramDomain,
  ProgramDraft,
  ProgramMeal,
  freshKey,
  modeOfGoal,
} from "../program.types";
import type { ServerNutritionPlan, ServerWorkoutPlan } from "../hooks/useProgramData";
import { programFetch, programToast, useProgramData } from "../hooks/useProgramData";
import { fetchPlanList } from "@/services/fetchService";
import { PrmBadge, PrmIcon, PrmModal, PrmModalHead, PrmNotice, PrmOffline } from "./programShared";
import { ProgramSettings } from "./ProgramSettings";
import { ProgramBank } from "./ProgramBank";
import { NutritionFoodBank } from "./NutritionFoodBank";
import { AthleteOption, ProgramBuilder, blankFromStructure, templateDraftCopy } from "./ProgramBuilder";
import { ProgramList, type PlanCardSource } from "./ProgramList";
import { StudentSelectDialog } from "./StudentSelectDialog";

import styles from "../program.module.css";

const TEMPLATE_KEY = "gymplus:program-templates:v1";

// ------------------------------------------------------------------
// local helpers
// ------------------------------------------------------------------

function loadTemplates(): ProgramDraft[] {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as ProgramDraft[];
    return Array.isArray(list) ? list.filter((item) => item && typeof item === "object") : [];
  } catch {
    return [];
  }
}

function saveTemplates(list: ProgramDraft[]) {
  try {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(list));
  } catch {
    /* storage full / private mode */
  }
}

/** Deep copy with fresh keys and no server ids — safe to store as a template. */
function cloneDraft(src: ProgramDraft, keepTitle: boolean): ProgramDraft {
  if (src.domain === "workout") {
    const days: ProgramDay[] = (src.structure as ProgramDay[]).map((day) => ({
      ...day,
      key: freshKey("day"),
      serverId: undefined,
      exercises: (day.exercises ?? []).map((exercise) => ({ ...exercise, key: freshKey("ex"), serverId: undefined })),
    }));
    return {
      ...src,
      id: undefined,
      isNew: true,
      isTemplate: true,
      title: keepTitle ? src.title : src.title,
      athlete: null,
      athleteName: null,
      sentAt: null,
      structure: days,
    };
  }
  const meals: ProgramMeal[] = (src.structure as ProgramMeal[]).map((meal) => ({
    ...meal,
    key: freshKey("meal"),
    serverId: undefined,
    items: (meal.items ?? []).map((item) => ({ ...item, key: freshKey("food"), serverId: undefined })),
  }));
  return {
    ...src,
    id: undefined,
    isNew: true,
    isTemplate: true,
    title: src.title,
    athlete: null,
    athleteName: null,
    sentAt: null,
    structure: meals,
  };
}

type RawExercise = { id?: number; name?: string; sets?: number; reps?: number; note?: string };
type RawDay = { id?: number; name?: string; exercises?: RawExercise[] };
type RawFoodItem = { id?: number; name?: string; amount_g?: number; note?: string };
type RawMeal = { id?: number; kind?: string; name?: string; items?: RawFoodItem[] };
type RawPlan = {
  id: number;
  title?: string;
  goal?: string | null;
  athlete?: number | null;
  athlete_name?: string | null;
  sent_at?: string | null;
  duration_weeks?: number;
  days?: RawDay[];
  meals?: RawMeal[];
};

function rawPlanToBundle(kind: ProgramDomain, raw: RawPlan): { draft: ProgramDraft; raw: ServerWorkoutPlan | ServerNutritionPlan | null } {
  if (kind === "workout") {
    const days: ProgramDay[] = (raw.days ?? []).map((day) => ({
      key: freshKey("day"),
      name: day.name || "",
      muscles: [],
      serverId: day.id,
      exercises: (day.exercises ?? []).map((exercise) => ({
        key: freshKey("ex"),
        name: exercise.name ?? "",
        sets: exercise.sets ?? 3,
        reps: exercise.reps ?? 12,
        unit: "reps",
        restSec: 60,
        note: exercise.note ?? "",
        alternative: "",
        serverId: exercise.id,
      })),
    }));
    const draft: ProgramDraft = {
      id: raw.id,
      isNew: false,
      domain: "workout",
      title: raw.title ?? "",
      mode: modeOfGoal("workout", raw.goal),
      goal: raw.goal ?? undefined,
      athlete: raw.athlete ?? null,
      durationWeeks: raw.duration_weeks ?? 4,
      isTemplate: false,
      sentAt: raw.sent_at ?? null,
      athleteName: raw.athlete_name ?? null,
      structure: days,
    };
    return { draft, raw: raw as unknown as ServerWorkoutPlan };
  }
  const meals: ProgramMeal[] = (raw.meals ?? []).map((meal) => {
    const items = meal.items ?? [];
    return {
      key: freshKey("meal"),
      kind: meal.kind ?? "extra",
      name: meal.name ?? "",
      category: "",
      items: items.map((item) => ({
        key: freshKey("food"),
        name: item.name ?? "",
        amount: Number(item.amount_g ?? 0) || 0,
        unit: "g",
        grams: Number(item.amount_g ?? 0) || 0,
        kcal: 0,
        note: item.note ?? "",
        alternative: "",
        serverId: item.id,
      })),
      serverId: meal.id,
    };
  });
  const draft: ProgramDraft = {
    id: raw.id,
    isNew: false,
    domain: "nutrition",
    title: raw.title ?? "",
    mode: modeOfGoal("nutrition", raw.goal),
    goal: raw.goal ?? undefined,
    athlete: raw.athlete ?? null,
    durationWeeks: raw.duration_weeks ?? 4,
    isTemplate: false,
    sentAt: raw.sent_at ?? null,
    athleteName: raw.athlete_name ?? null,
    structure: meals,
  };
  return { draft, raw: raw as unknown as ServerNutritionPlan };
}

function draftToListCard(draft: ProgramDraft, kind: ProgramDomain) {
  const structure = Array.isArray(draft.structure) ? draft.structure : [];
  const totalCount = structure.length;
  // Rows may come from localStorage templates / server rows that lack the
  // per-domain array — never read `.length` without a guard (render crash).
  const doneCount = structure.filter((row) => {
    if (kind === "workout") {
      const exercises = (row as ProgramDay).exercises;
      return Boolean(exercises && exercises.length > 0);
    }
    const items = (row as ProgramMeal).items;
    return Boolean(items && items.length > 0);
  }).length;
  return {
    id: draft.id ?? 0,
    title: draft.title,
    mode: draft.mode,
    goal: draft.goal,
    sentAt: draft.sentAt,
    athleteName: draft.athleteName,
    athlete: draft.athlete,
    durationWeeks: draft.durationWeeks,
    doneCount,
    totalCount,
  };
}

function defaultMode(kind: ProgramDomain): PlanMode {
  return kind === "workout" ? "volume" : "neutral";
}

/** Shared orange goal chips (حجم / کات / خنثی) for the create dialogs. */
function GoalChips({ value, onChange }: { value: PlanMode; onChange: (mode: PlanMode) => void }) {
  return (
    <div className={styles.prmModeSeg} role="radiogroup" aria-label="هدف برنامه">
      {MODE_OPTIONS.map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          data-mode={mode}
          className={`${styles.prmModeChip} ${value === mode ? styles.prmModeChipActive : ""}`}
          onClick={() => onChange(mode)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

type Wiz = { student: AthleteOption | null; method: "existing" | "scratch" | null; template: ProgramDraft | null; goal: PlanMode };

// ------------------------------------------------------------------
// workspace
// ------------------------------------------------------------------

type Editing = { draft: ProgramDraft | null; snapshot?: ServerWorkoutPlan | ServerNutritionPlan | null };

export function ProgramWorkspace({ kind }: { kind: ProgramDomain }) {
  const api = useProgramData(kind);
  const [view, setView] = useState<"plans" | "bank" | "settings">("plans");
  const [bundles, setBundles] = useState<Array<{ draft: ProgramDraft; raw: ServerWorkoutPlan | ServerNutritionPlan | null }>>([]);
  const [templates, setTemplates] = useState<ProgramDraft[]>([]);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState("");
  const [wizard, setWizard] = useState<Wiz | null>(null);
  const [goalOnly, setGoalOnly] = useState<PlanMode | null>(null);
  const [preview, setPreview] = useState<PlanCardSource | null>(null);
  const mounted = useRef(true);
  const editingRef = useRef(false);

  const unitWord = kind === "workout" ? "روز" : "وعده";

  useEffect(() => {
    editingRef.current = Boolean(editing);
  }, [editing]);

  const reload = useCallback(async () => {
    setLoadingPlans(true);
    setPlansError("");
    try {
      // plan list: real API first, dev-only sample-data fallback (fetchPlanList)
      const data = await fetchPlanList<{ results?: RawPlan[] } | RawPlan[]>(kind);
      const rows = Array.isArray(data) ? data : data?.results ?? [];
      setBundles(rows.filter((row) => row && typeof row.id === "number").map((row) => rawPlanToBundle(kind, row)));
    } catch {
      setPlansError("دریافت برنامه‌ها انجام نشد؛ وب‌سرویس در دسترس نیست.");
      setBundles([]);
    } finally {
      if (mounted.current) setLoadingPlans(false);
    }
  }, [kind]);

  useEffect(() => {
    mounted.current = true;
    setTemplates(loadTemplates());
    void reload();
    const onNewProgram = (event: Event) => {
      const domain = (event as CustomEvent).detail?.domain;
      // Only one program is ever created: opening the wizard is ignored
      // while the builder (editing) is already open.
      if (domain === kind && !editingRef.current) {
        setWizard({ student: null, method: null, template: null, goal: defaultMode(kind) });
      }
    };
    window.addEventListener("gymplus:program-new", onNewProgram);
    programFetch<
      | { results?: Array<{ id?: number; name?: string; full_name?: string; phone?: string; mobile?: string }> }
      | Array<{ id?: number; name?: string; full_name?: string; phone?: string; mobile?: string }>
    >("/coach/athletes/")
      .then((data) => {
        const rows = Array.isArray(data) ? data : data?.results ?? [];
        setAthletes(
          rows
            .filter((item) => item && typeof item.id === "number")
            .map((item) => {
              const phone = item.phone || item.mobile || "";
              const name = (item.name || item.full_name || "").trim();
              return {
                id: Number(item.id),
                name: name || `کاربر ${item.id}`,
                phone: phone || undefined,
              };
            }),
        );
      })
      .catch(() => setAthletes([]));
    return () => {
      mounted.current = false;
      window.removeEventListener("gymplus:program-new", onNewProgram);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistTemplates = (next: ProgramDraft[]) => {
    setTemplates(next);
    saveTemplates(next);
  };

  const toast = (message: string, tone: "success" | "info" = "success") => programToast(message, tone);

  const handleTemplate = (draft: ProgramDraft) => {
    const copy = cloneDraft(draft, true);
    persistTemplates([copy, ...templates.filter((item) => item.title !== copy.title)]);
    toast("قالب «برنامه کلی» ذخیره شد.");
  };

  const openCreateTemplate = (goal: PlanMode) => {
    const base = blankFromStructure(kind, api.state.structure);
    const preset: ProgramDraft = { ...base, mode: goal, goal: undefined, athlete: null, athleteName: null, sentAt: null };
    setGoalOnly(null);
    setEditing({ draft: preset, snapshot: undefined });
  };

  const openStudentBuilder = () => {
    if (!wizard?.student) return;
    const goal = wizard.goal;
    let base: ProgramDraft;
    if (wizard.method === "existing" && wizard.template) {
      base = cloneDraft(wizard.template, true);
    } else {
      base = blankFromStructure(kind, api.state.structure);
    }
    const preset: ProgramDraft = {
      ...base,
      mode: goal,
      goal: undefined,
      isTemplate: false,
      title: wizard.method === "existing" && wizard.template ? wizard.template.title : base.title,
      durationWeeks: wizard.template?.durationWeeks || base.durationWeeks || 4,
      athlete: wizard.student.id,
      athleteName: wizard.student.name,
      sentAt: null,
    };
    const student = wizard.student;
    setWizard(null);
    setEditing({ draft: preset, snapshot: undefined });
    toast(`شاگرد «${student.name}» در برنامه‌ساز انتخاب شد.`);
  };

  // ------------------------------------------------ card actions
  const listItems = useMemo<PlanCardSource[]>(() => {
    const planItems: PlanCardSource[] = bundles.map((bundle) => ({
      ...draftToListCard(bundle.draft, kind),
      uid: `plan-${bundle.draft.id}`,
      local: false,
      draft: bundle.draft,
    }));
    const templateItems: PlanCardSource[] = templates.map((template, index) => ({
      ...draftToListCard(template, kind),
      id: 0,
      sentAt: null,
      athlete: null,
      athleteName: null,
      uid: `tpl-${index}-${template.title}`,
      local: true,
      draft: template,
    }));
    return [...planItems, ...templateItems];
  }, [bundles, templates, kind]);

  const openForEdit = (item: PlanCardSource) => {
    if (item.local) {
      // Editing a reusable «برنامه کلی» template: start a fresh editable
      // copy (save-as-template overwrites it; a normal save makes a new plan).
      setEditing({ draft: cloneDraft(item.draft, true), snapshot: undefined });
      return;
    }
    const bundle = bundles.find((entry) => entry.draft.id === item.id);
    if (!bundle) return;
    setEditing({ draft: bundle.draft, snapshot: bundle.raw });
  };

  const openForClone = (item: PlanCardSource) => {
    setEditing({ draft: templateDraftCopy(item.draft), snapshot: undefined });
  };

  const removeProgram = async (item: PlanCardSource) => {
    if (item.local) {
      persistTemplates(templates.filter((template) => template !== item.draft));
      toast("قالب «برنامه کلی» حذف شد.");
      return;
    }
    try {
      await api.deletePlan(kind, item.id);
      setBundles((current) => current.filter((bundle) => bundle.draft.id !== item.id));
      toast("برنامه حذف شد.");
    } catch {
      toast("حذف انجام نشد؛ وب‌سرویس در دسترس نیست.", "info");
    }
  };

  // ------------------------------------------------ ارسال برای شاگرد
  // Picking a student on any کلی program opens the ProgramBuilder with a
  // fresh copy of the program pre-loaded and that student selected — never a
  // silent send. The coach reviews/edits, then the save (the draft is bound
  // to the student) assigns + sends it and a new «برنامه [name]» card with
  // the «ارسالشده» badge appears; the original card stays untouched.
  const openSendBuilder = (item: PlanCardSource, athleteId: number) => {
    if (editingRef.current) return; // builder already open — ignore
    const athlete = athletes.find((entry) => entry.id === athleteId);
    if (!athlete) return;
    const copy = cloneDraft(item.draft, true);
    copy.isTemplate = false;
    copy.athlete = athlete.id;
    copy.athleteName = athlete.name;
    copy.sentAt = null;
    copy.durationWeeks = item.durationWeeks || copy.durationWeeks || 4;
    setEditing({ draft: copy, snapshot: undefined });
    toast(`شاگرد «${athlete.name}» انتخاب شد؛ برنامه را بررسی کنید — با «ذخیره» برای او ارسال می‌شود.`);
  };

  const startPreviewEdit = (item: PlanCardSource) => {
    setPreview(null);
    openForEdit(item);
  };

  if (editing) {
    return (
      <div className={styles.prmWs}>
        <ProgramBuilder
          key={editing.draft?.id ?? "new"}
          kind={kind}
          api={api}
          initial={editing.draft}
          snapshot={editing.snapshot}
          athletes={athletes}
          onExit={() => setEditing(null)}
          onSaved={(id, sent) => {
            toast(sent ? "برنامه ذخیره و برای شاگرد ارسال شد." : "برنامه ذخیره شد.");
            setEditing(null);
            void reload();
          }}
          onSaveTemplate={handleTemplate}
        />
      </div>
    );
  }

  const groupsLabel = kind === "workout" ? "گروه عضلانی" : "دسته غذایی";
  const pageTitle = kind === "workout" ? "برنامه تمرینی" : "برنامه غذایی";

  return (
    <div className={styles.prmWs}>
      <header className={styles.prmWsHead}>
        <span className={styles.prmWsTitle}>
          <h2>{pageTitle}</h2>
          <small>{kind === "workout" ? "برنامه‌های هفتگی تمرین و قالب‌ها" : "برنامه‌های غذایی و قالب‌ها"}</small>
        </span>
        {view === "plans" ? (
          <div className={styles.prmWsActions}>
            <button type="button" className={styles.prmBtnGhost} onClick={() => setGoalOnly(defaultMode(kind))}>
              <PrmIcon name="copy" /> ساخت برنامه کلی
            </button>
            <button type="button" className={styles.prmBtnPrimary} onClick={() => setWizard({ student: null, method: null, template: null, goal: defaultMode(kind) })}>
              <PrmIcon name="plus" /> ساخت برنامه جدید
            </button>
          </div>
        ) : null}
      </header>

      <nav className={styles.prmWsTabs} aria-label="بخش‌های برنامه">
        {(
          [
            ["plans", "برنامه‌ها", "grid"],
            ["bank", kind === "workout" ? "بانک حرکات" : "بانک غذا", "training"],
            ["settings", "تنظیمات", "settings"],
          ] as Array<["plans" | "bank" | "settings", string, "grid" | "training" | "settings"]>
        ).map(([value, label, icon]) => (
          <button
            key={value}
            type="button"
            className={`${styles.prmWsTab} ${view === value ? styles.prmWsTabActive : ""}`}
            onClick={() => setView(value)}
          >
            <PrmIcon name={icon} size={16} /> {label}
          </button>
        ))}
      </nav>

      {!api.online ? (
        <div className={styles.prmWsOffline}>
          <PrmOffline onRetry={() => void api.refresh()}>
            وب‌سرویس مرجع (/coach/*) هنوز پاسخ نمی‌دهد؛ از داده نمونه استفاده می‌شود و تغییرات تا راه‌اندازی آن محلی می‌مانند.
          </PrmOffline>
        </div>
      ) : null}

      {view === "settings" ? <ProgramSettings kind={kind} api={api} groupsLabel={groupsLabel} /> : null}
      {view === "bank" ? (kind === "workout" ? <ProgramBank kind={kind} api={api} /> : <NutritionFoodBank api={api} />) : null}

      {view === "plans" ? (
        loadingPlans ? (
          <div className={styles.prmWsLoading}>
            <span className={styles.prmSpinner} /> در حال دریافت برنامه‌ها...
          </div>
        ) : (
          <>
            {plansError ? <div className={styles.prmWsError}>{plansError}</div> : null}
            <ProgramList
              kind={kind}
              items={listItems}
              students={athletes}
              onEdit={openForEdit}
              onClone={openForClone}
              onPreview={setPreview}
              onDelete={(item) => void removeProgram(item)}
              onSend={(item, athleteId) => openSendBuilder(item, athleteId)}
            />
          </>
        )
      ) : null}

      {/* ---------------- ساخت برنامه کلی: goal-only picker ---------------- */}
      {goalOnly ? (
        <PrmModal onClose={() => setGoalOnly(null)} small>
          <PrmModalHead title="ساخت برنامه کلی" subtitle="هدف برنامه را انتخاب کنید؛ بدون شاگرد ساخته می‌شود و بعد قابل ارسال است." onClose={() => setGoalOnly(null)} />
          <div className={styles.prmWizBody}>
            <GoalChips value={goalOnly} onChange={setGoalOnly} />
            <div className={styles.prmConfirmActions}>
              <button type="button" className={styles.prmBtn} onClick={() => setGoalOnly(null)}>
                انصراف
              </button>
              <button type="button" className={styles.prmBtnPrimary} onClick={() => openCreateTemplate(goalOnly)}>
                <PrmIcon name="copy" /> باز کردن برنامه‌ساز
              </button>
            </div>
          </div>
        </PrmModal>
      ) : null}

      {/* ---------------- ساخت برنامه جدید: student wizard ---------------- */}
      {/* Dialog 1 — «انتخاب شاگرد» (shared with «ارسال برای شاگرد») */}
      {wizard && !wizard.student ? (
        <StudentSelectDialog
          students={athletes}
          title="انتخاب شاگرد"
          subtitle="ساخت برنامه جدید"
          note="برنامه برای کدام شاگرد ساخته می‌شود؟"
          onPick={(student) => setWizard({ ...wizard, student, method: null, template: null, goal: defaultMode(kind) })}
          onClose={() => setWizard(null)}
        />
      ) : null}

      {/* Dialog 2 — «ساخت برنامه برای [name]»: روش ساخت ← انتخاب قالب ← هدف */}
      {wizard && wizard.student ? (
        <PrmModal onClose={() => setWizard(null)} small>
          <PrmModalHead
            title={`ساخت برنامه برای ${wizard.student.name}`}
            subtitle={
              wizard.method
                ? wizard.method === "existing" && !wizard.template
                  ? "انتخاب برنامه آماده"
                  : "هدف برنامه را مشخص کنید"
                : "روش ساخت برنامه"
            }
            onClose={() => setWizard(null)}
          />
          <div className={styles.prmWizBody}>
            {!wizard.method ? (
              // ---- step 2: method
              <>
                <p className={styles.prmWizHint}>
                  برنامه برای «{wizard.student.name}»: از یک برنامهٔ آماده شروع کنید یا از صفر بسازید؟
                </p>
                <div className={styles.prmWizMethod}>
                  <button type="button" onClick={() => setWizard({ ...wizard, method: "existing", template: null })}>
                    <span className={styles.prmWizMethodIcon}>
                      <PrmIcon name="copy" size={22} />
                    </span>
                    <span>
                      <b>استفاده از برنامه آماده</b>
                      <small>از بین «برنامه‌های کلی» ذخیره‌شده انتخاب و برای شاگرد شخصی‌سازی کنید.</small>
                    </span>
                  </button>
                  <button type="button" onClick={() => setWizard({ ...wizard, method: "scratch", template: null })}>
                    <span className={styles.prmWizMethodIcon}>
                      <PrmIcon name="plus" size={22} />
                    </span>
                    <span>
                      <b>ساخت برنامه از صفر</b>
                      <small>یک برنامه خالی برای این شاگرد بسازید.</small>
                    </span>
                  </button>
                </div>
                <button type="button" className={styles.prmWizBack} onClick={() => setWizard({ ...wizard, student: null })}>
                  <PrmIcon name="caret" size={14} /> بازگشت به انتخاب شاگرد
                </button>
              </>
            ) : wizard.method === "existing" && !wizard.template ? (
              // ---- step 3: pick a saved کلی program
              <>
                <p className={styles.prmWizHint}>کدام «برنامه کلی» را برای «{wizard.student.name}» استفاده کنیم؟</p>
                <div className={styles.prmWizStudents}>
                  {templates.length ? (
                    templates.map((template, index) => {
                      const structure = Array.isArray(template.structure) ? template.structure : [];
                      const count = structure.length;
                      const done = structure.filter((row) => {
                        if (kind === "workout") {
                          const exercises = (row as ProgramDay).exercises;
                          return Boolean(exercises && exercises.length > 0);
                        }
                        const items = (row as ProgramMeal).items;
                        return Boolean(items && items.length > 0);
                      }).length;
                      return (
                        <button
                          key={`${template.title}-${index}`}
                          type="button"
                          className={styles.prmWizStudent}
                          onClick={() => setWizard({ ...wizard, template, goal: template.mode })}
                        >
                          <i className={styles.prmWizStudentIcon}>
                            <PrmIcon name="copy" size={16} />
                          </i>
                          <span className={styles.prmWizStudentBody}>
                            <b>{template.title}</b>
                            <small>
                              {MODE_LABEL[template.mode]} · {done.toLocaleString("fa-IR")} از {count.toLocaleString("fa-IR")} {unitWord} تکمیل
                            </small>
                          </span>
                          <PrmIcon name="caret" size={16} />
                        </button>
                      );
                    })
                  ) : (
                    <PrmNotice tone="orange">
                      هیچ «برنامه کلی» ذخیره‌شده‌ای نیست. اول از «ساخت برنامه کلی» یک قالب بسازید، یا از صفر شروع کنید.
                    </PrmNotice>
                  )}
                </div>
                <div className={styles.prmWizActions}>
                  <button type="button" className={styles.prmWizBack} onClick={() => setWizard({ ...wizard, method: null })}>
                    <PrmIcon name="caret" size={14} /> انتخاب روش دیگر
                  </button>
                  {!templates.length ? (
                    <button type="button" className={styles.prmBtnPrimary} onClick={() => setWizard({ ...wizard, method: "scratch", template: null })}>
                      <PrmIcon name="plus" /> ساخت از صفر
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              // ---- final: goal, then open the builder pre-configured
              <>
                <div className={styles.prmWizTemplate}>
                  <span className={styles.prmWizTemplateIcon}>
                    <PrmIcon name="grid" size={16} />
                  </span>
                  <span className={styles.prmWizTemplateBody}>
                    <small>شاگرد</small>
                    <b>{wizard.student.name}</b>
                  </span>
                  {wizard.template ? (
                    <span className={styles.prmWizTemplateBody}>
                      <small>از قالب</small>
                      <b>{wizard.template.title}</b>
                    </span>
                  ) : (
                    <span className={styles.prmWizTemplateBody}>
                      <small>از صفر</small>
                      <b>خالی</b>
                    </span>
                  )}
                </div>
                <p className={styles.prmWizHint}>هدف برنامه را انتخاب کنید (در برنامه‌ساز هم قابل تغییر است):</p>
                <GoalChips value={wizard.goal} onChange={(goal) => setWizard({ ...wizard, goal })} />
                {wizard.method === "existing" ? (
                  <button type="button" className={styles.prmWizBack} onClick={() => setWizard({ ...wizard, template: null })}>
                    <PrmIcon name="copy" size={14} /> تغییر قالب
                  </button>
                ) : null}
                <div className={styles.prmConfirmActions}>
                  <button type="button" className={styles.prmBtn} onClick={() => setWizard(null)}>
                    انصراف
                  </button>
                  <button type="button" className={styles.prmBtnPrimary} onClick={openStudentBuilder}>
                    <PrmIcon name="plus" /> باز کردن برنامه‌ساز
                  </button>
                </div>
              </>
            )}
          </div>
        </PrmModal>
      ) : null}

      {/* ---------------- read-only card preview ---------------- */}
      {preview ? (
        <PrmModal onClose={() => setPreview(null)} wide>
          <PrmModalHead title="پیش‌نمایش برنامه" onClose={() => setPreview(null)} subtitle={preview.title || "بدون عنوان"} />
          <div className={styles.prmPreviewBody}>
            <div className={styles.prmPreviewMeta}>
              <PrmBadge tone="orange">{MODE_LABEL[preview.mode]}</PrmBadge>
              {Boolean(preview.athleteName) ? <PrmBadge tone="green">برنامه {preview.athleteName}</PrmBadge> : <PrmBadge tone="gray">برنامه کلی</PrmBadge>}
              <PrmBadge tone="gray">{(preview.durationWeeks || 4).toLocaleString("fa-IR")} هفته</PrmBadge>
              <PrmBadge tone="gray">
                {preview.doneCount.toLocaleString("fa-IR")} از {preview.totalCount.toLocaleString("fa-IR")} {unitWord} تکمیل
              </PrmBadge>
            </div>
            <div className={styles.prmPreviewList}>
              {(kind === "workout" ? (preview.draft.structure as ProgramDay[]) : (preview.draft.structure as ProgramMeal[])).map((row, index) => {
                const rows = kind === "workout" ? ((row as ProgramDay).exercises ?? []) : ((row as ProgramMeal).items ?? []);
                const sum = kind === "workout" ? rows.reduce((s, r) => s + ((r as { sets?: number }).sets || 0), 0) : rows.reduce((s, r) => s + ((r as { kcal?: number }).kcal || 0), 0);
                return (
                  <div key={row.key} className={styles.prmPreviewRow}>
                    <span className={styles.prmPreviewIndex}>{(index + 1).toLocaleString("fa-IR")}</span>
                    <span className={styles.prmPreviewMain}>
                      <b>{row.name || `${unitWord} ${index + 1}`}</b>
                      <small>
                        {rows.length} {kind === "workout" ? "حرکت" : "ماده"} · {kind === "workout" ? `${sum} ست` : `${sum} کیلوکالری`}
                      </small>
                    </span>
                    {rows.length === 0 ? <PrmBadge tone="red">ناقص</PrmBadge> : <PrmBadge tone="green">تکمیل</PrmBadge>}
                  </div>
                );
              })}
            </div>
          </div>
          <div className={styles.prmPreviewActions}>
            <button type="button" className={styles.prmBtn} onClick={() => setPreview(null)}>
              بستن
            </button>
            <button type="button" className={styles.prmBtnPrimary} onClick={() => startPreviewEdit(preview)}>
              <PrmIcon name="edit" /> ویرایش برنامه
            </button>
          </div>
        </PrmModal>
      ) : null}
    </div>
  );
}
