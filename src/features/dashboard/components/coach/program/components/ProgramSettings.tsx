"use client";

// =============================================================
// GymPlus+ Coach — program settings
// One shared engine rendered twice:
//   workout  → muscle groups · day structure · equipment · execution units
//   nutrition→ food categories · meal structure · measurement units
// Rules honoured: disable ≠ delete, defaults protected, delete shows
// usage counts + a three-way choice (PrmSafeDelete).
// =============================================================

import { useState } from "react";

import {
  DEFAULT_MEAL_KINDS,
  ExecUnitItem,
  ProgramDomain,
  RefItem,
  StructureItem,
  UnitRefItem,
  freshKey,
} from "../program.types";
import { useProgramData } from "../hooks/useProgramData";
import { PrmBadge, PrmIcon, PrmSafeDelete, PrmSelect, PrmTextInput, PrmToggle, ReorderableList, SafeDeleteChoice, PrmNotice } from "./programShared";

import styles from "../program.module.css";

type ProgramApi = ReturnType<typeof useProgramData>;
type SafeDeleteState = { kind: "group" | "unit" | "equip"; item: RefItem } | null;

/** Move muscle-group occurrences inside a day’s tag list (dedupe, drop none). */
function replaceTag(tags: string[], from: string, to: string): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const tag of tags) {
    const value = tag === from ? to : tag;
    if (value && !seen.has(value)) {
      seen.add(value);
      next.push(value);
    }
  }
  return next;
}

