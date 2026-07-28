import Link from "next/link";

const SCENARIOS = [
  {
    href: "/ride",
    emoji: "🚐",
    title: "Minibus ride",
    subtitle: "Know when to shout 有落 — or let the app shout for you",
    live: true,
  },
  {
    href: "#",
    emoji: "🍜",
    title: "Cha chaan teng",
    subtitle: "Point at a menu, order like a local",
    live: false,
  },
  {
    href: "/clinic",
    emoji: "🏥",
    title: "Clinic & counters",
    subtitle: "Say what's wrong, and see where the A&E wait is shortest",
    live: true,
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <header className="pt-10 text-center">
        <p className="text-6xl font-black leading-none tracking-tight text-red-600">
          有落!
        </p>
        <h1 className="mt-2 text-2xl font-bold">Yau Lok!</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          A situated Cantonese copilot for Hong Kong. It knows where you are,
          speaks up at the right moment, and teaches you the phrase so next
          time you won&apos;t need it.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        {SCENARIOS.map((s) => (
          <Link
            key={s.title}
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
                {s.title}
                {!s.live && (
                  <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                    soon
                  </span>
                )}
              </span>
              <span className="block text-sm text-slate-500">{s.subtitle}</span>
            </span>
            {s.live && (
              <span className="ml-auto text-xl text-slate-300">›</span>
            )}
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
        <p className="font-semibold">Why not just a translator?</p>
        <p className="mt-1 leading-relaxed text-slate-600">
          Translators answer when you ask. Yau Lok knows{" "}
          <span className="font-medium text-slate-900">when</span> to speak —
          it tracks the route, alerts you before your stop, and shouts in
          colloquial Cantonese so the driver actually stops.
        </p>
      </section>

      <footer className="mt-auto pb-4 text-center text-xs leading-relaxed text-slate-400">
        Cantonese speech &amp; translation by HKGAI Modelhub · routes and live
        arrivals via HKGAI Toolhub &amp; HK open government data
      </footer>
    </main>
  );
}
