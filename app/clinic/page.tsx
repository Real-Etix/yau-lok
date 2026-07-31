"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CLINIC_PHRASES, type ClinicPhrase } from "@/data/clinic-phrases";
import { VOICE_PERSONAS, DEFAULT_PERSONA_KEY } from "@/data/voices";
import {
  USER_LANGUAGES,
  DEFAULT_LANGUAGE_CODE,
  getLanguage,
} from "@/data/languages";
import { useGeolocation } from "@/hooks/useGeolocation";
import { getAeWaits, type AeHospital } from "@/lib/toolhub";
import { friendlyMicError, listenUserSpeech, speakCantonese } from "@/lib/speech";

type SayResult = {
  cantonese: string;
  jyutping: string;
  /** Back-translation, written in the user's own language */
  back: string;
  note?: string;
};

const GROUPS: { id: ClinicPhrase["group"]; label: string }[] = [
  { id: "arrive", label: "Arriving" },
  { id: "symptom", label: "Symptoms" },
  { id: "ask", label: "Questions" },
];

export default function ClinicPage() {
  const [personaKey, setPersonaKey] = useState(DEFAULT_PERSONA_KEY);
  const [coach, setCoach] = useState(true);
  const [langCode, setLangCode] = useState(DEFAULT_LANGUAGE_CODE);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [hospitals, setHospitals] = useState<AeHospital[] | null>(null);
  const [loadingWaits, setLoadingWaits] = useState(true);

  const [sayText, setSayText] = useState("");
  const [sayResult, setSayResult] = useState<SayResult | null>(null);
  const [sayLoading, setSayLoading] = useState(false);
  const [sayListening, setSayListening] = useState(false);
  const [sayError, setSayError] = useState<string | null>(null);

  const gps = useGeolocation(true);

  useEffect(() => {
    const saved = localStorage.getItem("yau-lok-voice");
    if (saved && VOICE_PERSONAS.some((p) => p.key === saved)) {
      setPersonaKey(saved);
    }
    const lang = localStorage.getItem("yau-lok-lang");
    if (lang && USER_LANGUAGES.some((l) => l.code === lang)) setLangCode(lang);
  }, []);

  // Nearest A&E departments, with live waiting times.
  useEffect(() => {
    let cancelled = false;
    setLoadingWaits(true);
    getAeWaits(gps.position?.lat, gps.position?.lng)
      .then((h) => {
        if (!cancelled) setHospitals(h);
      })
      .finally(() => {
        if (!cancelled) setLoadingWaits(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gps.position?.lat, gps.position?.lng]);

  const speak = useCallback(
    async (p: ClinicPhrase) => {
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

  return (
    <main className="mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-col gap-4 overflow-x-hidden p-4">
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
        <p className="text-sm font-semibold">🏥 Clinic &amp; counters</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Say what&apos;s wrong, ask what happens next, and see where the wait
          is shortest.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          A&amp;E waiting times {gps.position ? "· nearest first" : "· all"}
        </p>
        {loadingWaits && (
          <div className="mt-2 space-y-2">
            <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          </div>
        )}
        {hospitals && !loadingWaits && (
          <ul className="mt-2 space-y-1.5">
            {hospitals.slice(0, 4).map((h) => (
              <li
                key={h.id}
                className="rounded-lg bg-slate-50 p-2.5 text-sm"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">{h.name}</span>
                  {h.wait && (
                    <span className="shrink-0 font-semibold text-slate-900">
                      ~{h.wait}
                    </span>
                  )}
                </div>
                <span className="block text-xs text-slate-500">
                  {h.district}
                  {h.distanceM !== null &&
                    ` · ${(h.distanceM / 1000).toFixed(1)} km`}
                  {h.urgentWait && ` · urgent cases ~${h.urgentWait}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate-400">
          Hospital Authority data via HKGAI Toolhub. Headline figures are the
          median wait for less urgent cases — genuine emergencies are seen
          first. In an emergency call 999.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Say anything · AI
        </p>
        <label className="mt-2 block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            I speak
          </span>
          <span className="field">
            <span aria-hidden className="field-icon">
              🌏
            </span>
            <select
              className="field-select"
              value={langCode}
              onChange={(e) => {
                setLangCode(e.target.value);
                localStorage.setItem("yau-lok-lang", e.target.value);
              }}
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
          className={`mt-2 w-full rounded-xl p-3.5 text-center font-semibold text-white transition active:scale-95 disabled:opacity-70 ${
            sayListening ? "animate-pulse bg-red-600" : "bg-indigo-600"
          }`}
        >
          {sayListening
            ? "🔴 Listening… speak now"
            : sayLoading
              ? "Translating…"
              : "🎙️ Describe it in your language"}
        </button>
        <div className="mt-2 flex gap-2">
          <span className="field min-w-0 flex-1">
            <span aria-hidden className="field-icon">
              ✍️
            </span>
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
            <span className="block text-2xl font-bold">
              {sayResult.cantonese}
            </span>
            {coach && (
              <span className="mt-0.5 block text-xs opacity-80">
                {sayResult.jyutping}
              </span>
            )}
            <span className="mt-0.5 block text-xs opacity-80">
              {sayResult.back} · tap to repeat
            </span>
          </button>
        )}
        {sayResult?.note && (
          <p className="mt-1.5 text-xs text-slate-500">💡 {sayResult.note}</p>
        )}
      </section>

      {GROUPS.map((g) => (
        <section key={g.id}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            {g.label}
          </p>
          <div className="space-y-2">
            {CLINIC_PHRASES.filter((p) => p.group === g.id).map((p) => (
              <button
                key={p.id}
                onClick={() => speak(p)}
                className={`w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition active:scale-95 ${
                  speaking === p.id ? "ring-2 ring-amber-400" : ""
                }`}
              >
                <span className="block text-base font-semibold">
                  {p.cantonese}
                </span>
                {coach && (
                  <span className="block text-xs text-slate-500">
                    {p.jyutping}
                  </span>
                )}
                <span className="block text-xs text-slate-500">
                  {p.english}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}

      <p className="pb-4 text-center text-xs text-slate-400">
        Cantonese spoken by HKGAI · waiting times from Hospital Authority open
        data
      </p>
    </main>
  );
}
