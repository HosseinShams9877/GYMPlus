"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { handleUnauthorized } from "@/lib/auth-session";
import { formatPersianDate as formatApiPersianDate, dateInputProps } from "@/lib/persian-date";

import styles from "./owner-dashboard.module.css";

const API_BASE = "https://api.gympluspro.ir/api/v1";
type Json = Record<string, unknown>;
type User = { full_name?: string; phone?: string };
type View =
  | "home"
  | "members"
  | "accounting"
  | "expenses"
  | "reports"
  | "debtors"
  | "critical"
  | "discounts"
  | "settings";
type PromotionKind = "codes" | "service" | "campaigns";
type IconName =
  | "home"
  | "users"
  | "calculator"
  | "wallet"
  | "chart"
  | "alert"
  | "discount"
  | "settings"
  | "search"
  | "bell"
  | "plus"
  | "menu"
  | "close"
  | "dots"
  | "arrow"
  | "trash"
  | "edit"
  | "check"
  | "upload";

const nav: { key: View; label: string; icon: IconName }[] = [
  { key: "home", label: "داشبورد", icon: "home" },
  { key: "members", label: "مدیریت اعضا", icon: "users" },
  { key: "accounting", label: "حسابداری", icon: "calculator" },
  { key: "expenses", label: "مدیریت هزینه‌ها", icon: "wallet" },
  { key: "reports", label: "گزارش‌های مالی", icon: "chart" },
  { key: "debtors", label: "بدهکاران", icon: "alert" },
  { key: "critical", label: "حساب‌های بحرانی", icon: "alert" },
  { key: "discounts", label: "تخفیف‌ها و کمپین‌ها", icon: "discount" },
  { key: "settings", label: "تنظیمات", icon: "settings" },
];

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: (
      <>
        <path d="m3 11 9-7 9 7" />
        <path d="M5 10v10h14V10M9 20v-6h6v6" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-4 2-7 6-7s6 3 6 7M16 5a3 3 0 0 1 0 6M16 13c3 0 5 3 5 7" />
      </>
    ),
    calculator: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 6h14a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12" />
        <path d="M15 11h7v4h-7z" />
      </>
    ),
    chart: (
      <>
        <path d="M4 20V4M4 20h17" />
        <path d="m7 16 4-5 3 2 6-7" />
      </>
    ),
    alert: (
      <>
        <path d="m12 3 9 17H3z" />
        <path d="M12 9v5M12 17h.01" />
      </>
    ),
    discount: (
      <>
        <circle cx="8" cy="8" r="2" />
        <circle cx="16" cy="16" r="2" />
        <path d="m18 6-12 12" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19 13.5v-3l-2-.7-.8-1.8.9-1.8-2.2-2.2-1.8.9-1.8-.8L10.5 2h-3l-.7 2.1-1.8.8-1.8-.9L1 6.2 2 8l-.8 1.8-2.2.7v3l2.2.7.8 1.8-1 1.8L3.2 20l1.8-.9 1.8.8.7 2.1h3l.8-2.1 1.8-.8 1.8.9 2.2-2.2-.9-1.8.8-1.8z"
          transform="scale(.8) translate(3 3)"
        />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m16 16 4 4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 9a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
        <path d="M10 20h4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    dots: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
    arrow: <path d="m15 18-6-6 6-6" />,
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" />
      </>
    ),
    edit: (
      <>
        <path d="m4 16-1 5 5-1L19 9l-4-4z" />
        <path d="m13 7 4 4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    upload: (
      <>
        <path d="M12 16V4M7 9l5-5 5 5" />
        <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function token() {
  return typeof window === "undefined"
    ? ""
    : (localStorage.getItem("gymplus_access") ?? "");
}
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...init?.headers,
    },
  });
  if (handleUnauthorized(response.status)) throw new Error("UNAUTHORIZED");
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as Json;
    throw new Error(apiErrorMessage(detail));
  }
  return response.status === 204 ? ({} as T) : (response.json() as Promise<T>);
}
function apiErrorMessage(detail: Json) {
  if (typeof detail.detail === "string") return detail.detail;
  if (typeof detail.phone === "string") return detail.phone;
  const fields = Object.entries(detail)
    .filter(([, value]) => value != null)
    .map(([key, value]) => {
      const message = Array.isArray(value) ? value.join("، ") : String(value);
      return `${key}: ${message}`;
    });
  return fields.length ? fields.join(" | ") : "درخواست انجام نشد";
}
function list(value: unknown): Json[] {
  if (Array.isArray(value)) return value as Json[];
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as Json).results)
  )
    return (value as Json).results as Json[];
  return [];
}
function number(value: unknown) {
  return Number(value ?? 0);
}
function money(value: unknown) {
  return `${number(value).toLocaleString("fa-IR")} تومان`;
}
function faDate(value: unknown) {
  return formatApiPersianDate(value, "-");
}
function userOf(row: Json) {
  return (row.user && typeof row.user === "object" ? row.user : {}) as Json;
}
function methodLabel(value: unknown) {
  return (
    (
      {
        cash: "نقد",
        pos: "کارت‌خوان",
        card_transfer: "کارت‌به‌کارت",
        gateway: "درگاه آنلاین",
      } as Record<string, string>
    )[String(value)] ?? String(value ?? "-")
  );
}
function termLabel(value: unknown) {
  return (
    (
      {
        monthly: "ماهانه",
        quarterly: "سه‌ماهه",
        semiannual: "شش‌ماهه",
        annual: "سالانه",
        yearly: "سالانه",
      } as Record<string, string>
    )[String(value)] ?? String(value ?? "-")
  );
}

