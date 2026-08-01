"use client";

// Shared 膠牌 primitives. Every touch target here clears 44pt, and no emoji
// is ever used as an icon — Lucide only, so glyphs are consistent across
// platforms and inherit colour from tokens.

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronDown, Globe } from "lucide-react";
import Battenburg from "@/components/Battenburg";
import { USER_LANGUAGES } from "@/data/languages";
import { useT, useLanguage } from "@/lib/i18n";

/** Back: a step handler when there is one, otherwise out to the home screen. */
function BackControl({
  onBack,
  colour,
}: {
  onBack?: () => void;
  colour: string;
}) {
  const inner = (
    <ChevronLeft className="size-7 rtl:rotate-180" aria-hidden strokeWidth={2.4} />
  );
  const cls = "-ms-2 flex size-11 shrink-0 items-center justify-center";
  return onBack ? (
    <button onClick={onBack} aria-label="Back" className={cls} style={{ color: colour }}>
      {inner}
    </button>
  ) : (
    <Link href="/" aria-label="Back" className={cls} style={{ color: colour }}>
      {inner}
    </Link>
  );
}

/** Page shell: paper background, safe gutters, no horizontal overflow. */
export function Screen({
  children,
  fill,
  tone = "paper",
  flush,
}: {
  children: React.ReactNode;
  /** Fill the viewport exactly (riding view) rather than growing */
  fill?: boolean;
  /** The body panel behind the cards — one per scenario livery */
  tone?: "paper" | "cream" | "cabin" | "taxi" | "ward" | "cct";
  /** Remove horizontal padding so a brand TopBar can bleed to the edges */
  flush?: boolean;
}) {
  const tones = {
    paper: "bg-[var(--paper)]",
    cream: "bg-[var(--body-cream)]",
    cabin: "bg-[var(--brand-deep)]",
    taxi: "bg-[var(--taxi-cabin)]",
    ward: "bg-[var(--ward-grey)]",
    cct: "bg-[var(--tile-cream)]",
  } as const;
  return (
    <main
      className={`mx-auto flex w-full min-w-0 max-w-md flex-col gap-3 overflow-x-hidden pb-[max(1rem,env(safe-area-inset-bottom))] ${
        flush ? "px-0 pt-0" : "px-4 pt-3"
      } ${fill ? "h-dvh" : "min-h-dvh"} ${tones[tone]}`}
    >
      {children}
    </main>
  );
}

