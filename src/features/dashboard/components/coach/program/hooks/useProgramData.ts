"use client";

// =============================================================
// GymPlus+ Coach — program data hook
// Follows the coach-dashboard apiFetch + Bearer(gymplus_access)
// conventions. Program plans hit the LIVE endpoints that already
// exist (/plans/, /nutrition-plans/, ...). The new /coach/*
// reference endpoints are expected-but-optional: when they are
// not reachable yet the UI degrades to rich local defaults and
// keeps editing in-memory (offline banner shown).
// =============================================================

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  BANK_ITEM_DEFAULTS,
  BankItem,
  DEFAULT_EQUIPMENT,
  DEFAULT_EXERCISE_BANK,
  DEFAULT_FOOD_BANK,
  DEFAULT_REFERENCE,
  ExecUnitItem,
  PlanMode,
  ProgramDay,
  ProgramDomain,
  ProgramDraft,
  ProgramFoodItem,
  ProgramMeal,
  RefItem,
  StructureItem,
  UnitRefItem,
  freshKey,
  goalOfMode,
} from "../program.types";

const API_BASE = "https://api.gympluspro.ir/api/v1";

export function getProgramToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("gymplus_access");
}

export class ProgramApiError extends Error {
  readonly status: number;
  constructor(path: string, status: number) {
    super(`API ${path} failed: ${status}`);
    this.name = "ProgramApiError";
    this.status = status;
  }
}

/** Mirror of coach apiFetch (no request spinner events to avoid double counting). */
export async function programFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getProgramToken();
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (response.status === 401) {
    window.location.href = "/login";
    throw new ProgramApiError(path, 401);
  }
  if (!response.ok) {
    throw new ProgramApiError(path, response.status);
  }
  if (response.status === 204 || response.status === 205) return undefined as T;
  return (await response.json()) as T;
}

export function programToast(message: string, tone: "success" | "error" | "info" = "info") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("gymplus:coach-toast", { detail: { message, tone } }));
  }
}

// -------------------------------------------------------------
// Server plan shapes (subset of the live plan payloads)
// -------------------------------------------------------------

export type ServerExercise = { id?: number; name: string; sets: number; reps: number; note?: string; day?: number };
export type ServerWorkoutDay = { id?: number; plan?: number; index: number; name?: string; exercises?: ServerExercise[] };
export type ServerWorkoutPlan = {
  id: number;
  title: string;
  goal?: string;
  athlete?: number | null;
  athlete_name?: string | null;
  sent_at?: string | null;
  duration_weeks?: number;
  days_count?: number;
  days?: ServerWorkoutDay[];
};

export type ServerFoodItem = { id?: number; meal?: number; food?: number | null; name: string; amount_g: number; note?: string };
export type ServerMeal = { id?: number; plan?: number; kind?: string; index: number; name: string; items?: ServerFoodItem[] };
export type ServerNutritionPlan = {
  id: number;
  title: string;
  goal?: string;
  athlete?: number | null;
  athlete_name?: string | null;
  sent_at?: string | null;
  duration_weeks?: number;
  is_template?: boolean;
  meals?: ServerMeal[];
};

// -------------------------------------------------------------
// Generic item list helper (used for groups / units / equipment)
// -------------------------------------------------------------

export type PlainRef = { id?: number; name: string; code?: string; disabled?: boolean; is_default?: boolean };

function plainToRef(raw: PlainRef, fallback: string): RefItem & { code?: string } {
  return {
    key: String(raw.id ?? freshKey(fallback)),
    name: raw.name,
    id: raw.id,
    code: raw.code,
    disabled: Boolean(raw.disabled),
    isDefault: raw.is_default === true,
  };
}

function refBody(item: RefItem | ExecUnitItem | UnitRefItem): Record<string, unknown> {
  const body: Record<string, unknown> = { name: item.name, disabled: item.disabled === true };
  if ("code" in item && (item as { code?: string }).code) body.code = (item as { code?: string }).code;
  return body;
}

// -------------------------------------------------------------
// The store
// -------------------------------------------------------------

