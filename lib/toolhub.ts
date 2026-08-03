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
  /** Does this option include a green-minibus leg? */
  hasMinibus: boolean;
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
      hasMinibus: legs.some((l) => l.company === "gmb"),
    };
  });
}

/**
 * Minibus options first — the planner ranks purely on duration, which buries
 * the mode this app exists for. Within each group, keep the fastest first.
 */
export function sortMinibusFirst(options: JourneyOption[]): JourneyOption[] {
  return [...options].sort((a, b) => {
    if (a.hasMinibus !== b.hasMinibus) return a.hasMinibus ? -1 : 1;
    return a.minutes - b.minutes;
  });
}

/**
 * Fare between two stops on a route. Toolhub's fare tool resolves stops by
 * NAME (ids and sequence numbers are rejected), so pass the stop names.
 * Returns null when the pair isn't priced rather than throwing — fare is a
 * nice-to-have and must never block the ride view.
 */
export async function getStopFare(
  route: string,
  company: string,
  fromStopName: string,
  toStopName: string,
): Promise<number | null> {
  try {
    const res = await fetch("/api/toolhub/transport/transit/fare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route,
        company,
        from_stop: fromStopName,
        to_stop: toStopName,
      }),
    });
    const body = await res.json();
    const amount = body?.data?.results?.[0]?.fare?.amount;
    return typeof amount === "number" ? amount : null;
  } catch {
    return null;
  }
}

export type WeatherNow = {
  text: string;
  temperature: number | null;
  humidity: number | null;
  station: string | null;
  /** true when the conditions suggest taking an umbrella */
  wet: boolean;
};

/**
 * Current conditions near a place (Toolhub weather_query, HKO-sourced).
 * The tool geocodes a place NAME and rejects lat/lng, and full bus-stop
 * names like "Shek Pai Wan Estate Public Transport Interchange" fail to
 * geocode — so we retry with progressively shorter district-ish names.
 */
export async function getWeather(
  ...candidates: string[]
): Promise<WeatherNow | null> {
  for (const location of candidates) {
    if (!location) continue;
    const w = await weatherFor(location);
    if (w) return w;
  }
  return null;
}

async function weatherFor(location: string): Promise<WeatherNow | null> {
  try {
    const res = await fetch("/api/toolhub/weather", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location }),
    });
    const body = await res.json();
    const c = body?.data?.current;
    if (!c) return null;
    // text_en is frequently null in this feed; text_tc always populated.
    const text: string = c.text_tc || c.text_en || "";
    return {
      text,
      temperature: typeof c.temperature === "number" ? c.temperature : null,
      humidity: typeof c.humidity === "number" ? c.humidity : null,
      station: c.station_en || c.station_tc || null,
      wet: /雨|雷|storm|rain|shower|thunder/i.test(text),
    };
  } catch {
    return null;
  }
}

export type Facility = {
  name: string;
  distanceM: number | null;
};

/** Nearby public toilets or markets (Toolhub facility_search). */
export async function getFacilities(
  type: "toilet" | "market",
  lat: number,
  lng: number,
): Promise<Facility[]> {
  try {
    const res = await fetch("/api/toolhub/facilities/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng, facility_type: type }),
    });
    const body = await res.json();
    type Raw = {
      name_en: string | null;
      name_tc: string | null;
      distance_meters: number | null;
    };
    return ((body?.data?.results ?? []) as Raw[]).map((f) => ({
      name: f.name_en || f.name_tc || "Unnamed",
      distanceM: f.distance_meters ?? null,
    }));
  } catch {
    return [];
  }
}

export type AeHospital = {
  id: string;
  /**
   * The feed is bilingual and always has been — `name_tc` carries 長洲醫院,
   * 瑪麗醫院 and the rest. An earlier mapper here read `name_en || name_tc`,
   * which meant the Chinese name was fetched and then thrown away on every
   * screen. Both are kept now and the UI picks by reading language.
   */
  name: { en: string; tc: string };
  district: { en: string; tc: string };
  distanceM: number | null;
  /** Headline median wait, e.g. "3 hours" / "3 小時" */
  wait: { en: string; tc: string } | null;
  /** Wait once triaged as urgent */
  urgentWait: { en: string; tc: string } | null;
};