/** Back link + optional right-hand controls. */
export function TopBar({
  children,
  variant = "plain",
  title,
  subtitle,
  cabin,
  onBack,
}: {
  children?: React.ReactNode;
  /** The chrome of the screen — the vehicle or room you are standing in */
  variant?: "plain" | "brand" | "taxi" | "ambulance" | "cct";
  title?: string;
  subtitle?: string;
  /** Sitting on the dark cabin background — invert the back link */
  cabin?: boolean;
  /**
   * Where back goes. Screens built from several steps pass a handler so the
   * chevron returns to the previous step; without one it leaves for home.
   */
  onBack?: () => void;
}) {
  // Each livery's roof: a colour, a hard shadow, and for 茶餐廳 the mosaic
  // tiling that a cha chaan teng wall is actually made of.
  const LIVERY = {
    taxi: {
      bg: "var(--sign-red)",
      shadow: "0 3px 0 0 var(--sign-red-deep)",
      title: "#fff",
      back: "#ffc9d0",
      tiles: false,
    },
    ambulance: {
      bg: "var(--amb-yellow)",
      shadow: undefined,
      title: "var(--sign-blue)",
      back: "var(--sign-blue)",
      tiles: false,
    },
    cct: {
      bg: "var(--sign-green)",
      shadow: "0 3px 0 0 var(--brand-deep)",
      title: "#fff",
      back: "var(--melamine-mint)",
      tiles: true,
    },
  } as const;

  if (variant === "taxi" || variant === "ambulance" || variant === "cct") {
    const l = LIVERY[variant];
    return (
      <>
        <header
          className="shrink-0 px-[18px] pb-4 pt-[max(0.9rem,env(safe-area-inset-top))]"
          style={{
            background: l.bg,
            boxShadow: l.shadow,
            // The tiled wall: two 1px white grids at 13px, over the green.
            backgroundImage: l.tiles
              ? "linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px)"
              : undefined,
            backgroundSize: l.tiles ? "13px 13px, 13px 13px" : undefined,
          }}
        >
          <div className="flex items-center gap-3">
            <BackControl onBack={onBack} colour={l.back} />
            {title && (
              <span
                className="sign-zh min-w-0 flex-1 truncate text-[19px]"
                style={{ color: l.title }}
              >
                {title}
              </span>
            )}
            <div className="ms-auto flex items-center gap-2">{children}</div>
          </div>
          {subtitle && (
            <p
              className="mt-1 text-xs"
              style={{ color: variant === "ambulance" ? "var(--sign-blue)" : "rgba(255,255,255,.8)" }}
            >
              {subtitle}
            </p>
          )}
        </header>
        {/* An ambulance always carries its stripe. */}
        {variant === "ambulance" && <Battenburg />}
      </>
    );
  }

  if (variant === "brand") {
    return (
      <header className="shrink-0 bg-[var(--brand)] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <div className="flex items-center justify-between gap-2">
          {onBack ? (
            <button
              onClick={onBack}
              aria-label="Back"
              className="-ms-2 flex min-h-11 min-w-11 items-center gap-1.5 rounded-lg px-2 text-white"
            >
              <ChevronLeft className="size-6 rtl:rotate-180" aria-hidden />
              {title && <span className="sign-zh text-[22px]">{title}</span>}
            </button>
          ) : (
            <Link
              href="/"
              className="-ms-2 flex min-h-11 min-w-11 items-center gap-1.5 rounded-lg px-2 text-white"
            >
              <ChevronLeft className="size-6 rtl:rotate-180" aria-hidden />
              {title && <span className="sign-zh text-[22px]">{title}</span>}
            </Link>
          )}
          <div className="flex items-center gap-2">{children}</div>
        </div>
        {subtitle && (
          <p className="mt-1 text-xs" style={{ color: "var(--brand-on)" }}>
            {subtitle}
          </p>
        )}
      </header>
    );
  }
  return (
    <header className="flex shrink-0 items-center justify-between gap-2">
      <Link
        href="/"
        className={`-ms-2 flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold ${
          cabin ? "text-white/80" : "text-ink-muted"
        }`}
      >
        <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
        Yau Lok!
      </Link>
      <div className="flex items-center gap-2">{children}</div>
    </header>
  );
}

/** Translucent white pill — the right-hand control on a brand TopBar. */
export function BrandPill({
  children,
  onClick,
  pressed,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={pressed}
      className="min-h-11 rounded-full px-3 text-xs font-bold uppercase tracking-wide text-white"
      style={{
        background: pressed ? "rgba(255,255,255,.32)" : "rgba(255,255,255,.16)",
      }}
    >
      {children}
    </button>
  );
}