export type ReferenceState = {
  groups: RefItem[];
  units: (ExecUnitItem | UnitRefItem)[];
  equipment: RefItem[];
  structure: StructureItem[];
  bank: BankItem[];
  /** true when at least one /coach/* endpoint answered — otherwise edits stay local. */
  online: boolean;
  /** true while a full refresh is in flight */
  loading: boolean;
};

// -------------------------------------------------------------
// Offline bank mirror (localStorage)
// The /coach/* bank endpoint may be offline for the whole demo; to
// honor "داده بعد از رفرش می‌ماند", every bank change is mirrored
// to localStorage and emptyReference() re-hydrates from it before
// showing the sample bank. When the endpoint answers, its rows win.
// -------------------------------------------------------------

const BANK_MIRROR_KEY = (domain: ProgramDomain) => `gymplus:program-bank:v1:${domain}`;

function readBankMirror(domain: ProgramDomain): BankItem[] | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(BANK_MIRROR_KEY(domain));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const items = parsed.filter((item): item is BankItem => Boolean(item) && typeof (item as { name?: unknown }).name === "string");
    return items.length ? items : null;
  } catch {
    return null;
  }
}

function writeBankMirror(domain: ProgramDomain, items: BankItem[]) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(BANK_MIRROR_KEY(domain), JSON.stringify(items));
  } catch {
    /* storage full / private mode — in-memory only */
  }
}

function emptyReference(domain: ProgramDomain): ReferenceState {
  const seedBank = domain === "workout" ? DEFAULT_EXERCISE_BANK : DEFAULT_FOOD_BANK;
  return {
    groups: DEFAULT_REFERENCE[domain].groups.map((item) => ({ ...item })),
    units: DEFAULT_REFERENCE[domain].units.map((item) => ({ ...item })),
    equipment: (domain === "workout" ? DEFAULT_EQUIPMENT : []).map((item) => ({ ...item })),
    structure: DEFAULT_REFERENCE[domain].structure.map((item) => ({ ...item, tags: [...item.tags] })),
    // sample bank until the /coach/* bank endpoint is reachable (offline/demo mode)
    bank: seedBank.map((item) => ({ ...item, goals: [...(item.goals ?? [])] })),
    online: false,
    loading: false,
  };
}

type DomainConfig = {
  groupsPath: string;
  unitsPath: string;
  equipmentPath: string | null;
  bankPath: string;
};

const CONFIG: Record<ProgramDomain, DomainConfig> = {
  workout: {
    groupsPath: "/coach/muscle-groups/",
    unitsPath: "/coach/execution-units/",
    equipmentPath: "/coach/equipment/",
    bankPath: "/coach/exercise-bank/",
  },
  nutrition: {
    groupsPath: "/coach/food-categories/",
    unitsPath: "/coach/measurement-units/",
    equipmentPath: null,
    bankPath: "/coach/food-bank/",
  },
};

async function tryPaginated<T>(path: string): Promise<T[] | null> {
  try {
    const data = await programFetch<{ count?: number; results?: T[] } | T[]>(path);
    if (Array.isArray(data)) return data;
    return data?.results ?? [];
  } catch {
    return null; // endpoint not ready yet → offline fallback
  }
}

const BANK_GOAL_WORDS: Record<string, PlanMode> = {
  volume: "volume", hypertrophy: "volume", strength: "volume", gain: "volume", حجم: "volume",
  cut: "cut", loss: "cut", fat: "cut", کات: "cut", کاهش: "cut",
  neutral: "neutral", maintenance: "neutral", fitness: "neutral", خنثی: "neutral",
};

function parseGoals(raw: unknown): PlanMode[] {
  if (raw == null) return [];
  const value = String(raw).toLowerCase();
  const goals: PlanMode[] = [];
  for (const word of value.split(/[\s,،;|]/)) {
    const mode = BANK_GOAL_WORDS[word];
    if (mode && !goals.includes(mode)) goals.push(mode);
  }
  return goals;
}

