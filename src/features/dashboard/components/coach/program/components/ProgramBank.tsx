"use client";

// =============================================================
// GymPlus+ Coach — bank manager (exercise bank / food bank)
// Quick-entry bar + big text field (Enter adds & refocuses),
// multi-line paste bulk-add with Persian summary + duplicate skip,
// inline "نام | واحد | هدف" parsing, "added this session" strip,
// search / goal filters / multi-select + bulk actions, disable toggle.
// =============================================================

import { useEffect, useMemo, useRef, useState } from "react";

import { BankItem, PlanMode, ProgramDomain, MODE_OPTIONS } from "../program.types";
import { useProgramData } from "../hooks/useProgramData";
import { PrmBadge, PrmIcon, PrmNotice, PrmSelect, PrmTextInput, PrmToggle, PrmEmpty, PrmConfirm } from "./programShared";

import styles from "../program.module.css";

type ProgramApi = ReturnType<typeof useProgramData>;

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

/** Parse one quick-entry line: «نام | واحد | هدف» — unit/goal tokens are optional. */
export function parseBankLine(api: ProgramApi, kind: ProgramDomain, line: string): Partial<BankItem> | null {
  const raw = line.trim();
  if (!raw) return null;
  const parts = raw.split("|").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return null;
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
  if (!patch.unit) patch.unit = kind === "workout" ? "reps" : "g";
  return patch;
}

