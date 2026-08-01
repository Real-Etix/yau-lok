# Handoff 3: new home page (`5c`) + 影餐牌 menu scan (`6a`)

Companion to `README.md` (handoff 1, the green re-theme) and
`README-liveries-taxi-ae-cct.md` (handoff 2, the three scenario liveries).
**Both must be done first** — this document assumes their tokens (`--sign-red`,
`--sign-blue`, `--amb-yellow`, `--tile-cream`, `--melamine`, `--melamine-mint`,
`--meter-*`), `PressButton`, `Screen tone`, `TopBar variant`, `LedBoard`,
`OrderChit`, `Battenburg` and `Meter` already exist.

Two independent pieces of work. Ship them in either order.

| # | What | Route | Design group |
|---|---|---|---|
| A | Rebuild the home page so all four liveries are visible on the front door | `app/page.tsx` | `5c` |
| B | New feature: photograph a 餐牌, order off the photo | `app/cct/scan` (new) | `6a` |

## Design file

`Yau Lok Green.dc.html` — open in a browser. Groups, newest first:

- **`6a` 影餐牌** — 4 screens (影 / 認 / 特別要求 / 落單紙)
- **`5c` 主頁 · 牌加數** — 1 screen. `5a` and `5b` are the rejected alternatives; ignore them.
- `4a` / `3a` / `2a` — handoff 2. `1a`, Turn 0 — handoff 1.

**High fidelity.** Colours, sizes, weights, radii, shadows and Chinese copy are final.
The phone bezel is a presentation frame — do not build it.

---

# A. Home page — `app/page.tsx` (group `5c`)

## The problem it fixes

Today's home renders four identical white `ScenarioTile`s. The three liveries we
built are invisible until you tap in, and nothing on the screen is live — the app
looks like a category menu when it is actually already tracking a ride.

## The rule

**Every scenario row carries one live number, rendered in its own livery's material.**
Left two-thirds is a normal white card (glyph, title, one line of context). The
right **104px is a full-bleed panel** in that scenario's material, containing the
number and a small all-caps caption. Scanning down the right edge gives you a
number board; scanning down the left gives you the four ways in.

| Row | Panel background | Number type | Value | Caption |
|---|---|---|---|---|
| 綠色小巴 | `--meter-bg` + dot-matrix scanline overlay | `DotGothic16` 34px `--sign-amber` | `4 分` | `NEXT 下一班` |
| 的士 | `--meter-bg`, `border-left: 3px solid --sign-red` | `DotGothic16` 32px `--meter-on` | `$96` | `FARE 估價` |
| 急症室 | `--amb-yellow` + 6px battenburg strip pinned to its top edge | `Archivo 900` 30px `--sign-blue` | `3 小時` | `輪候 WAIT` |
| 茶餐廳 | `--sign-green` + mosaic grout overlay | `Noto Sans HK 700` 25px `--melamine` | `0T 走冰` | `上次落單` |

Mosaic grout overlay (used on the 茶 glyph tile and its number panel):

```css
background-image:
  repeating-linear-gradient(0deg,  rgba(0,0,0,.14) 0 1.5px, transparent 1.5px 13px),
  repeating-linear-gradient(90deg, rgba(0,0,0,.14) 0 1.5px, transparent 1.5px 13px);
```

Dot-matrix scanline overlay (an absolutely-positioned `inset:0` span, `pointer-events:none`):

```css
background-image:
  repeating-linear-gradient(0deg,  rgba(0,0,0,.55) 0 1px, transparent 1px 3px),
  repeating-linear-gradient(90deg, rgba(0,0,0,.55) 0 1px, transparent 1px 3px);
```

## Screen order, top to bottom

1. **Location + language row.** Pin glyph + `香港仔 · 石排灣邨`, then the existing
   `LanguageRow` collapsed into a white pill on the right. 30px tall, no card.
2. **`LedBoard size="logo" framed`** — unchanged component, but the layout inside is
   now horizontal: `有落` 40px at the left, `YAU LOK!` + `唔使驚 · 我幫你講` stacked
   beside it, and a green pulsing `GPS` lamp at the right. The old centred version
   and its separate tagline paragraph are gone.
3. `SectionLabel` — `今日邊樣用得着 · Four ways in`.
4. **The four plate rows**, in the order above. The minibus row is `raised`
   (`box-shadow: 0 3px 0 0 var(--brand)`).
