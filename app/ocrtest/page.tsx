"use client";

// TEMPORARY diagnostic page — delete before submitting.
// Runs the real recogniseMenu against (a) clean canvas-drawn Chinese and
// (b) any file you pick, and prints the raw result plus timings.

import { useState } from "react";
import { recogniseMenu } from "@/lib/toolhub";

export default function OcrTest() {
  const [log, setLog] = useState<string[]>([]);
  const say = (s: string) => setLog((l) => [...l, s]);

  async function runOn(blob: Blob, label: string) {
    say(`--- ${label} (${Math.round(blob.size / 1024)} KB) ---`);
    const t0 = performance.now();
    try {
      const items = await recogniseMenu(blob);
      say(`took ${Math.round(performance.now() - t0)} ms, ${items.length} items`);
      items.slice(0, 14).forEach((i) =>
        say(`  ${JSON.stringify(i.zh)}  price=${i.price ?? "-"}  conf=${Math.round(i.confidence)}`),
      );
      if (!items.length) say("  (nothing came back)");
    } catch (e) {
      say(`THREW: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
    }
  }

  // A clean, synthetic board: if this fails, the problem is the OCR setup,
  // not the photograph.
  async function synthetic() {
    setLog([]);
    const c = document.createElement("canvas");
    c.width = 900;
    c.height = 700;
    const x = c.getContext("2d")!;
    x.fillStyle = "#fff";
    x.fillRect(0, 0, 900, 700);
    x.fillStyle = "#000";
    const rows: [string, string][] = [
      ["乾炒牛河", "$62"],
      ["焗豬扒飯", "$68"],
      ["沙嗲牛肉麵", "$48"],
      ["火腿通粉", "$40"],
      ["西多士", "$30"],
      ["凍檸茶", "$27"],
      ["奶茶", "$24"],
    ];
    rows.forEach(([zh, p], i) => {
      x.font = '700 44px "PingFang HK", "Heiti TC", sans-serif';
      x.fillText(zh, 60, 90 + i * 85);
      x.textAlign = "right";
      x.fillText(p, 840, 90 + i * 85);
      x.textAlign = "left";
    });
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
    await runOn(blob, "synthetic canvas board");
  }

  return (
    <main style={{ padding: 20, font: "13px/1.6 ui-monospace, monospace" }}>
      <h1 style={{ fontWeight: 800, fontSize: 18 }}>OCR diagnostic</h1>

      <div style={{ display: "flex", gap: 10, margin: "14px 0", flexWrap: "wrap" }}>
        <button
          onClick={synthetic}
          style={{ padding: "10px 14px", border: "1px solid #333", borderRadius: 8 }}
        >
          run synthetic
        </button>
        <label style={{ padding: "10px 14px", border: "1px solid #333", borderRadius: 8 }}>
          pick a photo
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setLog([]);
              const bmp = await createImageBitmap(f);
              say(`source image: ${bmp.width}x${bmp.height}`);
              bmp.close();
              await runOn(f, f.name);
            }}
          />
        </label>
      </div>

      <pre style={{ whiteSpace: "pre-wrap" }}>{log.join("\n")}</pre>
    </main>
  );
}
