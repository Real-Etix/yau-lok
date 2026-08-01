# Handoff: 有落 Yau Lok — GMB green-minibus re-theme (direction 1a, "全車身 / Full livery")

## Overview

Re-theme the existing **Yau Lok** app (Next.js + Tailwind v4, in this repo) from its current
red 膠牌 (plastic-sign) identity to a **green minibus (GMB) livery**, and give the app an
identity built on the **LED dot-matrix destination board** mounted in the front windscreen of
a Hong Kong green minibus.

Two directions were explored. **This handoff covers direction 1a only** — the "full livery"
option: jade-green header chrome, cream body panels, and LED dot-matrix boards used wherever
a rider reads a *number* (route code, ETA, countdown, next stop, alert distance).

Scope also adds three screens the app does not have yet: **saved routes (我的路線)**,
**settings (設定)**, and an **arrival alert / lock-screen** moment.

## About the design files

The files in this bundle are **design references created in HTML** — a prototype showing
intended look and behaviour, **not production code to copy**. The task is to recreate these
designs inside this repo's existing environment: **Next.js App Router + React 19 + Tailwind
CSS v4 + CSS custom properties in `app/globals.css` + the shared primitives in
`components/ui.tsx`**. Keep using those primitives; extend them where noted rather than
introducing a parallel styling system.

Open `Yau Lok Green.dc.html` in a browser. It shows three groups:

- **Turn 1 → `1a` (this handoff)** — eight iPhone screens, "full livery".
- **Turn 1 → `1b`** — an alternative quieter direction. **Ignore it.**
- **Turn 0** — the *current* app recreated from this repo (Home, Search, Route, Riding), for
  before/after comparison. Ignore for implementation; useful to confirm the baseline.

## Fidelity

**High fidelity.** Colours, type sizes, weights, radii, shadows and copy are final and exact.
Recreate pixel-for-pixel using this repo's tokens, Tailwind utilities and `components/ui.tsx`
primitives. The phone bezel, status bar and home indicator in the HTML are a **presentation
frame only** — do not build them.

The placeholder maps in the HTML (hatched cream boxes with an SVG line) stand in for the real
`components/RideMap.tsx` (Leaflet + OSM). **Keep `RideMap.tsx`'s behaviour**; only restyle it
(see "Map" below).

---

## 1. Design tokens — `app/globals.css`

The repo **already defines the green**: `--sign-green: #0f7a52`, commented
*"green minibus, and 'on the way'"*. This re-theme **promotes that token from accent to
primary**. Do not invent a new green.

### Change (`:root`)

```css
/* Promote green to the primary brand surface. Red keeps its 膠牌 meaning:
   your destination, and the moment to shout. */
--brand:            var(--sign-green);        /* #0f7a52 */
--brand-deep:       #0a5738;                  /* pressed shadow + dark cabin bg */
--brand-soft:       var(--sign-green-soft);   /* #e6f4ee */
--brand-on:         #a5dcc2;                  /* subtext on a green header */
--brand-rail:       #c8e3d6;                  /* inactive timeline rail */

/* LED destination board — amber on black, as in the GMB windscreen */
--led-bg:           #0a0a0a;
--led-on:           #ffb020;                  /* primary dot colour */
--led-dim:          #ff8a00;                  /* secondary line / romanisation */

/* Cream body panel. Slightly warmer + more saturated than --paper, so the
   green chrome reads as the roof and this as the body of the bus. */
--body-cream:       #f2eada;
```

`--sign-red`, `--sign-red-deep`, `--sign-blue`, `--sign-amber*`, `--ink*`, `--paper`,
`--card`, `--rule`, the radius scale and the 4pt rhythm are **unchanged**.

Register the new colours in the existing `@theme inline` block so Tailwind utilities exist
(`--color-brand`, `--color-led-on`, etc.), matching the pattern already used for
`--color-sign-green`.

### Colour usage rules (do not deviate)

