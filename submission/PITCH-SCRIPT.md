# 10-minute recorded pitch — spoken script

**8:00 of talking + 2:00 of demo.** 1,031 words — 7.6 minutes at a normal
pitching pace, 8.6 if you go slowly. It is deliberately under eight minutes so
that pausing where you should does not push the total past ten.

Do not read it flat. Read it twice, then talk it. The bracketed times are when
to *leave* each slide.

If a sentence doesn't sound like you, change it. The only lines worth
protecting word-for-word are the ones in **bold**.

---

## 1 · 有落 — leave at 0:40

Hong Kong's green minibus has no bell.

There's no stop button, no announcement, no screen. When you want to get off,
you shout — in Cantonese — at the right moment. 「有落」. Two syllables.

If you don't shout, the driver doesn't stop. You end up somewhere you didn't
choose, walking back in the heat, and you'll be late.

People miss their stop not because they don't know the word — plenty do.
Because saying it out loud, to a stranger, at speed, in a language you don't
own, is hard.

**This is the app for the moment you can't.** It's called 有落 — Yau Lok.

---

## 2 · A translation app answers — leave at 1:35

Every translation app on the market is reactive. You open it, you ask, it
answers. Which means you already have to know what to ask, how, and — the hard
one — *when*.

**The difficult moments in Hong Kong aren't vocabulary problems. They're
timing problems.**

Knowing your stop is next. Knowing the meter should already be running.
Knowing what 0T means before the waiter walks away from your table.

A translation app can't help you with any of those, because by the time you
know to ask, the moment has gone.

有落 goes the other way round. It knows where you are, what's happening, and
what's about to happen — and it speaks first. **A translation app answers. It
never speaks first.**

---

## 3 · Who it's for — leave at 2:20

This isn't built for tourists.

There are over 370,000 domestic helpers in Hong Kong — Indonesian, Filipino,
Thai. Many have been here five, ten, fifteen years. They know the city
perfectly well. They still can't shout 有落 on a moving minibus.

Then there are non-Chinese-speaking residents — Nepali, Urdu, Hindi — many of
them born here.

These are not people who need Cantonese lessons. They need to get off a
minibus today.

So the whole interface runs in **nine languages** — 579 translated strings,
every screen, including right-to-left for Urdu. Not the output. The whole app.

---

## 4 · Four moments — leave at 3:10

We picked four places where Cantonese isn't optional, and where a phrasebook
genuinely doesn't help.

The **green minibus** — no bell, you shout or you walk back.

The **taxi** — say the destination clearly enough that a moving driver
understands, then know whether the route you're on is the right one.

The **A&E department** — describing symptoms under pressure, to someone about
to make a triage decision about you.

And the **cha chaan teng** — where the difficulty isn't the food, it's the
ordering.

Four moments. Four completely different problems. Each one gets its own
livery in the app, so you know what you're holding before you read a word.

---

## 5 · It shouts 有落 for you — leave at 4:05

Take the minibus, because it's the hardest.

You pick your route. The app pulls **live arrival times from the government's
own minibus data feed**, and then it tracks you along the route by GPS.

Here's the part that matters. When you're two stops away, **the alert fires on
your lock screen.** Phone in your pocket, screen off — it buzzes, and there's
a Cantonese chime — no watching a map for twenty minutes hoping you notice.

You take the phone out. There's one big red button. You press it, and HKGAI
speaks 「唔該，有落」 out loud, in Cantonese, at conversational volume.

You never said a word. You still got off at your stop.

---

## 6 · It runs — leave at 4:55

These are screenshots of the running app. Not mockups.

*(walk left to right)*

Live tracking on board — next stop on a dot-matrix board, because that's what
a minibus windscreen actually looks like.

The alert, on the lock screen, with the button already on it.

講病情 — you describe your symptoms in your own language and it comes back as
Cantonese, with romanisation underneath so you can read it aloud yourself if
you'd rather.

And the order chit, which I want to talk about properly.

---

## 7 · 0T 走冰 少甜 — leave at 5:50

This is the part a translation app cannot do.

In a cha chaan teng the waiter writes your order in trade shorthand. 0T is
iced lemon tea — it's a pun, 零 and 檸 sound alike. 走冰 is no ice. 少甜 is
less sugar.

Now: if you hand a waiter a phone that says "iced lemon tea, no ice, less
sugar" in English, or even in standard written Chinese, you have made their
job harder, not easier.

**The chit has to come out as 走冰. Not as "no ice".**

So it does. Twenty-five modifications, twenty-nine dishes, all in the register
a kitchen accepts. The translation sits underneath in small type — that part
is for you, not for them.

That distinction — what the kitchen reads versus what you read — is the whole
product in one screen.

---

## 8 · Built on HKGAI — leave at 6:40

Every Cantonese word you'll hear in the demo came from HKGAI.

**Modelhub** does the Cantonese generation and the speech — that's the voice
that shouts 有落, reads the chit, and speaks your symptoms.

**Toolhub** gives us transport, geolocation, healthcare. **Agenthub** handles
live service-status questions.

On top of that, government open data directly: minibus arrivals, and Hospital
Authority A&E waits.

The point is that this isn't a wrapper with a Cantonese sticker on it. The
Cantonese is the product, and it's HKGAI's Cantonese.

---

## 9 · What we chose not to fake — leave at 7:25

One honest thing, because I'd rather you heard it from me.

The menu photography uses on-device OCR. It reads prices reliably. It reads
hand-set Chinese dish names **poorly** — roughly two-thirds right on a clean
board, worse on a real one.

We had two options: hide that, or design for it.

**So the app never invents a price it couldn't read. It asks you.** Every line
is editable, one tap. And if the photo fails completely, the whole feature
falls back to a standard menu you can tap through instead.

HKGAI has no vision model today — I checked properly before building this.
We didn't pretend otherwise.

---

## 10 · Close — leave at 8:00

有落. It runs right now, on your phone, in nine languages, at
yau-lok.vercel.app.

It won't teach you Cantonese. That's not the promise.

The promise is that on a Tuesday afternoon, on a minibus in Kowloon, when
you're two stops from home and your Cantonese has deserted you — **something
speaks for you.**

唔使驚。我幫你講。

Let me show you.

*(advance to the demo, click play, say nothing for two minutes)*

---

## Delivery notes

- **Slow down on slide 2 and slide 7.** Those are the two arguments. Everything
  else is supporting material.
- **Pause after "It never speaks first."** Let it land.
- Slide 9 is a strength, not an apology — say it evenly, not defensively.
- When the demo starts, stop talking completely. The video has its own
  narration; talking over it makes both unintelligible.
- If you overrun by more than 20 seconds at slide 5, cut slide 3 to its first
  and last sentence.

## If you'd rather pitch in Cantonese

The argument works in either language, and for this challenge Cantonese would
land well. The one thing that must stay in English is nothing — say it all in
Cantonese if you prefer. Ask and I'll translate the whole script.
