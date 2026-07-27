// "Say it for me": free-text → colloquial Hong Kong Cantonese, ready to speak.
// The phrase pack covers the predictable moments; this covers everything else
// (HKGAI Modelhub chat, then /api/tts renders the audio).

import { chat, hkgaiConfigured } from "@/lib/hkgai";

const SYSTEM_PROMPT = `You help a non-Cantonese speaker say something out loud on a Hong Kong minibus or in daily HK life.
The user writes in English (or any language). Turn it into what a local would actually SAY.

Reply in strict JSON, no markdown:
{"cantonese":"<spoken Hong Kong Cantonese, 口語 not 書面語>","jyutping":"<jyutping with tone numbers>","english":"<literal back-translation so the user knows what they are about to say>","note":"<optional one-line politeness or context tip, else empty string>"}

Rules:
- Colloquial spoken Cantonese only (use 嘅/咗/唔該/呀, never 的/了/請問).
- Keep it short enough to shout or say in one breath.
- Stay polite; minibus drivers are busy. Prefer 唔該 openers.
- If the request is unsafe, rude, or would cause a dangerous action, return a
  polite neutral alternative instead and explain briefly in "note".`;

export async function POST(request: Request) {
  const { text } = await request.json();
  if (typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "text required" }, { status: 400 });
  }
  if (text.length > 300) {
    return Response.json({ error: "keep it under 300 characters" }, { status: 400 });
  }

  if (!hkgaiConfigured()) {
    return Response.json({
      cantonese: "唔該！",
      jyutping: "m4 goi1!",
      english: "(HKGAI not configured — showing a placeholder)",
      note: "",
      source: "fallback",
    });
  }

  try {
    const raw = await chat([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ]);
    const parsed = JSON.parse(
      raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1),
    );
    return Response.json({ ...parsed, source: "hkgai" });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "HKGAI request failed" },
      { status: 502 },
    );
  }
}