export function useProgramData(kind: ProgramDomain) {
  const config = CONFIG[kind];
  const [state, setState] = useState<ReferenceState>(() => emptyReference(kind));
  const [busy, setBusy] = useState(false);

  const referenceLoad = useCallback(async () => {
    setBusy(true);
    const defaults = emptyReference(kind);
    const [groups, units, equipment, bank] = await Promise.all([
      tryPaginated<PlainRef>(config.groupsPath),
      tryPaginated<PlainRef>(config.unitsPath),
      config.equipmentPath ? tryPaginated<PlainRef>(config.equipmentPath) : Promise.resolve(null),
      tryPaginated<{ id?: number; name: string; unit?: string; unit_code?: string; group?: unknown; category?: unknown; equipment?: unknown; goals?: unknown; disabled?: boolean; kcal100?: number; note?: string }>(config.bankPath),
    ]);

    const online = groups !== null || units !== null || equipment !== null || bank !== null;

    if (!online) {
      programToast("وب‌سرویس راه‌اندازی نشده است؛ از داده‌های نمونه استفاده می‌شود.", "info");
    }

    // bank endpoint missing → hydrate the offline mirror (last session's edits)
    // before falling back to the sample/default bank.
    const bankFallback = bank === null ? readBankMirror(kind) : null;

    const groupMap = new Map<string, string>(); // name → local key (server may reference by id or name)
    const resolvedGroups: RefItem[] =
      groups === null
        ? defaults.groups
        : groups.map((raw) => {
            const item = plainToRef(raw, "group");
            groupMap.set(String(raw.id ?? raw.name), item.key);
            groupMap.set(raw.name, item.key);
            return item;
          });

    const resolveKey = (raw: unknown): string => {
      if (raw == null || raw === "") return "";
      return groupMap.get(String(raw)) ?? String(raw);
    };

    const resolvedUnits: (ExecUnitItem | UnitRefItem)[] =
      units === null
        ? defaults.units
        : units.map((raw) => plainToRef(raw, "unit") as ExecUnitItem | UnitRefItem);

    const resolvedEquipment: RefItem[] =
      equipment === null
        ? defaults.equipment
        : equipment.map((raw) => plainToRef(raw, "equip"));

    const resolvedBank: BankItem[] =
      bank === null
        ? []
        : bank.map((raw) => ({
            key: String(raw.id ?? freshKey("bank")),
            name: raw.name,
            id: raw.id,
            unit: raw.unit_code ?? raw.unit ?? "",
            group: resolveKey(raw.group),
            category: resolveKey(raw.category),
            equipment: raw.equipment != null ? String(raw.equipment) : "",
            goals: parseGoals(raw.goals),
            kcal100: raw.kcal100,
            disabled: Boolean(raw.disabled),
            note: raw.note,
          }));

    setState((current) => ({
      groups: resolvedGroups,
      units: resolvedUnits,
      equipment: resolvedEquipment,
      structure: current.structure.length ? current.structure : defaults.structure,
      // bank endpoint reachable (even if empty) → trust server; missing → mirror, else sample bank
      bank: bank !== null ? resolvedBank : bankFallback && bankFallback.length ? bankFallback : current.bank.length ? current.bank : defaults.bank,
      online,
      loading: false,
    }));
    setBusy(false);
    return online;
  }, [config, kind]);

  useEffect(() => {
    void referenceLoad();
  }, [referenceLoad]);

  // mirror every bank change to localStorage so offline edits survive a refresh
  useEffect(() => {
    if (!state.bank.length) return;
    writeBankMirror(kind, state.bank);
  }, [state.bank, kind]);

  // ------------------------------------------------ group mutations
  const touchList = useCallback(
    (patch: (current: ReferenceState) => ReferenceState) => {
      setState((current) => patch(current));
    },
    [],
  );

  const groupAddMany = useCallback(
    async (names: string[]) => {
      const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
      if (!unique.length) return;
      const created: RefItem[] = [];
      for (const name of unique) {
        const item: RefItem = { key: freshKey("grp"), name };
        if (state.online) {
          try {
            const saved = await programFetch<PlainRef>(config.groupsPath, { method: "POST", body: JSON.stringify({ name }) });
            item.id = saved?.id;
          } catch {
            /* keep local */
          }
        }
        created.push(item);
      }
      touchList((current) => ({ ...current, groups: [...current.groups, ...created] }));
    },
    [config.groupsPath, state.online, touchList],
  );

  const groupRename = useCallback(
    async (key: string, name: string) => {
      const item = state.groups.find((entry) => entry.key === key);
      if (!item) return;
      touchList((current) => ({
        ...current,
        groups: current.groups.map((entry) => (entry.key === key ? { ...entry, name } : entry)),
        // rename migrates bank rows tagged with this group
        bank: current.bank.map((row) => (row.group === key ? { ...row } : row)),
      }));
      if (state.online && item.id) {
        try {
          await programFetch(`${config.groupsPath}${item.id}/`, { method: "PATCH", body: JSON.stringify({ name }) });
        } catch {
          /* keep local */
        }
      }
    },
    [config.groupsPath, state.groups, state.online, touchList],
  );

  const groupSetDisabled = useCallback(
    async (key: string, disabled: boolean) => {
      const item = state.groups.find((entry) => entry.key === key);
      touchList((current) => ({
        ...current,
        groups: current.groups.map((entry) => (entry.key === key ? { ...entry, disabled } : entry)),
      }));
      if (state.online && item?.id) {
        try {
          await programFetch(`${config.groupsPath}${item.id}/`, { method: "PATCH", body: JSON.stringify({ disabled }) });
        } catch {
          /* keep local */
        }
      }
    },
    [config.groupsPath, state.groups, state.online, touchList],
  );

  const groupDelete = useCallback(
    async (key: string) => {
      const item = state.groups.find((entry) => entry.key === key);
      touchList((current) => ({ ...current, groups: current.groups.filter((entry) => entry.key !== key) }));
      if (state.online && item?.id) {
        try {
          await programFetch(`${config.groupsPath}${item.id}/`, { method: "DELETE" });
        } catch {
          /* keep local */
        }
      }
    },
    [config.groupsPath, state.groups, state.online, touchList],
  );

  const unitAddMany = useCallback(
    async (names: string[]) => {
      const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
      if (!unique.length) return;
      const created: (ExecUnitItem | UnitRefItem)[] = [];
      for (const rawName of unique) {
        const code = rawName.replaceAll(" ", "-").toLowerCase();
        const item: ExecUnitItem | UnitRefItem = kind === "workout" ? { key: freshKey("unit"), code, name: rawName } : { key: freshKey("unit"), code, name: rawName, grams: kind === "nutrition" ? 0 : undefined };
        if (state.online) {
          try {
            const saved = await programFetch<PlainRef>(config.unitsPath, { method: "POST", body: JSON.stringify({ name: rawName, code }) });
            item.id = saved?.id;
          } catch {
            /* keep local */
          }
        }
        created.push(item);
      }
      touchList((current) => ({ ...current, units: [...current.units, ...created] }));
    },
    [config.unitsPath, kind, state.online, touchList],
  );

  const unitSetDisabled = useCallback(
    async (key: string, disabled: boolean) => {
      const item = state.units.find((entry) => entry.key === key);
      touchList((current) => ({
        ...current,
        units: current.units.map((entry) => (entry.key === key ? { ...entry, disabled } : entry)),
      }));
      if (state.online && item?.id) {
        try {
          await programFetch(`${config.unitsPath}${item.id}/`, { method: "PATCH", body: JSON.stringify({ disabled }) });
        } catch {
          /* keep local */
        }
      }
    },
    [config.unitsPath, state.online, state.units, touchList],
  );

  const unitSetGrams = useCallback(
    (key: string, grams: number) => {
      touchList((current) => ({
        ...current,
        units: current.units.map((entry) => (entry.key === key ? { ...entry, grams } : entry)),
      }));
    },
    [touchList],
  );

  const unitDelete = useCallback(
    async (key: string) => {
      const item = state.units.find((entry) => entry.key === key);
      touchList((current) => ({ ...current, units: current.units.filter((entry) => entry.key !== key) }));
      if (state.online && item?.id) {
        try {
          await programFetch(`${config.unitsPath}${item.id}/`, { method: "DELETE" });
        } catch {
          /* keep local */
        }
      }
    },
    [config.unitsPath, state.online, state.units, touchList],
  );

  const equipmentAddMany = useCallback(
    async (names: string[]) => {
      const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
      if (!unique.length || !config.equipmentPath) return;
      const created: RefItem[] = [];
      for (const name of unique) {
        const item: RefItem = { key: freshKey("equip"), name };
        if (state.online) {
          try {
            const saved = await programFetch<PlainRef>(config.equipmentPath, { method: "POST", body: JSON.stringify({ name }) });
            item.id = saved?.id;
          } catch {
            /* keep local */
          }
        }
        created.push(item);
      }
      touchList((current) => ({ ...current, equipment: [...current.equipment, ...created] }));
    },
    [config.equipmentPath, state.online, touchList],
  );

  const equipmentDelete = useCallback(
    async (key: string) => {
      const item = state.equipment.find((entry) => entry.key === key);
      touchList((current) => ({ ...current, equipment: current.equipment.filter((entry) => entry.key !== key) }));
      if (state.online && item?.id && config.equipmentPath) {
        try {
          await programFetch(`${config.equipmentPath}${item.id}/`, { method: "DELETE" });
        } catch {
          /* keep local */
        }
      }
    },
    [config.equipmentPath, state.online, state.equipment, touchList],
  );

  const structureUpdate = useCallback(
    (structure: StructureItem[]) => {
      touchList((current) => ({ ...current, structure }));
    },
    [touchList],
  );

  // ------------------------------------------------ bank mutations
  const bankAdd = useCallback(
    async (names: string[], defaults: Partial<BankItem>) => {
      const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
      if (!unique.length) return 0;
      let added = 0;
      for (const name of unique) {
        const item: BankItem = { ...BANK_ITEM_DEFAULTS[kind](), name, ...defaults, goals: defaults.goals?.length ? defaults.goals : [] };
        if (state.online) {
          try {
            const saved = await programFetch<{ id?: number }>(config.bankPath, {
              method: "POST",
              body: JSON.stringify({ name, unit: item.unit, group: item.group, category: item.category, goals: item.goals }),
            });
            item.id = saved?.id;
            added += 1;
          } catch {
            added += 1; // still added locally
          }
        } else {
          added += 1;
        }
        // capture the live lists once per add to reuse keys
        setState((current) => ({ ...current, bank: [...current.bank, item] }));
      }
      return added;
    },
    [config.bankPath, kind, state.online],
  );

  const bankUpdate = useCallback(
    async (key: string, patch: Partial<BankItem>) => {
      const item = state.bank.find((entry) => entry.key === key);
      setState((current) => ({
        ...current,
        bank: current.bank.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry)),
      }));
      if (state.online && item?.id) {
        try {
          await programFetch(`${config.bankPath}${item.id}/`, { method: "PATCH", body: JSON.stringify(patch as Record<string, unknown>) });
        } catch {
          /* keep local */
        }
      }
    },
    [config.bankPath, state.bank, state.online],
  );

  const bankDeleteMany = useCallback(
    async (keys: string[]) => {
      const keySet = new Set(keys);
      const items = state.bank.filter((entry) => keySet.has(entry.key));
      setState((current) => ({ ...current, bank: current.bank.filter((entry) => !keySet.has(entry.key)) }));
      if (state.online) {
        for (const item of items) {
          if (!item.id) continue;
          try {
            await programFetch(`${config.bankPath}${item.id}/`, { method: "DELETE" });
          } catch {
            /* keep local */
          }
        }
      }
    },
    [config.bankPath, state.bank, state.online],
  );

  // ------------------------------------------------ plan persistence (live endpoints)
  const saveDraft = useCallback(
    async (
      draft: ProgramDraft,
      snapshot?: { workout?: ServerWorkoutPlan; nutrition?: ServerNutritionPlan },
    ): Promise<{ id: number }> => {
      if (draft.domain === "workout") {
        return saveWorkoutPlan(draft as ProgramDraft & { structure: ProgramDay[] }, snapshot?.workout);
      }
      return saveNutritionPlan(draft as ProgramDraft & { structure: ProgramMeal[] }, snapshot?.nutrition);
    },
    [],
  );

  const sendPlan = useCallback(
    async (kind: ProgramDomain, planId: number, athlete: number, weeks: number) => {
      const base = kind === "workout" ? "/plans/" : "/nutrition-plans/";
      await programFetch(`${base}${planId}/assign/`, { method: "POST", body: JSON.stringify({ athlete }) });
      await programFetch(`${base}${planId}/send/`, { method: "POST", body: JSON.stringify({ duration_weeks: weeks }) });
    },
    [],
  );

  const deletePlan = useCallback(async (kind: ProgramDomain, planId: number) => {
    const base = kind === "workout" ? "/plans/" : "/nutrition-plans/";
    await programFetch(`${base}${planId}/`, { method: "DELETE" });
  }, []);

  const api = useMemo(
    () => ({
      state,
      busy,
      online: state.online,
      refresh: referenceLoad,
      groupAddMany,
      groupRename,
      groupSetDisabled,
      groupDelete,
      unitAddMany,
      unitSetDisabled,
      unitSetGrams,
      unitDelete,
      equipmentAddMany,
      equipmentDelete,
      structureUpdate,
      bankAdd,
      bankUpdate,
      bankDeleteMany,
      saveDraft,
      sendPlan,
      deletePlan,
    }),
    [
      state,
      busy,
      referenceLoad,
      groupAddMany,
      groupRename,
      groupSetDisabled,
      groupDelete,
      unitAddMany,
      unitSetDisabled,
      unitSetGrams,
      unitDelete,
      equipmentAddMany,
      equipmentDelete,
      structureUpdate,
      bankAdd,
      bankUpdate,
      bankDeleteMany,
      saveDraft,
      sendPlan,
      deletePlan,
    ],
  );

  return api;
}

