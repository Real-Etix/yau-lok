# Narration — 有落 demo

Cantonese voice, English subtitles. Read at a normal pace; the gaps are
deliberate, so the app's own audio in clips 02 and 05 can be heard.

Subtitles live in `narration.srt` and are burned in by `assemble.sh`. If you
change a line here, change it there too, or they will drift.

| Clip | In | Cantonese | Subtitle |
|---|---|---|---|
| 01 | 0:00 | 喺香港，唔識講廣東話，唔係聽唔明，係開唔到口。 | In Hong Kong the problem isn't understanding Cantonese — it's having to speak it. |
| 02 | 0:14 | 綠色小巴冇按鈴。你要自己嗌「有落」，唔嗌就過咗站。 | A green minibus has no bell. You shout 「有落」 — or you miss your stop. |
| 02 | 0:30 | 有落知道你去邊，夠鐘就幫你嗌出嚟。 | Yau Lok knows where you're going, and says it out loud for you. |
| 03 | 0:59 | 上的士之前就知道大概幾錢，同埋點樣同司機講清楚目的地。 | Know the fare before you get in — and say the destination clearly. |
| 04 | 1:34 | 急症室輪候時間係實時嘅，資料直接嚟自醫管局。 | A&E waits are live, straight from the Hospital Authority. |
| 04 | 1:50 | 分流級別同收費，寫得清清楚楚。 | Triage levels and fees, stated plainly. |
| 05 | 2:09 | 茶餐廳最難嘅唔係啲餸，係伙記寫嗰啲字。 | The hard part of a cha chaan teng isn't the food — it's what the waiter writes. |
| 05 | 2:26 | 0T 走冰 走甜。呢個係廚房睇得明嘅寫法，唔係翻譯。 | 「0T 走冰 走甜」 — the shorthand the kitchen reads, not a translation. |
| 05 | 2:42 | 舉高部電話俾伙記睇就得。 | Just hold up the phone. |
| 06 | 2:54 | 影低塊餐牌，就可以直接落單。 | Photograph the menu and order straight off it. |
| 06 | 3:12 | 認錯咗？改得。價錢我哋唔會估 —— 睇唔到就問返你。 | Misread a line? Fix it. We never invent a price we couldn't read. |
| 07 | 3:34 | 九種語言，唔係淨係中英文。 | Nine languages — not just Chinese and English. |
| 08 | 3:59 | 有落。唔使驚，我幫你講。 | 有落 — don't worry, I'll say it for you. |

## Generating the audio

With the dev server running:

```bash
node submission/make-narration.mjs
```

It calls your own `/api/tts` for each line, pads each to its slot, and writes
`submission/narration.wav`.

If HKGAI TTS is down, record the Cantonese column on your phone in one take
and save it as `submission/narration.m4a` — `assemble.sh` takes either.
