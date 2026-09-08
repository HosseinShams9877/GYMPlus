"use client";

// =============================================================
// GymPlus+ Coach — food bank (nutrition)
// Meal-based categories (صبحانه/ناهار/شام/میان‌وعده).
//   • Quick entry is a SEPARATE section above the list:
//     pick دسته/واحد/هدف + type name → «افزودن» queues the row in a
//     PENDING list (nothing saved yet). Rows can be edited/deleted
//     there; «تایید نهایی» saves every pending row at once and the
//     list clears. Items then appear in the bank below.
//     Fast entry: the name field also accepts «نام | واحد | هدف» —
//     an unknown unit is auto-created (and then listed in the واحد
//     selector) and the goal is assigned to the pending row.
//   • The bank list is VIEW-ONLY (search + category + goal filters,
//     status toggle, inline edit, delete with confirm). No add
//     button in the list — creation only happens via quick entry.
// =============================================================

import { useEffect, useMemo, useRef, useState } from "react";

import { BankItem, MODE_OPTIONS, PlanMode, freshKey } from "../program.types";
import { useProgramData } from "../hooks/useProgramData";
import {
  PrmBadge,
  PrmConfirm,
  PrmEmpty,
  PrmIcon,
  PrmNotice,
  PrmSelect,
  PrmTextInput,
  PrmToggle,
} from "./programShared";
import { unitName } from "./ProgramBank";

import styles from "../program.module.css";

type ProgramApi = ReturnType<typeof useProgramData>;

/** meal-based category order for selects/filters */
const CATEGORY_ORDER = ["breakfast", "lunch", "dinner", "snack"];
/** preferred unit order shown in the quick-entry selects */
const UNIT_ORDER = ["g", "cup", "glass", "piece", "tbsp", "palm", "fist", "slice"];

type PendingRow = {
  key: string;
  name: string;
  category: string;
  unit: string;
  goal: PlanMode | "";
};

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("fa-IR")
    .replaceAll("ي", "ی")
    .replaceAll("ك", "ک")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function goalLabel(mode: PlanMode): string {
  return MODE_OPTIONS.find(([value]) => value === mode)?.[1] ?? "";
}

// ---------------------------------------------------------------
// inline «نام | واحد | هدف» quick-entry parser
// ---------------------------------------------------------------

/** goal words → PlanMode (same vocabulary ProgramBank uses). */
const GOAL_TERMS: Array<[string, PlanMode]> = [
  ["حجم", "volume"], ["هیپرتروفی", "volume"], ["قدرت", "volume"], ["strength", "volume"], ["mass", "volume"],
  ["کات", "cut"], ["کاهش", "cut"], ["چربی", "cut"], ["fat", "cut"], ["loss", "cut"], ["cut", "cut"],
  ["خنثی", "neutral"], ["ثابت", "neutral"], ["تناسب", "neutral"], ["maintenance", "neutral"], ["neutral", "neutral"],
];

function matchGoal(token: string): PlanMode | null {
  const key = normalize(token);
  if (!key) return null;
  for (const [word, mode] of GOAL_TERMS) {
    if (key.includes(normalize(word))) return mode;
  }
  return null;
}

type UnitLike = { key: string; name: string; code?: string; disabled?: boolean };
type UnitMatch = { code: string; name: string; exists: boolean };

function unitCodeOf(entry: UnitLike): string {
  return entry.code ?? entry.key;
}

/**
 * Resolve a free-text unit token against the unit list.
 * exists=true  → reuse the matched unit's code;
 * exists=false → return the code the store would create for it
 *                (caller must add the unit via api.unitAddMany).
 */
function resolveUnitInfo(units: UnitLike[], token: string): UnitMatch {
  const key = normalize(token);
  if (key) {
    for (const entry of units) {
      if (normalize(entry.name) === key || normalize(unitCodeOf(entry)) === key) {
        return { code: unitCodeOf(entry), name: entry.name, exists: true };
      }
    }
  }
  // code derivation matches api.unitAddMany (unitAddMany in useProgramData)
  const code = token.replaceAll(" ", "-").toLowerCase();
  return { code, name: token, exists: false };
}