export function ProgramSettings({ kind, api, groupsLabel }: { kind: ProgramDomain; api: ProgramApi; groupsLabel: string }) {
  return (
    <div className={styles.prmSettings}>
      {kind === "workout" ? (
        <WorkoutSettings api={api} kind={kind} groupsLabel={groupsLabel} />
      ) : (
        <NutritionSettings api={api} kind={kind} groupsLabel={groupsLabel} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Workout settings
// ------------------------------------------------------------------

function WorkoutSettings({ api, kind, groupsLabel }: { api: ProgramApi; kind: ProgramDomain; groupsLabel: string }) {
  const [safeDelete, setSafeDelete] = useState<SafeDeleteState>(null);
  const usageOfGroup = (key: string) => api.state.bank.filter((item) => item.group === key).length;
  const targets = api.state.groups.filter((item) => !item.disabled);

  const onGroupDelete = (choice: SafeDeleteChoice, target?: string) => {
    if (!safeDelete) return;
    const key = safeDelete.item.key;
    if (choice === "disable") {
      void api.groupSetDisabled(key, !safeDelete.item.disabled);
    } else if (choice === "move") {
      for (const item of api.state.bank) {
        if (item.group === key && target) void api.bankUpdate(item.key, { group: target });
      }
      void api.structureUpdate(api.state.structure.map((day) => ({ ...day, tags: replaceTag(day.tags, key, target ?? "") })));
      void api.groupDelete(key);
    } else {
      const underGroup = api.state.bank.filter((item) => item.group === key).map((item) => item.key);
      if (underGroup.length) void api.bankDeleteMany(underGroup);
      void api.structureUpdate(api.state.structure.map((day) => ({ ...day, tags: day.tags.filter((tag) => tag !== key) })));
      void api.groupDelete(key);
    }
    setSafeDelete(null);
  };

  const currentTargets = safeDelete ? targets.filter((item) => item.key !== safeDelete.item.key) : [];

  return (
    <>
      <SettingsSection
        title={groupsLabel}
        subtitle="این گروه‌ها در بانک حرکات و فیلتر برنامه‌سازی استفاده می‌شوند."
        addPlaceholder="مثال: کول · ساق پا"
        onAdd={(names) => void api.groupAddMany(names)}
        disabledHint
      >
        {api.state.groups.map((item) => {
          const usage = usageOfGroup(item.key);
          return (
            <SettingsRow
              key={item.key}
              item={item}
              badge={usage > 0 ? <PrmBadge tone="gray">{usage.toLocaleString("fa-IR")} حرکت</PrmBadge> : undefined}
              onToggle={(on) => void api.groupSetDisabled(item.key, on)}
              onDelete={() => setSafeDelete({ kind: "group", item })}
              onRename={(name) => void api.groupRename(item.key, name)}
            />
          );
        })}
        {!api.state.groups.length ? <SectionEmpty label="گروهی ثبت نشده است." /> : null}
      </SettingsSection>

      <DayStructureSection api={api} />

      <SettingsSection
        title="تجهیزات"
        subtitle="وسایلی که حرکت‌ها با آن‌ها انجام می‌شوند."
        addPlaceholder="مثال: فوم رولر · جفت کتل‌بل"
        onAdd={(names) => void api.equipmentAddMany(names)}
        disabledHint
      >
        {api.state.equipment.map((item) => {
          const usage = api.state.bank.filter((row) => row.equipment === item.key).length;
          return (
            <SettingsRow
              key={item.key}
              item={item}
              badge={usage > 0 ? <PrmBadge tone="gray">{usage.toLocaleString("fa-IR")} حرکت</PrmBadge> : undefined}
              onToggle={(on) => void api.groupSetDisabled(item.key, on)}
              onDelete={() => setSafeDelete({ kind: "equip", item })}
            />
          );
        })}
        {!api.state.equipment.length ? <SectionEmpty label="تجهیزی ثبت نشده است." /> : null}
      </SettingsSection>

      <ExecUnitsSection api={api} onDelete={(item) => setSafeDelete({ kind: "unit", item })} />

      {safeDelete?.kind === "group" ? (
        <PrmSafeDelete
          itemName={safeDelete.item.name}
          itemKind={groupsLabel}
          usageLabel={`${usageOfGroup(safeDelete.item.key).toLocaleString("fa-IR")} حرکت`}
          usageCount={usageOfGroup(safeDelete.item.key)}
          isDefault={safeDelete.item.isDefault}
          disabledNow={safeDelete.item.disabled}
          moveTargets={currentTargets}
          moveLabel={`انتقال حرکات به ${groupsLabel}`}
          onClose={() => setSafeDelete(null)}
          onDone={(choice, target) => onGroupDelete(choice, target)}
        />
      ) : null}
      {safeDelete?.kind === "equip" ? (
        <PrmSafeDelete
          itemName={safeDelete.item.name}
          itemKind="تجهیز"
          usageLabel={`${api.state.bank.filter((row) => row.equipment === safeDelete.item.key).length.toLocaleString("fa-IR")} حرکت`}
          usageCount={api.state.bank.filter((row) => row.equipment === safeDelete.item.key).length}
          isDefault={safeDelete.item.isDefault}
          disabledNow={safeDelete.item.disabled}
          moveTargets={api.state.equipment.filter((item) => item.key !== safeDelete.item.key)}
          moveLabel="انتقال حرکات به تجهیز"
          onClose={() => setSafeDelete(null)}
          onDone={(choice, target) => {
            if (!safeDelete) return;
            const key = safeDelete.item.key;
            if (choice === "disable") void api.groupSetDisabled(key, !safeDelete.item.disabled);
            else if (choice === "move") {
              for (const item of api.state.bank) if (item.equipment === key) void api.bankUpdate(item.key, { equipment: target ?? "" });
              void api.equipmentDelete(key);
            } else {
              const under = api.state.bank.filter((item) => item.equipment === key).map((item) => item.key);
              if (under.length) void api.bankDeleteMany(under);
              void api.equipmentDelete(key);
            }
            setSafeDelete(null);
          }}
        />
      ) : null}
      {safeDelete?.kind === "unit" ? <UnitSafeDelete kind={kind} api={api} item={safeDelete.item} onClose={() => setSafeDelete(null)} /> : null}
    </>
  );
}

// ------------------------------------------------------------------
// Nutrition settings
// ------------------------------------------------------------------

function NutritionSettings({ api, kind, groupsLabel }: { api: ProgramApi; kind: ProgramDomain; groupsLabel: string }) {
  const [safeDelete, setSafeDelete] = useState<SafeDeleteState>(null);
  const usageOfCategory = (key: string) => api.state.bank.filter((item) => item.category === key).length;
  const targets = api.state.groups.filter((item) => !item.disabled);

  return (
    <>
      <SettingsSection
        title={groupsLabel}
        subtitle="هر وعده از یک دسته می‌خواند؛ بانک متعلق به دسته است نه به یک برنامه."
        addPlaceholder="مثال: لبنیات · نوشیدنی"
        onAdd={(names) => void api.groupAddMany(names)}
        disabledHint
      >
        {api.state.groups.map((item) => {
          const usage = usageOfCategory(item.key);
          return (
            <SettingsRow
              key={item.key}
              item={item}
              badge={usage > 0 ? <PrmBadge tone="gray">{usage.toLocaleString("fa-IR")} ماده غذایی</PrmBadge> : undefined}
              onToggle={(on) => void api.groupSetDisabled(item.key, on)}
              onDelete={() => setSafeDelete({ kind: "group", item })}
              onRename={(name) => void api.groupRename(item.key, name)}
            />
          );
        })}
        {!api.state.groups.length ? <SectionEmpty label="دسته‌ای ثبت نشده است." /> : null}
      </SettingsSection>

      <MealStructureSection api={api} />

      <MeasureUnitsSection api={api} onDelete={(item) => setSafeDelete({ kind: "unit", item })} />

      {safeDelete?.kind === "group" ? (
        <PrmSafeDelete
          itemName={safeDelete.item.name}
          itemKind={groupsLabel}
          usageLabel={`${usageOfCategory(safeDelete.item.key).toLocaleString("fa-IR")} ماده غذایی`}
          usageCount={usageOfCategory(safeDelete.item.key)}
          isDefault={safeDelete.item.isDefault}
          disabledNow={safeDelete.item.disabled}
          moveTargets={targets.filter((item) => item.key !== safeDelete.item.key)}
          moveLabel={`انتقال مواد غذایی به ${groupsLabel}`}
          onClose={() => setSafeDelete(null)}
          onDone={(choice, target) => {
            if (!safeDelete) return;
            const key = safeDelete.item.key;
            if (choice === "disable") void api.groupSetDisabled(key, !safeDelete.item.disabled);
            else if (choice === "move") {
              for (const item of api.state.bank) if (item.category === key) void api.bankUpdate(item.key, { category: target ?? "" });
              void api.structureUpdate(api.state.structure.map((meal) => ({ ...meal, tags: meal.tags.map((tag) => (tag === key && target ? target : tag)) })));
              void api.groupDelete(key);
            } else {
              const under = api.state.bank.filter((item) => item.category === key).map((item) => item.key);
              if (under.length) void api.bankDeleteMany(under);
              void api.structureUpdate(api.state.structure.map((meal) => ({ ...meal, tags: meal.tags.filter((tag) => tag !== key) })));
              void api.groupDelete(key);
            }
            setSafeDelete(null);
          }}
        />
      ) : null}
      {safeDelete?.kind === "unit" ? <UnitSafeDelete kind={kind} api={api} item={safeDelete.item} onClose={() => setSafeDelete(null)} /> : null}
    </>
  );
}

function UnitSafeDelete({ kind, api, item, onClose }: { kind: ProgramDomain; api: ProgramApi; item: RefItem; onClose: () => void }) {
  const code = (item as { code?: string }).code ?? "";
  const usage = kind === "workout" ? api.state.bank.filter((row) => row.unit === code).length : api.state.bank.filter((row) => row.unit === code).length;
  return (
    <PrmSafeDelete
      itemName={item.name}
      itemKind="واحد"
      usageLabel={`${usage.toLocaleString("fa-IR")} مورد در بانک`}
      usageCount={usage}
      isDefault={item.isDefault}
      disabledNow={item.disabled}
      moveTargets={api.state.units
        .filter((unit) => unit.key !== item.key && !unit.disabled)
        .map((unit) => ({ key: (unit as { code?: string }).code ?? unit.key, name: unit.name }))}
      moveLabel="واحد موردهای بانک را به"
      onClose={onClose}
      onDone={(choice, target) => {
        if (choice === "disable") void api.unitSetDisabled(item.key, !item.disabled);
        else if (choice === "move") {
          for (const row of api.state.bank) if (row.unit === code) void api.bankUpdate(row.key, { unit: target ?? "" });
          void api.unitDelete(item.key);
        } else {
          const under = api.state.bank.filter((row) => row.unit === code).map((row) => row.key);
          if (under.length) void api.bankDeleteMany(under);
          void api.unitDelete(item.key);
        }
        onClose();
      }}
    />
  );
}

// ------------------------------------------------------------------
// Section chrome + row + add-many input
// ------------------------------------------------------------------

function SettingsSection({
  title,
  subtitle,
  children,
  addPlaceholder,
  onAdd,
  disabledHint,
  extra,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  addPlaceholder: string;
  onAdd: (names: string[]) => void;
  disabledHint?: boolean;
  extra?: React.ReactNode;
}) {
  const [draft, setDraft] = useState("");
  const submit = () => {
    const names = draft.split("\n").map((name) => name.trim()).filter(Boolean);
    if (!names.length) return;
    onAdd(names);
    setDraft("");
  };
  return (
    <section className={styles.prmPanel}>
      <header className={styles.prmPanelHead}>
        <span>
          <h2>{title}</h2>
          {subtitle ? <small>{subtitle}</small> : null}
        </span>
        {extra}
      </header>
      <div className={styles.prmAddMany}>
        <textarea
          className={styles.prmAddManyInput}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={addPlaceholder}
          rows={2}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button type="button" className={styles.prmBtnPrimary} onClick={submit} disabled={!draft.trim()}>
          <PrmIcon name="plus" /> افزودن چندتایی
        </button>
      </div>
      {children}
      {disabledHint ? <p className={styles.prmSettingsHint}>با کلید «غیرفعال» مورد از برنامه‌سازی پنهان می‌شود بدون آنکه حذف شود.</p> : null}
    </section>
  );
}

function SettingsRow({ item, onDelete, onRename, onToggle, badge }: { item: RefItem; onDelete: () => void; onRename?: (name: string) => void; onToggle: (disabled: boolean) => void; badge?: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.name);
  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== item.name) onRename?.(next);
  };
  return (
    <div className={styles.prmRow}>
      <span className={styles.prmRowName}>
        {editing ? (
          <PrmTextInput value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => event.key === "Enter" && commit()} autoFocus />
        ) : (
          <b>{item.name}</b>
        )}
        {item.isDefault ? <PrmBadge tone="blue">پیش‌فرض</PrmBadge> : null}
        {item.disabled ? <PrmBadge tone="gray" muted>غیرفعال</PrmBadge> : null}
      </span>
      {badge}
      <span className={styles.prmRowActions}>
        <PrmToggle on={item.disabled === true} onToggle={() => onToggle(!item.disabled)} label="غیرفعال/فعال" />
        {onRename ? (
          <button type="button" className={styles.prmIconBtn} onClick={() => { setDraft(item.name); setEditing((value) => !value); }} aria-label="ویرایش نام">
            <PrmIcon name="edit" />
          </button>
        ) : null}
        <button type="button" className={styles.prmIconBtn} onClick={onDelete} aria-label="حذف" disabled={item.isDefault}>
          <PrmIcon name="trash" />
        </button>
      </span>
    </div>
  );
}

function SectionEmpty({ label }: { label: string }) {
  return <div className={styles.prmSectionEmpty}>{label}</div>;
}

// ------------------------------------------------------------------
// Structure editors
// ------------------------------------------------------------------

function DayStructureSection({ api }: { api: ProgramApi }) {
  const groupName = (key: string) => api.state.groups.find((item) => item.key === key)?.name ?? key;
  const activeGroups = api.state.groups.filter((item) => !item.disabled);
  const addDay = () => {
    const next: StructureItem = { key: freshKey("day"), name: `روز ${api.state.structure.length + 1}`, tags: [] };
    void api.structureUpdate([...api.state.structure, next]);
  };
  return (
    <section className={styles.prmPanel}>
      <header className={styles.prmPanelHead}>
        <span>
          <h2>ساختار روزهای تمرین</h2>
          <small>نام روز و ترکیب عضلانی آن؛ با کشیدن، ترتیب روزها عوض می‌شود و شماره‌ها خودکار می‌آیند.</small>
        </span>
        <button type="button" className={styles.prmBtn} onClick={addDay}>
          <PrmIcon name="plus" /> روز جدید
        </button>
      </header>
      <ReorderableList
        items={api.state.structure}
        onChange={(items) => void api.structureUpdate(items)}
        renderItem={(day, index) => (
          <div className={styles.prmStructRow}>
            <span className={styles.prmStructIndex}>{(index + 1).toLocaleString("fa-IR")}</span>
            <div className={styles.prmStructMain}>
              <PrmTextInput value={day.name} onChange={(event) => void api.structureUpdate(api.state.structure.map((item) => (item.key === day.key ? { ...item, name: event.target.value } : item)))} />
              <div className={styles.prmChipRow}>
                {activeGroups.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    className={`${styles.prmChip} ${day.tags.includes(group.key) ? styles.prmChipActive : ""}`}
                    onClick={() =>
                      void api.structureUpdate(
                        api.state.structure.map((item) =>
                          item.key === day.key ? { ...item, tags: item.tags.includes(group.key) ? item.tags.filter((tag) => tag !== group.key) : [...item.tags, group.key] } : item,
                        ),
                      )
                    }
                  >
                    {group.name}
                  </button>
                ))}
              </div>
              {day.tags.length ? <p className={styles.prmStructComposition}>{day.tags.map((tag) => groupName(tag)).join(" + ")}</p> : null}
            </div>
            <button type="button" className={styles.prmIconBtn} onClick={() => void api.structureUpdate(api.state.structure.filter((item) => item.key !== day.key))} aria-label="حذف روز">
              <PrmIcon name="trash" />
            </button>
          </div>
        )}
      />
      <PrmNotice tone="blue">روزها فقط در ساختار برنامه‌های جدید اثر می‌گذارند؛ برنامه‌های ذخیره‌شده تغییر نمی‌کنند.</PrmNotice>
    </section>
  );
}

