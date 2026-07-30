"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TAXI_PHRASES, TAXI_TIPS, type TaxiPhrase } from "@/data/taxi-phrases";
import { VOICE_PERSONAS, DEFAULT_PERSONA_KEY } from "@/data/voices";
import { USER_LANGUAGES, DEFAULT_LANGUAGE_CODE, getLanguage } from "@/data/languages";
import { useGeolocation, useWakeLock } from "@/hooks/useGeolocation";
import { cumulativeMeters, projectOntoPath, type LatLng } from "@/lib/geo";
import { friendlyMicError, listenUserSpeech, speakCantonese } from "@/lib/speech";
import RideMap from "@/components/RideMap";

type Plan = {
  distanceM: number;
  durationS: number;
  path: [number, number][];
  destinationChinese: string | null;
  destinationInput: string;
  fare: { low: number; high: number; base: number };
};

type SayResult = { cantonese: string; jyutping: string; back: string; note?: string };

/** How far off the planned route before we say something. */
const DETOUR_WARN_M = 400;
/** Consecutive off-route fixes before warning — one bad GPS fix isn't a detour. */
const DETOUR_STREAK = 3;

const GROUPS: { id: TaxiPhrase["group"]; label: string }[] = [
  { id: "boarding", label: "Getting in" },
  { id: "during", label: "On the way" },
  { id: "paying", label: "Paying" },
];

