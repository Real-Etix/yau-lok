"use client";

// §5/08 — 設定 Settings.

import { ChevronDown, RefreshCw, Volume2 } from "lucide-react";
import LedBoard from "@/components/LedBoard";
import { Screen, TopBar, Card, SectionLabel, PressButton } from "@/components/ui";
import { USER_LANGUAGES } from "@/data/languages";
import { VOICE_PERSONAS, DEFAULT_PERSONA_KEY, getPersona } from "@/data/voices";
import { ALERT_DISTANCES, useAlertSettings, usePersona } from "@/lib/prefs";
import { speakPhrase } from "@/lib/speech";
import { useLanguage, useT } from "@/lib/i18n";

/** A settings row: title on the left, brand-coloured value on the right. */
function Row({
  title,
  help,
  children,
  first,
}: {
  title: string;
  help?: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <div
      className={`flex min-h-14 items-center gap-3 py-2.5 ${
        first ? "" : "border-t border-[var(--rule)]"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        {help && (
          <span className="mt-0.5 block text-[13px] text-ink-muted">{help}</span>
        )}
      </span>
      {children}
    </div>
  );
}

/** 50×30 track, 24px knob — the brand toggle from the design. */
function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors"
      style={{ background: on ? "var(--brand)" : "var(--rule)" }}
    >
      <span
        className="absolute top-[3px] size-6 rounded-full bg-white transition-all"
        style={{ insetInlineStart: on ? "23px" : "3px" }}
      />
    </button>
  );
}

/** Green value + ▾, with the native select laid invisibly over it. */
function LangPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
}) {
  const current = USER_LANGUAGES.find((l) => l.code === value);
  return (
    <label
      className="relative flex min-h-11 shrink-0 items-center gap-1 text-[14px] font-semibold"
      style={{ color: "var(--brand)" }}
    >
      {current?.label.split(" · ")[0]}
      <ChevronDown className="size-4" aria-hidden strokeWidth={2.4} />
      <select
        aria-label={label}
        className="absolute inset-0 cursor-pointer opacity-0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {USER_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function SettingsPage() {
  const t = useT();
  const { lang, setLang } = useLanguage();
  const { distanceM, setDistanceM, vibrate, setVibrate, coach, setCoach } =
    useAlertSettings();
  const [personaKey, pickPersona] = usePersona(DEFAULT_PERSONA_KEY);

  const persona = getPersona(personaKey);

  return (
    <Screen tone="cream" flush>
      <TopBar variant="brand" title={t("settings.title")} />

      <div className="flex flex-col gap-3 px-4 pt-3">
        {/* 語言 */}
        <SectionLabel>{t("settings.language")}</SectionLabel>
        <Card className="rounded-[18px] py-1">
          <Row title={t("settings.uiLanguage")} first>
            <LangPicker
              label={t("settings.uiLanguage")}
              value={lang}
              onChange={setLang}
            />
          </Row>
          {/* The language you speak is what translations come back in; it is
              the same choice, shown where the design shows it. */}
          <Row title={t("settings.spokenLanguage")}>
            <LangPicker
              label={t("settings.spokenLanguage")}
              value={lang}
              onChange={setLang}
            />
          </Row>
        </Card>
        <p className="-mt-1 text-[12px] leading-relaxed text-ink-muted">
          {t("settings.languageHelp")}
        </p>

        {/* 聲線 */}
        <SectionLabel>{t("settings.voice")}</SectionLabel>
        <Card className="rounded-[18px]">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="sign-zh block text-[15px]">
                {persona.label.split(" · ")[0]}
              </span>
              <span className="block text-[12px] text-ink-muted">
                {persona.label.split(" · ").slice(1).join(" · ")}
              </span>
            </span>
            <button
              onClick={() => speakPhrase("yau-lok", "唔該，有落！", personaKey)}
              className="press flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold text-white"
              style={{ background: "var(--brand)" }}
            >
              <Volume2 className="size-4" aria-hidden />
              {t("settings.preview")}
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {VOICE_PERSONAS.map((p) => (
              <button
                key={p.key}
                onClick={() => pickPersona(p.key)}
                aria-pressed={p.key === personaKey}
                className="min-h-11 rounded-full px-3.5 text-[13px] font-bold"
                style={
                  p.key === personaKey
                    ? { background: "var(--brand)", color: "#fff" }
                    : { background: "var(--brand-soft)", color: "var(--brand)" }
                }
              >
                {p.label.split(" · ")[0]}
              </button>
            ))}
          </div>
        </Card>

        {/* 落車提示 */}
        <SectionLabel>{t("settings.alerts")}</SectionLabel>
        <Card className="rounded-[18px] py-1">
          <Row
            title={t("settings.alertDistance")}
            help={t("settings.alertDistanceHelp")}
            first
          >
            <label className="relative shrink-0">
              <LedBoard size="chip" primary={`${distanceM}m`} />
              <select
                aria-label={t("settings.alertDistance")}
                className="absolute inset-0 cursor-pointer opacity-0"
                value={distanceM}
                onChange={(e) => setDistanceM(Number(e.target.value))}
              >
                {ALERT_DISTANCES.map((d) => (
                  <option key={d} value={d}>
                    {d} m
                  </option>
                ))}
              </select>
            </label>
          </Row>
          <Row title={t("settings.vibration")}>
            <Toggle on={vibrate} onChange={setVibrate} label={t("settings.vibration")} />
          </Row>
          <Row title={t("settings.coachMode")}>
            <Toggle on={coach} onChange={setCoach} label={t("settings.coachMode")} />
          </Row>
        </Card>

        <Card className="rounded-[18px] py-1">
          <Row title={t("settings.offlineData")} help={t("settings.lastUpdated")} first>
            <button
              className="flex min-h-11 shrink-0 items-center gap-1.5 text-[13px] font-bold"
              style={{ color: "var(--brand)" }}
            >
              <RefreshCw className="size-4" aria-hidden />
              {t("settings.update")}
            </button>
          </Row>
        </Card>
      </div>

      <div
        className="sticky bottom-0 mt-auto bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
        style={{ borderTop: "2.5px solid var(--ink)" }}
      >
        <PressButton
          tall
          onClick={() => {
            if (vibrate && navigator.vibrate) navigator.vibrate([200, 100, 200]);
            speakPhrase("chime", "就到喇！", personaKey);
          }}
        >
          {t("settings.testAlert")}
        </PressButton>
        <p className="mt-2 text-center text-[11px] text-ink-faint">
          {t("settings.credits")}
        </p>
      </div>
    </Screen>
  );
}
