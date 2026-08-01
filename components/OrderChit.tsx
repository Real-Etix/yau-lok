"use client";

// 落單紙 — the order chit a 茶餐廳 waiter tears off and carries to the kitchen.
//
// The one object the diner holds up. It is cheap paper: a hard offset shadow
// instead of a soft one, a 3px radius rather than the app's rounded cards,
// and faint blue rules the writing sits across. Items are written in the
// shorthand a waiter actually uses (0T 走冰 少甜), which is exactly why the
// screen that shows this also has to decode it.
//
// Deliberately NOT a handwriting webfont: Google's Chinese brush faces are
// Simplified-only and fall back mid-line on 麵/單/嘅, which reads as broken
// rather than handwritten. Noto Sans HK 500, set loose, is the shipped look.

export type ChitItem = {
  /** Written as the waiter would write it, shorthand and all */
  label: string;
  price: number;
};

type Props = {
  table: string;
  seats: string;
  items: ChitItem[];
  total: number;
  totalLabel: string;
  className?: string;
};

export default function OrderChit({
  table,
  seats,
  items,
  total,
  totalLabel,
  className = "",
}: Props) {
  return (
    <div
      className={className}
      style={{
        background: "#fffdf3",
        border: "1px solid #ddd7ce",
        borderRadius: 3,
        padding: "16px 18px 18px",
        boxShadow: "3px 4px 0 0 rgba(20,17,15,.16)",
        backgroundImage:
          "repeating-linear-gradient(0deg,transparent 0 33px,rgba(18,80,126,.14) 33px 34px)",
      }}
    >
      <div
        className="flex items-baseline justify-between"
        style={{ borderBottom: "2px solid var(--ink)", paddingBottom: 6 }}
      >
        <span className="sign-zh text-[14px]">{table}</span>
        <span className="sign-zh text-[14px]">{seats}</span>
      </div>

      <div className="mt-3 flex flex-col gap-[11px]">
        {items.map((item, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3">
            <span
              className="min-w-0"
              style={{
                font: "500 34px/1 'Noto Sans HK', sans-serif",
                color: "var(--sign-red)",
              }}
            >
              {item.label}
            </span>
            <span
              className="shrink-0"
              style={{
                font: "500 30px/1 'Noto Sans HK', sans-serif",
                color: "var(--sign-red)",
              }}
            >
              {item.price}
            </span>
          </div>
        ))}
      </div>

      <div
        className="mt-3.5 flex items-baseline justify-between"
        style={{ borderTop: "2px solid var(--ink)", paddingTop: 10 }}
      >
        <span className="sign-zh text-[15px]">{totalLabel}</span>
        <span
          style={{
            font: "700 30px/1 'Noto Sans HK', sans-serif",
            color: "var(--sign-red)",
          }}
        >
          {total}
        </span>
      </div>
    </div>
  );
}
