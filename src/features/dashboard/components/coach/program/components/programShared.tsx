"use client";

// =============================================================
// GymPlus+ Coach program module — shared primitives
// (icons, modal shell, notices, dialogs, reorderable rows)
// Styling lives in ../program.module.css
// =============================================================

import { useEffect, useRef, useState } from "react";

import styles from "../program.module.css";

export type PrmTone = "orange" | "green" | "blue" | "red" | "gray" | "yellow";

export type PrmIconName =
  | "plus"
  | "trash"
  | "edit"
  | "close"
  | "check"
  | "search"
  | "refresh"
  | "send"
  | "copy"
  | "eye"
  | "alert"
  | "grip"
  | "caret"
  | "clock"
  | "warning"
  | "ban"
  | "swap"
  | "grid"
  | "training"
  | "food"
  | "settings"
  | "user"
  | "phone";

const PATHS: Record<PrmIconName, React.ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" /><path d="M10 11v6M14 11v6" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m4 12 5 5L20 6" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4" /></>,
  refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M6.1 8a7 7 0 0 1 11.5-2L20 8M4 16l2.4 2a7 7 0 0 0 11.5-2" /></>,
  send: <><path d="M20 5 5 12l6 2 2 6 7-15Z" /><path d="m11 14 3-3" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
  eye: <><path d="M2 12s3.5-6.6 10-6.6S22 12 22 12s-3.5 6.6-10 6.6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.7" /></>,
  alert: <><path d="M12 3 3.5 18h17L12 3Z" /><path d="M12 8v4.5M12 16h.01" /></>,
  grip: <><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></>,
  caret: <path d="m6 9 6 6 6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  warning: <><path d="M12 4 3.5 19h17L12 4Z" /><path d="M12 10v4M12 17h.01" /></>,
  ban: <><circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" /></>,
  swap: <><path d="M7 5v13" /><path d="M4 15l3 3 3-3M17 19V6" /><path d="m20 9-3-3-3 3" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  training: <><rect x="3" y="4" width="18" height="15" rx="2" /><path d="M8 22h8M12 19v3M8 9h8M8 13h5" /></>,
  food: <><path d="M4 3v8a4 4 0 0 0 4 4h0a4 4 0 0 0 4-4V3M8 15v6M20 3c-2 1-3 3-3 6s1 5 3 5" /><path d="M17 3v18" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-3.6 3.6-5.5 8-5.5s8 1.9 8 5.5" /></>,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.9Z" />,
};

export function PrmIcon({ name, size = 18 }: { name: PrmIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

export function PrmBadge({ tone, children, muted }: { tone?: PrmTone; children: React.ReactNode; muted?: boolean }) {
  return <span className={`${styles.prmBadge} ${tone ? styles[`prmBadge${tone[0].toUpperCase()}${tone.slice(1)}`] : ""} ${muted ? styles.prmBadgeMuted : ""}`}>{children}</span>;
}

export function PrmToggle({ on, disabled, onToggle, label }: { on: boolean; disabled?: boolean; onToggle: () => void; label?: string }) {
  return (
    <button type="button" className={`${styles.prmSwitch} ${on ? styles.prmSwitchOn : ""} ${disabled ? styles.prmSwitchDisabled : ""}`} onClick={onToggle} disabled={disabled} role="switch" aria-checked={on} aria-label={label}>
      <i />
    </button>
  );
}

export function PrmOffline({ children, onRetry, busy }: { children: React.ReactNode; onRetry?: () => void; busy?: boolean }) {
  return (
    <div className={styles.prmOffline}>
      <PrmIcon name="warning" />
      <span>{children}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} disabled={busy}>
          <PrmIcon name="refresh" /> {busy ? "در حال تلاش..." : "تلاش دوباره"}
        </button>
      ) : null}
    </div>
  );
}

export function PrmNotice({ children, tone = "blue" }: { children: React.ReactNode; tone?: PrmTone }) {
  return (
    <div className={`${styles.prmNotice} ${styles[`prmNotice${tone[0].toUpperCase()}${tone.slice(1)}`]}`}>
      <PrmIcon name={tone === "green" ? "check" : tone === "orange" ? "alert" : tone === "red" ? "ban" : "alert"} />
      <span>{children}</span>
    </div>
  );
}

