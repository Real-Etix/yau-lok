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
import { AE_FEES, TRIAGE_LEVELS } from "@/data/ae-fees";
import PlasticSign from "@/components/PlasticSign";
import { friendlyMicError, listenUserSpeech, speakCantonese } from "@/lib/speech";
import {
  Screen,
  TopBar,
  PressButton,
  LanguageRow,
  Emergency999,
} from "@/components/ui";
import {
  Pencil,
  Mic,
  Volume2,
  Globe,
  ChevronDown,
  Plus,
  Hospital,
  MessagesSquare,
  TriangleAlert,
} from "lucide-react";
import { useT, useLanguage, useBilingual } from "@/lib/i18n";

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
  const t = useT();
  const [personaKey, setPersonaKey] = useState(DEFAULT_PERSONA_KEY);
  const [coach, setCoach] = useState(true);
  // The five screens of a hospital visit, in the order they happen.
  const [step, setStep] = useState<
    "triage" | "waits" | "describe" | "counter" | "waiting"
  >("triage");
  // When the patient said they had checked in — the wait is measured from
  // there rather than invented.
  const [checkedInAt, setCheckedInAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // The feed is bilingual; show the reader's side of it.
  const bi = useBilingual();
  // The interface language is the language the user speaks; the say/mic flow
  // reads it from the same context rather than a private copy.
  const { lang: langCode } = useLanguage();
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
  }, []);

  // Arriving at the counter starts the clock on the wait.
  useEffect(() => {
    if (step === "waiting" && checkedInAt === null) {
      const at = Date.now();
      setCheckedInAt(at);
      setNow(at);
    }
  }, [step, checkedInAt]);

  useEffect(() => {
    if (checkedInAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [checkedInAt]);

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

  /** "3 hours" from the Authority reads as "3 hr" on a unit plate. */
  const waitLabel = (h: AeHospital) =>
    h.wait
      ? bi(h.wait).replace(/\s*hours?/i, " hr").replace(/\s*minutes?/i, " min")
      : "—";
  const waitHours = (h: AeHospital) => {
    const m = h.wait?.en.match(/([\d.]+)/);
    return m ? Number(m[1]) : 1;
  };
  const placeLine = (h: AeHospital) =>
    [bi(h.district), h.distanceM != null && `${(h.distanceM / 1000).toFixed(1)} km`]
      .filter(Boolean)
      .join(" · ");

  // How long the patient has actually been waiting, and roughly how many are
  // in front — derived from the published median, never asserted as fact.
  const waitedMs = checkedInAt === null ? 0 : Math.max(0, now - checkedInAt);
  const waitedLabel = (() => {
    const mins = Math.floor(waitedMs / 60000);
    const h = Math.floor(mins / 60);
    return h > 0 ? `${h} h ${mins % 60} min` : `${mins} min`;
  })();
  const aheadOfYou = Math.max(
    0,
    Math.round((((hospitals?.[0] ? waitHours(hospitals[0]) : 1)) * 60 - waitedMs / 60000) / 8),
  );

  /** Triage levels that carry a charge, written as a range: "III – V". */
  const chargedLevels = (() => {
    const charged = TRIAGE_LEVELS.map((l) => l.numeral).filter(
      (n) => !AE_FEES.urgentFreeTriage.includes(n),
    );
    if (charged.length === 0) return "";
    return charged.length === 1
      ? charged[0]
      : `${charged[0]} – ${charged[charged.length - 1]}`;
  })();

  const BODY_PARTS = ["head", "chest", "belly", "back", "limbs", "breath"] as const;

  const arrive = CLINIC_PHRASES.filter((p) => p.group === "arrive");
  const symptom = CLINIC_PHRASES.filter((p) => p.group === "symptom");
  const ask = CLINIC_PHRASES.filter((p) => p.group === "ask");
  const noCantonese = CLINIC_PHRASES.find((p) => p.id === "no-cantonese");

  const phraseCard = (p: ClinicPhrase, sub?: string) => (
    <button
      key={p.id}
      onClick={() => speak(p)}
      className={`press card min-h-11 w-full rounded-[14px] px-3.5 py-3 text-start ${
        speaking === p.id ? "ring-2 ring-[var(--sign-blue)]" : ""
      }`}
      style={{ boxShadow: "0 3px 0 0 #ddd7ce" }}
    >
      <span className="block text-[16px] font-bold leading-[1.3]" lang="zh-HK">
        {p.cantonese}
      </span>
      <span className="mt-0.5 block text-[11px] leading-[1.4] text-ink-faint">
        {coach ? `${p.jyutping}` : p.english}
        {sub ? ` · ${sub}` : ""}
      </span>
    </button>
  );

  const sectionLabel = (text: string) => (
    <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
      {text}
    </span>
  );

  const languageRow = <LanguageRow accent="var(--sign-blue)" />;

  /** The 999 card. Red, first on the screen, and never a soft colour. */
  const emergencyCard = (
    <Emergency999
      className="flex items-center gap-3.5 rounded-[18px] px-[18px] py-4"
      style={{
        background: "var(--sign-red)",
        boxShadow: "0 4px 0 0 var(--sign-red-deep)",
      }}
    >
      <span className="flex size-[52px] shrink-0 items-center justify-center rounded-[14px] bg-white">
        <Plus
          className="size-8"
          style={{ color: "var(--sign-red)" }}
          aria-hidden
          strokeWidth={3}
        />
      </span>
      <span className="flex min-w-0 flex-col gap-[3px]">
        <span className="sign-zh text-[22px] leading-[1.1] text-white">
          {t("clinic.call999")}
        </span>
        <span
          className="text-[12.5px] leading-[1.4]"
          style={{ color: "#ffd7dd" }}
        >
          {t("clinic.call999Sub")}
        </span>
      </span>
    </Emergency999>
  );

  // Back walks the visit backwards; only 分流 leaves for the home screen.
  const BACK: Record<string, "triage" | "waits" | undefined> = {
    triage: undefined,
    waits: "triage",
    describe: "triage",
    counter: "waits",
    waiting: "waits",
  };
  const header = (title: string, extra?: React.ReactNode) => {
    const to = BACK[step];
    return (
      <TopBar
        variant="ambulance"
        title={title}
        onBack={to ? () => setStep(to) : undefined}
      >
        {extra}
      </TopBar>
    );
  };

  const unitPlate = (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden
        className="soft-pulse size-[9px] rounded-full"
        style={{ background: "var(--sign-blue)" }}
      />
      <span
        className="text-[13px] font-black tracking-[0.06em]"
        style={{ color: "var(--sign-blue)" }}
      >
        {t("clinic.unit")}
      </span>
    </span>
  );

  // ------------------------------------------------------------- 01 分流
  if (step === "triage") {
    return (
      <Screen tone="ward" flush>
        {header(t("clinic.title"), unitPlate)}

        <div className="flex flex-1 flex-col gap-[13px] px-[18px] py-4">
          {emergencyCard}

          {sectionLabel(t("clinic.not999"))}
          <div
            className="card flex flex-col gap-2.5 rounded-[18px] p-3.5"
            style={{ boxShadow: "0 3px 0 0 var(--sign-blue)" }}
          >
            <button
              onClick={() => setStep("waits")}
              className="flex min-h-12 items-center gap-3 text-start"
            >
              <span
                className="flex size-[46px] shrink-0 items-center justify-center rounded-[12px] text-white"
                style={{ background: "var(--sign-blue)" }}
              >
                <Hospital className="size-6" aria-hidden strokeWidth={2.2} />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="sign-zh text-[17px] leading-[1.2]">
                  {t("clinic.goAe")}
                </span>
                <span className="text-[12.5px] leading-[1.35] text-ink-muted">
                  {t("clinic.goAeSub")}
                </span>
              </span>
            </button>
            <div aria-hidden style={{ background: "var(--rule)", height: 1 }} />
            <button
              onClick={() => setStep("describe")}
              className="flex min-h-12 items-center gap-3 text-start"
            >
              <span
                className="flex size-[46px] shrink-0 items-center justify-center rounded-[12px]"
                style={{
                  background: "var(--sign-blue-soft)",
                  color: "var(--sign-blue)",
                }}
              >
                <MessagesSquare className="size-6" aria-hidden strokeWidth={2.2} />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="sign-zh text-[17px] leading-[1.2]">
                  {t("clinic.describe")}
                </span>
                <span className="text-[12.5px] leading-[1.35] text-ink-muted">
                  {t("clinic.describeSub")}
                </span>
              </span>
            </button>
          </div>

          {languageRow}

          {/* The triage key: why the person after you was seen first. */}
          <div className="card rounded-[16px] p-3.5">
            <p className="sign-zh text-[14px] leading-[1.3]">
              {t("clinic.fiveLevels")}
            </p>
            <div className="mt-2.5 flex flex-col gap-2">
              {TRIAGE_LEVELS.map((lv) => (
                <div key={lv.numeral} className="flex items-center gap-2.5">
                  <span
                    className="h-[22px] w-[26px] shrink-0 rounded-[4px] text-center text-[12px] font-black leading-[22px] text-white"
                    style={{ background: lv.colour }}
                  >
                    {lv.numeral}
                  </span>
                  <span className="text-[12.5px] leading-[1.3] text-ink-muted">
                    {t(lv.key)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-auto pt-1 text-center text-[11px] font-medium leading-[1.6] text-ink-faint">
            {t("clinic.triageNote")}
          </p>
        </div>
      </Screen>
    );
  }

  // --------------------------------------------------------- 02 輪候時間
  if (step === "waits") {
    const [nearest, ...others] = hospitals ?? [];
    const rest = others.slice(0, 3);
    return (
      <Screen tone="ward" flush>
        {header(
          t("clinic.waitsTitle"),
          gps.position ? (
            <span
              className="rounded-full px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em]"
              style={{ background: "var(--sign-blue)", color: "var(--amb-yellow)" }}
            >
              {t("clinic.nearYou")}
            </span>
          ) : undefined,
        )}

        <div className="flex flex-1 flex-col gap-[11px] px-[18px] py-4">
          {loadingWaits && (
            <>
              <div className="h-28 animate-pulse rounded-[18px] bg-white/70" />
              <div className="h-16 animate-pulse rounded-[16px] bg-white/70" />
            </>
          )}

          {/* The nearest one is the decision; the rest are alternatives. */}
          {nearest && (
            <div
              className="rounded-[18px] bg-white p-3.5"
              style={{
                border: "2px solid var(--sign-blue)",
                boxShadow: "0 4px 0 0 var(--sign-blue)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 flex-col gap-[3px]">
                  <span className="sign-zh text-[18px] leading-[1.2]">
                    {bi(nearest.name)}
                  </span>
                  <span className="text-[12px] leading-[1.35] text-ink-muted">
                    {placeLine(nearest)}
                  </span>
                </span>
                <span
                  className="shrink-0 rounded-[7px] px-2.5 py-[7px] text-center"
                  style={{
                    background: "var(--amb-yellow)",
                    border: "2.5px solid var(--sign-blue)",
                  }}
                >
                  <span
                    className="block text-[20px] font-black leading-none"
                    style={{ color: "var(--sign-blue)" }}
                  >
                    {waitLabel(nearest)}
                  </span>
                  <span
                    className="mt-0.5 block text-[9px] font-bold leading-none tracking-[0.1em]"
                    style={{ color: "var(--sign-blue)" }}
                  >
                    {t("clinic.wait")}
                  </span>
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <PressButton
                  tone="blue"
                  className="flex-1 rounded-[11px] text-[14px]"
                  onClick={() => setStep("counter")}
                >
                  {t("clinic.goHere")}
                </PressButton>
                <a
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(nearest.name.en)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="press flex min-h-12 shrink-0 items-center rounded-[11px] px-3.5 text-[14px] font-bold"
                  style={{ border: "1.5px solid #ddd7ce", background: "#fff" }}
                >
                  {t("clinic.map")}
                </a>
              </div>
            </div>
          )}

          {rest.map((h) => (
            <div
              key={h.id}
              className="card flex items-center justify-between gap-3 rounded-[16px] px-3.5 py-[13px]"
            >
              <span className="flex min-w-0 flex-col gap-[3px]">
                <span className="text-[16px] font-extrabold leading-[1.2]">
                  {bi(h.name)}
                </span>
                <span className="text-[11.5px] leading-[1.3] text-ink-muted">
                  {placeLine(h)}
                </span>
              </span>
              <span
                className="shrink-0 rounded-[6px] px-2.5 py-[5px] text-[16px] font-black"
                style={{
                  background: "var(--amb-yellow)",
                  color: "var(--sign-blue)",
                  border: "2px solid var(--sign-blue)",
                }}
              >
                {waitLabel(h)}
              </span>
            </div>
          ))}

          <p
            className="rounded-[14px] px-3.5 py-[13px] text-[12px] leading-[1.65]"
            style={{ background: "var(--sign-blue-soft)", color: "var(--sign-blue)" }}
          >
            {t("clinic.haNote")}
          </p>

          {/* Fees come from data/ae-fees.ts — never written into the markup. */}
          <div className="card rounded-[16px] p-3.5">
            <p className="sign-zh text-[14px] leading-[1.3]">
              {t("clinic.feesTitle")}
            </p>
            <div className="mt-2.5 flex justify-between text-[13px] font-medium text-ink-muted">
              <span>
                {t("clinic.feeFreeRow").replace(
                  "{levels}",
                  AE_FEES.urgentFreeTriage.join(" · "),
                )}
              </span>
              <span style={{ color: "var(--sign-green)" }}>
                {t("clinic.feeFree")}
              </span>
            </div>
            <div className="mt-2 flex justify-between text-[13px] font-medium text-ink-muted">
              <span>{t("clinic.feeStdRow").replace("{levels}", chargedLevels)}</span>
              <span className="text-ink">${AE_FEES.standardHkd}</span>
            </div>
            <p className="mt-2 text-[10.5px] leading-[1.5] text-ink-faint">
              {t("clinic.feeNote")
                .replace("{levels}", chargedLevels)
                .replace("{refund}", String(AE_FEES.leaveEarlyRefundHkd))}{" "}
              {t("clinic.feeChecked").replace("{date}", AE_FEES.lastChecked)}
            </p>
          </div>

          <Emergency999
            className="mt-auto flex items-center justify-center gap-2.5 rounded-[14px] px-3.5 py-3"
            style={{ background: "var(--sign-red)" }}
          >
            <span
              aria-hidden
              className="soft-pulse size-2 rounded-full bg-white"
            />
            <span className="sign-zh text-[15px] text-white">
              {t("clinic.veryUnwell")}
            </span>
          </Emergency999>
        </div>
      </Screen>
    );
  }

  // ---------------------------------------------------------- 03 講病情
  if (step === "describe") {
    return (
      <Screen tone="ward" flush>
        {header(t("clinic.describeTitle"))}

        <div className="flex flex-1 flex-col gap-[13px] px-[18px] py-4">
          <PressButton
            tone="blue"
            onClick={sayByVoice}
            disabled={sayListening || sayLoading}
            className="rounded-[18px] py-6 text-[19px]"
          >
            <span className="flex items-center justify-center gap-2.5">
              <Mic className="size-7" aria-hidden strokeWidth={2.2} />
              {sayListening
                ? t("say.listening")
                : sayLoading
                  ? t("say.translating")
                  : t("clinic.holdToDescribe")}
            </span>
          </PressButton>

          <label
            className="flex min-h-12 items-center gap-2.5 rounded-[12px] bg-white px-3.5 py-3"
            style={{ border: "1.5px solid #ddd7ce" }}
          >
            <Pencil className="size-5 shrink-0 text-ink-faint" aria-hidden strokeWidth={2.2} />
            <input
              className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
              placeholder={t("clinic.orTypeAny")}
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
              className="press rounded-[18px] bg-ink p-4 text-center text-white"
            >
              <span className="sign-zh block text-[26px]" lang="zh-HK">
                {sayResult.cantonese}
              </span>
              {coach && (
                <span className="mt-1.5 block text-[12px] opacity-75">
                  {sayResult.jyutping}
                </span>
              )}
              <span className="mt-1 block text-[12px] opacity-75">
                {sayResult.back} · {t("clinic.tapToRead")}
              </span>
            </button>
          )}

          {sectionLabel(t("clinic.symptomsLabel"))}
          <div className="flex flex-col gap-2.5">
            {symptom.slice(0, 2).map((p) => phraseCard(p))}
          </div>

          {/* Naming the place that hurts is often all a patient can manage. */}
          {sectionLabel(t("clinic.pointAtIt"))}
          <div className="flex flex-wrap gap-2">
            {BODY_PARTS.map((part) => {
              const label = t(`clinic.part.${part}`);
              const on = sayText.includes(label);
              return (
                <button
                  key={part}
                  onClick={() =>
                    setSayText((s) => (s.includes(label) ? s : `${s}${s ? " " : ""}${label}`))
                  }
                  aria-pressed={on}
                  className="min-h-11 rounded-full px-3.5 py-[9px] text-[14px] font-bold"
                  style={{
                    background: on ? "var(--sign-red)" : "#fff",
                    color: on ? "#fff" : "var(--ink)",
                    border: `1.5px solid ${on ? "var(--sign-red)" : "#ddd7ce"}`,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <p className="mt-auto pt-1 text-center text-[11px] font-medium leading-[1.6] text-ink-faint">
            {t("clinic.spokenBy")}
          </p>
        </div>
      </Screen>
    );
  }

  // ---------------------------------------------------------- 04 登記處
  if (step === "counter") {
    return (
      <Screen tone="ward" flush>
        {header(
          t("clinic.counterTitle"),
          hospitals?.[0] ? (
            <span
              className="max-w-[9rem] truncate text-[13px] font-extrabold"
              style={{ color: "var(--sign-blue)" }}
            >
              {bi(hospitals[0].name)}
            </span>
          ) : undefined,
        )}

        <div className="flex flex-1 flex-col gap-[13px] px-[18px] py-4">
          <p className="text-center text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink-faint">
            {t("clinic.showNurse")}
          </p>

          {noCantonese && (
            <PlasticSign tone="ambulance">
              <p
                className="mt-3 break-words"
                style={{
                  font: "900 40px/1.15 'Noto Sans HK',sans-serif",
                  color: "var(--sign-blue)",
                }}
                lang="zh-HK"
              >
                {t("clinic.noCantoneseHeadline")}
              </p>
              <p
                className="mt-2"
                style={{ font: "700 18px/1.4 'Noto Sans HK',sans-serif" }}
                lang="zh-HK"
              >
                {t("clinic.askInterpreter")}
              </p>
              <p
                className="mb-3 mt-1"
                style={{
                  font: "500 13px/1.4 var(--font-archivo),sans-serif",
                  color: "rgba(20,17,15,.66)",
                }}
              >
                {noCantonese.english}
              </p>
            </PlasticSign>
          )}

          <PressButton
            tone="blue"
            tall
            onClick={() =>
              noCantonese && speakCantonese(noCantonese.cantonese, personaKey)
            }
          >
            <span className="flex items-center justify-center gap-2.5 text-[17px]">
              <Volume2 className="size-5" aria-hidden strokeWidth={2.2} />
              {t("clinic.readAloud")}
            </span>
          </PressButton>

          {sectionLabel(t("clinic.arrivingLabel"))}
          <div className="flex flex-col gap-2.5">
            {arrive.filter((p) => p.id !== "no-cantonese").map((p) => phraseCard(p))}
          </div>

          <div className="card rounded-[16px] p-3.5">
            <p className="sign-zh text-[14px] leading-[1.3]">
              {t("clinic.bringTitle")}
            </p>
            <div className="mt-2.5 flex flex-col gap-2">
              {["bringId", "bringMeds", "bringInsurance"].map((k) => (
                <div key={k} className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: "var(--sign-blue)" }}
                  />
                  <span className="text-[13px] leading-[1.4] text-ink-muted">
                    {t(`clinic.${k}`)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {languageRow}

          <div className="mt-auto flex flex-col gap-2.5">
            <PressButton
              tone="white"
              className="rounded-[14px] border-[1.5px] shadow-none"
              onClick={() => setStep("describe")}
            >
              <span
                className="flex items-center justify-center gap-2.5 text-[15px]"
                style={{ color: "var(--sign-blue)" }}
              >
                <Mic className="size-5" aria-hidden strokeWidth={2.2} />
                {t("clinic.sayElse")}
              </span>
            </PressButton>
            <PressButton
              tone="blue"
              tall
              className="rounded-[14px]"
              onClick={() => setStep("waiting")}
            >
              {t("clinic.registered")}
            </PressButton>
          </div>
        </div>
      </Screen>
    );
  }

  // ----------------------------------------------------------- 05 等緊
  return (
    <Screen tone="ward" flush>
      {header(
        t("clinic.waitingTitle"),
        <span
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5"
          style={{ background: "var(--sign-blue)" }}
        >
          <span
            aria-hidden
            className="soft-pulse size-[7px] rounded-full"
            style={{ background: "var(--amb-yellow)" }}
          />
          <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-white">
            {t("clinic.liveUpdate")}
          </span>
        </span>,
      )}

      <div className="flex flex-1 flex-col gap-[13px] px-[18px] py-4">
        <div
          className="rounded-[18px] bg-white p-4 text-center"
          style={{
            border: "2px solid var(--sign-blue)",
            boxShadow: "0 4px 0 0 var(--sign-blue)",
          }}
        >
          <p className="text-[12px] font-medium text-ink-muted">
            {t("clinic.yourNumber")}
          </p>
          <p
            className="mt-1 text-[46px] font-black leading-none"
            style={{ color: "var(--sign-blue)" }}
          >
            {t("clinic.unit")}
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span
              className="rounded-[5px] px-2.5 py-1.5 text-[13px] font-black text-white"
              style={{ background: "var(--sign-blue)" }}
            >
              IV
            </span>
            <span className="text-[13px] font-bold">
              {t("clinic.triage.semiUrgent").split(" — ")[0]}
            </span>
          </div>
          <p className="mt-2.5 text-[12px] text-ink-muted">
            {t("clinic.waitedFor")
              .replace("{time}", waitedLabel)
              .replace("{n}", String(aheadOfYou))}
          </p>
        </div>

        <div
          className="flex items-center gap-3 rounded-[14px] px-3.5 py-[13px]"
          style={{ background: "var(--sign-blue-soft)" }}
        >
          <span
            aria-hidden
            className="soft-pulse size-2 shrink-0 rounded-full"
            style={{ background: "var(--sign-blue)" }}
          />
          <p
            className="text-[12px] leading-[1.6]"
            style={{ color: "var(--sign-blue)" }}
          >
            {t("clinic.queueNote").replace("{ticket}", t("clinic.unit"))}
          </p>
        </div>

        {sectionLabel(t("clinic.questionsLabel"))}
        <div className="flex flex-col gap-2.5">
          {ask.map((p) => phraseCard(p))}
          <button
            onClick={() => speakCantonese(t("clinic.gettingWorse"), personaKey)}
            className="press card min-h-11 w-full rounded-[14px] px-3.5 py-3 text-start"
            style={{ boxShadow: "0 3px 0 0 #ddd7ce" }}
          >
            <span className="block text-[16px] font-bold leading-[1.3]" lang="zh-HK">
              {t("clinic.gettingWorse")}
            </span>
            <span className="mt-0.5 block text-[11px] leading-[1.4] text-ink-faint">
              {t("clinic.gettingWorseSub")}
            </span>
          </button>
        </div>

        <div
          className="flex items-center gap-3 rounded-[16px] p-3.5"
          style={{
            background: "var(--sign-red)",
            boxShadow: "0 4px 0 0 var(--sign-red-deep)",
          }}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-white">
            <TriangleAlert
              className="size-6"
              style={{ color: "var(--sign-red)" }}
              aria-hidden
              strokeWidth={2.4}
            />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="sign-zh text-[15px] text-white">
              {t("clinic.suddenlyWorse")}
            </span>
            <span className="text-[12px] leading-[1.4]" style={{ color: "#ffd7dd" }}>
              {t("clinic.suddenlyWorseSub")}
            </span>
          </span>
        </div>

        <p className="mt-auto pt-1 text-center text-[11px] font-medium leading-[1.6] text-ink-faint">
          {t("clinic.waitsSource")}
        </p>
      </div>
    </Screen>
  );
}
