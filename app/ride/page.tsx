"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DEMO_ROUTE_NAME, DEMO_STOPS } from "@/data/demo-route";
import { MINIBUS_PHRASES, type Phrase } from "@/data/phrases";
import { useGeolocation, useWakeLock } from "@/hooks/useGeolocation";
import {
  useRideTracker,
  APPROACH_RADIUS_M,
  type RideState,
  type Stop,
} from "@/hooks/useRideTracker";
import {
  getBusRoute,
  getRoadShape,
  getRouteEta,
  type RouteEta,
} from "@/lib/toolhub";
import { VOICE_PERSONAS, DEFAULT_PERSONA_KEY } from "@/data/voices";
import RideMap from "@/components/RideMap";
import { haversineMeters, lerp, type LatLng } from "@/lib/geo";
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

type ToolId = "phrases" | "say" | "listen" | "voice";

const TOOLS: { id: ToolId; label: string }[] = [
  { id: "phrases", label: "🗣️ Ask the driver" },
  { id: "say", label: "✍️ Say anything · AI" },
  { id: "listen", label: "🎤 Listen" },
  { id: "voice", label: "🔊 Voice" },
];

type SayResult = {
  cantonese: string;
  jyutping: string;
  english: string;
  note?: string;
};

// Demo mode drives a simulated position along the stop polyline, so the
// full journey can be shown indoors at pitch time. The bus moves at a
// realistic urban minibus speed, played back as a labelled time-lapse
// (distance-based, so long segments aren't warp-speed). Progress is
// wall-clock based so background-tab throttling can't stall it.
export const SIM_SPEED_KMH = 20;
export const SIM_TIMELAPSE = 12;

