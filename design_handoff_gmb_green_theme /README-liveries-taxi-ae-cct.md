# Handoff 2: 的士 / 急症室 / 茶餐廳 — three scenario liveries

Companion to `README.md` (the GMB green re-theme, direction `1a`). **Do that one first** —
this document assumes its tokens, `PressButton`, `Screen tone`, `TopBar variant` and
`Card raised` already exist.

## Overview

Yau Lok has four scenarios on the home screen. The green minibus re-theme gave the app one
livery; this handoff gives the other three their own, so a user always knows which world they
are in before reading a word:

| Scenario | Route | Livery | Chrome | Hero object |
|---|---|---|---|---|
| 的士 Taxi | `app/taxi` | Urban red taxi | `--sign-red` | 咪錶 (meter) + 黃色膠牌 destination sign |
| 睇醫生 A&E | `app/clinic` | HKFSD ambulance | `--amb-yellow` + `--sign-blue` | Battenburg stripe + A158 unit plate |
| 茶餐廳 CCT | `app/cct` (new) | Cha chaan teng | `--sign-green` mosaic + `--sign-red` | 落單紙 (order chit) |

Same rules as handoff 1: the header is the vehicle/room, the body is the interior, and the
one object the user physically **shows another person** is the biggest thing on the screen.

## Design file

`Yau Lok Green.dc.html` — open in a browser. Groups, newest first:

- **`4a` 茶餐廳** — 5 screens (入座 / 落單 / 落單紙 / 術語 / 埋單)
- **`3a` 睇醫生** — 5 screens (分流 / 輪候 / 講病情 / 登記處 / 等緊)
- **`2a` 的士** — 5 screens (上車前 / 俾司機睇 / 車程中 / 偏離路線 / 落車找數)
- `1a`, `1b`, Turn 0 — handoff 1. Ignore here.

**High fidelity.** Colours, sizes, weights, radii, shadows and Chinese copy are final. The
phone bezel is a presentation frame — do not build it. The hatched map boxes stand in for the
real `components/RideMap.tsx`; keep its behaviour, restyle the line and markers only.

---

## 1. Tokens to add — `app/globals.css`

Everything reuses existing tokens where a token already means the right thing. Only these
are new:

```css
/* Ambulance livery (A&E) — HKFSD lemon body, battenburg stripe */
--amb-yellow:   #f5de00;
--amb-blue:     var(--sign-blue);   /* #12507e — type + primary action */
--amb-blue-deep:#0b3654;            /* pressed shadow */

/* Cha chaan teng livery — mosaic tile wall, melamine crockery */
--tile-cream:   #f3ebdb;            /* body panel: the tiled wall */
--melamine:     #f5d547;            /* yellow plate / table-number chip */
--melamine-mint:#bfe3d0;            /* mint plate, secondary chip */

/* Taxi meter (咪錶) — red seven-seg on black */
--meter-bg:     #0a0a0a;
--meter-on:     #ff2e2e;
--meter-btn:    #1b2430;            /* the 往/停/附加 button rail */
```

Reused, unchanged: `--sign-red #d7263d` (taxi chrome **and** cha chaan teng booth vinyl),
`--sign-red-deep #a81028`, `--sign-blue #12507e`, `--sign-green #0f7a52` (mosaic tile),
`--brand-deep #0a5738`, `--sign-amber` / `--sign-amber-soft` (detour warning),
`--sign-green-soft` (on-route), `--ink*`, `--card`, `--rule`, `--paper`.

Register each new colour in `@theme inline` (`--color-amb-yellow`, …) as the file already
does. Cabin grey for the taxi body panel is `#eae6e0`; A&E body is `#f1efe9`. Add them as
`--taxi-cabin` and `--ward-grey` if you prefer tokens over literals — just be consistent.

### Colour meaning (do not deviate)

