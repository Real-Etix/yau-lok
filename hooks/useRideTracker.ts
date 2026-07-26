"use client";

import { useMemo } from "react";
import { haversineMeters, type LatLng } from "@/lib/geo";
import type { GmbStop } from "@/lib/gmb";

export type RideState = "riding" | "approaching" | "arrive_now" | "arrived";

export const APPROACH_RADIUS_M = 400;
export const ARRIVE_RADIUS_M = 150;

export type RideStatus = {
  state: RideState;
  /** Meters from current position to the destination stop */
  distanceM: number | null;
  destination: GmbStop | null;
  /** Nearest stop to the current position (for the "you are here" line) */
  nearestStop: GmbStop | null;
};

export function useRideTracker(
  stops: GmbStop[],
  destinationSeq: number | null,
  position: LatLng | null,
): RideStatus {
  return useMemo(() => {
    const destination =
      stops.find((s) => s.seq === destinationSeq) ?? null;
    if (!destination || !position) {
      return { state: "riding", distanceM: null, destination, nearestStop: null };
    }

    const distanceM = haversineMeters(position, destination);
    let nearestStop: GmbStop | null = null;
    let nearestD = Infinity;
    for (const s of stops) {
      const d = haversineMeters(position, s);
      if (d < nearestD) {
        nearestD = d;
        nearestStop = s;
      }
    }

    let state: RideState = "riding";
    if (distanceM <= ARRIVE_RADIUS_M) state = "arrive_now";
    else if (distanceM <= APPROACH_RADIUS_M) state = "approaching";

    return { state, distanceM, destination, nearestStop };
  }, [stops, destinationSeq, position]);
}
