"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DEMO_ROUTE_NAME, DEMO_STOPS } from "@/data/demo-route";
import { MINIBUS_PHRASES, type Phrase } from "@/data/phrases";
import { useGeolocation } from "@/hooks/useGeolocation";
import {
  useRideTracker,
  APPROACH_RADIUS_M,
  type RideState,
  type Stop,
} from "@/hooks/useRideTracker";
import { getBusRoute, getRouteEta, type RouteEta } from "@/lib/toolhub";
import { VOICE_PERSONAS, DEFAULT_PERSONA_KEY } from "@/data/voices";
import RideMap from "@/components/RideMap";
import { lerp, type LatLng } from "@/lib/geo";
import { listenCantonese, speakCantonese, speakPhrase } from "@/lib/speech";

const STATE_LABEL: Record<RideState, { text: string; className: string }> = {
  riding: { text: "On the way", className: "bg-emerald-100 text-emerald-900" },
  approaching: {
    text: "Your stop is coming up — get ready!",
    className: "bg-amber-200 text-amber-950",
  },
  arrive_now: {
    text: "SHOUT NOW — your stop is here!",
    className: "bg-red-500 text-white animate-pulse",
  },
  arrived: {
    text: "You made it — 唔該晒 driver!",
    className: "bg-slate-200 text-slate-800",
  },
};

type DriverReply = {
  transcript: string;
  english: string;
  reply_cantonese: string;
  reply_english: string;
};

// Demo mode drives a simulated position along the stop polyline,
// so the full journey can be shown indoors at pitch time.
// Progress is wall-clock based so background-tab timer throttling
// can't stall the ride mid-demo.
const SIM_RIDE_DURATION_MS = 60_000;

function useSimulatedRide(active: boolean, stops: Stop[]) {
  const [progress, setProgress] = useState(0); // 0..1 across whole route
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (!active) {
      startRef.current = null;
      return;
    }
    startRef.current ??= Date.now();
    const id = setInterval(() => {
      // reset() nulls startRef; restart the clock on the next tick
      startRef.current ??= Date.now();
      const elapsed = Date.now() - startRef.current;
      setProgress(Math.min(1, elapsed / SIM_RIDE_DURATION_MS));
    }, 250);
    return () => clearInterval(id);
  }, [active]);

  const position: LatLng | null =
    active && stops.length >= 2
      ? (() => {
          const segs = stops.length - 1;
          const x = progress * segs;
          const i = Math.min(Math.floor(x), segs - 1);
          return lerp(stops[i], stops[i + 1], x - i);
        })()
      : null;

  return {
    position,
    progress,
    reset: () => {
      startRef.current = null;
      setProgress(0);
    },
  };
}

