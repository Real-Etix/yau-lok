"use client";

// Shared 膠牌 primitives. Every touch target here clears 44pt, and no emoji
// is ever used as an icon — Lucide only, so glyphs are consistent across
// platforms and inherit colour from tokens.

import Link from "next/link";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n";

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
  /** cream = list screens, cabin = riding (you are inside the bus) */
  tone?: "paper" | "cream" | "cabin";
  /** Remove horizontal padding so a brand TopBar can bleed to the edges */
  flush?: boolean;
}) {
  const tones = {
    paper: "bg-[var(--paper)]",
    cream: "bg-[var(--body-cream)]",
    cabin: "bg-[var(--brand-deep)]",
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
}: {
  children?: React.ReactNode;
  /** brand = the green "roof" of the screen, bleeding to the edges */
  variant?: "plain" | "brand";
  title?: string;
  subtitle?: string;
  /** Sitting on the dark cabin background — invert the back link */
  cabin?: boolean;
}) {
  if (variant === "brand") {
    return (
      <header className="shrink-0 bg-[var(--brand)] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            className="-ms-2 flex min-h-11 min-w-11 items-center gap-1.5 rounded-lg px-2 text-white"
          >
            <ChevronLeft className="size-6 rtl:rotate-180" aria-hidden />
            {title && (
              <span className="sign-zh text-[22px]">{title}</span>
            )}
          </Link>
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
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** Translucent treatment for the dark cabin / brand header */
  cabin?: boolean;
}) {
  return (
    <span
      className={`inline-flex overflow-hidden rounded-full ${
        cabin ? "bg-white/15" : "border-2 border-ink"
      }`}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`min-h-11 px-3 text-xs font-bold uppercase tracking-wide ${
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
  tone?: "green" | "ink" | "red" | "blue" | "white";
  /** 54-60px bars carry a 4px offset instead of 3px */
  tall?: boolean;
  className?: string;
}) {
  const off = tall ? "4px" : "3px";
  const tones: Record<string, string> = {
    green: `bg-[var(--brand)] text-white shadow-[0_${off}_0_0_var(--brand-deep)]`,
    ink: `bg-ink text-white shadow-[0_${off}_0_0_#000]`,
    red: `bg-[var(--sign-red)] text-white shadow-[0_${off}_0_0_var(--sign-red-deep)]`,
    blue: `bg-[var(--sign-blue)] text-white shadow-[0_${off}_0_0_#0b3a5c]`,
    white: `bg-white text-ink border-2 border-ink shadow-[0_${off}_0_0_#14110f]`,
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

/** Scenario tile on the home screen. */
export function ScenarioTile({
  href,
  icon: Icon,
  title,
  subtitle,
  live,
  soonLabel,
  color = "var(--brand)",
  raised,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  live: boolean;
  soonLabel: string;
  /** Icon square colour — one per scenario */
  color?: string;
  raised?: boolean;
}) {
  const inner = (
    <>
      <span
        className="flex size-12 shrink-0 items-center justify-center rounded-[13px] text-white"
        style={{ background: color }}
      >
        <Icon className="size-6" aria-hidden strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="sign-zh text-[17px]">{title}</span>
          {!live && (
            <span className="rounded-full bg-[var(--rule)] px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-ink-muted">
              {soonLabel}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-ink-muted">
          {subtitle}
        </span>
      </span>
    </>
  );

  if (!live) {
    return (
      <div className="card flex items-center gap-2.5 rounded-[18px] p-3 opacity-50">
        {inner}
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="press card flex min-h-16 items-center gap-2.5 rounded-[18px] p-3"
      style={{
        boxShadow: raised ? "0 3px 0 0 var(--brand)" : "0 3px 0 0 var(--rule)",
      }}
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
