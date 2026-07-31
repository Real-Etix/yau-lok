"use client";

import Link from "next/link";
import LanguagePicker from "@/components/LanguagePicker";
import { useT } from "@/lib/i18n";

const SCENARIOS = [
  { href: "/ride", emoji: "🚐", key: "minibus", live: true },
  { href: "/taxi", emoji: "🚕", key: "taxi", live: true },
  { href: "/clinic", emoji: "🏥", key: "clinic", live: true },
  { href: "#", emoji: "🍜", key: "chachaanteng", live: false },
];

export default function Home() {
  const t = useT();
  return (
    <main className="mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-col gap-6 overflow-x-hidden p-6">
      <header className="pt-10 text-center">
        <p className="text-6xl font-black leading-none tracking-tight text-red-600">
          有落!
        </p>
        <h1 className="mt-2 text-2xl font-bold">Yau Lok!</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {t("app.tagline")}
        </p>
      </header>

      <LanguagePicker hint />

      <section className="flex flex-col gap-3">
        {SCENARIOS.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            aria-disabled={!s.live}
            tabIndex={s.live ? undefined : -1}
            className={`flex items-center gap-4 rounded-2xl border p-4 transition ${
              s.live
                ? "border-slate-200 bg-white shadow-sm active:scale-95"
                : "pointer-events-none border-slate-200/70 bg-white/50 opacity-60"
            }`}
          >
            <span className="text-3xl">{s.emoji}</span>
            <span className="min-w-0">
              <span className="block font-semibold">
                {t(`home.${s.key}`)}
                {!s.live && (
                  <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {t("home.soon")}
                  </span>
                )}
              </span>
              <span className="block text-sm text-slate-500">
                {t(`home.${s.key}Sub`)}
              </span>
            </span>
            {s.live && (
              <span className="ms-auto text-xl text-slate-300">›</span>
            )}
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
        <p className="font-semibold">{t("home.whyTitle")}</p>
        <p className="mt-1 leading-relaxed text-slate-600">
          {t("home.whyBody")}
        </p>
      </section>

      <footer className="mt-auto pb-4 text-center text-xs leading-relaxed text-slate-400">
        {t("home.credits")}
      </footer>
    </main>
  );
}