export default function RidePage() {
  const [demoMode, setDemoMode] = useState(true);
  const [boardingSeq, setBoardingSeq] = useState(1);
  const [destinationSeq, setDestinationSeq] = useState<number | null>(5);
  // Has the user actually gotten on the minibus? Tracking starts here.
  const [boarded, setBoarded] = useState(false);
  const [personaKey, setPersonaKey] = useState(DEFAULT_PERSONA_KEY);
  useEffect(() => {
    const saved = localStorage.getItem("yau-lok-voice");
    if (saved && VOICE_PERSONAS.some((p) => p.key === saved)) {
      setPersonaKey(saved);
    }
  }, []);
  const pickPersona = useCallback((key: string) => {
    setPersonaKey(key);
    localStorage.setItem("yau-lok-voice", key);
    // Instant preview so the choice is audible
    speakPhrase("yau-lok", "唔該，有落！", key);
  }, []);
  const [coachMode, setCoachMode] = useState(true);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [driverReply, setDriverReply] = useState<DriverReply | null>(null);
  const [listenError, setListenError] = useState<string | null>(null);

  // Route: bundled demo stops by default; a real route via HKGAI Toolhub
  // once loaded (transit_route_detail tool).
  const [stops, setStops] = useState<Stop[]>(DEMO_STOPS);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [routeName, setRouteName] = useState(DEMO_ROUTE_NAME);
  const [routeCode, setRouteCode] = useState("");
  const [routeRef, setRouteRef] = useState<{
    routeId: string;
    routeCode: string;
    company: string;
  } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [eta, setEta] = useState<RouteEta | null>(null);

  // The simulated ride starts at the boarding stop, not the route origin.
  const boardingIdx = Math.max(
    0,
    stops.findIndex((s) => s.seq === boardingSeq),
  );
  const simStops = stops.slice(boardingIdx);
  // The (simulated) ride only moves once the user says they're on board.
  const sim = useSimulatedRide(demoMode && boarded, simStops);
  const gps = useGeolocation(!demoMode);
  const position = demoMode
    ? (sim.position ?? stops[boardingIdx] ?? null)
    : gps.position;

  const simReset = sim.reset;
  const loadRoute = useCallback(async () => {
    if (!routeCode.trim()) return;
    setRouteLoading(true);
    setRouteError(null);
    try {
      const r = await getBusRoute(routeCode.trim().toUpperCase());
      setStops(r.stops);
      setRoutePath(r.path);
      setBoarded(false);
      setRouteName(
        `GMB ${r.routeCode} · ${r.origEn} → ${r.destEn} (live via Toolhub)`,
      );
      setRouteRef({
        routeId: r.routeId,
        routeCode: r.routeCode,
        company: r.company,
      });
      setEta(null);
      setBoardingSeq(r.stops[0].seq);
      setDestinationSeq(r.stops[r.stops.length - 1].seq);
      simReset();
    } catch (e) {
      setRouteError(e instanceof Error ? e.message : "Could not load route");
    } finally {
      setRouteLoading(false);
    }
  }, [routeCode, simReset]);

  const tracked = useRideTracker(stops, destinationSeq, position);

  // Latch "arrived": once we've been at the stop and are moving away
  // again, the ride is over — don't fall back to "coming up".
  const [reachedStop, setReachedStop] = useState(false);
  useEffect(() => {
    if (tracked.state === "arrive_now") setReachedStop(true);
  }, [tracked.state]);
  useEffect(() => setReachedStop(false), [destinationSeq, demoMode, stops]);

  // Changing the boarding stop restarts the (simulated) journey there,
  // and the destination must stay after the boarding stop.
  const firstRunRef = useRef(true);
  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    setReachedStop(false);
    setBoarded(false);
    simReset();
    setDestinationSeq((d) => {
      if (d !== null && d > boardingSeq) return d;
      const next = stops.find((s) => s.seq > boardingSeq);
      return next ? next.seq : d;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardingSeq]);
  const status =
    reachedStop && tracked.state !== "arrive_now"
      ? { ...tracked, state: "arrived" as const }
      : tracked;

  // Proactive alert: chime once when entering "approaching".
  const alertedRef = useRef(false);
  useEffect(() => {
    if (status.state === "approaching" && !alertedRef.current) {
      alertedRef.current = true;
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      speakPhrase("chime", "就到喇！", personaKey);
    }
    if (status.state === "riding") alertedRef.current = false;
  }, [status.state]);

  // Live minibus ETA (Toolhub transit_eta) at the BOARDING stop — that's
  // where the user is waiting to catch it. Refreshes every 30 s.
  useEffect(() => {
    if (!routeRef) return;
    const anchor = stops.find((s) => s.seq === boardingSeq) ?? stops[0];
    if (!anchor) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const e = await getRouteEta(routeRef, anchor.lat, anchor.lng);
        if (!cancelled) setEta(e);
      } catch {
        // ETA is decorative — never break the ride view over it
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [routeRef, stops, boardingSeq]);

  const speak = useCallback(
    async (phrase: Phrase) => {
      setSpeaking(phrase.id);
      try {
        await speakPhrase(phrase.id, phrase.cantonese, personaKey);
      } finally {
        setTimeout(() => setSpeaking(null), 600);
      }
    },
    [personaKey],
  );

  const listenToDriver = useCallback(async () => {
    setListening(true);
    setListenError(null);
    setDriverReply(null);
    try {
      const transcript = await listenCantonese();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "translation failed");
      setDriverReply({ transcript, ...data });
    } catch (e) {
      setListenError(e instanceof Error ? e.message : "Could not listen");
    } finally {
      setListening(false);
    }
  }, []);

  const label = STATE_LABEL[status.state];
  const primaryPhrase = MINIBUS_PHRASES.find((p) => p.primary)!;
  const otherPhrases = MINIBUS_PHRASES.filter((p) => !p.primary);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-slate-500">
          ← Yau Lok!
        </Link>
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => {
              setDemoMode((d) => !d);
              sim.reset();
            }}
            className={`rounded-full px-3 py-1 font-medium ${
              demoMode ? "bg-indigo-600 text-white" : "bg-slate-200"
            }`}
          >
            {demoMode ? "Demo ride" : "Live GPS"}
          </button>
          <button
            onClick={() => setCoachMode((c) => !c)}
            className={`rounded-full px-3 py-1 font-medium ${
              coachMode ? "bg-teal-600 text-white" : "bg-slate-200"
            }`}
          >
            Coach
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {routeName}
        </p>
        <div className="mt-2 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-lg border border-slate-300 p-2 text-sm"
            placeholder="GMB route code, e.g. 5"
            value={routeCode}
            onChange={(e) => setRouteCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadRoute()}
          />
          <button
            onClick={loadRoute}
            disabled={routeLoading || !routeCode.trim()}
            className="rounded-lg bg-slate-900 px-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {routeLoading ? "Loading…" : "Load route"}
          </button>
        </div>
        {routeError && (
          <p className="mt-1 text-sm text-red-600">{routeError}</p>
        )}
        <label className="mt-2 block text-sm">
          Get on at
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 p-2"
            value={boardingSeq}
            onChange={(e) => setBoardingSeq(Number(e.target.value))}
          >
            {stops.slice(0, -1).map((s) => (
              <option key={s.seq} value={s.seq}>
                {s.name.en} · {s.name.tc}
              </option>
            ))}
          </select>
        </label>
        {eta && eta.etaMinutes.length > 0 && (
          <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-900">
            🚐 Next minibus at your stop:{" "}
            <span className="font-semibold">
              {eta.etaMinutes.slice(0, 3).map((m) => `${m} min`).join(", ")}
            </span>
            <span className="ml-1 text-xs text-emerald-700">
              live · Toolhub transit_eta
            </span>
          </p>
        )}
        <label className="mt-2 block text-sm">
          Get off at
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 p-2"
            value={destinationSeq ?? ""}
            onChange={(e) => setDestinationSeq(Number(e.target.value))}
          >
            {stops
              .filter((s) => s.seq > boardingSeq)
              .map((s) => (
                <option key={s.seq} value={s.seq}>
                  {s.name.en} · {s.name.tc}
                </option>
              ))}
          </select>
        </label>
        <label className="mt-2 block text-sm">
          Voice
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 p-2"
            value={personaKey}
            onChange={(e) => pickPersona(e.target.value)}
          >
            {VOICE_PERSONAS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {!demoMode && gps.error && (
          <p className="mt-2 text-sm text-red-600">GPS: {gps.error}</p>
        )}
      </section>

      <RideMap
        stops={stops}
        path={routePath}
        position={position}
        boardingSeq={boardingSeq}
        destinationSeq={destinationSeq}
        riding={boarded}
      />

      {!boarded ? (
        <button
          onClick={() => setBoarded(true)}
          className="rounded-2xl bg-indigo-600 p-4 text-center text-lg font-semibold text-white shadow-lg transition active:scale-95"
        >
          🚐 I&apos;m on board — start tracking
          <span className="block text-sm font-normal opacity-80">
            waiting at {stops[boardingIdx]?.name.en}
          </span>
        </button>
      ) : (
      <section
        className={`rounded-2xl p-4 text-center font-semibold ${label.className}`}
      >
        <p className="text-lg">{label.text}</p>
        {status.distanceM !== null && (
          <p className="mt-1 text-sm font-normal">
            {Math.round(status.distanceM)} m to {status.destination?.name.en}
            {status.nearestStop && (
              <> · near {status.nearestStop.name.en}</>
            )}
            {status.destination &&
              status.nearestStop &&
              status.destination.seq - status.nearestStop.seq > 0 &&
              status.state !== "arrived" && (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-semibold">
                    {status.destination.seq - status.nearestStop.seq}{" "}
                    {status.destination.seq - status.nearestStop.seq === 1
                      ? "stop"
                      : "stops"}{" "}
                    to go
                  </span>
                </>
              )}
          </p>
        )}
        {demoMode && (
          <p className="mt-1 text-xs font-normal opacity-70">
            simulated ride · {Math.round(sim.progress * 100)}% of route
          </p>
        )}
        {status.state === "arrived" && (
          <button
            onClick={() => {
              setBoarded(false);
              setReachedStop(false);
              sim.reset();
            }}
            className="mt-2 rounded-lg bg-white/70 px-3 py-1 text-sm font-medium"
          >
            ↺ New ride
          </button>
        )}
      </section>
      )}

      <button
        onClick={() => speak(primaryPhrase)}
        className={`rounded-3xl p-6 text-center shadow-lg transition active:scale-95 ${
          status.state === "arrive_now" || status.state === "approaching"
            ? "bg-red-600 text-white"
            : "bg-slate-900 text-white"
        } ${speaking === primaryPhrase.id ? "ring-4 ring-amber-400" : ""}`}
      >
        <span className="block text-3xl font-bold">
          {primaryPhrase.cantonese}
        </span>
        {coachMode && (
          <span className="mt-1 block text-sm opacity-80">
            {primaryPhrase.jyutping}
          </span>
        )}
        <span className="mt-1 block text-sm opacity-80">
          {primaryPhrase.english} · tap to speak for me
        </span>
      </button>

      <section className="grid grid-cols-2 gap-2">
        {otherPhrases.map((p) => (
          <button
            key={p.id}
            onClick={() => speak(p)}
            className={`rounded-xl border border-slate-200 p-3 text-left text-sm transition active:scale-95 ${
              speaking === p.id ? "ring-2 ring-amber-400" : ""
            }`}
          >
            <span className="block font-semibold">{p.cantonese}</span>
            {coachMode && (
              <span className="block text-xs text-slate-500">{p.jyutping}</span>
            )}
            <span className="block text-xs text-slate-500">{p.english}</span>
          </button>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 p-4">
        <button
          onClick={listenToDriver}
          disabled={listening}
          className="w-full rounded-xl bg-indigo-600 p-3 font-semibold text-white transition active:scale-95 disabled:opacity-60"
        >
          {listening ? "Listening…" : "🎤 The driver said something"}
        </button>
        {listenError && (
          <p className="mt-2 text-sm text-red-600">{listenError}</p>
        )}
        {driverReply && (
          <div className="mt-3 space-y-2 text-sm">
            <p className="text-slate-500">Heard: {driverReply.transcript}</p>
            <p className="font-semibold">{driverReply.english}</p>
            {driverReply.reply_cantonese && (
              <button
                onClick={() =>
                  speakCantonese(driverReply.reply_cantonese, personaKey)
                }
                className="w-full rounded-lg bg-slate-100 p-2 text-left"
              >
                <span className="block font-semibold">
                  Reply: {driverReply.reply_cantonese}
                </span>
                <span className="block text-xs text-slate-500">
                  {driverReply.reply_english} · tap to speak
                </span>
              </button>
            )}
          </div>
        )}
      </section>

      <p className="pb-4 text-center text-xs text-slate-400">
        Alert fires {APPROACH_RADIUS_M} m before your stop · phrases spoken in
        colloquial Cantonese
      </p>
    </main>
  );
}
