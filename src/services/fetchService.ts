// =============================================================
// GymPlus+ — robust data-fetching service
// -------------------------------------------------------------
// ONE fetch layer for the coach app, env-aware:
//
//   production  → real API ONLY (never mock data, same behavior
//                 as the old apiFetch / programFetch for lists).
//   development → two modes for the plan pages, picked by
//                 DEV_PLANS_ALWAYS_MOCK below:
//                    true  → /workout-program & /nutrition-program
//                            render sample data IMMEDIATELY — no
//                            network attempt at all (< 500 ms).
//                    false → try the real API first; fall back to
//                            sample data only when the API is
//                            unreachable, errors (network / 5xx /
//                            timeout), or answers empty.
//                 A 401 is never masked — it clears the session and
//                 redirects to login exactly like the rest of the app.
//
// Mutations (POST/PATCH/PUT/DELETE) always hit the real API — there
// is no mock on writes. Sample data is read-only filler so the UI is
// usable while developing without the backend.
//
// Replaces the previous src/service/fetchService.ts stub, which used
// the wrong base URL / token key and only authorized in production.
// =============================================================

import { handleUnauthorized } from "@/lib/auth-session";

import { buildMockNutritionPlans, buildMockWorkoutPlans } from "./mockProgramData";

export const API_BASE_URL = "https://api.gympluspro.ir/api/v1";
export const AUTH_TOKEN_KEY = "gymplus_access";
export const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * DEVELOPMENT quick-start toggle for the coach plan pages.
 * -----------------------------------------------------------
 * true  → while developing, the Workout Program / Nutrition Program
 *         pages skip the network entirely and show sample data at
 *         once (no 30–60 s wait when the backend is offline).
 * false → development hits the real API first and falls back to the
 *         sample data only on failure / empty list (the normal mode).
 *
 * Read ONLY in development — this constant has zero effect when the
 * app is built/run as production (production is always real API).
 * Flip the value and save; the dev server hot-reloads instantly.
 */
const DEV_PLANS_ALWAYS_MOCK = false;

export type ProgramKind = "workout" | "nutrition";

const PLAN_LIST_ENDPOINT: Record<ProgramKind, string> = {
  workout: "/plans/",
  nutrition: "/nutrition-plans/",
};

/** Error thrown for any HTTP failure (kept API-compatible with ApiRequestError). */
export class FetchServiceError extends Error {
  readonly path: string;
  readonly status: number;
  readonly payload: unknown;

  constructor(path: string, status: number, payload?: unknown) {
    super(`API ${path} failed: ${status}`);
    this.name = "FetchServiceError";
    this.path = path;
    this.status = status;
    this.payload = payload;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

function toBody(body?: BodyInit | null): { body?: BodyInit; contentType?: boolean } {
  if (body == null) return {};
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return { body, contentType: false };
  }
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return { body, contentType: false };
  }
  return { body: JSON.stringify(body), contentType: true };
}

/**
 * Core request — identical auth/error semantics to the app's apiFetch
 * (Bearer token in dev AND prod, 401 → session cleared + /login).
 * No mock fallback here; write paths and real reads use this.
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const { body, contentType } = toBody(init?.body);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      ...(body !== undefined ? { body } : {}),
      headers: {
        ...(contentType ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch (networkError) {
    // Network down / DNS / CORS — propagate; the plan-list getter uses
    // this as a dev fallback trigger, writes just surface it.
    throw networkError;
  }

  if (handleUnauthorized(response.status)) {
    throw new Error("UNAUTHORIZED");
  }

  if (!response.ok) {
    const rawText = await response.text();
    let payload: unknown = rawText;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      // keep the plain-text body available for error mappers
    }
    throw new FetchServiceError(path, response.status, payload);
  }

  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// ------------------------------------------------------------------
// HTTP verbs (mutations — always real, never mocked)
// ------------------------------------------------------------------

export function get<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, method: "GET" });
}

export function post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, method: "POST", body: body as BodyInit });
}

export function put<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, method: "PUT", body: body as BodyInit });
}

export function patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, method: "PATCH", body: body as BodyInit });
}

export function del<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, method: "DELETE" });
}

// ------------------------------------------------------------------
// Plan-list reads — real-first, dev-only mock fallback
// ------------------------------------------------------------------

/** true when a list payload holds zero rows (array or { results: [] }). */
function isEmptyList(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === "object") {
    const results = (value as { results?: unknown }).results;
    return Array.isArray(results) && results.length === 0;
  }
  return false;
}

function isUnauthorized(reason: unknown): boolean {
  return reason instanceof Error && reason.message === "UNAUTHORIZED";
}

function samplePlans<T>(kind: ProgramKind): T {
  return (kind === "nutrition" ? buildMockNutritionPlans() : buildMockWorkoutPlans()) as unknown as T;
}

/**
 * GET a coach's plan list with environment-aware fallback:
 *  - production: real API only (network/HTTP errors reject, exactly
 *    like the previous apiFetch / programFetch call).
 *  - development + DEV_PLANS_ALWAYS_MOCK=true: sample data instantly,
 *    no network attempt (fast offline dev).
 *  - development + DEV_PLANS_ALWAYS_MOCK=false: real API first; if it
 *    fails (network/5xx/timeout) or returns an empty list → return
 *    sample data. A 401 is rethrown so the session-expiry → login
 *    flow is never hidden.
 */
export async function fetchPlanList<T = unknown>(kind: ProgramKind = "workout"): Promise<T> {
  if (!IS_PRODUCTION && DEV_PLANS_ALWAYS_MOCK) {
    return samplePlans<T>(kind);
  }

  const path = PLAN_LIST_ENDPOINT[kind];

  let data: T;
  try {
    data = await get<T>(path);
  } catch (reason) {
    if (IS_PRODUCTION) throw reason;
    if (isUnauthorized(reason)) throw reason;
    return samplePlans<T>(kind);
  }

  if (IS_PRODUCTION) return data;
  if (isEmptyList(data as unknown)) return samplePlans<T>(kind);
  return data;
}

/** Coach workout plans — production real-only; dev real-first then sample. */
export function fetchWorkoutPlans<T = unknown>(): Promise<T> {
  return fetchPlanList<T>("workout");
}

/** Coach nutrition plans — production real-only; dev real-first then sample. */
export function fetchNutritionPlans<T = unknown>(): Promise<T> {
  return fetchPlanList<T>("nutrition");
}
