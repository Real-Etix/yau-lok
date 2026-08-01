"use client";

import { useMemo, useRef } from "react";
import {
  cumulativeMeters,
  haversineMeters,
  projectOntoPath,
  type LatLng,
} from "@/lib/geo";

/** Minimal stop shape the tracker needs — GMB and Toolhub stops both fit. */
export type Stop = {
  seq: number;
  name: { en: string; tc: string };
  lat: number;
  lng: number;
};

export type RideState = "riding" | "approaching" | "arrive_now" | "arrived";

export const APPROACH_RADIUS_M = 400;
export const ARRIVE_RADIUS_M = 150;

/** Beyond this far off the polyline, trust straight-line instead. */
const MAX_OFFSET_M = 400;
/** Typical urban minibus speed, for the "about N min" readout. */
const AVG_SPEED_MPS = 20 / 3.6;

export type RideStatus = {
  state: RideState;
  /** Metres to the destination stop — along the route when we can, else direct */
  distanceM: number | null;
  /** How that distance was measured, so the UI can be honest about it */
  distanceMode: "route" | "straight" | null;
  /** Rough minutes remaining, only when measured along the route */
  etaMinutes: number | null;
  destination: Stop | null;
  /** Nearest stop to the current position (for the "you are here" line) */
  nearestStop: Stop | null;
  /** Stops still ahead of you, up to and including the destination */
  stopsToGo: number | null;
};

export function useRideTracker(
  stops: Stop[],
  destinationSeq: number | null,
  position: LatLng | null,
  /** Road polyline the bus drives; enables along-route measurement */
  path: LatLng[] = [],
  /** How early to warn, in metres — the user's §5/08 alert-distance setting */
  approachRadiusM: number = APPROACH_RADIUS_M,
): RideStatus {
  const cum = useMemo(() => cumulativeMeters(path), [path]);

  // A bus doesn't reverse: never let progress along the route jump backwards.
  // This keeps the measurement stable where a route overlaps itself.
  const lastAlongRef = useRef<number | null>(null);
  const trackKeyRef = useRef<string>("");
  const trackKey = `${path.length}:${destinationSeq}`;
  if (trackKeyRef.current !== trackKey) {
    trackKeyRef.current = trackKey;
    lastAlongRef.current = null;
  }

  // Where each stop sits along the route. Straight-line "nearest stop" flips
  // backwards inside tunnels and around hills; along-route ordering doesn't.
  const stopAlongs = useMemo(() => {
    if (path.length < 2) return null;
    return stops.map((s) => projectOntoPath(path, cum, s)?.along ?? null);
  }, [stops, path, cum]);

  const destProjection = useMemo(() => {
    const dest = stops.find((s) => s.seq === destinationSeq);
    if (!dest || path.length < 2) return null;
    return projectOntoPath(path, cum, dest);
  }, [stops, destinationSeq, path, cum]);

  return useMemo(() => {
    const destination = stops.find((s) => s.seq === destinationSeq) ?? null;
    if (!destination || !position) {
      return {
        state: "riding" as const,
        distanceM: null,
        distanceMode: null,
        etaMinutes: null,
        destination,
        nearestStop: null,
        stopsToGo: null,
      };
    }

    const straight = haversineMeters(position, destination);

    // Prefer distance measured along the road the bus actually drives.
    let distanceM = straight;
    let distanceMode: "route" | "straight" = "straight";
    let alongNow: number | null = null;
    if (destProjection && path.length >= 2) {
      const here = projectOntoPath(path, cum, position);
      if (here && here.offset <= MAX_OFFSET_M) {
        alongNow = Math.max(here.along, lastAlongRef.current ?? here.along);
        lastAlongRef.current = alongNow;
        distanceM = Math.max(0, destProjection.along - alongNow);
        distanceMode = "route";
      }
    }

    let nearestStop: Stop | null = null;
    let stopsToGo: number | null = null;
    if (alongNow !== null && stopAlongs && destProjection) {
      // Nearest and remaining stops measured along the route, not through hills
      let nearestGap = Infinity;
      let ahead = 0;
      stops.forEach((s, i) => {
        const a = stopAlongs[i];
        if (a === null) return;
        const gap = Math.abs(a - alongNow!);
        if (gap < nearestGap) {
          nearestGap = gap;
          nearestStop = s;
        }
        if (a > alongNow! + 1 && a <= destProjection.along + 1) ahead++;
      });
      stopsToGo = ahead;
    } else {
      let nearestD = Infinity;
      for (const s of stops) {
        const d = haversineMeters(position, s);
        if (d < nearestD) {
          nearestD = d;
          nearestStop = s;
        }
      }
      const near = nearestStop as Stop | null;
      stopsToGo = near ? Math.max(0, destination.seq - near.seq) : null;
    }

    let state: RideState = "riding";
    if (distanceM <= ARRIVE_RADIUS_M) state = "arrive_now";
    // The arrival radius is a floor: a 200 m setting must still leave room to
    // stand up, so warn no later than the fixed arrive radius.
    else if (distanceM <= Math.max(approachRadiusM, ARRIVE_RADIUS_M))
      state = "approaching";

    return {
      state,
      distanceM,
      distanceMode,
      etaMinutes:
        distanceMode === "route"
          ? Math.max(1, Math.round(distanceM / AVG_SPEED_MPS / 60))
          : null,
      destination,
      nearestStop,
      stopsToGo,
    };
  }, [
    stops,
    destinationSeq,
    position,
    path,
    cum,
    destProjection,
    stopAlongs,
    approachRadiusM,
  ]);
}