function MealStructureSection({ api }: { api: ProgramApi }) {
  const categoryName = (key: string) => api.state.groups.find((item) => item.key === key)?.name ?? key;
  const activeCategories = api.state.groups.filter((item) => !item.disabled);
  const usedKinds = api.state.structure.map((meal) => meal.kind).filter(Boolean);
  const availableKinds = DEFAULT_MEAL_KINDS.filter(([kind]) => !usedKinds.includes(kind));
  const addMeal = () => {
    const [kind, name] = availableKinds[0] ?? ["", "وعده جدید"];
    const next: StructureItem = { key: freshKey("meal"), kind, name, tags: activeCategories.length ? [activeCategories[0].key] : [] };
    void api.structureUpdate([...api.state.structure, next]);
  };
  return (
    <section className={styles.prmPanel}>
      <header className={styles.prmPanelHead}>
        <span>
          <h2>ساختار وعده‌های غذایی</h2>
          <small>هر وعده یک دسته غذایی انتخاب می‌کند؛ بانک آن وعده فقط از همان دسته پر می‌شود.</small>
        </span>
        <button type="button" className={styles.prmBtn} onClick={addMeal} disabled={!availableKinds.length && activeCategories.length === 0}>
          <PrmIcon name="plus" /> وعده جدید
        </button>
      </header>
      <ReorderableList
        items={api.state.structure}
        onChange={(items) => void api.structureUpdate(items)}
        renderItem={(meal, index) => (
          <div className={styles.prmStructRow}>
            <span className={styles.prmStructIndex}>{(index + 1).toLocaleString("fa-IR")}</span>
            <div className={styles.prmStructMain}>
              <div className={styles.prmStructMealRow}>
                <PrmTextInput value={meal.name} onChange={(event) => void api.structureUpdate(api.state.structure.map((item) => (item.key === meal.key ? { ...item, name: event.target.value } : item)))} />
                <PrmSelect
                  value={meal.tags[0] ?? ""}
                  onChange={(value) => void api.structureUpdate(api.state.structure.map((item) => (item.key === meal.key ? { ...item, tags: [value] } : item)))}
                  options={activeCategories.map((item) => [item.key, item.name])}
                  placeholder="دسته غذایی"
                />
              </div>
              <p className={styles.prmStructComposition}>{meal.tags[0] ? `مواد از دسته «${categoryName(meal.tags[0])}»` : "دسته‌ای انتخاب نشده است"}</p>
            </div>
            <button type="button" className={styles.prmIconBtn} onClick={() => void api.structureUpdate(api.state.structure.filter((item) => item.key !== meal.key))} aria-label="حذف وعده">
              <PrmIcon name="trash" />
            </button>
          </div>
        )}
      />
    </section>
  );
}

