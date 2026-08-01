"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DEMO_ROUTE_NAME, DEMO_STOPS } from "@/data/demo-route";
import { MINIBUS_PHRASES, type Phrase } from "@/data/phrases";
import { useGeolocation, useWakeLock } from "@/hooks/useGeolocation";
import {
  useRideTracker,
  type RideState,
  type Stop,
} from "@/hooks/useRideTracker";
import {
  getBusRoute,
  getRoadShape,
  getFacilities,
  getRouteEta,
  getStopFare,
  getWeather,
  loadRouteForLeg,
  type Facility,
  type WeatherNow,
  planJourney,
  sortMinibusFirst,
  type JourneyLeg,
  type JourneyOption,
  type RouteEta,
} from "@/lib/toolhub";
import { VOICE_PERSONAS, DEFAULT_PERSONA_KEY, getPersona } from "@/data/voices";
import {
  USER_LANGUAGES,
  DEFAULT_LANGUAGE_CODE,
  getLanguage,
} from "@/data/languages";
import type { LucideIcon } from "lucide-react";
import RideMap from "@/components/RideMap";
import LedBoard from "@/components/LedBoard";
import {
  Screen,
  Segmented,
  Card,
  SectionLabel,
  PressButton,
  StatTile,
  InfoTile,
  BottomBar,
} from "@/components/ui";
import StopTimeline from "@/components/StopTimeline";
import {
  Bus,
  MapPin,
  Flag,
  Mic,
  Pencil,
  Volume2,
  MessagesSquare,
  Toilet,
  Signpost,
  Target,
  PersonStanding,
  Coins,
  Umbrella,
  CloudSun,
  RotateCcw,
  Radio,
  Lightbulb,
  ShoppingBasket,
  Globe,
  Star,
  X,
  TriangleAlert,
  ChevronLeft,
} from "lucide-react";
import { useT, useStopName, useSimplify } from "@/lib/i18n";
import { weatherKey } from "@/lib/weather-text";
import { useAlertSettings, usePersona, useSavedRoutes } from "@/lib/prefs";
import { usePublishActiveRide } from "@/hooks/useActiveRide";
import SelectField from "@/components/SelectField";
import { haversineMeters, lerp, type LatLng } from "@/lib/geo";
import {
  friendlyMicError,
  listenCantonese,
  listenUserSpeech,
  speakCantonese,
  speakPhrase,
} from "@/lib/speech";

const STATE_LABEL: Record<
  RideState,
  { key: string; tone: "green" | "amber" | "red" | "neutral" }
> = {
  riding: { key: "ride.onTheWay", tone: "green" },
  approaching: { key: "ride.comingUp", tone: "amber" },
  arrive_now: { key: "ride.shoutNow", tone: "red" },
  arrived: { key: "ride.arrived", tone: "neutral" },
};

type DriverReply = {
  transcript: string;
  english: string;
  reply_cantonese: string;
  reply_english: string;
};

type ToolId = "phrases" | "say" | "listen" | "nearby" | "voice";

const TOOLS: { id: ToolId; key: string; Icon: LucideIcon }[] = [
  { id: "phrases", key: "tool.askDriver", Icon: MessagesSquare },
  { id: "say", key: "tool.sayAnything", Icon: Pencil },
  { id: "listen", key: "tool.listen", Icon: Mic },
  { id: "nearby", key: "tool.nearby", Icon: Toilet },
  { id: "voice", key: "tool.voice", Icon: Volume2 },
];

