# 有落! Yau Lok! — Situated Cantonese Copilot

Hackathon prototype for **Firebird Hackathon Track 2 (HKGAI · 港話通)**.

Translators answer when you ask. **Yau Lok knows when you're about to miss
your stop.** It fuses GPS + Hong Kong open transport data + HKGAI's Cantonese
models to speak up at the right moment — and coaches you so you need it less
over time (human-AI symbiosis, not replacement).

## The hero scenario: red minibus

No stop announcements, no bell — you must shout 「唔該，有落！」 at the right
moment. The app:

1. Tracks your position against the minibus route (GMB open data)
2. Alerts you 400 m before your stop (vibration + Cantonese chime)
3. **Speaks for you** — one giant button plays a loud, colloquial 「有落！」
4. **Listens to the driver** and translates the reply, suggesting a response
5. **Coaches** — Jyutping shown on every phrase so you learn to shout it yourself

## Run it

```bash
npm install
cp .env.example .env.local   # fill in HKGAI Studio credentials
npm run dev
```

Open http://localhost:3000 → "Minibus ride". **Demo mode** (default) simulates
a ride along the route so the full journey works indoors — perfect for the
2-minute pitch demo. Toggle to **Live GPS** on a phone for the real thing.

Everything degrades gracefully before keys are set: TTS falls back to the
browser's zh-HK voice, and translation returns a stub. So the UI is fully
demoable from minute zero.

## Architecture

```
Phone PWA (Next.js 16, app router)
   ├─ Context engine (ours): GPS × GMB route → approach/arrive triggers
   │     └─ data: /api/gmb proxy → data.etagmb.gov.hk (HK gov open data)
   │        TODO: switch to HKGAI Toolhub (MCP) if it exposes transit data
   ├─ /api/chat  → HKGAI Modelhub (OpenAI-compatible) — driver-reply translation
   ├─ /api/tts   → HKGAI Modelhub speech (falls back to browser zh-HK voice)
   └─ Coach layer: phrase pack with Jyutping (data/phrases.ts)
```

## Day-1 checklist (before building more UI)

- [ ] Fill in Modelhub speech endpoint in `app/api/tts/route.ts` (see TODO)
- [ ] Test Cantonese TTS latency — if > ~2 s, pre-generate the 7 core phrases
      as cached audio files at build time
- [ ] Test ASR on noisy colloquial Cantonese (minibus engine background)
- [ ] Check whether Toolhub exposes GMB routes/ETA — swap `lib/gmb.ts` if so
- [ ] Replace `data/demo-route.ts` with a real route fetched via `lib/gmb.ts`
      (e.g. `getRouteIds("HKI", "5")` → `getRouteStops(id, 1)`)

## Judging-criteria mapping

- **Originality** — proactive + situated, not another translator
- **Feasibility** — runs on real GMB open data today; thin client on HKGAI stack
- **Quantifiable impact** — HK's non-Cantonese residents × daily minibus trips
- **Ecosystem** — Modelhub for speech/chat, Toolhub (MCP) for data, deployable
  as a GangHuaTong scenario pack
