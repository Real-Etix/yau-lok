# 有落 Yau Lok — demo video proposal
**3–5 min · MP4/H.264 · 1920×1080 landscape · under 300 MB**

Target length **4:10**. Landscape, because judges review on laptops.

---

## The one rule

**Completeness is a judging criterion — "现场能跑起来的作品".** So the spine of
this video is *real screen recording of the real app*. Generative AI does the
voiceover, the establishing shots, the subtitles and the thumbnail. It does
**not** generate the product. A judge who suspects the UI was rendered rather
than recorded will mark you down on the one criterion you'd otherwise win.

---

## Storytelling: one rider, one day

Don't demo four features. Follow **one person through one day** and let the
features fall out of it. This is what makes a 4-minute video watchable and
what makes the utility argument land without you asserting it.

**Character:** Sari, an Indonesian domestic helper, four months in Hong Kong.
She reads Bahasa. She can't read the 車頭牌 and can't shout 有落.

| Beat | Time | What happens |
|---|---|---|
| **0:00 Cold open** | 0:15 | A green minibus flies past a stop. Someone's hand goes half-up and drops. The bus is gone. No narration yet — just street noise. Then: 有落. |
| **1 The problem** | 0:30 | Sari on a minibus, phone out, looking at a translate app. Voiceover names it: *a translation app answers, it never speaks first.* |
| **2 The minibus** | 1:10 | She opens Yau Lok. Picks the route. **Screen recording**: waiting countdown → boarding → map tracking → the alert fires → she presses the red button → **the phone shouts 唔該，有落** and the driver pulls in. This is the emotional peak. Let the Cantonese audio play clean, no music under it. |
| **3 The taxi** | 0:35 | Later, rain. She holds the yellow 膠牌 up to a driver. The meter runs on screen beside the real one. |
| **4 The clinic** | 0:35 | Her employer's child is sick. A&E waits from the HA feed; she holds up 我唔識講廣東話 at the counter. |
| **5 The menu** | 0:45 | Cha chaan teng. She photographs the 餐牌; the app outlines the lines; she taps 檸茶, adds 走冰 少甜; the chit prints on screen; she hands the phone to the waiter. |
| **6 What it's built on** | 0:25 | Fast architecture beat: Modelhub text + speech, Toolhub, Agenthub. Ten seconds, no lingering. |
| **7 Close** | 0:15 | Back to the LED board. 唔識講，唔使驚 —— 有落幫你講. URL + QR. |

**Why this order:** the minibus gets the most time because it's the product's
reason to exist. The other three are 35–45s each — enough to prove breadth,
not enough to bore.

---

## What to film (real footage)

Half a day of shooting. Phone camera is fine — 4K if you have it, so you can
punch in during the edit.

**Priority A — you cannot fake these**
1. **A green minibus arriving, and pulling away.** Shek Pai Wan or any GMB
   terminus. Get 3–4 takes, including one from inside looking out.
2. **Riding on a minibus**, phone in hand, over-the-shoulder. Ask permission.
3. **A taxi interior** — the real 咪錶 in frame, ideally next to the phone
   showing yours. This side-by-side is the single most persuasive shot you can get.
4. **A cha chaan teng 餐牌 on the wall**, and a hand holding a phone up to it.
   Get a *hard* one — angled, fluorescent-lit, hand-set — and show it working.
   A perfect flat menu looks staged.

**Priority B — nice to have**
5. Street ambience: Aberdeen, Wan Chai, a wet market.
6. A counter at a clinic (no patients in frame — do not film anyone identifiable).
7. Hands: pressing the red button, holding the phone up to a driver.

**Priority C — screen recordings (record these last, once you know the cuts)**
- iPhone screen recording of each flow, done slowly and deliberately.
- **Record in the interface language of your character** — Bahasa Indonesia
  for Sari's scenes. Judges seeing Indonesian UI is worth a paragraph of
  narration about the nine languages.
- Turn on the demo-ride mode for the tracking beat so the bus moves at ×12 and
  the alert fires inside 30 seconds. Say "simulated" in a subtitle — it's
  honest and nobody minds.

**Prepare before shooting**
- Save a route so the home dashboard has a real ETA, not an em dash.
- Do one taxi plan so the taxi tile shows a fare, not the flagfall.
- Do one menu order so the 茶餐廳 tile shows 0T 走冰 rather than 未落過單.
- Charge the phone, set Do Not Disturb, hide notifications.
- **Clean the status bar** — full battery, no carrier clutter.

**Consent and privacy:** get verbal consent from the minibus and taxi driver
before filming inside. Don't film other passengers' faces. Don't film a real
patient or a real hospital queue — stage the counter beat or shoot it empty.

---

## How to use generative AI

Use it where it saves hours and can't hurt credibility.

### 1. Voiceover — use HKGAI's own TTS
The strongest move available. Your narration is English or Bahasa; the
**in-app Cantonese lines are already spoken by HKGAI Modelhub speech**. Record
those straight off the device so the voice in the video is literally the
product's voice.

For the English narration, either record yourself (more authentic, and a human
voice reads as more confident) or use ElevenLabs / your OS TTS. If you use
HKGAI's TTS for a Cantonese narration track too, **say so on screen** — "旁白
由 HKGAI 港話通讀出" is a free credibility point on the enterprise track.

### 2. Script → storyboard
Paste the beat table above into any LLM and ask for a **shot list with
durations and a matching subtitle file**. Then cut to the subtitles rather
than writing them afterwards — it keeps you honest about the 4-minute limit.

### 3. B-roll you can't shoot
If you're short of street footage, text-to-video (Runway, Pika, Sora, Kling)
can produce **establishing shots only** — traffic, rain on a window, a neon
street. Rules:
- **Never** generate the app, a phone screen, or a person's face doing something.
- Keep generated clips under 3 seconds and away from the product beats.
- Colour-grade them to match your real footage or the cut will look glued together.

### 4. Subtitles and translation
Whisper (or your editor's auto-captions) for the transcript, then an LLM to
produce Traditional Chinese and English subtitle tracks. **Burn in at least
one** — many judges watch muted first.

### 5. Thumbnail
16:9, ≤20 MB. Simplest strong option: a real photo of a hand holding the phone
with the red 唔該，有落！ button filling the screen, in front of a green
minibus. If you generate it, generate the *background* and composite a real
screenshot on top — a fabricated UI in the thumbnail is the same credibility
risk as in the video.

### 6. Editing
CapCut or Descript. Descript is worth it here: edit the video by editing the
transcript, and its filler-word removal will tighten a rushed voiceover fast.

---

## Production order (one day)

1. **Morning** — write and lock the voiceover script to 4:10. Time it by
   reading aloud; scripts always run long.
2. Prepare the app state (saved route, taxi plan, one chit).
3. **Midday** — shoot Priority A on location. Minibus first, while you have light.
4. **Afternoon** — screen recordings at a desk, in Bahasa, unhurried.
5. Generate voiceover; cut picture to voice.
6. Add subtitles, the architecture beat, the end card with the QR.
7. **Export 1920×1080 H.264, check it's under 300 MB**, watch it once muted.

---

## Two things that will cost you marks if you skip them

- **Show a failure recovering.** Let the OCR misread one line, then tap 改 and
  fix it. Ten seconds. It converts your weakest technical point into evidence
  of judgement — and if a judge tests it live and sees a wrong reading, you've
  already told them what to do about it.
- **Show the language switch.** One tap, the whole interface becomes Bahasa or
  Urdu. It's the cheapest, most visible proof of the utility claim in slide 3.
