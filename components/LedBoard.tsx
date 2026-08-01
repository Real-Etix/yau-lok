"use client";

// The LED dot-matrix destination board from a green minibus windscreen.
// This is the app's signature element: it is the logo, the route header, the
// countdown, the next-stop announcement, and the inline route-code chip.
//
// Rule from the handoff: the LED board is for MINIBUSES only. Franchised-bus
// legs use a flat cream pill, never this.

import { useEffect, useRef, useState } from "react";

export type LedSize = "logo" | "header" | "display" | "chip";

type Props = {
  size: LedSize;
  /** Small dim line above, e.g. "下一站 NEXT STOP" */
  label?: string;
  /** Amber main line */
  primary: React.ReactNode;
  /** Dim second line — romanisation or English */
  secondary?: string;
  /** Right-aligned dim value, e.g. "$7.6" */
  trailing?: string;
  /** The physical plate treatment (logo only) */
  framed?: boolean;
  /** Marquee the primary line — only when it actually overflows */
  scroll?: boolean;
  /**
   * Logo laid out across instead of stacked: mark on the left, wordmark and
   * tagline beside it, status lamp at the right. The home board reads as a
   * strip of destination glass rather than a centred badge.
   */
  horizontal?: boolean;
  /** Second dim line beside the wordmark (horizontal logo only) */
  tagline?: string;
  /** Green pulsing lamp + label at the right (horizontal logo only) */
  lamp?: string;
  className?: string;
};

const PLATE: Record<LedSize, string> = {
  logo: "rounded-xl px-[18px] pb-4 pt-[18px]",
  header: "rounded-[10px] px-3.5 py-3",
  display: "rounded-[10px] px-3.5 py-3",
  chip: "rounded-[5px] px-2 py-1",
};

const PRIMARY: Record<LedSize, string> = {
  logo: "text-[62px] leading-none",
  header: "text-[40px] leading-none",
  display: "text-[30px] leading-none",
  chip: "text-[15px] leading-none",
};

export default function LedBoard({
  size,
  label,
  primary,
  secondary,
  trailing,
  framed,
  scroll,
  horizontal,
  tagline,
  lamp,
  className = "",
}: Props) {
  // Only marquee when the text genuinely overflows its plate — a scrolling
  // short name is noise.
  const trackRef = useRef<HTMLSpanElement>(null);
  const viewRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    if (!scroll) return;
    const track = trackRef.current;
    const view = viewRef.current;
    if (!track || !view) return;
    const check = () => setOverflows(track.scrollWidth > view.clientWidth + 4);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(view);
    return () => ro.disconnect();
  }, [scroll, primary]);

  const glow = size === "logo" || size === "header" || size === "display";

  if (horizontal) {
    return (
      <div
        className={`led led-dots relative rounded-[11px] px-[15px] pb-2.5 pt-3 ${
          framed ? "led-framed" : ""
        } ${className}`}
      >
        <div className="flex items-center gap-3">
          <span
            className="led-glow shrink-0 text-[40px] leading-none"
            style={{ color: "var(--led-on)" }}
          >
            {primary}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
            {secondary && (
              <span
                className="text-[12px] leading-none tracking-[0.22em]"
                style={{ color: "var(--led-dim)" }}
              >
                {secondary}
              </span>
            )}
            {tagline && (
              <span
                className="text-[12px] leading-[1.3]"
                style={{ color: "var(--led-on)" }}
              >
                {tagline}
              </span>
            )}
          </span>
          {lamp && (
            <span className="flex shrink-0 items-center gap-1.5">
              <span
                aria-hidden
                className="soft-pulse size-[7px] rounded-full"
                style={{ background: "#4ade80" }}
              />
              <span
                className="text-[10px] leading-none tracking-[0.1em]"
                style={{ color: "#4ade80" }}
              >
                {lamp}
              </span>
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`led led-dots ${PLATE[size]} ${framed ? "led-framed" : ""} ${className}`}
    >
      {label && (
        <p
          className="text-[11px] uppercase leading-none tracking-[0.14em]"
          style={{ color: "var(--led-dim)" }}
        >
          {label}
        </p>
      )}

      <div className={`flex items-baseline gap-3 ${label ? "mt-2" : ""}`}>
        <span
          ref={viewRef}
          className={`min-w-0 flex-1 overflow-hidden ${scroll ? "block" : ""}`}
        >
          <span
            ref={trackRef}
            className={`${PRIMARY[size]} ${glow ? "led-glow" : ""} ${
              scroll && overflows ? "led-marquee" : "block truncate"
            }`}
            style={{ color: "var(--led-on)" }}
          >
            {primary}
          </span>
        </span>
        {trailing && (
          <span
            className="shrink-0 text-[15px] leading-none"
            style={{ color: "var(--led-dim)" }}
          >
            {trailing}
          </span>
        )}
      </div>

      {secondary && (
        <p
          className={`mt-1.5 uppercase leading-none tracking-[0.14em] ${
            size === "logo" ? "text-center text-[17px] tracking-[0.22em]" : "text-[12px]"
          }`}
          style={{ color: "var(--led-dim)" }}
        >
          {secondary}
        </p>
      )}
    </div>
  );
}