/** A pill toggle. Both states are always visible so neither can be misread. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  cabin,
  full,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** Translucent treatment for the dark cabin / brand header */
  cabin?: boolean;
  /** Fill the row, splitting the width evenly — 凍定熱 on the scan screen */
  full?: boolean;
}) {
  return (
    <span
      className={`${full ? "flex w-full gap-2 rounded-[13px] bg-white p-[5px]" : "inline-flex overflow-hidden rounded-full"} ${
        full ? "" : cabin ? "bg-white/15" : "border-2 border-ink"
      }`}
      style={full ? { border: "1px solid var(--rule)" } : undefined}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`min-h-11 px-3 text-xs font-bold uppercase tracking-wide ${
            full ? "flex-1 rounded-[10px] text-[14px] normal-case tracking-normal" : ""
          } ${
            cabin
              ? value === o.value
                ? "bg-white/85 text-[var(--brand-deep)]"
                : "text-white/80"
              : value === o.value
                ? "bg-ink text-white"
                : "bg-white text-ink-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

export function Card({
  children,
  className = "",
  raised,
}: {
  children: React.ReactNode;
  className?: string;
  /** Marks the recommended item in a list */
  raised?: boolean;
}) {
  return (
    <section
      className={`card p-4 ${className}`}
      style={raised ? { boxShadow: "0 3px 0 0 var(--brand)" } : undefined}
    >
      {children}
    </section>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink-faint">
      {children}
    </p>
  );
}

/**
 * The primary action. Sits on the page with a hard shadow and depresses when
 * pressed, like the stop button on a bus.
 */
export function PressButton({
  children,
  onClick,
  disabled,
  tone = "green",
  tall,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "green" | "ink" | "red" | "blue" | "white" | "cct";
  /** 54-60px bars carry a 4px offset instead of 3px */
  tall?: boolean;
  className?: string;
}) {
  const off = tall ? "4px" : "3px";
  const tones: Record<string, string> = {
    green: `bg-[var(--brand)] text-white shadow-[0_${off}_0_0_var(--brand-deep)]`,
    ink: `bg-ink text-white shadow-[0_${off}_0_0_#000]`,
    red: `bg-[var(--sign-red)] text-white shadow-[0_${off}_0_0_var(--sign-red-deep)]`,
    blue: `bg-[var(--sign-blue)] text-white shadow-[0_${off}_0_0_var(--amb-blue-deep)]`,
    white: `bg-white text-ink border-2 border-ink shadow-[0_${off}_0_0_#14110f]`,
    // 茶餐廳: the mosaic-tile green, pressed into the deep brand shade
    cct: `bg-[var(--sign-green)] text-white shadow-[0_${off}_0_0_var(--brand-deep)]`,
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`press w-full rounded-[var(--r-md)] px-4 text-center font-bold disabled:opacity-40 disabled:shadow-none ${tall ? "min-h-[54px] py-3.5" : "min-h-12 py-3"} ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * The dot-matrix scanline overlay: an absolutely-positioned, non-interactive
 * span laid over anything meant to read as an LED board.
 */
export const SCANLINES =
  "repeating-linear-gradient(0deg, rgba(0,0,0,.55) 0 1px, transparent 1px 3px)," +
  "repeating-linear-gradient(90deg, rgba(0,0,0,.55) 0 1px, transparent 1px 3px)";

/** Mosaic grout, for anything wearing the 茶餐廳 tiled wall. */
export const GROUT =
  "repeating-linear-gradient(0deg, rgba(0,0,0,.14) 0 1.5px, transparent 1.5px 13px)," +
  "repeating-linear-gradient(90deg, rgba(0,0,0,.14) 0 1.5px, transparent 1.5px 13px)";

/** Scenario row: glyph tile, title, one line of context. */
export function ScenarioTile({
  href,
  glyph,
  title,
  subtitle,
  live,
  soonLabel,
  color = "var(--brand)",
  raised,
  glyphColor = "#fff",
  glyphMosaic,
}: {
  href: string;
  /** The single Chinese character on the tile, in the LED face */
  glyph: string;
  title: string;
  subtitle: string;
  live: boolean;
  soonLabel: string;
  /** Tile colour — one per scenario */
  color?: string;
  raised?: boolean;
  /** 茶 is set in melamine on its green tile, not white */
  glyphColor?: string;
  /** The 茶 tile is tiled wall too, not flat green */
  glyphMosaic?: boolean;
}) {
  const inner = (
    <>
      <span
        aria-hidden
        className="flex size-12 shrink-0 items-center justify-center rounded-[13px]"
        style={{
          background: color,
          backgroundImage: glyphMosaic ? GROUT : undefined,
          color: glyphColor,
          fontFamily: "var(--font-dot), monospace",
          fontSize: 22,
          lineHeight: 1,
        }}
      >
        {glyph}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-[7px]">
          <span className="sign-zh text-[17px] leading-tight">{title}</span>
          {!live && (
            <span className="rounded-full bg-[var(--rule)] px-[7px] py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">
              {soonLabel}
            </span>
          )}
        </span>
        <span className="block text-[13px] leading-snug text-ink-muted">
          {subtitle}
        </span>
      </span>
    </>
  );

  if (!live) {
    return (
      <div className="card flex items-center gap-3 rounded-[18px] p-3 opacity-50">
        {inner}
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="press card flex min-h-16 items-center gap-3 rounded-[18px] p-3"
      style={raised ? { boxShadow: "0 3px 0 0 var(--brand)" } : undefined}
    >
      {inner}
    </Link>
  );
}

/** Status banner used for ride state and route watching. */
export function StatusBanner({
  tone,
  title,
  detail,
  children,
  cabin,
}: {
  tone: "green" | "amber" | "red" | "neutral";
  title: string;
  detail?: React.ReactNode;
  children?: React.ReactNode;
  /** Riding view: solid fills that read on the dark cabin background */
  cabin?: boolean;
}) {
  const light = {
    green:
      "bg-[var(--sign-green-soft)] text-[var(--sign-green)] border-[var(--sign-green)]",
    amber:
      "bg-[var(--sign-amber-soft)] text-[var(--sign-amber)] border-[var(--sign-amber)]",
    red: "bg-[var(--sign-red)] text-white border-[var(--sign-red-deep)] animate-pulse",
    neutral: "bg-white text-ink-muted border-[var(--rule)]",
  };
  const dark = {
    green: "bg-white/10 text-white border-white/20",
    amber: "bg-[var(--sign-amber)] text-white border-[var(--sign-amber)]",
    red: "bg-[var(--sign-red)] text-white border-[var(--sign-red-deep)] animate-pulse",
    neutral: "bg-white/10 text-white border-white/20",
  };
  const tones = cabin ? dark : light;
  return (
    <section
      className={`shrink-0 rounded-[14px] border-2 p-3 text-center ${tones[tone]}`}
    >
      <p className="text-lg font-extrabold leading-tight">{title}</p>
      {detail && <div className="mt-0.5 text-sm font-medium">{detail}</div>}
      {children}
    </section>
  );
}

/** Localised label helper so tiles/toggles stay consistent. */
export function useLabels() {
  return useT();
}

/**
 * §5/01 scenario glyph tile — a 48px square carrying one Chinese character in
 * the LED face. Type, not an icon, and not an emoji: it reads at a glance the
 * way the plastic signs in a minibus windscreen do.
 */
export function GlyphTile({
  glyph,
  color = "var(--brand)",
  size = 48,
}: {
  glyph: string;
  color?: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-[13px] text-white"
      style={{
        background: color,
        width: size,
        height: size,
        fontFamily: "var(--font-dot), monospace",
        fontSize: Math.round(size * 0.46),
        lineHeight: 1,
      }}
    >
      {glyph}
    </span>
  );
}

/**
 * §5/03 stat pair: an LED plate for the live number, a white card for the
 * one after it. Always used two-up.
 */
export function StatTile({
  label,
  value,
  led,
}: {
  label: string;
  value: React.ReactNode;
  /** LED face — reserved for the live/next figure */
  led?: boolean;
}) {
  if (led) {
    return (
      <div className="led led-dots flex-1 rounded-[11px] px-3 py-[11px] text-center">
        <p
          className="text-[10px] uppercase leading-none tracking-[0.16em]"
          style={{ color: "var(--led-dim)" }}
        >
          {label}
        </p>
        <p
          className="led-glow mt-1.5 text-[30px] leading-none"
          style={{ color: "var(--led-on)" }}
        >
          {value}
        </p>
      </div>
    );
  }
  return (
    <div className="card flex-1 rounded-[11px] px-3 py-[11px] text-center">
      <p className="text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-ink-faint">
        {label}
      </p>
      <p className="mt-[7px] text-[20px] font-extrabold leading-none">{value}</p>
    </div>
  );
}

/** §5/04 small stat card: dim label over a bold figure. */
export function InfoTile({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
  accent?: string;
}) {
  return (
    <div
      className="card flex-1 rounded-[12px] px-3 py-2.5"
      style={accent ? { boxShadow: `0 3px 0 0 ${accent}` } : undefined}
    >
      <p className="text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-ink-faint">
        {label}
      </p>
      <p className="mt-[5px] text-[17px] font-extrabold leading-none">{value}</p>
      {detail && (
        <p className="mt-1 text-[12px] leading-snug text-ink-muted">{detail}</p>
      )}
    </div>
  );
}

/** §5/03 白底 bottom bar that carries the phase's one primary action. */
export function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 mt-auto flex w-full min-w-0 flex-col gap-2.5 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3.5">
      {children}
    </div>
  );
}

/**
 * The 你講咩話？ row.
 *
 * It drives the *interface* language through the i18n context, not a copy of
 * it: three scenario pages each kept their own `langCode` state, so choosing
 * a language wrote localStorage and changed nothing on screen until a reload.
 * One component, one source of truth.
 */
export function LanguageRow({
  accent,
  compact,
}: {
  accent: string;
  /** A white pill on a bare row, rather than a full-width card */
  compact?: boolean;
}) {
  const { lang, setLang, t } = useLanguage();
  const current = USER_LANGUAGES.find((l) => l.code === lang);

  if (compact) {
    return (
      <label
        className="relative flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-white px-2.5"
        style={{ border: "1px solid var(--rule)" }}
      >
        <Globe className="size-3.5 shrink-0 text-ink-faint" aria-hidden strokeWidth={2.2} />
        <span className="text-[12px] font-black" style={{ color: accent }}>
          {current?.label.split(" · ")[0]}
        </span>
        <ChevronDown className="size-3.5" aria-hidden strokeWidth={2.4} style={{ color: accent }} />
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
    );
  }

  return (
    <label className="card relative flex min-h-12 items-center justify-between gap-2 rounded-[14px] px-3.5 py-3">
      <span className="flex items-center gap-2.5">
        <Globe className="size-5 shrink-0 text-ink-faint" aria-hidden strokeWidth={2.2} />
        <span className="text-[13px] font-medium text-ink-muted">
          {t("app.language")}
        </span>
      </span>
      <span
        className="flex shrink-0 items-center gap-1.5 text-[14px] font-extrabold"
        style={{ color: accent }}
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
  );
}

/**
 * 999. A `tel:` link dials the moment it is touched — no confirmation from
 * the browser, and on a phone this card is a large red target near the top of
 * a screen someone is scrolling in a hurry. So the card asks first, and only
 * the second, smaller tap actually places the call.
 */
export function Emergency999({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { t } = useLanguage();
  const [asking, setAsking] = useState(false);
  return (
    <>
      <button
        onClick={() => setAsking(true)}
        className={`press w-full text-start ${className}`}
        style={style}
      >
        {children}
      </button>

      {asking && (
        <div
          className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          onClick={() => setAsking(false)}
        >
          <div
            role="alertdialog"
            aria-label={t("emergency.confirmTitle")}
            className="w-full max-w-md rounded-[22px] bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="sign-zh text-[22px]" style={{ color: "var(--sign-red)" }}>
              {t("emergency.confirmTitle")}
            </p>
            <p className="mt-1.5 text-[13px] leading-[1.6] text-ink-muted">
              {t("emergency.confirmBody")}
            </p>
            <a
              href="tel:999"
              onClick={() => setAsking(false)}
              className="press mt-3.5 flex min-h-[54px] w-full items-center justify-center rounded-[14px] text-[17px] font-black text-white"
              style={{
                background: "var(--sign-red)",
                boxShadow: "0 4px 0 0 var(--sign-red-deep)",
              }}
            >
              {t("emergency.confirmCall")}
            </a>
            <button
              onClick={() => setAsking(false)}
              className="mt-2 min-h-12 w-full rounded-[14px] text-[15px] font-bold text-ink-muted"
              style={{ border: "1.5px solid var(--rule)" }}
            >
              {t("emergency.cancel")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
