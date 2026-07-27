// HKGAI speech recognition proxy (no speaker labels).
// Docs: Studio → Modelhub → Speech. Endpoint:
//   POST {HKGAI_SPEECH_URL}/server_proxy/api/v1/speech_recognize
// Body in: { audioBase64: string, hotKeys?: string[] }
// Body out: HKGAI's JSON response (plain-text transcript inside).
//
// TODO(hackathon): switch lib/speech.ts listenCantonese() to record audio
// (MediaRecorder) and call this instead of the browser SpeechRecognition —
// HKGAI's Cantonese ASR should handle colloquial speech much better.

const SPEECH_HOST = process.env.HKGAI_SPEECH_URL;
const SPEECH_TOKEN = process.env.HKGAI_SPEECH_TOKEN;

export async function POST(request: Request) {
  const { audioBase64, hotKeys } = await request.json();
  if (typeof audioBase64 !== "string" || !audioBase64) {
    return Response.json({ error: "audioBase64 required" }, { status: 400 });
  }
  if (!SPEECH_HOST || !SPEECH_TOKEN) {
    return Response.json(
      { error: "HKGAI speech not configured; use browser ASR fallback" },
      { status: 501 },
    );
  }

  const res = await fetch(
    `${SPEECH_HOST.replace(/\/+$/, "")}/server_proxy/api/v1/speech_recognize`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SPEECH_TOKEN}`,
      },
      body: JSON.stringify({
        request_id: crypto.randomUUID(),
        resource: { type: 2, data: audioBase64 },
        config: { ddc: false, hot_keys: hotKeys ?? ["有落", "巴士站"] },
      }),
    },
  );
  const body = await res.text();
  if (!res.ok) {
    return Response.json(
      { error: `HKGAI ASR failed: ${res.status} ${body.slice(0, 300)}` },
      { status: 502 },
    );
  }
  return new Response(body, {
    headers: { "Content-Type": "application/json" },
  });
}
