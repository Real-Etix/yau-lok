import { haversineMeters } from "@/lib/geo";

// Client helpers for HKGAI Toolhub (via our /api/toolhub proxy).
// Toolhub replaces the raw government GMB API when credentials are set —
// same data, but through HKGAI's ecosystem (transit_route_detail tool).

export type TransitStop = {
  stopId: string;
  seq: number;
  name: { en: string; tc: string };
  lat: number;
  lng: number;
};

export type TransitRoute = {
  routeId: string;
  routeCode: string;
  company: string;
  direction: string;
  origEn: string;
  destEn: string;
  stops: TransitStop[];
  /** Road polyline as [lat, lng] pairs (falls back to stop-to-stop lines) */
  path: [number, number][];
};

// --- Journey planning (Toolhub transport/route) -------------------------
// Lets the user name a destination instead of knowing a route code — the
// whole point, since "which minibus goes there" is exactly the local
// knowledge our users don't have.

export type JourneyLeg = {
  kind: "walk" | "ride";
  minutes: number;
  /** e.g. "4C" — only for ride legs */
  routeCode?: string;
  /** gmb | kmb | citybus | nlb | mtr */
  company?: string;
  numStops?: number;
  from?: { name: string; lat: number; lng: number };
  to?: { name: string; lat: number; lng: number };
};

export type JourneyOption = {
  minutes: number;
  km: number;
  fare: number | null;
  legs: JourneyLeg[];
};

export type PlaceRef = { name?: string; lat?: number; lng?: number };

const COMPANY_ALIAS: Record<string, string> = { ctb: "citybus" };

export async function planJourney(
  origin: PlaceRef,
  destination: PlaceRef,
): Promise<JourneyOption[]> {
  const body: Record<string, unknown> = {};
  if (origin.name) body.origin = origin.name;
  else if (origin.lat != null && origin.lng != null) {
    body.origin_lat = origin.lat;
    body.origin_lng = origin.lng;
  }
  if (destination.name) body.destination = destination.name;
  else if (destination.lat != null && destination.lng != null) {
    body.dest_lat = destination.lat;
    body.dest_lng = destination.lng;
  }

  const res = await fetch("/api/toolhub/transport/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json();
  if (!res.ok || !payload.success) {
    throw new Error(payload.error?.message ?? "Could not plan that journey");
  }

  type RawStop = { name_tc: string; name_en: string | null; lat: number; lng: number };
  type RawStep = {
    mode: string;
    duration_seconds: number;
    transit: {
      num_stops: number;
      departure_stop: RawStop;
      arrival_stop: RawStop;
    } | null;
  };
  type RawResult = {
    duration_seconds: number;
    distance_meters: number;
    fare: {
      amount: number | null;
      segments: { mode: string; route_code: string }[];
    } | null;
    steps: RawStep[];
  };

  const named = (s: RawStop) => ({
    name: s.name_en || s.name_tc,
    lat: s.lat,
    lng: s.lng,
  });

  return (payload.data?.results ?? []).map((r: RawResult) => {
    const segments = r.fare?.segments ?? [];
    let rideIndex = 0;
    const legs: JourneyLeg[] = [];
    for (const s of r.steps) {
      const minutes = Math.max(1, Math.round(s.duration_seconds / 60));
      if (s.transit) {
        const seg = segments[rideIndex++];
        legs.push({
          kind: "ride",
          minutes,
          routeCode: seg?.route_code,
          company: seg ? (COMPANY_ALIAS[seg.mode] ?? seg.mode) : undefined,
          numStops: s.transit.num_stops,
          from: named(s.transit.departure_stop),
          to: named(s.transit.arrival_stop),
        });
      } else if (legs.length && legs[legs.length - 1].kind === "walk") {
        // merge consecutive walking steps
        legs[legs.length - 1].minutes += minutes;
      } else {
        legs.push({ kind: "walk", minutes });
      }
    }
    return {
      minutes: Math.max(1, Math.round(r.duration_seconds / 60)),
      km: r.distance_meters / 1000,
      fare: r.fare?.amount ?? null,
      legs,
    };
  });
}

export type RouteEta = {
  stopNameEn: string;
  stopNameTc: string;
  /** Minutes until each upcoming arrival at that stop, soonest first */
  etaMinutes: number[];
};

/**
 * Next arrivals of a route at the stop nearest to (lat, lng), via Toolhub's
 * transit_eta tool. Prefers an exact route_id (direction) match, falls back
 * to route code + operator. Returns null when the route has no live ETAs
 * nearby (e.g. service ended for the day).
 */
export async function getRouteEta(
  route: { routeId: string; routeCode: string; company: string },
  lat: number,
  lng: number,
): Promise<RouteEta | null> {
  const res = await fetch("/api/toolhub/transport/transit/eta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng }),
  });
  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body.error?.message ?? "ETA lookup failed");
  }
  type RawEtaStop = {
    name_en: string;
    name_tc: string;
    routes: {
      route_id: string;
      route_code: string;
      company: string;
      eta: { eta_remain: number | null }[];
    }[];
  };
  const stops = (body.data?.results ?? []) as RawEtaStop[];
  const pick = (
    match: (r: RawEtaStop["routes"][number]) => boolean,
  ): RouteEta | null => {
    for (const stop of stops) {
      const r = stop.routes.find(match);
      if (r) {
        return {
          stopNameEn: stop.name_en,
          stopNameTc: stop.name_tc,
          etaMinutes: r.eta
            .map((e) => e.eta_remain)
            .filter((m): m is number => typeof m === "number"),
        };
      }
    }
    return null;
  };
  return (
    pick((r) => r.route_id === route.routeId) ??
    pick(
      (r) =>
        r.route_code === route.routeCode && r.company === route.company,
    )
  );
}