5. **The tracked ride expands the minibus plate in place.** When `useRideTracker`
   has an active ride, the minibus card grows a second section under the plate:
   a `車上 ON BOARD` label, `下一站 駱克道`, `仲有 2 站` in `--sign-red`, and the
   full-width red 幫我嗌「有落」 button (`PressButton`, 48px, speaker icon). No
   active ride → the card is just the plate row and the button is not rendered.
6. `margin-top:auto` on the 我的收藏 / 設定 pair so it pins to the bottom edge,
   credits directly beneath.

Everything else about `page.tsx` stays: same routes, same `USER_LANGUAGES`
picker behaviour, same glyphs (巴 / 的 / 診 / 茶), same 999 rules.

## Two accepted variants of A

Both are in the design file. Build **one**; the rest of Part A is unchanged either way.

**A1 — bigger 有落 board (default).** As specced above but the `LedBoard` goes back to
the centred, stacked form from group `1a`: `有落` at 62px `DotGothic16` on its own line,
`YAU LOK!` 17px centred beneath it with `.22em` tracking, the whole board 18px padding
inside its 3px `--ink` frame and `0 3px 0 0 --ink` shadow, and the tagline paragraph
restored under it. Drop the `GPS` lamp — it does not fit the centred layout. This costs
about 70px, so the 茶餐廳 plate's expanded section is the first thing to give: collapse
the minibus card when there is no active ride, as already specced.

**A2 — 2×2 number board (group `5b`).** Different home entirely, same content:

- Black `--meter-bg` header band, full width, containing a small `有落` (34px) +
  `YAU LOK!` and the language pill in `--sign-amber` on a `1px solid #333` outline,
  with `香港仔 · 石排灣邨 · 26° 多雲` on a second line behind a green pulsing lamp.
- **2×2 grid of full-bleed livery tiles**, 10px gap, min-height 126px, each with a
  `0 3px 0 0` shadow in its own deep tone: 綠色小巴 `--brand` / 的士 `--sign-red` /
  急症室 `--amb-yellow` (6px battenburg strip across its top edge) / 茶餐廳
  `--sign-green` + mosaic grout. Each tile is glyph + status chip on the top row,
  then the number at 40px `Archivo 900` (`4 分`, `$96`, `3 小時`) or 30px
  `Noto Sans HK 700` (`0T 走冰`), then the name, then one line of context.
- Under the grid, the **active ride docks as a white card**: `而家車上 · On board`,
  a dot-matrix strip reading `下一站 駱克道 · 2 站到`, and the red
  幫我嗌「有落」 button. Hidden when no ride is tracked.
- 我的收藏／設定 pinned to the bottom, credits beneath.

A2 does not use the framed `LedBoard` at all, so it is not compatible with A1 —
pick one.

## Where the numbers come from

Do **not** hard-code them. Each is a small hook read with a skeleton fallback —
show the panel with the caption and a `—` while loading, never a spinner.

- 小巴 `4 分` — next ETA for the user's saved/nearest route (`lib/gmb.ts`).
- 的士 `$96` — `lib/taxi.ts` estimate to the last-used destination; if there is
  none, show the flagfall `$28.0` and caption `起錶 START`.
- 急症室 `3 小時` — HA A&E waiting-time feed for the nearest hospital.
- 茶餐廳 `0T 走冰` — the last chit's first line from local storage; if the user
  has never ordered, show `落單紙` and caption `未落過單`.

## `ScenarioTile` changes

Add to the existing component rather than forking it:

```ts
type ScenarioTileProps = {
  /* …existing… */
  panel?: {
    kind: "dotmatrix" | "meter" | "battenburg" | "mosaic";
    value: string;      // "4 分"
    caption: string;    // "NEXT 下一班"
  };
  children?: React.ReactNode; // the expanded section (minibus only)
};
```

`panel` renders the 104px right-hand block; `children` renders below a
`1px solid var(--rule)` divider inside the same card.

---

# B. 影餐牌 — photograph the menu, order off it (group `6a`)

## Why

A 茶餐廳 餐牌 is hand-set Chinese, no pictures, no English, and it differs shop to
shop — it is the one artefact a visitor cannot get past, and no database has it.
So the photo becomes the interface: shoot the board, the app reads it back as
tappable rows **in place**, and the user points at what they saw on the wall.

Ordering splits in two, and this split is the whole design:

- **揀嘢** — *what*. Straight off the photo.
- **特別要求** — *how*. This is where the shorthand lives, and it is the part a
  translation app cannot do: the chit must come out in the words the kitchen
  reads, not a translated sentence.

