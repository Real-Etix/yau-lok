"use client";

// 咪錶 — the taxi meter, the signature object of the 的士 flow.
//
// Modelled on the real unit bolted to a Hong Kong urban taxi's dashboard: a
// black bezel, two bracketed columns of red seven-segment digits, the HK$ /
// C[x10] rule beneath each, and the 空/往/停/附加/$10/$1 button rail. The
// rider does not operate it — they read it, and so does the driver, which is
// why it is the one thing on screen big enough to check from the back seat.
//
// Three sizes, all present in the design:
//   lg — the running meter (46/30) with HIRED, the rail and the stats row
//   md — the pre-boarding estimate (40/28): brackets and footers, no rail
//   sm — a reference readout beside something else (34/24), labels only
//
// The README names only `sm` and `lg`; the design file carries a third,
// larger estimate meter on screen 01, so `md` exists to match it.

type Size = "sm" | "md" | "lg";

type Props = {
  /** Dollars on the fare column */
  fare: number;
  /** Dollars on the extras column — tolls, luggage, waiting */
  extras: number;
  km?: number;
  elapsedS?: number;
  speed?: number;
  /** Lights the first rail pill and shows HIRED — the flag is down */
  hired?: boolean;
  size?: Size;
  /** Replaces the km · time · speed row (the estimate shows distance/tolls) */
  stats?: [string, string, string];
  className?: string;
};

const FARE_PX: Record<Size, number> = { sm: 34, md: 40, lg: 46 };
const EXTRAS_PX: Record<Size, number> = { sm: 24, md: 28, lg: 30 };
const PAD: Record<Size, string> = {
  sm: "12px 14px 10px",
  md: "14px 14px 12px",
  lg: "14px 14px 11px",
};

/** Meters read in whole cents, never in floating-point dust. */
function money(v: number) {
  return v.toFixed(1);
}

function mmss(totalS: number) {
  const m = Math.floor(totalS / 60);
  const s = Math.floor(totalS % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/** The bracket over each column: white rule on three sides, open at the foot. */
function BracketLabel({ text, tracking }: { text: string; tracking: string }) {
  return (
    <div
      className="text-center text-white"
      style={{
        font: "700 11px/1 var(--font-archivo), sans-serif",
        letterSpacing: tracking,
        padding: "5px 0 4px",
        borderTop: "2px solid #fff",
        borderLeft: "2px solid #fff",
        borderRight: "2px solid #fff",
        borderRadius: "4px 4px 0 0",
      }}
    >
      {text}
    </div>
  );
}

/** HK$ … C[x10] — the units rule under each column. */
function ColumnFooter() {
  return (
    <div
      className="flex justify-between"
      style={{ borderTop: "2px solid #fff" }}
    >
      <span
        className="text-white"
        style={{ font: "700 10px/1 var(--font-archivo), sans-serif" }}
      >
        HK$
      </span>
      <span
        className="text-white"
        style={{ font: "700 10px/1 var(--font-archivo), sans-serif" }}
      >
        C[x10]
      </span>
    </div>
  );
}

export default function Meter({
  fare,
  extras,
  km,
  elapsedS,
  speed,
  hired,
  size = "lg",
  stats,
  className = "",
}: Props) {
  const full = size !== "sm";

  const digits = (value: string, px: number, pad: string, glow: number) => (
    <div
      className={`text-center ${hired ? "meter-hired" : ""}`}
      style={{
        font: `400 ${px}px/1 var(--font-dot), monospace`,
        color: "var(--meter-on)",
        padding: pad,
        textShadow: `0 0 ${glow}px rgba(255,46,46,${glow > 12 ? ".55" : ".5"})`,
      }}
    >
      {value}
    </div>
  );

  return (
    <div
      className={className}
      style={{
        background: "var(--meter-bg)",
        border: "2px solid #262626",
        borderRadius: 12,
        padding: PAD[size],
      }}
    >
      <div
        className="flex gap-3.5"
        style={{ alignItems: full ? "flex-end" : "center" }}
      >
        <div style={{ flex: 1.5 }}>
          {full ? (
            <BracketLabel text="FARE" tracking=".3em" />
          ) : (
            <div
              className="text-white"
              style={{
                font: "700 9px/1 var(--font-archivo), sans-serif",
                letterSpacing: ".28em",
              }}
            >
              FARE
            </div>
          )}
          {digits(
            money(fare),
            FARE_PX[size],
            full ? (size === "lg" ? "7px 0 3px" : "6px 0 2px") : "0",
            size === "lg" ? 14 : 12,
          )}
          {full && <ColumnFooter />}
        </div>

        <div style={{ background: "#fff", width: 2, opacity: 0.85, alignSelf: "stretch" }} />

        <div style={{ flex: 1 }}>
          {full ? (
            <BracketLabel text="EXTRAS" tracking=".22em" />
          ) : (
            <div
              className="text-white"
              style={{
                font: "700 9px/1 var(--font-archivo), sans-serif",
                letterSpacing: ".2em",
              }}
            >
              EXTRAS
            </div>
          )}
          {digits(
            money(extras),
            EXTRAS_PX[size],
            full ? (size === "lg" ? "12px 0 6px" : "9px 0 5px") : "0",
            10,
          )}
          {full && <ColumnFooter />}
        </div>
      </div>

      {/* The flag is down: the one word both parties check. */}
      {hired && (
        <div
          className="text-center"
          style={{
            font: "400 13px/1 var(--font-dot), monospace",
            color: "var(--meter-on)",
            letterSpacing: ".2em",
            marginTop: 8,
          }}
        >
          HIRED
        </div>
      )}

      {/* The physical button rail. Decorative — the driver operates it. */}
      {size === "lg" && (
        <>
          <div className="flex gap-[7px]" style={{ marginTop: 10 }} aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                style={{
                  flex: 1,
                  height: 26,
                  borderRadius: 5,
                  background: i === 0 ? "var(--sign-red)" : "var(--meter-btn)",
                  boxShadow:
                    i === 0 && hired
                      ? "0 0 10px rgba(215,38,61,.5)"
                      : undefined,
                }}
              />
            ))}
          </div>
          <div
            className="flex gap-[7px] text-center"
            style={{
              font: "700 9px/1 'Noto Sans HK', sans-serif",
              color: "#8a8a8a",
              marginTop: 6,
            }}
            aria-hidden
          >
            {["空", "往", "停", "附加", "$10", "$1"].map((l) => (
              <span key={l} style={{ flex: 1 }}>
                {l}
              </span>
            ))}
          </div>
        </>
      )}

      {(stats || full) && (
        <div
          className="flex justify-between"
          style={{
            font: "400 10px/1 var(--font-archivo), sans-serif",
            color: "#7b7b7b",
            marginTop: 9,
          }}
        >
          {stats ? (
            stats.map((s, i) => <span key={i}>{s}</span>)
          ) : (
            <>
              <span>{(km ?? 0).toFixed(2)} km</span>
              <span>{mmss(elapsedS ?? 0)}</span>
              <span>{(speed ?? 0).toFixed(0)} km/h</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