// ------------------------------------------------------------------
// Units
// ------------------------------------------------------------------

function ExecUnitsSection({ api, onDelete }: { api: ProgramApi; onDelete: (item: RefItem) => void }) {
  const [draft, setDraft] = useState("");
  const submit = () => {
    const names = draft.split("\n").map((name) => name.trim()).filter(Boolean);
    if (!names.length) return;
    void api.unitAddMany(names);
    setDraft("");
  };
  return (
    <section className={styles.prmPanel}>
      <header className={styles.prmPanelHead}>
        <span>
          <h2>واحدهای اجرای حرکت</h2>
          <small>تکرار، ثانیه، دقیقه، متر پیش‌فرض و محافظت‌شده هستند؛ واحد سفارشی اضافه کنید.</small>
        </span>
      </header>
      <div className={styles.prmAddMany}>
        <textarea
          className={styles.prmAddManyInput}
          value={draft}
          rows={2}
          placeholder="مثال: ایستگاه · مرحله"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button type="button" className={styles.prmBtnPrimary} onClick={submit} disabled={!draft.trim()}>
          <PrmIcon name="plus" /> افزودن
        </button>
      </div>
      {api.state.units.map((item) => {
        const execUnit = item as ExecUnitItem;
        return (
          <UnitRow key={item.key} item={item} code={execUnit.code} usage={api.state.bank.filter((row) => row.unit === execUnit.code).length} onToggle={(on) => void api.unitSetDisabled(item.key, on)} onDelete={() => onDelete(item)} />
        );
      })}
    </section>
  );
}

