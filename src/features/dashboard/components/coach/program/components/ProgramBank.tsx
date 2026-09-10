"use client";

// =============================================================
// GymPlus+ Coach — bank manager (exercise bank / food bank)
// Quick-entry bar + big text field (Enter adds & refocuses),
// multi-line paste bulk-add with Persian summary + duplicate skip,
// inline "نام | واحد | [تجهیز |] هدف" parsing, "added this session" strip,
// search / goal filters / multi-select + bulk actions, disable toggle.
// =============================================================

import { useEffect, useMemo, useRef, useState } from "react";

import { BankItem, PlanMode, ProgramDomain, MODE_OPTIONS } from "../program.types";
import { useProgramData } from "../hooks/useProgramData";
import { PrmBadge, PrmIcon, PrmNotice, PrmSelect, PrmTextInput, PrmToggle, PrmEmpty, PrmConfirm } from "./programShared";

import styles from "../program.module.css";

type ProgramApi = ReturnType<typeof useProgramData>;

type PendingExercise = {
  key: string;
  name: string;
  group: string;
  equipment: string;
  unit: string;
  goal: PlanMode | "";
};

/** Display name for a unit code resolved through the api unit list. */
export function unitName(api: ProgramApi, code: string): string {
  const unit = api.state.units.find((entry) => (entry as { code?: string }).code === code);
  return unit ? unit.name : code || "—";
}

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("fa-IR")
    .replaceAll("ي", "ی")
    .replaceAll("ك", "ک")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function matchUnit(api: ProgramApi, token: string): string {
  const key = normalize(token);
  if (!key) return "";
  const found = api.state.units.find((unit) => normalize(unit.name) === key || normalize((unit as { code?: string }).code ?? "") === key);
  return found ? (found as { code?: string }).code ?? found.key : "";
}

/** Resolve a free-text تجهیز token to an equipment key — "" when unknown. */
function matchEquipment(api: ProgramApi, token: string): string {
  const key = normalize(token);
  if (!key) return "";
  const found = api.state.equipment.find((item) => normalize(item.name) === key || normalize(item.key) === key);
  return found ? found.key : "";
}

function equipmentLabel(api: ProgramApi, key: string): string {
  if (!key) return "بدون تجهیز";
  return api.state.equipment.find((item) => item.key === key)?.name ?? key;
}

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

function goalLabel(mode: PlanMode): string {
  return MODE_OPTIONS.find(([value]) => value === mode)?.[1] ?? "";
}

/** Parse one quick-entry line into a bank item. */
export function parseBankLine(api: ProgramApi, kind: ProgramDomain, line: string): Partial<BankItem> | null {
  const raw = line.trim();
  if (!raw) return null;
  const parts = raw.split("|").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return null;

  if (kind === "workout") {
    const equipment = parts[1] ?? "";
    const unit = parts[2] ?? "";
    const goal = matchGoal(parts[3] ?? "");
    return {
      name: parts[0],
      equipment: equipment ? matchEquipment(api, equipment) || equipment : "",
      unit: matchUnit(api, unit) || "reps",
      goals: goal ? [goal] : [],
    };
  }

  const patch: Partial<BankItem> = { name: parts[0], goals: [] };
  for (const part of parts.slice(1)) {
    const unit = matchUnit(api, part);
    if (unit && !patch.unit) {
      patch.unit = unit;
      continue;
    }
    const goal = matchGoal(part);
    if (goal) {
      patch.goals = [...(patch.goals ?? []), goal];
      continue;
    }
    if (!patch.note) patch.note = part;
  }
  if (!patch.unit) patch.unit = "g";
  return patch;
}

type QuickParts = { name: string; equipmentToken: string; unitToken: string; goalToken: string };

/**
 * Split one quick-entry line. The documented progressive shapes are:
 *   «نام | تجهیز»
 *   «نام | تجهیز | واحد»
 *   «نام | تجهیز | واحد | هدف»
 * A line with no "|" yields just the name and keeps the selected dropdowns.
 */
function splitQuick(raw: string): QuickParts | null {
  const parts = raw.split("|").map((part) => part.trim());
  const name = parts[0] ?? "";
  if (!name) return null;
  return {
    name,
    equipmentToken: parts[1] ?? "",
    unitToken: parts[2] ?? "",
    goalToken: parts[3] ?? "",
  };
}

