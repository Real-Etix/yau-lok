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

## Architecture (all HKGAI endpoints live)

```
Phone PWA (Next.js 16, app router)
   ├─ Context engine (ours): GPS × route stops → approach/arrive triggers
   │     ├─ /api/toolhub proxy → HKGAI Toolhub REST ✅ LIVE
   │     │    transit_route_detail: type a GMB code, get real stops+coords
   │     └─ /api/gmb proxy → data.etagmb.gov.hk (gov open data, fallback)
   ├─ /api/chat → HKGAI Modelhub chat (t2_hkgai-v3_fp8_1m_e7) ✅ LIVE
   │    driver-reply translation + suggested colloquial response
   ├─ /api/tts  → HKGAI openspeech tts-v1 Cantonese ✅ LIVE
   │    POST {host}/server_proxy/api/v1/audio/speech → WAV
   │    (browser zh-HK voice as automatic fallback)
   ├─ /api/asr  → HKGAI speech_recognize proxy (wired; client still uses
   │    browser SpeechRecognition — see TODO in app/api/asr/route.ts)
   └─ Coach layer: phrase pack with Jyutping (data/phrases.ts)
```

Toolhub also exposes transit ETA/fares, geo search, weather, parking, and
A&E waiting times — same `/api/toolhub/<tool-path>` proxy reaches all of
them (base https://toolhub.prod.hkchat.app/v1, App-Name/App-Key headers).

## Remaining team TODOs

- [ ] Switch `listenCantonese()` in `lib/speech.ts` to MediaRecorder +
      `/api/asr` (HKGAI Cantonese ASR) instead of browser SpeechRecognition
- [ ] Measure TTS latency on venue Wi-Fi; pre-generate the 7 core phrases as
      cached audio if slow
- [ ] Wire `transit_eta` (Toolhub) into the status card ("next minibus in 4 min")
- [ ] Try `tts-v2` / male voice; pick what sounds most natural shouted

## Judging-criteria mapping

- **Originality** — proactive + situated, not another translator
- **Feasibility** — runs on real GMB open data today; thin client on HKGAI stack
- **Quantifiable impact** — HK's non-Cantonese residents × daily minibus trips
- **Ecosystem** — Modelhub for speech/chat, Toolhub (MCP) for data, deployable
  as a GangHuaTong scenario pack