/** Live A&E waiting times at public hospitals (Toolhub healthcare_ae_wait). */
export async function getAeWaits(
  lat?: number,
  lng?: number,
): Promise<AeHospital[]> {
  try {
    const res = await fetch("/api/toolhub/healthcare/ae-wait", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lat != null && lng != null ? { lat, lng } : {}),
    });
    const body = await res.json();
    type Raw = {
      id: string;
      name_en: string | null;
      name_tc: string | null;
      district_en: string | null;
      district_tc: string | null;
      distance_meters: number | null;
      wait: {
        headline?: { band_en?: string; band_tc?: string };
        triage?: { urgent?: { p50_en?: string; p50_tc?: string } };
      } | null;
    };
    const pair = (en?: string | null, tc?: string | null) => ({
      en: en || tc || "",
      tc: tc || en || "",
    });
    return ((body?.data?.results ?? []) as Raw[]).map((h) => ({
      id: h.id,
      name: pair(h.name_en, h.name_tc) as { en: string; tc: string },
      district: pair(h.district_en, h.district_tc),
      distanceM: h.distance_meters ?? null,
      wait: h.wait?.headline
        ? pair(h.wait.headline.band_en, h.wait.headline.band_tc)
        : null,
      urgentWait: h.wait?.triage?.urgent
        ? pair(h.wait.triage.urgent.p50_en, h.wait.triage.urgent.p50_tc)
        : null,
    }));
  } catch {
    return [];
  }
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

/* ---------------------------------------------------------------------------
   影餐牌 — reading a 茶餐廳 menu off a photograph.

   This sits with the other model calls by design, so there is one obvious
   place to swap the engine. It differs from its neighbours in one way worth
   knowing: recognition runs ON DEVICE.

   HKGAI has nothing to call for this. Checked against the developer portal
   (hkgai-studio.prod.hkchat.app) on 2026-08-02, not merely inferred:

     Modelhub  text and speech only. One text model, t2_hkgai-v3_fp8_1m_e7,
               which answers an image with "is not a multimodal model".
     Speech    TTS, recognition, meeting transcription. Audio, not images.
     Toolhub   15 tools across geo / transport / weather / facilities /
               healthcare. No OCR — hence the 404s on every /ocr* path while
               /weather returns 200 on the same credentials.
     Agenthub  web search and crawl.  SDKhub  a JS SDK for HKChat embeds.

   So `recogniseMenu` loads Tesseract in the browser instead. No key is
   involved, which makes the usual "keep it server-side" rule moot; if a
   vision endpoint ever appears, replace the body of this one function and
   nothing above it changes.

   Expect this to be imperfect. A 餐牌 is hand-set, often photographed at an
   angle under fluorescent light. Everything downstream is built for partial
   results: a line with no confident price is never given one, and the whole
   feature falls back to CCT_MENU.
--------------------------------------------------------------------------- */

export type RecognisedItem = {
  id: string;
  /** The Chinese as read off the board */
  zh: string;
  /** Rendered into the reader's language, when we could */
  translated?: string;
  /** Only ever set when a price was actually read. Never inferred. */
  price?: number;
  confidence: number;
  /**
   * Fractions of the source image (0–1), not pixels. Stored this way so the
   * outline lands correctly at whatever size the photo is rendered — the
   * photo is a tap target, and a box in the wrong place is worse than none.
   */
  bbox: { x: number; y: number; w: number; h: number };
};

/** Below this a line goes in the "couldn't read it" hint, not the list. */
export const OCR_CONFIDENCE_FLOOR = 55;

/** Menu prices are two or three digits, optionally with a $ in front. */
const PRICE = /(?:\$|＄)?\s*(\d{1,3})(?:\.0)?\s*$/;