type SayResult = {
  cantonese: string;
  jyutping: string;
  /** Back-translation, written in the user's own language */
  back: string;
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
  const t = useT();
  // Stop names lead in the reader's language; the other half stays as a
  // sub-line so the kerbside sign is still recognisable.
  const stopName = useStopName();
  const sc = useSimplify();
  const [demoMode, setDemoMode] = useState(true);
  const [boardingSeq, setBoardingSeq] = useState(DEMO_STOPS[0].seq);
  const [destinationSeq, setDestinationSeq] = useState<number | null>(
    DEMO_STOPS[DEMO_STOPS.length - 1].seq,
  );
  // Has the user actually gotten on the minibus? Tracking starts here.
  const [boarded, setBoarded] = useState(false);
  const [personaKey, setPersonaKey] = usePersona(DEFAULT_PERSONA_KEY);
  const pickPersona = useCallback(
    (key: string) => {
      setPersonaKey(key);
      // Instant preview so the choice is audible
      speakPhrase("yau-lok", "唔該，有落！", key);
    },
    [setPersonaKey],
  );
  // §5/08 lives in localStorage, so the header toggle and the settings screen
  // are two views of the same preference.
  const {
    distanceM: alertDistanceM,
    vibrate: vibrateOn,
    coach: coachMode,
    setCoach: setCoachMode,
  } = useAlertSettings();
  const { isSaved, toggle: toggleSaved, remember } = useSavedRoutes();
  // The home screen cannot see this component's state, so a running ride is
  // published for it to read.
  const publishRide = usePublishActiveRide();
  const [speaking, setSpeaking] = useState<string | null>(null);
  // §5/06 arrival sheet — opened by the proactive alert, dismissible by hand.
  const [alertOpen, setAlertOpen] = useState(false);
  // Has the rider committed to a boarding stop? That is what separates the
  // route screen (§5/03) from waiting at the kerb (§5/04).
  const [confirmedStop, setConfirmedStop] = useState(false);
  const [listening, setListening] = useState(false);
  // "Say anything": free text → HKGAI Cantonese → HKGAI speech
  const [sayText, setSayText] = useState("");
  const [sayResult, setSayResult] = useState<SayResult | null>(null);
  const [sayLoading, setSayLoading] = useState(false);
  const [sayListening, setSayListening] = useState(false);
  const [sayError, setSayError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [langCode, setLangCode] = useState(DEFAULT_LANGUAGE_CODE);
  useEffect(() => {
    const saved = localStorage.getItem("yau-lok-lang");
    if (saved && USER_LANGUAGES.some((l) => l.code === saved)) setLangCode(saved);
  }, []);
  const pickLanguage = useCallback((code: string) => {
    setLangCode(code);
    localStorage.setItem("yau-lok-lang", code);
  }, []);
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
  // Ride minutes as reported by the journey planner, when the route came
  // from one. Never estimated — an invented number here would be a lie.
  const [legMinutes, setLegMinutes] = useState<number | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [eta, setEta] = useState<RouteEta | null>(null);
  // When the current ETA was read, so the mm:ss board counts down from it
  // rather than sitting frozen for 30 s at a time.
  const [etaFetchedAt, setEtaFetchedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Destination-first planning: name a place, we work out the minibus.
  const [destQuery, setDestQuery] = useState("");
  const [originQuery, setOriginQuery] = useState("");
  const [planning, setPlanning] = useState(false);
  const [planOptions, setPlanOptions] = useState<JourneyOption[] | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [showRouteCode, setShowRouteCode] = useState(false);
  const [fare, setFare] = useState<number | null>(null);
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [facilities, setFacilities] = useState<Facility[] | null>(null);
  const [facilityType, setFacilityType] = useState<"toilet" | "market">(
    "toilet",
  );
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [serviceInfo, setServiceInfo] = useState<{
    answer: string;
    confident?: boolean;
    sources?: string[];
  } | null>(null);
  const [serviceLoading, setServiceLoading] = useState(false);

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
  const destStop = stops.find((s) => s.seq === destinationSeq) ?? null;
  // Falls back to the demo line's code so the LED board is never blank.
  const displayRouteCode =
    routeRef?.routeCode ?? DEMO_ROUTE_NAME.match(/GMB\s+(\S+)/)?.[1] ?? "--";
  // Stops covered by this leg, inclusive of the one you get off at.
  const stopsBetween =
    destinationSeq !== null ? Math.max(1, destinationSeq - boardingSeq) : null;

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

  // Full road polyline (not the boarding-onward slice) so distance is
  // measured along the road the bus actually drives.
  const fullRoadPath = useMemo<LatLng[]>(
    () => routePath.map(([lat, lng]) => ({ lat, lng })),
    [routePath],
  );
  const planTrip = useCallback(async () => {
    if (!destQuery.trim()) return;
    setPlanning(true);
    setPlanError(null);
    setPlanOptions(null);
    try {
      const origin =
        originQuery.trim().length > 0
          ? { name: originQuery.trim() }
          : gps.position
            ? { lat: gps.position.lat, lng: gps.position.lng }
            : { name: stops[0]?.name.en };
      const options = sortMinibusFirst(await planJourney(origin, {
        name: destQuery.trim(),
      }));
      setPlanOptions(options.slice(0, 4));
      if (options.length === 0) setPlanError("No routes found for that trip.");
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : "Could not plan that trip");
    } finally {
      setPlanning(false);
    }
  }, [destQuery, originQuery, gps.position, stops]);

  // Turn a planned ride leg into a tracked journey.
  const trackLeg = useCallback(
    async (leg: JourneyLeg) => {
      setRouteLoading(true);
      setRouteError(null);
      try {
        const { route, boardingSeq: on, destinationSeq: off } =
          await loadRouteForLeg(leg);
        setStops(route.stops);
        setRoutePath(route.path);
        setRouteName(
          `${route.company.toUpperCase()} ${route.routeCode} · ${route.origEn} → ${route.destEn}`,
        );
        setRouteRef({
          routeId: route.routeId,
          routeCode: route.routeCode,
          company: route.company,
        });
        setLegMinutes(leg.minutes ?? null);
        setEta(null);
        setBoarded(false);
        setBoardingSeq(on);
        setDestinationSeq(off);
        setPlanOptions(null);
        simReset();
      } catch (e) {
        setRouteError(e instanceof Error ? e.message : "Could not load route");
      } finally {
        setRouteLoading(false);
      }
    },
    [simReset],
  );

  // Exact fare for the chosen stop pair — minibuses are cash-heavy and
  // drivers rarely make change, so knowing the amount beforehand matters.
  useEffect(() => {
    if (!routeRef) return;
    const on = stops.find((s) => s.seq === boardingSeq);
    const off = stops.find((s) => s.seq === destinationSeq);
    if (!on || !off) return;
    let cancelled = false;
    getStopFare(routeRef.routeCode, routeRef.company, on.name.tc, off.name.tc)
      .then((f) => {
        if (!cancelled) setFare(f);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [routeRef, stops, boardingSeq, destinationSeq]);

  // Weather at the boarding stop — waiting for a minibus in the rain is
  // the difference between a fine trip and a miserable one.
  useEffect(() => {
    const on = stops.find((s) => s.seq === boardingSeq);
    if (!on) return;
    let cancelled = false;
    // Try the route's origin district and the stop's leading words — full
    // stop names ("… Public Transport Interchange") don't geocode.
    const words = on.name.en.split(/[,(]/)[0].split(/\s+/);
    getWeather(
      routeName.match(/·\s*([^→(]+)/)?.[1]?.trim() ?? "",
      words.slice(0, 3).join(" "),
      words.slice(0, 2).join(" "),
      "Hong Kong",
    )
      .then((w) => {
        if (!cancelled) setWeather(w);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [stops, boardingSeq, routeName]);

  // The Observatory's condition text is Traditional Chinese; translate it
  // when we recognise the wording, otherwise show it as it came.
  const weatherText = (() => {
    if (!weather?.text) return null;
    const key = weatherKey(weather.text);
    return key ? t(key) : sc(weather.text);
  })();

  const loadFacilities = useCallback(
    async (type: "toilet" | "market") => {
      const anchor =
        position ?? stops.find((s) => s.seq === boardingSeq) ?? stops[0];
      if (!anchor) return;
      setFacilityType(type);
      setFacilitiesLoading(true);
      try {
        setFacilities(await getFacilities(type, anchor.lat, anchor.lng));
      } finally {
        setFacilitiesLoading(false);
      }
    },
    [position, stops, boardingSeq],
  );

  // No live ETA doesn't mean "service ended" — ask the open web instead of
  // guessing (Agenthub search + Modelhub summary).
  const checkService = useCallback(async () => {
    if (!routeRef) return;
    setServiceLoading(true);
    setServiceInfo(null);
    try {
      const on = stops.find((s) => s.seq === boardingSeq);
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `Hong Kong ${routeRef.company === "gmb" ? "green minibus" : "bus"} route ${routeRef.routeCode}${
            on ? ` at ${on.name.en}` : ""
          }: what are the first and last departure times, and is it running today?`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "lookup failed");
      setServiceInfo(data);
    } catch (e) {
      setServiceInfo({
        answer: e instanceof Error ? e.message : "Could not check service",
        confident: false,
      });
    } finally {
      setServiceLoading(false);
    }
  }, [routeRef, stops, boardingSeq]);

  const tracked = useRideTracker(
    stops,
    destinationSeq,
    position,
    fullRoadPath,
    alertDistanceM,
  );

  // §5/03 star. A saved route is identified by code + company, so the same
  // line saved from a different leg updates rather than duplicates.
  const routeCompany = routeRef?.company ?? "gmb";
  const routeIsSaved = isSaved(displayRouteCode, routeCompany);
  const currentSavedRoute = useCallback(
    () =>
      destStop && {
        id: routeRef?.routeId ?? `${routeCompany}-${displayRouteCode}`,
        routeCode: displayRouteCode,
        company: routeCompany,
        // Both scripts, so the saved route reads in whatever language the
        // rider is using later — not the one they happened to save it in.
        from: stops[boardingIdx]?.name,
        to: destStop.name,
        fare: fare ?? undefined,
        originLat: stops[boardingIdx]?.lat,
        originLng: stops[boardingIdx]?.lng,
      },
    [routeRef, routeCompany, displayRouteCode, stops, boardingIdx, destStop, fare],
  );
  const saveThisRoute = useCallback(() => {
    const route = currentSavedRoute();
    if (route) toggleSaved(route);
  }, [currentSavedRoute, toggleSaved]);

  const mapStopLabel = useCallback(
    (stop: Stop) => {
      const { primary, secondary } = stopName(stop);
      const role =
        stop.seq === boardingSeq
          ? ` · ${t("ride.getOnAt")}`
          : stop.seq === destinationSeq
            ? ` · ${t("ride.getOffAt")}`
            : "";
      return `${stop.seq}. ${primary}${secondary ? ` (${secondary})` : ""}${role}`;
    },
    [stopName, boardingSeq, destinationSeq, t],
  );

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
      if (vibrateOn && navigator.vibrate) navigator.vibrate([200, 100, 200]);
      speakPhrase("chime", "就到喇！", personaKey);
      setAlertOpen(true);
    }
    if (status.state === "riding") {
      alertedRef.current = false;
      setAlertOpen(false);
    }
    if (status.state === "arrived") setAlertOpen(false);
  }, [status.state]);

  // §7: floor the displayed minute at 1. mm:ss may legitimately show 0:xx,
  // but "0 分" beside 車嚟緊 reads as a broken readout, not an arriving bus.
  const etaMins = (eta?.etaMinutes ?? []).map((m) => Math.max(1, m));
  const etaSecondsLeft =
    etaMins.length > 0 && etaFetchedAt !== null
      ? etaMins[0] * 60 - Math.floor((now - etaFetchedAt) / 1000)
      : null;
  // Past zero the bus is due: say so rather than run the clock negative.
  const etaClock =
    etaSecondsLeft !== null && etaSecondsLeft > 0
      ? `${Math.floor(etaSecondsLeft / 60)}:${String(etaSecondsLeft % 60).padStart(2, "0")}`
      : null;

  // Publish progress for the home screen — only on a real change, so this
  // does not write to storage on every 250 ms tick.
  const publishedRef = useRef<string>("");
  useEffect(() => {
    if (!boarded) return;
    const next = status.nearestStop ?? status.destination;
    const key = `${next?.seq ?? ""}:${status.stopsToGo ?? ""}`;
    if (key === publishedRef.current) return;
    publishedRef.current = key;
    publishRide({
      routeCode: displayRouteCode,
      nextStop: next ? stopName(next).primary : null,
      stopsToGo: status.stopsToGo,
      at: Date.now(),
    });
  }, [boarded, status.nearestStop, status.destination, status.stopsToGo, displayRouteCode, stopName, publishRide]);

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
      etaMins.length > 0 &&
      etaMins[0] <= 1
    ) {
      boardAlertRef.current = true;
      if (vibrateOn && navigator.vibrate) navigator.vibrate([300, 100, 300]);
      speakPhrase("bus-coming", "車嚟喇，準備上車！", personaKey);
    }
  }, [eta, boarded, personaKey]);

  useEffect(() => {
    if (etaFetchedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [etaFetchedAt]);

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
        if (!cancelled) {
          setEta(e);
          setEtaFetchedAt(Date.now());
        }
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

  // Say anything → HKGAI turns it into colloquial Cantonese → speak it.
  const runSay = useCallback(
    async (input: string) => {
      const text = input.trim();
      if (!text) return;
      setSayLoading(true);
      setSayError(null);
      setSayResult(null);
      try {
        const res = await fetch("/api/say", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language: getLanguage(langCode).name }),
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
    },
    [personaKey, langCode],
  );

  const sayIt = useCallback(() => runSay(sayText), [runSay, sayText]);

  // Speak instead of typing: HKGAI ASR handles English too, so the whole
  // round trip (your voice → their language → spoken aloud) is one platform.
  const sayByVoice = useCallback(async () => {
    setSayListening(true);
    setSayError(null);
    setSayResult(null);
    try {
      const heard = await listenUserSpeech(getLanguage(langCode).bcp47);
      setSayText(heard);
      setSayListening(false);
      await runSay(heard);
    } catch (e) {
      setSayError(friendlyMicError(e));
      setSayListening(false);
    }
  }, [runSay, langCode]);

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
  const stopsToGo = status.stopsToGo;

  const phraseButton = (p: Phrase, compact = false) => (
    <button
      key={p.id}
      onClick={() => speak(p)}
      className={`press rounded-xl p-3 text-left ${
        compact
          ? "min-w-[10.5rem] shrink-0 border border-white/20 bg-white/10 text-white"
          : "card"
      } ${speaking === p.id ? "ring-2 ring-[var(--sign-amber)]" : ""}`}
    >
      <span className="sign-zh block text-[15px]">{p.cantonese}</span>
      {coachMode && (
        <span
          className={`block text-xs ${compact ? "text-white/70" : "text-ink-muted"}`}
        >
          {p.jyutping}
        </span>
      )}
      <span
        className={`block text-xs ${compact ? "text-white/70" : "text-ink-muted"}`}
      >
        {p.english}
      </span>
    </button>
  );

  const composer = (
    <section className="card p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {t("say.title")}
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">
{t("say.blurb")}
      </p>

      <label className="mt-2 block">
        <span className="mb-1 block text-xs font-medium text-ink-muted">
          {t("say.iSpeak")}
        </span>
        <span className="field">
          <span className="field-icon"><Globe className="size-5" aria-hidden strokeWidth={2.2} /></span>
          <select
            className="field-select"
            value={langCode}
            onChange={(e) => pickLanguage(e.target.value)}
          >
            {USER_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </span>
      </label>

      <button
        onClick={sayByVoice}
        disabled={sayListening || sayLoading}
        className={`mt-2 w-full rounded-xl p-3.5 text-center font-semibold transition active:scale-95 disabled:opacity-70 ${
          sayListening
            ? "animate-pulse bg-[var(--sign-red)] text-white"
            : "bg-[var(--brand)] text-white shadow-[0_3px_0_0_var(--brand-deep)]"
        }`}
      >
        {sayListening
          ? t("say.listening")
          : sayLoading
            ? t("say.translating")
            : t("say.speak")}
      </button>

      <div className="mt-2 flex gap-2">
        <span className="field min-w-0 flex-1">
          <span className="field-icon">
            <Pencil className="size-5" aria-hidden strokeWidth={2.2} />
          </span>
          <input
            className="field-input"
            placeholder={t("say.typePlaceholder")}
            value={sayText}
            onChange={(e) => setSayText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sayIt()}
          />
        </span>
        <button
          onClick={sayIt}
          disabled={sayLoading || sayListening || !sayText.trim()}
          className="press shrink-0 rounded-xl bg-ink px-4 text-sm font-bold text-white disabled:opacity-40"
        >
          {sayLoading ? "…" : t("say.sayIt")}
        </button>
      </div>
      {sayError && <p className="mt-2 text-sm text-[var(--sign-red)]">{sayError}</p>}
      {sayResult && (
        <button
          onClick={() => speakCantonese(sayResult.cantonese, personaKey)}
          className="mt-2 w-full rounded-xl bg-ink p-3 text-center text-white transition active:scale-95"
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
            {sayResult.back} · {t("say.tapToRepeat")}
          </span>
        </button>
      )}
      {sayResult?.note && (
        <p className="mt-1.5 flex gap-1.5 text-xs text-ink-muted"><Lightbulb className="size-4 shrink-0" aria-hidden />{sayResult.note}</p>
      )}
    </section>
  );

  const micPanel = (
    <section className="card p-3">
      <button
        onClick={listenToDriver}
        disabled={listening}
        className="press min-h-12 w-full rounded-xl bg-[var(--brand)] p-3 font-bold text-white shadow-[0_3px_0_0_var(--brand-deep)] disabled:opacity-60 disabled:shadow-none"
      >
        <span className="flex items-center justify-center gap-2"><Mic className="size-4" aria-hidden />{listening ? t("say.listening") : t("mic.driverSaid")}</span>
      </button>
      {listenError && <p className="mt-2 text-sm text-[var(--sign-red)]">{listenError}</p>}
      {driverReply && (
        <div className="mt-3 space-y-2 text-sm">
          <p className="text-ink-muted">
            {t("mic.heard")}: {driverReply.transcript}
          </p>
          <p className="font-semibold">{driverReply.english}</p>
          {driverReply.reply_cantonese && (
            <button
              onClick={() =>
                speakCantonese(driverReply.reply_cantonese, personaKey)
              }
              className="w-full rounded-lg bg-[var(--paper)] p-2 text-left"
            >
              <span className="block font-semibold">
                {t("mic.reply")}: {driverReply.reply_cantonese}
              </span>
              <span className="block text-xs text-ink-muted">
                {driverReply.reply_english} · {t("mic.tapToSpeak")}
              </span>
            </button>
          )}
        </div>
      )}
    </section>
  );
  // The design gives the journey four screens, not one long page: 02 plan,
  // 03 route detail, 04 waiting at the stop, 05 riding. The phase is derived
  // from what the user has actually done, so there is one source of truth.
  const phase: "plan" | "route" | "waiting" | "riding" = boarded
    ? "riding"
    : confirmedStop
      ? "waiting"
      : routeLoaded || planOptions === null
        ? "route"
        : "route";

  // Demo/live is a safety control, not decoration — the field test rode a
  // whole real minibus in demo mode. Both states stay visible in every header.
  const modeToggle = (compact = false) => (
    <Segmented
      cabin
      value={demoMode ? "demo" : "live"}
      onChange={(v) => {
        const demo = v === "demo";
        if (demoMode === demo) return;
        setDemoMode(demo);
        setBoarded(false);
        sim.reset();
      }}
      options={[
        {
          value: "demo",
          label: compact ? t("common.demoShort") : t("common.demoRide"),
        },
        {
          value: "live",
          label: compact ? t("common.liveShort") : t("common.liveGps"),
        },
      ]}
    />
  );

  const coachToggle = (cabin: boolean) => (
    <button
      onClick={() => setCoachMode(!coachMode)}
      aria-pressed={coachMode}
      className={`min-h-11 rounded-full px-3 text-xs font-bold uppercase tracking-wide ${
        cabin
          ? coachMode
            ? "bg-white/30 text-white"
            : "bg-white/15 text-white"
          : coachMode
            ? "border-2 border-ink bg-ink text-white"
            : "border-2 border-ink bg-white text-ink-muted"
      }`}
    >
      {t("common.coach")}
    </button>
  );

  // The one thing the whole product exists for. Styled as a physical stop
  // button: it sits proud of the page and depresses when pressed.
  const urgentNow = status.state === "arrive_now";
  const shoutButton = (
    <button
      onClick={() => speak(primaryPhrase)}
      className={`press w-full rounded-[26px] bg-[var(--sign-red)] px-4 py-[22px] text-center text-white shadow-[0_5px_0_0_var(--sign-red-deep)] ${
        urgentNow ? "shout-breathe" : ""
      } ${speaking === primaryPhrase.id ? "ring-4 ring-[var(--sign-amber)]" : ""}`}
    >
      <span className="sign-zh block text-[46px] tracking-[0.04em]" lang="zh-HK">
        {primaryPhrase.cantonese}
      </span>
      {coachMode && (
        <span className="mt-2 block text-[14px] font-semibold opacity-90">
          {primaryPhrase.jyutping}
        </span>
      )}
    </button>
  );

  // §5/05 + §5/06 — the amber "now playing" bar. It exists so a rider who
  // cannot hear the phone over the engine can still see that it spoke.
  const speakingToast = speaking && (
    <div
      className="flex items-center justify-center gap-2 rounded-[14px] px-3 py-2.5 text-center text-[15px] font-extrabold"
      style={{ background: "var(--led-on)", color: "var(--led-bg)" }}
    >
      <Volume2 className="size-4 shrink-0" aria-hidden strokeWidth={2.4} />
      {t("ride.spokenBy").replace(
        "{voice}",
        getPersona(personaKey).label.split(" · ")[0],
      )}
    </div>
  );

  const playingToast = speaking && (
    <div
      className="flex items-center justify-center gap-2 rounded-[14px] px-3 py-3 text-center text-[15px] font-extrabold"
      style={{ background: "var(--led-on)", color: "var(--led-bg)" }}
    >
      <Volume2 className="size-4 shrink-0" aria-hidden strokeWidth={2.4} />
      {t("ride.playing").replace("{phrase}", primaryPhrase.cantonese)}
    </div>
  );

  // §5/06 — the arrival alert. On a phone this is a lock-screen notification;
  // in the app it is the same card, over the ride, the moment the stop is in
  // range. One tap on it shouts, so the rider never has to hunt for the button.
  // Leaving the ride puts you back at the kerb with the route still loaded,
  // which is where you would want to start again from.
  const endRide = useCallback(() => {
    publishRide(null);
    setBoarded(false);
    setConfirmedStop(false);
    setReachedStop(false);
    setAlertOpen(false);
    setComposerOpen(false);
    setDriverReply(null);
    simReset();
  }, [simReset, publishRide]);

  // §5/06 is a full-screen takeover, the way a lock-screen notification is:
  // the clock above, the notification below, the ride dimmed out behind.
  const alertSheet = alertOpen && status.destination && (
    <div
      className="fixed inset-0 z-[2000] flex flex-col items-center justify-between px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(3.5rem,env(safe-area-inset-top))]"
      style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #0b3729 100%)" }}
    >
      <div className="pointer-events-none text-center text-white">
        <p className="text-[16px] font-medium opacity-75">
          {new Date().toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            weekday: "long",
          })}
        </p>
        <p className="mt-1.5 text-[64px] font-extralight leading-none tracking-[-0.02em]">
          {new Date().toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
      <div
        role="alertdialog"
        aria-label={t("alert.title")}
        className="max-h-[70dvh] w-full max-w-md overflow-y-auto rounded-[22px] border border-white/[.18] bg-white/[.14] p-4 text-white shadow-2xl backdrop-blur-sm"
      >
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-[22px] shrink-0 items-center justify-center rounded-[6px]"
            style={{
              background: "var(--brand)",
              color: "var(--led-on)",
              fontFamily: "var(--font-dot), monospace",
              fontSize: 11,
            }}
          >
            落
          </span>
          <span
            className="flex-1 text-[12px] font-bold tracking-[0.06em] text-white/75"
          >
            YAU LOK 有落 · {t("alert.now")}
          </span>
          <button
            onClick={() => setAlertOpen(false)}
            aria-label={t("alert.dismiss")}
            className="-m-2 flex size-11 items-center justify-center text-white/70"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {/* The alert speaks in the same LED voice as the windscreen board. */}
        <div className="led led-dots mt-3 rounded-[10px] px-3.5 py-3.5">
          <p
            className="led-glow text-[30px] leading-[1.25]"
            style={{ color: "var(--led-on)" }}
          >
            {t("alert.title")}
            <br />
            {t("alert.subtitle")}
          </p>
        </div>

        <p className="mt-3 text-[15px] leading-relaxed text-white">
          {/* Once you are at the stop, metres are noise — say so instead. */}
          {(status.state === "arrive_now"
            ? t("alert.bodyNow")
            : t("alert.body").replace(
                "{dist}",
                String(Math.round(status.distanceM ?? 0)),
              )
          )
            .replace("{code}", displayRouteCode)
            .replace(
              "{stop}",
              stopName(status.destination).primary,
            )}
        </p>

        <button
          onClick={() => speak(primaryPhrase)}
          className={`press mt-3 w-full rounded-[16px] bg-[var(--sign-red)] px-4 py-4 text-center text-white shadow-[0_4px_0_0_var(--sign-red-deep)] ${
            speaking === primaryPhrase.id ? "ring-4 ring-[var(--sign-amber)]" : ""
          }`}
        >
          <span className="sign-zh block text-[30px]" lang="zh-HK">
            {primaryPhrase.cantonese}
          </span>
          <span className="mt-1.5 block text-[12px] font-semibold opacity-90">
            {coachMode ? primaryPhrase.jyutping : t("alert.hint")}
          </span>
        </button>

        {speaking && <div className="mt-3">{playingToast}</div>}

      </div>

      <p className="text-center text-[13px] font-medium text-white/55">
        {t("alert.done")}
      </p>
    </div>
  );

  /**
   * The composer as a sheet. On the ride screen the shout button owns the
   * thumb zone, so anything this tall has to sit above the layout rather
   * than inside it.
   */
  const composerSheet = composerOpen && (
    <div className="fixed inset-0 z-[1500] flex items-end justify-center bg-black/50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="max-h-[80dvh] w-full max-w-md overflow-y-auto">
        <div className="mb-2 flex justify-end">
          <button
            onClick={() => setComposerOpen(false)}
            aria-label={t("alert.dismiss")}
            className="flex size-11 items-center justify-center rounded-full bg-white/15 text-white"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {composer}
      </div>
    </div>
  );

  /** Secondary tools — kept out of the design's chrome, one tap away. */
  const toolShelf = (
    <section className="w-full min-w-0">
      <div className="-mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-1">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() =>
              setActiveTool((cur) => (cur === tool.id ? null : tool.id))
            }
            className={`press flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-bold ${
              activeTool === tool.id
                ? "border-ink bg-ink text-white"
                : "border-[var(--rule)] bg-white text-ink-muted"
            }`}
          >
            <tool.Icon className="size-4" aria-hidden strokeWidth={2.4} />
            {t(tool.key)}
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
        {activeTool === "nearby" && (
          <section className="card p-3">
            <div className="flex gap-2">
              {(["toilet", "market"] as const).map((kind) => (
                <button
                  key={kind}
                  onClick={() => loadFacilities(kind)}
                  className={`min-h-11 flex-1 rounded-lg py-2 text-sm font-medium transition active:scale-95 ${
                    facilities && facilityType === kind
                      ? "bg-ink text-white"
                      : "border border-[var(--rule)]"
                  }`}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    {kind === "toilet" ? (
                      <Toilet className="size-4" aria-hidden />
                    ) : (
                      <ShoppingBasket className="size-4" aria-hidden />
                    )}
                    {kind === "toilet" ? t("tool.toilets") : t("tool.markets")}
                  </span>
                </button>
              ))}
            </div>
            {facilitiesLoading && (
              <div className="mt-2 h-12 animate-pulse rounded-lg bg-[var(--paper)]" />
            )}
            {facilities && !facilitiesLoading && (
              <ul className="mt-2 space-y-1 text-sm">
                {facilities.length === 0 && (
                  <li className="text-ink-muted">{t("tool.noneNearby")}</li>
                )}
                {facilities.slice(0, 5).map((f, i) => (
                  <li
                    key={i}
                    className="flex justify-between gap-2 rounded-lg bg-[var(--paper)] px-2 py-1.5"
                  >
                    <span className="min-w-0 truncate">{f.name}</span>
                    {f.distanceM !== null && (
                      <span className="shrink-0 text-xs text-ink-muted">
                        {f.distanceM} m
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1.5 text-xs text-ink-muted">
              {t("tool.facilitySource")}
            </p>
          </section>
        )}
        {activeTool === "voice" && (
          <section className="card p-3">
            <SelectField
              label={t("tool.voiceLabel")}
              icon={Volume2}
              value={personaKey}
              onChange={pickPersona}
              hint={
                <p className="mt-1.5 text-xs text-ink-muted">
                  {t("tool.voiceHint")}
                </p>
              }
            >
              {VOICE_PERSONAS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </SelectField>
          </section>
        )}
      </div>
    </section>
  );

  /** Demo banner / GPS readiness — the field-test fix, kept on every phase. */
  const modeNotice = demoMode ? (
    <div className="rounded-[14px] border border-[var(--sign-amber)]/40 bg-[var(--sign-amber-soft)] p-3 text-sm text-[var(--sign-amber)]">
      <p className="font-semibold">{t("ride.demoBanner")}</p>
      <button
        onClick={() => {
          setDemoMode(false);
          setBoarded(false);
          sim.reset();
        }}
        className="press mt-1.5 min-h-11 w-full rounded-lg bg-[var(--sign-amber)] py-2 font-semibold text-white"
      >
        {t("ride.switchLive")}
      </button>
    </div>
  ) : (
    <div
      className={`rounded-[14px] p-3 text-sm ${
        gps.error
          ? "border border-[var(--sign-red)]/30 bg-[var(--sign-red)]/8 text-[var(--sign-red-deep)]"
          : gps.position
            ? "border border-[var(--brand)]/40 bg-[var(--brand-soft)] text-[var(--brand)]"
            : "border border-[var(--rule)] bg-[var(--paper)] text-ink-muted"
      }`}
    >
      {gps.error
        ? `GPS: ${gps.error}`
        : gps.position
          ? `${t("ride.gpsReady")} · ±${Math.round(gps.accuracy ?? 0)} m`
          : t("ride.gpsSearching")}
    </div>
  );

  // ---------------------------------------------------------------- 05 riding
  if (phase === "riding") {
    const distText =
      status.distanceM === null
        ? ""
        : status.distanceM >= 1000
          ? `${(status.distanceM / 1000).toFixed(1)} km`
          : `${Math.round(status.distanceM)} m`;
    return (
      <Screen fill tone="cabin" flush>
        <div className="flex w-full min-w-0 flex-1 flex-col gap-3 overflow-hidden px-3.5 pb-8 pt-[max(0.9rem,env(safe-area-inset-top))]">
          <div className="flex shrink-0 items-center gap-2">
            {/* Always available: a ride you cannot leave is a trap, and the
                simulation especially needs an obvious way out. */}
            <button
              onClick={endRide}
              className="press -ms-1 flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 text-[13px] font-bold text-white"
            >
              <X className="size-4" aria-hidden strokeWidth={2.6} />
              {t("ride.endRide")}
            </button>
            <span className="ms-auto flex items-center gap-2">
              {modeToggle(true)}
              {coachToggle(true)}
            </span>
          </div>

          {/* The board in the windscreen: what stop is next. */}
          <LedBoard
            size="display"
            label={t("ride.nextStop")}
            primary={stopName(status.nearestStop ?? status.destination).primary}
            secondary={
              stopName(status.nearestStop ?? status.destination).secondary
            }
            scroll
            className="shrink-0"
          />

          {/* §5/05 status bar: one sentence, then the three numbers. */}
          <div
            className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[14px] px-3.5 py-3"
            style={{
              background:
                status.state === "arrive_now"
                  ? "var(--sign-red)"
                  : status.state === "approaching"
                    ? "var(--sign-amber)"
                    : "rgba(255,255,255,.1)",
            }}
          >
            <span className="sign-zh text-[19px] text-white">
              {status.state === "approaching"
                ? t("ride.almostThere")
                : t(label.key)}
            </span>
            <span className="text-[13px] font-bold text-white/85">
              {status.distanceM !== null &&
                (stopsToGo !== null && stopsToGo > 0
                  ? t("ride.stopsAway")
                      .replace("{n}", String(stopsToGo))
                      .replace("{dist}", distText)
                      .replace("{min}", String(status.etaMinutes ?? 1))
                  : distText)}
            </span>
            {status.state === "arrived" && (
              <button
                onClick={endRide}
                className="press flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border-2 border-white/70 text-sm font-bold text-white"
              >
                <RotateCcw className="size-4" aria-hidden /> {t("ride.newRide")}
              </button>
            )}
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col">
            <RideMap
              stops={stops}
              path={routePath}
              position={position}
              boardingSeq={boardingSeq}
              destinationSeq={destinationSeq}
              riding
              tall
              routeCode={displayRouteCode}
              stopLabel={mapStopLabel}
              urgent={urgent}
              accuracyM={demoMode ? null : gps.accuracy}
            />
            {/* Design's map caption: proof the tracking is real. */}
            <span
              className="pointer-events-none absolute bottom-2 left-3 z-[500] rounded px-1.5 py-0.5 text-[10px]"
              style={{
                fontFamily: "var(--font-dot), monospace",
                background: "rgba(232,226,210,.85)",
                color: "var(--ink-muted)",
              }}
            >
              {demoMode
                ? t("ride.simCaption")
                    .replace("{pct}", String(Math.round(sim.progress * 100)))
                    .replace("{kmh}", String(SIM_SPEED_KMH))
                    .replace("{x}", String(SIM_TIMELAPSE))
                : gps.position
                  ? t("ride.gpsCaption").replace(
                      "{m}",
                      String(Math.round(gps.accuracy ?? 0)),
                    )
                  : t("ride.gpsSearching")}
            </span>
          </div>

          {/* Pinned action zone: thumb-reachable, no scrolling to shout. What
              opens under it scrolls rather than disappearing off the cabin. */}
          <div className="w-full min-w-0 shrink-0 space-y-2.5">
            {speakingToast}
            {shoutButton}
            <div className="-mx-3.5 flex w-[calc(100%+1.75rem)] gap-2 overflow-x-auto px-3.5 pb-1">
              {ridingPhrases.map((p) => phraseButton(p, true))}
              <button
                onClick={() => setComposerOpen((o) => !o)}
                className={`press min-h-11 shrink-0 rounded-[12px] border px-3 py-2.5 text-[13px] font-semibold ${
                  composerOpen
                    ? "border-white bg-white text-[var(--brand-deep)]"
                    : "border-white/20 bg-white/10 text-white"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Pencil className="size-4" aria-hidden />
                  {t("tool.sayAnything")}
                </span>
              </button>
              <button
                onClick={listenToDriver}
                disabled={listening}
                className="press min-h-11 shrink-0 rounded-[12px] border border-white/20 bg-white/10 px-3 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                <span className="flex items-center gap-1.5">
                  <Mic className="size-4" aria-hidden />
                  {listening ? t("say.listening") : t("mic.driverSaid")}
                </span>
              </button>
            </div>
            {driverReply && (
              <div className="card p-3 text-sm">
                <p className="font-semibold">{driverReply.english}</p>
                {driverReply.reply_cantonese && (
                  <button
                    onClick={() =>
                      speakCantonese(driverReply.reply_cantonese, personaKey)
                    }
                    className="mt-1 w-full rounded-lg bg-[var(--paper)] p-2 text-left"
                  >
                    <span className="block font-semibold">
                      {t("mic.reply")}: {driverReply.reply_cantonese}
                    </span>
                    <span className="block text-xs text-ink-muted">
                      {driverReply.reply_english} · {t("mic.tapToSpeak")}
                    </span>
                  </button>
                )}
              </div>
            )}
            {listenError && (
              <p className="text-center text-sm text-white">{listenError}</p>
            )}
          </div>
        </div>

        {composerSheet}
        {alertSheet}
      </Screen>
    );
  }

  // --------------------------------------------------------------- 04 waiting
  if (phase === "waiting") {
    return (
      <Screen fill tone="cream" flush>
        <header className="shrink-0 bg-[var(--brand)] px-4 pb-4 pt-[max(0.9rem,env(safe-area-inset-top))] text-white">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setConfirmedStop(false)}
              aria-label={t("common.back")}
              className="-ms-2 flex size-11 shrink-0 items-center justify-center"
              style={{ color: "var(--brand-on)" }}
            >
              <ChevronLeft className="size-7 rtl:rotate-180" aria-hidden strokeWidth={2.4} />
            </button>
            <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
              <span className="sign-zh min-w-0 truncate text-[17px]">
                {stopName(stops[boardingIdx]).primary}
              </span>
              <span
                className="shrink-0 text-[13px] font-semibold"
                style={{ color: "var(--brand-on)" }}
              >
                {t("wait.suffix")}
              </span>
            </span>
            {modeToggle(true)}
          </div>

          {/* The countdown board — the reason to keep the phone out. */}
          <LedBoard
            size="display"
            label={`${displayRouteCode} ${t("ride.arriving")}`}
            primary={
              <span className="block text-center text-[64px] leading-none">
                {etaClock ?? t("ride.dueNow")}
              </span>
            }
            secondary={
              etaMins.length > 1
                ? `${t("ride.thenBus")} ${etaMins
                    .slice(1, 3)
                    .map((m) => `${m} ${t("ride.minutesUnit")}`)
                    .join(" · ")}`
                : undefined
            }
            className="mt-3"
          />
          {etaMins.length === 0 && (
            <p className="mt-2 text-[12px]" style={{ color: "var(--brand-on)" }}>
              {t("ride.noArrivals")}{" "}
              {!serviceInfo && (
                <button
                  onClick={checkService}
                  disabled={serviceLoading}
                  className="font-bold underline disabled:opacity-50"
                >
                  {serviceLoading ? t("ride.checking") : t("ride.stillRunning")}
                </button>
              )}
            </p>
          )}
          {serviceInfo && (
            <p className="mt-1.5 text-[12px]" style={{ color: "var(--brand-on)" }}>
              {serviceInfo.confident === false && (
                <TriangleAlert className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
              )}
              {serviceInfo.answer}
              {/* An Agenthub answer without its sources is just a claim. */}
              {serviceInfo.sources && serviceInfo.sources.length > 0 && (
                <span className="mt-1 block opacity-80">
                  {t("ride.sourceLabel")}:{" "}
                  {serviceInfo.sources.map((u, i) => (
                    <a
                      key={u}
                      href={u}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {i > 0 && ", "}
                      {new URL(u).hostname.replace(/^www\./, "")}
                    </a>
                  ))}
                </span>
              )}
              <span className="mt-1 block opacity-70">
                {t("ride.serviceSource")}
              </span>
            </p>
          )}
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-2 pt-3">
          {/* Fixed height, not flex-1: inside a scroll container a flexible
              map collapses as soon as a tool panel opens below it. */}
          <div className="relative flex h-[34dvh] min-h-40 shrink-0 flex-col">
            <RideMap
              stops={stops}
              path={routePath}
              position={position}
              boardingSeq={boardingSeq}
              destinationSeq={destinationSeq}
              riding={false}
              tall
              accuracyM={null}
              stopLabel={mapStopLabel}
              waitingEtaLabel={
                etaMins.length > 0
                  ? `${etaMins[0]} ${t("ride.minutesUnit")}`
                  : null
              }
            />
            <span
              className="pointer-events-none absolute left-3 top-3 z-[500] rounded-[5px] px-2 py-1 text-[11px]"
              style={{
                fontFamily: "var(--font-dot), monospace",
                background: "var(--led-bg)",
                color: "var(--led-on)",
              }}
            >
              {t("wait.getOnChip")}
            </span>
          </div>

          <div className="flex shrink-0 gap-2.5">
            <InfoTile
              label={t("ride.fare")}
              value={fare !== null ? `HK$${fare.toFixed(1)}` : "—"}
              detail={fare !== null ? t("ride.fareHint") : undefined}
            />
            <InfoTile
              label={t("ride.weather")}
              value={
                weather
                  ? weather.temperature !== null
                    ? `${Math.round(weather.temperature)}°C ${weatherText ?? ""}`
                    : (weatherText ?? "")
                  : "—"
              }
              detail={weather?.wet ? t("ride.umbrella") : undefined}
              accent={weather?.wet ? "var(--sign-blue)" : undefined}
            />
          </div>

          {modeNotice}
          {toolShelf}
        </div>

        <BottomBar>
          <PressButton
            tall
            className="rounded-[18px] py-4"
            onClick={() => {
              const route = currentSavedRoute();
              if (route) remember(route);
              setBoarded(true);
            }}
            disabled={!demoMode && !gps.position}
          >
            <span className="sign-zh block text-[20px]">
              {demoMode ? t("ride.startDemo") : t("ride.onBoard")}
            </span>
            <span className="mt-1.5 block text-[12px] font-medium opacity-85">
              {t("ride.trackingHint")}
            </span>
          </PressButton>
        </BottomBar>

        {alertSheet}
      </Screen>
    );
  }

  // ------------------------------------------------------- 02 plan / 03 route
  // Planning is the top card of the route screen: naming a place is what a
  // rider can actually do, and the loaded route sits directly under it.
  return (
    <Screen tone="cream" flush>
      {/* One green roof. With a route loaded it carries the LED board, as in
          §5/03; without one it is the §5/02 "去邊度？" bar. */}
      <header className="shrink-0 bg-[var(--brand)] px-4 pb-4 pt-[max(0.9rem,env(safe-area-inset-top))] text-white">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            aria-label={t("common.back")}
            className="-ms-2 flex size-11 shrink-0 items-center justify-center"
            style={{ color: "var(--brand-on)" }}
          >
            <ChevronLeft className="size-7 rtl:rotate-180" aria-hidden strokeWidth={2.4} />
          </Link>
          {!routeLoaded && (
            <span className="sign-zh min-w-0 flex-1 truncate text-[19px]">
              {t("plan.title")}
            </span>
          )}
          <span className="ms-auto">{modeToggle(true)}</span>
        </div>

        {routeLoaded && (
          <div className="mt-2.5">
          {/* §5/03 route board: code, where it takes you, fare. */}
          <LedBoard
            size="header"
            primary={
              <span className="flex items-baseline gap-3.5">
                <span className="shrink-0">{displayRouteCode}</span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-[24px] leading-none">
                    {stopName(destStop).primary}
                  </span>
                  <span
                    className="truncate text-[12px] uppercase leading-none tracking-[0.14em]"
                    style={{ color: "var(--led-dim)" }}
                  >
                    {stopName(destStop).secondary}
                  </span>
                </span>
              </span>
            }
            trailing={fare !== null ? `$${fare.toFixed(1)}` : undefined}
          />
          <div className="mt-2.5 flex items-center gap-2">
            <span
              className="min-w-0 flex-1 truncate text-[12px] leading-snug"
              style={{ color: "var(--brand-on)" }}
            >
              {stopName(stops[boardingIdx]).primary} →{" "}
              {stopName(destStop).primary}
              {stopsBetween !== null &&
                ` · ${t("ride.stopsCount").replace("{n}", String(stopsBetween))}`}
            </span>
            <button
              onClick={saveThisRoute}
              aria-pressed={routeIsSaved}
              disabled={!destStop}
              className="press flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold disabled:opacity-40"
              style={{
                background: "rgba(255,255,255,.14)",
                color: routeIsSaved ? "var(--led-on)" : "#fff",
              }}
            >
              <Star
                className="size-4"
                aria-hidden
                fill={routeIsSaved ? "var(--led-on)" : "none"}
              />
              {routeIsSaved ? t("route.saved") : t("route.save")}
            </button>
            </div>
          </div>
        )}
      </header>

      <div className="flex w-full min-w-0 flex-col gap-3 px-4 pt-3.5">
        {/* ---- 02: where to? ---- */}
        <Card className="rounded-[18px] p-3.5">
          <div className="flex flex-col gap-2.5">
            {/* Origin: a green dot, like the boarding node on the timeline */}
            <label className="flex min-h-12 items-center gap-2.5 rounded-[12px] border-[1.5px] border-[var(--rule)] px-3.5 py-3">
              <span
                className="size-[9px] shrink-0 rounded-full"
                style={{ background: "var(--brand)" }}
              />
              <input
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
                placeholder={t("plan.imAt").replace(
                  "{stop}",
                  gps.position
                    ? t("ride.gpsReady")
                    : stopName(stops[boardingIdx]).primary,
                )}
                value={originQuery}
                onChange={(e) => setOriginQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && planTrip()}
              />
            </label>
            {/* Destination: a red square, like the alighting node */}
            <label
              className="flex min-h-12 items-center gap-2.5 rounded-[12px] border-[1.5px] px-3.5 py-3"
              style={{
                borderColor: destQuery ? "var(--brand)" : "var(--rule)",
                boxShadow: destQuery
                  ? "0 0 0 3.5px rgba(15,122,82,.15)"
                  : undefined,
              }}
            >
              <span
                className="size-[9px] shrink-0 rounded-[2px]"
                style={{ background: "var(--sign-red)" }}
              />
              <input
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
                placeholder={t("ride.to")}
                value={destQuery}
                onChange={(e) => setDestQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && planTrip()}
              />
            </label>
            <PressButton
              onClick={planTrip}
              disabled={planning || !destQuery.trim()}
              className="rounded-[12px]"
            >
              <span className="sign-zh text-[16px]">
                {planning ? "…" : t("plan.search")}
              </span>
            </PressButton>
          </div>

          <button
            onClick={() => setShowRouteCode((s) => !s)}
            className="mt-2.5 min-h-11 text-[12px] font-bold"
            style={{ color: "var(--brand)" }}
          >
            {showRouteCode ? "−" : "+"} {t("ride.knowCode")}
          </button>
          {showRouteCode && (
            <div className="mt-1 flex gap-2">
              <span className="field min-w-0 flex-1">
                <span className="field-icon">
                  <Signpost className="size-5" aria-hidden strokeWidth={2.2} />
                </span>
                <input
                  className="field-input"
                  placeholder={t("tool.routeCodePlaceholder")}
                  value={routeCode}
                  onChange={(e) => setRouteCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadRoute()}
                />
              </span>
              <button
                onClick={loadRoute}
                disabled={routeLoading || !routeCode.trim()}
                className="press shrink-0 rounded-xl bg-ink px-4 text-sm font-bold text-white disabled:opacity-40"
              >
                {routeLoading ? "…" : t("ride.load")}
              </button>
            </div>
          )}
          {planError && (
            <p className="mt-2 text-sm text-[var(--sign-red)]">{planError}</p>
          )}
        </Card>

        {planning && (
          <>
            <div className="h-24 animate-pulse rounded-[18px] bg-white/60" />
            <div className="h-24 animate-pulse rounded-[18px] bg-white/60" />
          </>
        )}

        {/* ---- 02: the options ---- */}
        {planOptions && planOptions.length > 0 && (
          <>
            <SectionLabel>{t("plan.minibusFirst")}</SectionLabel>
            {!planOptions.some((o) => o.hasMinibus) && (
              <p className="rounded-[14px] bg-[var(--sign-amber-soft)] p-2.5 text-xs text-[var(--sign-amber)]">
                {t("ride.noMinibus")}
              </p>
            )}
            {planOptions.map((opt, i) => {
              const ride = opt.legs.find((l) => l.kind === "ride" && l.routeCode);
              const minibus = opt.legs.find(
                (l) => l.kind === "ride" && l.company === "gmb",
              );
              const target = minibus ?? ride;
              return (
                <Card
                  key={i}
                  raised={i === 0 && !!minibus}
                  className="flex flex-col gap-2.5 rounded-[18px] p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-[24px] font-extrabold leading-none">
                        {opt.minutes}
                      </span>
                      <span className="text-[13px] font-semibold text-ink-muted">
                        {t("plan.minutesUnit")}
                      </span>
                    </span>
                    <span className="text-[13px] font-semibold text-ink-muted">
                      {opt.fare !== null && `HK$${opt.fare.toFixed(1)} · `}
                      {opt.km.toFixed(1)} km
                    </span>
                  </div>

                  {/* The legs, in order, with an LED chip per minibus */}
                  <div className="flex flex-wrap items-center gap-x-[7px] gap-y-1.5">
                    {opt.legs.map((l, j) => (
                      <span key={j} className="flex items-center gap-[7px]">
                        {j > 0 && (
                          <span style={{ color: "var(--rule)" }} aria-hidden>
                            ›
                          </span>
                        )}
                        {l.kind === "walk" ? (
                          <span className="text-[12px] font-medium text-ink-faint">
                            {t("plan.walkTag").replace(
                              "{n}",
                              String(l.minutes ?? 0),
                            )}
                          </span>
                        ) : l.company === "gmb" ? (
                          <>
                            <span
                              className="flex items-center gap-1.5 rounded-[6px] px-2.5 py-[5px]"
                              style={{ background: "var(--led-bg)" }}
                            >
                              <span
                                className="text-[15px] leading-none"
                                style={{
                                  fontFamily: "var(--font-dot), monospace",
                                  color: "var(--led-on)",
                                }}
                              >
                                {l.routeCode ?? "?"}
                              </span>
                              <span
                                className="text-[11px] leading-none"
                                style={{
                                  fontFamily: "var(--font-dot), monospace",
                                  color: "var(--led-dim)",
                                }}
                              >
                                {t("plan.gmbTag")}
                              </span>
                            </span>
                            {l.numStops ? (
                              <span className="text-[12px] font-medium text-ink-faint">
                                {t("plan.stopsUnit").replace(
                                  "{n}",
                                  String(l.numStops),
                                )}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          /* Franchised bus: a flat cream pill, never the LED */
                          <>
                            <span
                              className="rounded-[6px] px-2.5 py-1.5 text-[12px] font-bold"
                              style={{
                                background: "var(--body-cream)",
                                color: "var(--ink-muted)",
                              }}
                            >
                              {t("ride.busTag").replace(
                                "{code}",
                                l.routeCode ?? "?",
                              )}
                            </span>
                            {l.numStops ? (
                              <span className="text-[12px] font-medium text-ink-faint">
                                {t("plan.stopsUnit").replace(
                                  "{n}",
                                  String(l.numStops),
                                )}
                              </span>
                            ) : null}
                          </>
                        )}
                      </span>
                    ))}
                  </div>

                  {target && (
                    <PressButton
                      tone="ink"
                      onClick={() => trackLeg(target)}
                      disabled={routeLoading}
                      className="rounded-[11px] text-[14px]"
                    >
                      {routeLoading
                        ? "…"
                        : target.company === "gmb"
                          ? t("plan.track")
                          : t("plan.trackRoute").replace(
                              "{code}",
                              target.routeCode ?? "",
                            )}
                    </PressButton>
                  )}
                </Card>
              );
            })}
            <p className="text-[12px] leading-relaxed text-ink-faint">
              {t("plan.dataNote")}
            </p>
          </>
        )}

        {/* ---- 03: the loaded route ---- */}
        {routeError && (
          <p className="text-sm text-[var(--sign-red)]">{routeError}</p>
        )}

        {routeLoaded || stops.length > 0 ? (
          <>
            <div className="flex gap-2.5">
              <StatTile
                led
                label={t("route.next")}
                value={
                  etaMins.length > 0
                    ? `${etaMins[0]} ${t("ride.minutesUnit")}`
                    : "—"
                }
              />
              <StatTile
                label={t("route.then")}
                value={
                  etaMins.length > 1
                    ? `${etaMins.slice(1, 3).join(" · ")} ${t("ride.minutesUnit")}`
                    : "—"
                }
              />
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <SectionLabel>{t("ride.allStops")}</SectionLabel>
              <span className="text-[11px] font-bold text-ink-faint">
                {t("ride.stopsCount").replace("{n}", String(stops.length))}
              </span>
            </div>
            <p className="-mt-1.5 text-[12px] text-ink-faint">
              {t("route.tapToChange")}
            </p>
            <StopTimeline
              stops={stops}
              boardingSeq={boardingSeq}
              destinationSeq={destinationSeq}
              onPickBoarding={setBoardingSeq}
              onPickDestination={setDestinationSeq}
              getOnLabel={t("ride.getOnAt")}
              getOffLabel={t("ride.getOffAt")}
            />
          </>
        ) : null}
      </div>

      <BottomBar>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-medium text-ink-muted">
            {legMinutes !== null
              ? t("ride.tripSummary")
                  .replace("{min}", String(legMinutes))
                  .replace("{fare}", fare !== null ? fare.toFixed(1) : "—")
              : fare !== null
                ? t("ride.tripFare").replace("{fare}", fare.toFixed(1))
                : ""}
          </span>
          <span
            className="shrink-0 text-[12px] font-bold"
            style={{ color: "var(--sign-amber)" }}
          >
            {t("ride.noChange")}
          </span>
        </div>
        <PressButton
          tall
          className="rounded-[14px]"
          onClick={() => setConfirmedStop(true)}
        >
          <span className="sign-zh text-[17px]">
            {t("route.waitAt").replace(
              "{stop}",
              stopName(stops[boardingIdx]).primary,
            )}
          </span>
        </PressButton>
      </BottomBar>
    </Screen>
  );
}