export function ProgramBank({ api }: { kind?: "workout"; api: ProgramApi }) {
  const kind = "workout";
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [goalFilter, setGoalFilter] = useState<PlanMode | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<BankItem | null>(null);
  const [bulkDeleteKeys, setBulkDeleteKeys] = useState<string[] | null>(null);
  const [bulkPick, setBulkPick] = useState<"group" | "equipment" | null>(null);
  const [pending, setPending] = useState<PendingExercise[]>([]);
  const [pendingEditKey, setPendingEditKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [unit, setUnit] = useState("reps");
  const [goal, setGoal] = useState<PlanMode | "">("");
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const pendingUnitAdds = useRef(new Set<string>());
  const pendingEquipAdds = useRef(new Set<string>());

  const items = api.state.bank;
  const tagKey = kind === "workout" ? "group" : "category";
  const tagLabel = kind === "workout" ? "گروه" : "دسته";
  const activeGroups = api.state.groups.filter((item) => !item.disabled);
  const groupName = (key?: string) => api.state.groups.find((item) => item.key === key)?.name ?? (key ? key : "—");

  // ------------------------------------------------------------ session strip baseline
  // Items whose key is not in the baseline were added after this component mounted.
  const baseline = useRef<Set<string> | null>(null);
  const everOnline = useRef(false);
  if (baseline.current === null) baseline.current = new Set(items.map((item) => item.key));
  useEffect(() => {
    // a successful server load replaces the whole bank — adopt it as the new baseline
    if (api.online && !everOnline.current) {
      everOnline.current = true;
      baseline.current = new Set(api.state.bank.map((item) => item.key));
    }
  }, [api.online, api.state.bank]);
  const sessionItems = items.filter((item) => !baseline.current!.has(item.key));

  const toast = (message: string, tone: "success" | "info" | "error" = "success") => {
    window.dispatchEvent(new CustomEvent("gymplus:coach-toast", { detail: { message, tone } }));
  };

  const filtered = useMemo(() => {
    const q = normalize(query);
    return items.filter((item) => {
      if (q && !normalize(`${item.name} ${groupName(item[tagKey])} ${item.equipment ?? ""} ${item.note ?? ""}`).includes(q)) return false;
      if (groupFilter !== "all" && item[tagKey] !== groupFilter) return false;
      if (goalFilter !== "all" && !(item.goals ?? []).includes(goalFilter)) return false;
      return true;
    });
  }, [items, query, groupFilter, goalFilter, tagKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const addPending = () => {
    const raw = name.trim();
    const groupKey = group || activeGroups[0]?.key || "";
    if (!raw || !groupKey) return;

    const parsed = splitQuick(raw);
    if (!parsed) return;

    // An unknown تجهیز token is created on the fly, mirroring unknown units.
    let rowEquipment = equipment;
    if (parsed.equipmentToken) {
      const known = matchEquipment(api, parsed.equipmentToken);
      if (known) {
        rowEquipment = known;
      } else {
        const marker = normalize(parsed.equipmentToken);
        if (marker && !pendingEquipAdds.current.has(marker)) {
          pendingEquipAdds.current.add(marker);
          void api.equipmentAddMany([parsed.equipmentToken]);
        }
        rowEquipment = parsed.equipmentToken;
      }
    }

    let rowUnit = unit;
    if (parsed.unitToken) {
      const knownUnit = matchUnit(api, parsed.unitToken);
      if (knownUnit) {
        rowUnit = knownUnit;
      } else {
        rowUnit = parsed.unitToken.replaceAll(" ", "-").toLowerCase();
        const marker = normalize(parsed.unitToken);
        if (marker && !pendingUnitAdds.current.has(marker)) {
          pendingUnitAdds.current.add(marker);
          void api.unitAddMany([parsed.unitToken]);
        }
      }
    }

    setPending((current) => [
      ...current,
      {
        key: `pending-${Date.now()}-${current.length}`,
        name: parsed.name,
        group: groupKey,
        equipment: rowEquipment,
        unit: rowUnit || "reps",
        goal: parsed.goalToken ? matchGoal(parsed.goalToken) ?? "" : goal,
      },
    ]);
    setName("");
    setPendingEditKey(null);
    requestAnimationFrame(() => nameRef.current?.focus());
  };

  const updatePending = (key: string, patch: Partial<Omit<PendingExercise, "key">>) => {
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
      if (!key || existingNames.has(key)) {
        duplicates += 1;
        continue;
      }
      existingNames.add(key);
      added += await api.bankAdd([row.name], {
        name: row.name,
        group: row.group,
        equipment: row.equipment || undefined,
        unit: row.unit || "reps",
        goals: row.goal ? [row.goal] : [],
      });
    }
    setBusy(false);
    if (added > 0) {
      setPending([]);
      setPendingEditKey(null);
      toast(
        duplicates > 0
          ? `${added.toLocaleString("fa-IR")} حرکت ثبت شد؛ ${duplicates.toLocaleString("fa-IR")} مورد تکراری نادیده گرفته شد.`
          : `${added.toLocaleString("fa-IR")} حرکت در بانک ثبت شد.`,
        duplicates > 0 ? "info" : "success",
      );
    } else {
      toast(duplicates > 0 ? "همه موارد تکراری‌اند و در بانک موجودند." : "موردی برای ثبت وجود ندارد.", "info");
    }
  };

  const bulkAction = async (action: "disable" | "enable" | "move" | "equipment", target?: string) => {
    const keys = [...selected];
    if (!keys.length) return;
    setBusy(true);
    if (action === "disable") {
      for (const key of keys) await api.bankUpdate(key, { disabled: true });
    } else if (action === "enable") {
      for (const key of keys) await api.bankUpdate(key, { disabled: false });
    } else if (action === "move" && target) {
      for (const key of keys) await api.bankUpdate(key, { group: target });
    } else if (action === "equipment" && target) {
      for (const key of keys) await api.bankUpdate(key, { equipment: target });
    }
    if (action === "move") toast("انتقال انجام شد.");
    if (action === "equipment") toast("تجهیز حرکات انتخاب‌شده تغییر کرد.");
    setSelected(new Set());
    setBulkPick(null);
    setBusy(false);
  };

  const toggleRowGoal = (item: BankItem, mode: PlanMode) => {
    const goals = item.goals ?? [];
    const next = goals.includes(mode) ? goals.filter((goal) => goal !== mode) : [...goals, mode];
    void api.bankUpdate(item.key, { goals: next });
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((item) => selected.has(item.key));

  return (
    <section className={styles.prmPanel}>
      <header className={styles.prmPanelHead}>
        <span>
          <h2>{kind === "workout" ? "بانک حرکات" : "بانک مواد غذایی"}</h2>
          <small>یک‌بار تعریف کن، بارها استفاده کن — منبع آیتم‌های برنامه‌سازی.</small>
        </span>
        <PrmBadge tone="orange">{items.length.toLocaleString("fa-IR")} مورد</PrmBadge>
      </header>

      <section className={styles.prmFoodQuick}>
        <div className={styles.prmFoodQuickGrid}>
          <label className={styles.prmQuickField}><span>گروه عضلانی</span><PrmSelect value={group || activeGroups[0]?.key || ""} onChange={setGroup} options={activeGroups.map((item) => [item.key, item.name])} placeholder="انتخاب گروه" /></label>
          <label className={styles.prmQuickField}><span>تجهیز</span><PrmSelect value={equipment} onChange={setEquipment} options={api.state.equipment.filter((item) => !item.disabled).map((item) => [item.key, item.name])} placeholder="بدون تجهیز" /></label>
          <label className={styles.prmQuickField}><span>واحد اجرا</span><PrmSelect value={unit} onChange={setUnit} options={api.state.units.filter((item) => !item.disabled).map((item) => [(item as { code?: string }).code ?? item.key, item.name])} placeholder="انتخاب واحد" /></label>
          <label className={styles.prmQuickField}><span>هدف</span><PrmSelect value={goal} onChange={(value) => setGoal(value as PlanMode | "")} options={MODE_OPTIONS} placeholder="بدون هدف" /></label>
        </div>
        <div className={styles.prmFoodNameAdd}>
          <input ref={nameRef} className={styles.prmFoodNameInput} value={name} placeholder="نام حرکت — یا سریع: «پرس سینه | هالتر | reps | حجم»" onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addPending(); } }} />
          <button type="button" className={styles.prmBtnPrimary} onClick={addPending} disabled={!name.trim() || !(group || activeGroups[0]?.key)}><PrmIcon name="plus" /> افزودن به لیست</button>
        </div>
        <p className={styles.prmQuickHelp}>قالب ورود سریع: <b>نام | تجهیز</b> — یا: <b>نام | تجهیز | واحد</b> — یا: <b>نام | تجهیز | واحد | هدف</b> — واحد/تجهیز ناشناخته به‌طور خودکار ساخته می‌شود.</p>
        <div className={styles.prmFoodPending}>
          <div className={styles.prmFoodPendingHead}><span className={styles.prmFoodPendingTitle}><PrmIcon name="clock" size={15} /> در انتظار ثبت</span><PrmBadge tone="orange">{pending.length.toLocaleString("fa-IR")} حرکت آماده ثبت</PrmBadge></div>
          {!pending.length ? <div className={styles.prmFoodPendingEmpty}>هنوز حرکتی اضافه نکرده‌اید — با «افزودن به لیست» موارد را جمع کنید، سپس تأیید نهایی را بزنید.</div> : <PendingExercises api={api} rows={pending} editingKey={pendingEditKey} groups={activeGroups} onEdit={setPendingEditKey} onChange={updatePending} onDelete={(key) => { setPending((current) => current.filter((row) => row.key !== key)); if (pendingEditKey === key) setPendingEditKey(null); }} />}
          {pending.length ? <div className={styles.prmFoodPendingFoot}><button type="button" className={styles.prmBtn} onClick={() => setPending([])} disabled={busy}>پاک کردن لیست</button><button type="button" className={styles.prmBtnPrimary} onClick={() => void confirmPending()} disabled={busy}><PrmIcon name="check" /> {busy ? "در حال ثبت..." : "تأیید نهایی"}</button></div> : null}
        </div>
      </section>

      {sessionItems.length ? <SessionStrip api={api} items={sessionItems} /> : null}

      {/* filters */}
      <div className={styles.prmBankFilters}>
        <label className={styles.prmSearch}>
          <PrmIcon name="search" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={kind === "workout" ? "جستجو در نام و گروه..." : "جستجو در نام و دسته..."} />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="پاک کردن جستجو">
              <PrmIcon name="close" />
            </button>
          ) : null}
        </label>
      </div>

      <div className={styles.prmFoodFilterRows}>
        <div className={styles.prmFoodFilterRow}>
          <span className={styles.prmFoodFilterLabel}>گروه عضلانی</span>
          <div className={styles.prmBankTabs}>
            <button type="button" className={groupFilter === "all" ? styles.prmChipActive : styles.prmChip} onClick={() => setGroupFilter("all")}>
              همه گروه‌ها
            </button>
            {activeGroups.map((item) => (
              <button key={item.key} type="button" className={groupFilter === item.key ? styles.prmChipActive : styles.prmChip} onClick={() => setGroupFilter(groupFilter === item.key ? "all" : item.key)}>
                {item.name}
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
              <button key={mode} type="button" className={goalFilter === mode ? styles.prmChipActive : styles.prmChip} onClick={() => setGoalFilter(goalFilter === mode ? "all" : mode)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* bulk bar */}
      {selected.size ? (
        <div className={styles.prmBulkBar}>
          <span className={styles.prmBulkCount}>
            <b>{selected.size.toLocaleString("fa-IR")}</b> مورد انتخاب شده
          </span>
          {bulkPick ? (
            <>
              <span className={styles.prmBulkMove}>
                <PrmSelect
                  value=""
                  onChange={(target) => {
                    if (target) void bulkAction(bulkPick === "equipment" ? "equipment" : "move", target);
                  }}
                  options={(bulkPick === "equipment" ? api.state.equipment.filter((item) => !item.disabled) : activeGroups).map((item) => [item.key, item.name])}
                  placeholder={bulkPick === "equipment" ? "انتخاب تجهیز جدید..." : `انتقال به ${tagLabel}...`}
                />
              </span>
              <button type="button" className={styles.prmBtn} onClick={() => setBulkPick(null)} disabled={busy}>
                انصراف
              </button>
            </>
          ) : (
            <>
              <button type="button" className={styles.prmBtn} onClick={() => setBulkPick("group")} disabled={busy}>
                <PrmIcon name="swap" /> انتقال گروه
              </button>
              <button type="button" className={styles.prmBtn} onClick={() => setBulkPick("equipment")} disabled={busy}>
                <PrmIcon name="settings" /> تغییر تجهیز
              </button>
              <button type="button" className={styles.prmBtn} onClick={() => void bulkAction("disable")} disabled={busy}>
                <PrmIcon name="ban" /> غیرفعال
              </button>
              <button type="button" className={styles.prmBtn} onClick={() => void bulkAction("enable")} disabled={busy}>
                <PrmIcon name="check" /> فعال
              </button>
              <button type="button" className={styles.prmBtnDanger} onClick={() => setBulkDeleteKeys([...selected])} disabled={busy}>
                <PrmIcon name="trash" /> حذف
              </button>
            </>
          )}
        </div>
      ) : null}

      {/* table */}
      <div className={styles.prmBankTable}>
        <div className={styles.prmBankHead}>
          <button
            type="button"
            className={styles.prmCheckbox}
            onClick={() => setSelected(allFilteredSelected ? new Set() : new Set(filtered.map((item) => item.key)))}
            aria-label="انتخاب همهٔ موارد"
          >
            {allFilteredSelected ? <PrmIcon name="check" size={14} /> : null}
          </button>
          <span className={styles.prmBankName}>{kind === "workout" ? "نام حرکت" : "نام ماده"}</span>
          <span className={styles.prmBankMeta}>{tagLabel}</span>
          {kind === "workout" ? <span className={styles.prmBankEquipment}>تجهیز</span> : null}
          <span className={styles.prmBankUnit}>واحد</span>
          <span className={styles.prmBankGoals}>هدف</span>
          <span className={styles.prmBankActions}>وضعیت</span>
        </div>
        {filtered.map((item) => {
          const tag = item[tagKey] ?? "";
          return (
            <div key={item.key} className={`${styles.prmBankRow} ${item.disabled ? styles.prmBankRowDisabled : ""} ${editingKey === item.key ? styles.prmBankRowEditing : ""}`}>
              <button
                type="button"
                className={styles.prmCheckbox}
                onClick={() => {
                  setSelected((current) => {
                    const next = new Set(current);
                    if (next.has(item.key)) next.delete(item.key);
                    else next.add(item.key);
                    return next;
                  });
                }}
                aria-label="انتخاب"
              >
                {selected.has(item.key) ? <PrmIcon name="check" size={14} /> : null}
              </button>
              <span className={styles.prmBankName}>
                <b>{item.name}</b>
                {item.note ? <small>{item.note}</small> : null}
                {item.disabled ? <PrmBadge tone="gray" muted>غیرفعال</PrmBadge> : null}
              </span>
              <span className={styles.prmBankMeta}>{groupName(tag)}</span>
              {kind === "workout" ? (
                <span className={styles.prmBankEquipment}>{equipmentLabel(api, item.equipment ?? "")}</span>
              ) : null}
              <span className={styles.prmBankUnit}>{unitName(api, item.unit ?? "")}</span>
              <span className={styles.prmBankGoals}>
                {!item.goals?.length ? <PrmBadge tone="orange">همه اهداف</PrmBadge> : item.goals.map((goal) => <PrmBadge key={goal} tone={goal === "volume" ? "orange" : goal === "cut" ? "green" : "gray"}>{MODE_OPTIONS.find(([mode]) => mode === goal)?.[1]}</PrmBadge>)}
              </span>
              <span className={styles.prmBankActions}>
                <PrmToggle on={!item.disabled} onToggle={() => void api.bankSetDisabled(item.key, !item.disabled)} label="فعال/غیرفعال" />
                <button type="button" className={styles.prmIconBtn} onClick={() => setEditingKey(editingKey === item.key ? null : item.key)} aria-label="ویرایش جزئیات">
                  <PrmIcon name={editingKey === item.key ? "close" : "edit"} />
                </button>
                <button type="button" className={styles.prmIconBtn} onClick={() => setDeleting(item)} aria-label="حذف">
                  <PrmIcon name="trash" />
                </button>
              </span>
              {editingKey === item.key ? (
                <div className={styles.prmBankEdit}>
                  <span className={styles.prmBankEditField}>
                    <span>{tagLabel}</span>
                    <PrmSelect
                      value={tag}
                      onChange={(value) => void api.bankUpdate(item.key, { [tagKey]: value } as Partial<BankItem>)}
                      options={activeGroups.map((group) => [group.key, group.name])}
                      placeholder={`انتخاب ${tagLabel}`}
                    />
                  </span>
                  <span className={styles.prmBankEditField}>
                    <span>واحد</span>
                    <PrmSelect
                      value={item.unit ?? ""}
                      onChange={(value) => void api.bankUpdate(item.key, { unit: value })}
                      options={api.state.units.map((unit) => [(unit as { code?: string }).code ?? unit.key, unit.name])}
                      placeholder="انتخاب واحد"
                    />
                  </span>
                  {kind === "workout" ? (
                    <span className={styles.prmBankEditField}>
                      <span>تجهیز</span>
                      <PrmSelect
                        value={item.equipment ?? ""}
                        onChange={(value) => void api.bankUpdate(item.key, { equipment: value })}
                        options={api.state.equipment.map((eq) => [eq.key, eq.name])}
                        placeholder="بدون تجهیز"
                      />
                    </span>
                  ) : null}
                  <span className={styles.prmBankEditField}>
                    <span>هدف</span>
                    <span className={styles.prmChipRow}>
                      {MODE_OPTIONS.map(([mode, label]) => (
                        <button key={mode} type="button" className={(item.goals ?? []).includes(mode) ? styles.prmChipActive : styles.prmChip} onClick={() => toggleRowGoal(item, mode)}>
                          {label}
                        </button>
                      ))}
                    </span>
                  </span>
                  <label className={styles.prmBankEditField}>
                    <span>یادداشت</span>
                    <PrmTextInput value={item.note ?? ""} placeholder={kind === "workout" ? "مثال: فشار روی مچ ندهد" : "مثال: تازه یا پخته"} onChange={(event) => void api.bankUpdate(item.key, { note: event.target.value })} />
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}
        {!filtered.length ? (
          <div className={styles.prmBankEmpty}>
            <PrmEmpty
              icon={kind === "workout" ? "training" : "food"}
              title={query || groupFilter !== "all" || goalFilter !== "all" ? "موردی مطابق فیلتر پیدا نشد." : `${kind === "workout" ? "بانک حرکات" : "بانک مواد غذایی"} هنوز خالی است.`}
              hint={query || groupFilter !== "all" || goalFilter !== "all" ? "فیلترها را عوض کنید یا عبارت دیگری جستجو کنید." : "از قسمت بالا سریعاً اولین مورد را اضافه کنید."}
            />
          </div>
        ) : null}
      </div>

      {items.some((item) => item.disabled) ? (
        <PrmNotice tone="gray">حرکت‌های غیرفعال در بانک باقی می‌مانند اما در برنامه‌سازی پیشنهاد نمی‌شوند؛ در جدول به‌صورت کم‌رنگ و خط‌خورده نمایش داده می‌شوند.</PrmNotice>
      ) : null}

      {bulkDeleteKeys ? (
        <PrmConfirm
          title="حذف موارد انتخاب‌شده؟"
          tone="red"
          description={`این ${bulkDeleteKeys.length.toLocaleString("fa-IR")} حرکت از بانک حذف می‌شود. برنامه‌های ذخیره‌شده تغییری نمی‌کنند.`}
          confirmLabel="حذف موارد"
          onCancel={() => setBulkDeleteKeys(null)}
          onConfirm={() => {
            void api.bankDeleteMany(bulkDeleteKeys);
            toast(`${bulkDeleteKeys.length.toLocaleString("fa-IR")} حرکت حذف شد.`);
            setSelected(new Set());
            setBulkPick(null);
            setBulkDeleteKeys(null);
          }}
        />
      ) : null}

      {deleting ? (
        <PrmConfirm
          title="حذف از بانک؟"
          tone="red"
          description={
            <>
              «{deleting.name}» از بانک حذف می‌شود. برنامه‌های ذخیره‌شده تغییری نمی‌کنند؛ اما این مورد در برنامه‌های جدید پیشنهاد نمی‌شود.
            </>
          }
          confirmLabel="حذف از بانک"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            void api.bankDeleteMany([deleting.key]);
            setSelected((current) => {
              const next = new Set(current);
              next.delete(deleting.key);
              return next;
            });
            setDeleting(null);
          }}
        />
      ) : null}
    </section>
  );
}

function PendingExercises({
  api,
  rows,
  editingKey,
  groups,
  onEdit,
  onChange,
  onDelete,
}: {
  api: ProgramApi;
  rows: PendingExercise[];
  editingKey: string | null;
  groups: ProgramApi["state"]["groups"];
  onEdit: (key: string | null) => void;
  onChange: (key: string, patch: Partial<Omit<PendingExercise, "key">>) => void;
  onDelete: (key: string) => void;
}) {
  const units = api.state.units.filter((item) => !item.disabled);
  return (
    <div className={styles.prmFoodPendingRows}>
      {rows.map((row, index) => {
        const isEditing = editingKey === row.key;
        return (
          <div key={row.key} className={`${styles.prmFoodPendingRow} ${isEditing ? styles.prmFoodPendingRowEditing : ""}`}>
            <span className={styles.prmFoodPendingIndex}>{(index + 1).toLocaleString("fa-IR")}</span>
            {isEditing ? (
              <div className={styles.prmFoodPendingEdit}>
                <PrmTextInput value={row.name} onChange={(event) => onChange(row.key, { name: event.target.value })} placeholder="نام حرکت" />
                <PrmSelect value={row.group} onChange={(value) => onChange(row.key, { group: value })} options={groups.map((group) => [group.key, group.name])} placeholder="گروه عضلانی" />
                <PrmSelect value={row.equipment} onChange={(value) => onChange(row.key, { equipment: value })} options={api.state.equipment.filter((item) => !item.disabled).map((item) => [item.key, item.name])} placeholder="بدون تجهیز" />
                <PrmSelect value={row.unit} onChange={(value) => onChange(row.key, { unit: value })} options={units.map((item) => [(item as { code?: string }).code ?? item.key, item.name])} placeholder="واحد" />
                <PrmSelect value={row.goal} onChange={(value) => onChange(row.key, { goal: value as PlanMode | "" })} options={MODE_OPTIONS} placeholder="هدف" />
              </div>
            ) : (
              <span className={styles.prmFoodPendingMain}>
                <b>{row.name}</b>
                <span className={styles.prmFoodPendingMeta}>
                  <span className={styles.prmFoodPendingChip}>{groups.find((group) => group.key === row.group)?.name ?? row.group}</span>
                  {row.equipment ? <span className={styles.prmFoodPendingChip}>{equipmentLabel(api, row.equipment)}</span> : null}
                  <span className={styles.prmFoodPendingChip}>{unitName(api, row.unit)}</span>
                  <span className={styles.prmFoodPendingChip}>{row.goal ? goalLabel(row.goal) : "همه اهداف"}</span>
                </span>
              </span>
            )}
            <span className={styles.prmFoodPendingActions}>
              <button type="button" className={styles.prmIconBtn} onClick={() => onEdit(isEditing ? null : row.key)} aria-label={isEditing ? "پایان ویرایش ردیف" : "ویرایش ردیف در انتظار"}>
                <PrmIcon name={isEditing ? "check" : "edit"} />
              </button>
              <button type="button" className={styles.prmIconBtn} onClick={() => onDelete(row.key)} aria-label="حذف ردیف در انتظار">
                <PrmIcon name="trash" />
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------
// "Added this session" strip
// ------------------------------------------------------------------

function SessionStrip({ api, items }: { api: ProgramApi; items: BankItem[] }) {
  return (
    <div className={styles.prmSessionStrip}>
      <span className={styles.prmSessionTitle}>
        <PrmIcon name="clock" size={15} /> اضافه‌شده همین حالا
      </span>
      <div className={styles.prmSessionList}>
        {items.map((item) => (
          <span className={styles.prmSessionItem} key={item.key}>
            <b>{item.name}</b>
            <button type="button" className={styles.prmIconBtn} onClick={() => void api.bankDeleteMany([item.key])} aria-label="حذف از بانک">
              <PrmIcon name="trash" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
