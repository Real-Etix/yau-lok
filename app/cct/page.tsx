"use client";

// 茶餐廳 — 落單唔使驚.
//
// The dining room is the theme: mosaic tile chrome, cream tiled walls,
// melamine tokens for the dishes, and the 落單紙 as the object you hand
// over. The hard part of a cha chaan teng is not the food, it is that the
// waiter writes your drink as 0T and shouts it at the kitchen — so the
// screen that shows the chit is also the screen that decodes it.

import { useCallback, useEffect, useState } from "react";
import {
  CCT_PHRASES,
  CCT_CODES,
  CCT_SLANG,
  CCT_TWEAKS,
  CCT_RULES,
  CCT_MENU,
  type CctPhrase,
  type CctItem,
} from "@/data/cct-phrases";
import { DEFAULT_PERSONA_KEY, VOICE_PERSONAS } from "@/data/voices";
import { speakCantonese } from "@/lib/speech";
import OrderChit from "@/components/OrderChit";
import { Screen, TopBar, PressButton, LanguageRow } from "@/components/ui";
import { Volume2, Pencil, BookOpen, Camera } from "lucide-react";
import Link from "next/link";
import { useT } from "@/lib/i18n";

const TABLE_NUMBER = 12;

export default function CctPage() {
  const t = useT();
  const [personaKey, setPersonaKey] = useState(DEFAULT_PERSONA_KEY);

  const [coach, setCoach] = useState(true);
  const [speaking, setSpeaking] = useState<string | null>(null);

  const [step, setStep] = useState<"seat" | "order" | "chit" | "slang" | "pay">(
    "seat",
  );
  const [picked, setPicked] = useState<string[]>([]);
  const [tweaks, setTweaks] = useState<string[]>([]);

  useEffect(() => {
    const v = localStorage.getItem("yau-lok-voice");
    if (v && VOICE_PERSONAS.some((p) => p.key === v)) setPersonaKey(v);
  }, []);

  const speak = useCallback(
    async (id: string, cantonese: string) => {
      setSpeaking(id);
      try {
        await speakCantonese(cantonese, personaKey);
      } finally {
        setTimeout(() => setSpeaking(null), 600);
      }
    },
    [personaKey],
  );

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const chosen = CCT_MENU.filter((m) => picked.includes(m.id));
  const total = chosen.reduce((sum, m) => sum + m.price, 0);
  const tweakText = tweaks.map((k) => t(`cct.tweak.${k}`)).join(" ");

  // The chit is written the way a waiter writes it: shorthand, and the
  // tweaks trailing the drink they belong to.
  const chitItems = chosen.map((m) => ({
    label:
      m.kind === "drink" && tweakText ? `${m.chit} ${tweakText}` : m.chit,
    price: m.price,
  }));

  // Every code and tweak on the chit, decoded once, with no trailing dot.
  const legend: { term: string; gloss?: string }[] = [
    ...chosen
      .filter((m) => m.tone === "code")
      .map((m) => {
        const code = CCT_CODES.find((c) => c.code === m.chit);
        return code ? { term: code.code, gloss: t(code.key) } : null;
      })
      .filter((x): x is { term: string; gloss: string } => x !== null),
    ...tweaks.map((k) => ({ term: t(`cct.tweak.${k}`) })),
  ];

  const orderPhrase = CCT_PHRASES.find((p) => p.id === "order-please")!;
  const payPhrases = CCT_PHRASES.filter((p) => p.group === "pay");

  // Back walks the meal backwards; only 入座 leaves for the home screen.
  const BACK: Record<string, "seat" | "order" | "chit" | undefined> = {
    seat: undefined,
    order: "seat",
    chit: "order",
    slang: "chit",
    pay: "chit",
  };
  const backTo = BACK[step];
  const onBack = backTo ? () => setStep(backTo) : undefined;

  const sectionLabel = (text: string) => (
    <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
      {text}
    </span>
  );

  const tableChip = (
    <span
      className="rounded-[5px] px-2.5 py-1.5 text-[12px] font-black"
      style={{ background: "var(--melamine)", color: "var(--ink)" }}
    >
      {t("cct.table").replace("{n}", String(TABLE_NUMBER))}
    </span>
  );

  const languageRow = <LanguageRow accent="var(--sign-green)" />;

  const phraseCard = (p: CctPhrase, sub?: string, primary = false) => (
    <button
      key={p.id}
      onClick={() => speak(p.id, p.cantonese)}
      className={`press min-h-11 w-full rounded-[14px] px-3.5 py-3 text-start ${
        speaking === p.id ? "ring-2 ring-[var(--melamine)]" : ""
      }`}
      style={
        primary
          ? {
              background: "var(--sign-red)",
              boxShadow: "0 4px 0 0 var(--sign-red-deep)",
            }
          : {
              background: "var(--card)",
              border: "1px solid var(--rule)",
              boxShadow: "0 3px 0 0 var(--rule)",
            }
      }
    >
      <span
        className="block text-[16px] font-bold leading-[1.3]"
        style={{ color: primary ? "#fff" : "var(--ink)" }}
        lang="zh-HK"
      >
        {p.cantonese}
      </span>
      <span
        className="mt-0.5 block text-[11px] leading-[1.4]"
        style={{ color: primary ? "#ffd7dd" : "var(--ink-faint)" }}
      >
        {coach ? p.jyutping : p.english}
        {sub ? ` · ${sub}` : ""}
      </span>
    </button>
  );

  /** A melamine token: the plate the dish arrives on. */
  const token = (item: CctItem) => {
    const tones = {
      yellow: { background: "var(--melamine)", color: "var(--ink)", border: "2px solid var(--ink)" },
      mint: { background: "var(--melamine-mint)", color: "var(--ink)", border: "2px solid var(--ink)" },
      code: { background: "var(--ink)", color: "var(--melamine)", border: "none" },
    } as const;
    return (
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-[15px] font-black"
        style={tones[item.tone]}
      >
        {item.token}
      </span>
    );
  };

  // ------------------------------------------------------------- 01 入座
  if (step === "seat") {
    return (
      <Screen tone="cct" flush>
        <TopBar variant="cct" title={t("cct.title")} onBack={onBack}>
          {tableChip}
        </TopBar>

        <div className="flex flex-1 flex-col gap-[13px] px-[18px] py-4">
          {/* The 常餐 board, as it hangs on the wall. */}
          <div
            className="bg-white px-4 py-3.5"
            style={{
              border: "2px solid var(--ink)",
              borderRadius: 4,
              boxShadow: "3px 3px 0 0 rgba(20,17,15,.18)",
            }}
          >
            <div
              className="flex items-baseline justify-between pb-2"
              style={{ borderBottom: "2px solid var(--sign-red)" }}
            >
              <span
                className="sign-zh text-[22px]"
                style={{ color: "var(--sign-red)" }}
              >
                {t("cct.todaySet")}
              </span>
              <span
                className="text-[22px] font-black"
                style={{ color: "var(--sign-red)" }}
              >
                $42
              </span>
            </div>
            <p className="mt-2 whitespace-pre-line text-[15px] font-bold leading-[1.7]">
              {t("cct.setItems")}
            </p>
            <p className="mt-1 text-[12.5px] font-medium leading-[1.5] text-ink-muted">
              {t("cct.setNote")}
            </p>
          </div>

          {sectionLabel(t("cct.wallBoard"))}
          <div className="flex flex-col gap-2">
            {CCT_MENU.filter((m) => m.wallBoard).map(
              (m) => (
                <div
                  key={m.id}
                  className="flex items-baseline justify-between bg-white px-3.5 py-2.5"
                  style={{ border: "1px solid var(--rule)", borderRadius: 3 }}
                >
                  <span className="sign-zh text-[17px]">
                    {t(`cct.item.${m.id}`)}
                  </span>
                  <span
                    className="text-[17px] font-black"
                    style={{ color: "var(--sign-red)" }}
                  >
                    ${m.price}
                  </span>
                </div>
              ),
            )}
          </div>

          <PressButton
            tone="red"
            tall
            className="rounded-[12px]"
            onClick={() => setStep("order")}
          >
            {t("cct.startOrder")}
          </PressButton>

          {/* The shop's own 餐牌 differs from ours; shoot it instead. */}
          <Link
            href="/cct/scan"
            className="press flex min-h-14 items-center gap-3 rounded-[14px] bg-white px-3.5 py-3"
            style={{ border: "1.5px dashed var(--sign-green)" }}
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-[12px]"
              style={{ background: "var(--melamine)" }}
            >
              <Camera className="size-5" aria-hidden strokeWidth={2.2} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="sign-zh text-[15px] leading-[1.2]">
                {t("scan.scanEntry")}
              </span>
              <span className="text-[11.5px] leading-[1.35] text-ink-muted">
                {t("scan.scanEntrySub")}
              </span>
            </span>
          </Link>

          {languageRow}

          <p className="mt-auto pt-1 text-center text-[11px] font-medium leading-[1.6] text-ink-faint">
            {t("cct.priceNote")}
          </p>
          <p className="text-center text-[11px] font-medium leading-[1.6] text-ink-faint">
            {t("cct.sharingNote")}
          </p>
        </div>
      </Screen>
    );
  }

  // ------------------------------------------------------------- 02 落單
  if (step === "order") {
    const row = (m: CctItem) => {
      const on = picked.includes(m.id);
      return (
        <button
          key={m.id}
          onClick={() => setPicked((p) => toggle(p, m.id))}
          aria-pressed={on}
          className="flex min-h-14 w-full items-center gap-3 rounded-[14px] bg-white px-3.5 py-[13px] text-start"
          style={{
            border: on ? "2px solid var(--sign-red)" : "1px solid var(--rule)",
            boxShadow: on ? "0 3px 0 0 var(--sign-red)" : undefined,
          }}
        >
          {token(m)}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="sign-zh text-[16px] leading-[1.2]">
              {t(`cct.item.${m.id}`)}
            </span>
            <span className="text-[11.5px] leading-[1.35] text-ink-muted">
              {t(`cct.item.${m.id}Sub`)}
            </span>
          </span>
          <span className="shrink-0 text-[16px] font-black">${m.price}</span>
        </button>
      );
    };

    return (
      <Screen tone="cct" flush>
        <TopBar variant="cct" title={t("cct.orderTitle")} onBack={onBack}>
          <span
            className="rounded-[5px] px-2.5 py-1.5 text-[13px] font-black"
            style={{ background: "var(--melamine)", color: "var(--ink)" }}
          >
            ${total}
          </span>
        </TopBar>

        <div className="flex flex-1 flex-col gap-[13px] px-[18px] py-4">
          {sectionLabel(t("cct.pickFood"))}
          <div className="flex flex-col gap-2.5">
            {CCT_MENU.filter((m) => m.kind === "food").map(row)}
          </div>

          {sectionLabel(t("cct.pickDrinks"))}
          <div className="flex flex-col gap-2.5">
            {CCT_MENU.filter((m) => m.kind === "drink").map(row)}
          </div>

          {sectionLabel(t("cct.tweaks"))}
          <div className="flex flex-wrap gap-2">
            {CCT_TWEAKS.map((k) => {
              const on = tweaks.includes(k);
              return (
                <button
                  key={k}
                  onClick={() => setTweaks((s) => toggle(s, k))}
                  aria-pressed={on}
                  className="min-h-11 rounded-full px-3.5 py-[9px] text-[14px] font-extrabold"
                  style={{
                    background: on ? "var(--sign-red)" : "#fff",
                    color: on ? "#fff" : "var(--ink)",
                    border: `1.5px solid ${on ? "var(--sign-red)" : "var(--rule)"}`,
                  }}
                >
                  {t(`cct.tweak.${k}`)}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setStep("chit")}
            disabled={chosen.length === 0}
            className="press mt-auto flex min-h-14 items-center gap-3 rounded-[16px] px-4 py-3.5 text-start disabled:opacity-40"
            style={{ background: "var(--ink)" }}
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-[11px]"
              style={{ background: "var(--melamine)" }}
            >
              <Pencil className="size-5" aria-hidden strokeWidth={2.4} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="sign-zh text-[16px] text-white">
                {t("cct.writeChit")}
              </span>
              <span className="text-[11.5px] leading-[1.35] text-white/70">
                {t("cct.writeChitSub")}
              </span>
            </span>
          </button>
        </div>
      </Screen>
    );
  }

  // ---------------------------------------------------------- 03 落單紙
  if (step === "chit") {
    return (
      <Screen tone="cct" flush>
        <TopBar variant="cct" title={t("cct.showWaiter")} onBack={onBack} />

        <div className="flex flex-1 flex-col gap-[13px] px-[18px] py-4">
          <p className="text-center text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink-faint">
            {t("cct.holdItUp")}
          </p>

          <OrderChit
            table={t("cct.table").replace("{n}", String(TABLE_NUMBER))}
            seats={t("cct.seats").replace("{n}", "1")}
            items={chitItems}
            total={total}
            totalLabel={t("cct.chitTotal")}
          />

          {/* Your own order, decoded — nobody should have to guess 0T. */}
          <div className="card rounded-[14px] px-3.5 py-[13px]">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
              {t("cct.legendTitle")}
            </p>
            <p className="mt-1.5 text-[13px] font-medium leading-[1.7] text-ink-muted">
              {legend.map((part, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  <strong className="text-ink">{part.term}</strong>
                  {part.gloss ? `＝${part.gloss}` : ""}
                </span>
              ))}
            </p>
          </div>

          <PressButton
            tone="red"
            tall
            onClick={() => speak(orderPhrase.id, orderPhrase.cantonese)}
          >
            <span className="flex items-center justify-center gap-2.5 text-[17px]">
              <Volume2 className="size-5" aria-hidden strokeWidth={2.2} />
              {t("cct.readToWaiter")}
            </span>
          </PressButton>

          <div className="rounded-[16px] p-4 text-center" style={{ background: "var(--ink)" }}>
            <p className="sign-zh text-[24px] leading-[1.35] text-white" lang="zh-HK">
              {orderPhrase.cantonese}
            </p>
            <p className="mt-0.5 text-[12px] leading-[1.4] text-white/70">
              {orderPhrase.jyutping}
            </p>
          </div>

          <div className="mt-auto flex gap-2.5">
            <PressButton
              tone="white"
              className="rounded-[12px] border-[1.5px] shadow-none"
              onClick={() => setStep("slang")}
            >
              <span className="flex items-center justify-center gap-2 text-[15px]">
                <BookOpen className="size-5" aria-hidden strokeWidth={2.2} />
                {t("cct.slangTitle")}
              </span>
            </PressButton>
            <PressButton
              tone="cct"
              className="rounded-[12px]"
              onClick={() => setStep("pay")}
            >
              {t("cct.payTitle")}
            </PressButton>
          </div>
        </div>
      </Screen>
    );
  }

  // ------------------------------------------------------------- 04 術語
  if (step === "slang") {
    return (
      <Screen tone="cct" flush>
        <TopBar variant="cct" title={t("cct.slangTitle")} onBack={onBack}>
          <span
            className="rounded-[5px] px-2.5 py-1.5 text-[11px] font-black"
            style={{ background: "var(--melamine)", color: "var(--ink)" }}
          >
            {t("cct.slangPill")}
          </span>
        </TopBar>

        <div className="flex flex-1 flex-col gap-[13px] px-[18px] py-4">
          {sectionLabel(t("cct.drinkCodes"))}
          <div className="card flex flex-col gap-2.5 rounded-[16px] p-3.5">
            {CCT_CODES.map((c) => (
              <div key={c.code} className="flex items-center gap-3">
                <span
                  className="w-[46px] shrink-0 rounded-[6px] py-[7px] text-center text-[15px] font-black"
                  style={{ background: "var(--ink)", color: "var(--melamine)" }}
                >
                  {c.code}
                </span>
                <span className="text-[13px] leading-[1.4] text-ink-muted">
                  {t(c.key)}
                </span>
              </div>
            ))}
          </div>

          {sectionLabel(t("cct.sayLikeRegular"))}
          <div className="flex flex-col gap-2.5">
            {CCT_SLANG.map((s) => (
              <button
                key={s.id}
                onClick={() => speak(s.id, s.spoken)}
                className={`press card flex min-h-14 items-center gap-3 rounded-[14px] px-3.5 py-3 text-start ${
                  speaking === s.id ? "ring-2 ring-[var(--melamine)]" : ""
                }`}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="sign-zh text-[16px] leading-[1.2]">
                    {s.term}
                  </span>
                  <span className="text-[12px] leading-[1.4] text-ink-muted">
                    {t(`cct.slang.${s.id}`)}
                  </span>
                </span>
                <Volume2
                  className="size-5 shrink-0"
                  style={{ color: "var(--sign-red)" }}
                  aria-hidden
                  strokeWidth={2.2}
                />
              </button>
            ))}
          </div>

          <p className="mt-auto pt-1 text-center text-[11px] font-medium leading-[1.6] text-ink-faint">
            {t("cct.slangCredit")}
          </p>
        </div>
      </Screen>
    );
  }

  // ------------------------------------------------------------- 05 埋單
  return (
    <Screen tone="cct" flush>
      <TopBar variant="cct" title={t("cct.payTitle")} onBack={onBack}>
        {tableChip}
      </TopBar>

      <div className="flex flex-1 flex-col gap-[13px] px-[18px] py-4">
        {/* The bill, still on chit paper. */}
        <div
          style={{
            background: "#fffdf3",
            border: "1px solid #ddd7ce",
            borderRadius: 3,
            padding: "16px 18px",
            boxShadow: "3px 4px 0 0 rgba(20,17,15,.16)",
          }}
        >
          {chosen.map((m, i) => (
            <div
              key={m.id}
              className={`flex items-baseline justify-between gap-3 ${i > 0 ? "mt-2.5" : ""}`}
            >
              <span className="text-[16px] font-bold">
                {t(`cct.item.${m.id}`)}
                {m.kind === "drink" && tweakText ? ` ${tweakText}` : ""}
              </span>
              <span className="shrink-0 text-[16px] font-bold">${m.price}</span>
            </div>
          ))}
          <div
            className="mt-3.5 flex items-baseline justify-between pt-3"
            style={{ borderTop: "2px solid var(--ink)" }}
          >
            <span className="sign-zh text-[17px]">{t("cct.payTotal")}</span>
            <span
              className="text-[34px] font-bold leading-none"
              style={{ color: "var(--sign-red)" }}
            >
              ${total}
            </span>
          </div>
        </div>

        <p className="text-[12px] leading-[1.6] text-ink-muted">
          {t("cct.cashNote")}
        </p>

        {sectionLabel(t("cct.payPhrases"))}
        <div className="flex flex-col gap-2.5">
          {payPhrases.map((p, i) =>
            phraseCard(
              p,
              p.id === "bill-please" ? t("cct.payAtTillShort") : undefined,
              i === 0,
            ),
          )}
        </div>

        <div className="card rounded-[16px] p-3.5">
          <p className="sign-zh text-[14px] leading-[1.3]">
            {t("cct.rulesTitle")}
          </p>
          <div className="mt-2.5 flex flex-col gap-2">
            {CCT_RULES.map((r) => (
              <div key={r} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-1.5 size-1.5 shrink-0 rounded-full"
                  style={{ background: "var(--sign-green)" }}
                />
                <span className="text-[13px] leading-[1.5] text-ink-muted">
                  {t(`cct.rule.${r}`)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-auto pt-1 text-center text-[11px] font-medium leading-[1.6] text-ink-faint">
          {t("cct.spokenBy")}
        </p>
      </div>
    </Screen>
  );
}
