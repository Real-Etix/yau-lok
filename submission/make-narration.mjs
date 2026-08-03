// Generate the Cantonese narration track from HKGAI's own TTS.
//
// Each line is rendered separately, then dropped at its cue time on a silent
// 4:10 bed, so the narration lines up with the clips without any editing. The
// gaps are load-bearing: they are where the app's own voice is heard.
//
//   node submission/make-narration.mjs           (dev server on :3001)
//   BASE=https://yau-lok.vercel.app node submission/make-narration.mjs

import { writeFile, mkdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const BASE = process.env.BASE ?? "http://localhost:3001";
const OUT = new URL("./narration.wav", import.meta.url).pathname;
const WORK = new URL("./.narr/", import.meta.url).pathname;
const TOTAL = 250; // 4:10, matching assemble.sh

// [seconds from start, Cantonese]
const LINES = [
  [0.4, "喺香港，唔識講廣東話，唔係聽唔明，係開唔到口。"],
  [14, "綠色小巴冇按鈴。你要自己嗌「有落」，唔嗌就過咗站。"],
  [30, "有落知道你去邊，夠鐘就幫你嗌出嚟。"],
  [59, "上的士之前就知道大概幾錢，同埋點樣同司機講清楚目的地。"],
  [94, "急症室輪候時間係實時嘅，資料直接嚟自醫管局。"],
  [110, "分流級別同收費，寫得清清楚楚。"],
  [129, "茶餐廳最難嘅唔係啲餸，係伙記寫嗰啲字。"],
  [146, "零T，走冰，走甜。呢個係廚房睇得明嘅寫法，唔係翻譯。"],
  [162, "舉高部電話俾伙記睇就得。"],
  [174, "影低塊餐牌，就可以直接落單。"],
  [192, "認錯咗？改得。價錢我哋唔會估，睇唔到就問返你。"],
  [214, "九種語言，唔係淨係中英文。"],
  [239, "有落。唔使驚，我幫你講。"],
];

await rm(WORK, { recursive: true, force: true });
await mkdir(WORK, { recursive: true });

const placed = [];
for (const [i, [at, text]] of LINES.entries()) {
  process.stdout.write(`  ${String(i + 1).padStart(2)}/${LINES.length} @${at}s `);
  const res = await fetch(`${BASE}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    console.log(`FAILED (${res.status}) — ${await res.text().catch(() => "")}`);
    console.log("\nTTS is not answering. Record NARRATION.md on your phone instead");
    console.log("and save it as submission/narration.m4a — assemble.sh takes either.");
    process.exit(1);
  }
  const file = `${WORK}${String(i).padStart(2, "0")}.wav`;
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  placed.push({ at, file });
  console.log("ok");
}

// One silent bed, every line delayed to its cue, all mixed down.
const inputs = placed.flatMap((p) => ["-i", p.file]);
const delays = placed
  .map((p, i) => `[${i + 1}:a]adelay=${Math.round(p.at * 1000)}|${Math.round(p.at * 1000)}[d${i}]`)
  .join(";");
const mix = placed.map((_, i) => `[d${i}]`).join("");

await run("ffmpeg", [
  "-y", "-loglevel", "error",
  "-f", "lavfi", "-t", String(TOTAL), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
  ...inputs,
  "-filter_complex",
  `${delays};[0:a]${mix}amix=inputs=${placed.length + 1}:duration=first:normalize=0[a]`,
  "-map", "[a]", "-ar", "48000", "-ac", "2", OUT,
]);

await rm(WORK, { recursive: true, force: true });
console.log(`\n  -> submission/narration.wav (${TOTAL}s)`);
console.log("  now: bash submission/assemble.sh");
