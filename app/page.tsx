"use client";

import { Bus, Car, Stethoscope, UtensilsCrossed } from "lucide-react";
import LanguagePicker from "@/components/LanguagePicker";
import { Screen, ScenarioTile, Card, SectionLabel } from "@/components/ui";
import { useT } from "@/lib/i18n";

const SCENARIOS = [
  { href: "/ride", icon: Bus, key: "minibus", live: true },
  { href: "/taxi", icon: Car, key: "taxi", live: true },
  { href: "/clinic", icon: Stethoscope, key: "clinic", live: true },
  { href: "#", icon: UtensilsCrossed, key: "chachaanteng", live: false },
];

export default function Home() {
  const t = useT();
  return (
    <Screen>
      {/* The sign itself: red characters on card stock, the way a minibus
          declares where it is going. */}
      <header className="mt-4 shrink-0">
        <div className="plate px-5 py-6 text-center">
          <p
            className="sign-zh text-[4.25rem] leading-none text-[var(--sign-red)]"
            lang="zh-HK"
          >
            有落
          </p>
          <p className="mt-2 text-xl font-black uppercase tracking-[0.18em] text-ink">
            Yau Lok
          </p>
        </div>
        <p className="mt-3 text-center text-sm leading-relaxed text-ink-muted">
          {t("app.tagline")}
        </p>
      </header>

      <div className="mt-1">
        <LanguagePicker hint />
      </div>

      <section className="mt-1 flex flex-col gap-2.5">
        <SectionLabel>{t("home.pickScenario")}</SectionLabel>
        {SCENARIOS.map((s) => (
          <ScenarioTile
            key={s.key}
            href={s.href}
            icon={s.icon}
            title={t(`home.${s.key}`)}
            subtitle={t(`home.${s.key}Sub`)}
            live={s.live}
            soonLabel={t("home.soon")}
          />
        ))}
      </section>

      <Card className="mt-1">
        <p className="font-extrabold">{t("home.whyTitle")}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          {t("home.whyBody")}
        </p>
      </Card>

      <footer className="mt-auto pt-4 text-center text-xs leading-relaxed text-ink-faint">
        {t("home.credits")}
      </footer>
    </Screen>
  );
}