export function PrmEmpty({ icon = "grid", title, hint, action, onAction }: { icon?: PrmIconName; title: string; hint?: string; action?: string; onAction?: () => void }) {
  return (
    <div className={styles.prmEmpty}>
      <span className={styles.prmEmptyIcon}>
        <PrmIcon name={icon} size={26} />
      </span>
      <b>{title}</b>
      {hint ? <p>{hint}</p> : null}
      {action && onAction ? (
        <button type="button" className={styles.prmBtn} onClick={onAction}>
          <PrmIcon name="plus" /> {action}
        </button>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------
// Modal shell
// ------------------------------------------------------------------

export function PrmModal({ children, onClose, small, wide }: { children: React.ReactNode; onClose: () => void; small?: boolean; wide?: boolean }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);
  return (
    <div className={styles.prmOverlay} onMouseDown={onClose}>
      <div
        className={`${styles.prmModal} ${small ? styles.prmModalSmall : ""} ${wide ? styles.prmModalWide : ""}`}
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function PrmModalHead({ title, onClose, subtitle }: { title: string; onClose: () => void; subtitle?: string }) {
  return (
    <div className={styles.prmModalHead}>
      <span>
        <h2>{title}</h2>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
      <button type="button" onClick={onClose} aria-label="بستن">
        <PrmIcon name="close" />
      </button>
    </div>
  );
}

export function PrmField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className={styles.prmField}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function PrmTextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" {...props} className={`${styles.prmInput} ${props.className ?? ""}`} />;
}

export function PrmSelect({ value, onChange, options, placeholder }: { value: string; onChange: (value: string) => void; options: Array<[string, string]>; placeholder?: string }) {
  return (
    <select className={styles.prmInput} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder ?? "انتخاب کنید"}</option>
      {options.map(([val, label]) => (
        <option key={val} value={val}>
          {label}
        </option>
      ))}
    </select>
  );
}

export function PrmSpinner() {
  return <div className={styles.prmSpinner} aria-label="در حال بارگذاری" role="status" />;
}

// ------------------------------------------------------------------
// Confirm dialog
// ------------------------------------------------------------------

export function PrmConfirm({
  title,
  description,
  confirmLabel = "تأیید",
  tone = "orange",
  pending,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  tone?: "orange" | "red";
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <PrmModal onClose={() => !pending && onCancel()} small>
      <PrmModalHead title={title} onClose={onCancel} />
      <div className={styles.prmConfirmBody}>
        <span className={tone === "red" ? styles.prmConfirmIconRed : styles.prmConfirmIconOrange}>
          <PrmIcon name={tone === "red" ? "trash" : "warning"} size={24} />
        </span>
        <div className={styles.prmConfirmText}>{description}</div>
        <div className={styles.prmConfirmActions}>
          <button type="button" className={styles.prmBtn} onClick={onCancel} disabled={pending}>
            انصراف
          </button>
          <button type="button" className={tone === "red" ? styles.prmBtnDanger : styles.prmBtnPrimary} onClick={onConfirm} disabled={pending}>
            {pending ? "در حال انجام..." : confirmLabel}
          </button>
        </div>
      </div>
    </PrmModal>
  );
}

// ------------------------------------------------------------------
// Three-way safe-delete dialog (disable ≠ delete; defaults protected)
// ------------------------------------------------------------------

export type SafeDeleteChoice = "disable" | "move" | "delete";

export function PrmSafeDelete({
  itemName,
  itemKind, // e.g. "گروه عضلانی"
  usageLabel, // e.g. "۳ حرکت"
  usageCount,
  isDefault,
  disabledNow,
  moveTargets = [],
  moveLabel = "انتقال به",
  pending,
  onClose,
  onDone,
}: {
  itemName: string;
  itemKind: string;
  usageLabel?: string;
  usageCount: number;
  isDefault?: boolean;
  disabledNow?: boolean;
  moveTargets?: Array<{ key: string; name: string }>;
  moveLabel?: string;
  pending?: boolean;
  onClose: () => void;
  onDone: (choice: SafeDeleteChoice, moveTarget?: string) => void;
}) {
  const [choice, setChoice] = useState<SafeDeleteChoice>("disable");
  const [target, setTarget] = useState("");
  const protectedItem = isDefault === true;
  const moveAvailable = !protectedItem && moveTargets.length > 0;

  const choiceOptions: Array<{ value: SafeDeleteChoice; title: string; desc: string; disabled?: boolean }> = [
    {
      value: "disable",
      title: disabledNow ? "فعال کردن مجدد" : "فقط غیرفعال کن",
      desc: "در برنامه‌سازی نمایش داده نمی‌شود؛ داده از بین نمی‌رود.",
      disabled: false,
    },
    {
      value: "move",
      title: `انتقال و حذف ${itemKind}`,
      desc: usageCount > 0 ? `ابتدا ${usageLabel ?? `${usageCount} مورد`} به دسته دیگر منتقل می‌شود، سپس حذف می‌شود.` : "مورد استفاده‌ای ندارد؛ مستقیم حذف می‌شود.",
      disabled: !moveAvailable && !(usageCount === 0),
    },
    {
      value: "delete",
      title: `حذف کامل و همه موارد`,
      desc: usageCount > 0 ? `${usageLabel ?? `${usageCount} مورد`} استفاده دارد و به‌طور کامل حذف می‌شود.` : "این مورد به‌طور کامل حذف می‌شود.",
      disabled: protectedItem,
    },
  ];

  // guard the disabled choices text when defaults protected
  const effectiveOptions = choiceOptions.map((option) => ({
    ...option,
    disabled:
      option.disabled ||
      (protectedItem && option.value !== "disable" && option.value !== "move"),
  }));

  const submit = () => {
    if (choice === "move" && usageCount > 0 && !target) return;
    onDone(choice, choice === "move" ? target : undefined);
  };

  return (
    <PrmModal onClose={() => !pending && onClose()} small>
      <PrmModalHead title="حذف امن" onClose={onClose} subtitle={protectedItem ? "این مورد از پیش‌فرض‌هاست و حذف کامل آن ممکن نیست." : undefined} />
      <div className={styles.prmSdBody}>
        <div className={styles.prmSdTarget}>
          <span className={styles.prmSdTargetIcon}>
            <PrmIcon name="trash" />
          </span>
          <span>
            <b>{itemName}</b>
            <small>{itemKind}</small>
          </span>
          <PrmBadge tone={usageCount > 0 ? "orange" : "gray"}>{usageCount > 0 ? `${usageCount.toLocaleString("fa-IR")} مورد استفاده` : "بدون استفاده"}</PrmBadge>
        </div>
        <p className={styles.prmSdLead}>هیچ حذفی نباید داده زنده را بی‌صدا از بین ببرد. یکی از روش‌های زیر را انتخاب کنید:</p>
        <div className={styles.prmSdOptions}>
          {effectiveOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.prmSdOption} ${choice === option.value ? styles.prmSdOptionActive : ""}`}
              disabled={option.disabled}
              onClick={() => setChoice(option.value)}
            >
              <span className={styles.prmSdRadio}>{choice === option.value ? <i /> : null}</span>
              <span>
                <b>{option.title}</b>
                <small>{option.desc}</small>
              </span>
            </button>
          ))}
        </div>
        {choice === "move" && usageCount > 0 ? (
          <div className={styles.prmSdMove}>
            <span>{moveLabel}</span>
            <PrmSelect
              value={target}
              onChange={setTarget}
              options={moveTargets.map((item) => [item.key, item.name])}
              placeholder={`${moveLabel}...`}
            />
          </div>
        ) : null}
        <div className={styles.prmConfirmActions}>
          <button type="button" className={styles.prmBtn} onClick={onClose} disabled={pending}>
            انصراف
          </button>
          <button type="button" className={styles.prmBtnPrimary} onClick={submit} disabled={pending || (choice === "move" && usageCount > 0 && !target)}>
            {pending ? "در حال انجام..." : choice === "disable" ? (disabledNow ? "فعال کردن" : "غیرفعال کن") : "تأیید حذف"}
          </button>
        </div>
      </div>
    </PrmModal>
  );
}

// ------------------------------------------------------------------
// Drag-reorder list (HTML5, no dependency)
// ------------------------------------------------------------------

export function ReorderableList<T extends { key: string }>({
  items,
  onChange,
  renderItem,
  className,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragNode = useRef<HTMLDivElement | null>(null);

  const handleDrop = () => {
    if (dragIndex === null || overIndex === null || dragIndex === overIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(overIndex, 0, moved);
    onChange(next);
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div className={`${styles.prmReorder} ${className ?? ""}`}>
      {items.map((item, index) => (
        <div
          key={item.key}
          draggable={dragIndex !== null || true}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            dragNode.current = event.currentTarget;
            setDragIndex(index);
            requestAnimationFrame(() => dragNode.current?.classList.add(styles.prmDragging));
          }}
          onDragEnd={() => {
            dragNode.current?.classList.remove(styles.prmDragging);
            dragNode.current = null;
            setDragIndex(null);
            setOverIndex(null);
          }}
          onDragOver={(event) => {
            if (dragIndex === null) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            if (index !== overIndex) setOverIndex(index);
          }}
          onDrop={(event) => {
            event.preventDefault();
            handleDrop();
          }}
          className={`${styles.prmReorderRow} ${dragIndex === index ? styles.prmDragSource : ""} ${overIndex === index && dragIndex !== null ? styles.prmDragOver : ""}`}
        >
          <span className={styles.prmGrip} aria-hidden="true" title="جابه‌جایی با کشیدن">
            <PrmIcon name="grip" />
          </span>
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}
