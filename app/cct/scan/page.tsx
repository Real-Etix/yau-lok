"use client";

// 影餐牌 — photograph the menu, order off it (design group 6a).
//
// A 茶餐廳 餐牌 is hand-set Chinese, no pictures, no English, different in
// every shop. No database has it, so the photo becomes the interface: shoot
// the board, get it back as tappable rows in place, and point at what you saw
// on the wall.
//
// Ordering splits in two, and the split is the whole point:
//   揀嘢     — WHAT. Straight off the photo.
//   特別要求 — HOW.  The shorthand a kitchen reads. This is the part a
//              translation app cannot do: the chit must come out as 走冰,
//              not as "no ice".
//
// Two rules run through everything here. A price that was not read is never
// invented — the row says 睇唔清 and asks. And the whole feature degrades to
// CCT_MENU whenever the camera is refused, OCR fails, or the board is
// unreadable, which on real photographs is often.

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Images, Flashlight, Search, Eye, Plus, Pencil } from "lucide-react";
import OrderChit from "@/components/OrderChit";
import { Screen, TopBar, PressButton, Segmented } from "@/components/ui";
import {
  CCT_TWEAK_LIST,
  cctTweak,
  looksLikeDrink,
  type CctTweak,
} from "@/data/cct-phrases";
import {
  recogniseMenu,
  OCR_CONFIDENCE_FLOOR,
  type RecognisedItem,
} from "@/lib/toolhub";
import { putMenuPhoto, getMenuPhoto, deleteMenuPhoto } from "@/lib/menu-photo";
import { useScanDraft, useStored, type OrderLine } from "@/lib/prefs";
import type { LastChit } from "@/lib/home-numbers";
import { speakCantonese } from "@/lib/speech";
import { useT } from "@/lib/i18n";

const TABLE_NUMBER = "12";
const COLD_SURCHARGE = 4;

type Step = "shoot" | "read" | "item" | "chit";

