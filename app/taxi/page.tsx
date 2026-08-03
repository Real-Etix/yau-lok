"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  TAXI_PHRASES,
  DETOUR_TIPS,
  PAYING_TIPS,
  type TaxiPhrase,
} from "@/data/taxi-phrases";
import { VOICE_PERSONAS, DEFAULT_PERSONA_KEY } from "@/data/voices";
import { USER_LANGUAGES, DEFAULT_LANGUAGE_CODE, getLanguage } from "@/data/languages";
import { useGeolocation, useWakeLock } from "@/hooks/useGeolocation";
import { URBAN_TAXI } from "@/lib/taxi";
import {
  cumulativeMeters,
  haversineMeters,
  projectOntoPath,
  type LatLng,
} from "@/lib/geo";
import { friendlyMicError, listenUserSpeech, speakCantonese } from "@/lib/speech";
import RideMap from "@/components/RideMap";
import Meter from "@/components/Meter";
import PlasticSign from "@/components/PlasticSign";
import { Screen, TopBar, PressButton, LanguageRow } from "@/components/ui";
import {
  Pencil,
  Mic,
  Volume2,
  Car,
  Globe,
  ChevronDown,
  X,
} from "lucide-react";
import { useT, useLanguage } from "@/lib/i18n";
import { useStored } from "@/lib/prefs";

type Plan = {
  distanceM: number;
  durationS: number;
  path: [number, number][];
  destinationChinese: string | null;
  destinationAddress: string | null;
  destinationInput: string;
  fare: { low: number; high: number; base: number };
};

type SayResult = { cantonese: string; jyutping: string; back: string; note?: string };

/** How far off the planned route before we say something. */
const DETOUR_WARN_M = 400;
/** Consecutive off-route fixes before warning — one bad GPS fix isn't a detour. */
const DETOUR_STREAK = 3;

const GROUPS: { id: TaxiPhrase["group"]; key: string }[] = [
  { id: "boarding", key: "taxi.stageBoarding" },
  { id: "during", key: "taxi.stageDuring" },
  { id: "paying", key: "taxi.stagePaying" },
];

