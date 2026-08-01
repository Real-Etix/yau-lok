# 有落 Yau Lok — 10-page deck script
**Firebird Hackathon · Enterprise Track (Pod.B) · HKGAI 港話通**

Submission rules this deck obeys: **PPTX, max 10 pages.** Judged on
**Creativity** (够不够新、够不够大胆), **Completeness** (现场能跑起来的作品),
**Utility** (真的有人会用). Every slide below is built to score one of those
three — the map is in the right-hand column.

Live demo: **https://yau-lok.vercel.app**

---

## 1 — 有落

**On the slide**
Full-bleed black LED destination board, amber dot-matrix 有落 / YAU LOK!.
One line under it: **知你幾時要落車 —— 唔使開口都落到車。**
Bottom corner, small: Firebird Hackathon · HKGAI 港話通.

**Say (20s)**
> "In Hong Kong, the green minibus has no bell and no stop announcements. You
> have to shout — in Cantonese — at the right moment. Miss it and you're
> walking back. This is the app for the moment you can't."

**Why it scores** — Creativity. Open on the object, not a logo. The judges
should recognise the 車頭牌 before you say a word.

---

## 2 — The problem is not translation

**On the slide**
Two columns.
Left, greyed: **翻譯 app** — 你要知道問乜、幾時問、點問. A phone showing a
generic translate box.
Right, in brand green: **有落** — 佢知你幾時要落車，主動幫你講.
Under both, one sentence: **A translation app answers. It never speaks first.**

**Say (30s)**
> "Every translation app on the market is reactive. You must already know what
> to ask, and when. The hard moments in Hong Kong aren't vocabulary problems —
> they're timing problems. Knowing the stop is next. Knowing the meter should
> be running. Knowing what 0T means before the waiter walks away.
> Yau Lok is the first one that speaks first."

**Why it scores** — Creativity + Utility. This is the whole thesis. If a judge
remembers one slide, make it this one.

---

## 3 — Who it's for

**On the slide**
Three faces/photos with one line each:
- **370,000+ domestic helpers** — Indonesian, Filipino, Thai
- **Non-Chinese-speaking residents** — Nepali, Urdu, Hindi
- **Visitors and new arrivals** — Mandarin, English
One statistic in large type: **9 interface languages, 579 translated strings.**

**Say (25s)**
> "This isn't a tourist toy. Hong Kong has hundreds of thousands of residents
> who ride the same minibus every day and still can't shout for their stop.
> The app ships in nine languages — including Urdu right-to-left — because
> that's who is actually standing at the kerb."

**Why it scores** — Utility. Names a real, large, underserved population.

---

## 4 — Four moments, four liveries

**On the slide**
The home dashboard screenshot, large, with four callouts:
綠色小巴 · 的士 · 睇醫生 · 茶餐廳.
Caption: **每個場景著返自己嗰件衫 —— 未讀字已經知自己喺邊。**

**Say (30s)**
> "Four situations where not speaking Cantonese costs you money, time, or
> safety. Each one wears its own real object: the minibus LED board, the taxi
> meter, the ambulance's battenburg stripe, the cha chaan teng order chit.
> You know which world you're in before you read a word."

**Why it scores** — Creativity. Design as function, not decoration.

---

## 5 — The minibus: it shouts for you

**On the slide**
Three screens in a row: waiting (mm:ss LED countdown) → riding (map + next
stop board) → the alert takeover (就到喇！準備落車) with the red 唔該，有落！
button. Arrow between them.

**Say (35s)**
> "GPS tracks you along the route the bus actually drives — not straight-line
> distance, which false-fires in the Aberdeen Tunnel. Four hundred metres
> before your stop it vibrates, chimes, and puts one red button on screen.
> Press it and an HKGAI Cantonese voice shouts 唔該，有落 for you.
> You never have to open your mouth."

**Why it scores** — Completeness + Utility. This is the product in one screen.

---

## 6 — The other three