| Meaning | Token |
|---|---|
| App chrome, primary action, "on the way", live/confirmed data | `--brand` |
| Screen body behind cards | `--body-cream` |
| Cards | `--card` on `--rule` border |
| Destination, get-off marker, the 有落 shout button | `--sign-red` (unchanged) |
| Fare warnings / "coming up" state | `--sign-amber` on `--sign-amber-soft` |
| Any **number a rider reads** (route code, ETA, countdown, next stop, alert distance) | LED board |
| Factual/secondary info | `--ink-muted`, `--ink-faint` |

Max two background colours per screen: `--body-cream` + `--brand` header (or `--brand-deep`
for the riding screen). Never gradients except the two dark alert screens (below).

---

## 2. Typography

| Role | Family | Notes |
|---|---|---|
| Latin UI | **Archivo** (already wired as `--font-archivo`) | unchanged |
| Chinese | platform HK face via the existing `html` font stack (PingFang HK / Noto Sans CJK HK) | unchanged. Chinese headings use the existing `.sign-zh` class (900 / .02em / 1.15) |
| **LED board** | **DotGothic16** (Google Fonts, weight 400) | **new.** Add with `next/font/google` alongside Archivo and expose as `--font-dot`. It is a 16px bitmap-style face — never bold it, never letter-space Chinese in it. |

Scale used in 1a (px, at 402pt-wide screen):

- LED logo 有落 62 / `YAU LOK!` 17 with `.22em` tracking
- LED route code 40 · LED destination 24 · LED romanisation 12 (`.14em`)
- LED countdown 64 (mm:ss) · LED ETA 30 · LED next-stop 26 (scrolling) · LED chip 15–22
- Screen title (Chinese, `.sign-zh`) 26 · card title 17 · stop name 15 · body 13–14
- Section label 11, weight 800, `.14em`, uppercase (matches existing `SectionLabel`)
- Shout button 46 (Chinese, 900) · alert-sheet shout button 30

Never below 13px for body copy; every touch target ≥ 48px, as the repo already enforces.

---

## 3. New primitive: `<LedBoard>` — `components/LedBoard.tsx`

The signature element. It is the app logo, the route header, the countdown, the next-stop
announcement, and any inline route-code chip. Build it **once** and reuse it.

Anatomy:

1. Black plate: `background: var(--led-bg)`, `border-radius` 5–12px depending on size.
2. Amber content: `--led-on` for the primary line, `--led-dim` for the secondary line.
3. Glow on large type only: `text-shadow: 0 0 14px rgba(255,176,32,.5)`.
4. **Dot-matrix scanline overlay** — an absolutely-positioned, `pointer-events:none` layer
   over the whole plate that breaks the glyphs into dots:

```css
.led-dots::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    repeating-linear-gradient(0deg,  rgba(0,0,0,.6) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(90deg, rgba(0,0,0,.6) 0 1px, transparent 1px 3px);
}
```

5. Optional physical frame (used only for the logo on Home):
   `border: 3px solid var(--ink); box-shadow: 0 3px 0 0 var(--ink), inset 0 0 30px rgba(255,176,32,.14)`
   — this is the existing `.plate` idea in `globals.css`, in LED form.

Suggested API:

```ts
type LedBoardProps = {
  size: "logo" | "header" | "display" | "chip";
  label?: string;      // small dim line above, e.g. "下一站 NEXT STOP"
  primary: string;     // amber main line
  secondary?: string;  // dim second line (romanisation / English)
  trailing?: string;   // right-aligned dim value, e.g. "$7.6"
  framed?: boolean;    // the .plate treatment (logo only)
  scroll?: boolean;    // marquee the primary line (next-stop only)
};
```

Marquee for long stop names (`scroll`):

```css
@keyframes led-scroll {
  0%, 12%   { transform: translateX(0); }
  88%, 100% { transform: translateX(calc(-100% + 210px)); }
}
/* 9s linear infinite; wrap in prefers-reduced-motion: reduce → animation: none,
   matching the existing @media block in globals.css. */
```

---

## 4. Extend `components/ui.tsx`

Keep every existing export and its behaviour. Additions:

- **`PressButton`** — add a `tone: "green"`:
  `bg-[var(--brand)] text-white shadow-[0_3px_0_0_var(--brand-deep)]`.
  It becomes the default primary tone across the app (previously `blue`/`ink`).
  The `.press` depress transition in `globals.css` is unchanged. Note 1a uses a 4px offset
  (`0 4px 0 0`) on the tall 54–60px bars; keep 3px on standard buttons.
- **`Screen`** — accept `tone?: "cream" | "cabin"`. `cream` → `--body-cream` (all list
  screens); `cabin` → `--brand-deep` (the riding screen). Default stays `--paper`.
- **`TopBar`** — accept `variant?: "plain" | "brand"`. `brand` renders the bar on a
  `--brand` background: back chevron and title in white, subtext in `--brand-on`, and it
  bleeds full-width to the screen edges (the green "roof" of the screen). Right-hand
  controls become translucent white pills (`rgba(255,255,255,.16)`), not bordered ink pills.
- **`Card`** — add `raised?: boolean` → `box-shadow: 0 3px 0 0 var(--brand)`. Used to mark
  the *recommended* item in a list (best route option, the primary saved route).

Icons: **Lucide only, never emoji** — the rule already stated at the top of `ui.tsx`. The
HTML inlines Lucide paths because it has no bundler; in the app just import the components.
Icons used: `Bus, Car, Stethoscope, UtensilsCrossed, MapPin, Flag, Crosshair, Signpost,
Globe, ChevronLeft, ChevronDown, Mic, Volume2, Star`.

---

## 5. Screens

All eight are in `Yau Lok Green.dc.html` under the `1a` badge, labelled `01`–`08`.
Widths below assume the 402pt iPhone frame; use the repo's existing `max-w-md` shell.

### 01 · Home — `app/page.tsx`

- Body `--body-cream`, padding `64px 18px 40px`, column, gap 14.
- **Framed LED logo** at top: 有落 at 62px amber, `YAU LOK!` 17px `--led-dim` `.22em`
  centred beneath, `.plate`-style ink frame + dot overlay. Radius 12, padding `18px 18px 16px`.
- Tagline, centred, 14px `--ink-muted`: 知你幾時要落車 —— GPS ＋ 小巴實時到站，幫你嗌。
- `SectionLabel`: 揀場景 Pick a scenario.
- Four scenario rows (replaces the current icon tiles). Card, radius 18, padding 12, gap 10;
  48×48 icon square radius 13 holding a **Lucide** icon on a solid colour; title 17 `.sign-zh`;
  subtitle 13 `--ink-muted`.
  - 綠色小巴 — `--brand`, `Bus` — 實時到站 · 落車提示 · 幫你嗌有落 — **`raised`**
  - 的士 — `--sign-red`, `Car` — 講清楚目的地同路線
  - 睇醫生 — `--sign-blue`, `Stethoscope` — 急症輪候 · 病情用語
  - 茶餐廳 — `--ink-faint`, `UtensilsCrossed` — 落單唔使驚 — `opacity:.5`, pill badge `SOON`
- Language row: card radius 14, `Globe` + 你講咩話？ left, current language + `ChevronDown`
  in `--brand` right. Wire to the existing `LanguagePicker`/`SelectField`.
- 為咩要做呢個 app card (15px title / 13px body): 翻譯 app 要你問先答。有落係你唔記得問、又或者唔敢開口嗰刻，主動幫你講。
- Footnote 11px `--ink-faint`: Firebird Hackathon · HKGAI 港話通.

### 02 · Plan — `app/ride/page.tsx` (search state)

- `TopBar variant="brand"`: 去邊度？ + translucent 示範 pill.
- Search card (radius 18, padding 14): origin field with a `--brand` dot, destination field
  with a red square, focused destination gets `border: 1.5px solid var(--brand)` +
  `box-shadow: 0 0 0 3.5px rgba(15,122,82,.15)` — i.e. the existing `.field-input:focus-visible`
  rule re-pointed from `--sign-blue` to `--brand`. `PressButton tone="green"`: 搵車.