function MeasureUnitsSection({ api, onDelete }: { api: ProgramApi; onDelete: (item: RefItem) => void }) {
  const [draft, setDraft] = useState("");
  const submit = () => {
    const names = draft.split("\n").map((name) => name.trim()).filter(Boolean);
    if (!names.length) return;
    void api.unitAddMany(names);
    setDraft("");
  };
  return (
    <section className={styles.prmPanel}>
      <header className={styles.prmPanelHead}>
        <span>
          <h2>واحدهای اندازه‌گیری</h2>
         
        </span>
      </header>
      <div className={styles.prmAddMany}>
        <textarea
          className={styles.prmAddManyInput}
          value={draft}
          rows={2}
          placeholder="مثال: لیوان · پیمانه · قاشق غذاخوری"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button type="button" className={styles.prmBtnPrimary} onClick={submit} disabled={!draft.trim()}>
          <PrmIcon name="plus" /> افزودن
        </button>
      </div>
      {api.state.units.map((item) => {
        const unit = item as UnitRefItem;
        return (
          <div className={styles.prmRow} key={item.key}>
            <span className={styles.prmRowName}>
              <b>{item.name}</b>
              {item.isDefault ? <PrmBadge tone="blue">پیش‌فرض</PrmBadge> : null}
              {item.disabled ? <PrmBadge tone="gray" muted>غیرفعال</PrmBadge> : null}
            </span>
            {api.state.bank.filter((row) => row.unit === unit.code).length > 0 ? (
              <PrmBadge tone="gray">{api.state.bank.filter((row) => row.unit === unit.code).length.toLocaleString("fa-IR")} مورد</PrmBadge>
            ) : null}
            <span className={styles.prmRowActions}>
              <PrmToggle on={item.disabled === true} onToggle={() => void api.unitSetDisabled(item.key, !item.disabled)} label="غیرفعال/فعال" />
              <button type="button" className={styles.prmIconBtn} onClick={() => onDelete(item)} aria-label="حذف واحد" disabled={item.isDefault}>
                <PrmIcon name="trash" />
              </button>
            </span>
          </div>
        );
      })}
    </section>
  );
}

function UnitRow({ item, code, usage, onToggle, onDelete }: { item: RefItem; code: string; usage: number; onToggle: (on: boolean) => void; onDelete: () => void }) {
  return (
    <div className={styles.prmRow}>
      <span className={styles.prmRowName}>
        <b>{item.name}</b>
        {item.isDefault ? <PrmBadge tone="blue">پیش‌فرض</PrmBadge> : null}
        {item.disabled ? <PrmBadge tone="gray" muted>غیرفعال</PrmBadge> : null}
      </span>
      {usage > 0 ? <PrmBadge tone="gray">{usage.toLocaleString("fa-IR")} حرکت</PrmBadge> : null}
      <span className={styles.prmRowActions}>
        <PrmToggle on={item.disabled === true} onToggle={() => onToggle(!item.disabled)} label="غیرفعال/فعال" />
        <button type="button" className={styles.prmIconBtn} onClick={onDelete} aria-label="حذف واحد" disabled={item.isDefault}>
          <PrmIcon name="trash" />
        </button>
      </span>
    </div>
  );
}
