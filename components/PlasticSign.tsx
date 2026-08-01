"use client";

// 膠牌 — the bolted plastic plate.
//
// This is the object the user physically holds up to another person: a taxi
// driver reading a destination across the seat, or a triage nurse reading
// "I don't speak Cantonese" across a counter. It is deliberately the
// biggest thing on its screen, and deliberately looks like an object rather
// than a card — thick border, hard drop shadow, a highlight along the top
// edge, and four bolts holding it on.

import Battenburg from "@/components/Battenburg";

type Props = {
  tone?: "taxi" | "ambulance";
  /** The roof-sign form: one short line, no bolted padding */
  compact?: boolean;
  children: React.ReactNode;
  className?: string;
};

export default function PlasticSign({
  tone = "taxi",
  compact,
  children,
  className = "",
}: Props) {
  const taxi = tone === "taxi";
  const bolt = compact ? 7 : 9;
  const inset = compact ? 7 : 9;

  return (
    <div
      className={`relative overflow-hidden text-center ${className}`}
      style={{
        background: taxi
          ? "linear-gradient(#FFDE59,#F2C012)"
          : "var(--amb-yellow)",
        border: `${compact ? 3 : 4}px solid ${
          taxi ? "var(--ink)" : "var(--sign-blue)"
        }`,
        borderRadius: compact ? 10 : 14,
        padding: compact ? "11px 16px" : "24px 20px 22px",
        boxShadow: taxi
          ? `0 ${compact ? 4 : 6}px 0 0 var(--ink), inset 0 ${
              compact ? 2 : 3
            }px 0 rgba(255,255,255,.55)`
          : `0 6px 0 0 var(--amb-blue-deep), inset 0 3px 0 rgba(255,255,255,.45)`,
      }}
    >
      {/* An ambulance plate carries the stripe top and bottom. */}
      {!taxi && (
        <Battenburg height={11} className="absolute inset-x-0 top-0" />
      )}

      {children}

      {!taxi && (
        <Battenburg height={11} reversed className="absolute inset-x-0 bottom-0" />
      )}

      {/* Four bolts. Purely the object talking. */}
      {(
        [
          { top: inset, left: inset },
          { top: inset, right: inset },
          { bottom: inset, left: inset },
          { bottom: inset, right: inset },
        ] as const
      ).map((pos, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute rounded-full"
          style={{
            width: bolt,
            height: bolt,
            background: "rgba(0,0,0,.4)",
            ...pos,
          }}
        />
      ))}
    </div>
  );
}