- `SectionLabel`: 小巴優先 · minibus first.
- Result cards: minutes 24px 900 + 分鐘, fare · distance right in `--ink-muted`;
  a leg row mixing plain walk text and an **LED chip** for each GMB route code
  (`4C` amber on black + dim 綠 GMB); GMB result is `raised` and carries an ink
  `PressButton`: 追蹤呢架小巴. Non-GMB legs use a flat cream pill (`巴士 71`), never an LED chip —
  **the LED board is for minibuses only**.
- Footnote: 路線資料來自 HKGAI Toolhub · 政府開放數據.

### 03 · Route detail — `app/ride/page.tsx` (route loaded)

- Green header containing the **LED route header**: route code 40px, destination 24px,
  romanisation 12px `.14em`, fare right-aligned dim. Beneath, 12px `--brand-on`
  石排灣邨 → 景隆街 · 8 個站, and a translucent ★ 已收藏 toggle.
- Two-up strip: **LED** 下一班 NEXT with `{n} 分` (30px) | plain card 跟住 THEN `6 · 11 分`.
- `SectionLabel` 全部車站 8 stops, then the stop timeline:
  3px `--brand` rail; first stop 15px dot + white ring + `--brand` halo, label 上車 · GET ON;
  intermediate stops 9px white dot, 2.5px `--brand` ring, 14px `--ink-muted` name;
  last stop a 15px **red rounded square**, label 落車 · GET OFF. Names 15px `.sign-zh` on the
  two endpoints only.
- Bottom bar pinned to the screen: white, `border-top: 2.5px solid var(--ink)`; line
  全程約 28 分鐘 · 車費 HK$7.6 with 司機唔會找錢 in `--sign-amber`; then
  `PressButton tone="green"` 54px: 喺 石排灣邨 等車.

### 04 · Waiting — `app/ride/page.tsx` (waiting state)

- Green header + **LED countdown**: dim 4C 車嚟緊 ARRIVING, `mm:ss` at 64px with glow,
  跟住 6 分 · 11 分 beneath. This is the hero.
- Map, `flex:1`, radius 18, **`border: 2.5px solid var(--ink)`** (ink frame = the livery
  treatment; see "Map").
- Two-up plain cards 車費 FARE `HK$7.6` / 天氣 WEATHER `24°C 多雲`.
- `PressButton tone="green"` 60px, two-line: **我上咗車** / 開始追蹤 · 準備幫你嗌有落.

### 05 · Riding — `app/ride/page.tsx` (riding state) — `Screen tone="cabin"`

- Background `--brand-deep` (sitting in the cabin).
- **LED next-stop board**, full width, `scroll` marquee:
  下一站 NEXT STOP / 黃竹坑道 49 號　WONG CHUK HANG ROAD 49.
- Amber "coming up" bar (`--sign-amber` solid, radius 14): 就快到喇 + 2 個站 · 480 m · 約 3 分.
  This replaces today's `StatusBanner` in this state; keep the same thresholds.
- Map `flex:1`, ink border; the bus marker is a 34px `--brand` rounded square with a white
  border carrying the route code in LED amber. GPS caption bottom-right in DotGothic16 10px.
- **有落 button** — unchanged semantics, restyled: `--sign-red`, radius 26, padding 22/16,
  `box-shadow: 0 5px 0 0 var(--sign-red-deep)`, 唔該，有落！ at 46px 900 + `m4 goi1, jau5 lok6!`
  14px. A slow `scale(1)→scale(1.04)` 1.6s breathing loop draws the eye; must respect
  `prefers-reduced-motion`.
- On tap, an amber confirmation strip appears above it for ~1.8s with a Lucide `Volume2`:
  已用暖心師奶聲線播出 (voice name from the selected persona in `data/voices.ts`).
- Below: horizontally scrolling phrase chips (translucent white on the dark cabin) —
  巴士站有落 / 燈位有落 / `Mic` 司機講咩 — from `data/phrases.ts`.

### 06 · Arrival alert / lock screen — new

