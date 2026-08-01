"use client";

// §5/03 全部車站 — the whole line as a vertical rail. Boarding is a filled
// green disc, the destination a red square, everything between a hollow ring;
// a 3px brand rail runs through them all.
//
// The design shows this as a static list. Here each row is also the picker:
// tapping a row sets where you get on or off, so the sequence you are reading
// is the sequence you are choosing from.

import type { Stop } from "@/hooks/useRideTracker";
import { useStopName } from "@/lib/i18n";

type Props = {
  stops: Stop[];
  boardingSeq: number;
  destinationSeq: number | null;
  onPickBoarding: (seq: number) => void;
  onPickDestination: (seq: number) => void;
  getOnLabel: string;
  getOffLabel: string;
};

export default function StopTimeline({
  stops,
  boardingSeq,
  destinationSeq,
  onPickBoarding,
  onPickDestination,
  getOnLabel,
  getOffLabel,
}: Props) {
  const stopName = useStopName();
  return (
    <ol className="flex flex-col">
      {stops.map((stop, i) => {
        const isOn = stop.seq === boardingSeq;
        const isOff = stop.seq === destinationSeq;
        const first = i === 0;
        const last = i === stops.length - 1;
        // Tapping above your boarding stop moves the boarding stop; tapping
        // below it moves the destination. One list, both choices.
        const picks = stop.seq <= boardingSeq ? "on" : "off";

        return (
          <li key={stop.seq}>
            <button
              onClick={() =>
                picks === "on"
                  ? onPickBoarding(stop.seq)
                  : onPickDestination(stop.seq)
              }
              className="flex w-full min-h-11 items-stretch gap-3 text-start"
            >
              {/* rail column: 20px wide, node centred, 3px brand rail */}
              <span className="relative flex w-5 shrink-0 flex-col items-center">
                <span
                  className="w-[3px] flex-1"
                  style={{
                    background: first ? "transparent" : "var(--brand)",
                    minHeight: 5,
                  }}
                />
                {isOn ? (
                  <span
                    className="size-[15px] shrink-0 rounded-full border-[3px] border-white"
                    style={{
                      background: "var(--brand)",
                      boxShadow: "0 0 0 2px var(--brand)",
                    }}
                  />
                ) : isOff ? (
                  <span
                    className="size-[15px] shrink-0 rounded-[3px] border-[3px] border-white"
                    style={{
                      background: "var(--sign-red)",
                      boxShadow: "0 0 0 2px var(--sign-red)",
                    }}
                  />
                ) : (
                  <span
                    className="size-[9px] shrink-0 rounded-full border-[2.5px] bg-white"
                    style={{ borderColor: "var(--brand)" }}
                  />
                )}
                <span
                  className="w-[3px] flex-1"
                  style={{
                    background: last ? "transparent" : "var(--brand)",
                    minHeight: 5,
                  }}
                />
              </span>

              <span className="min-w-0 flex-1 py-2">
                <span
                  className={`block leading-snug ${
                    isOn || isOff
                      ? "sign-zh text-[15px]"
                      : "text-[14px] font-medium text-ink-muted"
                  }`}
                >
                  {stopName(stop).primary}
                </span>
                {/* Your two stops also show the other language — that is the
                    name on the kerbside sign and the one the driver knows. */}
                {(isOn || isOff) && stopName(stop).secondary && (
                  <span className="mt-0.5 block text-[12px] leading-snug text-ink-faint">
                    {stopName(stop).secondary}
                  </span>
                )}
                {(isOn || isOff) && (
                  <span
                    className="mt-0.5 block text-[12px] font-semibold leading-snug"
                    style={{
                      color: isOn ? "var(--brand)" : "var(--sign-red)",
                    }}
                  >
                    {isOn ? getOnLabel : getOffLabel}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