- **Red** is the taxi, the booth seat, and 999/urgent. It is never a neutral surface tint.
- **Blue** is medical chrome and medical primary actions. Never red for a medical CTA.
- **Amber/yellow** is a *sign*: ambulance body, taxi 膠牌, melamine, table number. Never text.
- Seven-seg red (`--meter-on`) appears **only** inside a meter bezel.

---

## 2. New shared primitives

### `components/Meter.tsx` (taxi)

The咪錶, modelled on a real Hong Kong taxi meter.

```
<Meter fare={56.3} extras={10.0} km={4.41} elapsedS={0} speed={32}
       hired size="lg" | "sm" />
```

- Bezel: `--meter-bg`, 2px `#262626`, radius 12, padding `14px 14px 11px`.
- Two columns, `flex 1.5` FARE / `flex 1` EXTRAS, separated by a 2px white rule.
- Each column: a **bracket label** — uppercase Archivo 700, letter-spacing `.3em` (FARE) /
  `.22em` (EXTRAS), white, with `border-top/left/right: 2px solid #fff` and radius `4px 4px 0 0`.
- Digits: DotGothic16, `--meter-on`, `text-shadow: 0 0 14px rgba(255,46,46,.55)`.
  FARE 46px, EXTRAS 30px (`size="sm"`: 34 / 24, no footer rows).
- Footer per column: `border-top:2px solid #fff`, `HK$` left, `C[x10]` right, Archivo 700 10px.
- `hired` → the word `HIRED` centred, DotGothic16 13px, letter-spacing `.2em`, `--meter-on`.
- Button rail: six 26px-tall pills, `flex:1`, gap 7 — first is `--sign-red` with a glow when
  hired, rest `--meter-btn`; labels 空 / 往 / 停 / 附加 / $10 / $1 underneath, 9px 700, `#8a8a8a`.
- Stats row: `km` · `Xm YYs` · `speed km/h`, Archivo 400 10px `#7b7b7b`, space-between.

Live behaviour: fare increments in whole dollars, distance integrates speed, both tick every
second while `riding`. Cap speed 0–52 km/h.

### `components/PlasticSign.tsx` (taxi + A&E)

The yellow 膠牌 / ambulance side panel — a bolted plastic plate that holds one message big
enough to read across a car seat or a counter.

```
<PlasticSign tone="taxi" | "ambulance">…</PlasticSign>
```

- taxi: `linear-gradient(#FFDE59,#F2C012)`, 4px `--ink` border, radius 14,
  `box-shadow: 0 6px 0 0 var(--ink), inset 0 3px 0 rgba(255,255,255,.55)`.
- ambulance: `--amb-yellow` fill, 4px `--sign-blue` border, `0 6px 0 0 --amb-blue-deep`,
  plus a `Battenburg` strip pinned top and bottom inside.
- Four bolt dots, 9px, `rgba(0,0,0,.4)`, inset 9px from each corner. Absolutely positioned;
  the plate is `position:relative; overflow:hidden`.
- Content is centred: 44px/1.15 900 Chinese (`--sign-red` on taxi, `--sign-blue` on
  ambulance), then 17–18px 700 `--ink`, then 13px 500 at 62–66% ink for the romanisation.

### `components/Battenburg.tsx` (A&E)

```css
height: 13px;
background: repeating-linear-gradient(115deg,
  var(--sign-red) 0 22px, #fff 22px 24px,
  var(--sign-blue) 24px 46px, #fff 46px 48px);
```

Sits directly under every A&E `TopBar` (11px tall and reversed inside `PlasticSign`).

### `components/OrderChit.tsx` (茶餐廳)

Paper `#fffdf3`, 1px `#ddd7ce`, radius 3, `box-shadow: 3px 4px 0 0 rgba(20,17,15,.16)`,
ruled with `repeating-linear-gradient(0deg,transparent 0 33px,rgba(18,80,126,.14) 33px 34px)`.
Header row 檯 N / N 位 over a 2px ink rule; items in Noto Sans HK 500 34px `--sign-red` with
the price right-aligned at 30px; total under a second 2px rule.