// -------------------------------------------------------------
// Workout plan save (creates days + exercises like the monolith)
// -------------------------------------------------------------

async function saveWorkoutPlan(draft: ProgramDraft & { structure: ProgramDay[] }, snapshot?: ServerWorkoutPlan): Promise<{ id: number }> {
  const payload = {
    title: draft.title,
    athlete: draft.athlete ?? null,
    goal: goalOfMode("workout", draft.mode),
    days_count: draft.structure.length,
    duration_weeks: draft.durationWeeks,
  };

  let planId: number;
  if (draft.id) {
    await programFetch(`/plans/${draft.id}/`, { method: "PATCH", body: JSON.stringify(payload) });
    planId = draft.id;
  } else {
    const plan = await programFetch<{ id: number }>("/plans/", { method: "POST", body: JSON.stringify(payload) });
    planId = plan.id;
  }

  const snapshotDays = snapshot?.days ?? [];
  const removedDays = snapshotDays.filter((day) => !draft.structure.some((row) => row.serverId === day.id)).map((day) => day.id).filter((id): id is number => id != null);

  for (const day of removedDays) {
    try {
      await programFetch(`/workout-days/${day}/`, { method: "DELETE" });
    } catch {
      /* skip */
    }
  }

  for (let index = 0; index < draft.structure.length; index += 1) {
    const day = draft.structure[index];
    const source = snapshotDays.find((row) => row.id === day.serverId);
    let dayId = day.serverId ?? source?.id;
    if (dayId) {
      try {
        await programFetch(`/workout-days/${dayId}/`, { method: "PATCH", body: JSON.stringify({ index: index + 1, name: day.name }) });
      } catch {
        dayId = undefined;
      }
    }
    if (!dayId) {
      const created = await programFetch<{ id: number }>("/workout-days/", { method: "POST", body: JSON.stringify({ plan: planId, index: index + 1, name: day.name }) });
      dayId = created.id;
      day.serverId = created.id; // remember it so a retry PATCHes instead of re-creating
    }

    const sourceExercises = source?.exercises ?? [];
    const removedExercises = sourceExercises
      .filter((exercise) => !day.exercises.some((row) => row.serverId === exercise.id))
      .map((exercise) => exercise.id)
      .filter((id): id is number => id != null);
    for (const exerciseId of removedExercises) {
      try {
        await programFetch(`/exercises/${exerciseId}/`, { method: "DELETE" });
      } catch {
        /* skip */
      }
    }

    for (const exercise of day.exercises) {
      if (!exercise.name.trim()) continue;
      const body = JSON.stringify({ day: dayId, name: exercise.name, sets: exercise.sets, reps: exercise.reps, note: exercise.note || "" });
      if (exercise.serverId && sourceExercises.some((row) => row.id === exercise.serverId)) {
        try {
          await programFetch(`/exercises/${exercise.serverId}/`, { method: "PATCH", body });
          continue;
        } catch {
          /* fall through to create */
        }
      }
      const createdExercise = await programFetch<{ id?: number }>("/exercises/", { method: "POST", body });
      if (createdExercise?.id) exercise.serverId = createdExercise.id; // retry-safe
    }
  }
  return { id: planId };
}