## Route and state

New route `app/cct/scan`, entered from the 茶餐廳 screen (`app/cct`) and from the
home 茶餐廳 plate. Four steps in one route, `?step=shoot|read|item|chit`, so back
works and a half-finished order survives a reload:

```ts
type ScanDraft = {
  photoId: string;            // IndexedDB key, not a data URL in localStorage
  items: RecognisedItem[];    // what OCR returned, user-editable
  order: OrderLine[];         // { itemId, tweaks: CctTweak[], price }
  table?: string;
};
```

Persist `ScanDraft` through `lib/prefs.ts`. The photo itself goes to IndexedDB —
a full-resolution menu photo will blow the localStorage quota.

## Step 1 — 影餐牌 (`step=shoot`)

Full-bleed black. `TopBar` transparent with 手動揀 on the right (falls back to
`CCT_MENU`, so the feature degrades to today's behaviour when OCR fails or the
user declines camera permission).

- Viewfinder: `flex:1`, 14px radius, 14px side margins.
- Four **`--melamine` corner brackets**, 34px arms, 4px stroke, inset 16px.
- Hint pill, centred, 64px above the bottom of the viewfinder:
  `對正張牌 · 影埋價錢嗰行` — `--melamine` on `rgba(0,0,0,.72)`, 1px
  `rgba(245,213,71,.5)` border.
- Controls row: 相簿 (opens `<input type="file" accept="image/*">`, this is the
  upload path — a photo already in the roll must work exactly as well as a live
  shot), a 76px shutter ring in `--melamine`, and 打燈 (torch). Both side
  buttons are 52px squares, 14px radius, `1px solid #333`.

## Step 2 — 認到嘅嘢 (`step=read`)

`TopBar variant="cct"` (mosaic green), title `認到 24 樣`, 重影一次 as a
`--melamine` pill on the right.

- **The photo stays on screen**, 12px-radius dark card at the top, the paper
  inside rotated `-0.8deg`. Recognised lines get `outline: 2px solid --melamine`
  with `outline-offset: 3px`; the currently-selected line switches to
  `--sign-red` outline plus `rgba(192,57,45,.1)` fill. Tapping a line in the
  photo selects it — the photo is a tap target, not decoration. Caption pill
  bottom-right: `撳張相都得`.
- Search field + a `--melamine-mint` category count chip (`飲品 6`).
- `認到嘅字 · Read off the photo` — one white row per item: Chinese 16px/900,
  the user's language 12px underneath, price in `--sign-red`, and a 34px ＋
  button (filled `--sign-red` when already in the order, `--tile-cream` when not).
- **Always render one low-confidence row** as a mint dashed hint pointing at a
  line the OCR could not resolve — in the design it is the surcharge line
  `睇唔清「凍飲 加 $4」嗰行 —— 撳一撳自己改`. It must name a line that is *not*
  in the recognised list, or the screen contradicts itself. Tapping it opens
  manual entry.
- Footer button: `落單紙 · N 樣嘢` with a running total chip.

## Step 3 — 特別要求 (`step=item`)

`TopBar variant="cct"`, item name + `由你張相認出` + price on the right.

Four groups, in this order:

1. **凍定熱** — `Segmented`, 凍 carries the shop's own `＋$4` in the label.
2. **特別要求 · 伙記睇得明嘅寫法** — 2-column grid of cards, each **the Chinese
   term 15px/900 with its plain-language gloss 11px underneath**: 走冰 (No ice),
   少甜 (Less sugar), 走甜 (No sugar), 多檸 (Extra lemon), 茶走 (Condensed milk,
   no sugar), 飛沙走奶 (No sugar, no milk). Selected = `--melamine` fill,
   `1.5px solid #c9a800`.
3. **跟餐嘅嘢** — pill row: 加底, 走青, 靚仔 (plain rice), 行街 (takeaway,
   selected state is `--sign-red`).
4. **仲有** — pill row: 少冰, 加蛋 ＋$6, 走辣, 唔要青瓜, and a dashed
   `--sign-red` 自己寫低 ＋ that opens a free-text field.

Then the **live chit preview** on ruled paper: `寫落單紙會係咁 · Reads as`,
the shorthand at 24px/700 `--sign-red` (`0T 走冰 少甜`), and the plain-language
read-back 12px underneath. This preview is the payoff of the whole screen —
it must update on every chip tap.

Footer: 加入落單紙 with the adjusted price (base + 凍 + 加蛋 …).