> **Do not** reach for a Chinese handwriting webfont. Google's brush faces (Zhi Mang Xing,
> Ma Shan Zheng, Long Cang) are Simplified-only and silently fall back on 麵/單/嘅, which
> looks broken mid-line. Noto Sans HK 500, slightly loose, is the shipped look.

### `components/ui.tsx` additions

- `PressButton tone`: add `"red" | "blue" | "cct"` — hard `0 4px 0 0 <deep>` shadow, active
  translates down by the shadow and removes it. Same shape as the green one from handoff 1.
- `TopBar variant`: add `"taxi"` (`--sign-red`, `0 3px 0 0 --sign-red-deep`),
  `"ambulance"` (`--amb-yellow`, blue type, `Battenburg` underneath),
  `"cct"` (mosaic tile: `--sign-green` +
  `linear-gradient(rgba(255,255,255,.16) 1px,transparent 1px)` ×2 at `13px 13px`,
  `0 3px 0 0 --brand-deep`).
- `Screen tone`: add `"taxi"` `#eae6e0`, `"ward"` `#f1efe9`, `"cct"` `--tile-cream`.

---

## 3. 的士 — `app/taxi/page.tsx` (group `2a`)

Five states of the **existing** page. Do not change `planTrip`, the `/api/taxi/plan` call,
`projectOntoPath` detour maths, `DETOUR_WARN_M` / `DETOUR_STREAK`, TTS, ASR or i18n.

| Screen | State | Build |
|---|---|---|
| 01 上車前 | no `plan` | 的士/TAXI roof sign (PlasticSign, compact, 26px 的士 + 20px TAXI split by a rule); origin + destination fields; `計車費` red PressButton; `Meter size="sm"` showing the estimate (FARE = fare.low, EXTRAS = tolls) with `8.9 km · 約 24 min · 連隧道費`; the 你講咩話？ language row; the 講嘢 mic + type block |
| 02 俾司機睇 | `plan`, not riding | Full-bleed `PlasticSign tone="taxi"` — 唔該，去 / destination Chinese / address / English; `讀廣東話俾佢聽` (ink button, `Volume2`); fare range strip; the three `boarding` phrases from `TAXI_PHRASES` |
| 03 車程中 | `riding`, on route | `Meter size="lg" hired`; restyled `RideMap`; `--sign-green-soft` on-route card; the four `during` phrases; a `講其他嘢` outline button |
| 04 偏離路線 | `riding`, `offRoute` | Header pill flips to `--melamine`-yellow 偏離路線; amber alert card + 「請問行邊條路？」 ink button; map shows the planned line grey and the actual line dashed amber; `Meter size="sm"`; a plate card holding the licence number; two `TAXI_TIPS` items |
| 05 落車找數 | arrived | Final meter (speed 0.0); fare breakdown 咪錶 / 隧道費 / **總數** in `--sign-red` 26px; 幾多錢 + 收據 phrases (收據 is the red primary); three `TAXI_TIPS` entries as titled items |

Copy is verbatim in the HTML. All phrase text must come from `data/taxi-phrases.ts` — add no
new phrases there; the extra lines on screen 04/05 are tips, not phrases.

## 4. 睇醫生 — `app/clinic/page.tsx` (group `3a`)

Keep `getAeWaits`, the 15-minute polling, geolocation sort, `CLINIC_PHRASES`, say/mic flow.

