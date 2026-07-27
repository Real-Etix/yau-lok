// Snap an ordered stop sequence to the real road network via OSRM
// (HKGAI Toolhub returns stop-to-stop fallback lines for GMB routes —
// path_source: "stops_fallback" — so we trace the road shape ourselves).
// Body in:  { points: [lat, lng][] }
// Body out: { shape: [lat, lng][] }
// OSRM demo server, cached for a day per unique stop sequence.

const OSRM = "https://router.project-osrm.org/route/v1/driving";

export async function POST(request: Request) {
  const { points } = await request.json();
  if (!Array.isArray(points) || points.length < 2) {
    return Response.json({ error: "points[] (>=2) required" }, { status: 400 });
  }
  // OSRM wants lng,lat; keep URLs sane on very long routes.
  const capped =
    points.length > 60
      ? points.filter(
          (_: unknown, i: number) =>
            i % 2 === 0 || i === points.length - 1,
        )
      : points;
  const coords = capped
    .map(([lat, lng]: [number, number]) => `${lng},${lat}`)
    .join(";");
  const res = await fetch(
    `${OSRM}/${coords}?geometries=geojson&overview=full&steps=false`,
    { next: { revalidate: 86400 } },
  );
  if (!res.ok) {
    return Response.json({ error: `OSRM ${res.status}` }, { status: 502 });
  }
  const body = await res.json();
  const line = body.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(line)) {
    return Response.json({ error: "no route geometry" }, { status: 502 });
  }
  return Response.json({
    shape: line.map(([lng, lat]: [number, number]) => [lat, lng]),
  });
}