export function ProgramBank({ kind, api }: { kind: ProgramDomain; api: ProgramApi }) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [goalFilter, setGoalFilter] = useState<PlanMode | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<BankItem | null>(null);
  const [bulkPick, setBulkPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

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
      if (item.disabled && !q) return false;
      if (q && !normalize(`${item.name} ${groupName(item[tagKey])} ${item.equipment ?? ""} ${item.note ?? ""}`).includes(q)) return false;
      if (groupFilter !== "all" && item[tagKey] !== groupFilter) return false;
      if (goalFilter !== "all" && !(item.goals ?? []).includes(goalFilter)) return false;
      return true;
    });
  }, [items, query, groupFilter, goalFilter, tagKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const addFromDraft = async () => {
    const lines = draft.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return;
    setBusy(true);
    const existingNames = new Set(items.map((item) => normalize(item.name)));
    const fallbackTag = groupFilter !== "all" ? groupFilter : activeGroups[0]?.key ?? "";
    const incoming: Array<{ name: string; defaults: Partial<BankItem> }> = [];
    let duplicates = 0;
    for (const line of lines) {
      const patch = parseBankLine(api, kind, line);
      if (!patch?.name) continue;
      const name = normalize(patch.name);
      if (existingNames.has(name)) {
        duplicates += 1;
        continue;
      }
      existingNames.add(name);
      const tagFromPatch = (patch as Partial<BankItem> & Record<string, unknown>)[tagKey];
      incoming.push({
        name: patch.name,
        defaults: {
          name: patch.name,
          unit: patch.unit,
          goals: patch.goals?.length ? patch.goals : [],
          kcal100: patch.kcal100,
          note: patch.note,
          [tagKey]: typeof tagFromPatch === "string" && tagFromPatch ? tagFromPatch : fallbackTag,
        },
      });
    }
    let added = 0;
    for (const entry of incoming) {
      added += await api.bankAdd([entry.name], entry.defaults);
    }
    if (incoming.length) {
      toast(
        duplicates > 0
          ? `${added.toLocaleString("fa-IR")} مورد اضافه شد؛ ${duplicates.toLocaleString("fa-IR")} مورد تکراری نادیده گرفته شد.`
          : `${added.toLocaleString("fa-IR")} مورد به ${kind === "workout" ? "بانک حرکات" : "بانک مواد غذایی"} اضافه شد.`,
        duplicates > 0 ? "info" : "success",
      );
    }
    setDraft("");
    setBusy(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const bulkAction = async (action: "disable" | "enable" | "delete" | "move", target?: string) => {
    const keys = [...selected];
    if (!keys.length) return;
    setBusy(true);
    if (action === "disable") {
      for (const key of keys) await api.bankUpdate(key, { disabled: true });
    } else if (action === "enable") {
      for (const key of keys) await api.bankUpdate(key, { disabled: false });
    } else if (action === "delete") {
      await api.bankDeleteMany(keys);
    } else if (action === "move" && target) {
      const patch: Partial<BankItem> = kind === "workout" ? { group: target } : { category: target };
      for (const key of keys) await api.bankUpdate(key, patch);
    }
    if (action === "delete") toast(`${keys.length.toLocaleString("fa-IR")} مورد حذف شد.`);
    else if (action === "move") toast("انتقال انجام شد.");
    setSelected(new Set());
    setBulkPick(false);
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

      {/* quick entry */}
      <div className={styles.prmQuickEntry}>
        <div className={styles.prmQuickSettings}>
          <label className={styles.prmQuickField}>
            <span>{tagLabel} پیش‌فرض</span>
            <PrmSelect
              value={groupFilter}
              onChange={setGroupFilter}
              options={activeGroups.map((item) => [item.key, item.name])}
              placeholder={kind === "workout" ? "همه گروه‌ها" : "همه دسته‌ها"}
            />
          </label>
        </div>
        <div className={styles.prmQuickAdd}>
          <textarea
            ref={inputRef}
            className={styles.prmQuickArea}
            rows={2}
            value={draft}
            placeholder={
              kind === "workout"
                ? "هر خط یک حرکت: «پلانک | ثانیه | کات»\nچند خط بچسبانید تا یکجا اضافه شود."
                : "هر خط یک ماده: «حلیم | کاسه | حجم»\nچند خط بچسبانید تا یکجا اضافه شود."
            }
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void addFromDraft();
              }
            }}
          />
          <button type="button" className={styles.prmBtnPrimary} onClick={() => void addFromDraft()} disabled={busy || !draft.trim()}>
            <PrmIcon name="plus" /> {busy ? "در حال افزودن..." : "افزودن"}
          </button>
        </div>
        <p className={styles.prmQuickNote}>
          <PrmIcon name="alert" size={14} />
          قالب هر خط: <b>نام | واحد | هدف</b> — واحد و هدف اختیاری‌اند؛ اگر نیایند، مقدار پیش‌فرض درج می‌شود.
        </p>
      </div>

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
                    if (target) void bulkAction("move", target);
                  }}
                  options={activeGroups.map((item) => [item.key, item.name])}
                  placeholder={`انتقال به ${tagLabel}...`}
                />
              </span>
              <button type="button" className={styles.prmBtn} onClick={() => setBulkPick(false)} disabled={busy}>
                انصراف
              </button>
            </>
          ) : (
            <>
              <button type="button" className={styles.prmBtn} onClick={() => setBulkPick(true)} disabled={busy}>
                <PrmIcon name="swap" /> انتقال
              </button>
              <button type="button" className={styles.prmBtn} onClick={() => void bulkAction("disable")} disabled={busy}>
                <PrmIcon name="ban" /> غیرفعال
              </button>
              <button type="button" className={styles.prmBtn} onClick={() => void bulkAction("enable")} disabled={busy}>
                <PrmIcon name="check" /> فعال
              </button>
              <button type="button" className={styles.prmBtnDanger} onClick={() => void bulkAction("delete")} disabled={busy}>
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
              <span className={styles.prmBankUnit}>{unitName(api, item.unit ?? "")}</span>
              <span className={styles.prmBankGoals}>
                {!item.goals?.length ? <PrmBadge tone="blue">همه اهداف</PrmBadge> : item.goals.map((goal) => <PrmBadge key={goal} tone={goal === "volume" ? "orange" : goal === "cut" ? "green" : "gray"}>{MODE_OPTIONS.find(([mode]) => mode === goal)?.[1]}</PrmBadge>)}
              </span>
              <span className={styles.prmBankActions}>
                <PrmToggle on={item.disabled === true} onToggle={() => void api.bankUpdate(item.key, { disabled: !item.disabled })} label="فعال/غیرفعال" />
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
                  {kind === "nutrition" ? (
                    <label className={styles.prmBankEditField}>
                      <span>کالری هر ۱۰۰ گرم</span>
                      <input className={styles.prmMiniInput} type="number" min={0} value={item.kcal100 ?? 0} onChange={(event) => void api.bankUpdate(item.key, { kcal100: Number(event.target.value) })} />
                    </label>
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
        <PrmNotice tone="gray">موردهای غیرفعال در بانک می‌مانند ولی در برنامه‌سازی پیشنهاد نمی‌شوند؛ با جستجو هنوز قابل مشاهده‌اند.</PrmNotice>
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
            setDeleting(null);
          }}
        />
      ) : null}
    </section>
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
