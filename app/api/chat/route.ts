import { chat, hkgaiConfigured } from "@/lib/hkgai";

const SYSTEM_PROMPT = `You are a Cantonese communication assistant for a passenger on a Hong Kong minibus who does not speak Cantonese.
Given something the driver (or another local) just said in Cantonese, reply in strict JSON:
{"english": "<plain-English meaning>", "reply_cantonese": "<short colloquial Cantonese reply the passenger could use, if one is needed, else empty string>", "reply_english": "<what that reply means>"}
Keep replies short, polite, colloquial Hong Kong Cantonese (口語, not 書面語).`;

export async function POST(request: Request) {
  const { transcript } = await request.json();
  if (typeof transcript !== "string" || !transcript.trim()) {
    return Response.json({ error: "transcript required" }, { status: 400 });
  }

  if (!hkgaiConfigured()) {
    // Offline fallback so the demo flow still works before keys are set.
    return Response.json({
      english: `(HKGAI not configured — raw transcript: ${transcript})`,
      reply_cantonese: "唔該晒！",
      reply_english: "Thank you!",
      source: "fallback",
    });
  }

  try {
    const raw = await chat([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: transcript },
    ]);
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    return Response.json({ ...parsed, source: "hkgai" });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "HKGAI request failed" },
      { status: 502 },
    );
  }
}
