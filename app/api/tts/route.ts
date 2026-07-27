// HKGAI speech TTS proxy.
// Docs: Studio → Modelhub → Speech. Endpoint:
//   POST {HKGAI_SPEECH_URL}/server_proxy/api/v1/audio/speech
// Returns a WAV file; JSON on error. Falls back to 501 (browser TTS)
// when credentials are missing.

const SPEECH_HOST = process.env.HKGAI_SPEECH_URL; // e.g. https://openspeech.hkgai.net
const SPEECH_TOKEN = process.env.HKGAI_SPEECH_TOKEN;

export async function POST(request: Request) {
  const { text } = await request.json();
  if (typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "text required" }, { status: 400 });
  }

  if (!SPEECH_HOST || !SPEECH_TOKEN) {
    return Response.json(
      { error: "HKGAI speech not configured; use browser TTS fallback" },
      { status: 501 },
    );
  }

  const res = await fetch(
    `${SPEECH_HOST.replace(/\/+$/, "")}/server_proxy/api/v1/audio/speech`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SPEECH_TOKEN}`,
      },
      body: JSON.stringify({
        model_name: "tts-v1",
        input: text,
        language: "cantonese",
        voice: "female",
        type: "file",
        response_format: "wav",
      }),
    },
  );
  const contentType = res.headers.get("Content-Type") ?? "";
  if (!res.ok || contentType.includes("json")) {
    const detail = await res.text();
    return Response.json(
      { error: `HKGAI speech failed: ${res.status} ${detail.slice(0, 300)}` },
      { status: 502 },
    );
  }
  return new Response(res.body, {
    headers: { "Content-Type": contentType || "audio/wav" },
  });
}