| Screen | Build |
|---|---|
| 01 分流 | Lemon TopBar with a pulsing blue lamp + `A158`; Battenburg; **999 card** (`--sign-red`, white cross tile, 好緊急 · 打 999 / 胸痛、呼吸困難、大量出血、暈倒); 去急症室 + 講病情 rows in one raised card; language row; the five-level triage key (I 危殆 `--sign-red`, II 危急 `#e8622c`, III 緊急 `--sign-amber`, IV 次緊急 `--sign-blue`, V 非緊急 `--ink-faint`) |
| 02 輪候時間 | Nearest hospital as a raised blue-bordered card with a **unit plate** wait chip (`--amb-yellow` fill, 2.5px blue border, 20px 900 hours + `WAIT`); three more as compact rows; the HA data note in `--sign-blue-soft`; the fee card; a red 999 strip pinned to the bottom |
| 03 講病情 | 74px blue mic button 㩒住講你邊度唔舒服; type field; ink result card (26px Cantonese / jyutping / back-translation); two `symptom` phrases; a body-part chip row (頭 胸口 肚 背脊 手腳 呼吸) that appends to the say text |
| 04 登記處 | `PlasticSign tone="ambulance"` carrying the `no-cantonese` phrase 我唔識講廣東話 / 可唔可以搵個翻譯？ + English; 讀廣東話俾佢聽; the two `arrive` phrases; a 登記要帶 checklist; language row; 講其他嘢 |
| 05 等緊 | Ticket card: 你嘅籌號 `A158` 46px blue, triage chip `IV 次緊急`, 已等 … · 前面仲有 N 位; a blue note explaining that urgent cases jump the queue; the two `ask` phrases plus 我越嚟越辛苦; a red 突然好嚴重？ card |

**Fees are regulated and change.** Screen 02 shows the current scale: 分流 I·II 免費,
III–V **$400** for eligible persons, with a **$350** refund if a III–V patient leaves before
seeing a doctor. Put these in one place (`data/ae-fees.ts`) with a `lastChecked` date and
render the disclaimer 收費以醫管局公佈為準 — never hardcode a price in JSX.

## 5. 茶餐廳 — `app/cct/page.tsx` (group `4a`, new route)

The home screen's fourth card is currently `SOON` at `opacity:.5`. Building this route means
enabling it: `--sign-green` tile icon 茶, subtitle 落單唔使驚, badge removed.

New data file `data/cct-phrases.ts`, same shape as `taxi-phrases.ts`
(`id, cantonese, jyutping, english, group`), groups `order | tweak | pay`; plus
`CCT_SLANG: { code, meaning, note }[]`.

| Screen | Build |
|---|---|
| 01 入座 | Mosaic TopBar + 檯號 chip (`--melamine`); 今日常餐 board — white card, 2px ink border, radius **4**, `3px 3px 0 0 rgba(20,17,15,.18)`, red 22px title over a 2px red rule, items 15px/1.7 700; four 水牌 price strips (radius 3, red price); 開始落單; language row |
| 02 落單 | Item rows with a 44px round melamine token (`--melamine` / `--melamine-mint` / ink+`--melamine` for a drink **code**), 2px ink border; running total in the header; a 加減 chip row (走冰 少甜 茶走 加底 扣底 走青 行街) where selected chips are `--sign-red`; an ink footer CTA 寫張單俾伙記 |
| 03 落單紙 | `OrderChit` as the hero — 檯 12 / 1 位, items in shorthand (`0T 走冰 少甜`), 共 total; a 張單寫緊乜 legend decoding each code; 讀廣東話俾伙記聽 (red); an ink card 唔該，落單！ + jyutping |
| 04 術語 | Drink-code table — 46px ink/`--melamine` code tiles: **9T** 奶茶（九／奶諧音）, **0T** 檸茶（零／檸）, **果T** 果茶, **妹T** 莓茶（妹／莓）; then tappable slang rows with a red `Volume2`: 茶走, 靚仔/靚女, 飛沙走奶, 和尚跳海, 行街; credit line 術語參考 Kong Tea《茶餐廳術語》 |
| 05 埋單 | Bill on chit paper, 埋單 total 34px 700 `--sign-red`; 唔該，埋單！ as the red primary, then 要張單 and 分開俾; a 茶記規矩 list (pay at the till, no tip, leave promptly when busy) |