**On the slide**
Three columns, one screenshot each:
- **的士** — the 咪錶 running live, and the yellow 膠牌 you hold up to the driver
- **睇醫生** — A&E waits from the Hospital Authority, and 我唔識講廣東話 on an ambulance plate
- **茶餐廳** — photograph the 餐牌, order off the photo, hand over a 落單紙

**Say (35s)**
> "A taxi meter you can read from the back seat, so you know when the fare
> stops making sense. Live A&E waiting times, and a plate you hold up at the
> counter. And the one a database can't solve: photograph the menu, and the
> app reads it back as buttons — then writes your order in the shorthand the
> kitchen actually reads. 0T 走冰 少甜."

**Why it scores** — Creativity. The menu scan is the boldest idea in the deck.

---

## 7 — Built on HKGAI, end to end

**On the slide**
Architecture diagram, four HKGAI boxes feeding the app:
- **Modelhub · text** — colloquial Cantonese phrasing, back-translation, the 9-language catalogue
- **Modelhub · speech** — 6 Cantonese TTS personas + ASR (Cantonese *and* English)
- **Toolhub** — transit ETA / fare / route detail, weather, public facilities, A&E waits
- **Agenthub** — "is this route still running?" answered from the live web
Plus one box out to the side: **Yau Lok as an MCP server** — `/api/mcp`,
`plan_minibus_journey`, `minibus_alight_plan`.

**Say (30s)**
> "Every HKGAI surface, used for what it's actually good at. Text for phrasing,
> speech for the voice, Toolhub for Hong Kong's own data, Agenthub when the
> data is silent. And we turned it around — Yau Lok also *exposes* an MCP
> server, so any agent can plan a minibus trip through us."

**Why it scores** — Enterprise track fit. Show breadth *and* the reversal.

---

## 8 — What we chose not to fake

**On the slide**
Three short rows, each with a ✓:
- **Never a 0-minute ETA** — a broken readout costs trust
- **Never an invented price** — a line the OCR can't read asks you instead
- **On-device OCR** — HKGAI has no vision model, so we said so and shipped Tesseract

**Say (30s)**
> "One slide on honesty, because it's a product decision. We verified against
> HKGAI Studio that there's no vision model — Modelhub is text and speech, and
> Toolhub's fifteen tools have no OCR. So menu reading runs on-device, prices
> the camera can't read are asked for rather than guessed, and the manual menu
> is always one tap away. Everything we claim comes from HKGAI. The one thing
> it can't do, we don't pretend."

**Why it scores** — Completeness, and it disarms the obvious hostile question
before a judge can ask it. Own the limitation on your own terms.

---

## 9 — It runs, right now

**On the slide**
A QR code to **https://yau-lok.vercel.app**, large.
Around it, four small proof points:
- Live on Vercel · PWA, installable
- Field-tested on a real minibus
- 9 languages · 579 strings
- Public repo

**Say (25s)**
> "This is deployed, not mocked. Scan it now — it works on your phone, in your
> language, in this room. We field-tested it on an actual minibus and fixed
> what broke: GPS that never engaged, a screen that overflowed on a 14 Pro."

**Why it scores** — Completeness is a judging criterion in its own right, and
"现场能跑起来" is the exact wording. Make them scan it during the pitch.

---

## 10 — 有落

**On the slide**
Back to the LED board. One line:
**唔識講，唔使驚 —— 有落幫你講。**
Team name, repo URL, demo URL, contact.

**Say (20s)**
> "Hong Kong runs on a language a lot of the people living here don't speak.
> Yau Lok doesn't teach them Cantonese. It speaks it for them, at the exact
> moment it matters. 有落 — thank you."

---

## Speaking notes

- **Total 4:30 of speech.** Leave room for the live demo; don't read slides.
- **Do the live demo between slides 5 and 6**, not at the end. If the Wi-Fi
  dies you still have seven slides left to recover with.
- Have the **demo video queued as the fallback** if the network fails.
- Rehearse the answer to *"why not just Google Translate?"* — it's slide 2, in
  one sentence: **it answers, it never speaks first.**
- Rehearse *"what happens when the OCR is wrong?"* — slide 8, and then show
  the 改 button on the phone.
