"use client";

// The front door, variant 5c — the plate-row dashboard.
//
// A location line, the destination board as the app's mark, then four rows
// stacked like the plastic signs above a 茶餐廳 counter. Each row states its
// scenario in words on the left and its one live number on the right, bolted
// on as a full-bleed plate in that scenario's own material: dot-matrix amber
// for the minibus, meter red for the taxi, plate blue on ambulance yellow for
// A&E, melamine yellow on tiled green for the 茶餐廳.
//
// A ride in progress opens a drawer under the minibus row rather than adding
// a fifth thing to the screen — it is that row, in progress.

import Link from "next/link";
import { MapPin, Star, Settings, Volume2 } from "lucide-react";
import LedBoard from "@/components/LedBoard";
import {
  Screen,
  SectionLabel,
  ScenarioTile,
  NumberPanel,
  PressButton,
  LanguageRow,
  SCANLINES,
  GROUT,
} from "@/components/ui";
import { AE_FEES, TRIAGE_LEVELS } from "@/data/ae-fees";
import { URBAN_TAXI } from "@/lib/taxi";
import {
  useNextMinibus,
  useTaxiEstimate,
  useNearestAeWait,
  useLastChit,
} from "@/lib/home-numbers";
import { useActiveRide } from "@/hooks/useActiveRide";
import { useT, useBilingual } from "@/lib/i18n";
import { speakCantonese } from "@/lib/speech";

const DOT = "var(--font-dot), monospace";

