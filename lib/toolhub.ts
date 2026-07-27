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
