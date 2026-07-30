// Plan a taxi ride: driving route, fare estimate, and the destination
// written in Chinese so the passenger can show it to the driver.
//
// Two routing paths, because Toolhub's driving mode takes place NAMES only
// ("driving mode requires origin/destination strings; GPS is not yet
// supported"). When we only have coordinates — the passenger tapped "use my
// location" — we geocode the destination and route with OSRM instead.

import { toolhubCall, toolhubConfigured } from "@/lib/toolhub-server";
import { chat, hkgaiConfigured } from "@/lib/hkgai";
import { decodePolyline, estimateUrbanFare } from "@/lib/taxi";

const hasChinese = (s: string | null | undefined) =>
  !!s && /[一-鿿]/.test(s);

/**
 * A driver needs the venue, not the district. The geocoder is inconsistent:
 * for HKU it returns name_tc 香港大學 with the vague address 香港薄扶林, while
 * for Times Square the name comes back in English and only the address is
 * Chinese. So prefer a Chinese NAME, fall back to the address, and ask the
 * model to supply the established Chinese name when neither is usable.
 */
async function chineseVenueName(
  place: GeoResult | null,
  fallbackQuery: string,
): Promise<string | null> {
  if (hasChinese(place?.name_tc)) return place!.name_tc;
  if (!hkgaiConfigured()) return place?.address_tc ?? null;
  try {
    const raw = await chat([
      {
        role: "system",
        content:
          'Give the established Traditional Chinese name used in Hong Kong for a place. Reply with strict JSON only: {"chinese":"<the Chinese name, or empty string if you are not confident>"}. Do not transliterate; if there is no well-known Chinese name, return an empty string.',
      },
      {
        role: "user",
        content: `${place?.name_tc || fallbackQuery}${
          place?.address_tc ? ` (near ${place.address_tc})` : ""
        }`,
      },
    ]);
    const parsed = JSON.parse(
      raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1),
    );
    if (hasChinese(parsed?.chinese)) return parsed.chinese as string;
  } catch {
    // fall through
  }
  return place?.address_tc ?? null;
}

type DrivingResult = {
  duration_seconds: number;
  distance_meters: number;
  polyline: string | null;
};

type GeoResult = {
  name_tc: string | null;
  name_en: string | null;
  address_tc: string | null;
  address_en: string | null;
  lat: number | null;
  lng: number | null;
};

const OSRM = "https://router.project-osrm.org/route/v1/driving";

// Hong Kong's bounding box. The geocoder happily returns Aberdeen, Scotland
// for "Aberdeen" even when anchored to Hong Kong, which produced a 12,644 km
// "taxi route" and an HK$88,551 fare. Anything outside these bounds is wrong.
const HK_BOUNDS = { minLat: 22.13, maxLat: 22.58, minLng: 113.82, maxLng: 114.45 };
/** No taxi journey within Hong Kong is longer than this. */
const MAX_TAXI_METERS = 80_000;

function inHongKong(p: { lat: number | null; lng: number | null }): boolean {
  return (
    p.lat != null &&
    p.lng != null &&
    p.lat >= HK_BOUNDS.minLat &&
    p.lat <= HK_BOUNDS.maxLat &&
    p.lng >= HK_BOUNDS.minLng &&
    p.lng <= HK_BOUNDS.maxLng
  );
}

/** Resolve a loose place name to a place that is actually in Hong Kong. */
async function geocode(name: string): Promise<GeoResult | null> {
  try {
    const geo = await toolhubCall<{ results: GeoResult[] }>("/geo/search", {
      query: name,
      location: "Hong Kong",
    });
    return (geo.results ?? []).find(inHongKong) ?? null;
  } catch {
    return null;
  }
}

async function routeByName(origin: string, destination: string) {
  const data = await toolhubCall<{ results: DrivingResult[] }>(
    "/transport/route",
    { mode: "driving", origin, destination },
  );
  const best = data.results?.[0];
  if (!best) return null;
  return {
    distanceM: best.distance_meters,
    durationS: best.duration_seconds,
    path: best.polyline ? decodePolyline(best.polyline) : [],
  };
}

