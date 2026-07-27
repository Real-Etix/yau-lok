export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Linear interpolation between two points (fine at city scale). */
export function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

// --- Along-route measurement -------------------------------------------
// Straight-line distance to a stop is not monotonic along a bus route: a
// route that loops or doubles back can pass close to a stop long before it
// reaches it. Measuring *along the route polyline* is monotonic, so it can't
// fire "you have arrived" on a near-miss.

/** Cumulative metres at each vertex of a polyline. */
export function cumulativeMeters(path: LatLng[]): number[] {
  const cum = [0];
  for (let i = 1; i < path.length; i++) {
    cum.push(cum[i - 1] + haversineMeters(path[i - 1], path[i]));
  }
  return cum;
}

/** Local flat-earth metres relative to an origin — accurate at city scale. */
function toLocalXY(p: LatLng, origin: LatLng): [number, number] {
  const mPerDegLat = 110574;
  const mPerDegLng = 111320 * Math.cos((origin.lat * Math.PI) / 180);
  return [(p.lng - origin.lng) * mPerDegLng, (p.lat - origin.lat) * mPerDegLat];
}

export type Projection = {
  /** metres travelled along the path to reach the closest point */
  along: number;
  /** perpendicular distance from the path (how far off-route the point is) */
  offset: number;
};

/**
 * Project a point onto a polyline. Returns how far along the path the
 * closest point lies, and how far off the path the point is.
 */
export function projectOntoPath(
  path: LatLng[],
  cum: number[],
  p: LatLng,
): Projection | null {
  if (path.length < 2) return null;
  let best: Projection | null = null;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const [ax, ay] = toLocalXY(a, a);
    const [bx, by] = toLocalXY(b, a);
    const [px, py] = toLocalXY(p, a);
    const dx = bx - ax;
    const dy = by - ay;
    const segLenSq = dx * dx + dy * dy;
    const t =
      segLenSq === 0
        ? 0
        : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / segLenSq));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const offset = Math.hypot(px - cx, py - cy);
    if (!best || offset < best.offset) {
      const segLen = cum[i + 1] - cum[i];
      best = { along: cum[i] + t * segLen, offset };
    }
  }
  return best;
}
