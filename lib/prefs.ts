"use client";

// Local preferences and saved routes. Deliberately localStorage-only: these
// are personal, tiny, and must work with no signal (§5/07 promises the saved
// list is usable offline).

import { useCallback, useRef, useSyncExternalStore } from "react";

export type SavedRoute = {
  id: string;
  routeCode: string;
  company: string;
  from: string;
  to: string;
  /** e.g. "返工 · 平日 08:10" */
  note?: string;
  fare?: number;
  minutes?: number;
  /** Boarding stop coordinates, so saved routes can show a live ETA */
  originLat?: number;
  originLng?: number;
};

const KEYS = {
  saved: "yau-lok-saved",
  recent: "yau-lok-recent",
  alertM: "yau-lok-alert-distance",
  vibrate: "yau-lok-vibrate",
  coach: "yau-lok-coach",
  voice: "yau-lok-voice",
} as const;

// Every mounted reader of a key is notified on write, so the coach toggle in
// the ride header and the same switch on the settings screen stay in step.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Another tab writing the same key counts as a change too.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

// useSyncExternalStore demands a referentially stable snapshot, so parsed
// values are cached until the underlying raw string actually changes.
const cache = new Map<string, { raw: string | null; parsed: unknown }>();

function snapshot<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return fallback;
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.parsed as T;
  let parsed = fallback;
  if (raw !== null) {
    try {
      parsed = JSON.parse(raw) as T;
    } catch {
      parsed = fallback;
    }
  }
  cache.set(key, { raw, parsed });
  return parsed;
}

/** A piece of local state that survives reloads and stays in sync across views. */
export function useStored<T>(key: string, fallback: T) {
  // Freeze the fallback so object/array defaults don't change identity between
  // renders — the server snapshot has to be stable.
  const fallbackRef = useRef(fallback);
  const value = useSyncExternalStore(
    subscribe,
    () => snapshot(key, fallbackRef.current),
    () => fallbackRef.current,
  );
  const update = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Quota or private mode — reflect the choice for this session anyway.
        cache.set(key, { raw: cache.get(key)?.raw ?? null, parsed: next });
      }
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [value, update] as const;
}

export function useSavedRoutes() {
  const [saved, setSaved] = useStored<SavedRoute[]>(KEYS.saved, []);
  const [recent, setRecent] = useStored<SavedRoute[]>(KEYS.recent, []);

  const isSaved = useCallback(
    (routeCode: string, company: string) =>
      saved.some((r) => r.routeCode === routeCode && r.company === company),
    [saved],
  );

  const toggle = useCallback(
    (route: SavedRoute) => {
      const exists = saved.some(
        (r) => r.routeCode === route.routeCode && r.company === route.company,
      );
      setSaved(
        exists
          ? saved.filter(
              (r) =>
                !(r.routeCode === route.routeCode && r.company === route.company),
            )
          : [...saved, route],
      );
    },
    [saved, setSaved],
  );

  const remember = useCallback(
    (route: SavedRoute) => {
      const rest = recent.filter(
        (r) => !(r.routeCode === route.routeCode && r.company === route.company),
      );
      setRecent([route, ...rest].slice(0, 6));
    },
    [recent, setRecent],
  );

  return { saved, recent, isSaved, toggle, remember };
}

export const ALERT_DISTANCES = [200, 300, 400, 600] as const;

export function useAlertSettings() {
  const [distanceM, setDistanceM] = useStored<number>(KEYS.alertM, 400);
  const [vibrate, setVibrate] = useStored<boolean>(KEYS.vibrate, true);
  const [coach, setCoach] = useStored<boolean>(KEYS.coach, true);
  return { distanceM, setDistanceM, vibrate, setVibrate, coach, setCoach };
}

/** The chosen HKGAI Cantonese voice, shared by the ride and settings screens. */
export function usePersona(fallbackKey: string) {
  return useStored<string>(KEYS.voice, fallbackKey);
}

/**
 * A half-written 影餐牌 order.
 *
 * Kept so the four steps survive a reload and the back button: someone
 * standing in a busy 茶餐廳 should not lose their order because the phone
 * locked. The photo is NOT here — only its IndexedDB key (see lib/menu-photo).
 */
export type OrderLine = {
  /** RecognisedItem.id, or a CCT_MENU id when the user picked manually */
  itemId: string;
  zh: string;
  tweaks: string[];
  /** Free text when `custom` is among the tweaks */
  customChit?: string;
  /** Undefined means the OCR never read one — the user is asked instead */
  price?: number;
  hot?: boolean;
};

export type ScanDraft = {
  photoId: string | null;
  items: import("@/lib/toolhub").RecognisedItem[];
  order: OrderLine[];
  table?: string;
  /** Which recognised line the user is editing, if any */
  editingId?: string | null;
};

const EMPTY_DRAFT: ScanDraft = { photoId: null, items: [], order: [] };

export function useScanDraft() {
  const [draft, setDraft] = useStored<ScanDraft>("yau-lok-scan-draft", EMPTY_DRAFT);
  return { draft, setDraft, clearDraft: () => setDraft(EMPTY_DRAFT) };
}
