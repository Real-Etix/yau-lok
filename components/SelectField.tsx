"use client";

// Styled wrapper around a native <select>. Native is deliberate: on iOS and
// Android the OS renders its own full-screen picker, which beats any custom
// dropdown on a moving bus. We only restyle the closed state.

import type { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  icon: LucideIcon;
  value: string | number;
  onChange: (value: string) => void;
  children: React.ReactNode;
  /** Small muted text under the field (e.g. live ETA) */
  hint?: React.ReactNode;
  accent?: "indigo" | "red" | "slate";
};

export default function SelectField({
  label,
  icon: Icon,
  value,
  onChange,
  children,
  hint,
  accent = "slate",
}: Props) {
  return (
    <div className="mt-3">
      <label className="block">
        <span className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
          <span
            aria-hidden
            className={`inline-block h-2 w-2 rounded-full ${
              accent === "indigo"
                ? "bg-[var(--sign-blue)]"
                : accent === "red"
                  ? "bg-red-500"
                  : "bg-[var(--ink-faint)]"
            }`}
          />
          {label}
        </span>
        <span className="field">
          <span className="field-icon">
            <Icon className="size-5" aria-hidden strokeWidth={2.2} />
          </span>
          <select
            className="field-select"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            {children}
          </select>
        </span>
      </label>
      {hint}
    </div>
  );
}
