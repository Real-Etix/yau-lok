"use client";

// The four live numbers on the home screen.
//
// Each scenario row carries exactly one, in its own livery's material. They
// are read, never invented: until a value arrives the panel shows an em dash
// under its caption, which is honest and holds the layout still — a spinner
// on the front door would make the app look like it is thinking rather than
// like it already knows something.

import { useEffect, useState } from "react";
import { getAeWaits, getRouteEta } from "@/lib/toolhub";
import { URBAN_TAXI, estimateUrbanFare } from "@/lib/taxi";
import { useSavedRoutes, useStored } from "@/lib/prefs";
import { useGeolocation } from "@/hooks/useGeolocation";

const DASH = "—";

/**
 * 小巴 — the next arrival on the route the rider actually uses.
 *
 * Value and unit come back separately: the dashboard sets the figure at 40px
 * and its unit at 15px, so they cannot be one pre-joined string.
 */
export function useNextMinibus() {
  const { saved, recent } = useSavedRoutes();
  const route = saved[0] ?? recent[0] ?? null;
  const [value, setValue] = useState(DASH);
  const [routeLine, setRouteLine] = useState<string | null>(null);

  useEffect(() => {
    if (!route?.originLat || !route.originLng) return;
    let cancelled = false;
    getRouteEta(
      { routeId: route.id, routeCode: route.routeCode, company: route.company },
      route.originLat,
      route.originLng,
    )
      .then((eta) => {
        if (cancelled || !eta?.etaMinutes?.length) return;
        // §7 from handoff 1 still applies: never render a 0-minute ETA.
        setValue(String(Math.max(1, eta.etaMinutes[0])));
      })
      .catch(() => {
        /* no arrivals is a normal state, not an error to surface here */
      });
    return () => {
      cancelled = true;
    };
  }, [route]);

  useEffect(() => {
    if (route) setRouteLine(`${route.routeCode} · ${route.to}`);
  }, [route]);

  return { value, routeLine, route };
}

/** 的士 — the estimate to wherever they went last, else the flagfall. */
export function useTaxiEstimate() {
  const [lastTrip] = useStored<{ to: string; distanceM: number } | null>(
    "yau-lok-last-taxi",
    null,
  );
  if (!lastTrip) {
    // No history: show what the meter starts at. Different number, different
    // caption — never a guess dressed as an estimate.
    return {
      value: URBAN_TAXI.flagfallHkd.toFixed(1),
      captionKey: "home.taxiStart",
      destination: null as string | null,
    };
  }
  const fare = estimateUrbanFare(lastTrip.distanceM);
  return {
    value: String(fare.low),
    captionKey: "home.taxiFare",
    destination: lastTrip.to,
  };
}

/** 急症室 — the wait at the nearest A&E. */
export function useNearestAeWait() {
  const gps = useGeolocation(false);
  const [value, setValue] = useState(DASH);
  const [unit, setUnit] = useState<string | null>(null);
  const [hospital, setHospital] = useState<{ en: string; tc: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    getAeWaits(gps.position?.lat, gps.position?.lng)
      .then((list) => {
        const first = list?.[0];
        if (cancelled || !first) return;
        setHospital(first.name);
        // "3 hours" arrives as one string; the dashboard needs the figure and
        // its unit apart so it can set them at different sizes. Parse the
        // English side — the digits are the same in both.
        const m = first.wait?.en.match(/([\d.]+)\s*(hours?|minutes?)/i);
        if (m) {
          // The HA feed bands a median of under an hour as "0 hour". Printed
          // as a bare 0 on the plate that reads as a broken figure rather than
          // as good news, so state the band it actually means.
          setValue(Number(m[1]) === 0 ? "<1" : m[1]);
          setUnit(/hour/i.test(m[2]) ? "hours" : "minutes");
        }
      })
      .catch(() => {
        /* the feed being down is not worth an error on the home screen */
      });
    return () => {
      cancelled = true;
    };
  }, [gps.position?.lat, gps.position?.lng]);

  return { value, unit, hospital };
}

export type LastChit = { firstLine: string; total: number; at: number };

/** 茶餐廳 — the first line of the last chit they handed over. */
export function useLastChit() {
  const [chit] = useStored<LastChit | null>("yau-lok-last-chit", null);
  return chit;
}
