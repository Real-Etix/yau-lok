"use client";

// Is a minibus ride happening right now, and where has it got to?
//
// The tracker itself lives in `app/ride/page.tsx` component state, which the
// home screen cannot see. So the ride page publishes a small record while it
// is running and clears it when the ride ends; the home screen reads that.
// Nothing here invents progress — if the record is missing or stale, the
// minibus row simply does not expand.

import { useStored } from "@/lib/prefs";

export type ActiveRide = {
  routeCode: string;
  nextStop: string | null;
  stopsToGo: number | null;
  /** Written on every meaningful change, so a killed tab can be spotted */
  at: number;
};

const KEY = "yau-lok-active-ride";

/**
 * A ride nobody has touched for this long is over — the tab was closed mid
 * journey, or the phone slept through the last stop. Better to drop the
 * expanded card than to show a stale "2 stops to go".
 */
const STALE_MS = 90 * 60 * 1000;

export function useActiveRide() {
  const [ride] = useStored<ActiveRide | null>(KEY, null);
  const fresh = ride !== null && Date.now() - ride.at < STALE_MS;
  return {
    active: fresh,
    routeCode: fresh ? ride.routeCode : null,
    nextStop: fresh ? ride.nextStop : null,
    stopsToGo: fresh ? ride.stopsToGo : null,
  };
}

/** Publish / clear the record. Used by the ride page only. */
export function usePublishActiveRide() {
  const [, setRide] = useStored<ActiveRide | null>(KEY, null);
  return setRide;
}