The tweak vocabulary already exists as `CCT_TWEAKS` in `data/cct-phrases.ts`
(`zau-bing`, `siu-tim`, `caa-zau`, `gaa-dai`, `kau-dai`, `zau-ceng`, `haang-gaai`).
**Extend that array** — do not start a second list. New ids needed:
`zau-tim`, `do-ning`, `fei-saa`, `siu-bing`, `gaa-daan`, `zau-laat`, `mou-cing-gwaa`,
plus `custom` for the free-text one. Every id needs a `cct.tweak.*` i18n key for
its gloss, and a `chit` string — the characters that get written on the paper.
The chit string is **never** translated.

## Step 4 — 落單紙 (`step=chit`)

Mosaic-green screen. Reuse **`OrderChit`** unchanged — it already takes
`table` / `seats` / `items` / `total`. Feed it the composed lines:

```
0T 走冰 少甜        26
餐蛋治 走青         38
西多士 行街         28
熱 9T 走甜          20
                  $112
```

Around it:

- Timestamp under 檯號: `14:26 · 落單`.
- A dashed `--melamine` row: `＋ 再影多張餐牌 / 加多樣嘢` → back to step 1 with
  the draft intact.
- `你自己睇 · What you ordered` — the same order in the user's own language,
  white on `rgba(255,255,255,.14)`. The diner reads this; the waiter reads the paper.
- **`伙記可能會問 · They may ask back`** — a `--melamine` card with the two
  questions a waiter will fire back and a one-tap answer each: 凍定熱？ (凍 / 熱)
  and 堂食定行街？ (堂食 / 行街). Tapping an answer rewrites the chit. This is the
  cheapest possible fix for the moment the user gets stuck mid-order.
- Bottom-pinned `俾伙記睇` — `--melamine` fill, 56px, eye icon; opens the chit
  full-screen at maximum brightness. Caption: `撳一撳全屏放大 · 唔使開口都落到單`.

## OCR

The recognition call belongs behind `lib/toolhub.ts` like every other model call —
add `recogniseMenu(photo: Blob): Promise<RecognisedItem[]>` there, server-side
via `lib/toolhub-server.ts`, so the key never reaches the client. Return
`{ id, zh, translated, price?, confidence, bbox }`; `bbox` is what draws the
outlines over the photo, so it must be in the photo's own coordinate space and
scale with the rendered image.

Rules:

- **Never invent a price.** If `price` is absent, the row shows `睇唔清 · 自己改`
  where the price would be, and the ＋ button is replaced by 改.
- Below a confidence threshold the row goes in the mint dashed hint, not the list.
- The whole feature must degrade to `CCT_MENU` (手動揀) when the camera is
  refused, OCR errors, or the photo has no readable text.

---

## Prompt for Claude Code

> Read `design_handoff_gmb_green_theme/README.md`,
> `README-liveries-taxi-ae-cct.md` and `README-home-and-menu-scan.md`, then open
> `design_handoff_gmb_green_theme/Yau Lok Green.dc.html` in a browser and look at
> groups `5c` and `6a`. Handoffs 1 and 2 are already merged.
>
> Do part A first: rebuild `app/page.tsx` to match `5c` exactly — the horizontal
> `LedBoard`, the four scenario plates each with a 104px full-bleed livery number
> panel on the right, the minibus plate expanding into 下一站 + 幫我嗌「有落」 when
> `useRideTracker` has an active ride, and 我的收藏／設定 pinned to the bottom.
> Extend `ScenarioTile` with a `panel` prop and `children`; do not fork it. Wire the
> four numbers to the real hooks with a `—` fallback, never hard-coded values.
>
> Then part B: build the new route `app/cct/scan` as four steps in one route
> (`?step=shoot|read|item|chit`) matching `6a` screen for screen. Camera **and**
> photo-library upload both feed the same path. Add `recogniseMenu()` to
> `lib/toolhub.ts` (server-side via `toolhub-server.ts`), draw the OCR bboxes as
> tappable outlines over the photo, persist the draft through `lib/prefs.ts` with
> the photo in IndexedDB, extend `CCT_TWEAKS` in `data/cct-phrases.ts` with the new
> modifier ids and their `cct.tweak.*` keys, and reuse `OrderChit` for the final
> chit. Never invent a price the OCR did not read; always fall back to `CCT_MENU`.
>
> Keep every existing token, component and i18n key. Ask me before adding any
> colour, font or dependency that is not already in `globals.css` or
> `package.json`.