function ScanFlow() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const step = (params.get("step") as Step) ?? "shoot";

  const { draft, setDraft, clearDraft } = useScanDraft();
  const [, setLastChit] = useStored<LastChit | null>("yau-lok-last-chit", null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const go = useCallback(
    (next: Step) => router.push(`/cct/scan?step=${next}`),
    [router],
  );

  // The photo is in IndexedDB; make an object URL for as long as it is shown.
  useEffect(() => {
    if (!draft.photoId) return;
    let url: string | null = null;
    getMenuPhoto(draft.photoId).then((blob) => {
      if (!blob) return;
      url = URL.createObjectURL(blob);
      setPhotoUrl(url);
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [draft.photoId]);

  /** Camera roll and live shot are the same path — a photo is a photo. */
  const takePhoto = useCallback(
    async (file: File) => {
      setBusy(true);
      setFailed(false);
      try {
        if (draft.photoId) await deleteMenuPhoto(draft.photoId);
        const photoId = await putMenuPhoto(file);
        const items = await recogniseMenu(file);
        const good = items.filter((i) => i.confidence >= OCR_CONFIDENCE_FLOOR);
        // A new photo is a new order. Carrying `order` across meant lines from
        // the last board silently piled onto the next one, and nothing in the
        // UI could clear them.
        setDraft({ photoId, items, order: [], editingId: null });
        if (good.length === 0) setFailed(true);
        go("read");
      } catch {
        // No camera, no worker, no readable text — all the same to the user.
        setFailed(true);
        go("read");
      } finally {
        setBusy(false);
      }
    },
    [draft, setDraft, go],
  );

  const confident = draft.items.filter(
    (i) => i.confidence >= OCR_CONFIDENCE_FLOOR,
  );
  /** The design always shows one line the OCR could not resolve. */
  const unreadable = draft.items.find(
    (i) => i.confidence < OCR_CONFIDENCE_FLOOR,
  );
  const visible = query
    ? confident.filter((i) => i.zh.includes(query))
    : confident;

  const editing =
    draft.items.find((i) => i.id === draft.editingId) ??
    (draft.editingId
      ? { id: draft.editingId, zh: draft.editingId, confidence: 100, bbox: { x: 0, y: 0, w: 0, h: 0 } }
      : null);

  const orderTotal = draft.order.reduce((sum, l) => sum + (l.price ?? 0), 0);

  const chitLabel = (line: OrderLine) => {
    const parts = line.tweaks
      .map((id) =>
        id === "custom" ? (line.customChit ?? "") : (cctTweak(id)?.chit ?? ""),
      )
      .filter(Boolean);
    const hot = line.hot ? `${t("scan.hot")} ` : "";
    return `${hot}${line.zh}${parts.length ? ` ${parts.join(" ")}` : ""}`;
  };

  const sectionLabel = (text: string) => (
    <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
      {text}
    </span>
  );

  // ------------------------------------------------------------ 01 影餐牌
  if (step === "shoot") {
    return (
      <Screen fill tone="cabin" flush>
        <div className="flex h-full flex-col" style={{ background: "var(--meter-bg)" }}>
          <div className="flex items-center gap-3 px-4 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))]">
            <button
              onClick={() => router.push("/cct")}
              aria-label="Back"
              className="-ms-1 flex size-11 shrink-0 items-center justify-center text-[22px] font-bold"
              style={{ color: "var(--melamine)" }}
            >
              ‹
            </button>
            <span className="sign-zh flex-1 text-[18px] text-white">
              {t("scan.title")}
            </span>
            {/* The way out. OCR on a real menu often fails; this is not a
                consolation prize, it is the reliable path. */}
            <button
              onClick={() => router.push("/cct")}
              className="min-h-11 text-[12.5px] font-bold"
              style={{ color: "var(--melamine-mint)" }}
            >
              {t("scan.manual")}
            </button>
          </div>

          <div
            className="relative mx-3.5 flex-1 overflow-hidden rounded-[14px]"
            style={{ background: "#1a1512" }}
          >
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="rounded-full px-4 py-2 text-[13px] font-bold"
                  style={{ background: "rgba(0,0,0,.72)", color: "var(--melamine)" }}
                >
                  {t("scan.reading")}
                </span>
              </div>
            )}
            {/* Four corner brackets — the viewfinder is the whole affordance */}
            {(
              [
                { top: 16, left: 16, borderTop: true, borderLeft: true, radius: "4px 0 0 0" },
                { top: 16, right: 16, borderTop: true, borderRight: true, radius: "0 4px 0 0" },
                { bottom: 16, left: 16, borderBottom: true, borderLeft: true, radius: "0 0 0 4px" },
                { bottom: 16, right: 16, borderBottom: true, borderRight: true, radius: "0 0 4px 0" },
              ] as const
            ).map((c, i) => (
              <span
                key={i}
                aria-hidden
                className="absolute size-[34px]"
                style={{
                  top: "top" in c ? c.top : undefined,
                  bottom: "bottom" in c ? c.bottom : undefined,
                  left: "left" in c ? c.left : undefined,
                  right: "right" in c ? c.right : undefined,
                  borderTop: "borderTop" in c ? "4px solid var(--melamine)" : undefined,
                  borderBottom: "borderBottom" in c ? "4px solid var(--melamine)" : undefined,
                  borderLeft: "borderLeft" in c ? "4px solid var(--melamine)" : undefined,
                  borderRight: "borderRight" in c ? "4px solid var(--melamine)" : undefined,
                  borderRadius: c.radius,
                }}
              />
            ))}
            <span
              className="absolute bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-bold"
              style={{
                background: "rgba(0,0,0,.72)",
                color: "var(--melamine)",
                border: "1px solid rgba(245,213,71,.5)",
              }}
            >
              {t("scan.aim")}
            </span>
          </div>

          <div className="flex items-center justify-between px-4 pb-[max(1.6rem,env(safe-area-inset-bottom))] pt-[18px]">
            <button
              onClick={() => libraryRef.current?.click()}
              className="flex size-[52px] flex-col items-center justify-center gap-[3px] rounded-[14px]"
              style={{ border: "1px solid #333" }}
            >
              <Images className="size-5" style={{ color: "#8d857e" }} aria-hidden />
              <span className="text-[8.5px] font-bold" style={{ color: "#8d857e" }}>
                {t("scan.library")}
              </span>
            </button>

            {/* The shutter and the roll need separate inputs. `capture` is not
                a hint a phone can decline — with it set, iOS and Android open
                the camera no matter which control was tapped, so the library
                button needs an input that does not carry it. */}
            <button
              onClick={() => fileRef.current?.click()}
              aria-label={t("scan.shutter")}
              disabled={busy}
              className="flex size-[76px] items-center justify-center rounded-full disabled:opacity-50"
              style={{ border: "4px solid var(--melamine)" }}
            >
              <span
                className="size-[60px] rounded-full"
                style={{ background: "var(--melamine)" }}
              />
            </button>

            <span
              className="flex size-[52px] flex-col items-center justify-center gap-[3px] rounded-[14px] opacity-40"
              style={{ border: "1px solid #333" }}
              title={t("scan.torch")}
            >
              <Flashlight className="size-5" style={{ color: "#8d857e" }} aria-hidden />
              <span className="text-[8.5px] font-bold" style={{ color: "#8d857e" }}>
                {t("scan.torch")}
              </span>
            </span>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) takePhoto(f);
            }}
          />
          <input
            ref={libraryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) takePhoto(f);
            }}
          />
        </div>
      </Screen>
    );
  }

  // -------------------------------------------------------- 02 認到嘅嘢
  if (step === "read") {
    return (
      <Screen tone="cct" flush>
        <TopBar
          variant="cct"
          title={t("scan.readTitle").replace("{n}", String(confident.length))}
          onBack={() => go("shoot")}
        >
          <span
            className="rounded-full px-2.5 py-1.5 text-[11px] font-black"
            style={{ background: "var(--melamine)", color: "var(--ink)" }}
          >
            {t("scan.reshoot")}
          </span>
        </TopBar>

        <div className="flex flex-1 flex-col gap-3 px-3 py-3.5">
          {/* The photo stays on screen and stays tappable. */}
          {photoUrl && (
            <div
              className="relative overflow-hidden rounded-[12px]"
              style={{ background: "#1a1512" }}
            >
              <div className="relative" style={{ transform: "rotate(-0.8deg)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl}
                  alt=""
                  className="block w-full"
                  id="menu-photo"
                />
                {confident.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item.id)}
                    aria-label={item.zh}
                    className="absolute"
                    style={{
                      // Fractions of the source image, so the outline tracks
                      // the photo at whatever size it is rendered.
                      left: `${item.bbox.x * 100}%`,
                      top: `${item.bbox.y * 100}%`,
                      width: `${item.bbox.w * 100}%`,
                      height: `${item.bbox.h * 100}%`,
                      outline:
                        selected === item.id
                          ? "2px solid var(--sign-red)"
                          : "2px solid var(--melamine)",
                      outlineOffset: 3,
                      background:
                        selected === item.id ? "rgba(192,57,45,.1)" : "transparent",
                    }}
                  />
                ))}
              </div>
              <span
                className="absolute bottom-3.5 right-4 rounded-full px-2.5 py-1.5 text-[10.5px] font-bold"
                style={{ background: "rgba(0,0,0,.72)", color: "var(--melamine)" }}
              >
                {t("scan.tapPhoto")}
              </span>
            </div>
          )}

          {/* Nothing readable is a first-class outcome, not an error state. */}
          {failed && (
            <div className="card rounded-[14px] p-3.5">
              <p className="sign-zh text-[15px]">{t("scan.nothingRead")}</p>
              <p className="mt-1 text-[12.5px] leading-[1.6] text-ink-muted">
                {t("scan.nothingReadBody")}
              </p>
              <div className="mt-3 flex gap-2">
                <PressButton
                  tone="white"
                  className="rounded-[12px] border-[1.5px] shadow-none"
                  onClick={() => go("shoot")}
                >
                  {t("scan.reshoot")}
                </PressButton>
                <PressButton
                  tone="cct"
                  className="rounded-[12px]"
                  onClick={() => router.push("/cct")}
                >
                  {t("scan.useManual")}
                </PressButton>
              </div>
            </div>
          )}

          {confident.length > 0 && (
            <>
              <div className="flex gap-2">
                <label
                  className="flex min-h-12 flex-1 items-center gap-2 rounded-[12px] bg-white px-3 py-2.5"
                  style={{ border: "1px solid var(--rule)" }}
                >
                  <Search className="size-4 shrink-0 text-ink-faint" aria-hidden />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
                    placeholder={t("scan.search")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <span
                  className="flex min-h-12 items-center rounded-[12px] px-3 text-[12px] font-black"
                  style={{ background: "var(--melamine-mint)", color: "var(--sign-green)" }}
                >
                  {t("scan.drinksCount").replace("{n}", String(confident.length))}
                </span>
              </div>

              {sectionLabel(t("scan.readOff"))}
              <div className="flex flex-col gap-2.5">
                {visible.map((item) => {
                  const inOrder = draft.order.some((l) => l.itemId === item.id);
                  return (
                    <div
                      key={item.id}
                      className="card flex items-center gap-3 rounded-[14px] px-3 py-[11px]"
                      style={
                        selected === item.id
                          ? { boxShadow: "0 3px 0 0 var(--sign-green)" }
                          : undefined
                      }
                    >
                      <button
                        onClick={() => setSelected(item.id)}
                        className="flex min-w-0 flex-1 flex-col gap-0.5 text-start"
                      >
                        <span className="sign-zh text-[16px] leading-[1.2]">
                          {item.zh}
                        </span>
                        {item.translated && (
                          <span className="text-[12px] leading-[1.35] text-ink-muted">
                            {item.translated}
                          </span>
                        )}
                      </button>
                      {/* A price we never read is never shown as a number. */}
                      <span
                        className="shrink-0 text-[14px] font-black"
                        style={{
                          color: item.price
                            ? "var(--sign-red)"
                            : "var(--ink-faint)",
                        }}
                      >
                        {item.price ? `$${item.price}` : t("scan.noPrice")}
                      </span>
                      <button
                        onClick={() => {
                          setDraft({ ...draft, editingId: item.id });
                          go("item");
                        }}
                        aria-label={item.price ? "＋" : t("scan.fix")}
                        className="flex size-[34px] shrink-0 items-center justify-center rounded-[11px] text-[20px] font-bold"
                        style={{
                          background: inOrder
                            ? "var(--sign-red)"
                            : "var(--tile-cream)",
                          color: inOrder ? "#fff" : "var(--sign-red)",
                        }}
                      >
                        {item.price ? (
                          "＋"
                        ) : (
                          <Pencil className="size-4" aria-hidden strokeWidth={2.4} />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* The one line we could not resolve, named so it cannot be
              confused with anything in the list above. */}
          {unreadable && (
            <button
              onClick={() => {
                setDraft({ ...draft, editingId: unreadable.id });
                go("item");
              }}
              className="flex items-center justify-between gap-3 rounded-[14px] px-3.5 py-3 text-start"
              style={{
                border: "1.5px dashed var(--sign-green)",
                background: "var(--melamine-mint)",
              }}
            >
              <span
                className="text-[12.5px] font-bold leading-[1.5]"
                style={{ color: "var(--sign-green)" }}
              >
                {t("scan.unreadable").replace("{line}", unreadable.zh)}
              </span>
              <span
                className="shrink-0 rounded-[9px] px-2.5 py-1.5 text-[13px] font-black text-white"
                style={{ background: "var(--sign-green)" }}
              >
                {t("scan.fix")}
              </span>
            </button>
          )}

          {/* A draft survives a reload on purpose — a busy 茶餐廳 is no place
              to lose an order to a locked screen. That makes an explicit way
              out of it necessary, not optional. */}
          {draft.order.length > 0 && (
            <button
              onClick={() => {
                if (draft.photoId) deleteMenuPhoto(draft.photoId);
                clearDraft();
                go("shoot");
              }}
              className="min-h-11 text-center text-[12px] font-bold"
              style={{ color: "var(--sign-red)" }}
            >
              {t("scan.startOver")}
            </button>
          )}

          {/* Manual is always one tap away, not only after a failure. */}
          {!failed && (
            <button
              onClick={() => router.push("/cct")}
              className="min-h-11 text-center text-[12px] font-bold"
              style={{ color: "var(--sign-green)" }}
            >
              {t("scan.useManual")}
            </button>
          )}
        </div>

        {draft.order.length > 0 && (
          <div className="sticky bottom-0 mt-auto bg-[var(--tile-cream)] px-3.5 pb-[max(1.6rem,env(safe-area-inset-bottom))] pt-3.5">
            <PressButton tone="red" tall className="rounded-[14px]" onClick={() => go("chit")}>
              <span className="flex items-center justify-center gap-2.5">
                {t("scan.toChit").replace("{n}", String(draft.order.length))}
                <span
                  className="rounded-full px-2.5 py-1 text-[13px] font-black"
                  style={{ background: "rgba(255,255,255,.22)" }}
                >
                  ${orderTotal}
                </span>
              </span>
            </PressButton>
          </div>
        )}
      </Screen>
    );
  }

  // ------------------------------------------------------- 03 特別要求
  if (step === "item" && editing) {
    return (
      <ItemStep
        item={editing}
        onBack={() => go("read")}
        onAdd={(line) => {
          const rest = draft.order.filter((l) => l.itemId !== line.itemId);
          setDraft({ ...draft, order: [...rest, line], editingId: null });
          go("read");
        }}
      />
    );
  }

  // --------------------------------------------------------- 04 落單紙
  return (
    <Screen tone="cabin" flush>
      <div className="flex min-h-dvh flex-col" style={{ background: "var(--sign-green)" }}>
        <TopBar variant="cct" title={t("scan.chitTitle")} onBack={() => go("read")}>
          <span
            className="rounded-full px-2.5 py-1.5 text-[11px] font-black"
            style={{ background: "var(--melamine)", color: "var(--ink)" }}
          >
            {t("scan.addMore")}
          </span>
        </TopBar>

        <div className="flex flex-1 flex-col gap-3 px-4 py-4">
          <OrderChit
            table={`${t("cct.table").replace("{n}", TABLE_NUMBER)}`}
            seats={new Date().toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
            items={draft.order.map((l) => ({
              label: chitLabel(l),
              price: l.price ?? 0,
            }))}
            total={orderTotal}
            totalLabel={t("cct.payTotal")}
          />

          <button
            onClick={() => go("shoot")}
            className="min-h-12 rounded-[13px] px-3.5 py-3 text-[13px] font-bold"
            style={{
              border: "1.5px dashed var(--melamine)",
              color: "var(--melamine)",
            }}
          >
            {t("scan.shootAgainRow")}
          </button>

          {/* The waiter reads the paper; the diner reads this. */}
          <div
            className="rounded-[13px] px-3.5 py-3"
            style={{ background: "rgba(255,255,255,.14)" }}
          >
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/70">
              {t("scan.whatYouOrdered")}
            </p>
            <p className="mt-1.5 text-[13px] leading-[1.6] text-white">
              {draft.order
                .map((l) =>
                  [
                    l.zh,
                    ...l.tweaks.map((id) =>
                      id === "custom"
                        ? (l.customChit ?? "")
                        : t(`cct.tweak.${id}`),
                    ),
                  ]
                    .filter(Boolean)
                    .join(", "),
                )
                .join(" · ")}
            </p>
          </div>

          {/* The cheapest possible fix for getting stuck mid-order. */}
          <div
            className="rounded-[13px] px-3.5 py-3"
            style={{ background: "var(--melamine)" }}
          >
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]">
              {t("scan.theyMayAsk")}
            </p>
            {/* Only a waiter taking a drinks order asks this, and it must
                only change the drinks — 熱 on a plate of rice is not a thing
                anyone has ever been asked. */}
            {draft.order.some((l) => looksLikeDrink(l.zh)) && (
              <AskBack
                question={t("scan.qColdHot")}
                options={[t("scan.cold"), t("scan.hot")]}
                onPick={(i) =>
                  setDraft({
                    ...draft,
                    order: draft.order.map((l) =>
                      looksLikeDrink(l.zh) ? { ...l, hot: i === 1 } : l,
                    ),
                  })
                }
              />
            )}
            <AskBack
              question={t("scan.qEatIn")}
              options={[t("scan.eatIn"), t("cct.tweak.haang-gaai")]}
              onPick={(i) =>
                setDraft({
                  ...draft,
                  order: draft.order.map((l) => ({
                    ...l,
                    tweaks:
                      i === 1
                        ? Array.from(new Set([...l.tweaks, "haang-gaai"]))
                        : l.tweaks.filter((x) => x !== "haang-gaai"),
                  })),
                })
              }
            />
          </div>
        </div>

        <div className="sticky bottom-0 px-4 pb-[max(1.6rem,env(safe-area-inset-bottom))] pt-3">
          <button
            onClick={() => {
              // Showing the waiter is the moment the order becomes real, so
              // that is when the home screen is told about it.
              if (draft.order.length) {
                setLastChit({
                  firstLine: chitLabel(draft.order[0]),
                  total: orderTotal,
                  at: Date.now(),
                });
              }
              speakCantonese("唔該，落單！");
            }}
            className="press flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-[14px] text-[17px] font-black"
            style={{ background: "var(--melamine)", color: "var(--ink)" }}
          >
            <Eye className="size-5" aria-hidden strokeWidth={2.2} />
            {t("scan.showWaiter")}
          </button>
          <p className="mt-2 text-center text-[11px] font-medium text-white/70">
            {t("scan.fullScreenHint")}
          </p>
        </div>
      </div>
    </Screen>
  );
}

/** 伙記可能會問 — one question, two answers, rewrites the chit. */
function AskBack({
  question,
  options,
  onPick,
}: {
  question: string;
  options: [string, string];
  onPick: (index: 0 | 1) => void;
}) {
  const [picked, setPicked] = useState<0 | 1 | null>(null);
  return (
    <div className="mt-2.5 flex items-center gap-2">
      <span className="min-w-0 flex-1 text-[13px] font-bold">{question}</span>
      {options.map((o, i) => (
        <button
          key={o}
          onClick={() => {
            setPicked(i as 0 | 1);
            onPick(i as 0 | 1);
          }}
          className="min-h-11 rounded-full px-3.5 text-[13px] font-black"
          style={{
            background: picked === i ? "var(--ink)" : "rgba(255,255,255,.55)",
            color: picked === i ? "var(--melamine)" : "var(--ink)",
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/** Step 3 lives in its own component so its chip state resets per item. */
function ItemStep({
  item,
  onBack,
  onAdd,
}: {
  item: RecognisedItem;
  onBack: () => void;
  onAdd: (line: OrderLine) => void;
}) {
  const t = useT();
  const [hot, setHot] = useState(false);
  // Tesseract reads prices reliably and hand-set Chinese poorly, so the name
  // is editable too — otherwise the chit goes to the kitchen saying "BER + Bi".
  const [zh, setZh] = useState(item.zh);
  const [tweaks, setTweaks] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  // No price off the photo means the user supplies it — we never guess.
  const [price, setPrice] = useState<string>(item.price ? String(item.price) : "");

  const toggle = (id: string) =>
    setTweaks((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // Read off the editable name, not the raw OCR: correcting a misread line
  // should also correct which questions the screen asks about it.
  const isDrink = looksLikeDrink(zh);

  const base = Number(price) || 0;
  const surcharges = tweaks.reduce(
    (sum, id) => sum + (cctTweak(id)?.surchargeHkd ?? 0),
    0,
  );
  const total =
    base + surcharges + (isDrink && !hot && base ? COLD_SURCHARGE : 0);

  const chitParts = tweaks
    .map((id) => (id === "custom" ? custom : (cctTweak(id)?.chit ?? "")))
    .filter(Boolean);
  const chitLine = `${hot ? `${t("scan.hot")} ` : ""}${zh}${
    chitParts.length ? ` ${chitParts.join(" ")}` : ""
  }`;
  const readBack = [
    item.translated ?? zh,
    ...tweaks.map((id) => (id === "custom" ? custom : t(`cct.tweak.${id}`))),
  ]
    .filter(Boolean)
    .join(", ");

  const group = (g: CctTweak["group"]) =>
    CCT_TWEAK_LIST.filter((x) => x.group === g);

  const sectionLabel = (text: string) => (
    <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
      {text}
    </span>
  );

  return (
    <Screen tone="cct" flush>
      <TopBar variant="cct" title={item.zh} onBack={onBack}>
        <span className="text-[12px] font-black text-white">
          {item.price ? `$${item.price}` : t("scan.priceUnknown")}
        </span>
      </TopBar>

      <div className="flex flex-1 flex-col gap-3 px-[18px] py-4">
        <p className="text-[12px] text-ink-muted">{t("scan.fromYourPhoto")}</p>

        {/* The name as read, always correctable. */}
        <label className="card flex flex-col gap-1.5 rounded-[12px] px-3.5 py-3">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
            {t("scan.fixName")}
          </span>
          <input
            className="min-h-11 bg-transparent text-[18px] font-bold outline-none"
            value={zh}
            onChange={(e) => setZh(e.target.value)}
            lang="zh-HK"
          />
          <span className="text-[11px] leading-[1.4] text-ink-faint">
            {t("scan.nameHint")}
          </span>
        </label>

        {/* When the board's price was unreadable, ask rather than invent. */}
        {!item.price && (
          <label
            className="flex min-h-12 items-center gap-2.5 rounded-[12px] bg-white px-3.5 py-3"
            style={{ border: "1.5px dashed var(--sign-red)" }}
          >
            <span className="text-[13px] font-bold" style={{ color: "var(--sign-red)" }}>
              {t("scan.priceUnknown")}
            </span>
            <input
              inputMode="numeric"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
              placeholder="$"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
            />
          </label>
        )}

        {/* 凍 or 熱 is a question about a drink and nonsense about a plate of
            rice, so it is only asked when the line is one. */}
        {isDrink && (
          <>
            {sectionLabel(t("scan.coldOrHot"))}
            <Segmented
              full
              value={hot ? "hot" : "cold"}
              onChange={(v) => setHot(v === "hot")}
              options={[
                { value: "cold", label: `${t("scan.cold")} ＋$${COLD_SURCHARGE}` },
                { value: "hot", label: t("scan.hot") },
              ]}
            />
          </>
        )}

        {isDrink && sectionLabel(t("scan.howTitle"))}
        <div className={isDrink ? "grid grid-cols-2 gap-2" : "hidden"}>
          {group("drink").map((tw) => {
            const on = tweaks.includes(tw.id);
            return (
              <button
                key={tw.id}
                onClick={() => toggle(tw.id)}
                aria-pressed={on}
                className="flex min-h-12 flex-col gap-[3px] rounded-[12px] px-[11px] py-2.5 text-start"
                style={{
                  background: on ? "var(--melamine)" : "#fff",
                  border: on ? "1.5px solid #c9a800" : "1px solid var(--rule)",
                }}
              >
                <span className="sign-zh text-[15px]">{tw.chit}</span>
                <span className="text-[11px] text-ink-muted">
                  {t(`cct.tweak.${tw.id}`)}
                </span>
              </button>
            );
          })}
        </div>

        {!isDrink && (
          <>
            {sectionLabel(t("scan.withSet"))}
            <ChipRow
              ids={group("set").map((x) => x.id)}
              tweaks={tweaks}
              onToggle={toggle}
            />
          </>
        )}

        {sectionLabel(t("scan.anythingElse"))}
        <ChipRow
          ids={group("extra").map((x) => x.id)}
          tweaks={tweaks}
          onToggle={toggle}
        />
        {tweaks.includes("custom") && (
          <input
            className="min-h-12 rounded-[12px] bg-white px-3.5 text-[15px] outline-none"
            style={{ border: "1.5px dashed var(--sign-red)" }}
            placeholder={t("scan.writeYourOwn")}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        )}

        {/* The payoff: what the kitchen will actually read. */}
        <div className="card rounded-[14px] px-3.5 py-3">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
            {t("scan.readsAs")}
          </p>
          <p
            className="mt-1.5 text-[24px] font-bold leading-[1.2]"
            style={{ color: "var(--sign-red)" }}
            lang="zh-HK"
          >
            {chitLine}
          </p>
          <p className="mt-1 text-[12px] leading-[1.4] text-ink-muted">{readBack}</p>
        </div>
      </div>

      <div className="sticky bottom-0 mt-auto bg-[var(--tile-cream)] px-[18px] pb-[max(1.6rem,env(safe-area-inset-bottom))] pt-3">
        <PressButton
          tone="red"
          tall
          className="rounded-[14px]"
          disabled={!price || !zh.trim()}
          onClick={() =>
            onAdd({
              itemId: item.id,
              zh,
              tweaks,
              customChit: custom || undefined,
              price: total,
              hot,
            })
          }
        >
          <span className="flex items-center justify-center gap-2.5">
            <Plus className="size-5" aria-hidden strokeWidth={2.4} />
            {t("scan.addToChit")}
            {price && (
              <span
                className="rounded-full px-2.5 py-1 text-[13px] font-black"
                style={{ background: "rgba(255,255,255,.22)" }}
              >
                ${total}
              </span>
            )}
          </span>
        </PressButton>
      </div>
    </Screen>
  );
}

function ChipRow({
  ids,
  tweaks,
  onToggle,
}: {
  ids: string[];
  tweaks: string[];
  onToggle: (id: string) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => {
        const tw = cctTweak(id);
        const on = tweaks.includes(id);
        const dashed = tw?.custom;
        return (
          <button
            key={id}
            onClick={() => onToggle(id)}
            aria-pressed={on}
            className="min-h-11 rounded-full px-3.5 py-[9px] text-[13.5px] font-extrabold"
            style={{
              background: on ? "var(--sign-red)" : "#fff",
              color: on ? "#fff" : dashed ? "var(--sign-red)" : "var(--ink)",
              border: on
                ? "1px solid var(--sign-red)"
                : dashed
                  ? "1px dashed var(--sign-red)"
                  : "1px solid var(--rule)",
            }}
          >
            {dashed ? t("scan.writeYourOwn") : tw?.chit}
            {tw?.surchargeHkd ? ` ＋$${tw.surchargeHkd}` : ""}
          </button>
        );
      })}
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={null}>
      <ScanFlow />
    </Suspense>
  );
}
