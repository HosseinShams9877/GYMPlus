const PERSIAN_DATE_LOCALE = "fa-IR-u-ca-persian";

function parseDate(value: unknown) {
  if (!value) return null;
  const raw = String(value);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T12:00:00`)
    : new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatPersianDate(value: unknown, fallback = "-") {
  const parsed = parseDate(value);
  return parsed
    ? new Intl.DateTimeFormat(PERSIAN_DATE_LOCALE, { year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed)
    : fallback;
}

export function formatPersianDateTime(value: unknown, fallback = "-") {
  const parsed = parseDate(value);
  return parsed
    ? new Intl.DateTimeFormat(PERSIAN_DATE_LOCALE, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(parsed)
    : fallback;
}

export function todayApiDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function dateInputProps() {
  return {
    lang: "fa-IR-u-ca-persian",
    dir: "rtl" as const,
    "data-calendar": "persian",
  };
}
