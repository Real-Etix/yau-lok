// Pre-generate HKGAI Cantonese audio for the phrase pack into public/audio/,
// so the demo speaks instantly and works offline on venue Wi-Fi.
//
//   node scripts/generate-phrase-audio.mjs [model] [voice]
//
// Defaults: HKGAI_TTS_MODEL/HKGAI_TTS_VOICE from .env.local, else tts-v1 female.
// Also logs per-call latency (the README's "measure TTS latency" item).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

const HOST = (env.HKGAI_SPEECH_URL ?? "").replace(/\/+$/, "");
const TOKEN = env.HKGAI_SPEECH_TOKEN;
if (!HOST || !TOKEN) {
  console.error("Set HKGAI_SPEECH_URL and HKGAI_SPEECH_TOKEN in .env.local");
  process.exit(1);
}
const model = process.argv[2] ?? env.HKGAI_TTS_MODEL ?? "tts-v1";
const voice = process.argv[3] ?? env.HKGAI_TTS_VOICE ?? "female";

// Keep ids in sync with data/phrases.ts (+ the approach chime).
const PHRASES = [
  ["yau-lok", "唔該，有落！"],
  ["bus-stop", "唔該，巴士站有落！"],
  ["traffic-light", "唔該，燈位有落！"],
  ["after-turn", "唔該，轉彎位有落！"],
  ["does-it-go", "司機，去唔去銅鑼灣呀？"],
  ["how-much", "唔該，幾多錢呀？"],
  ["excuse-me", "唔該借借！"],
  ["chime", "就到喇！"],
];

const outDir = join(root, "public", "audio");
mkdirSync(outDir, { recursive: true });

for (const [id, text] of PHRASES) {
  const t0 = Date.now();
  const res = await fetch(`${HOST}/server_proxy/api/v1/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      model_name: model,
      input: text,
      language: "cantonese",
      voice,
      type: "file",
      response_format: "wav",
    }),
  });
  const ms = Date.now() - t0;
  if (!res.ok || (res.headers.get("Content-Type") ?? "").includes("json")) {
    console.error(`✗ ${id}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(outDir, `${id}.wav`), buf);
  console.log(`✓ ${id}.wav  ${(buf.length / 1024).toFixed(0)} KB  ${ms} ms  (${model}/${voice})`);
}
