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