function useSimulatedRide(active: boolean, path: LatLng[]) {
  const [progress, setProgress] = useState(0); // 0..1 across whole route
  const startRef = useRef<number | null>(null);

  // Cumulative distance along the polyline the bus actually drives.
  const geom = useMemo(() => {
    const cum: number[] = [0];
    for (let i = 1; i < path.length; i++) {
      cum.push(cum[i - 1] + haversineMeters(path[i - 1], path[i]));
    }
    return { cum, total: cum[cum.length - 1] ?? 0 };
  }, [path]);
  const durationMs = Math.max(
    10_000,
    (geom.total / ((SIM_SPEED_KMH / 3.6) * SIM_TIMELAPSE)) * 1000,
  );

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
      setProgress(Math.min(1, elapsed / durationMs));
    }, 250);
    return () => clearInterval(id);
  }, [active, durationMs]);

  const position: LatLng | null =
    active && path.length >= 2 && geom.total > 0
      ? (() => {
          const d = progress * geom.total;
          let i = 0;
          while (i < path.length - 2 && geom.cum[i + 1] < d) i++;
          const segLen = geom.cum[i + 1] - geom.cum[i] || 1;
          return lerp(path[i], path[i + 1], (d - geom.cum[i]) / segLen);
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
  const [boardingSeq, setBoardingSeq] = useState(DEMO_STOPS[0].seq);
  const [destinationSeq, setDestinationSeq] = useState<number | null>(
    DEMO_STOPS[DEMO_STOPS.length - 1].seq,
  );
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
  // "Say anything": free text → HKGAI Cantonese → HKGAI speech
  const [sayText, setSayText] = useState("");
  const [sayResult, setSayResult] = useState<SayResult | null>(null);
  const [sayLoading, setSayLoading] = useState(false);
  const [sayError, setSayError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
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

  // Trace the real road shape for whatever stops are loaded (Toolhub only
  // has stop-to-stop fallback lines for GMB). Toolhub/straight lines remain
  // the fallback if OSRM is unreachable.
  useEffect(() => {
    if (stops.length < 2) return;
    let cancelled = false;
    getRoadShape(stops)
      .then((shape) => {
        if (!cancelled) setRoutePath(shape);
      })
      .catch(() => {
        // keep the existing (fallback) path
      });
    return () => {
      cancelled = true;
    };
  }, [stops]);

  // The simulated ride starts at the boarding stop, not the route origin.
  const boardingIdx = Math.max(
    0,
    stops.findIndex((s) => s.seq === boardingSeq),
  );
  // Drive the simulation along the real road polyline from the boarding stop
  // onward — interpolating between stops would cut corners across buildings.
  const ridePath = useMemo<LatLng[]>(() => {
    const board = stops[boardingIdx];
    if (!board) return [];
    if (routePath.length >= 2) {
      let nearest = 0;
      let nearestD = Infinity;
      routePath.forEach(([lat, lng], i) => {
        const d = haversineMeters({ lat, lng }, board);
        if (d < nearestD) {
          nearestD = d;
          nearest = i;
        }
      });
      const sliced = routePath.slice(nearest);
      if (sliced.length >= 2) return sliced.map(([lat, lng]) => ({ lat, lng }));
    }
    // Fallback: straight lines between stops (OSRM unavailable)
    return stops.slice(boardingIdx).map((s) => ({ lat: s.lat, lng: s.lng }));
  }, [routePath, stops, boardingIdx]);

  // The (simulated) ride only moves once the user says they're on board.
  const sim = useSimulatedRide(demoMode && boarded, ridePath);
  const gps = useGeolocation(!demoMode);
  const position = demoMode
    ? (sim.position ?? stops[boardingIdx] ?? null)
    : gps.position;
  // Phone GPS dies when the screen sleeps — hold a wake lock during the ride.
  useWakeLock(boarded && !demoMode);

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

  // Pre-boarding is ETA-driven, not position-driven: the GMB feed has no
  // vehicle GPS, so we never draw a guessed bus. When the ETA hits ≤1 min,
  // alert the user to get ready to board.
  const boardAlertRef = useRef(false);
  useEffect(() => {
    if (boarded) {
      boardAlertRef.current = false;
      return;
    }
    if (
      !boardAlertRef.current &&
      eta &&
      eta.etaMinutes.length > 0 &&
      eta.etaMinutes[0] <= 1
    ) {
      boardAlertRef.current = true;
      if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
      speakPhrase("bus-coming", "車嚟喇，準備上車！", personaKey);
    }
  }, [eta, boarded, personaKey]);

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

  // Type anything → HKGAI turns it into colloquial Cantonese → speak it.
  const sayIt = useCallback(async () => {
    const text = sayText.trim();
    if (!text) return;
    setSayLoading(true);
    setSayError(null);
    setSayResult(null);
    try {
      const res = await fetch("/api/say", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "could not translate");
      setSayResult(data);
      // Speak immediately — that's the whole point
      await speakCantonese(data.cantonese, personaKey);
    } catch (e) {
      setSayError(e instanceof Error ? e.message : "Could not translate");
    } finally {
      setSayLoading(false);
    }
  }, [sayText, personaKey]);

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
  // Surface the phrases that match the moment: boarding questions while
  // you wait, "let me off here" variants once you're riding.
  const boardingPhrases = MINIBUS_PHRASES.filter(
    (p) => p.context === "boarding",
  );
  const ridingPhrases = MINIBUS_PHRASES.filter(
    (p) => !p.primary && p.context !== "boarding",
  );
  const urgent =
    status.state === "arrive_now" || status.state === "approaching";
  const routeLoaded = routeRef !== null;
  const stopsToGo =
    status.destination && status.nearestStop
      ? status.destination.seq - status.nearestStop.seq
      : null;

  const phraseButton = (p: Phrase, compact = false) => (
    <button
      key={p.id}
      onClick={() => speak(p)}
      className={`rounded-xl border border-slate-200 bg-white p-3 text-left transition active:scale-95 ${
        compact ? "min-w-[10.5rem] shrink-0" : ""
      } ${speaking === p.id ? "ring-2 ring-amber-400" : ""}`}
    >
      <span className="block text-base font-semibold">{p.cantonese}</span>
      {coachMode && (
        <span className="block text-xs text-slate-500">{p.jyutping}</span>
      )}
      <span className="block text-xs text-slate-500">{p.english}</span>
    </button>
  );

  const composer = (
    <section className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Say anything · AI
      </p>
      <p className="mt-0.5 text-xs text-slate-500">
        Type in English — HKGAI turns it into what a local would actually say,
        then speaks it out loud.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-lg border border-slate-300 p-2.5 text-base"
          placeholder="e.g. stop after the temple, I have a big suitcase"
          value={sayText}
          onChange={(e) => setSayText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sayIt()}
        />
        <button
          onClick={sayIt}
          disabled={sayLoading || !sayText.trim()}
          className="rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          {sayLoading ? "…" : "Say it"}
        </button>
      </div>
      {sayError && <p className="mt-2 text-sm text-red-600">{sayError}</p>}
      {sayResult && (
        <button
          onClick={() => speakCantonese(sayResult.cantonese, personaKey)}
          className="mt-2 w-full rounded-xl bg-slate-900 p-3 text-center text-white transition active:scale-95"
        >
          <span className="block text-2xl font-bold">
            {sayResult.cantonese}
          </span>
          {coachMode && (
            <span className="mt-0.5 block text-xs opacity-80">
              {sayResult.jyutping}
            </span>
          )}
          <span className="mt-0.5 block text-xs opacity-80">
            {sayResult.english} · tap to repeat
          </span>
        </button>
      )}
      {sayResult?.note && (
        <p className="mt-1.5 text-xs text-slate-500">💡 {sayResult.note}</p>
      )}
    </section>
  );

  const micPanel = (
    <section className="rounded-2xl border border-slate-200 bg-white p-3">
      <button
        onClick={listenToDriver}
        disabled={listening}
        className="w-full rounded-xl bg-indigo-600 p-3 font-semibold text-white transition active:scale-95 disabled:opacity-60"
      >
        {listening ? "Listening…" : "🎤 The driver said something"}
      </button>
      {listenError && <p className="mt-2 text-sm text-red-600">{listenError}</p>}
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
  );

  const header = (
    <header className="flex shrink-0 items-center justify-between">
      <Link href="/" className="text-sm font-medium text-slate-500">
        ← Yau Lok!
      </Link>
      <div className="flex gap-2 text-xs">
        <button
          onClick={() => {
            setDemoMode((d) => !d);
            sim.reset();
          }}
          className={`rounded-full px-3 py-1.5 font-medium ${
            demoMode ? "bg-indigo-600 text-white" : "bg-slate-900 text-white"
          }`}
        >
          {demoMode ? "Demo ride" : "Live GPS"}
        </button>
        <button
          onClick={() => setCoachMode((c) => !c)}
          className={`rounded-full px-3 py-1.5 font-medium ${
            coachMode ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-700"
          }`}
        >
          Coach
        </button>
      </div>
    </header>
  );

  const shoutButton = (
    <button
      onClick={() => speak(primaryPhrase)}
      className={`w-full rounded-3xl text-center shadow-lg transition active:scale-95 ${
        status.state === "arrive_now"
          ? "animate-pulse bg-red-600 p-7 text-white"
          : status.state === "approaching"
            ? "bg-red-600 p-6 text-white"
            : "bg-slate-900 p-5 text-white"
      } ${speaking === primaryPhrase.id ? "ring-4 ring-amber-400" : ""}`}
    >
      <span
        className={`block font-bold ${
          status.state === "arrive_now" ? "text-4xl" : "text-3xl"
        }`}
      >
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
  );

  // ---- Riding: map-first, one primary action pinned in the thumb zone ----
  if (boarded) {
    return (
      <main className="mx-auto flex h-dvh max-w-md flex-col gap-3 overflow-x-hidden p-4">
        {header}

        <button
          onClick={() => setBoarded(false)}
          className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-500"
        >
          {routeName.replace(" (live via Toolhub)", "")}
          <span className="mt-0.5 block font-medium text-slate-800">
            {stops[boardingIdx]?.name.en} → {status.destination?.name.en}
            <span className="ml-1 font-normal text-indigo-600">· change</span>
          </span>
        </button>

        <section
          className={`shrink-0 rounded-2xl p-3 text-center font-semibold ${label.className}`}
        >
          <p className="text-lg">{label.text}</p>
          {status.distanceM !== null && (
            <p className="mt-0.5 text-sm font-normal">
              {Math.round(status.distanceM)} m
              {stopsToGo !== null &&
                stopsToGo > 0 &&
                status.state !== "arrived" && (
                  <>
                    {" "}
                    · <span className="font-semibold">
                      {stopsToGo} {stopsToGo === 1 ? "stop" : "stops"} to go
                    </span>
                  </>
                )}
            </p>
          )}
          <p className="mt-0.5 text-xs font-normal opacity-70">
            {demoMode
              ? `simulated · ${Math.round(sim.progress * 100)}% · ${SIM_SPEED_KMH} km/h at ×${SIM_TIMELAPSE}`
              : gps.position
                ? `live GPS · ±${Math.round(gps.accuracy ?? 0)} m · screen awake`
                : "waiting for GPS fix…"}
          </p>
          {status.state === "arrived" && (
            <button
              onClick={() => {
                setBoarded(false);
                setReachedStop(false);
                sim.reset();
              }}
              className="mt-2 rounded-lg bg-white/70 px-3 py-1.5 text-sm font-medium"
            >
              ↺ New ride
            </button>
          )}
        </section>

        <RideMap
          stops={stops}
          path={routePath}
          position={position}
          boardingSeq={boardingSeq}
          destinationSeq={destinationSeq}
          riding
          tall
          urgent={urgent}
          accuracyM={demoMode ? null : gps.accuracy}
        />

        {/* Pinned action zone: thumb-reachable, no scrolling to shout */}
        <div className="w-full min-w-0 shrink-0 space-y-2 pb-[env(safe-area-inset-bottom)]">
          {shoutButton}
          <div className="-mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-1">
            {ridingPhrases.map((p) => phraseButton(p, true))}
            <button
              onClick={() => setComposerOpen((o) => !o)}
              className={`min-w-[10.5rem] shrink-0 rounded-xl p-3 text-left text-sm font-semibold transition active:scale-95 ${
                composerOpen
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white"
              }`}
            >
              ✍️ Say something else
              <span className="mt-0.5 block text-xs font-normal opacity-70">
                type it, AI speaks it
              </span>
            </button>
            <button
              onClick={listenToDriver}
              disabled={listening}
              className="min-w-[10.5rem] shrink-0 rounded-xl bg-indigo-600 p-3 text-left text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60"
            >
              {listening ? "Listening…" : "🎤 Driver said something"}
            </button>
          </div>
          {composerOpen && composer}
          {driverReply && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <p className="font-semibold">{driverReply.english}</p>
              {driverReply.reply_cantonese && (
                <button
                  onClick={() =>
                    speakCantonese(driverReply.reply_cantonese, personaKey)
                  }
                  className="mt-1 w-full rounded-lg bg-slate-100 p-2 text-left"
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
          {listenError && (
            <p className="text-center text-sm text-red-600">{listenError}</p>
          )}
        </div>
      </main>
    );
  }

  // ---- Waiting: set up the journey, watch the ETA ----
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      {header}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {routeName}
        </p>
        <div className="mt-2 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-lg border border-slate-300 p-2.5 text-base"
            placeholder="GMB route code, e.g. 4C"
            value={routeCode}
            onChange={(e) => setRouteCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadRoute()}
          />
          <button
            onClick={loadRoute}
            disabled={routeLoading || !routeCode.trim()}
            className="rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-40"
          >
            {routeLoading ? "Loading…" : "Load"}
          </button>
        </div>
        {!routeLoaded && !routeLoading && !routeError && (
          <p className="mt-2 text-xs text-slate-500">
            Bundled route snapshot — load it live for real-time arrivals. Try{" "}
            <button
              onClick={() => setRouteCode("4C")}
              className="font-semibold text-indigo-600 underline"
            >
              4C
            </button>{" "}
            or{" "}
            <button
              onClick={() => setRouteCode("5")}
              className="font-semibold text-indigo-600 underline"
            >
              5
            </button>{" "}
            (Hong Kong Island).
          </p>
        )}
        {routeLoading && (
          <div className="mt-3 space-y-2">
            <div className="h-9 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-9 animate-pulse rounded-lg bg-slate-100" />
          </div>
        )}
        {routeError && <p className="mt-2 text-sm text-red-600">{routeError}</p>}

        <label className="mt-3 block text-sm font-medium">
          Get on at
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-base font-normal"
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

        {eta && eta.etaMinutes.length > 0 ? (
          <p className="mt-2 rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-900">
            🚐 Next minibus:{" "}
            <span className="font-semibold">
              {eta.etaMinutes
                .slice(0, 3)
                .map((m) => (m <= 0 ? "now" : `${m} min`))
                .join(" · ")}
            </span>
            <span className="mt-0.5 block text-xs text-emerald-700">
              live from HKGAI Toolhub · updates every 30s
            </span>
          </p>
        ) : routeLoaded ? (
          <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500">
            No live arrivals right now — service may have ended for today, or
            this stop has no real-time feed.
          </p>
        ) : null}

        <label className="mt-3 block text-sm font-medium">
          Get off at
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-base font-normal"
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
        riding={false}
        accuracyM={null}
        waitingEtaLabel={
          eta && eta.etaMinutes.length > 0
            ? `🚐 ${eta.etaMinutes[0] <= 0 ? "arriving now" : `${eta.etaMinutes[0]} min`}`
            : null
        }
      />

      <button
        onClick={() => setBoarded(true)}
        className="rounded-2xl bg-indigo-600 p-5 text-center text-lg font-semibold text-white shadow-lg transition active:scale-95"
      >
        🚐 I&apos;m on board — start tracking
        <span className="mt-0.5 block text-sm font-normal opacity-85">
          waiting at {stops[boardingIdx]?.name.en}
        </span>
      </button>

      {/* Secondary tools stay one tap away instead of stacked on the page */}
      <section>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() =>
                setActiveTool((cur) => (cur === t.id ? null : t.id))
              }
              className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition active:scale-95 ${
                activeTool === t.id
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-2">
          {activeTool === "phrases" && (
            <div className="grid grid-cols-1 gap-2">
              {boardingPhrases.map((p) => phraseButton(p))}
            </div>
          )}
          {activeTool === "say" && composer}
          {activeTool === "listen" && micPanel}
          {activeTool === "voice" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-3">
              <label className="block text-sm font-medium">
                Cantonese voice
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-base font-normal"
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
              <p className="mt-1.5 text-xs text-slate-500">
                Six HKGAI Cantonese voices — picking one plays a sample.
              </p>
            </section>
          )}
        </div>
      </section>

      <p className="pb-4 text-center text-xs text-slate-400">
        Alert fires {APPROACH_RADIUS_M} m before your stop · phrases spoken in
        colloquial Cantonese by HKGAI
      </p>
    </main>
  );
}
