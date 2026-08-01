"use client";

// The front door, variant A2 (design group 5b) — the number-first dashboard.
//
// A black destination-board header, then a 2×2 of full-bleed livery tiles,
// each shouting the one number that scenario is about: minutes to the next
// minibus, the fare a taxi will cost, the wait at A&E, what you ordered last
// time. Four materials, four numbers, one glance.
//
// A ride in progress docks as a white card underneath — deliberately the only
// white surface on the screen, so it reads as a thing happening now rather
// than a fifth category.

import Link from "next/link";
import { Star, Settings, Volume2, ChevronDown } from "lucide-react";
import { Screen, PressButton, SCANLINES } from "@/components/ui";
import Battenburg from "@/components/Battenburg";
import { AE_FEES, TRIAGE_LEVELS } from "@/data/ae-fees";
import { URBAN_TAXI } from "@/lib/taxi";
import { USER_LANGUAGES } from "@/data/languages";
import {
  useNextMinibus,
  useTaxiEstimate,
  useNearestAeWait,
  useLastChit,
} from "@/lib/home-numbers";
import { useActiveRide } from "@/hooks/useActiveRide";
import { useT, useLanguage, useBilingual } from "@/lib/i18n";
import { speakCantonese } from "@/lib/speech";

/** Every tile is the same object: a corner label, a big number, a name. */
function Tile({
  href,
  glyph,
  glyphColour,
  corner,
  cornerNode,
  value,
  unit,
  valueColour = "#fff",
  unitColour,
  title,
  subtitle,
  subtitleColour,
  background,
  shadow,
  stripe,
  wideValue,
}: {
  href: string;
  glyph: string;
  glyphColour: string;
  corner?: string;
  cornerNode?: React.ReactNode;
  value: string;
  unit?: string | null;
  valueColour?: string;
  unitColour: string;
  title: string;
  subtitle: string;
  subtitleColour: string;
  background: string;
  shadow: string;
  /** The A&E tile is a unit plate: battenburg along its top edge */
  stripe?: boolean;
  /** 0T 走冰 is text, not a figure — set it smaller and don't split a unit off */
  wideValue?: boolean;
}) {
  return (
    <Link
      href={href}
      className="press relative flex flex-col gap-1.5 overflow-hidden rounded-[18px]"
      style={{ background, boxShadow: shadow, padding: stripe ? 0 : 13 }}
    >
      {stripe && <Battenburg height={6} />}
      <span
        className="flex flex-1 flex-col gap-1.5"
        style={stripe ? { padding: "11px 13px 13px" } : undefined}
      >
        <span className="flex items-center justify-between gap-2">
          <span
            aria-hidden
            style={{
              font: "400 19px/1 var(--font-dot), monospace",
              color: glyphColour,
            }}
          >
            {glyph}
          </span>
          {cornerNode ?? (
            <span
              className="text-[9.5px] font-extrabold tracking-[0.1em]"
              style={{ color: unitColour }}
            >
              {corner}
            </span>
          )}
        </span>

        {/* The number sits on the tile's baseline, whatever the copy above. */}
        <span className="mt-auto flex items-baseline gap-1">
          {wideValue ? (
            <span
              style={{
                font: "700 30px/1 'Noto Sans HK', sans-serif",
                color: valueColour,
              }}
              lang="zh-HK"
            >
              {value}
            </span>
          ) : (
            <>
              {unit === "$" && (
                <span
                  className="text-[22px] font-black leading-none"
                  style={{ color: unitColour }}
                >
                  $
                </span>
              )}
              {/* An em dash at 900 weight reads as a redaction bar, not as
                  "still loading" — set the placeholder light and faded. */}
              <span
                className="text-[40px] leading-none"
                style={{
                  color: valueColour,
                  fontWeight: value === "—" ? 400 : 900,
                  opacity: value === "—" ? 0.45 : 1,
                }}
              >
                {value}
              </span>
              {unit && unit !== "$" && (
                <span
                  className="text-[15px] font-extrabold leading-none"
                  style={{ color: unitColour }}
                >
                  {unit}
                </span>
              )}
            </>
          )}
        </span>

        <span
          className="sign-zh text-[14px] leading-[1.25]"
          style={{ color: valueColour === "#fff" ? "#fff" : valueColour }}
        >
          {title}
        </span>
        <span
          className="text-[11.5px] font-medium leading-[1.25]"
          style={{ color: subtitleColour }}
        >
          {subtitle}
        </span>
      </span>
    </Link>
  );
}