export default function Home() {
  const t = useT();
  const bi = useBilingual();

  const minibus = useNextMinibus();
  const taxi = useTaxiEstimate();
  const ae = useNearestAeWait();
  const chit = useLastChit();
  const ride = useActiveRide();

  // Which triage levels actually pay, stated as a range rather than a list.
  const chargedLevels = (() => {
    const charged = TRIAGE_LEVELS.map((l) => l.numeral).filter(
      (n) => !AE_FEES.urgentFreeTriage.includes(n),
    );
    return charged.length > 1
      ? `${charged[0]}–${charged[charged.length - 1]}`
      : (charged[0] ?? "");
  })();

  // 104px of plate has no room for cents. The taxi screen still shows the
  // exact flagfall — this is a glance, not a quote.
  const fare = Number(taxi.value);
  const fareLabel = Number.isFinite(fare) ? String(Math.round(fare)) : taxi.value;

  return (
    <Screen tone="cream">
      {/* Where you are, and the one control that changes everything else.
          Screen's own top padding does not know about the notch, and this row
          is the first thing under it. */}
      <div
        className="flex items-center gap-2"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <MapPin
          className="size-[15px] shrink-0"
          style={{ color: "var(--brand)" }}
          aria-hidden
          strokeWidth={2.4}
        />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-ink-muted">
          {minibus.route?.from ?? t("home.minibusIdle")}
        </span>
        <LanguageRow accent="var(--brand)" compact />
      </div>

      <LedBoard
        size="logo"
        horizontal
        framed
        primary="有落"
        secondary="YAU LOK!"
        tagline={t("home.tagline2")}
        lamp="GPS"
        className="mt-3"
      />

      <SectionLabel>{t("home.fourWaysIn")}</SectionLabel>

      <div className="flex flex-col gap-2.5">
        {/* 小巴 — the only row that can be in progress. */}
        <ScenarioTile
          href="/ride"
          glyph="巴"
          title={t("home.minibus")}
          subtitle={
            minibus.routeLine
              ? t("home.minibusSub2").replace("{route}", minibus.routeLine)
              : t("home.minibusIdle")
          }
          live
          soonLabel=""
          color="var(--sign-green)"
          raised
          badge={
            ride.active ? (
              <span
                className="flex items-center gap-1 rounded-full px-[7px] py-[3px]"
                style={{ background: "var(--sign-green-soft)" }}
              >
                <span
                  aria-hidden
                  className="soft-pulse size-[5px] rounded-full"
                  style={{ background: "var(--sign-green)" }}
                />
                <span
                  className="text-[9px] font-black tracking-[0.08em]"
                  style={{ color: "var(--sign-green)" }}
                >
                  {t("home.tracking")}
                </span>
              </span>
            ) : undefined
          }
          panel={
            <NumberPanel
              value={minibus.value}
              unit={t("home.minutesUnitLong")}
              caption={t("home.nextCaption")}
              background="var(--led-bg)"
              overlay={SCANLINES}
              valueFont={`400 30px/1 ${DOT}`}
              valueColor="var(--led-on)"
              unitColor="var(--led-dim)"
              captionColor="var(--led-dim)"
              captionFont={`400 9.5px/1 ${DOT}`}
              captionSpacing=".16em"
            />
          }
        >
          {ride.active && (
            <>
              <span
                className="text-[9.5px] font-extrabold tracking-[0.12em]"
                style={{ color: "var(--sign-green)" }}
              >
                {t("home.onBoard")}
              </span>
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-[13px] font-bold" lang="zh-HK">
                  {t("home.nextStopIs").replace("{stop}", ride.nextStop ?? "—")}
                </span>
                {ride.stopsToGo !== null && (
                  <span
                    className="text-[13px] font-black"
                    style={{ color: "var(--sign-red)" }}
                  >
                    {t(
                      ride.stopsToGo === 1 ? "home.stopLeft" : "home.stopsLeft",
                    ).replace("{n}", String(ride.stopsToGo))}
                  </span>
                )}
              </span>
              <PressButton
                tone="red"
                className="min-h-12 rounded-[12px]"
                onClick={() => speakCantonese("唔該，有落！")}
              >
                <span className="flex items-center justify-center gap-2">
                  <Volume2 className="size-5" aria-hidden strokeWidth={2.2} />
                  {t("home.shoutForMe")}
                </span>
              </PressButton>
            </>
          )}
        </ScenarioTile>

        {/* 的士 — the meter, before you get in. */}
        <ScenarioTile
          href="/taxi"
          glyph="的"
          title={t("home.taxi")}
          subtitle={
            taxi.destination
              ? t("home.taxiSub")
                  .replace("{flag}", URBAN_TAXI.flagfallHkd.toFixed(1))
                  .replace("{to}", taxi.destination)
              : t("home.taxiSubIdle").replace(
                  "{flag}",
                  URBAN_TAXI.flagfallHkd.toFixed(1),
                )
          }
          live
          soonLabel=""
          color="var(--sign-red)"
          panel={
            <NumberPanel
              value={fareLabel}
              prefix="$"
              caption={t(taxi.captionKey)}
              background="var(--meter-bg)"
              valueFont={`400 28px/1 ${DOT}`}
              valueColor="var(--meter-on)"
              unitColor="var(--meter-on)"
              captionColor="#ff7d7d"
              captionFont={`400 9.5px/1 ${DOT}`}
              captionSpacing=".16em"
            />
          }
        />

        {/* 急症室 — the wait, and what it costs. */}
        <ScenarioTile
          href="/clinic"
          glyph="診"
          title={t("home.clinic")}
          subtitle={
            ae.hospital
              ? bi(ae.hospital)
              : t("home.feeLine")
                  .replace("{levels}", chargedLevels)
                  .replace("{fee}", String(AE_FEES.standardHkd))
          }
          live
          soonLabel=""
          color="var(--sign-blue)"
          panel={
            <NumberPanel
              value={ae.value}
              unit={
                ae.unit === "minutes"
                  ? t("home.minutesUnitLong")
                  : t("home.hoursUnit")
              }
              caption={t("home.waitCaption")}
              background="var(--amb-yellow)"
              valueFont="900 30px/1 var(--font-archivo), sans-serif"
              valueColor="var(--sign-blue)"
              captionColor="var(--sign-blue)"
              stripe
            />
          }
        />

        {/* 茶餐廳 — what you handed over last time. */}
        <ScenarioTile
          href="/cct"
          glyph="茶"
          title={t("home.chachaanteng")}
          subtitle={t("home.cctSub")}
          live
          soonLabel=""
          color="var(--sign-green)"
          glyphColor="var(--melamine)"
          glyphMosaic
          panel={
            <NumberPanel
              value={chit ? chit.firstLine : t("home.noChit")}
              caption={chit ? t("home.lastChit") : t("home.neverOrdered")}
              background="var(--sign-green)"
              overlay={GROUT}
              valueFont="700 15px/1.2 'Noto Sans HK', sans-serif"
              valueColor="var(--melamine)"
              captionColor="var(--melamine-mint)"
              clamp
            />
          }
        />
      </div>

      <div className="mt-auto flex gap-2.5 pt-3">
        {[
          { href: "/saved", icon: Star, key: "home.saved" },
          { href: "/settings", icon: Settings, key: "settings.title" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="press card flex min-h-12 flex-1 items-center gap-2 rounded-[13px] px-3 py-[11px]"
          >
            <l.icon
              className="size-[18px] shrink-0"
              style={{ color: "var(--brand)" }}
              aria-hidden
              strokeWidth={2.2}
            />
            <span className="min-w-0 truncate text-[13.5px] font-extrabold">
              {t(l.key)}
            </span>
          </Link>
        ))}
      </div>

      <p className="pt-2.5 text-center text-[10.5px] font-medium leading-[1.5] text-ink-faint">
        {t("home.credits")}
      </p>
    </Screen>
  );
}