async function routeByCoords(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const res = await fetch(
    `${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}?geometries=geojson&overview=full`,
    { next: { revalidate: 300 } },
  );
  if (!res.ok) return null;
  const body = await res.json();
  const r = body.routes?.[0];
  if (!r) return null;
  return {
    distanceM: Math.round(r.distance),
    durationS: Math.round(r.duration),
    path: (r.geometry?.coordinates ?? []).map(
      ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
    ),
  };
}

export async function POST(request: Request) {
  const { origin, destination, originLat, originLng } = await request.json();
  if (typeof destination !== "string" || !destination.trim()) {
    return Response.json({ error: "destination required" }, { status: 400 });
  }
  if (!toolhubConfigured()) {
    return Response.json({ error: "Toolhub not configured" }, { status: 501 });
  }
  const dest = destination.trim();
  const originName =
    typeof origin === "string" && origin.trim() ? origin.trim() : null;
  const originCoords =
    typeof originLat === "number" && typeof originLng === "number"
      ? { lat: originLat, lng: originLng }
      : null;
  if (!originName && !originCoords) {
    return Response.json({ error: "origin required" }, { status: 400 });
  }

  try {
    let route: Awaited<ReturnType<typeof routeByName>> = null;
    let destGeo: GeoResult | null = null;

    // 1. Named origin: ask Toolhub directly.
    if (originName) {
      try {
        route = await routeByName(originName, dest);
      } catch {
        route = null;
      }
      // 2. Retry with resolved names — Toolhub routes "Times Square Causeway
      //    Bay" but not bare "Times Square", while geo/search resolves both.
      if (!route) {
        const [o, d] = await Promise.all([geocode(originName), geocode(dest)]);
        destGeo = d;
        const oName = o?.address_tc || o?.name_tc || originName;
        const dName = d?.address_tc || d?.name_tc || dest;
        try {
          route = await routeByName(oName, dName);
        } catch {
          route = null;
        }
        // 3. Still nothing: route on coordinates via OSRM.
        if (!route && o?.lat != null && d?.lat != null) {
          route = await routeByCoords(
            { lat: o.lat, lng: o.lng! },
            { lat: d.lat, lng: d.lng! },
          );
        }
      }
    } else if (originCoords) {
      // Coordinates can't go to Toolhub driving at all — geocode the
      // destination and use OSRM.
      destGeo = await geocode(dest);
      if (destGeo?.lat != null && destGeo.lng != null) {
        route = await routeByCoords(originCoords, {
          lat: destGeo.lat,
          lng: destGeo.lng,
        });
      }
    }

    if (!route) {
      return Response.json(
        {
          error: `Couldn't find a driving route to "${dest}". Try adding the district, e.g. "${dest} Causeway Bay".`,
        },
        { status: 404 },
      );
    }
    // A plausible-looking route to the wrong continent is worse than no
    // route: it would show the passenger a five-figure fare.
    if (route.distanceM > MAX_TAXI_METERS) {
      return Response.json(
        {
          error: `That resolved to somewhere outside Hong Kong. Try a more specific place, e.g. "${dest}, Kowloon".`,
        },
        { status: 404 },
      );
    }

    const hit = destGeo ?? (await geocode(dest));
    const chinese = await chineseVenueName(hit, dest);
    // Keep the street address separate so the card can show venue + street:
    // the venue tells the driver where, the street tells them how.
    const address =
      hit?.address_tc && hit.address_tc !== chinese ? hit.address_tc : null;

    return Response.json({
      ...route,
      destinationChinese: chinese,
      destinationAddress: address,
      destinationInput: dest,
      fare: estimateUrbanFare(route.distanceM, route.durationS),
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not plan taxi route" },
      { status: 502 },
    );
  }
}