export default function TaxiPage() {
  const [personaKey, setPersonaKey] = useState(DEFAULT_PERSONA_KEY);
  const [langCode, setLangCode] = useState(DEFAULT_LANGUAGE_CODE);
  const [coach, setCoach] = useState(true);

  const [originQuery, setOriginQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [riding, setRiding] = useState(false);
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
    const l = localStorage.getItem("yau-lok-lang");
    if (l && USER_LANGUAGES.some((x) => x.code === l)) setLangCode(l);
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
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : "Could not plan that trip");
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
        setSayError(e instanceof Error ? e.message : "Could not translate");
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

  const mapStops = useMemo(() => {
    if (routePath.length < 2) return [];
    const first = routePath[0];
    const last = routePath[routePath.length - 1];
    return [
      { seq: 1, name: { en: "Pick-up", tc: "上車" }, lat: first.lat, lng: first.lng },
      {
        seq: 2,
        name: { en: plan?.destinationInput ?? "Destination", tc: plan?.destinationChinese ?? "目的地" },
        lat: last.lat,
        lng: last.lng,
      },
    ];
  }, [routePath, plan]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm font-medium text-slate-500">
          ← Yau Lok!
        </Link>
        <button
          onClick={() => setCoach((c) => !c)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            coach ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-700"
          }`}
        >
          Coach
        </button>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold">🚕 Where to?</p>
        <p className="mt-0.5 text-xs text-slate-500">
          We&apos;ll show the driver the address in Chinese, estimate the fare,
          and watch the route while you ride.
        </p>
        <span className="field mt-2 block">
          <span aria-hidden className="field-icon">🧍</span>
          <input
            className="field-input"
            placeholder="From (e.g. Shek Pai Wan Estate)"
            value={originQuery}
            onChange={(e) => setOriginQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && planTrip()}
          />
        </span>
        <button
          onClick={() => {
            setWantLocation(true);
            setOriginQuery("");
          }}
          className="mt-1 text-xs font-medium text-indigo-600"
        >
          {gps.position
            ? `📍 using my location (±${Math.round(gps.accuracy ?? 0)} m)`
            : wantLocation
              ? "locating…"
              : "📍 or start from my location"}
        </button>
        {wantLocation && gps.error && (
          <p className="mt-1 text-xs text-red-600">{gps.error}</p>
        )}
        <div className="mt-2 flex gap-2">
          <span className="field min-w-0 flex-1">
            <span aria-hidden className="field-icon">🎯</span>
            <input
              className="field-input"
              placeholder="To (e.g. Times Square)"
              value={destQuery}
              onChange={(e) => setDestQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && planTrip()}
            />
          </span>
          <button
            onClick={planTrip}
            disabled={planning || !destQuery.trim()}
            className="rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition active:scale-95 disabled:opacity-40"
          >
            {planning ? "…" : "Plan"}
          </button>
        </div>
        {planError && <p className="mt-2 text-sm text-red-600">{planError}</p>}
      </section>

      {plan && (
        <>
          {/* The single most useful thing: something the driver can read */}
          <section className="rounded-2xl border-2 border-slate-900 bg-white p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Show this to the driver
            </p>
            <p className="mt-1 text-3xl font-bold leading-snug">
              {plan.destinationChinese ?? plan.destinationInput}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {plan.destinationInput}
            </p>
            <button
              onClick={() =>
                speakCantonese(
                  `唔該，去${plan.destinationChinese ?? plan.destinationInput}。`,
                  personaKey,
                )
              }
              className="mt-3 w-full rounded-xl bg-slate-900 py-3 font-semibold text-white transition active:scale-95"
            >
              🔊 Say it in Cantonese
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">
                About HK${plan.fare.low}–{plan.fare.high}
              </span>
              <span className="text-xs text-slate-500">
                {(plan.distanceM / 1000).toFixed(1)} km ·{" "}
                {Math.round(plan.durationS / 60)} min
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Estimate from the urban (red) taxi scale for this distance, with
              an allowance for traffic. <strong>Excludes</strong> tunnel tolls,
              luggage and pet surcharges, so the meter can legitimately read
              more. Verify current rates on td.gov.hk.
            </p>
          </section>

          <RideMap
            stops={mapStops}
            path={plan.path}
            position={gps.position}
            boardingSeq={1}
            destinationSeq={2}
            riding={riding}
            accuracyM={gps.accuracy}
          />

          {!riding ? (
            <button
              onClick={() => setRiding(true)}
              className="rounded-2xl bg-indigo-600 p-5 text-center text-lg font-semibold text-white shadow-lg transition active:scale-95"
            >
              🚕 I&apos;m in the taxi — watch the route
              <span className="mt-0.5 block text-sm font-normal opacity-85">
                uses GPS, keeps the screen awake
              </span>
            </button>
          ) : (
            <section
              className={`rounded-2xl p-4 text-center ${
                offRoute
                  ? "bg-amber-100 text-amber-950"
                  : "bg-emerald-100 text-emerald-900"
              }`}
            >
              <p className="text-lg font-semibold">
                {offRoute ? "You're off the planned route" : "On the planned route"}
              </p>
              <p className="mt-1 text-sm">
                {offRoute
                  ? "This can be a normal diversion — roadworks or traffic. If you're unsure, ask the driver which way they're going."
                  : gps.position
                    ? `following your position · ±${Math.round(gps.accuracy ?? 0)} m`
                    : "waiting for GPS fix…"}
              </p>
              {offRoute && (
                <button
                  onClick={() =>
                    speakCantonese("請問行邊條路？", personaKey)
                  }
                  className="mt-2 w-full rounded-xl bg-white/80 py-2.5 font-semibold"
                >
                  🔊 「請問行邊條路？」 Which way are we going?
                </button>
              )}
              <button
                onClick={() => {
                  setRiding(false);
                  setDetourStreak(0);
                }}
                className="mt-2 rounded-lg bg-white/70 px-3 py-1.5 text-sm font-medium"
              >
                Arrived — stop watching
              </button>
            </section>
          )}
        </>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Say anything · AI
        </p>
        <label className="mt-2 block">
          <span className="mb-1 block text-xs font-medium text-slate-600">I speak</span>
          <span className="field">
            <span aria-hidden className="field-icon">🌏</span>
            <select
              className="field-select"
              value={langCode}
              onChange={(e) => {
                setLangCode(e.target.value);
                localStorage.setItem("yau-lok-lang", e.target.value);
              }}
            >
              {USER_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </span>
        </label>
        <button
          onClick={sayByVoice}
          disabled={sayListening || sayLoading}
          className={`mt-2 w-full rounded-xl p-3.5 text-center font-semibold text-white transition active:scale-95 disabled:opacity-70 ${
            sayListening ? "animate-pulse bg-red-600" : "bg-indigo-600"
          }`}
        >
          {sayListening ? "🔴 Listening… speak now" : sayLoading ? "Translating…" : "🎙️ Say it in your language"}
        </button>
        <div className="mt-2 flex gap-2">
          <span className="field min-w-0 flex-1">
            <span aria-hidden className="field-icon">✍️</span>
            <input
              className="field-input"
              placeholder="…or type it — any language"
              value={sayText}
              onChange={(e) => setSayText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSay(sayText)}
            />
          </span>
          <button
            onClick={() => runSay(sayText)}
            disabled={sayLoading || sayListening || !sayText.trim()}
            className="rounded-xl bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition active:scale-95 disabled:opacity-40"
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
            <span className="block text-2xl font-bold">{sayResult.cantonese}</span>
            {coach && (
              <span className="mt-0.5 block text-xs opacity-80">{sayResult.jyutping}</span>
            )}
            <span className="mt-0.5 block text-xs opacity-80">
              {sayResult.back} · tap to repeat
            </span>
          </button>
        )}
      </section>

      {GROUPS.map((g) => (
        <section key={g.id}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            {g.label}
          </p>
          <div className="space-y-2">
            {TAXI_PHRASES.filter((p) => p.group === g.id).map((p) => (
              <button
                key={p.id}
                onClick={() => speak(p)}
                className={`w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition active:scale-95 ${
                  speaking === p.id ? "ring-2 ring-amber-400" : ""
                }`}
              >
                <span className="block text-base font-semibold">{p.cantonese}</span>
                {coach && (
                  <span className="block text-xs text-slate-500">{p.jyutping}</span>
                )}
                <span className="block text-xs text-slate-500">{p.english}</span>
              </button>
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold">Know where you stand</p>
        <ul className="mt-2 space-y-2.5">
          {TAXI_TIPS.map((t) => (
            <li key={t.title}>
              <p className="text-sm font-medium">{t.title}</p>
              <p className="text-xs leading-relaxed text-slate-500">{t.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-400">
          General information based on Transport Department guidance — not
          legal advice. Check td.gov.hk for the current rules and complaint
          channels.
        </p>
      </section>

      <p className="pb-4 text-center text-xs text-slate-400">
        Routes and addresses via HKGAI Toolhub · Cantonese spoken by HKGAI
      </p>
    </main>
  );
}
