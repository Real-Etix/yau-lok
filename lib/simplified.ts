"use client";

// Hong Kong's open transport data is Traditional Chinese only — stop names,
// route names and the Observatory's weather wording all arrive as 繁體. A
// Mandarin reader who picked 简体中文 should not be handed 繁體, so those
// strings are converted at render time.
//
// Imported dynamically, and only ever fetched for the one language that needs
// it. Use the `t2cn` entry point, not the package root: the root ships both
// conversion directions and costs 1.2 MB, this one is 103 KB. Until it lands,
// callers get the Traditional text back — readable, just not yet converted.

type Convert = (text: string) => string;

let convert: Convert | null = null;
let started = false;
const listeners = new Set<() => void>();

export function loadSimplified() {
  if (started) return;
  started = true;
  import("opencc-js/t2cn")
    .then((OpenCC) => {
      convert = OpenCC.Converter({ from: "hk", to: "cn" });
      listeners.forEach((l) => l());
    })
    .catch(() => {
      // Offline or blocked: Traditional stays on screen rather than nothing.
    });
}

export function subscribeSimplified(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function simplifiedReady() {
  return convert !== null;
}

export function simplify(text: string) {
  return convert ? convert(text) : text;
}
