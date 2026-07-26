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
    href: "#",
    emoji: "🏥",
    title: "Clinic & counters",
    subtitle: "Queue tickets, forms, and turn-taking phrases",
    live: false,
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <header className="pt-8 text-center">
        <h1 className="text-5xl font-black tracking-tight">有落!</h1>
        <p className="mt-1 text-xl font-semibold text-slate-700">Yau Lok!</p>
        <p className="mt-3 text-sm text-slate-500">
          A situated Cantonese copilot for Hong Kong — it knows where you are,
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
            className={`flex items-center gap-4 rounded-2xl border border-slate-200 p-4 transition ${
              s.live
                ? "bg-white shadow-sm active:scale-95"
                : "pointer-events-none opacity-50"
            }`}
          >
            <span className="text-3xl">{s.emoji}</span>
            <span>
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
          </Link>
        ))}
      </section>

      <footer className="mt-auto pb-4 text-center text-xs text-slate-400">
        Powered by HKGAI Studio (Modelhub · Toolhub · Agenthub) + HK open
        government transport data
      </footer>
    </main>
  );
}
