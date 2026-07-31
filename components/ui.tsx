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
}: {
  children: React.ReactNode;
  /** Fill the viewport exactly (riding view) rather than growing */
  fill?: boolean;
}) {
  return (
    <main
      className={`mx-auto flex w-full min-w-0 max-w-md flex-col gap-3 overflow-x-hidden px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 ${
        fill ? "h-dvh" : "min-h-dvh"
      }`}
    >
      {children}
    </main>
  );
}

/** Back link + optional right-hand controls. */
export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-2">
      <Link
        href="/"
        className="-ms-2 flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-ink-muted"
      >
        <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
        Yau Lok!
      </Link>
      <div className="flex items-center gap-2">{children}</div>
    </header>
  );
}

/** A pill toggle. Both states are always visible so neither can be misread. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <span className="inline-flex overflow-hidden rounded-full border-2 border-ink">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`min-h-11 px-3 text-xs font-bold uppercase tracking-wide ${
            value === o.value
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
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`card p-4 ${className}`}>{children}</section>;
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
  tone = "ink",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "ink" | "red" | "blue" | "white";
  className?: string;
}) {
  const tones: Record<string, string> = {
    ink: "bg-ink text-white shadow-[0_3px_0_0_#000]",
    red: "bg-[var(--sign-red)] text-white shadow-[0_3px_0_0_var(--sign-red-deep)]",
    blue: "bg-[var(--sign-blue)] text-white shadow-[0_3px_0_0_#0b3a5c]",
    white: "bg-white text-ink border-2 border-ink shadow-[0_3px_0_0_#14110f]",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`press min-h-12 w-full rounded-[var(--r-md)] px-4 py-3 text-center font-bold disabled:opacity-40 disabled:shadow-none ${tones[tone]} ${className}`}
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
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  live: boolean;
  soonLabel: string;
}) {
  const inner = (
    <>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[var(--sign-red)] text-white">
        <Icon className="size-6" aria-hidden strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-extrabold">{title}</span>
          {!live && (
            <span className="rounded-full bg-[var(--rule)] px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-ink-muted">
              {soonLabel}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-sm leading-snug text-ink-muted">
          {subtitle}
        </span>
      </span>
    </>
  );

  if (!live) {
    return (
      <div className="card flex items-center gap-3 p-3 opacity-55">{inner}</div>
    );
  }
  return (
    <Link
      href={href}
      className="press card flex min-h-16 items-center gap-3 p-3 shadow-[0_3px_0_0_var(--rule)]"
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
}: {
  tone: "green" | "amber" | "red" | "neutral";
  title: string;
  detail?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const tones = {
    green:
      "bg-[var(--sign-green-soft)] text-[var(--sign-green)] border-[var(--sign-green)]",
    amber:
      "bg-[var(--sign-amber-soft)] text-[var(--sign-amber)] border-[var(--sign-amber)]",
    red: "bg-[var(--sign-red)] text-white border-[var(--sign-red-deep)] animate-pulse",
    neutral: "bg-white text-ink-muted border-[var(--rule)]",
  };
  return (
    <section
      className={`shrink-0 rounded-[var(--r-lg)] border-2 p-3 text-center ${tones[tone]}`}
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
