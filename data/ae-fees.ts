// Hospital Authority Accident & Emergency charges.
//
// These are set by government order and change. Keeping them in one place
// with a date means a stale figure can be spotted and corrected without
// hunting through JSX — and nothing renders a price that did not come from
// here. The disclaimer is not optional: what a patient is actually charged
// is whatever the Authority has published on the day.
//
// Source: Hospital Authority fees and charges for eligible persons.
// Verify at https://www.ha.org.hk before relying on it.

export type AeFees = {
  /** Triage I and II are not charged */
  urgentFreeTriage: string[];
  /** Charge for triage III–V, eligible persons, in HKD */
  standardHkd: number;
  /** Refundable if a III–V patient leaves before seeing a doctor, in HKD */
  leaveEarlyRefundHkd: number;
  /** When a human last checked this against the published scale (ISO date) */
  lastChecked: string;
};

export const AE_FEES: AeFees = {
  urgentFreeTriage: ["I", "II"],
  standardHkd: 400,
  leaveEarlyRefundHkd: 350,
  lastChecked: "2026-08-01",
};

/** The five triage levels, in the Authority's own order and colours. */
export type TriageLevel = {
  numeral: string;
  /** Catalogue key for 危殆 / 危急 / … and the target time */
  key: string;
  colour: string;
};

export const TRIAGE_LEVELS: TriageLevel[] = [
  { numeral: "I", key: "clinic.triage.critical", colour: "var(--sign-red)" },
  { numeral: "II", key: "clinic.triage.emergency", colour: "#e8622c" },
  { numeral: "III", key: "clinic.triage.urgent", colour: "var(--sign-amber)" },
  { numeral: "IV", key: "clinic.triage.semiUrgent", colour: "var(--sign-blue)" },
  { numeral: "V", key: "clinic.triage.nonUrgent", colour: "var(--ink-faint)" },
];
