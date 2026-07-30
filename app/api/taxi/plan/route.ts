// Plan a taxi ride: driving route, fare estimate, and the destination
// written in Chinese so the passenger can show it to the driver.

import { toolhubCall, toolhubConfigured } from "@/lib/toolhub-server";
import { decodePolyline, estimateUrbanFare } from "@/lib/taxi";

type DrivingResult = {
  duration_seconds: number;
  distance_meters: number;
  polyline: string | null;
};

type Endpoints = {
  origin?: { name_tc?: string | null; address_tc?: string | null };
  destination?: { name_tc?: string | null; address_tc?: string | null };
};

type GeoResult = {
  name_tc: string | null;
  name_en: string | null;
  address_tc: string | null;
  address_en: string | null;
  lat: number | null;
  lng: number | null;
};

export async function POST(request: Request) {
  const { origin, destination, originLat, originLng } = await request.json();
  if (typeof destination !== "string" || !destination.trim()) {
    return Response.json({ error: "destination required" }, { status: 400 });
  }
  if (!toolhubConfigured()) {
    return Response.json({ error: "Toolhub not configured" }, { status: 501 });
  }

  const body: Record<string, unknown> = { mode: "driving", destination };
  if (typeof origin === "string" && origin.trim()) body.origin = origin.trim();
  else if (typeof originLat === "number" && typeof originLng === "number") {
    body.origin_lat = originLat;
    body.origin_lng = originLng;
  } else {
    return Response.json({ error: "origin required" }, { status: 400 });
  }

  try {
    const data = await toolhubCall<{
      results: DrivingResult[];
      endpoints?: Endpoints;
    }>("/transport/route", body);
    const best = data.results?.[0];
    if (!best) {
      return Response.json({ error: "No driving route found" }, { status: 404 });
    }

    // The route endpoints often lack Chinese text; geo/search fills it in so
    // the passenger has something the driver can actually read.
    let chinese: string | null =
      data.endpoints?.destination?.address_tc ??
      data.endpoints?.destination?.name_tc ??
      null;
    try {
      // geo/search needs BOTH a query and a location anchor — query alone
      // fails with "Provide either location OR lat+lng".
      const geo = await toolhubCall<{ results: GeoResult[] }>("/geo/search", {
        query: destination,
        location: destination,
      });
      const hit = geo.results?.[0];
      if (hit) chinese = hit.address_tc || hit.name_tc || chinese;
    } catch {
      // keep whatever the route gave us
    }

    const fare = estimateUrbanFare(best.distance_meters, best.duration_seconds);

    return Response.json({
      distanceM: best.distance_meters,
      durationS: best.duration_seconds,
      path: best.polyline ? decodePolyline(best.polyline) : [],
      destinationChinese: chinese,
      destinationInput: destination,
      fare,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not plan taxi route" },
      { status: 502 },
    );
  }
}
