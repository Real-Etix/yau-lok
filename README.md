# 有落! Yau Lok! — Situated Cantonese Copilot

Hackathon prototype for **Firebird Hackathon Track 2 (HKGAI · 港話通)**.

Translators answer when you ask. **Yau Lok knows when you're about to miss
your stop.** It fuses GPS + Hong Kong open transport data + HKGAI's Cantonese
models to speak up at the right moment — and coaches you so you need it less
over time (human-AI symbiosis, not replacement).

## The hero scenario: red minibus

No stop announcements, no bell — you must shout 「唔該，有落！」 at the right
moment. The app:

1. Pick your route, **get-on and get-off stops**; live ETA shows the next
   minibus at your boarding stop (Toolhub `transit_eta`) — pinned on the
   map, with a spoken 「車嚟喇！」 alert when it's ≤1 min away. No guessed
   bus positions: the GMB feed has ETAs, not vehicle GPS, so pre-boarding
   is honestly ETA-driven.
2. Tap **"I'm on board"** — now the phone IS on the vehicle, so tracking is
   real GPS on a **live map** (Leaflet + OSM) along the actual route line.
   Demo mode replays a ride at 20 km/h, ×12 time-lapse (labelled).
3. Alerts you 400 m before your stop (vibration + Cantonese chime)
4. **Speaks for you** — one giant button plays a loud, colloquial 「有落！」
   in your chosen **voice persona** (6 HKGAI Cantonese voices, incl.
   tts-v2's 暖心師奶 / 金牌阿Sir presets; all phrases pre-rendered per voice)
5. **Listens to the driver** and translates the reply, suggesting a response
6. **Says anything** — **speak or type** any sentence in English and HKGAI
   rewrites it as colloquial Cantonese (with Jyutping, a back-translation,
   and a politeness note), then speaks it aloud. The phrase pack covers
   predictable moments; this covers the rest. The voice path is a full
   HKGAI round trip: their ASR hears your English (verified), their chat
   model localises it, their TTS speaks it.
7. **Coaches** — Jyutping shown on every phrase so you learn to shout it yourself

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
   ├─ /api/say  → HKGAI Modelhub chat ✅ LIVE
   │    free text → spoken Cantonese + jyutping + back-translation + tip,
   │    piped straight into /api/tts (the "AI keyboard" for the street)
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

## Toolhub tools in use

- `transit_route_detail` — route-code input → real stops + coordinates
- `transit_eta` — live "next minibus at your stop: 0, 4, 9 min" line,
  refreshed every 30 s (matches by route_id, falls back to code+operator;
  empty outside service hours)
- `transit_route_search` — validated, available for a route-picker UI

## Done (was the TODO list)

- [x] Mic flow records 4 s → 16 kHz WAV → HKGAI `speech_recognize`
      (`/api/asr`), browser SpeechRecognition as fallback. Round-trip
      verified: HKGAI TTS audio → HKGAI ASR → 「唔該前面巴士站有樓」
- [x] TTS latency measured (0.5–2.2 s/phrase) → all 8 phrases pre-generated
      into `public/audio/` by `scripts/generate-phrase-audio.mjs`; playback
      order is cached file → live API → browser voice
- [x] `transit_eta` wired into the ride screen
- [x] Voice audition: rerun `node scripts/generate-phrase-audio.mjs tts-v2 male`
      (or set HKGAI_TTS_MODEL / HKGAI_TTS_VOICE) after picking a voice

## Remaining ideas

- [ ] Re-record phrase pack with the chosen voice
- [ ] Hot-word boost: pass 有落/落車 via `config.hot_keys` tuning in /api/asr
- [ ] Weather tool ("bring an umbrella before you board")

## Judging-criteria mapping

- **Originality** — proactive + situated, not another translator
- **Feasibility** — runs on real GMB open data today; thin client on HKGAI stack
- **Quantifiable impact** — HK's non-Cantonese residents × daily minibus trips
- **Ecosystem** — Modelhub for speech/chat, Toolhub (MCP) for data, deployable
  as a GangHuaTong scenario pack
