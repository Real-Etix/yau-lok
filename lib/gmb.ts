// Client for the HK government's green-minibus (GMB) real-time data,
// via our /api/gmb proxy (upstream: https://data.etagmb.gov.hk).
// Docs: https://data.gov.hk → "Real-time arrival data of green minibus"
//
// TODO(hackathon): check whether HKGAI Toolhub exposes the same transit
// data over MCP/REST — if so, swap this to Toolhub for ecosystem points.

export type GmbRegion = "HKI" | "KLN" | "NT";

export type GmbStop = {
  stopId: number;
  seq: number;
  name: { en: string; tc: string };
  lat: number;
  lng: number;
};

async function gmb<T>(path: string): Promise<T> {
  const res = await fetch(`/api/gmb${path}`);
  if (!res.ok) throw new Error(`GMB API ${res.status} for ${path}`);
  const body = await res.json();
  return body.data as T;
}

/** Look up route ids for a route code, e.g. ("HKI", "5"). */
export async function getRouteIds(
  region: GmbRegion,
  code: string,
): Promise<number[]> {
  return gmb<number[]>(`/route/${region}/${encodeURIComponent(code)}`);
}

/** Ordered stops for one direction (route_seq 1 or 2) of a route. */
export async function getRouteStops(
  routeId: number,
  routeSeq: 1 | 2,
): Promise<GmbStop[]> {
  type RawStop = {
    stop_id: number;
    stop_seq: number;
    name_en: string;
    name_tc: string;
  };
  const { route_stops } = await gmb<{ route_stops: RawStop[] }>(
    `/route-stop/${routeId}/${routeSeq}`,
  );
  const stops = await Promise.all(
    route_stops.map(async (s) => {
      const detail = await gmb<{
        coordinates: { wgs84: { latitude: number; longitude: number } };
      }>(`/stop/${s.stop_id}`);
      return {
        stopId: s.stop_id,
        seq: s.stop_seq,
        name: { en: s.name_en, tc: s.name_tc },
        lat: detail.coordinates.wgs84.latitude,
        lng: detail.coordinates.wgs84.longitude,
      };
    }),
  );
  return stops.sort((a, b) => a.seq - b.seq);
}