export default function TaxiPage() {
  const t = useT();
  const [personaKey, setPersonaKey] = useState(DEFAULT_PERSONA_KEY);
  // Same single setting as everywhere else — not a private copy.
  const { lang: langCode } = useLanguage();
  const [coach, setCoach] = useState(true);

  const [originQuery, setOriginQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [, setLastTaxi] = useStored<{ to: string; distanceM: number } | null>(
    "yau-lok-last-taxi",
    null,
  );
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [riding, setRiding] = useState(false);
  // The ride is over when the passenger says so — GPS can't tell paying
  // apart from sitting in traffic outside the door.
  const [arrived, setArrived] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [detourStreak, setDetourStreak] = useState(0);

  const [sayText, setSayText] = useState("");
  const [sayResult, setSayResult] = useState<SayResult | null>(null);
  const [sayLoading, setSayLoading] = useState(false);
  const [sayListening, setSayListening] = useState(false);
  const [sayError, setSayError] = useState<string | null>(null);

  // Location is opt-in before the ride: asked for only when the passenger
  // taps "use my location", and always on once they're in the taxi.
  const [wantLocation, setWantLocation] = useState(false);
  const gps = useGeolocation(riding || wantLocation);
  useWakeLock(riding);

  useEffect(() => {
    const v = localStorage.getItem("yau-lok-voice");
    if (v && VOICE_PERSONAS.some((p) => p.key === v)) setPersonaKey(v);
  }, []);

  const planTrip = useCallback(async () => {
    if (!destQuery.trim()) return;
    setPlanning(true);
    setPlanError(null);
    setPlan(null);
    setRiding(false);
    setDetourStreak(0);
    try {
      const res = await fetch("/api/taxi/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: destQuery.trim(),
          ...(originQuery.trim()
            ? { origin: originQuery.trim() }
            : gps.position
              ? { originLat: gps.position.lat, originLng: gps.position.lng }
              : { origin: "Hong Kong" }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "could not plan");
      setPlan(data);
      // Remember where this trip was headed, so the home screen can lead with
      // an estimate to the place you actually go instead of the bare flagfall.
      // Planning rather than arriving is the signal: someone who looked up a
      // fare to Kwun Tong wants that number again tomorrow whether or not
      // they got in the cab.
      if (typeof data.distanceM === "number") {
        setLastTaxi({
          to: data.destinationChinese ?? data.destinationInput ?? destQuery.trim(),
          distanceM: data.distanceM,
        });
      }
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : t("taxi.planError"));
    } finally {
      setPlanning(false);
    }
  }, [destQuery, originQuery, gps.position]);

  // --- Detour watch -------------------------------------------------------
  // The planned driving route is the reference. If the taxi strays far from
  // it for several fixes running, say so — quietly, and without accusing
  // anyone: traffic diversions are normal, and the passenger decides.
  const routePath = useMemo<LatLng[]>(
    () => (plan?.path ?? []).map(([lat, lng]) => ({ lat, lng })),
    [plan],
  );
  const cum = useMemo(() => cumulativeMeters(routePath), [routePath]);
  const lastOffsetRef = useRef<number | null>(null);

  useEffect(() => {
    if (!riding || !gps.position || routePath.length < 2) return;
    const p = projectOntoPath(routePath, cum, gps.position);
    if (!p) return;
    lastOffsetRef.current = p.offset;
    setDetourStreak((s) => (p.offset > DETOUR_WARN_M ? s + 1 : 0));
  }, [riding, gps.position, routePath, cum]);

  const offRoute = detourStreak >= DETOUR_STREAK;

  // --- The meter ----------------------------------------------------------
  // A real 咪錶 counts money, distance and time itself; this one mirrors it
  // from the plan and the clock so the passenger has a number to compare
  // against the dashboard. It is a readout, not a billing system: the fare
  // climbs in whole dollars off the estimate's own rate, and the distance
  // integrates the speed we are actually seeing.
  const [meter, setMeter] = useState({ fare: 0, km: 0, elapsedS: 0, speed: 0 });

  // Speed from successive fixes. The geolocation hook is shared plumbing and
  // stays as it is, so the arithmetic lives here.
  const lastFixRef = useRef<{ at: number; pos: LatLng } | null>(null);
  const [gpsSpeed, setGpsSpeed] = useState<number | null>(null);
  useEffect(() => {
    if (!gps.position) return;
    const now = Date.now();
    const prev = lastFixRef.current;
    lastFixRef.current = { at: now, pos: gps.position };
    if (!prev) return;
    const dt = (now - prev.at) / 1000;
    if (dt < 1) return;
    const kmh = (haversineMeters(prev.pos, gps.position) / dt) * 3.6;
    setGpsSpeed(Math.min(52, Math.max(0, kmh)));
  }, [gps.position]);

  useEffect(() => {
    if (!riding || !plan) return;
    // Dollars per second: the metered fare above flagfall, spread over the
    // estimated journey time.
    const climb = Math.max(0, plan.fare.base - URBAN_TAXI.flagfallHkd);
    const perSecond = climb / Math.max(60, plan.durationS);
    const id = setInterval(() => {
      setMeter((m) => {
        // Fall back to the trip's own average when there is no fix to
        // measure against — better than a meter frozen at zero.
        const avg = (plan.distanceM / 1000 / Math.max(1, plan.durationS / 3600));
        const speed = Math.min(52, Math.max(0, gpsSpeed ?? avg));
        return {
          // Hong Kong meters step in whole dollars, never fractions.
          fare: Math.round(m.fare + perSecond),
          km: m.km + speed / 3600,
          elapsedS: m.elapsedS + 1,
          speed,
        };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [riding, plan, gpsSpeed]);

  // Boarding resets the meter, exactly as the driver drops the flag.
  useEffect(() => {
    if (riding && plan) {
      setMeter({
        fare: URBAN_TAXI.flagfallHkd,
        km: 0,
        elapsedS: 0,
        speed: 0,
      });
    }
  }, [riding, plan]);

  // How far is left, measured along the planned route rather than as the
  // crow flies — the same projection the detour watch already uses.
  const remainingKm = useMemo(() => {
    if (!plan || !gps.position || routePath.length < 2) {
      return (plan?.distanceM ?? 0) / 1000;
    }
    const here = projectOntoPath(routePath, cum, gps.position);
    const total = cum[cum.length - 1] ?? 0;
    return Math.max(0, total - (here?.along ?? 0)) / 1000;
  }, [plan, gps.position, routePath, cum]);

  // The plate is the one thing a complaint needs. Until a real plate can be
  // read (camera, or the driver's displayed licence), this is the placeholder
  // the design shows — never presented as if we had detected it.
  const plateNumber = "RX 5004";

  const speak = useCallback(
    async (p: TaxiPhrase) => {
      setSpeaking(p.id);
      try {
        await speakCantonese(p.cantonese, personaKey);
      } finally {
        setTimeout(() => setSpeaking(null), 600);
      }
    },
    [personaKey],
  );

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
        await speakCantonese(data.cantonese, personaKey);
      } catch (e) {
        setSayError(e instanceof Error ? e.message : t("say.error"));
      } finally {
        setSayLoading(false);
      }
    },
    [personaKey, langCode],
  );

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

  /** Tips are ids; the wording is translatable and lives in the catalogue. */
  const tipList = (ids: readonly string[]) =>
    ids.map((id, i) => (
      <div key={id} className="flex flex-col gap-[3px]">
        {i > 0 && (
          <div
            aria-hidden
            className="mb-2"
            style={{ background: "var(--rule)", height: 1 }}
          />
        )}
        <p className="text-[13px] font-bold leading-[1.3]">
          {t(`taxi.tip.${id}.title`)}
        </p>
        <p className="text-[11.5px] leading-[1.6] text-ink-muted">
          {t(`taxi.tip.${id}.body`)}
        </p>
      </div>
    ));

  const mapStops = useMemo(() => {
    if (routePath.length < 2) return [];
    const first = routePath[0];
    const last = routePath[routePath.length - 1];
    return [
      { seq: 1, name: { en: t("taxi.pickUp"), tc: "上車" }, lat: first.lat, lng: first.lng },
      {
        seq: 2,
        name: {
          en: plan?.destinationInput ?? t("taxi.destination"),
          tc: plan?.destinationChinese ?? "目的地",
        },
        lat: last.lat,
        lng: last.lng,
      },
    ];
  }, [routePath, plan]);
  // ---- The five states of a taxi ride -----------------------------------
  // Which one you are in follows from what you have actually done, so there
  // is a single source of truth and no screen can be reached by accident.
  const phase: "plan" | "show" | "ride" | "pay" = arrived
    ? "pay"
    : riding
      ? "ride"
      : plan
        ? "show"
        : "plan";

  // Back walks the trip backwards; only 上車前 leaves for the home screen.
  const onBack =
    phase === "show"
      ? () => setPlan(null)
      : phase === "ride"
        ? () => setRiding(false)
        : phase === "pay"
          ? () => setArrived(false)
          : undefined;

  const boarding = TAXI_PHRASES.filter((p) => p.group === "boarding");
  const during = TAXI_PHRASES.filter((p) => p.group === "during");
  const paying = TAXI_PHRASES.filter((p) => p.group === "paying");

  const tolls = plan ? Math.max(0, plan.fare.high - plan.fare.low) : 0;

  /** A phrase the passenger taps to have spoken. */
  const phraseCard = (p: TaxiPhrase, primary = false) => (
    <button
      key={p.id}
      onClick={() => speak(p)}
      className={`press min-h-11 w-full rounded-[14px] px-3.5 py-3 text-start ${
        speaking === p.id ? "ring-2 ring-[var(--sign-amber)]" : ""
      }`}
      style={
        primary
          ? {
              background: "var(--sign-red)",
              boxShadow: "0 4px 0 0 var(--sign-red-deep)",
            }
          : {
              background: "var(--card)",
              border: "1px solid #ddd7ce",
              boxShadow: "0 3px 0 0 #ddd7ce",
            }
      }
    >
      <span
        className="block text-[16px] font-bold leading-[1.3]"
        style={{ color: primary ? "#fff" : "var(--ink)" }}
        lang="zh-HK"
      >
        {p.cantonese}
      </span>
      <span
        className="mt-0.5 block text-[11px] leading-[1.4]"
        style={{ color: primary ? "#ffc9d0" : "var(--ink-faint)" }}
      >
        {coach ? `${p.jyutping} · ` : ""}
        {p.english}
      </span>
    </button>
  );

  const sectionLabel = (text: string) => (
    <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
      {text}
    </span>
  );

  /** Pick your language — the same row on every scenario, in taxi red. */
  const languageRow = <LanguageRow accent="var(--sign-red)" />;

  /** 講嘢 — hold to talk, or type. Shared by the plan and ride screens. */
  const sayBlock = (
    <div className="card flex flex-col gap-2.5 rounded-[18px] p-3.5">
      {sectionLabel(t("taxi.sayAnythingLabel"))}
      <PressButton tone="red" onClick={sayByVoice} disabled={sayListening || sayLoading}>
        <span className="flex items-center justify-center gap-2.5">
          <Mic className="size-5" aria-hidden strokeWidth={2.2} />
          {sayListening
            ? t("say.listening")
            : sayLoading
              ? t("say.translating")
              : t("taxi.holdToTalk")}
        </span>
      </PressButton>
      <label
        className="flex min-h-12 items-center gap-2.5 rounded-[12px] px-3.5 py-3"
        style={{ border: "1.5px solid #ddd7ce" }}
      >
        <Pencil className="size-5 shrink-0 text-ink-faint" aria-hidden strokeWidth={2.2} />
        <input
          className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
          placeholder={t("taxi.orType")}
          value={sayText}
          onChange={(e) => setSayText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSay(sayText)}
        />
      </label>
      {sayError && (
        <p className="text-[12px] text-[var(--sign-red)]">{sayError}</p>
      )}
      {sayResult && (
        <button
          onClick={() => speakCantonese(sayResult.cantonese, personaKey)}
          className="press rounded-[14px] bg-ink p-3.5 text-center text-white"
        >
          <span className="sign-zh block text-[24px]" lang="zh-HK">
            {sayResult.cantonese}
          </span>
          {coach && (
            <span className="mt-1 block text-[12px] opacity-75">
              {sayResult.jyutping}
            </span>
          )}
          <span className="mt-0.5 block text-[12px] opacity-75">
            {sayResult.back}
          </span>
        </button>
      )}
    </div>
  );

  const meterStats: [string, string, string] = [
    `${meter.km.toFixed(2)} km`,
    `${Math.floor(meter.elapsedS / 60)}m ${String(Math.floor(meter.elapsedS % 60)).padStart(2, "0")}s`,
    `${meter.speed.toFixed(1)} km/h`,
  ];

  // ------------------------------------------------------------ 01 上車前
  if (phase === "plan") {
    return (
      <Screen tone="taxi" flush>
        <TopBar variant="taxi" title={t("taxi.title")} onBack={onBack}>
          <span className="rounded-full bg-white/20 px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white">
            {t("common.demoShort")}
          </span>
        </TopBar>

        <div className="flex flex-col gap-[13px] px-[18px] py-4">
          {/* The roof sign: you are in the taxi world now. */}
          <PlasticSign compact>
            <span className="flex items-center justify-center gap-3.5">
              <span
                style={{ font: "900 26px/1 'Noto Sans HK',sans-serif", color: "#c8102e" }}
                lang="zh-HK"
              >
                {t("home.taxi")}
              </span>
              <span
                aria-hidden
                style={{ background: "rgba(20,17,15,.35)", width: 2, height: 24 }}
              />
              <span
                className="sign-zh"
                style={{ fontSize: 20, letterSpacing: ".24em" }}
              >
                {t("taxi.roofSign")}
              </span>
            </span>
          </PlasticSign>

          <div
            className="card flex flex-col gap-2.5 rounded-[18px] p-3.5"
            style={{ boxShadow: "0 3px 0 0 var(--sign-red)" }}
          >
            <label
              className="flex min-h-12 items-center gap-2.5 rounded-[12px] px-3.5 py-3"
              style={{ border: "1.5px solid #ddd7ce" }}
            >
              <span
                aria-hidden
                className="size-[9px] shrink-0 rounded-full"
                style={{ background: "var(--ink-muted)" }}
              />
              <input
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
                placeholder={t("taxi.fromPlaceholder")}
                value={originQuery}
                onChange={(e) => setOriginQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && planTrip()}
              />
            </label>
            <label
              className="flex min-h-12 items-center gap-2.5 rounded-[12px] px-3.5 py-3"
              style={{
                border: `1.5px solid ${destQuery ? "var(--sign-red)" : "#ddd7ce"}`,
                boxShadow: destQuery ? "0 0 0 3.5px rgba(215,38,61,.14)" : undefined,
              }}
            >
              <span
                aria-hidden
                className="size-[9px] shrink-0 rounded-[2px]"
                style={{ background: "var(--sign-red)" }}
              />
              <input
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
                placeholder={t("taxi.toPlaceholder")}
                value={destQuery}
                onChange={(e) => setDestQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && planTrip()}
              />
            </label>
            <PressButton
              tone="red"
              onClick={planTrip}
              disabled={planning || !destQuery.trim()}
              className="rounded-[12px]"
            >
              {planning ? "…" : t("taxi.calcFare")}
            </PressButton>
            <button
              onClick={() => {
                setWantLocation(true);
                setOriginQuery("");
              }}
              className="min-h-11 text-start text-[12px] font-bold"
              style={{ color: "var(--sign-red)" }}
            >
              {gps.position
                ? `${t("taxi.usingMyLocation")} (±${Math.round(gps.accuracy ?? 0)} m)`
                : wantLocation
                  ? t("taxi.locating")
                  : t("taxi.useMyLocation")}
            </button>
            {wantLocation && gps.error && (
              <p className="text-[12px] text-[var(--sign-red)]">{gps.error}</p>
            )}
            {planError && (
              <p className="text-[12px] text-[var(--sign-red)]">{planError}</p>
            )}
          </div>

          {/* The estimate, read off a meter — the object this trip is about. */}
          {sectionLabel(t("taxi.fareEstimate"))}
          <Meter
            fare={plan ? plan.fare.low : 0}
            extras={tolls}
            size="md"
            stats={
              plan
                ? [
                    `${(plan.distanceM / 1000).toFixed(1)} km`,
                    `${t("plan.minutesUnit") === "min" ? "≈" : "約"} ${Math.round(plan.durationS / 60)} min`,
                    t("taxi.tollRow"),
                  ]
                : ["— km", "— min", t("taxi.tollRow")]
            }
          />
          <p className="text-[12px] leading-[1.6] text-ink-muted">
            {t("taxi.estimateNote")}
          </p>

          {languageRow}
          {sayBlock}

          <p className="mt-auto pt-1 text-center text-[11px] font-medium leading-[1.6] text-ink-faint">
            {t("taxi.tariffNote")}
          </p>
        </div>
      </Screen>
    );
  }

  // ---------------------------------------------------------- 02 俾司機睇
  if (phase === "show") {
    return (
      <Screen tone="taxi" flush>
        <TopBar variant="taxi" title={t("taxi.showDriver")} onBack={onBack} />

        <div className="flex flex-col gap-3.5 p-[18px]">
          <p className="text-center text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink-faint">
            {t("taxi.holdItUp")}
          </p>

          {/* The whole point of the screen: something a driver can read. */}
          <PlasticSign>
            <p
              style={{
                font: "900 13px/1 'Noto Sans HK',sans-serif",
                letterSpacing: ".2em",
                color: "rgba(20,17,15,.6)",
              }}
              lang="zh-HK"
            >
              {t("taxi.pleaseGoTo")}
            </p>
            <p
              className="mt-2 break-words"
              style={{
                font: "900 44px/1.15 'Noto Sans HK',sans-serif",
                color: "#c8102e",
              }}
              lang="zh-HK"
            >
              {plan?.destinationChinese ?? plan?.destinationInput}
            </p>
            {plan?.destinationAddress && (
              <p
                className="mt-2"
                style={{ font: "700 17px/1.4 'Noto Sans HK',sans-serif" }}
                lang="zh-HK"
              >
                {plan.destinationAddress}
              </p>
            )}
            <p
              style={{
                font: "500 13px/1.4 var(--font-archivo),sans-serif",
                color: "rgba(20,17,15,.62)",
              }}
            >
              {plan?.destinationInput}
            </p>
          </PlasticSign>

          <PressButton
            tone="ink"
            tall
            onClick={() =>
              speakCantonese(
                plan?.destinationChinese ?? plan?.destinationInput ?? "",
                personaKey,
              )
            }
          >
            <span className="flex items-center justify-center gap-2.5 text-[17px]">
              <Volume2 className="size-5" aria-hidden strokeWidth={2.2} />
              {t("taxi.readAloud")}
            </span>
          </PressButton>

          <div className="card flex items-center justify-between gap-2 rounded-[16px] px-3.5 py-3">
            <span className="sign-zh text-[15px]">
              {t("taxi.estimateRange")
                .replace("{low}", String(plan?.fare.low ?? 0))
                .replace("{high}", String(plan?.fare.high ?? 0))}
            </span>
            <span className="shrink-0 text-[12px] font-medium text-ink-muted">
              {((plan?.distanceM ?? 0) / 1000).toFixed(1)} km ·{" "}
              {Math.round((plan?.durationS ?? 0) / 60)} min
            </span>
          </div>

          {sectionLabel(t("taxi.sayOnBoarding"))}
          <div className="flex flex-col gap-2.5">
            {boarding.map((p) => phraseCard(p))}
          </div>

          <PressButton
            tone="white"
            className="mt-auto rounded-[12px] border-[1.5px] shadow-none"
            onClick={() => setRiding(true)}
          >
            <span className="flex items-center justify-center gap-2.5 text-[15px]">
              <Car className="size-5" aria-hidden strokeWidth={2.2} />
              {t("taxi.inTaxi")}
            </span>
          </PressButton>
        </div>
      </Screen>
    );
  }

  // ------------------------------------------- 03 車程中 / 04 偏離路線
  if (phase === "ride") {
    return (
      <Screen tone="taxi" flush>
        <TopBar variant="taxi" title={t("taxi.stageDuring")} onBack={onBack}>
          {/* The pill is the state: white-on-red tracking, amber when adrift */}
          <span
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5"
            style={{
              background: offRoute ? "#ffde59" : "rgba(0,0,0,.22)",
            }}
          >
            <span
              aria-hidden
              className="soft-pulse size-[7px] rounded-full"
              style={{ background: offRoute ? "var(--ink)" : "#ffde59" }}
            />
            <span
              className="text-[10px] font-extrabold uppercase tracking-[0.12em]"
              style={{ color: offRoute ? "var(--ink)" : "#fff" }}
            >
              {offRoute ? t("taxi.offRoutePill") : t("taxi.gpsTracking")}
            </span>
          </span>
        </TopBar>

        <div className="flex flex-col gap-3 px-4 pb-4 pt-3.5">
          {offRoute && (
            <div
              className="rounded-[16px] px-4 py-[15px]"
              style={{
                background: "var(--sign-amber-soft)",
                border: "2px solid var(--sign-amber)",
              }}
            >
              <p
                className="sign-zh text-[19px] leading-[1.3]"
                style={{ color: "var(--sign-amber)" }}
              >
                {t("taxi.offRouteTitle")}
              </p>
              <p
                className="mt-1 text-[13px] leading-[1.6]"
                style={{ color: "#8a5309" }}
              >
                {t("taxi.offRouteBody")
                  .replace("{m}", String(Math.round(lastOffsetRef.current ?? 0)))
                  .replace("{n}", String(detourStreak))}
              </p>
              <PressButton
                tone="ink"
                tall
                className="mt-3 rounded-[12px]"
                onClick={() => speakCantonese("請問行邊條路？", personaKey)}
              >
                <span className="flex items-center justify-center gap-2">
                  <Volume2 className="size-5" aria-hidden strokeWidth={2.2} />
                  {t("taxi.whichWayQ")}
                </span>
              </PressButton>
            </div>
          )}

          {/* Running meter — large while on route, a reference when adrift. */}
          <Meter
            fare={meter.fare}
            extras={tolls}
            hired
            size={offRoute ? "sm" : "lg"}
            stats={meterStats}
          />

          <RideMap
            stops={mapStops}
            path={plan?.path ?? []}
            position={gps.position}
            boardingSeq={1}
            destinationSeq={2}
            riding
            accuracyM={gps.accuracy}
            lineTone={offRoute ? "amber" : "red"}
          />

          {!offRoute && (
            <div
              className="rounded-[14px] px-3.5 py-3 text-center"
              style={{ background: "var(--sign-green-soft)" }}
            >
              <p
                className="sign-zh text-[16px] leading-[1.3]"
                style={{ color: "var(--sign-green)" }}
              >
                {t("taxi.onRouteTitle")}
              </p>
              <p
                className="mt-0.5 text-[12px] leading-[1.4]"
                style={{ color: "var(--sign-green)" }}
              >
                {t("taxi.onRouteDetail")
                  .replace("{dist}", `${remainingKm.toFixed(1)} km`)
                  .replace("{acc}", String(Math.round(gps.accuracy ?? 0)))}
              </p>
            </div>
          )}

          {offRoute && (
            <>
              {sectionLabel(t("taxi.noteTheTaxi"))}
              <div
                className="card flex items-center gap-3.5 rounded-[16px] p-3.5"
                style={{ boxShadow: "0 3px 0 0 #ddd7ce" }}
              >
                <span
                  className="shrink-0 px-[11px] py-2"
                  style={{
                    background: "#ffde59",
                    border: "2.5px solid var(--ink)",
                    borderRadius: 6,
                    font: "900 20px/1 var(--font-archivo),sans-serif",
                    letterSpacing: ".06em",
                  }}
                >
                  {plateNumber}
                </span>
                <span className="flex min-w-0 flex-col gap-[3px]">
                  <span className="text-[13px] font-bold leading-[1.3]">
                    {t("taxi.plateNoted")}
                  </span>
                  <span className="text-[11px] leading-[1.4] text-ink-muted">
                    {t("taxi.plateNotedSub")}
                  </span>
                </span>
              </div>
              <div className="card flex flex-col gap-[11px] rounded-[16px] p-3.5">
                {tipList(DETOUR_TIPS)}
              </div>
            </>
          )}

          {!offRoute && (
            <>
              {sectionLabel(t("taxi.duringPhrases"))}
              <div className="flex flex-col gap-2.5">
                {during.map((p) => phraseCard(p))}
              </div>
              <PressButton
                tone="white"
                className="rounded-[12px] border-[1.5px] shadow-none"
                onClick={() => setComposerOpen(true)}
              >
                <span className="flex items-center justify-center gap-2.5 text-[15px]">
                  <Mic className="size-5" aria-hidden strokeWidth={2.2} />
                  {t("taxi.saySomethingElse")}
                </span>
              </PressButton>
            </>
          )}

          <PressButton
            tone="red"
            tall
            className="mt-auto rounded-[14px]"
            onClick={() => setArrived(true)}
          >
            {t("taxi.arrivedStop")}
          </PressButton>
        </div>

        {composerOpen && (
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
              {sayBlock}
            </div>
          </div>
        )}
      </Screen>
    );
  }

  // ------------------------------------------------------- 05 落車找數
  const meterDue = meter.fare;
  const totalDue = meterDue + tolls;
  return (
    <Screen tone="taxi" flush>
      <TopBar variant="taxi" title={t("taxi.payTitle")} onBack={onBack}>
        <span className="rounded-full bg-white/20 px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white">
          {t("taxi.arrivedPill")}
        </span>
      </TopBar>

      <div className="flex flex-col gap-3 px-4 pb-4 pt-3.5">
        <Meter
          fare={meterDue}
          extras={tolls}
          size="lg"
          stats={[
            `${meter.km.toFixed(1)} km`,
            `${Math.floor(meter.elapsedS / 60)}m ${String(Math.floor(meter.elapsedS % 60)).padStart(2, "0")}s`,
            "0.0 km/h",
          ]}
        />

        {/* What you actually hand over, itemised so nothing is a surprise. */}
        <div className="card flex flex-col gap-2 rounded-[16px] p-3.5">
          <div className="flex justify-between text-[14px] font-medium text-ink-muted">
            <span>{t("taxi.meterRow")}</span>
            <span>${meterDue.toFixed(1)}</span>
          </div>
          <div className="flex justify-between text-[14px] font-medium text-ink-muted">
            <span>{t("taxi.tollRow")}</span>
            <span>${tolls.toFixed(1)}</span>
          </div>
          <div aria-hidden style={{ background: "var(--rule)", height: 1 }} />
          <div className="flex items-baseline justify-between">
            <span className="sign-zh text-[17px]">{t("taxi.totalRow")}</span>
            <span
              className="text-[26px] font-black"
              style={{ color: "var(--sign-red)" }}
            >
              ${totalDue.toFixed(1)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {paying.map((p) => phraseCard(p, p.id === "receipt"))}
        </div>

        <div className="card rounded-[16px] p-3.5">
          <p className="sign-zh text-[14px] leading-[1.3]">
            {t("taxi.rightsTitleZh")}
          </p>
          <div className="mt-2.5 flex flex-col gap-2.5">
            {tipList(PAYING_TIPS)}
          </div>
          <p className="mt-2.5 text-[10.5px] leading-[1.5] text-ink-faint">
            {t("taxi.notLegalAdvice")}
          </p>
        </div>

        <PressButton
          tone="white"
          className="mt-auto rounded-[12px] border-[1.5px] shadow-none"
          onClick={() => {
            setArrived(false);
            setRiding(false);
            setPlan(null);
            setDetourStreak(0);
          }}
        >
          {t("taxi.newTrip")}
        </PressButton>
      </div>
    </Screen>
  );
}