export default function Home() {
  const t = useT();
  const { lang, setLang } = useLanguage();
  const bi = useBilingual();

  const minibus = useNextMinibus();
  const taxi = useTaxiEstimate();
  const ae = useNearestAeWait();
  const chit = useLastChit();
  const ride = useActiveRide();

  const chargedLevels = (() => {
    const charged = TRIAGE_LEVELS.map((l) => l.numeral).filter(
      (n) => !AE_FEES.urgentFreeTriage.includes(n),
    );
    return charged.length > 1
      ? `${charged[0]}–${charged[charged.length - 1]}`
      : (charged[0] ?? "");
  })();

  const currentLang = USER_LANGUAGES.find((l) => l.code === lang);

  return (
    <Screen tone="cream" flush>
      {/* The destination board across the top of the whole screen. */}
      <header
        className="relative overflow-hidden px-4 pb-3.5 pt-[max(1.2rem,env(safe-area-inset-top))]"
        style={{ background: "var(--led-bg)" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="led-glow shrink-0"
            style={{
              font: "400 34px/1 var(--font-dot), monospace",
              color: "var(--led-on)",
            }}
            lang="zh-HK"
          >
            有落
          </span>
          <span
            className="min-w-0 flex-1"
            style={{
              font: "400 11px/1 var(--font-dot), monospace",
              color: "var(--led-dim)",
              letterSpacing: ".22em",
            }}
          >
            YAU LOK!
          </span>
          <label
            className="relative flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-2.5"
            style={{ border: "1px solid #333" }}
          >
            <span
              style={{
                font: "400 11px/1 var(--font-dot), monospace",
                color: "var(--led-on)",
              }}
            >
              {currentLang?.label.split(" · ")[0]}
            </span>
            <ChevronDown
              className="size-3.5"
              aria-hidden
              strokeWidth={2.4}
              style={{ color: "var(--led-on)" }}
            />
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
        </div>

        <div className="mt-2.5 flex items-center gap-[7px]">
          <span
            aria-hidden
            className="soft-pulse size-1.5 shrink-0 rounded-full"
            style={{ background: "#4ade80" }}
          />
          <span
            className="min-w-0 truncate"
            style={{
              font: "400 11.5px/1 var(--font-dot), monospace",
              color: "var(--ink-faint)",
            }}
          >
            {minibus.route?.from ?? t("home.minibusIdle")}
          </span>
        </div>

        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: SCANLINES }}
        />
      </header>

      {/* Four materials, four numbers. */}
      <div className="grid grid-cols-2 gap-2.5 px-4 pt-3.5">
        <Tile
          href="/ride"
          glyph="巴"
          glyphColour="var(--brand-on)"
          cornerNode={
            ride.active ? (
              <span
                className="flex items-center gap-1 rounded-full px-[7px] py-[3px]"
                style={{ background: "rgba(255,255,255,.18)" }}
              >
                <span
                  aria-hidden
                  className="soft-pulse size-[5px] rounded-full"
                  style={{ background: "#8ff0c0" }}
                />
                <span className="text-[9px] font-black tracking-[0.1em] text-white">
                  {t("home.live")}
                </span>
              </span>
            ) : undefined
          }
          value={minibus.value}
          unit={t("home.minutesUnitLong")}
          unitColour="var(--brand-on)"
          title={t("home.minibus")}
          subtitle={
            minibus.routeLine
              ? t("home.minibusSub2").replace("{route}", minibus.routeLine)
              : t("home.minibusIdle")
          }
          subtitleColour="var(--brand-on)"
          background="var(--sign-green)"
          shadow="0 3px 0 0 var(--brand-deep)"
        />

        <Tile
          href="/taxi"
          glyph="的"
          glyphColour="#ffc2c9"
          corner={t("home.meterEstimate")}
          value={taxi.value}
          unit="$"
          unitColour="#ffc2c9"
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
          subtitleColour="#ffc2c9"
          background="var(--sign-red)"
          shadow="0 3px 0 0 #9e1b2c"
        />

        <Tile
          href="/clinic"
          glyph="診"
          glyphColour="var(--sign-blue)"
          corner={ae.hospital ? bi(ae.hospital) : undefined}
          value={ae.value}
          unit={
            ae.unit === "minutes"
              ? t("home.minutesUnitLong")
              : t("home.hoursUnit")
          }
          valueColour="var(--sign-blue)"
          unitColour="var(--sign-blue)"
          title={t("home.clinic")}
          subtitle={t("home.feeLine")
            .replace("{levels}", chargedLevels)
            .replace("{fee}", String(AE_FEES.standardHkd))}
          subtitleColour="var(--sign-blue)"
          background="var(--amb-yellow)"
          shadow="0 3px 0 0 #c9b600"
          stripe
        />

        <Tile
          href="/cct"
          glyph="茶"
          glyphColour="var(--melamine)"
          corner={chit ? t("home.lastOrder") : t("home.noOrderYet")}
          value={chit ? chit.firstLine : t("home.noChit")}
          valueColour="var(--melamine)"
          unitColour="var(--melamine-mint)"
          title={t("home.chachaanteng")}
          subtitle={t("home.cctSub")}
          subtitleColour="var(--melamine-mint)"
          background="var(--sign-green)"
          shadow="0 3px 0 0 var(--brand-deep)"
          wideValue
        />
      </div>

      {/* The ride, docked. The only white surface here, on purpose. */}
      {ride.active && (
        <div className="px-4 pt-3">
          <div
            className="card overflow-hidden rounded-[18px]"
            style={{ boxShadow: "0 3px 0 0 var(--sign-green)" }}
          >
            <div className="flex flex-wrap items-center gap-2 px-3 pb-2.5 pt-[11px]">
              <span
                aria-hidden
                className="soft-pulse size-1.5 shrink-0 rounded-full"
                style={{ background: "var(--sign-green)" }}
              />
              <span
                className="text-[11px] font-black uppercase tracking-[0.14em]"
                style={{ color: "var(--sign-green)" }}
              >
                {t("home.onBoardNow")}
              </span>
              {ride.routeCode && (
                <span className="text-[11.5px] font-medium text-ink-faint">
                  {t("home.routeAndStops")
                    .replace("{route}", ride.routeCode)
                    .replace("{n}", String(ride.stopsToGo ?? 0))}
                </span>
              )}
            </div>

            {/* The next stop, on the board it would appear on in the cabin. */}
            <div
              className="relative mx-3 flex items-center gap-2.5 overflow-hidden rounded-lg px-3 py-2.5"
              style={{ background: "var(--led-bg)" }}
            >
              <span
                style={{
                  font: "400 15px/1 var(--font-dot), monospace",
                  color: "var(--led-on)",
                }}
              >
                {t("home.nextStopShort")}
              </span>
              <span
                className="min-w-0 flex-1 truncate"
                style={{
                  font: "400 17px/1 var(--font-dot), monospace",
                  color: "var(--led-on)",
                }}
                lang="zh-HK"
              >
                {ride.nextStop}
              </span>
              {ride.stopsToGo !== null && (
                <span className="flex shrink-0 items-baseline gap-[3px]">
                  <span
                    style={{
                      font: "400 22px/1 var(--font-dot), monospace",
                      color: "var(--led-on)",
                    }}
                  >
                    {ride.stopsToGo}
                  </span>
                  <span
                    style={{
                      font: "400 11px/1 var(--font-dot), monospace",
                      color: "var(--led-dim)",
                    }}
                  >
                    {t("home.stopsToArrive")}
                  </span>
                </span>
              )}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ backgroundImage: SCANLINES }}
              />
            </div>

            <div className="px-3 pb-3 pt-[11px]">
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
            </div>
          </div>
        </div>
      )}

      <div className="mt-auto flex gap-2.5 px-4 pt-3">
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

      <p className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2.5 text-center text-[10.5px] font-medium leading-[1.5] text-ink-faint">
        {t("home.credits")}
      </p>
    </Screen>
  );
}