/**
 * Tesseract wants dark text on white at roughly 300 dpi. A phone photo of a
 * menu is none of those things, so the image is upscaled, desaturated and
 * contrast-stretched before it goes in. This is the cheapest accuracy win
 * available and it costs one canvas pass.
 */
async function prepare(photo: Blob): Promise<{ canvas: HTMLCanvasElement; w: number; h: number }> {
  const bitmap = await createImageBitmap(photo);
  // Aim for a longest side of ~1800px, in either direction. The old rule only
  // ever scaled *up*, which meant a 12-megapixel phone photo went into
  // Tesseract untouched: getImageData alone allocates ~48 MB for one of those,
  // and on a phone the recognition that follows either takes minutes or dies
  // quietly and returns nothing. Downscaling is not a quality loss here —
  // Tesseract wants text about 30–40px tall, and a full-frame photo of a menu
  // has far more than that to spare.
  const longest = Math.max(bitmap.width, bitmap.height, 1);
  const scale = Math.min(3, 1800 / longest);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;

  // Mean luminance decides where the paper ends and the ink begins.
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) {
    sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  }
  const mean = sum / (px.length / 4);

  // Desaturate, and lift contrast only gently. Measured on a test board, a
  // steep curve (×2.2) traded two correct lines for two wrong ones: Chinese
  // glyphs have thin strokes and hard contrast eats them. Upscaling is the
  // part that reliably helps; this only nudges a flat photo.
  for (let i = 0; i < px.length; i += 4) {
    const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const v = Math.max(0, Math.min(255, (l - mean) * 1.25 + 150));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return { canvas, w, h };
}

export async function recogniseMenu(photo: Blob): Promise<RecognisedItem[]> {
  const { createWorker, PSM } = await import("tesseract.js");
  // Traditional Chinese ALONE, deliberately. Loading `eng` alongside it lets
  // Tesseract score a Latin reading against a Chinese one per line, and on a
  // menu it frequently prefers the Latin: measured on a clean board, 乾炒牛河
  // came back as "LACE ST)" and 沙嗲牛肉麵 as "pg Set]". chi_tra already
  // contains Latin letters and digits, so prices still read correctly — every
  // price in that same test was right both ways. English costs accuracy here
  // and buys nothing.
  const worker = await createWorker(["chi_tra"]);
  try {
    const { canvas, w: imgW, h: imgH } = await prepare(photo);

    // A menu is a single column of lines, not prose. Telling Tesseract that
    // stops it hunting for paragraphs that are not there.
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
    });

    const { data } = await worker.recognize(
      canvas,
      {},
      { blocks: true, text: false },
    );

    const lines =
      data.blocks?.flatMap((b) =>
        b.paragraphs.flatMap((p) => p.lines),
      ) ?? [];

    const out: RecognisedItem[] = [];
    lines.forEach((line, i) => {
      const raw = line.text
        .replace(/\s+/g, " ")
        // Tesseract spaces CJK glyphs apart; Chinese does not use spaces.
        .replace(/(?<=[\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, "")
        .trim();
      if (!raw) return;

      // A menu row is "name .... price". Split the price off the end only
      // when one is really there; a missing price stays missing.
      const m = raw.match(PRICE);
      const zh = (m ? raw.slice(0, m.index).trim() : raw)
        // dot leaders between name and price
        .replace(/[.·⋯…\-_\s]+$/, "")
        .trim();
      if (!zh) return;

      const item: RecognisedItem = {
        id: `ocr-${i}`,
        zh,
        confidence: line.confidence,
        bbox: {
          x: line.bbox.x0 / imgW,
          y: line.bbox.y0 / imgH,
          w: (line.bbox.x1 - line.bbox.x0) / imgW,
          h: (line.bbox.y1 - line.bbox.y0) / imgH,
        },
      };
      // Only attach a price when one was genuinely read.
      if (m) item.price = Number(m[1]);
      out.push(item);
    });
    return out;
  } finally {
    await worker.terminate();
  }
}