- Full-dark `linear-gradient(#0a0a0a, #0b3729)`; iOS lock-screen clock 9:41 at 82px weight 200.
- Notification sheet: `rgba(255,255,255,.14)`, `backdrop-filter: blur(14px)`, radius 22.
  App row = 22px `--brand` rounded square with 落 in LED amber + YAU LOK 有落 · 而家.
- **LED panel inside the notification**: 就到喇！/ 準備落車 at 30px.
- Body 15px white: 4C · 仲有 400 米就到 **景隆街，近總統戲院**。撳一下就幫你嗌。
- Red shout button (30px) directly in the notification — actionable before unlock.
- Footer 13px `rgba(255,255,255,.55)`: 震動 ＋ 廣東話提示音已響.

### 07 · Saved routes 我的路線 — new route (e.g. `app/saved/page.tsx`)

- Green header: 我的路線 26px + 3 條已收藏 · 全部可離線用 in `--brand-on`.
- Saved cards: **LED route-code chip** + 石排灣邨 → 景隆街 + schedule note (返工 · 平日 08:10)
  + `Star` toggle in `--sign-amber`. Live card is `raised` and carries a `--brand-soft` strip:
  下一班 {n} 分鐘 / HK$7.6 · 28 min. Cards with no live data show a cream strip 暫時無到站時間.
- `SectionLabel` 最近搭過 Recent → grouped list, LED chip + route + 前日 / 上星期.
- Offline note: `--brand-soft`, `1px dashed var(--brand)`:
  站名同路線已存喺電話，冇網絡都用到。
- Bottom bar (same ink-topped white bar as 03): `PressButton tone="green"` ＋ 加多條常用路線.

### 08 · Settings 設定 — new route (e.g. `app/settings/page.tsx`)

- Green header 設定.
- Grouped cards under `SectionLabel`s, rows 15px title + `--brand` value:
  - **語言** — 介面語言 繁體中文 / 我講嘅語言 English (existing `SelectField`), helper
    翻譯會譯返做你揀嘅語言。
  - **聲線** — current persona 暖心師奶 + a `--brand` 試聽 pill; persona chips
    (經典女聲 / 經典男聲 / 潮流女聲 / 金牌阿Sir) in `--brand-soft`, from `data/voices.ts`.
  - **落車提示** — 提早幾遠提我 with the value as an **LED chip** (`400m`);
    震動 and 教學模式（粵拼）as `--brand` toggles (50×30 track, 24px knob).
  - 離線路線資料 row: 上次更新 今日 08:02 · 2.1 MB + 更新 action.
- Bottom bar: `PressButton tone="green"` 試一次落車提示, then the footnote
  有落 Yau Lok · HKGAI 廣東話語音 ＋ 政府開放數據.

---

## 6. Map — `components/RideMap.tsx`

Keep Leaflet, the OSM tiles, the imperative API and the marker/pulse logic. Restyle only:

- Container: radius 18, `border: 2.5px solid var(--ink)` (waiting/riding), radius 20 +
  `1px solid var(--rule)` on light screens.
- Route polyline: `--brand`, weight 7 (was blue).
- Origin: 20px `--brand` circle, 4px white border. Destination: 20px **red rounded square**
  (radius 5), 4px white border — square = your stop, matching the timeline in 03.
  Intermediate stops: 13px white dot, 3px `--brand` ring. Keep `.stop-pulse` on the target.
- Bus marker: 34px `--brand` rounded square, 3px white border, route code in
  DotGothic16 `--led-on`. Keep the existing `.bus-marker` 1s linear transition.

The HTML's hatched cream box and inline SVG are **placeholders** — do not port them.

---

## 7. Interactions, state, behaviour

Everything below already exists in `app/ride/page.tsx` — this is a **visual** re-theme.
Preserve: demo vs live-GPS `Segmented`, coach mode, route loading by code or by plan,
GMB ETA polling, distance/stop thresholds for the "coming up" state, TTS shout via the
selected persona, ASR "司機講咩", i18n via `useT`, and offline route caching.

New or changed behaviour only:

| Item | Behaviour |
|---|---|
| ETA readouts | Countdown ticks每秒. **Never render a 0-minute ETA** — floor the displayed minute at 1 and roll over on refresh; a 0 next to 車嚟緊 reads as a bug. mm:ss may show `0:xx`. |
| LED marquee | Only when the stop name overflows; 9s loop, pauses ~1s at each end. |
| Shout confirmation | Amber strip for 1.8s naming the voice persona, then auto-dismiss. |
| Favourite toggle | `Star` fills `--sign-amber`; optimistic, persisted locally. |
| Alert threshold | User-set distance (default 400 m) shown as an LED chip; fires vibration + Cantonese chime + the actionable notification in screen 06. |
| Reduced motion | The breathing shout button, LED marquee and bus transition all stop under `prefers-reduced-motion` — extend the existing `@media` block in `globals.css`. |

---

## 8. Assets

No image assets. Everything is CSS, Lucide icons, and the DotGothic16 webfont
(Google Fonts, OFL — load via `next/font/google`, subset `latin` + the CJK glyphs you need;
the LED board only ever renders route codes, stop names and short Chinese labels).
Replace `app/icon.*` / `app/apple-icon.png` with the framed LED 有落 logo from screen 01.

---

## 9. Files in this bundle

| File | What it is |
|---|---|
| `Yau Lok Green.dc.html` | The design. Open in a browser. Use the `1a` group. |
| `support.js`, `ios-frame.jsx` | Runtime for the HTML prototype. Not for the app. |

Repo files to change: `app/globals.css` (tokens), `components/ui.tsx` (tones/variants),
`components/LedBoard.tsx` (new), `app/page.tsx` (01), `app/ride/page.tsx` (02–05),
`app/saved/page.tsx` (07, new), `app/settings/page.tsx` (08, new),
`components/RideMap.tsx` (marker/line colours), `app/layout.tsx` (DotGothic16 font),
`app/icon.*` (new logo).

---

## 10. Prompt to paste into Claude Code

> Read `design_handoff_gmb_green_theme/README.md` in full, then open
> `design_handoff_gmb_green_theme/Yau Lok Green.dc.html` in a browser and study the group
> badged **1a** ("全車身 / Full livery") — eight phone screens. Ignore group `1b` and the
> Turn-0 group (that one is just the current app, for comparison).
>
> Re-theme this Next.js app to match `1a` exactly, in this order:
>
> 1. `app/globals.css` — add the tokens in §1 of the README. Promote the existing
>    `--sign-green: #0f7a52` to `--brand`; keep `--sign-red` for the destination and the
>    有落 shout button. Do not invent new colours.
> 2. `app/layout.tsx` — add DotGothic16 via `next/font/google` as `--font-dot`.
> 3. `components/LedBoard.tsx` — build the LED dot-matrix board primitive per §3, including
>    the scanline overlay and the marquee. This is the app's signature element; get it right
>    before touching screens.
> 4. `components/ui.tsx` — add `PressButton tone="green"`, `Screen tone`, `TopBar
>    variant="brand"`, `Card raised` per §4. Keep every existing export working.
> 5. Restyle screens in order: `app/page.tsx` (01), `app/ride/page.tsx` (02–05),
>    `components/RideMap.tsx` (§6). Then add the new routes `app/saved/page.tsx` (07) and
>    `app/settings/page.tsx` (08), and the arrival notification (06).
>
> Rules: this is a **visual** re-theme — do not change data fetching, the demo/live-GPS
> toggle, coach mode, TTS/ASR, i18n, or ETA logic beyond the 0-minute floor noted in §7.
> Lucide icons only, never emoji (the rule is already stated at the top of `ui.tsx`).
> Every touch target ≥ 48px. Body copy never below 13px. Traditional Chinese is primary,
> English secondary, and all copy strings are given verbatim in §5 — use them exactly, and
> route them through the existing `useT` i18n layer rather than hardcoding.
> Respect `prefers-reduced-motion` for the marquee, the breathing shout button and the bus
> marker. Run the dev server and check each screen against the HTML before moving on.
