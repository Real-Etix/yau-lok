"use client";

import { Bus, Car, Stethoscope, UtensilsCrossed, ChevronDown, Globe } from "lucide-react";
import { Screen, ScenarioTile, Card, SectionLabel } from "@/components/ui";
import LedBoard from "@/components/LedBoard";
import { USER_LANGUAGES } from "@/data/languages";
import { useLanguage, useT } from "@/lib/i18n";

// §5/01 — one colour per scenario; the minibus is the recommended row.
const SCENARIOS = [
  { href: "/ride", icon: Bus, key: "minibus", live: true, color: "var(--brand)", raised: true },
  { href: "/taxi", icon: Car, key: "taxi", live: true, color: "var(--sign-red)" },
  { href: "/clinic", icon: Stethoscope, key: "clinic", live: true, color: "var(--sign-blue)" },
  { href: "#", icon: UtensilsCrossed, key: "chachaanteng", live: false, color: "var(--ink-faint)" },
];

export default function Home() {
  const t = useT();
  const { lang, setLang } = useLanguage();
  const current = USER_LANGUAGES.find((l) => l.code === lang);

  return (
    <Screen tone="cream">
      {/* The windscreen board, framed like the physical unit it is. */}
      <header className="mt-8 shrink-0">
        <LedBoard
          size="logo"
          framed
          primary={
            <span className="sign-zh block text-center" lang="zh-HK">
              有落
            </span>
          }
          secondary="YAU LOK!"
        />
        <p className="mt-3 text-center text-sm leading-relaxed text-ink-muted">
          {t("app.tagline")}
        </p>
      </header>

      <section className="mt-1 flex flex-col gap-2.5">
        <SectionLabel>{t("home.pickScenario")} Pick a scenario</SectionLabel>
        {SCENARIOS.map((s) => (
          <ScenarioTile
            key={s.key}
            href={s.href}
            icon={s.icon}
            title={t(`home.${s.key}`)}
            subtitle={t(`home.${s.key}Sub`)}
            live={s.live}
            soonLabel={t("home.soon")}
            color={s.color}
            raised={s.raised}
          />
        ))}
      </section>

      {/* Language row — the existing picker, in the design's compact form. */}
      <label className="card relative flex min-h-14 items-center gap-2.5 rounded-[14px] p-3">
        <Globe className="size-5 shrink-0 text-ink-muted" aria-hidden strokeWidth={2.2} />
        <span className="flex-1 text-[15px] font-semibold">
          {t("app.language")}
        </span>
        <span
          className="flex shrink-0 items-center gap-1 text-[15px] font-bold"
          style={{ color: "var(--brand)" }}
        >
          {current?.label.split(" · ")[0]}
          <ChevronDown className="size-4" aria-hidden strokeWidth={2.4} />
        </span>
        <select
          aria-label={t("app.language")}
          className="absolute inset-0 cursor-pointer opacity-0"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
        >
          {USER_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      <Card className="rounded-[18px]">
        <p className="text-[15px] font-extrabold">{t("home.whyTitle")}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          {t("home.whyBody")}
        </p>
      </Card>

      <footer className="mt-auto pt-4 text-center text-[11px] text-ink-faint">
        {t("home.credits")}
      </footer>
    </Screen>
  );
}