/**
 * Real road polyline for an ordered stop list (OSRM via /api/roadshape).
 * Toolhub's GMB paths are stop-to-stop fallback lines; this traces streets.
 */
export async function getRoadShape(
  stops: { lat: number; lng: number }[],
): Promise<[number, number][]> {
  const res = await fetch("/api/roadshape", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points: stops.map((s) => [s.lat, s.lng]) }),
  });
  const body = await res.json();
  if (!res.ok || !Array.isArray(body.shape)) {
    throw new Error(body.error ?? "road shape failed");
  }
  return body.shape as [number, number][];
}

/**
 * Load the real route behind a planned ride leg and work out which direction
 * it runs and which stops the rider actually gets on and off at.
 */
export async function loadRouteForLeg(leg: JourneyLeg): Promise<{
  route: TransitRoute;
  boardingSeq: number;
  destinationSeq: number;
}> {
  if (!leg.routeCode || !leg.from || !leg.to) {
    throw new Error("That leg has no route information");
  }
  const company = leg.company ?? "gmb";
  const nearest = (stops: TransitStop[], p: { lat: number; lng: number }) =>
    stops.reduce(
      (best, s) => {
        const d = haversineMeters(s, p);
        return d < best.d ? { s, d } : best;
      },
      { s: stops[0], d: Infinity },
    );

  const tries = await Promise.allSettled(
    (["outbound", "inbound"] as const).map((dir) =>
      getBusRoute(leg.routeCode!, company, dir),
    ),
  );
  const candidates = tries
    .filter(
      (t): t is PromiseFulfilledResult<TransitRoute> => t.status === "fulfilled",
    )
    .map((t) => t.value)
    .filter((r) => r.stops.length >= 2);
  if (candidates.length === 0) {
    throw new Error(`Couldn't load ${company.toUpperCase()} ${leg.routeCode}`);
  }

  // Pick the direction whose stops best match the planned boarding/alighting
  // points, and that visits them in the right order.
  let best: {
    route: TransitRoute;
    boardingSeq: number;
    destinationSeq: number;
    score: number;
  } | null = null;
  for (const route of candidates) {
    const on = nearest(route.stops, leg.from);
    const off = nearest(route.stops, leg.to);
    const ordered = off.s.seq > on.s.seq;
    const score = on.d + off.d + (ordered ? 0 : 5000);
    if (!best || score < best.score) {
      best = {
        route,
        boardingSeq: on.s.seq,
        destinationSeq: ordered
          ? off.s.seq
          : (route.stops[route.stops.length - 1].seq ?? off.s.seq),
        score,
      };
    }
  }
  return best!;
}

export async function getBusRoute(
  route: string,
  company: string = "gmb",
  direction: "outbound" | "inbound" = "outbound",
): Promise<TransitRoute> {
  const res = await fetch("/api/toolhub/transport/transit/route/detail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ route, company, direction }),
  });
  const body = await res.json();
  if (!res.ok || !body.success || !body.data?.results?.length) {
    throw new Error(
      body.error?.message ?? `No ${company} route ${route} (${direction})`,
    );
  }
  type RawStop = {
    stop_id: string;
    seq: number;
    name_en: string;
    name_tc: string;
    lat: number;
    lng: number;
  };
  const r = body.data.results[0];
  // GeoJSON LineString(s) in lng,lat order → [lat, lng]
  const path: [number, number][] = (
    (r.path?.features ?? []) as {
      geometry: { type: string; coordinates: [number, number][] };
    }[]
  )
    .filter((f) => f.geometry?.type === "LineString")
    .flatMap((f) => f.geometry.coordinates)
    .map(([lng, lat]) => [lat, lng] as [number, number]);
  return {
    routeId: r.route_id,
    routeCode: r.route_code,
    company: r.company,
    direction: r.direction,
    origEn: r.orig_en,
    destEn: r.dest_en,
    path,
    stops: (r.stops as RawStop[]).map((s) => ({
      stopId: s.stop_id,
      seq: s.seq,
      name: { en: s.name_en, tc: s.name_tc },
      lat: s.lat,
      lng: s.lng,
    })),
  };
}