Slang source: <https://kongtea.ca/zh-hant/blogs/news/cha-chaan-teng-slangs> — the 9T / 0T /
果T / 妹T codes and the homophone explanations are theirs; keep the credit line.

---

## 6. Rules that apply to all three

- Visual work only. No changes to data fetching, GPS, TTS/ASR, i18n, or detour maths.
- All Chinese copy goes through `useT` — add keys under `taxi.*`, `clinic.*`, `cct.*`;
  strings in the HTML are the Traditional Chinese source values.
- Lucide icons only, never emoji. Touch targets ≥ 48px (phrase cards ≥ 44px). Body copy
  never below 12px; phrase Cantonese 16px 700, jyutping 11px.
- Every list screen ends flush with the frame: last card, then the section footnote pinned
  with `margin-top:auto`. No trailing void.
- `prefers-reduced-motion`: stop the meter glow pulse, the GPS lamp, and the map ring.
- Each livery is confined to its route. The home screen (01 of `1a`) stays green; scenario
  tiles keep their scenario colour as the icon fill only.

## 7. Files

New: `components/Meter.tsx`, `components/PlasticSign.tsx`, `components/Battenburg.tsx`,
`components/OrderChit.tsx`, `app/cct/page.tsx`, `data/cct-phrases.ts`, `data/ae-fees.ts`.

Changed: `app/globals.css`, `components/ui.tsx`, `app/taxi/page.tsx`,
`app/clinic/page.tsx`, `app/page.tsx` (enable the 茶餐廳 card),
`components/RideMap.tsx` (per-scenario line colour), `data/i18n/*`.

---

## 8. Prompt to paste into Claude Code

> Read `design_handoff_gmb_green_theme/README-liveries-taxi-ae-cct.md` in full (and
> `README.md` for the shared primitives it builds on), then open
> `design_handoff_gmb_green_theme/Yau Lok Green.dc.html` and study the groups badged **2a**
> (的士), **3a** (睇醫生) and **4a** (茶餐廳) — five phone screens each. Ignore `1a`, `1b`
> and the Turn-0 group.
>
> Give each scenario its own livery, in this order:
>
> 1. `app/globals.css` — add only the tokens in §1 (`--amb-yellow`, `--amb-blue-deep`,
>    `--tile-cream`, `--melamine*`, `--meter-*`) and register them in `@theme inline`.
>    Reuse `--sign-red`, `--sign-blue`, `--sign-green` as specified; invent no new colours.
> 2. Build the four primitives in §2 before touching any page: `Meter`, `PlasticSign`,
>    `Battenburg`, `OrderChit`. The meter is the signature element of the taxi flow — match
>    the bracket labels, the HK$ / C[x10] footer rules and the 空/往/停/附加/$10/$1 rail
>    exactly. Extend `components/ui.tsx` with the new `PressButton` tones, `TopBar` variants
>    and `Screen` tones; keep every existing export working.
> 3. `app/taxi/page.tsx` → §3. Five states of the page that already exists.
> 4. `app/clinic/page.tsx` → §4. Move the A&E fees into `data/ae-fees.ts` with a
>    `lastChecked` date; never hardcode a fee in JSX.
> 5. `app/cct/page.tsx` → §5, a new route, plus `data/cct-phrases.ts`, and flip the 茶餐廳
>    card on `app/page.tsx` from `SOON` to live.
>
> Rules: this is a **visual** change — do not touch data fetching, `/api/taxi/plan`, the
> detour maths, `getAeWaits`, TTS/ASR, or i18n plumbing. Route every Chinese string through
> `useT`. Lucide icons only, never emoji. Touch targets ≥ 48px, body copy ≥ 12px. Do not add
> a Chinese handwriting webfont — Google's brush faces are Simplified-only and fall back
> mid-line on 麵/單; the chit is Noto Sans HK 500. Run the dev server and compare each screen
> against its group in the HTML before moving on.