// -------------------------------------------------------------
// Nutrition plan save
// -------------------------------------------------------------

async function saveNutritionPlan(draft: ProgramDraft & { structure: ProgramMeal[] }, snapshot?: ServerNutritionPlan): Promise<{ id: number }> {
  const payload = {
    title: draft.title,
    athlete: draft.athlete ?? null,
    goal: goalOfMode("nutrition", draft.mode),
    duration_weeks: draft.durationWeeks,
  };

  let planId: number;
  if (draft.id) {
    await programFetch(`/nutrition-plans/${draft.id}/`, { method: "PATCH", body: JSON.stringify(payload) });
    planId = draft.id;
  } else {
    const plan = await programFetch<{ id: number }>("/nutrition-plans/", { method: "POST", body: JSON.stringify(payload) });
    planId = plan.id;
  }

  const snapshotMeals = snapshot?.meals ?? [];
  const removedMeals = snapshotMeals.filter((meal) => !draft.structure.some((row) => row.serverId === meal.id)).map((meal) => meal.id).filter((id): id is number => id != null);
  for (const mealId of removedMeals) {
    try {
      await programFetch(`/nutrition-meals/${mealId}/`, { method: "DELETE" });
    } catch {
      /* skip */
    }
  }

  for (let index = 0; index < draft.structure.length; index += 1) {
    const meal = draft.structure[index];
    const source = snapshotMeals.find((row) => row.id === meal.serverId);
    let mealId = meal.serverId ?? source?.id;
    if (mealId) {
      try {
        await programFetch(`/nutrition-meals/${mealId}/`, { method: "PATCH", body: JSON.stringify({ kind: meal.kind, index: index + 1, name: meal.name }) });
      } catch {
        mealId = undefined;
      }
    }
    if (!mealId) {
      const created = await programFetch<{ id: number }>("/nutrition-meals/", { method: "POST", body: JSON.stringify({ plan: planId, kind: meal.kind, index: index + 1, name: meal.name }) });
      mealId = created.id;
      meal.serverId = created.id; // remember it so a retry PATCHes instead of re-creating
    }

    const sourceItems = source?.items ?? [];
    const removedItems = sourceItems
      .filter((item) => !meal.items.some((row) => row.serverId === item.id))
      .map((item) => item.id)
      .filter((id): id is number => id != null);
    for (const itemId of removedItems) {
      try {
        await programFetch(`/nutrition-meal-items/${itemId}/`, { method: "DELETE" });
      } catch {
        /* skip */
      }
    }

    for (const item of meal.items) {
      if (!item.name.trim()) continue;
      const amountGrams = item.grams > 0 ? item.grams : item.amount;
      const body = JSON.stringify({ meal: mealId, food: item.bankKey ? null : null, name: item.name, amount_g: amountGrams, note: item.note || "" });
      if (item.serverId && sourceItems.some((row) => row.id === item.serverId)) {
        try {
          await programFetch(`/nutrition-meal-items/${item.serverId}/`, { method: "PATCH", body });
          continue;
        } catch {
          /* fall through to create */
        }
      }
      const createdItem = await programFetch<{ id?: number }>("/nutrition-meal-items/", { method: "POST", body });
      if (createdItem?.id) item.serverId = createdItem.id; // retry-safe
    }
  }
  return { id: planId };
}

// convenience: used to import defaults within components
export { DEFAULT_REFERENCE as REFERENCE_DEFAULTS };