/** Split «نام | واحد | هدف» — unit/goal tokens optional; requires a name. */
function splitInline(raw: string): { name: string; unitToken: string; goalToken: string } | null {
  const parts = raw.split("|").map((part) => part.trim());
  if (parts.length < 2 || !parts[0]) return null;
  return { name: parts[0], unitToken: parts[1] ?? "", goalToken: parts[2] ?? "" };
}

export function NutritionFoodBank({ api }: { api: ProgramApi }) {
  const items = api.state.bank;
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [goalFilter, setGoalFilter] = useState<PlanMode | "all">("all");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editKcal, setEditKcal] = useState("");
  const [deleting, setDeleting] = useState<BankItem | null>(null);

  // ------------------------------------------------- quick entry + pending
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [pendingEditKey, setPendingEditKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("g");
  const [goal, setGoal] = useState<PlanMode | "">("neutral");
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);
  // guards against double-adding the same unit while a unitAddMany is in flight
  const pendingUnitAdds = useRef(new Set<string>());

  // ------------------------------------------------- derived reference lists
  const orderedCategories = useMemo(() => {
    const enabled = api.state.groups.filter((group) => !group.disabled);
    const rest = new Map(enabled.map((group) => [group.key, group]));
    const ordered: typeof enabled = [];
    for (const key of CATEGORY_ORDER) {
      const found = rest.get(key);
      if (found) {
        ordered.push(found);
        rest.delete(key);
      }
    }
    return [...ordered, ...rest.values()];
  }, [api.state.groups]);

  const orderedUnits = useMemo(() => {
    const enabled = api.state.units.filter((entry) => !entry.disabled);
    const byCode = new Map<string, (typeof enabled)[number]>();
    for (const entry of enabled) byCode.set((entry as { code?: string }).code ?? entry.key, entry);
    const ordered: (typeof enabled)[number][] = [];
    for (const code of UNIT_ORDER) {
      const found = byCode.get(code);
      if (found) {
        ordered.push(found);
        byCode.delete(code);
      }
    }
    return [...ordered, ...byCode.values()];
  }, [api.state.units]);

  const categoryName = (key?: string) => api.state.groups.find((group) => group.key === key)?.name ?? (key ? key : "—");
  const toast = (message: string, tone: "success" | "info" | "error" = "success") => {
    window.dispatchEvent(new CustomEvent("gymplus:coach-toast", { detail: { message, tone } }));
  };

  // ------------------------------------- inline «نام | واحد | هدف» quick entry
  /** Reuse an existing unit's code — or create the unit (once) on the fly. */
  const ensureUnitCode = (token: string): string => {
    const info = resolveUnitInfo(api.state.units, token);
    if (info.exists) return info.code;
    const mark = normalize(token);
    if (mark && !pendingUnitAdds.current.has(mark)) {
      pendingUnitAdds.current.add(mark);
      void api.unitAddMany([token]);
    }
    return info.code;
  };

  /** Side-effect-free live read of the typed text when it contains "|". */
  const inlineInfo = useMemo(() => {
    const parts = splitInline(name);
    if (!parts) return null;
    const unitInfo = parts.unitToken ? resolveUnitInfo(api.state.units, parts.unitToken) : null;
    const goalMode = parts.goalToken ? matchGoal(parts.goalToken) : null;
    return {
      name: parts.name,
      unit: unitInfo,
      goal: goalMode ? goalLabel(goalMode) : "",
      goalSet: Boolean(parts.goalToken),
      goalMatched: Boolean(goalMode),
    };
  }, [name, api.state.units]);

  // ----------------------------------------------- "added this session" strip
  const baseline = useRef<Set<string> | null>(null);
  const everOnline = useRef(false);
  if (baseline.current === null) baseline.current = new Set(items.map((item) => item.key));
  useEffect(() => {
    if (api.online && !everOnline.current) {
      everOnline.current = true;
      baseline.current = new Set(api.state.bank.map((item) => item.key));
    }
  }, [api.online, api.state.bank]);
  const sessionItems = items.filter((item) => !baseline.current!.has(item.key));

  // effective category — falls back to the first meal category until the coach picks one
  const categoryKey = category || orderedCategories[0]?.key || "";
  const trimmedHasPipe = name.includes("|");

  const addPending = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!categoryKey) return;
    const parsed = splitInline(trimmed);
    // a "|" present but malformed (e.g. empty name) → nothing useful to add
    if (trimmed.includes("|") && !parsed) return;
    let rowName = trimmed;
    let rowUnit = unit;
    let rowGoal: PlanMode | "" = goal;
    if (parsed) {
      rowName = parsed.name;
      if (parsed.unitToken) rowUnit = ensureUnitCode(parsed.unitToken);
      // an explicit-but-unrecognized goal token → leave unset rather than guess
      rowGoal = parsed.goalToken ? (matchGoal(parsed.goalToken) ?? "") : goal;
    }
    setPending((current) => [...current, { key: freshKey("pend"), name: rowName, category: categoryKey, unit: rowUnit, goal: rowGoal }]);
    setName("");
    setPendingEditKey(null);
    requestAnimationFrame(() => nameRef.current?.focus());
  };

  const editPending = (key: string, patch: Partial<Pick<PendingRow, "name" | "category" | "unit" | "goal">>) => {
    setPending((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const confirmPending = async () => {
    if (!pending.length || busy) return;
    setBusy(true);
    const existingNames = new Set(items.map((item) => normalize(item.name)));
    let added = 0;
    let duplicates = 0;
    for (const row of pending) {
      const key = normalize(row.name);
      if (existingNames.has(key)) {
        duplicates += 1;
        continue;
      }
      existingNames.add(key);
      added += await api.bankAdd([row.name], {
        name: row.name,
        unit: row.unit || "g",
        category: row.category,
        goals: row.goal ? [row.goal] : [],
      });
    }
    setBusy(false);
    if (added > 0) {
      toast(
        duplicates > 0
          ? `${added.toLocaleString("fa-IR")} ماده ثبت شد؛ ${duplicates.toLocaleString("fa-IR")} مورد تکراری نادیده گرفته شد.`
          : `${added.toLocaleString("fa-IR")} ماده در بانک ثبت شد.`,
        duplicates > 0 ? "info" : "success",
      );
      setPending([]);
      setPendingEditKey(null);
    } else {
      toast(duplicates > 0 ? "همه موارد تکراری‌اند و در بانک موجودند." : "موردی برای ثبت وجود ندارد.", "info");
    }
  };

  // ------------------------------------------------- list (view-only) filters
 const filtered = useMemo(() => {
  const q = normalize(query);
  return items.filter((item) => {
    // این خط رو حذف کنید یا کامنت کنید
    // if (item.disabled && !q) return false;
    
    if (q && !normalize(`${item.name} ${categoryName(item.category)}`).includes(q)) return false;
    if (catFilter !== "all" && item.category !== catFilter) return false;
    if (goalFilter !== "all" && !(item.goals ?? []).includes(goalFilter)) return false;
    return true;
  });
}, [items, query, catFilter, goalFilter]);
  const startEdit = (item: BankItem) => {
    setEditingKey(item.key);
    setEditName(item.name);
    setEditKcal(item.kcal100 != null ? String(item.kcal100) : "");
  };

  const commitEdit = (item: BankItem) => {
    const patch: Partial<BankItem> = {};
    const nextName = editName.trim();
    if (nextName && nextName !== item.name) patch.name = nextName;
    const kcal = Number(editKcal);
    if (editKcal.trim() && !Number.isNaN(kcal) && kcal >= 0) patch.kcal100 = kcal;
    if (Object.keys(patch).length) void api.bankUpdate(item.key, patch);
    setEditingKey(null);
  };

  const toggleGoal = (item: BankItem, mode: PlanMode) => {
    const goals = item.goals ?? [];
    const next = goals.includes(mode) ? goals.filter((g) => g !== mode) : [...goals, mode];
    void api.bankUpdate(item.key, { goals: next });
  };

  const hasAnyFilters = query.trim().length > 0 || catFilter !== "all" || goalFilter !== "all";
  const noItems = items.length === 0;

  return (
    <>
      {/* ============================================================
          Quick entry (separate section) — feeds the pending list only
          ============================================================ */}
      <section className={styles.prmPanel}>
        <header className={styles.prmPanelHead}>
          <span>
            <h2>ثبت سریع در بانک</h2>
            <small>دسته را انتخاب کنید و نام ماده را بنویسید؛ ثبت سریع‌تر با فرمت «نام | واحد | هدف» هم پشتیبانی می‌شود. در پایان «تایید نهایی» را بزنید.</small>
          </span>
          <PrmBadge tone="green">ثبت چندتایی</PrmBadge>
        </header>

        <div className={styles.prmFoodQuick}>
          <div className={styles.prmFoodQuickGrid}>
            <label className={styles.prmQuickField}>
              <span>دسته (وعده)</span>
              <PrmSelect
                value={categoryKey}
                onChange={setCategory}
                options={orderedCategories.map((group) => [group.key, group.name])}
                placeholder="انتخاب دسته"
              />
            </label>
            <label className={styles.prmQuickField}>
              <span>واحد اندازه</span>
              <PrmSelect
                value={unit}
                onChange={setUnit}
                options={orderedUnits.map((entry) => [(entry as { code?: string }).code ?? entry.key, entry.name])}
                placeholder="انتخاب واحد"
              />
            </label>
            <label className={styles.prmQuickField}>
              <span>هدف</span>
              <PrmSelect
                value={goal}
                onChange={(value) => setGoal((value || "neutral") as PlanMode | "")}
                options={MODE_OPTIONS}
                placeholder="بدون هدف"
              />
            </label>
          </div>
          <div className={styles.prmFoodNameAdd}>
            <input
              ref={nameRef}
              className={styles.prmFoodNameInput}
              value={name}
              placeholder="نام ماده غذایی — یا سریع: «تخم‌مرغ | عدد | حجم»"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addPending();
                }
              }}
            />
            <button type="button" className={styles.prmBtnPrimary} onClick={addPending} disabled={!name.trim() || !categoryKey}>
              <PrmIcon name="plus" /> افزودن به لیست
            </button>
          </div>

          {trimmedHasPipe ? (
            <p className={styles.prmQuickHelp}>
              با جداکننده «|» وارد می‌شود: نام، واحد و هدف. اگر واحد در فهرست نباشد هنگام «افزودن» خودکار ساخته و به کادر واحد اضافه می‌شود.
            </p>
          ) : null}
          {inlineInfo ? (
            <div className={styles.prmInlinePreview}>
              <span className={styles.prmInlinePreviewLabel}>پیش‌نمایش:</span>
              <b>{inlineInfo.name}</b>
              <span className={styles.prmInlineSep}>|</span>
              {inlineInfo.unit ? (
                <span className={`${styles.prmFoodPendingChip} ${inlineInfo.unit.exists ? "" : styles.prmQuickNewUnit}`}>
                  {inlineInfo.unit.exists ? inlineInfo.unit.name : `${inlineInfo.unit.name} (واحد جدید)`}
                </span>
              ) : (
                <span className={styles.prmFoodPendingChip}>{unitName(api, unit)}</span>
              )}
              <span className={styles.prmInlineSep}>|</span>
              <span className={`${styles.prmFoodPendingChip} ${inlineInfo.goalMatched ? "" : styles.prmQuickNone}`}>
                {inlineInfo.goalSet ? inlineInfo.goal || "بدون هدف" : goal ? goalLabel(goal) : "خنثی"}
              </span>
            </div>
          ) : null}
        </div>

        {/* pending list — nothing saved until تایید نهایی */}
        <div className={styles.prmFoodPending}>
          <div className={styles.prmFoodPendingHead}>
            <span className={styles.prmFoodPendingTitle}>
              <PrmIcon name="clock" size={15} /> در انتظار ثبت
            </span>
            <PrmBadge tone="orange">
              {pending.length.toLocaleString("fa-IR")} آیتم آماده ثبت
            </PrmBadge>
          </div>

          {!pending.length ? (
  <div className={styles.prmFoodPendingEmpty}>
    <p>هنوز چیزی اضافه نکرده‌اید — با «افزودن به لیست» مواد را یکی‌یکی اینجا جمع کنید.</p>
    <div className={styles.prmQuickHintBox}>
  <span className={styles.prmQuickHintIcon}>💡</span>
  <div>
    <strong>نکته:</strong> برای ورود سریع، از فرمت <code>نام | واحد | هدف</code> استفاده کنید.
    {/*                                          ^ اینجا یک فاصله بذارید     */}
    <br />
    <span className={styles.prmQuickHintExample}>
      مثال: <code>حلیم | کاسه | حجم</code> یا <code>شیر | لیوان | کات</code>
    </span>
  </div>
</div>
  </div>
) : (
            <>
              <div className={styles.prmFoodPendingRows}>
                {pending.map((row, index) => {
                  const isEditing = pendingEditKey === row.key;
                  return (
                    <div key={row.key} className={`${styles.prmFoodPendingRow} ${isEditing ? styles.prmFoodPendingRowEditing : ""}`}>
                      <span className={styles.prmFoodPendingIndex}>{(index + 1).toLocaleString("fa-IR")}</span>
                      {isEditing ? (
                        <div className={styles.prmFoodPendingEdit}>
                          <PrmTextInput value={row.name} onChange={(event) => editPending(row.key, { name: event.target.value })} placeholder="نام ماده" />
                          <PrmSelect
                            value={row.category}
                            onChange={(value) => editPending(row.key, { category: value })}
                            options={orderedCategories.map((group) => [group.key, group.name])}
                            placeholder="دسته"
                          />
                          <PrmSelect
                            value={row.unit}
                            onChange={(value) => editPending(row.key, { unit: value })}
                            options={orderedUnits.map((entry) => [(entry as { code?: string }).code ?? entry.key, entry.name])}
                            placeholder="واحد"
                          />
                          <PrmSelect
                            value={row.goal}
                            onChange={(value) => editPending(row.key, { goal: (value || "neutral") as PlanMode | "" })}
                            options={MODE_OPTIONS}
                            placeholder="هدف"
                          />
                        </div>
                      ) : (
                        <span className={styles.prmFoodPendingMain}>
                          <b>{row.name}</b>
                          <span className={styles.prmFoodPendingMeta}>
                            <span className={styles.prmFoodPendingChip}>{categoryName(row.category)}</span>
                            <span className={styles.prmFoodPendingChip}>{unitName(api, row.unit)}</span>
                            <span className={styles.prmFoodPendingChip}>{row.goal ? goalLabel(row.goal) : "خنثی"}</span>
                          </span>
                        </span>
                      )}
                      <span className={styles.prmFoodPendingActions}>
                        {!isEditing ? (
                          <button type="button" className={styles.prmIconBtn} onClick={() => setPendingEditKey(row.key)} aria-label="ویرایش ردیف در انتظار">
                            <PrmIcon name="edit" />
                          </button>
                        ) : (
                          <button type="button" className={styles.prmIconBtn} onClick={() => setPendingEditKey(null)} aria-label="پایان ویرایش ردیف">
                            <PrmIcon name="check" />
                          </button>
                        )}
                        <button
                          type="button"
                          className={styles.prmIconBtn}
                          onClick={() => {
                            setPending((current) => current.filter((entry) => entry.key !== row.key));
                            if (pendingEditKey === row.key) setPendingEditKey(null);
                          }}
                          aria-label="حذف ردیف در انتظار"
                        >
                          <PrmIcon name="trash" />
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className={styles.prmFoodPendingFoot}>
                <button type="button" className={styles.prmBtn} onClick={() => setPending([])} disabled={busy}>
                  پاک کردن لیست
                </button>
                <button type="button" className={styles.prmBtnPrimary} onClick={() => void confirmPending()} disabled={busy}>
                  <PrmIcon name="check" /> {busy ? "در حال ثبت..." : "تایید نهایی"}
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ============================================================
          Food bank — VIEW ONLY (filters + status toggle + edit/delete)
          ============================================================ */}
      <section className={styles.prmPanel}>
        <header className={styles.prmPanelHead}>
          <span>
            <h2>بانک مواد غذایی</h2>
            <small>فهرست مواد ثبت‌شده؛ ساخت و ویرایش فقط از «ثبت سریع» و ویرایش همین‌جا.</small>
          </span>
          <PrmBadge tone="orange">{items.length.toLocaleString("fa-IR")} مورد</PrmBadge>
        </header>

        {sessionItems.length ? (
          <div className={styles.prmSessionStrip}>
            <span className={styles.prmSessionTitle}>
              <PrmIcon name="clock" size={15} /> ثبت‌شده همین حالا
            </span>
            <div className={styles.prmSessionList}>
              {sessionItems.map((item) => (
                <span className={styles.prmSessionItem} key={item.key}>
                  <b>{item.name}</b>
                  <button type="button" className={styles.prmIconBtn} onClick={() => void api.bankDeleteMany([item.key])} aria-label="حذف از بانک">
                    <PrmIcon name="trash" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className={styles.prmBankFilters}>
          <label className={styles.prmSearch}>
            <PrmIcon name="search" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجو در نام ماده و دسته..." />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="پاک کردن جستجو">
                <PrmIcon name="close" />
              </button>
            ) : null}
          </label>
        </div>

        <div className={styles.prmFoodFilterRows}>
          <div className={styles.prmFoodFilterRow}>
            <span className={styles.prmFoodFilterLabel}>دسته</span>
            <div className={styles.prmBankTabs}>
              <button type="button" className={catFilter === "all" ? styles.prmChipActive : styles.prmChip} onClick={() => setCatFilter("all")}>
                همه دسته‌ها
              </button>
              {orderedCategories.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  className={catFilter === group.key ? styles.prmChipActive : styles.prmChip}
                  onClick={() => setCatFilter(catFilter === group.key ? "all" : group.key)}
                >
                  {group.name}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.prmFoodFilterRow}>
            <span className={styles.prmFoodFilterLabel}>هدف</span>
            <div className={styles.prmBankTabs}>
              <button type="button" className={goalFilter === "all" ? styles.prmChipActive : styles.prmChip} onClick={() => setGoalFilter("all")}>
                همه اهداف
              </button>
              {MODE_OPTIONS.map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={goalFilter === mode ? styles.prmChipActive : styles.prmChip}
                  onClick={() => setGoalFilter(goalFilter === mode ? "all" : mode)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`${styles.prmBankTable} ${styles.prmFoodTable}`}>
          <div className={styles.prmBankHead}>
            <span className={styles.prmBankName}>نام ماده</span>
            <span className={styles.prmBankMeta}>دسته</span>
            <span className={styles.prmBankUnit}>واحد</span>
            <span className={styles.prmBankGoals}>هدف</span>
            <span className={styles.prmBankActions}>وضعیت</span>
          </div>

          {filtered.map((item) => (
            <div key={item.key} className={`${styles.prmBankRow} ${item.disabled ? styles.prmBankRowDisabled : ""} ${editingKey === item.key ? styles.prmBankRowEditing : ""}`}>
              <span className={styles.prmBankName}>
                <b>{item.name}</b>
                {item.note ? <small>{item.note}</small> : null}
                {item.disabled ? <PrmBadge tone="gray" muted>غیرفعال</PrmBadge> : null}
              </span>
              <span className={styles.prmBankMeta}>{categoryName(item.category)}</span>
              <span className={styles.prmBankUnit}>{unitName(api, item.unit ?? "")}</span>
              <span className={styles.prmBankGoals}>
                {!item.goals?.length ? <PrmBadge tone="gray">همه اهداف</PrmBadge> : item.goals.map((mode) => <PrmBadge key={mode} tone={mode === "volume" ? "orange" : mode === "cut" ? "green" : "gray"}>{goalLabel(mode)}</PrmBadge>)}
              </span>
              <span className={styles.prmBankActions}>
               <PrmToggle 
  on={item.disabled === true} 
  onToggle={() => void api.bankSetDisabled(item.key, !(item.disabled ?? false))} 
  label="فعال/غیرفعال" 
/>
                <button type="button" className={styles.prmIconBtn} onClick={() => (editingKey === item.key ? setEditingKey(null) : startEdit(item))} aria-label="ویرایش">
                  <PrmIcon name={editingKey === item.key ? "close" : "edit"} />
                </button>
                <button type="button" className={styles.prmIconBtn} onClick={() => setDeleting(item)} aria-label="حذف">
                  <PrmIcon name="trash" />
                </button>
              </span>
              {editingKey === item.key ? (
                <div className={styles.prmBankEdit}>
                  <label className={styles.prmBankEditField}>
                    <span>نام</span>
                    <PrmTextInput value={editName} onChange={(event) => setEditName(event.target.value)} />
                  </label>
                  <span className={styles.prmBankEditField}>
                    <span>دسته (وعده)</span>
                    <PrmSelect
                      value={item.category ?? ""}
                      onChange={(value) => void api.bankUpdate(item.key, { category: value })}
                      options={orderedCategories.map((group) => [group.key, group.name])}
                      placeholder="انتخاب دسته"
                    />
                  </span>
                  <span className={styles.prmBankEditField}>
                    <span>واحد</span>
                    <PrmSelect
                      value={item.unit ?? ""}
                      onChange={(value) => void api.bankUpdate(item.key, { unit: value })}
                      options={orderedUnits.map((entry) => [(entry as { code?: string }).code ?? entry.key, entry.name])}
                      placeholder="انتخاب واحد"
                    />
                  </span>
                  <label className={styles.prmBankEditField}>
                    <span>کالری هر ۱۰۰ گرم (اختیاری)</span>
                    <input className={styles.prmMiniInput} type="number" min={0} value={editKcal} onChange={(event) => setEditKcal(event.target.value)} placeholder="مثلا ۱۵۵" />
                  </label>
                  <span className={styles.prmBankEditField}>
                    <span>هدف</span>
                    <span className={styles.prmChipRow}>
                      {MODE_OPTIONS.map(([mode, label]) => (
                        <button key={mode} type="button" className={(item.goals ?? []).includes(mode) ? styles.prmChipActive : styles.prmChip} onClick={() => toggleGoal(item, mode)}>
                          {label}
                        </button>
                      ))}
                    </span>
                  </span>
                  <div className={styles.prmFoodEditSave}>
                    <button type="button" className={styles.prmBtnPrimary} onClick={() => commitEdit(item)}>
                      <PrmIcon name="check" /> ذخیره تغییرات
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}

          {!filtered.length ? (
            <div className={styles.prmBankEmpty}>
              <PrmEmpty
                icon="food"
                title={noItems ? "بانک مواد غذایی هنوز خالی است." : "موردی مطابق فیلتر پیدا نشد."}
                hint={noItems ? "از «ثبت سریع در بانک» بالا اولین ماده را اضافه و با «تایید نهایی» ذخیره کنید." : "جستجو یا فیلترها را عوض کنید."}
              />
            </div>
          ) : null}
        </div>

        {items.some((item) => item.disabled) && !hasAnyFilters ? (
          <PrmNotice tone="gray">مواد غیرفعال در بانک می‌مانند ولی در برنامه‌سازی پیشنهاد نمی‌شوند؛ با جستجو همچنان قابل مشاهده‌اند.</PrmNotice>
        ) : null}
      </section>

      {deleting ? (
        <PrmConfirm
          title="حذف از بانک؟"
          tone="red"
          description={
            <>
              «{deleting.name}» از بانک حذف می‌شود. برنامه‌های ذخیره‌شده تغییری نمی‌کنند؛ اما این ماده در برنامه‌های جدید پیشنهاد نمی‌شود.
            </>
          }
          confirmLabel="حذف از بانک"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            void api.bankDeleteMany([deleting.key]);
            setDeleting(null);
          }}
        />
      ) : null}
    </>
  );
}