function Empty({ text = "اطلاعاتی برای نمایش وجود ندارد" }: { text?: string }) {
  return (
    <div className={styles.empty}>
      <span>+</span>
      <b>{text}</b>
      <small>داده‌ها پس از ثبت در همین بخش نمایش داده می‌شوند.</small>
    </div>
  );
}
function Spinner() {
  return <i className={styles.spinner} />;
}
function Button({
  children,
  onClick,
  type = "button",
  kind = "primary",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  kind?: "primary" | "outline" | "danger";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      className={styles[kind]}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${styles.panel} ${className}`}>
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
function Stat({
  title,
  value,
  hint,
  tone = "",
}: {
  title: string;
  value: React.ReactNode;
  hint?: string;
  tone?: string;
}) {
  return (
    <article className={`${styles.stat} ${styles[tone] ?? ""}`}>
      <header>
        <span>{title}</span>
        <Icon name="dots" />
      </header>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}
function Status({
  children,
  tone = "green",
}: {
  children: React.ReactNode;
  tone?: "green" | "red" | "orange" | "gray";
}) {
  return (
    <span className={`${styles.status} ${styles[tone]}`}>
      <i />
      {children}
    </span>
  );
}

function Notifications({ onView }: { onView: (view: View) => void }) {
  type NotificationTab = "all" | "unread" | "read";
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Json[]>([]);
  const [tab, setTab] = useState<NotificationTab>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const readStorageKey = `gymplus:read-notifications:${token().slice(-16)}`;
  const rememberedRead = () => { try { return new Set<string>(JSON.parse(localStorage.getItem(readStorageKey) ?? "[]")); } catch { return new Set<string>(); } };
  const rememberRead = (ids: string[]) => { try { const next = new Set([...rememberedRead(), ...ids]); localStorage.setItem(readStorageKey, JSON.stringify([...next])); } catch {} };
  const count = useCallback(async () => {
    try {
      const result = await api<{ unread: number }>(
        "/notifications/unread_count/",
      );
      setUnread(result.unread ?? 0);
    } catch {}
  }, []);
  useEffect(() => {
    void count();
    const id = window.setInterval(count, 60000);
    return () => window.clearInterval(id);
  }, [count]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  const loadItems = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<unknown>("/notifications/");
      const remembered = rememberedRead();
      const loaded = list(result).map(item => remembered.has(String(item.id)) ? { ...item, read: true } : item);
      setItems(loaded);
      setUnread(loaded.filter(item => !item.read).length);
    } catch {
      setError("دریافت اعلان‌ها انجام نشد.");
    } finally {
      setLoading(false);
    }
  };
  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setTab("all");
    setOpen(true);
    void loadItems();
  };
  const readAll = async () => {
    try {
      await api("/notifications/read/", { method: "POST" });
      setUnread(0);
      setItems((current) => { rememberRead(current.map((item) => String(item.id))); return current.map((item) => ({ ...item, read: true })); });
    } catch {
      setError("ثبت وضعیت اعلان‌ها انجام نشد.");
    }
  };
  const readOne = async (item: Json) => {
    if (item.read || !item.id) return;
    try {
      await api(`/notifications/${item.id}/`);
      rememberRead([String(item.id)]);
      setItems((current) =>
        current.map((notice) =>
          notice.id === item.id ? { ...notice, read: true } : notice,
        ),
      );
      setUnread((current) => Math.max(0, current - 1));
    } catch {
      setError("ثبت وضعیت اعلان انجام نشد.");
    }
  };
  const visibleItems = items.filter((item) =>
    tab === "all" ? true : tab === "unread" ? !item.read : Boolean(item.read),
  );
  const openItem = async (item: Json) => {
    await readOne(item);
    setOpen(false);
    const kind = String(item.kind ?? "system");
    onView(
      kind === "payment"
        ? "accounting"
        : kind === "gym"
          ? "settings"
          : "home",
    );
  };
  return (
    <div className={styles.notifications}>
      <button
        className={styles.notificationTrigger}
        onClick={toggle}
        aria-label={unread ? `${unread} اعلان خوانده‌نشده` : "اعلان‌ها"}
        aria-expanded={open}
      >
        <Icon name="bell" />
        <span>اعلانات</span>
        {unread > 0 ? <i className={styles.unread} /> : null}
      </button>
      {open ? (
        <>
          <button
            className={styles.notificationDismiss}
            onMouseDown={() => setOpen(false)}
            aria-label="بستن اعلان‌ها"
          />
          <section className={styles.notificationMenu} role="dialog">
            <header>
              <h2>اعلانات</h2>
              <span>
                <button disabled={!unread} onClick={() => void readAll()}>
                  <Icon name="check" /> خواندن همه
                </button>
                <button onClick={() => setOpen(false)} aria-label="بستن">
                  <Icon name="close" />
                </button>
              </span>
            </header>
            <nav className={styles.notificationTabs}>
              {(
                [
                  ["all", "همه اعلانات"],
                  ["unread", `خوانده نشده (${unread.toLocaleString("fa-IR")})`],
                  ["read", "خوانده شده"],
                ] as Array<[NotificationTab, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={tab === key ? styles.notificationTabActive : ""}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </nav>
            {loading ? (
              <div className={styles.notificationLoading}>
                <span />
                <span />
                <span />
              </div>
            ) : error && !items.length ? (
              <div className={styles.notificationEmpty}>
                <Icon name="alert" />
                <b>{error}</b>
                <button onClick={() => void loadItems()}>تلاش دوباره</button>
              </div>
            ) : visibleItems.length ? (
              <div className={styles.notificationList}>
                {visibleItems.map((item, index) => (
                  <article
                    key={String(item.id ?? index)}
                    className={!item.read ? styles.newNotice : styles.readNotice}
                  >
                    <header>
                      <span className={styles.notificationGlyph}>
                        <Icon name={item.kind === "payment" ? "wallet" : "bell"} />
                      </span>
                      <span>
                        <b>{String(item.title ?? "اعلان جدید")}</b>
                        <time>{notificationTime(item.created_at)}</time>
                      </span>
                      {!item.read ? <i /> : null}
                    </header>
                    <p>{String(item.message ?? item.body ?? "")}</p>
                    <footer>
                      <button disabled={Boolean(item.read)} onClick={() => void readOne(item)}>
                        {item.read ? "خوانده شده" : "خواندم"}
                      </button>
                      <Button onClick={() => void openItem(item)}>مشاهده</Button>
                    </footer>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.notificationEmpty}>
                <Icon name="bell" size={27} />
                <b>اعلانی در این بخش ندارید</b>
                <small>اعلان‌های جدید حساب شما اینجا نمایش داده می‌شوند.</small>
              </div>
            )}
            {error && items.length ? <p className={styles.notificationError}>{error}</p> : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

function notificationTime(value: unknown) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "همین حالا";
  if (minutes < 60) return `${minutes.toLocaleString("fa-IR")} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours.toLocaleString("fa-IR")} ساعت پیش`;
  return `${Math.floor(hours / 24).toLocaleString("fa-IR")} روز پیش`;
}

type OwnerSearchItem = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  kind: "member" | "debtor" | "expense";
  view: View;
};

function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("fa-IR")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ");
}

function OwnerSearchOverlay({
  onClose,
  onView,
}: {
  onClose: () => void;
  onView: (view: View) => void;
}) {
  type SearchFilter = "all" | "member" | "debtor" | "expense";
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [items, setItems] = useState<OwnerSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    const loadSearchData = async () => {
      try {
        const [memberData, debtorData, expenseData] = await Promise.all([
          api<Json>("/owner/members/page/"),
          api<Json>("/owner/debtors/?range=1&sort=newest"),
          api<Json>("/expenses/page/?months=12"),
        ]);
        if (!alive) return;
        const members = [
          ...list(memberData.active),
          ...list(memberData.inactive),
        ].map((row, index): OwnerSearchItem => {
          const person = userOf(row);
          return {
            id: `member-${String(row.id ?? person.id ?? index)}`,
            title: String(person.full_name ?? row.full_name ?? "عضو باشگاه"),
            subtitle: String(person.phone ?? row.phone ?? "شماره تماس ثبت نشده"),
            meta: row.is_active === false ? "عضو غیرفعال" : "عضو فعال",
            kind: "member",
            view: "members",
          };
        });
        const debtors = list(debtorData.results ?? debtorData).map(
          (row, index): OwnerSearchItem => {
            const person = userOf(row);
            return {
              id: `debtor-${String(row.id ?? person.id ?? index)}`,
              title: String(person.full_name ?? row.full_name ?? "حساب بدهکار"),
              subtitle: String(person.phone ?? row.phone ?? "پیگیری بدهی عضو"),
              meta: money(row.total_debt ?? row.debt_amount ?? row.amount),
              kind: "debtor",
              view: "debtors",
            };
          },
        );
        const expenses = list(
          expenseData.expenses ?? expenseData.results ?? expenseData,
        ).map((row, index): OwnerSearchItem => ({
          id: `expense-${String(row.id ?? index)}`,
          title: String(row.title ?? row.description ?? "هزینه باشگاه"),
          subtitle: String(row.category_name ?? row.category ?? "مدیریت هزینه‌ها"),
          meta: money(row.amount),
          kind: "expense",
          view: "expenses",
        }));
        setItems([...members, ...debtors, ...expenses]);
      } catch {
        if (alive) setError("دریافت اطلاعات جستجو انجام نشد.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    void loadSearchData();
    return () => {
      alive = false;
    };
  }, []);

  const results = useMemo(() => {
    const needle = normalizeSearch(query);
    return items.filter((item) => {
      if (filter !== "all" && item.kind !== filter) return false;
      if (!needle) return true;
      return normalizeSearch(
        `${item.title} ${item.subtitle} ${item.meta}`,
      ).includes(needle);
    });
  }, [filter, items, query]);

  useEffect(() => setActiveIndex(0), [filter, query]);

  const choose = useCallback(
    (item: OwnerSearchItem) => {
      onView(item.view);
      onClose();
      if (item.kind === "member") {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("owner-member-search", { detail: item.title }),
          );
        }, 50);
      }
    },
    [onClose, onView],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") onClose();
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current === 0 ? results.length - 1 : current - 1,
      );
    }
    if (event.key === "Enter") {
      event.preventDefault();
      choose(results[activeIndex] ?? results[0]);
    }
  };

  const filters: Array<[SearchFilter, string, IconName]> = [
    ["all", "همه موارد", "menu"],
    ["member", "اعضا", "users"],
    ["debtor", "بدهکاران", "alert"],
    ["expense", "هزینه‌ها", "wallet"],
  ];

  return (
    <div className={styles.ownerSearchOverlay} onMouseDown={onClose}>
      <section
        className={styles.ownerSearchPanel}
        role="dialog"
        aria-modal="true"
        aria-label="جستجوی سراسری"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.ownerSearchHeader}>
          <Icon name="search" size={21} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="جستجو کنید..."
          />
          <kbd>⌘ K</kbd>
          <button onClick={onClose} aria-label="بستن جستجو">
            <Icon name="close" />
          </button>
        </div>
        <div className={styles.ownerSearchFooter}>
          <span><kbd>↓</kbd><kbd>↑</kbd> حرکت</span>
          <span><kbd>↵</kbd> انتخاب</span>
          <span><kbd>Esc</kbd> خروج</span>
        </div>
        <div className={styles.ownerSearchBody}>
          <nav className={styles.ownerSearchFilters}>
            {filters.map(([key, label, icon]) => (
              <button
                key={key}
                className={filter === key ? styles.ownerSearchFilterActive : ""}
                onClick={() => setFilter(key)}
              >
                <Icon name={icon} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className={styles.ownerSearchResults}>
            {loading ? (
              <div className={styles.ownerSearchLoading}><Spinner /> در حال دریافت اطلاعات...</div>
            ) : error ? (
              <div className={styles.ownerSearchEmpty}>
                <Icon name="alert" size={30} />
                <b>{error}</b>
              </div>
            ) : query && results.length ? (
              <>
                <h3>نتایج جستجو</h3>
                {results.slice(0, 12).map((item, index) => (
                  <button
                    key={item.id}
                    className={`${styles.ownerSearchResult} ${index === activeIndex ? styles.ownerSearchResultActive : ""}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(item)}
                  >
                    <span className={styles.ownerSearchResultIcon}>
                      <Icon name={item.kind === "member" ? "users" : item.kind === "debtor" ? "alert" : "wallet"} />
                    </span>
                    <span>
                      <b>{item.title}</b>
                      <small>{item.subtitle}</small>
                    </span>
                    <em>{item.meta}</em>
                    <Icon name="arrow" />
                  </button>
                ))}
              </>
            ) : (
              <div className={styles.ownerSearchEmpty}>
                <Image
                  src="/assets/images/search-empty-reference.png"
                  alt=""
                  width={118}
                  height={86}
                />
                <b>{query ? "نتیجه‌ای پیدا نشد" : "جستجو کنید"}</b>
                <small>{query ? "عبارت دیگری را امتحان کنید." : "پس از جستجو نتایج اینجا نمایش داده می‌شود."}</small>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function AppShell({
  user,
  view,
  onView,
  onAdd,
  children,
}: {
  user: User;
  view: View;
  onView: (view: View) => void;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [noticeVisible, setNoticeVisible] = useState(true);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  useEffect(() => {
    if (view === "critical") setNoticeVisible(true);
  }, [view]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    const closeProfile = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-owner-profile]")) setProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", closeProfile);
    return () => document.removeEventListener("mousedown", closeProfile);
  }, []);
  const logout = async () => {
    setLogoutPending(true);
    try {
      await api("/auth/logout/", {
        method: "POST",
        body: JSON.stringify({
          refresh: localStorage.getItem("gymplus_refresh"),
        }),
      });
    } catch {}
    localStorage.clear();
    location.href = "/login";
  };
  const select = (key: View) => {
    onView(key);
    setDrawer(false);
    setProfileMenuOpen(false);
  };
  const sidebar = (
    <>
      <div className={styles.brand}>
        <Image
          src="/assets/images/mingcute_fitness.png"
          alt=""
          width={28}
          height={28}
        />
        <b>GymPlus+</b>
        <em>مدیریت</em>
        <button
          className={styles.sidebarToggle}
          onClick={() => setSidebarOpen((current) => !current)}
          aria-label={sidebarOpen ? "بستن منو" : "باز کردن منو"}
        >
          <span />
        </button>
      </div>
      <Button onClick={() => { onAdd(); setDrawer(false); }}>
        <Icon name="plus" />
        <span>
          {view === "expenses" || view === "reports"
            ? "ثبت هزینه"
            : view === "discounts"
              ? "ثبت تخفیف"
              : view === "debtors" || view === "critical"
                ? "ثبت بدهی"
                : "عضو جدید"}
        </span>
      </Button>
      <nav>
        {nav.map((item) => (
          <button
            key={item.key}
            className={view === item.key ? styles.active : ""}
            onClick={() => select(item.key)}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className={styles.profile} data-owner-profile>
        <div className={styles.profileBrand}>
          <Image
            src="/assets/images/mingcute_fitness.png"
            alt=""
            width={23}
            height={23}
          />
          <b>GymPlus+</b>
        </div>
        {profileMenuOpen ? (
          <div className={styles.profileMenu}>
            <button onClick={() => select("settings")}>
              <Icon name="users" /> پروفایل من
            </button>
            <button onClick={() => select("accounting")}>
              <Icon name="wallet" /> وضعیت مالی
            </button>
            <button onClick={() => select("settings")}>
              <Icon name="settings" /> تنظیمات حساب
            </button>
            <button className={styles.profileMenuDanger} onClick={() => { setProfileMenuOpen(false); setLogoutConfirm(true); }}>
              <Icon name="arrow" /> خروج از حساب
            </button>
          </div>
        ) : null}
        <button
          className={styles.profileUser}
          onClick={() => setProfileMenuOpen((current) => !current)}
          aria-expanded={profileMenuOpen}
        >
          <span className={styles.avatar}>
            {(user.full_name || "م").slice(0, 1)}
          </span>
          <p>
            <b>{user.full_name || "مدیر باشگاه"}</b>
            <small>{user.phone || ""}</small>
          </p>
          <Icon name="arrow" size={15} />
        </button>
        <button className={styles.profileLogout} onClick={() => setLogoutConfirm(true)}>
          <Icon name="arrow" size={16} /> <span>خروج از حساب</span>
        </button>
      </div>
    </>
  );
  return (
    <main className={styles.app} dir="rtl">
      <aside className={`${styles.sidebar} ${sidebarOpen ? "" : styles.sidebarCollapsed}`}>{sidebar}</aside>
      <section className={`${styles.workspace} ${sidebarOpen ? "" : styles.workspaceWide}`}>
        <header className={styles.topbar}>
          <div className={styles.title}>
            <button
              className={styles.menuButton}
              onClick={() => setDrawer(true)}
            >
              <Icon name="menu" />
            </button>
            <div>
              <h1>
                {view === "home"
                  ? "داشبورد مدیر"
                  : nav.find((item) => item.key === view)?.label}
              </h1>
              {view === "home" ? <small>پنل مدیریت باشگاه</small> : null}
            </div>
          </div>
          <div className={styles.topActions}>
            <button className={styles.searchTrigger} onClick={() => setSearchOpen(true)}>
              <Icon name="search" />
              <span>جستجو...</span>
              <kbd>⌘ K</kbd>
            </button>
            <Notifications onView={onView} />
            <button className={styles.mobileSearchButton} onClick={() => setSearchOpen(true)} aria-label="جستجو">
              <Icon name="search" />
            </button>
            <button className={styles.mobileProfileButton} onClick={() => setDrawer(true)} aria-label="حساب کاربری">
              <span className={styles.avatar}>
              {(user.full_name || "م").slice(0, 1)}
              </span>
            </button>
            <button className={styles.helpButton} type="button">
              <span>؟</span> راهنمایی
            </button>
          </div>
        </header>
        {noticeVisible ? (
          <div
            className={`${styles.notice} ${view === "critical" ? styles.criticalNotice : ""}`}
          >
            <span>
              <Icon name="alert" />
            </span>
            <p>
              {view === "critical"
                ? "اعضای زیر دارای بدهی‌های متعدد با تأخیر بیش از ۶۰ روز هستند؛ پیگیری فوری توصیه می‌شود."
                : "نیاز به اقدام فوری وجود دارد؛ لطفاً در اسرع وقت موارد مالی را بررسی کنید."}
            </p>
            {view !== "critical" ? (
              <button onClick={() => onView("debtors")}>مشاهده جزئیات</button>
            ) : null}
            <button
              className={styles.noticeClose}
              onClick={() => setNoticeVisible(false)}
              aria-label="بستن هشدار"
            >
              <Icon name="close" />
            </button>
          </div>
        ) : null}
        <div className={styles.content}>{children}</div>
      </section>
      <nav className={styles.bottom}>
        {nav.slice(0, 2).map((item) => (
          <button
            key={item.key}
            className={view === item.key ? styles.active : ""}
            onClick={() => onView(item.key)}
          >
            <Icon name={item.icon} />
            <span>{item.key === "members" ? "اعضا" : item.label}</span>
          </button>
        ))}
        <button className={styles.fab} onClick={onAdd}>
          <Icon name="plus" size={30} />
        </button>
        {[nav[2], nav[5]].map((item) => (
          <button
            key={item.key}
            className={view === item.key ? styles.active : ""}
            onClick={() => onView(item.key)}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      {drawer ? (
        <div className={styles.drawerBackdrop} onClick={() => setDrawer(false)}>
          <aside className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.drawerClose}
              onClick={() => setDrawer(false)}
            >
              <Icon name="close" />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}
      {searchOpen ? (
        <OwnerSearchOverlay onClose={() => setSearchOpen(false)} onView={onView} />
      ) : null}
      {logoutConfirm ? <OwnerLogoutConfirm pending={logoutPending} close={() => setLogoutConfirm(false)} confirm={() => void logout()}/> : null}
    </main>
  );
}

function OwnerLogoutConfirm({ pending, close, confirm }: { pending: boolean; close: () => void; confirm: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !pending) close(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, pending]);
  return <div className={styles.logoutOverlay} onMouseDown={() => { if (!pending) close(); }}>
    <section className={styles.logoutDialog} role="alertdialog" aria-modal="true" aria-labelledby="owner-logout-title" onMouseDown={event => event.stopPropagation()}>
      <header><h2 id="owner-logout-title">خروج از حساب کاربری</h2><button type="button" onClick={close} disabled={pending} aria-label="بستن"><Icon name="close"/></button></header>
      <p>آیا مطمئنید که می خواهید از حساب خود خارج شوید؟</p>
      <div><button type="button" className={styles.logoutConfirmButton} onClick={confirm} disabled={pending}>{pending ? "در حال خروج..." : "بله، خروج از حساب"}</button><button type="button" className={styles.logoutCancelButton} onClick={close} disabled={pending}>انصراف</button></div>
    </section>
  </div>;
}

function FinancialStats({ data, waiting, overdue }: { data: Json; waiting?: number; overdue?: number }) {
  return (
    <div className={styles.fiveStats}>
      <Stat
        title="پیش‌بینی درآمد"
        value={money(data.predicted)}
        hint="ماه جاری"
      />
      <Stat
        title="دریافت‌شده"
        value={money(data.received)}
        hint={
          data.received_pct == null
            ? undefined
            : `${number(data.received_pct).toLocaleString("fa-IR")}٪ از پیش‌بینی`
        }
        tone="greenTone"
      />
      <Stat
        title="در راه وصول"
        value={money(waiting ?? data.on_the_way)}
        hint="سررسیدهای پیش رو"
      />
      <Stat
        title="معوق"
        value={money(overdue ?? data.overdue)}
        hint={data.overdue_urgent ? "نیازمند پیگیری فوری" : "مطالبات گذشته"}
        tone="orangeTone"
      />
      <Stat title="هزینه‌ها" value={money(data.spent)} hint="ماه جاری" />
    </div>
  );
}

type DebtorFilters = {
  q: string;
  range: string;
  sort: string;
  debt_type: string;
};
function DebtorsTable({
  initial,
  onOpen,
  onPay,
  standalone = false,
  refreshKey = 0,
}: {
  initial?: Json;
  onOpen: (id: number) => void;
  onPay: (row: Json) => void;
  standalone?: boolean;
  refreshKey?: number;
}) {
  const [data, setData] = useState<Json>(initial ?? {});
  const [filters, setFilters] = useState<DebtorFilters>({
    q: "",
    range: standalone ? "all" : "1",
    sort: "newest",
    debt_type: "",
  });
  const [statusTab, setStatusTab] = useState<"all" | "debtor" | "overdue">(
    "all",
  );
  const [loading, setLoading] = useState(!initial);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value),
      );
      setData(await api<Json>(`/owner/debtors/?${query}`));
    } finally {
      setLoading(false);
    }
  }, [filters]);
  useEffect(() => {
    if (refreshKey >= 0) void load();
  }, [load, refreshKey]);
  const debtors = list(
    data.results ?? data.debtors ?? data.data ?? data.items ?? data,
  );
  const options = list(
    data.debt_type_options ?? (data.filters as Json | undefined)?.debt_type_options,
  );
  const dashboard = !standalone;
  const visibleDebtors = debtors.filter((row) => {
    if (statusTab === "overdue") return number(row.days_overdue) > 0;
    if (statusTab === "debtor") return number(row.days_overdue) <= 0;
    return true;
  });
  const debtorAmount = (row: Json) =>
    number(row.debt ?? row.outstanding ?? row.remaining ?? row.amount);
  const totalDebt = debtors.reduce((sum, row) => sum + debtorAmount(row), 0);
  const criticalCount = debtors.filter(
    (row) =>
      number(row.days_overdue) >= 30 ||
      ["critical", "urgent", "بحرانی"].includes(String(row.band).toLowerCase()),
  ).length;
  const debtTypeLabel = (row: Json) => {
    const selected = options.find(
      (option) => String(option.value) === filters.debt_type,
    );
    if (selected) return String(selected.label);
    return number(row.invoice_count) > 1
      ? `${number(row.invoice_count).toLocaleString("fa-IR")} فاکتور`
      : "بدهی باشگاه";
  };
  return (
    <>
      {standalone ? (
        <Panel className={styles.debtorsOverview} title="مروری بر آمار">
          <div className={styles.debtorsOverviewGrid}>
            <Stat
              title="کل بدهی‌ها"
              value={money(totalDebt)}
              hint="بر اساس فهرست جاری"
            />
            <Stat
              title="بدهکارها"
              value={`${debtors.length.toLocaleString("fa-IR")} نفر`}
              hint="اعضای دارای مانده بدهی"
              tone="greenTone"
            />
            <Stat
              title="معوق/بحرانی"
              value={`${criticalCount.toLocaleString("fa-IR")} نفر`}
              hint="بیش از ۳۰ روز تأخیر"
              tone="orangeTone"
            />
          </div>
        </Panel>
      ) : null}
      <Panel
        className={
          dashboard ? styles.dashboardDebtPanel : styles.standaloneDebtorsPanel
        }
        title={
          dashboard ? (
            <>
              <span className={styles.desktopOnly}>بدهی‌های اعضا</span>
              <span className={styles.mobileOnly}>شهریه‌های عقب‌افتاده</span>
            </>
          ) : (
            "فهرست بدهکاران"
          )
        }
        action={
          dashboard ? (
            <div className={styles.panelIcons}>
              <button
                className={`${styles.iconButton} ${compact ? styles.iconSelected : ""}`}
                onClick={() => setCompact((value) => !value)}
                aria-label="تغییر تراکم جدول"
                aria-pressed={compact}
              >
                <Icon name="calculator" />
              </button>
              <button
                className={styles.iconButton}
                onClick={() => setFiltersOpen((value) => !value)}
                aria-label="گزینه‌های بیشتر"
                aria-expanded={filtersOpen}
              >
                <Icon name="dots" />
              </button>
            </div>
          ) : (
            <div className={styles.panelIcons}>
              <button
                className={`${styles.iconButton} ${compact ? styles.iconSelected : ""}`}
                onClick={() => setCompact((value) => !value)}
                aria-label="تغییر تراکم جدول"
                aria-pressed={compact}
              >
                <Icon name="calculator" />
              </button>
              <button
                className={styles.iconButton}
                onClick={() => setFiltersOpen((value) => !value)}
                aria-label="فیلتر بدهکاران"
                aria-expanded={filtersOpen}
              >
                <Icon name="dots" />
              </button>
            </div>
          )
        }
      >
        {standalone ? (
          <div className={styles.standaloneDebtTools}>
            <div className={styles.standaloneDebtTabs}>
              {[
                ["all", "همه موارد"],
                ["debtor", "بدهکارها"],
                ["overdue", "معوق‌ها"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={statusTab === value ? styles.selected : ""}
                  onClick={() => setStatusTab(value as typeof statusTab)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className={styles.inlineSearch}>
              <Icon name="search" />
              <input
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                placeholder="جستجوی نام یا شماره موبایل..."
              />
            </label>
            <label className={styles.standaloneDebtSort}>
              <Icon name="menu" />
              <select
                value={filters.sort}
                onChange={(event) =>
                  setFilters({ ...filters, sort: event.target.value })
                }
                aria-label="مرتب‌سازی بدهکاران"
              >
                <option value="newest">پیش‌فرض</option>
                <option value="oldest">قدیمی‌ترین</option>
                <option value="amount_desc">بیشترین بدهی</option>
                <option value="amount_asc">کمترین بدهی</option>
              </select>
            </label>
            <button
              className={styles.standaloneFilterButton}
              onClick={() => setFiltersOpen((value) => !value)}
              aria-expanded={filtersOpen}
              aria-label="فیلتر بدهکاران"
            >
              <Icon name="menu" />
            </button>
            {filtersOpen ? (
              <div className={styles.standaloneDebtFilterPopover}>
                <label>
                  <span>نوع بدهی</span>
                  <select
                    value={filters.debt_type}
                    onChange={(event) =>
                      setFilters({ ...filters, debt_type: event.target.value })
                    }
                  >
                    <option value="">همه انواع بدهی</option>
                    {options.map((option) => (
                      <option
                        key={String(option.value)}
                        value={String(option.value)}
                      >
                        {String(option.label)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>بازه بدهی</span>
                  <select
                    value={filters.range}
                    onChange={(event) =>
                      setFilters({ ...filters, range: event.target.value })
                    }
                  >
                    <option value="1">یک ماه</option>
                    <option value="3">سه ماه</option>
                    <option value="6">شش ماه</option>
                    <option value="all">همه بازه‌ها</option>
                  </select>
                </label>
                <Button onClick={() => setFiltersOpen(false)}>
                  اعمال فیلتر
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className={`${styles.tableTools} ${styles.dashboardDebtTools}`}>
            <label className={styles.inlineSearch}>
              <Icon name="search" />
              <input
                value={filters.q}
                onChange={(event) =>
                  setFilters({ ...filters, q: event.target.value })
                }
                placeholder="جستجوی نام یا شماره موبایل..."
              />
            </label>
            <select
              className={styles.debtSort}
              value={filters.sort}
              onChange={(event) =>
                setFilters({ ...filters, sort: event.target.value })
              }
              aria-label="مرتب‌سازی بدهی‌ها"
            >
              <option value="newest">پیش‌فرض</option>
              <option value="oldest">قدیمی‌ترین</option>
              <option value="amount_desc">بیشترین بدهی</option>
              <option value="amount_asc">کمترین بدهی</option>
            </select>
            <button
              className={styles.filterButton}
              type="button"
              onClick={() => setFiltersOpen((value) => !value)}
              aria-expanded={filtersOpen}
            >
              <Icon name="menu" /> فیلترها
            </button>
            <div className={`${styles.chips} ${styles.debtChips}`}>
              <button
                className={!filters.debt_type ? styles.selected : ""}
                onClick={() => setFilters({ ...filters, debt_type: "" })}
              >
                همه بدهی‌ها
              </button>
              {options.map((option) => (
                <button
                  key={String(option.value)}
                  className={
                    filters.debt_type === option.value ? styles.selected : ""
                  }
                  onClick={() =>
                    setFilters({ ...filters, debt_type: String(option.value) })
                  }
                >
                  {String(option.label)}
                </button>
              ))}
            </div>
            {filtersOpen ? (
              <div className={styles.debtFilterPopover}>
                <b>بازه بدهی</b>
                <div>
                  {[
                    ["1", "یک ماه"],
                    ["3", "سه ماه"],
                    ["6", "شش ماه"],
                    ["all", "همه"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={filters.range === value ? styles.selected : ""}
                      onClick={() => {
                        setFilters({ ...filters, range: value });
                        setFiltersOpen(false);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
        {loading ? (
          <div className={styles.loading}>
            <Spinner />
          </div>
        ) : visibleDebtors.length ? (
          <div
            className={`${styles.dataTable} ${dashboard ? styles.dashboardDebtTable : styles.standaloneDebtorsTable} ${compact ? styles.compactDebtTable : ""}`}
          >
            <div
              className={
                dashboard ? styles.tableHead : styles.standaloneDebtorsHead
              }
            >
              <span>کاربر</span>
              <span>بدهی</span>
              <span>{dashboard ? "تعداد ماه" : "نوع بدهی"}</span>
              <span>{dashboard ? "آخرین پرداخت" : "تأخیر"}</span>
              <span>{dashboard ? "حضور این ماه" : "وضعیت"}</span>
              <span>عملیات</span>
            </div>
            {visibleDebtors.map((row) => {
              const attendance = (row.attendance ?? {}) as Json;
              return (
                <div
                  className={
                    dashboard ? styles.tableRow : styles.standaloneDebtorsRow
                  }
                  key={String(row.member_id)}
                >
                  <button
                    className={styles.person}
                    onClick={() => onOpen(number(row.member_id))}
                  >
                    <span className={styles.avatar}>
                      {String(row.member_name ?? "م").slice(0, 1)}
                    </span>
                    <span>
                      <b>{String(row.member_name)}</b>
                      <small>{String(row.member_phone)}</small>
                    </span>
                  </button>
                  <strong className={styles.dangerText}>
                    {money(debtorAmount(row))}
                  </strong>
                  <span>
                    {dashboard
                      ? `${number(row.months_overdue).toLocaleString("fa-IR")} ماه`
                      : debtTypeLabel(row)}
                  </span>
                  <span>
                    {dashboard
                      ? faDate(row.last_payment_at)
                      : number(row.days_overdue) > 0
                        ? `${number(row.days_overdue).toLocaleString("fa-IR")} روز`
                        : "-"}
                  </span>
                  {dashboard ? (
                    <span>
                      <Status tone={attendance.low ? "red" : "green"}>
                        {number(attendance.attended).toLocaleString("fa-IR")} از{" "}
                        {attendance.target == null
                          ? "-"
                          : number(attendance.target).toLocaleString("fa-IR")}
                      </Status>
                    </span>
                  ) : (
                    <Status
                      tone={number(row.days_overdue) > 0 ? "red" : "orange"}
                    >
                      {number(row.days_overdue) > 0 ? "معوق" : "بدهکار"}
                    </Status>
                  )}
                  <div className={styles.rowActions}>
                    <Button onClick={() => onPay(row)}>ثبت پرداخت</Button>
                    {dashboard ? (
                      <button
                        className={styles.iconButton}
                        onClick={() => onOpen(number(row.member_id))}
                      >
                        <Icon name="arrow" />
                      </button>
                    ) : (
                      <Button
                        kind="outline"
                        onClick={() => onOpen(number(row.member_id))}
                      >
                        پرونده
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty text="عضو بدهکاری پیدا نشد" />
        )}
      </Panel>
    </>
  );
}

function CriticalAccounts({
  data,
  reload,
}: {
  data: Json;
  reload: () => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("delay");
  const [compact, setCompact] = useState(false);
  const [selected, setSelected] = useState<Json | null>(null);
  const [paying, setPaying] = useState<Json | null>(null);
  const groups = useMemo<Json[]>(() => {
    const grouped = new Map<string, Json>();
    for (const invoice of list(data.critical)) {
      const key = String(invoice.payer);
      const current = grouped.get(key) ?? {
        payer: invoice.payer,
        payer_name: invoice.payer_name,
        invoices: [],
      };
      (current.invoices as Json[]).push(invoice);
      grouped.set(key, current);
    }
    return [...grouped.values()].map((group) => {
      const invoices = group.invoices as Json[];
      return {
        ...group,
        total_debt: invoices.reduce(
          (sum, invoice) => sum + number(invoice.outstanding),
          0,
        ),
        total_payable: invoices.reduce(
          (sum, invoice) => sum + number(invoice.payable),
          0,
        ),
        total_paid: invoices.reduce(
          (sum, invoice) => sum + number(invoice.paid_total),
          0,
        ),
        oldest_delay: Math.max(
          ...invoices.map((invoice) => number(invoice.days_overdue)),
          0,
        ),
      } as Json;
    });
  }, [data.critical]);
  const rows = useMemo(() => {
    const needle = q.trim();
    return groups
      .filter(
        (group) =>
          !needle ||
          String(group.payer_name ?? "").includes(needle) ||
          String(group.payer ?? "").includes(needle) ||
          (group.invoices as Json[]).some((invoice) =>
            String(invoice.service_name ?? "").includes(needle),
          ),
      )
      .sort((a, b) =>
        sort === "amount"
          ? number(b.total_debt) - number(a.total_debt)
          : number(b.oldest_delay) - number(a.oldest_delay),
      );
  }, [groups, q, sort]);
  const changed = () => {
    setPaying(null);
    setSelected(null);
    void reload();
  };
  if (selected)
    return (
      <CriticalAccountDetail
        account={selected}
        onBack={() => setSelected(null)}
        onChanged={changed}
      />
    );
  return (
    <>
      <Panel
        className={styles.criticalAccountsPanel}
        title="لیست حساب‌های بحرانی"
        action={
          <div className={styles.panelIcons}>
            <button
              className={`${styles.iconButton} ${compact ? styles.iconSelected : ""}`}
              onClick={() => setCompact((value) => !value)}
              aria-label="تغییر تراکم جدول"
            >
              <Icon name="calculator" />
            </button>
            <button className={styles.iconButton} aria-label="گزینه‌های بیشتر">
              <Icon name="dots" />
            </button>
          </div>
        }
      >
        <div className={styles.criticalTools}>
          <label className={styles.inlineSearch}>
            <Icon name="search" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="جستجوی نام، موبایل یا خدمت..."
            />
          </label>
          <label className={styles.criticalSort}>
            <Icon name="menu" />
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="delay">قدیمی‌ترین تأخیر</option>
              <option value="amount">بیشترین بدهی</option>
            </select>
          </label>
        </div>
        {rows.length ? (
          <div
            className={`${styles.dataTable} ${styles.criticalAccountsTable} ${compact ? styles.compactCriticalTable : ""}`}
          >
            <div className={styles.criticalAccountsHead}>
              <span>کاربر</span>
              <span>کل بدهی</span>
              <span>بدهی‌های باز</span>
              <span>قدیمی‌ترین</span>
              <span>نوع بدهی</span>
              <span>وضعیت</span>
              <span>عملیات</span>
            </div>
            {rows.map((group) => {
              const invoices = group.invoices as Json[];
              const services = [
                ...new Set(
                  invoices.map((invoice) =>
                    String(
                      invoice.service_name ||
                        (invoice.kind === "subscription"
                          ? "اشتراک"
                          : "خدمت یک‌باره"),
                    ),
                  ),
                ),
              ];
              return (
                <div
                  className={styles.criticalAccountsRow}
                  key={String(group.payer)}
                >
                  <button
                    className={styles.person}
                    onClick={() => setSelected(group)}
                  >
                    <span className={styles.avatar}>
                      {String(group.payer_name ?? "ع").slice(0, 1)}
                    </span>
                    <span>
                      <b>{String(group.payer_name ?? "عضو باشگاه")}</b>
                      <small>
                        شناسه {number(group.payer).toLocaleString("fa-IR")}
                      </small>
                    </span>
                  </button>
                  <strong className={styles.dangerText}>
                    {money(group.total_debt)}
                  </strong>
                  <span>{invoices.length.toLocaleString("fa-IR")} مورد</span>
                  <span className={styles.dangerText}>
                    {number(group.oldest_delay).toLocaleString("fa-IR")} روز پیش
                  </span>
                  <span title={services.join("، ")}>
                    {services.slice(0, 2).join("، ")}
                    {services.length > 2 ? " و ..." : ""}
                  </span>
                  <Status tone="red">بحرانی</Status>
                  <div className={styles.rowActions}>
                    <Button onClick={() => setPaying(group)}>پرداخت</Button>
                    <Button kind="outline" onClick={() => setSelected(group)}>
                      پرونده
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.criticalEmpty}>
            <Image
              src="/assets/images/mingcute_fitness.png"
              alt=""
              width={72}
              height={72}
            />
            <b>خوشبختانه حساب بحرانی ندارید</b>
            <span>تمام حساب‌ها در وضعیت قابل پیگیری قرار دارند.</span>
          </div>
        )}
      </Panel>
      {paying ? (
        <CriticalQuickPayModal
          invoices={paying.invoices as Json[]}
          onClose={() => setPaying(null)}
          onSaved={changed}
        />
      ) : null}
    </>
  );
}

function CriticalAccountDetail({
  account,
  onBack,
  onChanged,
}: {
  account: Json;
  onBack: () => void;
  onChanged: () => void;
}) {
  const invoices = account.invoices as Json[];
  const payments: Json[] = invoices.flatMap((invoice) =>
    list(invoice.payments).map(
      (payment) =>
        ({
          ...payment,
          service_name: invoice.service_name,
        }) as Json,
    ),
  );
  const [invoiceQ, setInvoiceQ] = useState("");
  const [paymentQ, setPaymentQ] = useState("");
  const [paying, setPaying] = useState(false);
  const [discounting, setDiscounting] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const filteredInvoices = invoices.filter(
    (invoice) =>
      !invoiceQ.trim() ||
      String(invoice.service_name ?? "").includes(invoiceQ.trim()) ||
      String(invoice.id).includes(invoiceQ.trim()),
  );
  const filteredPayments = payments.filter(
    (payment) =>
      !paymentQ.trim() ||
      String(payment.service_name ?? "").includes(paymentQ.trim()) ||
      String(payment.tracking_no ?? "").includes(paymentQ.trim()),
  );
  return (
    <div className={styles.criticalDetail}>
      <Panel
        className={styles.criticalMemberHero}
        title={
          <span className={styles.detailTitle}>
            <button className={styles.iconButton} onClick={onBack}>
              <Icon name="arrow" />
            </button>
            پرونده مالی عضو
          </span>
        }
        action={<Icon name="dots" />}
      >
        <div className={styles.criticalHeroBody}>
          <div className={styles.criticalIdentity}>
            <span className={styles.largeAvatar}>
              {String(account.payer_name ?? "ع").slice(0, 1)}
            </span>
            <div>
              <h3>{String(account.payer_name ?? "عضو باشگاه")}</h3>
              <p>عضو باشگاه</p>
              <span>
                <Status tone="green">فعال</Status>
                <Status tone="red">بدهکار</Status>
              </span>
              <small>
                شناسه {number(account.payer).toLocaleString("fa-IR")}
              </small>
            </div>
          </div>
          <div className={styles.criticalHeroActions}>
            <Button onClick={() => setPaying(true)}>
              <Icon name="plus" /> ثبت پرداخت
            </Button>
            <Button kind="outline" onClick={() => setIssuing(true)}>
              ثبت بدهی
            </Button>
            <Button kind="outline" onClick={() => setDiscounting(true)}>
              تخفیف
            </Button>
            <button
              className={styles.iconButton}
              onClick={() => window.print()}
              aria-label="چاپ پرونده"
            >
              <Icon name="calculator" />
            </button>
          </div>
        </div>
      </Panel>
      <div className={styles.criticalStats}>
        <Stat title="مجموع بدهی" value={money(account.total_payable)} />
        <Stat title="مجموع پرداختی" value={money(account.total_paid)} />
        <Stat
          title="مانده/تأخیر"
          value={money(account.total_debt)}
          hint={`${number(account.oldest_delay).toLocaleString("fa-IR")} روز تأخیر`}
          tone="orangeTone"
        />
      </div>
      <Panel title="ریز بدهی‌ها" action={<Icon name="dots" />}>
        <div className={styles.criticalDetailTools}>
          <label className={styles.inlineSearch}>
            <Icon name="search" />
            <input
              value={invoiceQ}
              onChange={(event) => setInvoiceQ(event.target.value)}
              placeholder="جستجو..."
            />
          </label>
          <div className={styles.segment}>
            <button className={styles.selected}>همه اعضا</button>
            <button>فعال‌ها</button>
            <button>غیرفعال‌ها</button>
          </div>
        </div>
        <div className={`${styles.dataTable} ${styles.criticalInvoicesTable}`}>
          <div className={styles.criticalInvoicesHead}>
            <span>عنوان</span>
            <span>دسته</span>
            <span>مبلغ</span>
            <span>ایجاد</span>
            <span>سررسید</span>
            <span>تأخیر</span>
            <span>وضعیت</span>
            <span>عملیات</span>
          </div>
          {filteredInvoices.map((invoice) => (
            <div
              className={styles.criticalInvoicesRow}
              key={String(invoice.id)}
            >
              <b>{String(invoice.service_name || `فاکتور ${invoice.id}`)}</b>
              <span>{invoice.kind === "subscription" ? "اشتراک" : "خدمت"}</span>
              <strong>{money(invoice.payable)}</strong>
              <span>{faDate(invoice.created_at)}</span>
              <span>{faDate(invoice.due_date)}</span>
              <span className={styles.dangerText}>
                {number(invoice.days_overdue).toLocaleString("fa-IR")} روز
              </span>
              <Status tone="red">پرداخت‌نشده</Status>
              <button
                className={styles.successAction}
                onClick={() => setPaying(true)}
              >
                <Icon name="check" /> پرداخت
              </button>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="تاریخچه پرداخت">
        <div className={styles.criticalDetailTools}>
          <label className={styles.inlineSearch}>
            <Icon name="search" />
            <input
              value={paymentQ}
              onChange={(event) => setPaymentQ(event.target.value)}
              placeholder="جستجوی تاریخ، سرویس یا..."
            />
          </label>
        </div>
        {filteredPayments.length ? (
          <div
            className={`${styles.dataTable} ${styles.criticalPaymentsTable}`}
          >
            <div className={styles.criticalPaymentsHead}>
              <span>مبلغ</span>
              <span>دسته‌بندی</span>
              <span>تاریخ پرداخت</span>
              <span>روش پرداخت</span>
              <span>کد پیگیری</span>
            </div>
            {filteredPayments.map((payment) => (
              <div
                className={styles.criticalPaymentsRow}
                key={String(payment.id)}
              >
                <strong>{money(payment.amount)}</strong>
                <span>{String(payment.service_name || "پرداخت فاکتور")}</span>
                <span>{faDate(payment.paid_at)}</span>
                <span>{methodLabel(payment.method)}</span>
                <span>{String(payment.tracking_no || "-")}</span>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="هنوز پرداختی برای این حساب ثبت نشده است" />
        )}
      </Panel>
      {paying ? (
        <CriticalQuickPayModal
          invoices={invoices}
          onClose={() => setPaying(false)}
          onSaved={onChanged}
        />
      ) : null}
      {discounting ? (
        <CriticalDiscountModal
          invoices={invoices}
          onClose={() => setDiscounting(false)}
          onSaved={onChanged}
        />
      ) : null}
      {issuing ? (
        <CriticalInvoiceModal
          payer={number(account.payer)}
          onClose={() => setIssuing(false)}
          onSaved={onChanged}
        />
      ) : null}
    </div>
  );
}

function CriticalQuickPayModal({
  invoices,
  onClose,
  onSaved,
}: {
  invoices: Json[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    setError("");
    try {
      await api(`/invoices/${number(values.invoice)}/pay/`, {
        method: "POST",
        body: JSON.stringify({
          method: values.method,
          tracking_no: values.tracking_no,
          paid_at: values.paid_at || undefined,
        }),
      });
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "ثبت پرداخت انجام نشد");
    } finally {
      setPending(false);
    }
  };
  return (
    <Modal title="ثبت سریع پرداخت" onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          <span>بدهی باز</span>
          <select name="invoice" required>
            {invoices.map((invoice) => (
              <option key={String(invoice.id)} value={String(invoice.id)}>
                {String(invoice.service_name || `فاکتور ${invoice.id}`)} -{" "}
                {money(invoice.outstanding)}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.formGrid}>
          <label>
            <span>روش پرداخت</span>
            <select name="method">
              <option value="cash">نقد</option>
              <option value="pos">کارت‌خوان</option>
              <option value="card_transfer">کارت‌به‌کارت</option>
              <option value="gateway">درگاه آنلاین</option>
            </select>
          </label>
          <label>
            <span>تاریخ پرداخت</span>
            <input name="paid_at" type="date" {...dateInputProps()} />
          </label>
        </div>
        <label>
          <span>شماره پیگیری</span>
          <input name="tracking_no" />
        </label>
        {error ? <p className={styles.error}>{error}</p> : null}
        <footer>
          <Button kind="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner /> : "ثبت پرداخت"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

function CriticalDiscountModal({
  invoices,
  onClose,
  onSaved,
}: {
  invoices: Json[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    setError("");
    try {
      await api(`/invoices/${number(values.invoice)}/discount/`, {
        method: "POST",
        body: JSON.stringify(
          values.percent
            ? { percent: number(values.percent) }
            : { amount: number(values.amount) },
        ),
      });
      onSaved();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "اعمال تخفیف انجام نشد",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <Modal title="اعمال تخفیف" onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          <span>فاکتور</span>
          <select name="invoice" required>
            {invoices.map((invoice) => (
              <option key={String(invoice.id)} value={String(invoice.id)}>
                {String(invoice.service_name || `فاکتور ${invoice.id}`)} -{" "}
                {money(invoice.outstanding)}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.formGrid}>
          <label>
            <span>درصد تخفیف</span>
            <input name="percent" type="number" min="1" max="100" />
          </label>
          <label>
            <span>یا مبلغ ثابت</span>
            <input name="amount" type="number" min="1" />
          </label>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
        <footer>
          <Button kind="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner /> : "اعمال تخفیف"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

function CriticalInvoiceModal({
  payer,
  onClose,
  onSaved,
}: {
  payer: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    setError("");
    try {
      await api("/invoices/", {
        method: "POST",
        body: JSON.stringify({
          payer,
          items: [{ amount: number(values.amount) }],
          discount: number(values.discount),
          due_date: values.due_date,
          kind: values.kind,
          payment_mode: "debtor",
        }),
      });
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "ثبت بدهی انجام نشد");
    } finally {
      setPending(false);
    }
  };
  return (
    <Modal title="ثبت بدهی جدید" onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          <span>مبلغ بدهی</span>
          <input name="amount" type="number" min="1" required />
        </label>
        <div className={styles.formGrid}>
          <label>
            <span>تاریخ سررسید</span>
            <input name="due_date" type="date" {...dateInputProps()} required />
          </label>
          <label>
            <span>نوع فاکتور</span>
            <select name="kind">
              <option value="one_off">یک‌باره</option>
              <option value="subscription">اشتراکی</option>
            </select>
          </label>
        </div>
        <label>
          <span>تخفیف اولیه</span>
          <input name="discount" type="number" min="0" defaultValue="0" />
        </label>
        {error ? <p className={styles.error}>{error}</p> : null}
        <footer>
          <Button kind="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner /> : "ثبت بدهی"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

function Home({
  data,
  onOpen,
  onPay,
  onView,
}: {
  data: Json;
  onOpen: (id: number) => void;
  onPay: (row: Json) => void;
  onView: (view: View) => void;
}) {
  const [financialPeriod, setFinancialPeriod] = useState("monthly");
  const [memberPeriod, setMemberPeriod] = useState("monthly");
  const financials = ((data.dashboard as Json)?.financials as Json) ?? {};
  const members = ((data.dashboard as Json)?.members as Json) ?? {};
  const membersPage = (data.membersPage as Json) ?? {};
  const activeCount = list(membersPage.active).length;
  const inactiveCount = list(membersPage.inactive).length;
  const totalMembers = activeCount + inactiveCount;
  const periodTabs = (value: string, onChange: (value: string) => void) => (
    <div className={`${styles.segment} ${styles.dashboardPeriods}`}>
      {[
        ["weekly", "هفتگی"],
        ["monthly", "ماهانه"],
        ["annual", "سالانه"],
      ].map(([key, label]) => (
        <button
          key={key}
          className={value === key ? styles.selected : ""}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
  return (
    <>
      <Panel
        className={styles.dashboardSummaryPanel}
        title="وضعیت مالی"
        action={periodTabs(financialPeriod, setFinancialPeriod)}
      >
        <div className={styles.dashboardFinancialGrid}>
          <Stat
            title="پیش‌بینی‌شده"
            value={money(financials.predicted)}
            hint="ماه جاری"
          />
          <Stat
            title="دریافت‌شده"
            value={money(financials.received)}
            hint={
              financials.received_pct == null
                ? "وصول قطعی"
                : `${number(financials.received_pct).toLocaleString("fa-IR")}٪ از پیش‌بینی`
            }
            tone="greenTone"
          />
          <Stat
            title="در راه"
            value={money(financials.on_the_way)}
            hint="سررسیدهای پیش رو"
          />
          <Stat
            title="معوقات"
            value={money(financials.overdue)}
            hint="نیازمند پیگیری"
            tone="orangeTone"
          />
          <Stat
            title="هزینه‌کرد"
            value={money(financials.spent)}
            hint="ماه جاری"
          />
        </div>
      </Panel>
      <Panel
        className={styles.dashboardSummaryPanel}
        title="وضعیت اعضا"
        action={periodTabs(memberPeriod, setMemberPeriod)}
      >
        <div className={styles.dashboardMemberGrid}>
          <button
            className={styles.statButton}
            onClick={() => onView("members")}
          >
            <Stat
              title="کل اعضا"
              value={`${totalMembers.toLocaleString("fa-IR")} نفر`}
              hint={`${number(members.member_delta) >= 0 ? "+" : ""}${number(members.member_delta).toLocaleString("fa-IR")}٪ نسبت به ماه قبل`}
            />
          </button>
          <button
            className={styles.statButton}
            onClick={() => onView("members")}
          >
            <Stat
              title="اعضای فعال"
              value={`${number(
                members.active_members ?? activeCount,
              ).toLocaleString("fa-IR")} نفر`}
              hint={`${number(members.active_member_delta ?? members.member_delta) >= 0 ? "+" : ""}${number(members.active_member_delta ?? members.member_delta).toLocaleString("fa-IR")}٪ نسبت به ماه قبل`}
              tone="greenTone"
            />
          </button>
          <button
            className={styles.statButton}
            onClick={() => onView("members")}
          >
            <Stat
              title="اعضای غیرفعال"
              value={`${inactiveCount.toLocaleString("fa-IR")} نفر`}
              hint={`${number(members.inactive_member_delta ?? members.member_delta) >= 0 ? "+" : ""}${number(members.inactive_member_delta ?? members.member_delta).toLocaleString("fa-IR")}٪ نسبت به ماه قبل`}
              tone="orangeTone"
            />
          </button>
        </div>
      </Panel>
      <DebtorsTable
        initial={data.debtors as Json}
        onOpen={onOpen}
        onPay={onPay}
      />
    </>
  );
}

function Members({
  data,
  onOpen,
  reload,
}: {
  data: Json;
  onOpen: (id: number) => void;
  reload: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"all" | "active" | "inactive">("all");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [debt, setDebt] = useState("");
  const [expiry, setExpiry] = useState("");
  const [sort, setSort] = useState("newest");
  const [target, setTarget] = useState<Json | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const handler = (event: Event) =>
      setQ(String((event as CustomEvent).detail ?? ""));
    window.addEventListener("owner-member-search", handler);
    return () => window.removeEventListener("owner-member-search", handler);
  }, []);
  const summary = (data.summary ?? {}) as Json;
  const items = useMemo(() => {
    const needle = q.trim();
    const source =
      tab === "all"
        ? [...list(data.active), ...list(data.inactive)]
        : list(data[tab]);
    return source
      .filter((row) => {
        const user = userOf(row);
        return (
          (!needle ||
            String(user.full_name ?? "").includes(needle) ||
            String(user.phone ?? "").includes(needle)) &&
          (!term || row.term === term) &&
          (!debt ||
            (debt === "debtor" ? number(row.debt) > 0 : !number(row.debt))) &&
          (!expiry || Boolean(row.expiring))
        );
      })
      .sort((a, b) => {
        if (sort === "debt") return number(b.debt) - number(a.debt);
        if (sort === "expiry")
          return String(a.end_date).localeCompare(String(b.end_date));
        if (sort === "attendance")
          return (
            number(((b.attendance ?? {}) as Json).attended) -
            number(((a.attendance ?? {}) as Json).attended)
          );
        const left = new Date(
          String(a.start_date ?? a.deactivated_at ?? 0),
        ).getTime();
        const right = new Date(
          String(b.start_date ?? b.deactivated_at ?? 0),
        ).getTime();
        return sort === "oldest" ? left - right : right - left;
      });
  }, [data, debt, expiry, q, sort, tab, term]);
  return (
    <>
      <Panel className={styles.memberOverview} title="مروری بر آمار">
        <div className={styles.memberOverviewGrid}>
          <Stat
            title="اعضای فعال"
            value={number(summary.active_members).toLocaleString("fa-IR")}
            hint={`${number(summary.member_delta) >= 0 ? "+" : ""}${number(summary.member_delta).toLocaleString("fa-IR")}٪ نسبت به ماه پیش`}
            tone="greenTone"
          />
          <button
            className={styles.statButton}
            onClick={() => {
              setTab("active");
              setExpiry("soon");
            }}
          >
            <Stat
              title="اشتراک‌های رو به انقضا"
              value={number(summary.expiring_soon).toLocaleString("fa-IR")}
              hint="نسبت به ماه پیش"
              tone="orangeTone"
            />
          </button>
          <Stat
            title="اعضای جدید این ماه"
            value={number(summary.new_this_month).toLocaleString("fa-IR")}
            hint="نسبت به ماه پیش"
          />
        </div>
      </Panel>
      <Panel
        className={styles.memberManagementPanel}
        title="مدیریت اعضا"
        action={
          <div className={styles.panelIcons}>
            <button
              className={`${styles.iconButton} ${compact ? styles.iconSelected : ""}`}
              onClick={() => setCompact((value) => !value)}
              aria-label="تغییر تراکم جدول"
              aria-pressed={compact}
            >
              <Icon name="calculator" />
            </button>
            <button
              className={styles.iconButton}
              onClick={() => setFiltersOpen((value) => !value)}
              aria-label="گزینه‌های بیشتر"
            >
              <Icon name="dots" />
            </button>
          </div>
        }
      >
        <div className={`${styles.tableTools} ${styles.memberTableTools}`}>
          <label className={styles.inlineSearch}>
            <Icon name="search" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجوی نام یا شماره موبایل..."
            />
          </label>
          <label className={styles.memberSortControl}>
            <Icon name="menu" />
            <select
              className={styles.memberSort}
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="مرتب‌سازی"
            >
              <option value="newest">پیش‌فرض</option>
              <option value="oldest">قدیمی‌ترین</option>
              <option value="debt">بیشترین بدهی</option>
              <option value="expiry">نزدیک‌ترین انقضا</option>
              <option value="attendance">بیشترین حضور</option>
            </select>
          </label>
          <button
            className={styles.filterButton}
            type="button"
            onClick={() => setFiltersOpen((value) => !value)}
            aria-expanded={filtersOpen}
          >
            <Icon name="menu" /> فیلترها
          </button>
          <div className={`${styles.segment} ${styles.memberTabs}`}>
            {[
              ["all", "همه اعضا"],
              ["active", "فعال‌ها"],
              ["inactive", "غیرفعال‌ها"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={tab === value ? styles.selected : ""}
                onClick={() => setTab(value as typeof tab)}
              >
                {label}
              </button>
            ))}
          </div>
          {filtersOpen ? (
            <div className={styles.memberFilterPopover}>
              <label>
                <span>نوع عضویت</span>
                <select value={term} onChange={(e) => setTerm(e.target.value)}>
                  <option value="">همه دوره‌ها</option>
                  <option value="monthly">ماهانه</option>
                  <option value="quarterly">سه‌ماهه</option>
                  <option value="semiannual">شش‌ماهه</option>
                  <option value="annual">سالانه</option>
                </select>
              </label>
              <label>
                <span>وضعیت مالی</span>
                <select value={debt} onChange={(e) => setDebt(e.target.value)}>
                  <option value="">همه وضعیت‌ها</option>
                  <option value="debtor">بدهکار</option>
                  <option value="settled">بدون بدهی</option>
                </select>
              </label>
              <label>
                <span>سررسید</span>
                <select
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                >
                  <option value="">همه سررسیدها</option>
                  <option value="soon">رو به انقضا</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  setTerm("");
                  setDebt("");
                  setExpiry("");
                  setFiltersOpen(false);
                }}
              >
                پاک کردن فیلترها
              </button>
            </div>
          ) : null}
        </div>
        {items.length ? (
          <div
            className={`${styles.dataTable} ${styles.memberManagementTable} ${compact ? styles.compactMemberTable : ""}`}
          >
            <div className={styles.memberManagementHead}>
              <span>کاربر</span>
              <span>نوع عضویت</span>
              <span>وضعیت</span>
              <span>بدهی</span>
              <span>تاریخ عضویت</span>
              <span>انقضای اشتراک</span>
              <span>حضور این ماه</span>
              <span>عملیات</span>
            </div>
            {items.map((row) => {
              const user = userOf(row);
              const attendance = (row.attendance ?? {}) as Json;
              return (
                <div
                  className={styles.memberManagementRow}
                  key={String(row.id)}
                >
                  <button
                    className={styles.person}
                    onClick={() => onOpen(number(row.id))}
                  >
                    <span className={styles.avatar}>
                      {String(user.full_name ?? "م").slice(0, 1)}
                    </span>
                    <span>
                      <b>{String(user.full_name ?? "-")}</b>
                      <small>{String(user.phone ?? "-")}</small>
                    </span>
                  </button>
                  <span>{termLabel(row.term)}</span>
                  <Status tone={row.is_active ? "green" : "gray"}>
                    {row.is_active ? "فعال" : "غیرفعال"}
                  </Status>
                  <strong
                    className={
                      number(row.debt) ? styles.dangerText : styles.successText
                    }
                  >
                    {number(row.debt) ? money(row.debt) : "-"}
                  </strong>
                  <span>
                    {row.is_active
                      ? faDate(row.start_date)
                      : faDate(row.deactivated_at)}
                  </span>
                  <span>
                    {row.is_active ? (
                      row.is_expired ? (
                        <Status tone="red">منقضی</Status>
                      ) : row.expiring ? (
                        <Status tone="orange">رو به انقضا</Status>
                      ) : (
                        faDate(row.end_date)
                      )
                    ) : (
                      "-"
                    )}
                  </span>
                  <span
                    className={
                      attendance.low ? styles.dangerText : styles.successText
                    }
                  >
                    {row.is_active
                      ? `${number(attendance.attended).toLocaleString("fa-IR")} از ${attendance.target == null ? "-" : number(attendance.target).toLocaleString("fa-IR")}`
                      : faDate(row.last_attended_at)}
                  </span>
                  <div className={styles.rowActions}>
                    {row.is_active ? (
                      <Button
                        kind="outline"
                        onClick={() => onOpen(number(row.id))}
                      >
                        پرونده مالی
                      </Button>
                    ) : (
                      <Button kind="outline" onClick={() => setTarget(row)}>
                        فعال کردن مجدد
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty
            text={
              tab === "active"
                ? "عضو فعالی پیدا نشد"
                : tab === "inactive"
                  ? "عضو غیرفعالی وجود ندارد"
                  : "عضوی پیدا نشد"
            }
          />
        )}
      </Panel>
      {target ? (
        <MemberReactivateModal
          member={target}
          onClose={() => setTarget(null)}
          onSaved={() => {
            setTarget(null);
            void reload();
          }}
        />
      ) : null}
    </>
  );
}

function MemberReactivateModal({
  member,
  onClose,
  onSaved,
}: {
  member: Json;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(`/owner/members/${member.id}/reactivate/`, {
        method: "POST",
        body: JSON.stringify({
          term: values.term,
          start_date: values.start_date,
        }),
      });
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "فعال‌سازی انجام نشد");
    } finally {
      setPending(false);
    }
  };
  return (
    <Modal title="فعال کردن مجدد عضو" onClose={onClose}>
      <form onSubmit={submit}>
        <p className={styles.muted}>
          عضویت {String(userOf(member).full_name ?? "این عضو")} با دوره جدید
          فعال می‌شود.
        </p>
        <div className={styles.formGrid}>
          <label>
            <span>دوره عضویت</span>
            <select name="term" defaultValue={String(member.term ?? "monthly")}>
              <option value="monthly">ماهانه</option>
              <option value="quarterly">سه‌ماهه</option>
              <option value="semiannual">شش‌ماهه</option>
              <option value="annual">سالانه</option>
            </select>
          </label>
          <label>
            <span>تاریخ شروع</span>
            <input
              name="start_date"
              type="date" {...dateInputProps()}
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </label>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
        <footer>
          <Button kind="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner /> : "فعال کردن"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

function Accounting({
  data,
  months,
  setMonths,
  reload,
  onOpen,
  onPay,
}: {
  data: Json;
  months: number;
  setMonths: (months: number) => void;
  reload: () => Promise<void>;
  onOpen: (id: number) => void;
  onPay: (row: Json) => void;
}) {
  const [tab, setTab] = useState<
    "all" | "overdue_members" | "upcoming_members"
  >("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [compact, setCompact] = useState(false);
  const [quickAction, setQuickAction] = useState<"debt" | "payment" | null>(
    null,
  );
  const [reminding, setReminding] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const cards = (data.cards ?? {}) as Json;
  const chart = list(data.chart);
  const overdueRows = list(data.overdue_members);
  const upcomingRows = list(data.upcoming_members);
  const rowAmount = (row: Json) => number(row.outstanding ?? row.amount ?? row.debt);
  const waitingAmount = upcomingRows.reduce((sum, row) => sum + rowAmount(row), 0);
  const overdueAmount = overdueRows.reduce((sum, row) => sum + rowAmount(row), 0);
  const payableRows = [...overdueRows, ...upcomingRows];
  const rows = useMemo(() => {
    const needle = q.trim();
    const source =
      tab === "all"
        ? [...overdueRows, ...upcomingRows]
        : tab === "overdue_members"
          ? overdueRows
          : upcomingRows;
    return source
      .filter(
        (row) =>
          !needle ||
          String(row.member_name ?? "").includes(needle) ||
          String(row.member_phone ?? "").includes(needle) ||
          String(row.service_label ?? "").includes(needle),
      )
      .sort((a, b) => {
        if (sort === "amount_desc")
          return number(b.outstanding) - number(a.outstanding);
        if (sort === "amount_asc")
          return number(a.outstanding) - number(b.outstanding);
        const left = new Date(String(a.due_date ?? 0)).getTime();
        const right = new Date(String(b.due_date ?? 0)).getTime();
        return sort === "oldest" ? left - right : right - left;
      });
  }, [overdueRows, q, sort, tab, upcomingRows]);
  const maxIncome = Math.max(...chart.map((row) => number(row.income)), 1);
  const linePoints = chart
    .map((row, index) => {
      const x = chart.length === 1 ? 50 : (index / (chart.length - 1)) * 100;
      const y = 62 - (number(row.income) / maxIncome) * 48;
      return `${x},${y}`;
    })
    .join(" ");
  const chartMax = Math.max(
    ...chart.flatMap((row) => [number(row.income), number(row.expenses)]),
    1,
  );
  const overdueMax = Math.max(...chart.map((row) => number(row.overdue)), 1);
  const remind = async (row: Json) => {
    const memberId = number(row.member_id);
    setReminding(memberId);
    setFeedback("");
    try {
      await api(`/owner/members/${memberId}/reminder/`, {
        method: "POST",
        body: JSON.stringify({
          invoice: number(row.invoice ?? row.id) || undefined,
        }),
      });
      setFeedback("یادآوری سررسید برای عضو ارسال شد.");
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "ارسال یادآوری انجام نشد",
      );
    } finally {
      setReminding(null);
    }
  };
  return (
    <>
      <Panel className={styles.accountingOverview} title="مروری بر آمار">
        <div className={styles.accountingStats}>
          <FinancialStats data={cards} waiting={waitingAmount} overdue={overdueAmount} />
        </div>
      </Panel>
      <Panel title="دسترسی سریع">
        <div className={styles.accountingQuickGrid}>
          <Button onClick={() => setQuickAction("debt")}>
            <Icon name="plus" /> ثبت بدهی
          </Button>
          <Button kind="outline" onClick={() => setQuickAction("payment")}>
            <Icon name="check" /> ثبت پرداخت
          </Button>
        </div>
      </Panel>
      <Panel
        className={styles.accountingChartsPanel}
        title="نمودارها"
        action={
          <div className={styles.accountingPeriod}>
            {[
              { value: 3, label: "۳ ماهه" },
              { value: 6, label: "۶ ماهه" },
              { value: 12, label: "سالانه" },
            ].map((item) => (
              <button
                key={item.value}
                className={months === item.value ? styles.selected : ""}
                onClick={() => setMonths(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      >
        {chart.length ? (
          <div className={styles.accountingChartGrid}>
            <article className={styles.accountingChartCard}>
              <header>
                <span>روند درآمد</span>
                <strong>{money(chart.at(-1)?.income)}</strong>
              </header>
              <div className={styles.accountingLineChart}>
                <svg viewBox="0 0 100 70" preserveAspectRatio="none">
                  <defs>
                    <linearGradient
                      id="owner-income"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0" stopColor="#ff6b16" stopOpacity=".22" />
                      <stop offset="1" stopColor="#ff6b16" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon
                    points={`0,68 ${linePoints} 100,68`}
                    fill="url(#owner-income)"
                  />
                  <polyline
                    points={linePoints}
                    fill="none"
                    stroke="#ff6b16"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <div>
                  {chart.map((row) => (
                    <span key={String(row.label)}>{String(row.label)}</span>
                  ))}
                </div>
              </div>
            </article>
            <article className={styles.accountingChartCard}>
              <header>
                <span>درآمد در برابر هزینه</span>
                <strong>{money(chart.at(-1)?.expenses)}</strong>
              </header>
              <div className={styles.accountingBars}>
                {chart.map((row) => (
                  <div key={String(row.label)}>
                    <span>
                      <i
                        className={styles.incomeBar}
                        style={{
                          height: `${(number(row.income) / chartMax) * 100}%`,
                        }}
                      />
                      <i
                        className={styles.expenseBar}
                        style={{
                          height: `${(number(row.expenses) / chartMax) * 100}%`,
                        }}
                      />
                    </span>
                    <small>{String(row.label)}</small>
                  </div>
                ))}
              </div>
            </article>
            <article className={styles.accountingChartCard}>
              <header>
                <span>روند مطالبات معوق</span>
                <strong>{money(chart.at(-1)?.overdue)}</strong>
              </header>
              <div className={styles.accountingBars}>
                {chart.map((row) => (
                  <div key={String(row.label)}>
                    <span>
                      <i
                        className={styles.overdueBar}
                        style={{
                          height: `${(number(row.overdue) / overdueMax) * 100}%`,
                        }}
                      />
                    </span>
                    <small>{String(row.label)}</small>
                  </div>
                ))}
              </div>
            </article>
          </div>
        ) : (
          <Empty text="داده‌ای برای نمودار مالی وجود ندارد" />
        )}
      </Panel>
      <Panel
        className={styles.accountingTablePanel}
        title="جدول مالی"
        action={
          <button
            className={styles.iconButton}
            onClick={() => setCompact((value) => !value)}
            aria-label="تغییر تراکم جدول"
          >
            <Icon name="menu" />
          </button>
        }
      >
        <div className={styles.accountingTableTools}>
          <label className={styles.inlineSearch}>
            <Icon name="search" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="جستجو در اعضا یا خدمات..."
            />
          </label>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label="مرتب‌سازی جدول مالی"
          >
            <option value="newest">جدیدترین سررسید</option>
            <option value="oldest">قدیمی‌ترین سررسید</option>
            <option value="amount_desc">بیشترین مبلغ</option>
            <option value="amount_asc">کمترین مبلغ</option>
          </select>
          <div className={styles.accountingTabs}>
            {[
              { value: "all", label: "همه موارد" },
              { value: "overdue_members", label: "معوق" },
              { value: "upcoming_members", label: "در انتظار سررسید" },
            ].map((item) => (
              <button
                key={item.value}
                className={tab === item.value ? styles.selected : ""}
                onClick={() => setTab(item.value as typeof tab)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {feedback ? <p className={styles.inlineFeedback}>{feedback}</p> : null}
        {rows.length ? (
          <div
            className={`${styles.dataTable} ${styles.accountingTable} ${compact ? styles.compactAccountingTable : ""}`}
          >
            <div className={styles.accountingHead}>
              <span>عضو</span>
              <span>سرویس</span>
              <span>بدهی</span>
              <span>سررسید</span>
              <span>تأخیر</span>
              <span>وضعیت</span>
              <span>عملیات</span>
            </div>
            {rows.map((row) => (
              <div
                className={styles.accountingRow}
                key={`${String(row.invoice)}-${String(row.member_id)}-${String(row.due_date)}`}
              >
                <button
                  className={styles.person}
                  disabled={!number(row.member_id)}
                  onClick={() => onOpen(number(row.member_id))}
                >
                  <span className={styles.avatar}>
                    {String(row.member_name).slice(0, 1)}
                  </span>
                  <span>
                    <b>{String(row.member_name)}</b>
                    <small>{String(row.member_phone)}</small>
                  </span>
                </button>
                <span>{String(row.service_label)}</span>
                <strong>{money(row.outstanding)}</strong>
                <span>{faDate(row.due_date)}</span>
                <span>
                  {number(row.days_overdue) > 0
                    ? `${number(row.days_overdue).toLocaleString("fa-IR")} روز`
                    : "در انتظار سررسید"}
                </span>
                <Status tone={number(row.days_overdue) > 0 ? "red" : "orange"}>
                  {number(row.days_overdue) > 0 ? "معوق" : "در انتظار"}
                </Status>
                {number(row.days_overdue) > 0 ? (
                  <Button
                    onClick={() => onPay(row)}
                    disabled={!number(row.member_id)}
                  >
                    ثبت پرداخت
                  </Button>
                ) : (
                  <Button
                    kind="outline"
                    disabled={
                      !number(row.member_id) ||
                      reminding === number(row.member_id)
                    }
                    onClick={() => void remind(row)}
                  >
                    {reminding === number(row.member_id) ? (
                      <>
                        <Spinner /> در حال ارسال
                      </>
                    ) : (
                      "ارسال یادآوری"
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </Panel>
      {quickAction === "debt" ? (
        <AccountingDebtModal
          onClose={() => setQuickAction(null)}
          onSaved={() => {
            setQuickAction(null);
            void reload();
          }}
        />
      ) : null}
      {quickAction === "payment" ? (
        <AccountingPaymentPicker
          rows={payableRows}
          onClose={() => setQuickAction(null)}
          onSelect={(row) => {
            setQuickAction(null);
            onPay(row);
          }}
        />
      ) : null}
    </>
  );
}

function AccountingDebtModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [members, setMembers] = useState<Json[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Json>("/owner/members/page/")
      .then((result) =>
        setMembers([...list(result.active), ...list(result.inactive)]),
      )
      .catch(() => setError("دریافت فهرست اعضا انجام نشد"))
      .finally(() => setLoading(false));
  }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    setError("");
    try {
      await api(`/owner/members/${number(values.member_id)}/issue-invoice/`, {
        method: "POST",
        body: JSON.stringify({
          items: [{ name: values.name, amount: number(values.amount) }],
          due_date: values.due_date,
          kind: values.invoice_kind,
          discount: number(values.discount),
          payment_mode: "debtor",
        }),
      });
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "ثبت بدهی انجام نشد");
    } finally {
      setPending(false);
    }
  };
  return (
    <Modal title="ثبت بدهی جدید" onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          <span>عضو</span>
          <select name="member_id" required disabled={loading}>
            <option value="">
              {loading ? "در حال دریافت اعضا..." : "انتخاب عضو"}
            </option>
            {members.map((member) => {
              const user = userOf(member);
              return (
                <option key={String(member.id)} value={String(member.id)}>
                  {String(user.full_name ?? user.phone ?? "عضو")}
                </option>
              );
            })}
          </select>
        </label>
        <label>
          <span>عنوان خدمت</span>
          <input name="name" required />
        </label>
        <div className={styles.formGrid}>
          <label>
            <span>مبلغ</span>
            <input name="amount" type="number" min="1" required />
          </label>
          <label>
            <span>تاریخ سررسید</span>
            <input name="due_date" type="date" {...dateInputProps()} required />
          </label>
        </div>
        <div className={styles.formGrid}>
          <label>
            <span>نوع فاکتور</span>
            <select name="invoice_kind">
              <option value="tuition">شهریه</option>
              <option value="service">خدمت</option>
              <option value="supplement">مکمل</option>
            </select>
          </label>
          <label>
            <span>تخفیف اولیه</span>
            <input name="discount" type="number" min="0" defaultValue="0" />
          </label>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
        <footer>
          <Button kind="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit" disabled={pending || loading}>
            {pending ? <Spinner /> : "ثبت بدهی"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

function AccountingPaymentPicker({
  rows,
  onClose,
  onSelect,
}: {
  rows: Json[];
  onClose: () => void;
  onSelect: (row: Json) => void;
}) {
  const [invoice, setInvoice] = useState(String(rows[0]?.invoice ?? ""));
  const selected = rows.find((row) => String(row.invoice) === invoice);
  return (
    <Modal title="انتخاب بدهی برای پرداخت" onClose={onClose}>
      {rows.length ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (selected) onSelect(selected);
          }}
        >
          <label>
            <span>عضو و فاکتور</span>
            <select
              value={invoice}
              onChange={(event) => setInvoice(event.target.value)}
              required
            >
              {rows.map((row) => (
                <option
                  key={`${String(row.invoice)}-${String(row.member_id)}`}
                  value={String(row.invoice)}
                >
                  {String(row.member_name)} - {String(row.service_label)} -{" "}
                  {money(row.outstanding)}
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <div className={styles.paymentSummary}>
              <span>مانده قابل پرداخت</span>
              <strong>{money(selected.outstanding)}</strong>
            </div>
          ) : null}
          <footer>
            <Button kind="outline" onClick={onClose}>
              انصراف
            </Button>
            <Button type="submit">ادامه ثبت پرداخت</Button>
          </footer>
        </form>
      ) : (
        <>
          <Empty text="فاکتور بازی برای ثبت پرداخت وجود ندارد" />
          <footer>
            <Button kind="outline" onClick={onClose}>
              بستن
            </Button>
          </footer>
        </>
      )}
    </Modal>
  );
}

function Expenses({
  data,
  months,
  setMonths,
  reload,
}: {
  data: Json;
  months: number;
  setMonths: (value: number) => void;
  reload: () => Promise<void>;
}) {
  const summary = (data.summary ?? {}) as Json;
  const sourceRows = list(data.rows);
  const chart = list(data.category_chart);
  const trend = list(data.trend_chart);
  const categories = list(data.categories);
  const managedCategories = categories.filter((item) => !item.is_default);
  const chartColors = ["#ef494d", "#4a90e2", "#172f52", "#ffb744"];
  let chartCursor = 0;
  const donut = chart.length
    ? `conic-gradient(${chart
        .map((item, index) => {
          const from = chartCursor;
          chartCursor += number(item.pct);
          return `${chartColors[index % chartColors.length]} ${from}% ${chartCursor}%`;
        })
        .join(", ")})`
    : "#eef0f2";
  const categoryNames = Array.from(
    new Set([
      ...categories.map((item) => String(item.name)),
      ...chart.map((item) => String(item.name)),
    ]),
  );
  const [target, setTarget] = useState<Json | null>(null);
  const [editing, setEditing] = useState<Json | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const rows = useMemo(() => {
    const needle = q.trim();
    return sourceRows
      .filter(
        (row) =>
          (!needle || String(row.title ?? "").includes(needle)) &&
          (!category || String(row.category_name ?? "بدون دسته") === category),
      )
      .sort((a, b) => {
        if (sort === "amount_desc") return number(b.amount) - number(a.amount);
        if (sort === "amount_asc") return number(a.amount) - number(b.amount);
        const left = new Date(String(a.spent_on ?? 0)).getTime();
        const right = new Date(String(b.spent_on ?? 0)).getTime();
        return sort === "oldest" ? left - right : right - left;
      });
  }, [category, q, sort, sourceRows]);
  const remove = async () => {
    if (!target) return;
    setPending(true);
    try {
      await api(`/expenses/${target.id}/`, { method: "DELETE" });
      setTarget(null);
      await reload();
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <Panel title="مروری بر آمار" className={styles.expenseOverview}>
        <div className={`${styles.segment} ${styles.expensePeriods}`}>
          {[1, 3, 6, 12].map((value) => (
            <button
              key={value}
              className={months === value ? styles.selected : ""}
              onClick={() => setMonths(value)}
            >
              {value === 1
                ? "این ماه"
                : value === 12
                  ? "۱ سال"
                  : `${value.toLocaleString("fa-IR")} ماه`}
            </button>
          ))}
        </div>
        <div className={`${styles.fiveStats} ${styles.expenseStats}`}>
          <Stat
            title="مجموع هزینه‌ها"
            value={money(summary.total)}
            hint={
              summary.delta_pct == null
                ? undefined
                : `${number(summary.delta_pct).toLocaleString("fa-IR")}٪ نسبت به دوره قبل`
            }
          />
          <Stat
            title="تعداد هزینه‌ها"
            value={number(summary.count).toLocaleString("fa-IR")}
            hint="نسبت به دوره قبل"
          />
          <Stat
            title="بیشترین دسته"
            value={String(summary.top_category ?? "-")}
            hint={
              summary.top_category_pct == null
                ? undefined
                : `${number(summary.top_category_pct).toLocaleString("fa-IR")}٪ نسبت به دوره قبل`
            }
          />
          <Stat
            title="بزرگ‌ترین هزینه"
            value={money(summary.largest)}
            hint={String(summary.top_category ?? "-")}
          />
          <Stat title="میانگین ماهانه" value={money(summary.monthly_average)} />
        </div>
      </Panel>
      <div className={`${styles.twoColumns} ${styles.expenseCharts}`}>
        <Panel title="سهم هر دسته">
          {chart.length ? (
            <div className={styles.expenseCategoryChart}>
              <div
                className={styles.expenseDonut}
                style={{ background: donut }}
              >
                <span />
              </div>
              <div className={styles.expenseLegend}>
                {chart.map((row, index) => (
                  <article key={String(row.name)}>
                    <i
                      style={{
                        background: chartColors[index % chartColors.length],
                      }}
                    />
                    <b>{String(row.name)}</b>
                    <small>{money(row.amount)}</small>
                    <em>{number(row.pct).toLocaleString("fa-IR")}٪</em>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <Empty />
          )}
        </Panel>
        <Panel title="روند ماهانه">
          {trend.length ? (
            <div className={`${styles.simpleBars} ${styles.expenseBars}`}>
              {trend.map((row, index) => (
                <article key={String(row.label)}>
                  <i
                    style={{
                      height: `${(number(row.amount) / Math.max(...trend.map((item) => number(item.amount)), 1)) * 100}%`,
                      background: ["#ffb744", "#ef494d", "#17956d"][index % 3],
                    }}
                  />
                  <span>{String(row.label)}</span>
                </article>
              ))}
            </div>
          ) : (
            <Empty />
          )}
        </Panel>
      </div>
      <Panel
        title="مدیریت دسته‌بندی‌ها"
        className={styles.expenseCategoriesPanel}
        action={
          <Button onClick={() => setCategoriesOpen(true)}>
            <Icon name="plus" /> افزودن دسته
          </Button>
        }
      >
        {managedCategories.length ? (
          <div className={styles.expenseCategoryCards}>
            {managedCategories.map((item) => (
              <article key={String(item.id)}>
                <span>
                  <b>{String(item.name)}</b>
                  <small>
                    {number(item.expense_count).toLocaleString("fa-IR")} هزینه
                  </small>
                </span>
                <Status tone="gray">سفارشی</Status>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.expenseCategoryEmpty}>
            <span>
              <Icon name="calculator" size={28} />
            </span>
            <p>فعلاً دسته‌بندی جدیدی اضافه نشده!</p>
          </div>
        )}
      </Panel>
      <Panel
        title="هزینه‌ها"
        className={styles.expensesPanel}
        action={
          <span className={styles.panelIcons}>
            <button className={styles.iconButton} aria-label="نمایش جدولی">
              <Icon name="calculator" />
            </button>
            <Icon name="dots" />
          </span>
        }
      >
        <div className={styles.tableTools}>
          <label className={styles.inlineSearch}>
            <Icon name="search" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="جستجو در عنوان هزینه..."
            />
          </label>
          <div className={styles.memberFilters}>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="مرتب‌سازی هزینه‌ها"
            >
              <option value="newest">جدیدترین</option>
              <option value="oldest">قدیمی‌ترین</option>
              <option value="amount_desc">بیشترین مبلغ</option>
              <option value="amount_asc">کمترین مبلغ</option>
            </select>
          </div>
        </div>
        <div className={`${styles.segment} ${styles.expenseCategoryTabs}`}>
          <button
            className={!category ? styles.selected : ""}
            onClick={() => setCategory("")}
          >
            همه موارد
          </button>
          {categoryNames.map((name) => (
            <button
              key={name}
              className={category === name ? styles.selected : ""}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ))}
        </div>
        {rows.length ? (
          <div className={`${styles.dataTable} ${styles.expenseTable}`}>
            <div className={styles.expenseHead}>
              <span>عنوان</span>
              <span>مبلغ</span>
              <span>دسته</span>
              <span>تاریخ</span>
              <span>ماه</span>
              <span>ثبت‌کننده</span>
              <span>فیش</span>
              <span>عملیات</span>
            </div>
            {rows.map((row) => (
              <div className={styles.expenseRow} key={String(row.id)}>
                <b>{String(row.title)}</b>
                <strong className={styles.dangerText}>
                  {money(row.amount)}
                </strong>
                <span>{String(row.category_name ?? "بدون دسته")}</span>
                <span>{faDate(row.spent_on)}</span>
                <span>{faDate(row.related_month)}</span>
                <span>{String(row.recorder_name ?? "-")}</span>
                <span>
                  {row.receipt ? (
                    <a
                      href={String(row.receipt)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      مشاهده
                    </a>
                  ) : row.receipt_warning ? (
                    <Status tone="orange">رسید ندارد</Status>
                  ) : (
                    "-"
                  )}
                </span>
                <div className={styles.rowActions}>
                  <button
                    className={styles.iconButton}
                    onClick={() => setEditing(row)}
                    aria-label="ویرایش هزینه"
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    className={`${styles.iconButton} ${styles.deleteIcon}`}
                    onClick={() => setTarget(row)}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            ))}
            <div className={styles.expenseTotalRow}>
              <b>مجموع</b>
              <strong>{money(data.grand_total)}</strong>
            </div>
          </div>
        ) : (
          <Empty text="هنوز هزینه‌ای ثبت نشده است" />
        )}
      </Panel>
      {target ? (
        <Confirm
          title="حذف هزینه"
          description={`هزینه «${String(target.title)}» برای همیشه حذف شود؟`}
          pending={pending}
          onCancel={() => setTarget(null)}
          onConfirm={() => void remove()}
        />
      ) : null}
      {editing ? (
        <CreateModal
          kind="expense"
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      ) : null}
      {categoriesOpen ? (
        <ExpenseCategoriesModal
          onClose={() => setCategoriesOpen(false)}
          onChanged={reload}
        />
      ) : null}
    </>
  );
}

function Reports({
  data,
  onView,
}: {
  data: Json;
  onView: (view: View) => void;
}) {
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const [snapshot, setSnapshot] = useState(data);
  const [pending, setPending] = useState(false);
  const report = (snapshot.report ?? {}) as Json;
  const expenses = (snapshot.expenses ?? {}) as Json;
  const invoices = list(snapshot.invoices);
  const palette = ["#ff5a18", "#ef4d54", "#377de2", "#ffb541"];
  const dateRange = (value: "week" | "month" | "year") => {
    const end = new Date();
    const start = new Date(end);
    if (value === "week") start.setDate(end.getDate() - 6);
    if (value === "month") start.setDate(1);
    if (value === "year") start.setMonth(0, 1);
    const iso = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { from: iso(start), to: iso(end) };
  };
  const changePeriod = async (next: "week" | "month" | "year") => {
    if (next === period || pending) return;
    setPeriod(next);
    setPending(true);
    const range = dateRange(next);
    try {
      const [nextReport, nextExpenses, nextInvoices] = await Promise.all([
        api<Json>(`/owner/reports/finance/?from=${range.from}&to=${range.to}`),
        api<Json>(`/expenses/page/?months=${next === "year" ? 12 : 1}`),
        api<unknown>("/invoices/"),
      ]);
      const periodInvoices = list(nextInvoices).filter((invoice) => {
        const created = String(invoice.created_at ?? "").slice(0, 10);
        return !created || (created >= range.from && created <= range.to);
      });
      setSnapshot({
        report: nextReport,
        expenses: nextExpenses,
        invoices: periodInvoices,
      });
    } finally {
      setPending(false);
    }
  };
  const incomeGroups = new Map<string, number>();
  for (const invoice of invoices) {
    const amount = number(invoice.paid_total);
    if (!amount) continue;
    const name = String(invoice.service_name || "سایر درآمدها");
    incomeGroups.set(name, (incomeGroups.get(name) ?? 0) + amount);
  }
  let incomeRows = [...incomeGroups.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4);
  if (!incomeRows.length && number(report.income))
    incomeRows = [{ name: "سایر درآمدها", amount: number(report.income) }];
  let expenseRows = list(expenses.category_chart)
    .map((item) => ({
      name: String(item.name),
      amount: number(item.amount),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4);
  if (!expenseRows.length && number(report.expenses))
    expenseRows = [{ name: "سایر هزینه‌ها", amount: number(report.expenses) }];
  const paidCount = invoices.filter(
    (invoice) => number(invoice.paid_total) > 0,
  ).length;
  const profitMargin = number(report.income)
    ? Math.round((number(report.net_profit) / number(report.income)) * 100)
    : 0;
  const hasData = Boolean(
    number(report.income) ||
    number(report.expenses) ||
    number(report.invoiced_total) ||
    invoices.length,
  );
  const categoryBars = (rows: { name: string; amount: number }[]) => {
    const total = Math.max(
      rows.reduce((sum, row) => sum + row.amount, 0),
      1,
    );
    return (
      <div className={styles.financeCategoryBars}>
        {rows.map((row, index) => {
          const pct = Math.round((row.amount / total) * 100);
          return (
            <article key={row.name}>
              <span>{row.name}</span>
              <i>
                <b
                  style={{
                    width: `${pct}%`,
                    background: palette[index % palette.length],
                  }}
                />
              </i>
              <em>{pct.toLocaleString("fa-IR")}٪</em>
            </article>
          );
        })}
      </div>
    );
  };
  if (!hasData)
    return (
      <div className={styles.financeReportEmpty}>
        <Image
          src="/assets/images/coach-empty-dashboard.png"
          alt=""
          width={150}
          height={150}
        />
        <h2>خوش اومدی!</h2>
        <p>فعلاً داده‌ای برای نمایش وجود ندارد</p>
      </div>
    );
  return (
    <div className={styles.financeReports} aria-busy={pending}>
      {pending ? (
        <span className={styles.reportLoading}>
          <Spinner /> در حال به‌روزرسانی گزارش
        </span>
      ) : null}
      <Panel title="مروری بر آمار" className={styles.financeOverview}>
        <div className={`${styles.segment} ${styles.financePeriods}`}>
          {[
            { key: "week" as const, label: "هفتگی" },
            { key: "month" as const, label: "ماهانه" },
            { key: "year" as const, label: "سالانه" },
          ].map((item) => (
            <button
              key={item.key}
              className={period === item.key ? styles.selected : ""}
              onClick={() => void changePeriod(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className={styles.financeReportStats}>
          <Stat title="درآمد کل وصول" value={money(report.income)} />
          <Stat
            title="وصول‌شده"
            value={`${paidCount.toLocaleString("fa-IR")} فاکتور`}
            hint="فاکتور دارای پرداخت"
          />
          <Stat
            title="هزینه‌ها"
            value={`${number(expenses.summary && (expenses.summary as Json).count).toLocaleString("fa-IR")} مورد`}
            hint={money(report.expenses)}
          />
          <Stat
            title="سود خالص"
            value={money(report.net_profit)}
            hint={`${profitMargin.toLocaleString("fa-IR")}٪ حاشیه سود`}
          />
        </div>
      </Panel>
      <div className={styles.financeReportCategories}>
        <Panel title="درآمد بر اساس دسته">
          {incomeRows.length ? categoryBars(incomeRows) : <Empty />}
        </Panel>
        <Panel title="هزینه بر اساس دسته">
          {expenseRows.length ? categoryBars(expenseRows) : <Empty />}
        </Panel>
      </div>
      <Panel title="تحلیل کلی" className={styles.financeAnalysis}>
        <article className={styles.profitInsight}>
          <span>
            <Icon name="wallet" />
          </span>
          <div>
            <b>{profitMargin.toLocaleString("fa-IR")}٪ حاشیه سود</b>
            <p>
              {profitMargin >= 0
                ? "عملکرد مالی دوره جاری مثبت ارزیابی می‌شود."
                : "هزینه‌های دوره از درآمد وصول‌شده بیشتر است."}
            </p>
          </div>
          <Button kind="outline" onClick={() => onView("debtors")}>
            مشاهده بدهکاران
          </Button>
        </article>
        <article className={styles.collectionInsight}>
          <span>
            <Icon name="chart" />
          </span>
          <div>
            <b>
              نرخ وصول {number(report.collection_ratio).toLocaleString("fa-IR")}
              ٪
            </b>
            <p>
              {money(report.income)} از {money(report.invoiced_total)} فاکتور
              شده وصول شده است.
            </p>
          </div>
          <Button kind="outline" onClick={() => onView("accounting")}>
            مشاهده جزئیات
          </Button>
        </article>
      </Panel>
    </div>
  );
}

function Dossier({
  id,
  onClose,
  onPay,
}: {
  id: number;
  onClose: () => void;
  onPay: (row: Json) => void;
}) {
  const [data, setData] = useState<Json | null>(null);
  const [tab, setTab] = useState<
    "all" | "overdue_invoices" | "upcoming_invoices"
  >("all");
  const [error, setError] = useState("");
  const [action, setAction] = useState<
    "invoice" | "discount" | "reminder" | null
  >(null);
  const [editing, setEditing] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [statusPending, setStatusPending] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [invoiceQ, setInvoiceQ] = useState("");
  const loadDossier = useCallback(() => {
    setError("");
    return api<Json>(`/owner/members/${id}/dossier/`)
      .then(setData)
      .catch((error) => setError(error.message));
  }, [id]);
  useEffect(() => {
    void loadDossier();
  }, [loadDossier]);
  if (!data)
    return (
      <div className={styles.fullPage}>
        <header>
          <button className={styles.iconButton} onClick={onClose}>
            <Icon name="arrow" />
          </button>
          <h2>پرونده عضو</h2>
        </header>
        {error ? (
          <p className={styles.error}>{error}</p>
        ) : (
          <div className={styles.loading}>
            <Spinner />
          </div>
        )}
      </div>
    );
  const member = (data.member ?? {}) as Json;
  const user = userOf(member);
  const attendance = (data.attendance ?? {}) as Json;
  const invoiceRows =
    tab === "all"
      ? [...list(data.overdue_invoices), ...list(data.upcoming_invoices)]
      : list(data[tab]);
  const rows = invoiceRows.filter((row) =>
    String(row.service_label ?? row.id)
      .toLocaleLowerCase("fa-IR")
      .includes(invoiceQ.trim().toLocaleLowerCase("fa-IR")),
  );
  const payments = list(data.payment_history);
  return (
    <div className={styles.fullPage}>
      <header>
        <button className={styles.iconButton} onClick={onClose}>
          <Icon name="arrow" />
        </button>
        <h2>پرونده مالی عضو</h2>
      </header>
      <section className={styles.memberHero}>
        <div className={styles.person}>
          <span className={styles.largeAvatar}>
            {String(user.full_name ?? "م").slice(0, 1)}
          </span>
          <span>
            <h3>{String(user.full_name ?? "-")}</h3>
            <p>
              {String(user.phone ?? "-")} · {termLabel(member.term)}
            </p>
            <div className={styles.badges}>
              {member.is_active ? (
                <Status>عضو فعال</Status>
              ) : (
                <Status tone="gray">غیرفعال</Status>
              )}
              {data.is_debtor ? (
                <Status tone="red">بدهکار</Status>
              ) : (
                <Status>تسویه‌شده</Status>
              )}
              {data.coach_name ? (
                <Status tone="gray">مربی: {String(data.coach_name)}</Status>
              ) : null}
            </div>
          </span>
        </div>
        <div className={`${styles.rowActions} ${styles.memberHeroActions}`}>
          <Button
            onClick={() =>
              onPay({
                member_id: id,
                invoice: list(data.overdue_invoices)[0]?.id,
                outstanding: list(data.overdue_invoices)[0]?.outstanding,
              })
            }
          >
            <Icon name="plus" /> ثبت پرداخت
          </Button>
          <button
            className={styles.debtButton}
            type="button"
            onClick={() => setAction("invoice")}
          >
            ثبت بدهی
          </button>
          <Button kind="outline" onClick={() => setAction("discount")}>
            تخفیف
          </Button>
          <button
            className={styles.iconButton}
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            aria-label="عملیات بیشتر"
            aria-expanded={moreOpen}
          >
            <Icon name="dots" />
          </button>
          {moreOpen ? (
            <div className={styles.memberMoreMenu}>
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setMoreOpen(false);
                }}
              >
                <Icon name="edit" /> ویرایش عضو
              </button>
              <button
                type="button"
                onClick={() => {
                  setAction("reminder");
                  setMoreOpen(false);
                }}
              >
                <Icon name="bell" /> ارسال یادآوری
              </button>
              {member.is_active ? (
                <button
                  className={styles.dangerText}
                  type="button"
                  onClick={() => {
                    setDeactivating(true);
                    setMoreOpen(false);
                  }}
                >
                  <Icon name="trash" /> غیرفعال کردن
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
      <div className={styles.fourStats}>
        <Stat
          title="بدهی فعلی"
          value={money(data.current_debt)}
          hint={`${number(data.open_invoice_count).toLocaleString("fa-IR")} فاکتور باز`}
          tone="orangeTone"
        />
        <Stat
          title="آخرین پرداخت"
          value={
            data.last_payment_amount == null
              ? "-"
              : money(data.last_payment_amount)
          }
          hint={faDate(data.last_payment_at)}
        />
        <Stat
          title="کل پرداختی"
          value={money(data.paid_total)}
          tone="greenTone"
        />
        <Stat
          title="حضور این ماه"
          value={`${number(attendance.attended).toLocaleString("fa-IR")} از ${attendance.target == null ? "-" : number(attendance.target).toLocaleString("fa-IR")}`}
          hint={
            attendance.pct == null
              ? "بدون برنامه"
              : `${number(attendance.pct).toLocaleString("fa-IR")}٪`
          }
          tone={attendance.low ? "orangeTone" : "greenTone"}
        />
      </div>
      <Panel className={styles.dossierPanel} title="ریز بدهی‌ها">
        <div className={styles.dossierTools}>
          <label className={styles.inlineSearch}>
            <Icon name="search" />
            <input
              value={invoiceQ}
              onChange={(event) => setInvoiceQ(event.target.value)}
              placeholder="جستجو..."
            />
          </label>
          <div className={`${styles.segment} ${styles.dossierTabs}`}>
            {[
              ["all", "همه موارد"],
              ["overdue_invoices", "بدهی‌های معوق"],
              ["upcoming_invoices", "سررسیدهای آینده"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={tab === value ? styles.selected : ""}
                onClick={() => setTab(value as typeof tab)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {rows.length ? (
          <div className={`${styles.dataTable} ${styles.dossierTable}`}>
            <div className={styles.dossierHead}>
              <span>سرویس</span>
              <span>مبلغ</span>
              <span>سررسید</span>
              <span>تأخیر</span>
              <span>وضعیت</span>
              <span>عملیات</span>
            </div>
            {rows.map((row, index) => (
              <div className={styles.dossierRow} key={String(row.id ?? index)}>
                <span>
                  <b>{String(row.service_label ?? `فاکتور ${row.id}`)}</b>
                </span>
                <strong>{money(row.outstanding ?? row.amount)}</strong>
                <span>{faDate(row.due_date)}</span>
                <span>
                  {number(row.days_overdue) > 0
                    ? `${number(row.days_overdue).toLocaleString("fa-IR")} روز`
                    : "-"}
                </span>
                <Status tone={number(row.days_overdue) > 0 ? "red" : "orange"}>
                  {number(row.days_overdue) > 0 ? "پرداخت‌نشده" : "در انتظار"}
                </Status>
                {number(row.days_overdue) > 0 ? (
                  <Button
                    onClick={() =>
                      onPay({ ...row, member_id: id, invoice: row.id })
                    }
                  >
                    ثبت پرداخت
                  </Button>
                ) : tab === "upcoming_invoices" ? (
                  <Button kind="outline" onClick={() => setAction("reminder")}>
                    ارسال یادآوری
                  </Button>
                ) : (
                  <Button kind="outline" onClick={() => setAction("reminder")}>
                    ارسال یادآوری
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </Panel>
      <Panel className={styles.dossierPanel} title="تاریخچه پرداخت">
        {payments.length ? (
          <div className={`${styles.dataTable} ${styles.paymentHistoryTable}`}>
            <div className={styles.paymentHistoryHead}>
              <span>فاکتور</span>
              <span>مبلغ</span>
              <span>تاریخ پرداخت</span>
              <span>روش پرداخت</span>
              <span>ثبت‌کننده</span>
            </div>
            {payments.map((row, index) => (
              <div
                className={styles.paymentHistoryRow}
                key={String(row.id ?? index)}
              >
                <span>
                  فاکتور {number(row.invoice).toLocaleString("fa-IR")}
                </span>
                <strong>{money(row.amount)}</strong>
                <span>{faDate(row.paid_at)}</span>
                <span>{methodLabel(row.method)}</span>
                <span>{String(row.recorder ?? "سیستم")}</span>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="پرداختی ثبت نشده است" />
        )}
      </Panel>
      {action ? (
        <MemberActionModal
          memberId={id}
          kind={action}
          invoices={[
            ...list(data.overdue_invoices),
            ...list(data.upcoming_invoices),
          ]}
          onClose={() => setAction(null)}
          onSaved={() => {
            setAction(null);
            void loadDossier();
          }}
        />
      ) : null}
      {editing ? (
        <CreateModal
          kind="member"
          initial={member}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void loadDossier();
          }}
        />
      ) : null}
      {deactivating ? (
        <Confirm
          title="غیرفعال کردن عضو"
          description={`عضویت ${String(user.full_name ?? "این عضو")} غیرفعال شود؟ سوابق مالی و حضور او حفظ خواهد شد.`}
          pending={statusPending}
          onCancel={() => setDeactivating(false)}
          onConfirm={() => {
            setStatusPending(true);
            void api(`/owner/members/${id}/deactivate/`, {
              method: "POST",
              body: JSON.stringify({}),
            })
              .then(() => {
                setDeactivating(false);
                return loadDossier();
              })
              .finally(() => setStatusPending(false));
          }}
        />
      ) : null}
    </div>
  );
}

function MemberActionModal({
  memberId,
  kind,
  invoices,
  onClose,
  onSaved,
}: {
  memberId: number;
  kind: "invoice" | "discount" | "reminder";
  invoices: Json[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (kind === "invoice")
        await api(`/owner/members/${memberId}/issue-invoice/`, {
          method: "POST",
          body: JSON.stringify({
            items: [{ name: values.name, amount: number(values.amount) }],
            due_date: values.due_date,
            kind: values.invoice_kind,
            discount: number(values.discount),
            payment_mode: "debtor",
          }),
        });
      if (kind === "discount")
        await api(`/owner/members/${memberId}/discount/`, {
          method: "POST",
          body: JSON.stringify({
            invoice: number(values.invoice),
            ...(values.percent
              ? { percent: number(values.percent) }
              : { amount: number(values.amount) }),
          }),
        });
      if (kind === "reminder")
        await api(`/owner/members/${memberId}/reminder/`, {
          method: "POST",
          body: JSON.stringify({
            invoice: values.invoice ? number(values.invoice) : undefined,
          }),
        });
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "عملیات انجام نشد");
    } finally {
      setPending(false);
    }
  };
  const title =
    kind === "invoice"
      ? "ثبت بدهی جدید"
      : kind === "discount"
        ? "اعمال تخفیف"
        : "ارسال یادآوری پرداخت";
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        {kind !== "invoice" ? (
          <label>
            <span>فاکتور</span>
            <select name="invoice" required={kind === "discount"}>
              <option value="">
                {kind === "reminder" ? "همه بدهی‌ها" : "انتخاب فاکتور"}
              </option>
              {invoices.map((invoice) => (
                <option key={String(invoice.id)} value={String(invoice.id)}>
                  فاکتور {number(invoice.id).toLocaleString("fa-IR")} -{" "}
                  {money(invoice.outstanding)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label>
              <span>عنوان خدمت</span>
              <input name="name" required />
            </label>
            <div className={styles.formGrid}>
              <label>
                <span>مبلغ</span>
                <input name="amount" type="number" min="1" required />
              </label>
              <label>
                <span>تاریخ سررسید</span>
                <input name="due_date" type="date" {...dateInputProps()} required />
              </label>
            </div>
            <div className={styles.formGrid}>
              <label>
                <span>نوع فاکتور</span>
                <select name="invoice_kind">
                  <option value="tuition">شهریه</option>
                  <option value="service">خدمت</option>
                  <option value="supplement">مکمل</option>
                </select>
              </label>
              <label>
                <span>تخفیف اولیه</span>
                <input name="discount" type="number" min="0" defaultValue="0" />
              </label>
            </div>
          </>
        )}
        {kind === "discount" ? (
          <div className={styles.formGrid}>
            <label>
              <span>درصد تخفیف</span>
              <input name="percent" type="number" min="1" max="100" />
            </label>
            <label>
              <span>یا مبلغ ثابت</span>
              <input name="amount" type="number" min="1" />
            </label>
          </div>
        ) : null}
        {kind === "reminder" ? (
          <p className={styles.muted}>
            یادآوری پرداخت از طریق کانال تنظیم‌شده برای این عضو ارسال می‌شود.
          </p>
        ) : null}
        {error ? <p className={styles.error}>{error}</p> : null}
        <footer>
          <Button kind="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Spinner /> در حال انجام
              </>
            ) : (
              "تأیید"
            )}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

function Settings({
  data,
  reload,
  onPromotion,
}: {
  data: Json;
  reload: () => Promise<void>;
  onPromotion: (kind: PromotionKind) => void;
}) {
  const reminderData = (data.reminders ?? {}) as Json;
  const setting = (reminderData.setting ?? {}) as Json;
  const user = (data.user ?? {}) as Json;
  const gyms = useMemo(() => list(data.gyms), [data.gyms]);
  const [tab, setTab] = useState<
    "profile" | "system" | "notices" | "ranges" | "discounts" | "admins"
  >("profile");
  const [form, setForm] = useState(() => ({
    payment_reminders: Boolean(setting.payment_reminders),
    workout_reminders: Boolean(setting.workout_reminders),
    remind_before: Boolean(setting.remind_before),
    days_before_due: number(setting.days_before_due),
    remind_on_due: Boolean(setting.remind_on_due),
    remind_after: Boolean(setting.remind_after),
    days_after_due: number(setting.days_after_due),
    follow_up_days: number(setting.follow_up_days),
    payment_message_before: String(setting.payment_message_before ?? ""),
    payment_message_on_due: String(setting.payment_message_on_due ?? ""),
    payment_message_after: String(setting.payment_message_after ?? ""),
  }));
  const [profileName, setProfileName] = useState(String(user.full_name ?? ""));
  const [language, setLanguage] = useState("fa");
  const [theme, setTheme] = useState("light");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [gymDraft, setGymDraft] = useState<Json>(() => gyms[0] ?? {});
  useEffect(() => {
    setProfileName(String(user.full_name ?? ""));
  }, [user.full_name]);
  useEffect(() => {
    if (gyms[0]) setGymDraft(gyms[0]);
  }, [gyms]);
  useEffect(() => {
    setLanguage(localStorage.getItem("gymplus_language") ?? "fa");
    setTheme(localStorage.getItem("gymplus_theme") ?? "light");
  }, []);
  const submitReminders = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      await api("/owner/reminder-settings/", {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          payment_reminders:
            form.remind_before || form.remind_on_due || form.remind_after,
        }),
      });
      setMessage("تنظیمات با موفقیت ذخیره شد.");
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ذخیره انجام نشد");
    } finally {
      setPending(false);
    }
  };
  const submitProfile = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      await api("/auth/me/", {
        method: "PATCH",
        body: JSON.stringify({ full_name: profileName }),
      });
      setMessage("اطلاعات پروفایل ذخیره شد.");
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ذخیره انجام نشد");
    } finally {
      setPending(false);
    }
  };
  const submitSystem = (event: FormEvent) => {
    event.preventDefault();
    localStorage.setItem("gymplus_language", language);
    localStorage.setItem("gymplus_theme", theme);
    document.documentElement.dataset.theme = theme;
    setMessage("تنظیمات سیستم ذخیره شد.");
  };
  const resetSystem = () => {
    setLanguage(localStorage.getItem("gymplus_language") ?? "fa");
    setTheme(localStorage.getItem("gymplus_theme") ?? "light");
    setMessage("");
  };
  const submitRanges = async (event: FormEvent) => {
    event.preventDefault();
    if (!gymDraft.id) return;
    setPending(true);
    setMessage("");
    try {
      await api(`/gyms/${gymDraft.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          debt_delay_max_days: number(gymDraft.debt_delay_max_days),
          debt_warning_max_days: number(gymDraft.debt_warning_max_days),
          debt_orange_max_days: number(gymDraft.debt_orange_max_days),
        }),
      });
      setMessage("بازه‌های وضعیت بدهی ذخیره شد.");
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ذخیره انجام نشد");
    } finally {
      setPending(false);
    }
  };
  const tabs: {
    key: typeof tab;
    label: string;
    icon: IconName;
  }[] = [
    { key: "profile", label: "پروفایل", icon: "users" },
    { key: "system", label: "تنظیمات", icon: "settings" },
    { key: "notices", label: "اعلان‌ها", icon: "bell" },
    { key: "ranges", label: "بازه‌های وضعیت بدهی", icon: "wallet" },
    { key: "discounts", label: "تخفیف‌ها و کمپین‌ها", icon: "discount" },
    { key: "admins", label: "مدیریت ادمین‌ها", icon: "users" },
  ];
  return (
    <div className={styles.ownerSettings}>
      <nav className={styles.settingsNav} aria-label="بخش‌های تنظیمات">
        {tabs.map((item) => (
          <button
            key={item.key}
            className={tab === item.key ? styles.active : ""}
            onClick={() => {
              setTab(item.key);
              setMessage("");
            }}
          >
            <Icon name={item.icon} />
            {item.label}
          </button>
        ))}
      </nav>
      <div className={styles.settingsContent}>
        {tab === "profile" ? (
          <Panel
            title={
              <span className={styles.settingsTitle}>
                <b>پروفایل</b>
                <span>مشخصات و پروفایل کاربری خود را مدیریت کنید</span>
              </span>
            }
            className={styles.settingsPanel}
          >
            <form
              className={styles.profileSettingsForm}
              onSubmit={submitProfile}
            >
              <div className={styles.profileSettingsHero}>
                <span className={styles.largeAvatar}>
                  {String(user.full_name ?? "م").slice(0, 1)}
                </span>
                <span>
                  <b>{String(user.full_name ?? "کاربر")}</b>
                  <small>مدیر باشگاه</small>
                </span>
              </div>
              <div className={styles.formGrid}>
                <label>
                  <span>نام و نام خانوادگی</span>
                  <input
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>شماره موبایل</span>
                  <input value={String(user.phone ?? "")} readOnly />
                </label>
              </div>
              <label>
                <span>سطح دسترسی</span>
                <input value="مدیر باشگاه" readOnly />
              </label>
              <footer>
                <Button type="submit" disabled={pending}>
                  {pending ? <Spinner /> : "ذخیره اطلاعات"}
                </Button>
                <Button
                  kind="outline"
                  onClick={() => setProfileName(String(user.full_name ?? ""))}
                >
                  انصراف
                </Button>
                {message ? <b>{message}</b> : null}
              </footer>
            </form>
          </Panel>
        ) : null}
        {tab === "system" ? (
          <Panel
            title={
              <span className={styles.settingsTitle}>
                <b>تنظیمات</b>
                <span>تنظیمات سیستم را تغییر دهید</span>
              </span>
            }
            className={styles.settingsPanel}
          >
            <form className={styles.systemSettingsForm} onSubmit={submitSystem}>
              <div className={styles.systemSettingRow}>
                <span>
                  <b>زبان سیستم</b>
                  <small>زبان مورد نظر را انتخاب کنید</small>
                </span>
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  <option value="fa">فارسی</option>
                </select>
              </div>
              <div className={styles.systemSettingRow}>
                <span>
                  <b>تم نمایش</b>
                  <small>حالت نمایش پنل را مشخص کنید</small>
                </span>
                <select
                  value={theme}
                  onChange={(event) => setTheme(event.target.value)}
                >
                  <option value="light">روشن</option>
                  <option value="dark">تیره</option>
                </select>
              </div>
              <div className={styles.passwordSetting}>
                <span className={styles.passwordVisual}>
                  <Icon name="alert" size={26} />
                </span>
                <span>
                  <b>تغییر رمز عبور</b>
                  <small>
                    برای حفظ امنیت حساب، رمز عبور خود را دوره‌ای تغییر دهید
                  </small>
                </span>
                <Button kind="outline" onClick={() => setPasswordOpen(true)}>
                  تغییر رمز عبور
                </Button>
              </div>
              <footer>
                <Button type="submit">ذخیره اطلاعات</Button>
                <Button kind="outline" onClick={resetSystem}>
                  انصراف
                </Button>
                {message ? <b>{message}</b> : null}
              </footer>
            </form>
          </Panel>
        ) : null}
        {tab === "notices" ? (
          <>
            <Panel
              title={
                <span className={styles.settingsTitle}>
                  <b>اعلان‌ها</b>
                  <span>تنظیمات اعلان را مدیریت کنید</span>
                </span>
              }
              className={styles.settingsPanel}
            >
              <form className={styles.settingsForm} onSubmit={submitReminders}>
                <div className={styles.settingBlock}>
                  <Toggle
                    label="یادآوری تمرین"
                    checked={form.workout_reminders}
                    onChange={(value) =>
                      setForm({ ...form, workout_reminders: value })
                    }
                  />
                </div>
                <div
                  className={`${styles.settingBlock} ${styles.beforeNotice}`}
                >
                  <Toggle
                    label="قبل از سررسید"
                    checked={form.remind_before}
                    onChange={(value) =>
                      setForm({ ...form, remind_before: value })
                    }
                  />
                  <label>
                    <span>چند روز قبل</span>
                    <select
                      value={form.days_before_due}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          days_before_due: number(e.target.value),
                        })
                      }
                    >
                      {[1, 2, 3, 5, 7].map((day) => (
                        <option key={day} value={day}>
                          {day.toLocaleString("fa-IR")} روز قبل
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.wide}>
                    <span>متن پیام</span>
                    <textarea
                      value={form.payment_message_before}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          payment_message_before: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <div className={`${styles.settingBlock} ${styles.dueNotice}`}>
                  <Toggle
                    label="روز سررسید"
                    checked={form.remind_on_due}
                    onChange={(value) =>
                      setForm({ ...form, remind_on_due: value })
                    }
                  />
                  <label className={styles.wide}>
                    <span>متن پیام</span>
                    <textarea
                      value={form.payment_message_on_due}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          payment_message_on_due: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <div className={`${styles.settingBlock} ${styles.afterNotice}`}>
                  <Toggle
                    label="بعد از سررسید"
                    checked={form.remind_after}
                    onChange={(value) =>
                      setForm({ ...form, remind_after: value })
                    }
                  />
                  <label>
                    <span>هر چند روز</span>
                    <select
                      value={form.days_after_due}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          days_after_due: number(e.target.value),
                        })
                      }
                    >
                      {[1, 2, 3, 5, 7].map((day) => (
                        <option key={day} value={day}>
                          {day.toLocaleString("fa-IR")} روز
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.wide}>
                    <span>متن پیام</span>
                    <textarea
                      value={form.payment_message_after}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          payment_message_after: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <footer>
                  {message ? <span>{message}</span> : null}
                  <Button type="submit" disabled={pending}>
                    {pending ? (
                      <>
                        <Spinner /> در حال ذخیره
                      </>
                    ) : (
                      "ذخیره تنظیمات"
                    )}
                  </Button>
                </footer>
              </form>
            </Panel>
          </>
        ) : null}
        {tab === "ranges" ? (
          <Panel
            title={
              <span className={styles.settingsTitle}>
                <b>بازه‌های وضعیت بدهی</b>
                <span>
                  تعیین کنید سیستم بدهی چندروزه را در کدام دسته قرار دهد
                </span>
              </span>
            }
            className={styles.settingsPanel}
          >
            {gymDraft.id ? (
              <form className={styles.debtRangesForm} onSubmit={submitRanges}>
                {[
                  {
                    key: "debt_delay_max_days",
                    title: "وضعیت به‌روز",
                    color: "#19a87d",
                    start: 0,
                  },
                  {
                    key: "debt_warning_max_days",
                    title: "وضعیت تأخیر",
                    color: "#2682ed",
                    start: number(gymDraft.debt_delay_max_days) + 1,
                  },
                  {
                    key: "debt_orange_max_days",
                    title: "وضعیت هشدار",
                    color: "#e26605",
                    start: number(gymDraft.debt_warning_max_days) + 1,
                  },
                ].map((range) => (
                  <article key={range.key}>
                    <header>
                      <span>
                        <i style={{ background: range.color }} />
                        <b>{range.title}</b>
                      </span>
                      <small>
                        {range.start.toLocaleString("fa-IR")} تا{" "}
                        {number(gymDraft[range.key]).toLocaleString("fa-IR")}{" "}
                        روز
                      </small>
                    </header>
                    <label>
                      <span>بازه را مشخص کنید</span>
                      <input
                        type="range"
                        min={range.start}
                        max="120"
                        value={number(gymDraft[range.key])}
                        style={{ accentColor: range.color }}
                        onChange={(event) =>
                          setGymDraft({
                            ...gymDraft,
                            [range.key]: number(event.target.value),
                          })
                        }
                      />
                    </label>
                  </article>
                ))}
                <article className={styles.criticalRange}>
                  <header>
                    <span>
                      <i />
                      <b>وضعیت بحرانی</b>
                    </span>
                    <small>
                      بیش از{" "}
                      {number(gymDraft.debt_orange_max_days).toLocaleString(
                        "fa-IR",
                      )}{" "}
                      روز
                    </small>
                  </header>
                  <p>این بازه به‌صورت خودکار پس از آخرین حد محاسبه می‌شود.</p>
                </article>
                <footer>
                  <Button type="submit" disabled={pending}>
                    {pending ? <Spinner /> : "ذخیره اطلاعات"}
                  </Button>
                  <Button
                    kind="outline"
                    onClick={() => setGymDraft(gyms[0] ?? {})}
                  >
                    انصراف
                  </Button>
                  {message ? <b>{message}</b> : null}
                </footer>
              </form>
            ) : (
              <Empty text="باشگاهی برای تنظیم بازه‌ها وجود ندارد" />
            )}
          </Panel>
        ) : null}
        {tab === "discounts" ? (
          <Discounts
            data={(data.promotions ?? {}) as Json}
            onAdd={onPromotion}
            reload={reload}
          />
        ) : null}
        {tab === "admins" ? (
          <Panel
            title={
              <span className={styles.settingsTitle}>
                <b>مدیریت ادمین‌ها</b>
                <span>حساب مالک اصلی باشگاه</span>
              </span>
            }
            className={styles.settingsPanel}
          >
            <div className={styles.adminSettingsTable}>
              <div>
                <span>کاربر</span>
                <span>سطح دسترسی</span>
                <span>وضعیت</span>
              </div>
              <article>
                <span className={styles.person}>
                  <span className={styles.avatar}>
                    {String(user.full_name ?? "م").slice(0, 1)}
                  </span>
                  <span>
                    <b>{String(user.full_name ?? "کاربر")}</b>
                    <small>{String(user.phone ?? "")}</small>
                  </span>
                </span>
                <span>مالک اصلی</span>
                <Status>فعال</Status>
              </article>
            </div>
          </Panel>
        ) : null}
      </div>
      {passwordOpen ? (
        <PasswordChangeModal onClose={() => setPasswordOpen(false)} />
      ) : null}
    </div>
  );
}

function PasswordChangeModal({ onClose }: { onClose: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (values.new_password !== values.confirm_password) {
      setError("تکرار رمز عبور با رمز جدید یکسان نیست.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await api("/auth/password/change/", {
        method: "POST",
        body: JSON.stringify({
          old_password: values.old_password,
          new_password: values.new_password,
        }),
      });
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "تغییر رمز انجام نشد");
    } finally {
      setPending(false);
    }
  };
  return (
    <Modal title="تغییر رمز عبور" onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          <span>رمز عبور فعلی</span>
          <input type="password" name="old_password" required />
        </label>
        <label>
          <span>رمز عبور جدید</span>
          <input type="password" name="new_password" minLength={8} required />
        </label>
        <label>
          <span>تکرار رمز عبور جدید</span>
          <input
            type="password"
            name="confirm_password"
            minLength={8}
            required
          />
        </label>
        {error ? <p className={styles.error}>{error}</p> : null}
        <footer>
          <Button kind="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner /> : "تغییر رمز"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

function Discounts({
  data,
  onAdd,
  reload,
}: {
  data: Json;
  onAdd: (kind: PromotionKind) => void;
  reload: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"codes" | "service" | "campaigns">("codes");
  const [target, setTarget] = useState<Json | null>(null);
  const [pending, setPending] = useState(false);
  const items = list(data[tab]);
  const remove = async () => {
    if (!target) return;
    setPending(true);
    const endpoint =
      tab === "codes"
        ? "discount-codes"
        : tab === "service"
          ? "service-discounts"
          : "campaigns";
    try {
      await api(`/owner/${endpoint}/${target.id}/`, { method: "DELETE" });
      setTarget(null);
      await reload();
    } finally {
      setPending(false);
    }
  };
  return (
    <Panel
      title="تخفیف‌ها و کمپین‌ها"
      action={
        <div className={styles.rowActions}>
          <div className={styles.tabs}>
            <button
              className={tab === "codes" ? styles.selected : ""}
              onClick={() => setTab("codes")}
            >
              کد تخفیف
            </button>
            <button
              className={tab === "service" ? styles.selected : ""}
              onClick={() => setTab("service")}
            >
              تخفیف سرویس
            </button>
            <button
              className={tab === "campaigns" ? styles.selected : ""}
              onClick={() => setTab("campaigns")}
            >
              کمپین‌ها
            </button>
          </div>
          <Button onClick={() => onAdd(tab)}>
            <Icon name="plus" /> ثبت جدید
          </Button>
        </div>
      }
    >
      {items.length ? (
        <div className={styles.cardGrid}>
          {items.map((item) => (
            <article key={String(item.id)}>
              <header>
                <b>
                  {String(item.code ?? item.name ?? `سرویس ${item.service}`)}
                </b>
                <Status tone={item.is_active === false ? "gray" : "green"}>
                  {item.is_active === false ? "غیرفعال" : "فعال"}
                </Status>
              </header>
              <strong>
                {number(item.value).toLocaleString("fa-IR")}
                {item.kind === "percent" ? "٪" : " تومان"}
              </strong>
              <p>
                {item.expires_at || item.ends_at
                  ? `انقضا: ${faDate(item.expires_at ?? item.ends_at)}`
                  : "بدون تاریخ انقضا"}
              </p>
              <small>
                {item.total_uses != null
                  ? `${number(item.total_uses).toLocaleString("fa-IR")} بار استفاده`
                  : item.use_count != null
                    ? `${number(item.use_count).toLocaleString("fa-IR")} بار استفاده`
                    : ""}
              </small>
              <button
                className={`${styles.iconButton} ${styles.deleteIcon}`}
                onClick={() => setTarget(item)}
                aria-label="حذف"
              >
                <Icon name="trash" />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty text="موردی در این بخش ثبت نشده است" />
      )}
      {target ? (
        <Confirm
          title="حذف تخفیف"
          description="این مورد برای همیشه حذف شود؟"
          pending={pending}
          onCancel={() => setTarget(null)}
          onConfirm={() => void remove()}
        />
      ) : null}
    </Panel>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={styles.toggle}>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <i />
    </label>
  );
}
function Confirm({
  title,
  description,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className={styles.modalBackdrop}
      onClick={() => !pending && onCancel()}
    >
      <section className={styles.confirm} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button onClick={onCancel}>
            <Icon name="close" />
          </button>
        </header>
        <div>
          <span className={styles.warningIcon}>
            <Icon name="alert" size={26} />
          </span>
          <p>{description}</p>
        </div>
        <footer>
          <Button kind="outline" onClick={onCancel}>
            انصراف
          </Button>
          <Button kind="danger" disabled={pending} onClick={onConfirm}>
            {pending ? <Spinner /> : "تأیید"}
          </Button>
        </footer>
      </section>
    </div>
  );
}

function PaymentModal({
  row,
  onClose,
  onSaved,
}: {
  row: Json;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [invoices, setInvoices] = useState<Json[]>(
    row.invoice ? [{ id: row.invoice, outstanding: row.outstanding }] : [],
  );
  const [invoiceLoading, setInvoiceLoading] = useState(!row.invoice);

  useEffect(() => {
    if (row.invoice || !row.member_id) return;
    api<Json>(`/owner/members/${row.member_id}/dossier/`)
      .then((dossier) => setInvoices(list(dossier.overdue_invoices)))
      .catch(() => setError("دریافت فاکتورهای باز عضو انجام نشد."))
      .finally(() => setInvoiceLoading(false));
  }, [row.invoice, row.member_id]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(`/owner/members/${row.member_id}/record-payment/`, {
        method: "POST",
        body: JSON.stringify({
          invoice: number(values.invoice),
          amount: number(values.amount),
          method: values.method,
          paid_at: values.paid_at || undefined,
          note: values.note,
        }),
      });
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "ثبت پرداخت انجام نشد");
    } finally {
      setPending(false);
    }
  };
  return (
    <Modal title="ثبت پرداخت" onClose={onClose}>
      <form onSubmit={submit}>
        <div className={styles.paymentSummary}>
          <span>مانده قابل پرداخت</span>
          <strong>{money(row.outstanding ?? row.debt)}</strong>
        </div>
        <label>
          <span>فاکتور باز</span>
          <select
            name="invoice"
            defaultValue={String(row.invoice ?? "")}
            required
          >
            <option value="" disabled>
              {invoiceLoading ? "در حال دریافت فاکتورها..." : "انتخاب فاکتور"}
            </option>
            {invoices.map((invoice) => (
              <option key={String(invoice.id)} value={String(invoice.id)}>
                فاکتور {number(invoice.id).toLocaleString("fa-IR")} - مانده{" "}
                {money(invoice.outstanding)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>مبلغ پرداخت</span>
          <input
            name="amount"
            type="number"
            min="1"
            max={number(row.outstanding ?? row.debt) || undefined}
            defaultValue={number(row.outstanding ?? row.debt)}
            required
          />
        </label>
        <div className={styles.formGrid}>
          <label>
            <span>روش پرداخت</span>
            <select name="method">
              <option value="cash">نقد</option>
              <option value="pos">کارت‌خوان</option>
              <option value="card_transfer">کارت‌به‌کارت</option>
              <option value="gateway">درگاه آنلاین</option>
            </select>
          </label>
          <label>
            <span>تاریخ پرداخت</span>
            <input name="paid_at" type="date" {...dateInputProps()} />
          </label>
        </div>
        <label>
          <span>یادداشت</span>
          <textarea name="note" placeholder="توضیحات اختیاری..." />
        </label>
        {error ? <p className={styles.error}>{error}</p> : null}
        <footer>
          <Button kind="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button
            type="submit"
            disabled={pending || invoiceLoading || !invoices.length}
          >
            {pending ? (
              <>
                <Spinner /> در حال ثبت
              </>
            ) : (
              "ثبت پرداخت"
            )}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

function PromotionModal({
  kind,
  onClose,
  onSaved,
}: {
  kind: PromotionKind;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [services, setServices] = useState<Json[]>([]);
  const [newMembersOnly, setNewMembersOnly] = useState(false);
  useEffect(() => {
    if (kind !== "codes")
      api<unknown>("/services/")
        .then((result) => setServices(list(result)))
        .catch(() => setServices([]));
  }, [kind]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const endpoint =
      kind === "codes"
        ? "discount-codes"
        : kind === "service"
          ? "service-discounts"
          : "campaigns";
    const payload: Json = {
      ...values,
      value: number(values.value),
      kind: values.kind,
    };
    if (kind === "codes")
      Object.assign(payload, {
        scope: "all",
        max_uses: values.max_uses ? number(values.max_uses) : null,
        per_member_limit: values.per_member_limit
          ? number(values.per_member_limit)
          : null,
        expires_at: values.expires_at || null,
      });
    if (kind === "service")
      Object.assign(payload, {
        service: number(values.service),
        starts_at: values.starts_at || null,
        ends_at: values.ends_at || null,
      });
    if (kind === "campaigns")
      Object.assign(payload, {
        services: values.service ? [number(values.service)] : [],
        new_members_only: newMembersOnly,
        max_uses: values.max_uses ? number(values.max_uses) : null,
      });
    try {
      await api(`/owner/${endpoint}/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "ثبت تخفیف انجام نشد");
    } finally {
      setPending(false);
    }
  };
  const title =
    kind === "codes"
      ? "ساخت کد تخفیف"
      : kind === "service"
        ? "تخفیف سرویس"
        : "ساخت کمپین";
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        {kind === "codes" ? (
          <label>
            <span>کد تخفیف</span>
            <input name="code" dir="ltr" required />
          </label>
        ) : kind === "campaigns" ? (
          <label>
            <span>نام کمپین</span>
            <input name="name" required />
          </label>
        ) : null}
        <div className={styles.formGrid}>
          <label>
            <span>نوع تخفیف</span>
            <select name="kind">
              <option value="percent">درصدی</option>
              <option value="fixed">مبلغ ثابت</option>
            </select>
          </label>
          <label>
            <span>مقدار</span>
            <input name="value" type="number" min="1" required />
          </label>
        </div>
        {kind !== "codes" ? (
          <label>
            <span>سرویس</span>
            <select name="service" required={kind === "service"}>
              <option value="">
                {kind === "campaigns" ? "همه سرویس‌ها" : "انتخاب سرویس"}
              </option>
              {services.map((service) => (
                <option key={String(service.id)} value={String(service.id)}>
                  {String(service.name ?? service.title)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className={styles.formGrid}>
          {kind === "codes" ? (
            <>
              <label>
                <span>حداکثر استفاده</span>
                <input name="max_uses" type="number" min="1" />
              </label>
              <label>
                <span>سقف هر عضو</span>
                <input name="per_member_limit" type="number" min="1" />
              </label>
            </>
          ) : (
            <>
              <label>
                <span>تاریخ شروع</span>
                <input
                  name="starts_at"
                  type="date" {...dateInputProps()}
                  required={kind === "campaigns"}
                />
              </label>
              <label>
                <span>تاریخ پایان</span>
                <input
                  name="ends_at"
                  type="date" {...dateInputProps()}
                  required={kind === "campaigns"}
                />
              </label>
            </>
          )}
        </div>
        {kind === "codes" ? (
          <label>
            <span>تاریخ انقضا</span>
            <input name="expires_at" type="date" {...dateInputProps()} />
          </label>
        ) : null}
        {kind === "campaigns" ? (
          <>
            <label>
              <span>حداکثر استفاده</span>
              <input name="max_uses" type="number" min="1" />
            </label>
            <Toggle
              label="فقط اعضای جدید"
              checked={newMembersOnly}
              onChange={setNewMembersOnly}
            />
          </>
        ) : null}
        {error ? <p className={styles.error}>{error}</p> : null}
        <footer>
          <Button kind="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Spinner /> در حال ثبت
              </>
            ) : (
              "ثبت"
            )}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

function ExpenseCategoriesModal({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [items, setItems] = useState<Json[]>([]);
  const [gyms, setGyms] = useState<Json[]>([]);
  const [gym, setGym] = useState("");
  const [name, setName] = useState("");
  const [target, setTarget] = useState<Json | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const loadCategories = useCallback(async () => {
    const result = await api<unknown>(
      `/expense-categories/${gym ? `?gym=${gym}` : ""}`,
    );
    setItems(list(result));
  }, [gym]);
  useEffect(() => {
    void api<unknown>("/gyms/").then((result) => {
      const rows = list(result);
      setGyms(rows);
      if (rows.length === 1) setGym(String(rows[0].id));
    });
  }, []);
  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);
  const createCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!gym) {
      setError("ابتدا باشگاه را انتخاب کنید.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await api("/expense-categories/", {
        method: "POST",
        body: JSON.stringify({ gym: number(gym), name }),
      });
      setName("");
      await loadCategories();
      await onChanged();
    } catch (error) {
      setError(error instanceof Error ? error.message : "ثبت دسته انجام نشد");
    } finally {
      setPending(false);
    }
  };
  const removeCategory = async (item: Json) => {
    setPending(true);
    setError("");
    try {
      await api(`/expense-categories/${item.id}/`, { method: "DELETE" });
      setTarget(null);
      await loadCategories();
      await onChanged();
    } catch (error) {
      setError(error instanceof Error ? error.message : "حذف دسته انجام نشد");
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <Modal title="مدیریت دسته‌های هزینه" onClose={onClose}>
        <form onSubmit={createCategory}>
          <label>
            <span>باشگاه</span>
            <select
              value={gym}
              onChange={(event) => setGym(event.target.value)}
              required
            >
              <option value="">انتخاب کنید</option>
              {gyms.map((item) => (
                <option key={String(item.id)} value={String(item.id)}>
                  {String(item.name ?? item.title)}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.categoryManager}>
            {items.map((item) => (
              <div key={String(item.id)}>
                <span>
                  <b>{String(item.name)}</b>
                  <small>
                    {item.is_default
                      ? "پیش‌فرض سیستم"
                      : `${number(item.expense_count).toLocaleString("fa-IR")} هزینه`}
                  </small>
                </span>
                {!item.is_default && !number(item.expense_count) ? (
                  <button
                    type="button"
                    className={`${styles.iconButton} ${styles.deleteIcon}`}
                    disabled={pending}
                    onClick={() => setTarget(item)}
                    aria-label="حذف دسته"
                  >
                    <Icon name="trash" />
                  </button>
                ) : (
                  <Status tone="gray">غیرقابل حذف</Status>
                )}
              </div>
            ))}
          </div>
          <label>
            <span>نام دسته جدید</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          {error ? <p className={styles.error}>{error}</p> : null}
          <footer>
            <Button kind="outline" onClick={onClose}>
              بستن
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Spinner /> در حال ثبت
                </>
              ) : (
                "افزودن دسته"
              )}
            </Button>
          </footer>
        </form>
      </Modal>
      {target ? (
        <Confirm
          title="حذف دسته‌بندی"
          description={`دسته «${String(target.name)}» برای همیشه حذف شود؟`}
          pending={pending}
          onCancel={() => setTarget(null)}
          onConfirm={() => void removeCategory(target)}
        />
      ) : null}
    </>
  );
}

function CreateModal({
  kind,
  initial,
  onClose,
  onSaved,
}: {
  kind: "member" | "expense";
  initial?: Json;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [gyms, setGyms] = useState<Json[]>([]);
  const [categories, setCategories] = useState<Json[]>([]);
  const [services, setServices] = useState<Json[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const initialUser = userOf(initial ?? {});
  const [memberDraft, setMemberDraft] = useState({
    full_name: String(initialUser.full_name ?? ""),
    phone: String(initialUser.phone ?? ""),
    gender: "",
    birth_date: "",
    national_code: "",
    subscription_service: "",
    term: String(initial?.term ?? "monthly"),
    monthly_fee:
      initial?.monthly_fee == null ? "" : String(initial.monthly_fee),
    start_date: String(
      initial?.start_date ?? new Date().toISOString().slice(0, 10),
    ),
    payment_method: "credit",
  });
  useEffect(() => {
    void Promise.all([
      api<unknown>("/gyms/").then((result) => setGyms(list(result))),
      kind === "expense"
        ? api<unknown>("/expense-categories/").then((result) =>
            setCategories(list(result)),
          )
        : api<unknown>("/services/").then((result) =>
            setServices(list(result)),
          ),
    ]).catch(() => {});
  }, [kind]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    try {
      if (kind === "member")
        await api(
          initial ? `/owner/members/${initial.id}/` : "/owner/members/",
          {
            method: initial ? "PATCH" : "POST",
            body: JSON.stringify({
              ...values,
              ...memberDraft,
              ...(initial ? { phone: undefined } : {}),
              gym: number(values.gym),
              monthly_fee: number(memberDraft.monthly_fee),
              amount: memberDraft.monthly_fee
                ? number(memberDraft.monthly_fee)
                : undefined,
              subscription_service:
                !initial && memberDraft.subscription_service
                  ? number(memberDraft.subscription_service)
                  : undefined,
              birth_date: memberDraft.birth_date || null,
              is_active: initial ? Boolean(initial.is_active) : true,
            }),
          },
        );
      else {
        const body = new FormData(form);
        const receipt = body.get("receipt") as File;
        if (!receipt?.size) body.delete("receipt");
        else if (receipt.size > 5 * 1024 * 1024)
          throw new Error("حجم فایل رسید نباید بیشتر از ۵ مگابایت باشد.");
        await api(initial ? `/expenses/${initial.id}/` : "/expenses/", {
          method: initial ? "PATCH" : "POST",
          body,
        });
      }
      onSaved();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "ثبت اطلاعات انجام نشد",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <Modal
      title={
        kind === "member"
          ? initial
            ? "ویرایش اطلاعات عضو"
            : "ثبت عضو جدید"
          : initial
            ? "ویرایش هزینه"
            : "ثبت هزینه جدید"
      }
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <label>
          <span>باشگاه</span>
          <select name="gym" defaultValue={String(initial?.gym ?? "")} required>
            <option value="">انتخاب کنید</option>
            {gyms.map((gym) => (
              <option key={String(gym.id)} value={String(gym.id)}>
                {String(gym.name ?? gym.title)}
              </option>
            ))}
          </select>
        </label>
        {kind === "member" ? (
          <>
            <div className={styles.formSteps} aria-label="مراحل ثبت عضو">
              <span
                className={step === 1 ? styles.currentStep : styles.doneStep}
              >
                ۱<small>اطلاعات پایه</small>
              </span>
              <i />
              <span className={step === 2 ? styles.currentStep : ""}>
                ۲<small>عضویت و پرداخت</small>
              </span>
            </div>
            {step === 1 ? (
              <div className={styles.formSection}>
                <div className={styles.formGrid}>
                  <label>
                    <span>نام و نام خانوادگی *</span>
                    <input
                      value={memberDraft.full_name}
                      onChange={(event) =>
                        setMemberDraft({
                          ...memberDraft,
                          full_name: event.target.value,
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>شماره موبایل *</span>
                    <input
                      value={memberDraft.phone}
                      onChange={(event) =>
                        setMemberDraft({
                          ...memberDraft,
                          phone: event.target.value,
                        })
                      }
                      inputMode="tel"
                      required
                    />
                  </label>
                </div>
                <div className={styles.formGrid}>
                  <label>
                    <span>جنسیت</span>
                    <select
                      value={memberDraft.gender}
                      onChange={(event) =>
                        setMemberDraft({
                          ...memberDraft,
                          gender: event.target.value,
                        })
                      }
                    >
                      <option value="">انتخاب نشده</option>
                      <option value="male">مرد</option>
                      <option value="female">زن</option>
                    </select>
                  </label>
                  <label>
                    <span>تاریخ تولد</span>
                    <input
                      type="date" {...dateInputProps()}
                      value={memberDraft.birth_date}
                      onChange={(event) =>
                        setMemberDraft({
                          ...memberDraft,
                          birth_date: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <label>
                  <span>کد ملی</span>
                  <input
                    inputMode="numeric"
                    value={memberDraft.national_code}
                    onChange={(event) =>
                      setMemberDraft({
                        ...memberDraft,
                        national_code: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
            ) : (
              <div className={styles.formSection}>
                <label>
                  <span>سرویس عضویت</span>
                  <select
                    value={memberDraft.subscription_service}
                    onChange={(event) => {
                      const service = services.find(
                        (item) => String(item.id) === event.target.value,
                      );
                      setMemberDraft({
                        ...memberDraft,
                        subscription_service: event.target.value,
                        monthly_fee: service
                          ? String(service.price ?? service.amount ?? "")
                          : memberDraft.monthly_fee,
                      });
                    }}
                  >
                    <option value="">عضویت بدون سرویس</option>
                    {services.map((service) => (
                      <option
                        key={String(service.id)}
                        value={String(service.id)}
                      >
                        {String(service.name ?? service.title)}
                        {service.price != null
                          ? ` - ${money(service.price)}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={styles.formGrid}>
                  <label>
                    <span>دوره عضویت</span>
                    <select
                      value={memberDraft.term}
                      onChange={(event) =>
                        setMemberDraft({
                          ...memberDraft,
                          term: event.target.value,
                        })
                      }
                    >
                      <option value="monthly">ماهانه</option>
                      <option value="quarterly">سه‌ماهه</option>
                      <option value="semiannual">شش‌ماهه</option>
                      <option value="annual">سالانه</option>
                    </select>
                  </label>
                  <label>
                    <span>مبلغ عضویت</span>
                    <input
                      value={memberDraft.monthly_fee}
                      onChange={(event) =>
                        setMemberDraft({
                          ...memberDraft,
                          monthly_fee: event.target.value,
                        })
                      }
                      type="number"
                      min="0"
                    />
                  </label>
                </div>
                <div className={styles.formGrid}>
                  <label>
                    <span>تاریخ شروع</span>
                    <input
                      value={memberDraft.start_date}
                      onChange={(event) =>
                        setMemberDraft({
                          ...memberDraft,
                          start_date: event.target.value,
                        })
                      }
                      type="date" {...dateInputProps()}
                    />
                  </label>
                  <label>
                    <span>روش پرداخت</span>
                    <select
                      value={memberDraft.payment_method}
                      onChange={(event) =>
                        setMemberDraft({
                          ...memberDraft,
                          payment_method: event.target.value,
                        })
                      }
                    >
                      <option value="credit">اعتباری (ثبت بدهی)</option>
                      <option value="cash">نقد</option>
                      <option value="pos">کارت‌خوان</option>
                      <option value="online">درگاه آنلاین</option>
                    </select>
                  </label>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className={styles.formGrid}>
              <label>
                <span>عنوان هزینه</span>
                <input
                  name="title"
                  defaultValue={String(initial?.title ?? "")}
                  required
                />
              </label>
              <label>
                <span>دسته‌بندی</span>
                <select
                  name="category"
                  defaultValue={String(initial?.category ?? "")}
                >
                  <option value="">بدون دسته</option>
                  {categories.map((category) => (
                    <option
                      key={String(category.id)}
                      value={String(category.id)}
                    >
                      {String(category.name)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={styles.formGrid}>
              <label>
                <span>مبلغ</span>
                <input
                  name="amount"
                  type="number"
                  min="0"
                  defaultValue={number(initial?.amount) || ""}
                  required
                />
              </label>
              <label>
                <span>تاریخ پرداخت</span>
                <input
                  name="spent_on"
                  type="date" {...dateInputProps()}
                  defaultValue={String(initial?.spent_on ?? "")}
                  required
                />
              </label>
            </div>
            <label>
              <span>ماه مربوطه</span>
              <input
                name="related_month"
                type="date" {...dateInputProps()}
                defaultValue={String(initial?.related_month ?? "")}
              />
            </label>
            <label className={styles.receiptUpload}>
              <span>تصویر رسید</span>
              <i>
                <Icon name="upload" size={24} />
              </i>
              <input
                name="receipt"
                type="file"
                accept="image/png,image/jpeg,application/pdf"
              />
              <small className={styles.fieldHint}>
                برای بارگذاری فایل کلیک کنید
                <em>PDF، JPG یا PNG تا حداکثر ۵ مگابایت</em>
              </small>
            </label>
          </>
        )}
        {error ? <p className={styles.error}>{error}</p> : null}
        <footer>
          <Button kind="outline" onClick={onClose}>
            انصراف
          </Button>
          {kind === "member" && step === 2 ? (
            <Button kind="outline" onClick={() => setStep(1)}>
              مرحله قبل
            </Button>
          ) : null}
          {kind === "member" && step === 1 ? (
            <Button
              onClick={() => {
                if (
                  !memberDraft.full_name.trim() ||
                  !memberDraft.phone.trim()
                ) {
                  setError("نام و شماره موبایل برای ادامه الزامی است.");
                  return;
                }
                setError("");
                setStep(2);
              }}
            >
              ادامه
            </Button>
          ) : (
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Spinner /> در حال ثبت
                </>
              ) : (
                "ثبت اطلاعات"
              )}
            </Button>
          )}
        </footer>
      </form>
    </Modal>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <section className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

async function loadView(view: View, months: number) {
  if (view === "home") {
    const [dashboard, debtors, membersPage] = await Promise.all([
      api<Json>("/owner/dashboard/"),
      api<Json>("/owner/debtors/?range=1&sort=newest"),
      api<Json>("/owner/members/page/"),
    ]);
    return { dashboard, debtors, membersPage };
  }
  if (view === "members") return api<Json>("/owner/members/page/");
  if (view === "accounting")
    return api<Json>(`/owner/accounting/?months=${months}`);
  if (view === "expenses") {
    const [page, categories] = await Promise.all([
      api<Json>(`/expenses/page/?months=${months}`),
      api<unknown>("/expense-categories/"),
    ]);
    return { ...page, categories: list(categories) };
  }
  if (view === "reports") {
    const [report, expenses, invoices] = await Promise.all([
      api<Json>("/owner/reports/finance/"),
      api<Json>("/expenses/page/?months=1"),
      api<unknown>("/invoices/"),
    ]);
    return { report, expenses, invoices: list(invoices) };
  }
  if (view === "debtors") return {};
  if (view === "critical") {
    const [critical, report] = await Promise.all([
      api<unknown>("/invoices/critical/"),
      api<Json>("/reports/finance/"),
    ]);
    return { critical, report };
  }
  if (view === "settings") {
    const [reminders, user, gyms, codes, service, campaigns] =
      await Promise.all([
        api<Json>("/owner/reminder-settings/"),
        api<Json>("/auth/me/"),
        api<unknown>("/gyms/"),
        api<unknown>("/owner/discount-codes/"),
        api<unknown>("/owner/service-discounts/"),
        api<unknown>("/owner/campaigns/"),
      ]);
    return {
      reminders,
      user,
      gyms: list(gyms),
      promotions: {
        codes: list(codes),
        service: list(service),
        campaigns: list(campaigns),
      },
    };
  }
  if (view === "discounts") {
    const [codes, service, campaigns] = await Promise.all([
      api<unknown>("/owner/discount-codes/"),
      api<unknown>("/owner/service-discounts/"),
      api<unknown>("/owner/campaigns/"),
    ]);
    return {
      codes: list(codes),
      service: list(service),
      campaigns: list(campaigns),
    };
  }
  return {};
}

export function OwnerDashboard({ user }: { user: User }) {
  const [view, setView] = useState<View>("home");
  const [data, setData] = useState<Json>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [months, setMonths] = useState(3);
  const [create, setCreate] = useState<"member" | "expense" | null>(null);
  const [promotion, setPromotion] = useState<PromotionKind | null>(null);
  const [payment, setPayment] = useState<Json | null>(null);
  const [dossier, setDossier] = useState<number | null>(null);
  const [debtCreate, setDebtCreate] = useState(false);
  const [debtorsRefresh, setDebtorsRefresh] = useState(0);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loadView(view, months));
    } catch (error) {
      setError(
        error instanceof Error && error.message !== "UNAUTHORIZED"
          ? error.message
          : "دریافت اطلاعات انجام نشد",
      );
    } finally {
      setLoading(false);
    }
  }, [view, months]);
  useEffect(() => {
    void load();
  }, [load]);
  const add = () => {
    if (view === "discounts") return setPromotion("codes");
    if (view === "debtors" || view === "critical" || view === "settings")
      return setDebtCreate(true);
    setCreate(view === "expenses" || view === "reports" ? "expense" : "member");
  };
  const saved = () => {
    setCreate(null);
    setPayment(null);
    void load();
  };
  const content = useMemo(() => {
    if (loading)
      return (
        <div className={styles.loading}>
          <Spinner />
          <span>در حال دریافت اطلاعات...</span>
        </div>
      );
    if (error)
      return (
        <div className={styles.errorState}>
          <b>دریافت اطلاعات انجام نشد</b>
          <p>{error}</p>
          <Button onClick={() => void load()}>تلاش دوباره</Button>
        </div>
      );
    if (view === "home")
      return (
        <Home
          data={data}
          onOpen={setDossier}
          onPay={setPayment}
          onView={setView}
        />
      );
    if (view === "members")
      return <Members data={data} onOpen={setDossier} reload={load} />;
    if (view === "accounting")
      return (
        <Accounting
          data={data}
          months={months}
          setMonths={setMonths}
          reload={load}
          onOpen={setDossier}
          onPay={setPayment}
        />
      );
    if (view === "expenses")
      return (
        <Expenses
          data={data}
          months={months}
          setMonths={setMonths}
          reload={load}
        />
      );
    if (view === "reports")
      return <Reports data={data} onView={(next) => setView(next)} />;
    if (view === "debtors")
      return (
        <DebtorsTable
          standalone
          refreshKey={debtorsRefresh}
          onOpen={setDossier}
          onPay={setPayment}
        />
      );
    if (view === "critical")
      return <CriticalAccounts data={data} reload={load} />;
    if (view === "discounts")
      return <Discounts data={data} onAdd={setPromotion} reload={load} />;
    return <Settings data={data} reload={load} onPromotion={setPromotion} />;
  }, [data, debtorsRefresh, error, load, loading, months, view]);
  return (
    <AppShell
      user={user}
      view={view}
      onView={(next) => {
        setDossier(null);
        setView(next);
      }}
      onAdd={add}
    >
      {dossier ? (
        <Dossier
          id={dossier}
          onClose={() => setDossier(null)}
          onPay={setPayment}
        />
      ) : (
        content
      )}
      {create ? (
        <CreateModal
          kind={create}
          onClose={() => setCreate(null)}
          onSaved={saved}
        />
      ) : null}
      {promotion ? (
        <PromotionModal
          kind={promotion}
          onClose={() => setPromotion(null)}
          onSaved={() => {
            setPromotion(null);
            void load();
          }}
        />
      ) : null}
      {payment ? (
        <PaymentModal
          row={payment}
          onClose={() => setPayment(null)}
          onSaved={saved}
        />
      ) : null}
      {debtCreate ? (
        <AccountingDebtModal
          onClose={() => setDebtCreate(false)}
          onSaved={() => {
            setDebtCreate(false);
            if (view === "critical") void load();
            else setDebtorsRefresh((value) => value + 1);
          }}
        />
      ) : null}
    </AppShell>
  );
}
