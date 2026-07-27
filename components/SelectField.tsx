"use client";

// Styled wrapper around a native <select>. Native is deliberate: on iOS and
// Android the OS renders its own full-screen picker, which beats any custom
// dropdown on a moving bus. We only restyle the closed state.

type Props = {
  label: string;
  icon: string;
  value: string | number;
  onChange: (value: string) => void;
  children: React.ReactNode;
  /** Small muted text under the field (e.g. live ETA) */
  hint?: React.ReactNode;
  accent?: "indigo" | "red" | "slate";
};

export default function SelectField({
  label,
  icon,
  value,
  onChange,
  children,
  hint,
  accent = "slate",
}: Props) {
  return (
    <div className="mt-3">
      <label className="block">
        <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <span
            aria-hidden
            className={`inline-block h-2 w-2 rounded-full ${
              accent === "indigo"
                ? "bg-indigo-500"
                : accent === "red"
                  ? "bg-red-500"
                  : "bg-slate-300"
            }`}
          />
          {label}
        </span>
        <span className="field">
          <span aria-hidden className="field-icon">
            {icon}
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
