// Translate the UI string catalogue into every language the app supports,
// using HKGAI Modelhub. Run once and commit the output — the app ships
// static dictionaries, so there is no translation cost or latency at runtime.
//
//   node scripts/translate-ui.mjs            # every language
//   node scripts/translate-ui.mjs cmn id     # only these
//   node scripts/translate-ui.mjs --missing  # only keys not yet translated
//
// Chinese text inside a string (有落, 唔該晒) must survive untouched: those
// are the phrases the user shows or shouts, not UI chrome.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

const BASE = (env.HKGAI_BASE_URL ?? "").replace(/\/+$/, "").replace(/\/v1$/, "") + "/v1";
const KEY = env.HKGAI_API_KEY;
const MODEL = env.HKGAI_CHAT_MODEL ?? "t2_hkgai-v3_fp8_1m_e7";
if (!KEY) {
  console.error("HKGAI_API_KEY missing from .env.local");
  process.exit(1);
}

// Keep in sync with data/languages.ts
const LANGUAGES = [
  [
    "zhHant",
    // Interface text in Hong Kong is 書面語, the way apps, signage and
    // newspapers are written. Left looser, the model mixes in colloquial
    // written Cantonese (俾/睇/嘅/喺), which reads inconsistent.
    "Traditional Chinese in the STANDARD WRITTEN form used in Hong Kong (書面語) — the register of app interfaces, signage and newspapers. Use 給/看/的/在/和/他們/沒有/不, NEVER the colloquial Cantonese forms 俾/睇/嘅/喺/同/佢哋/冇/唔/咗/嚟/啲/哋. Exception: leave any quoted Cantonese phrase the user will actually speak exactly as given",
  ],
  // "as used in Hong Kong" made the model produce written CANTONESE
  // (嗌/咗/散銀), which a mainland Mandarin speaker would struggle with.
  [
    "cmn",
    "Standard Mandarin Chinese in SIMPLIFIED characters, as a mainland Chinese speaker would write it. Do NOT use Cantonese words such as 嗌, 咗, 唔, 好少, 散銀 — use 喊, 了, 不, 很少, 零钱",
  ],
  ["id", "Indonesian (Bahasa Indonesia)"],
  ["fil", "Filipino (Tagalog)"],
  ["hi", "Hindi"],
  ["ne", "Nepali"],
  ["ur", "Urdu"],
  ["th", "Thai"],
];

const source = JSON.parse(readFileSync(join(root, "data/i18n/en.json"), "utf8"));
const args = process.argv.slice(2);
// --missing translates only keys a dictionary does not have yet, and merges.
// Full runs overwrite hand-corrected strings, so this is the safe default
// once a language has shipped.
const missingOnly = args.includes("--missing");
const only = args.filter((a) => !a.startsWith("--"));
const targets = only.length ? LANGUAGES.filter(([c]) => only.includes(c)) : LANGUAGES;

const SYSTEM = (language) => `You localise a mobile app used in Hong Kong by people who do not speak Cantonese.
Translate the VALUES of the given JSON into ${language}. Rules:
- Keep every key exactly as it is. Return the same JSON shape.
- Keep any Chinese characters inside a value UNCHANGED (e.g. 有落, 唔該晒, 香港大學) — those are phrases the user will show or say, not interface text.
- Keep "Yau Lok", "HKGAI", "Toolhub", "Modelhub", "Octopus", "GPS", "A&E" and "999" as they are.
- Keep it short: this is button and label text on a phone screen.
- Natural, everyday wording — not literal or formal translation.
Return ONLY the JSON object.`;

async function translateChunk(chunk, language) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM(language) },
        { role: "user", content: JSON.stringify(chunk, null, 1) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
  const raw = (await res.json()).choices[0].message.content;
  return JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
}

const CHUNK = 20; // smaller chunks = fewer malformed-JSON retries

for (const [code, language] of targets) {
  const path = join(root, `data/i18n/${code}.json`);
  let existing = {};
  if (missingOnly) {
    try {
      existing = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      /* first run for this language */
    }
  }
  const entries = Object.entries(source).filter(([k]) => !(k in existing));
  if (entries.length === 0) {
    console.log(` ${code}: already complete`);
    continue;
  }
  const out = { ...existing };
  let failed = 0;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = Object.fromEntries(entries.slice(i, i + CHUNK));
    try {
      Object.assign(out, await translateChunk(chunk, language));
      process.stdout.write(".");
    } catch (e) {
      failed++;
      Object.assign(out, chunk); // fall back to English for this chunk
      process.stdout.write("x");
    }
  }
  // Any key the model dropped falls back to English rather than disappearing.
  for (const k of Object.keys(source)) if (!(k in out)) out[k] = source[k];
  writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
  console.log(
    ` ${code}: ${Object.keys(out).length} keys (${entries.length} new)${failed ? `, ${failed} chunk(s) fell back to English` : ""}`,
  );
}
