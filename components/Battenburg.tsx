"use client";

// The battenburg stripe from a Hong Kong Fire Services ambulance: red and
// blue blocks canted at 115°, separated by white. It runs directly under
// every A&E header so the livery reads as an ambulance rather than a
// generic blue app, and again — reversed and shorter — inside the
// registration plate.

export default function Battenburg({
  height = 13,
  reversed,
  className = "",
}: {
  height?: number;
  /** Mirrors the cant, for the strip pinned inside a PlasticSign */
  reversed?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`w-full shrink-0 ${className}`}
      style={{
        height,
        background: `repeating-linear-gradient(${reversed ? 65 : 115}deg,
          var(--sign-red) 0 22px, #fff 22px 24px,
          var(--sign-blue) 24px 46px, #fff 46px 48px)`,
      }}
    />
  );
}
