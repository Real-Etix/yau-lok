"use client";

// §5/07 — 我的路線 Saved routes.

import { useEffect, useState } from "react";
import { Star, Download, Plus } from "lucide-react";
import Link from "next/link";
import LedBoard from "@/components/LedBoard";
import { Screen, TopBar, Card, SectionLabel } from "@/components/ui";
import { useSavedRoutes, type SavedRoute } from "@/lib/prefs";
import { getRouteEta } from "@/lib/toolhub";
import { useT, useBilingual } from "@/lib/i18n";

type EtaMap = Record<string, number[]>;

export default function SavedPage() {
  const t = useT();
  const { saved, recent, toggle } = useSavedRoutes();
  const bi = useBilingual();
  const [etas, setEtas] = useState<EtaMap>({});

  // Live arrivals for saved routes. Failures stay silent — the offline
  // promise means the list must render regardless.
  useEffect(() => {
    let cancelled = false;
    saved.forEach(async (r) => {
      if (!r.originLat || !r.originLng) return;
      try {
        const eta = await getRouteEta(
          { routeId: r.id, routeCode: r.routeCode, company: r.company },
          r.originLat,
          r.originLng,
        );
        if (!cancelled && eta) {
          setEtas((m) => ({
            ...m,
            [r.id]: eta.etaMinutes.map((n) => Math.max(1, n)),
          }));
        }
      } catch {
        /* offline is a supported state here */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [saved]);

  return (
    <Screen tone="cream" flush>
      <TopBar
        variant="brand"
        title={t("saved.title")}
        subtitle={t("saved.subtitle").replace("{n}", String(saved.length))}
      />

      <div className="flex flex-col gap-3 px-4 pt-3">
        {saved.length === 0 && (
          <Card className="rounded-[18px]">
            <p className="text-[14px] text-ink-muted">{t("saved.empty")}</p>
          </Card>
        )}

        {saved.map((r) => {
          const mins = etas[r.id];
          const live = mins && mins.length > 0;
          return (
            <Card key={r.id} raised={!!live} className="rounded-[18px] p-3">
              <div className="flex items-start gap-3">
                <LedBoard size="chip" primary={r.routeCode} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="sign-zh text-[15px]">
                    {bi(r.from)} → {bi(r.to)}
                  </p>
                  {r.note && (
                    <p className="mt-0.5 text-[13px] text-ink-muted">{r.note}</p>
                  )}
                </div>
                <button
                  onClick={() => toggle(r)}
                  aria-label={t("ride.saved")}
                  className="-m-2 flex size-11 items-center justify-center"
                >
                  <Star
                    className="size-5"
                    style={{ color: "var(--sign-amber)" }}
                    fill="var(--sign-amber)"
                    aria-hidden
                  />
                </button>
              </div>

              {/* §5/07: the strip only exists when there is something in it —
                  a live arrival, or at least a fare. */}
              {(live || r.fare != null) && (
                <div
                  className="mt-2.5 flex items-center justify-between gap-2 rounded-[11px] px-3 py-2.5 text-[13px]"
                  style={{
                    background: live ? "var(--brand-soft)" : "var(--body-cream)",
                  }}
                >
                  <span
                    className="font-bold"
                    style={{
                      color: live ? "var(--brand-deep)" : "var(--ink-muted)",
                    }}
                  >
                    {live
                      ? t("saved.nextIn").replace("{n}", String(mins[0]))
                      : t("saved.noEta")}
                  </span>
                  <span
                    className="shrink-0 text-[12px] font-semibold"
                    style={{
                      color: live ? "var(--brand)" : "var(--ink-faint)",
                    }}
                  >
                    {r.fare != null && `HK$${r.fare.toFixed(1)}`}
                    {r.fare != null && r.minutes != null && " · "}
                    {r.minutes != null && `${r.minutes} min`}
                  </span>
                </div>
              )}
            </Card>
          );
        })}

        {recent.length > 0 && (
          <>
            <SectionLabel>{t("saved.recent")}</SectionLabel>
            <Card className="rounded-[18px] p-2">
              {recent.map((r, i) => (
                <div
                  key={r.id + i}
                  className={`flex items-center gap-3 px-1 py-2.5 ${
                    i > 0 ? "border-t border-[var(--rule)]" : ""
                  }`}
                >
                  <LedBoard size="chip" primary={r.routeCode} className="shrink-0" />
                  <p className="min-w-0 flex-1 truncate text-[14px]">
                    {bi(r.from)} → {bi(r.to)}
                  </p>
                  {r.note && (
                    <span className="shrink-0 text-[13px] text-ink-faint">
                      {r.note}
                    </span>
                  )}
                </div>
              ))}
            </Card>
          </>
        )}

        <p
          className="flex items-start gap-2 rounded-[14px] p-3 text-[13px]"
          style={{
            background: "var(--brand-soft)",
            border: "1px dashed var(--brand)",
            color: "var(--brand)",
          }}
        >
          <Download className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("saved.offlineNote")}
        </p>
      </div>

      {/* Bottom bar, same ink-topped white bar as screen 03 */}
      <div
        className="sticky bottom-0 mt-auto bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
        style={{ borderTop: "2.5px solid var(--ink)" }}
      >
        {/* A link, not a button in a link — anchors can't nest interactive content */}
        <Link
          href="/ride"
          className="press flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--brand)] px-4 py-3.5 text-center font-bold text-white shadow-[0_4px_0_0_var(--brand-deep)]"
        >
          <Plus className="size-5" aria-hidden />
          {t("saved.add")}
        </Link>
      </div>
    </Screen>
  );
}
