// HKGAI Modelhub speech synthesis proxy.
//
// TODO(hackathon, day 1): fill in the real Modelhub speech endpoint + payload
// from HKGAI Studio docs, then set HKGAI_SPEECH_URL / HKGAI_SPEECH_TOKEN in
// .env.local. Until then this returns 501 and the client falls back to the
// browser's zh-HK speechSynthesis voice, so the demo still works.

const SPEECH_URL = process.env.HKGAI_SPEECH_URL;
const SPEECH_TOKEN = process.env.HKGAI_SPEECH_TOKEN;

export async function POST(request: Request) {
  const { text } = await request.json();
  if (typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "text required" }, { status: 400 });
  }

  if (!SPEECH_URL || !SPEECH_TOKEN) {
    return Response.json(
      { error: "HKGAI speech not configured; use browser TTS fallback" },
      { status: 501 },
    );
  }

  const res = await fetch(SPEECH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SPEECH_TOKEN}`,
    },
    // Adjust payload to match Modelhub's speech API spec.
    body: JSON.stringify({ input: text, voice: "cantonese", format: "mp3" }),
  });
  if (!res.ok) {
    return Response.json(
      { error: `HKGAI speech failed: ${res.status}` },
      { status: 502 },
    );
  }
  return new Response(res.body, {
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "audio/mpeg" },
  });
}
