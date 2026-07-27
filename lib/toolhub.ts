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
};

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
  return {
    routeId: r.route_id,
    routeCode: r.route_code,
    company: r.company,
    direction: r.direction,
    origEn: r.orig_en,
    destEn: r.dest_en,
    stops: (r.stops as RawStop[]).map((s) => ({
      stopId: s.stop_id,
      seq: s.seq,
      name: { en: s.name_en, tc: s.name_tc },
      lat: s.lat,
      lng: s.lng,
    })),
  };
}
