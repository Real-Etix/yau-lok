"use client";

// Speech I/O with graceful degradation:
//   TTS: HKGAI Modelhub speech (via /api/tts) → browser speechSynthesis (zh-HK)
//   ASR: HKGAI Modelhub speech (via /api/asr) → browser SpeechRecognition (zh-HK)
// The fallbacks make the demo work even before HKGAI speech is wired up.

export async function speakCantonese(text: string): Promise<"hkgai" | "browser"> {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audio.volume = 1;
      await audio.play();
      return "hkgai";
    }
  } catch {
    // fall through to browser TTS
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-HK";
  utterance.rate = 0.95;
  utterance.volume = 1;
  const voice = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang.replace("_", "-") === "zh-HK");
  if (voice) utterance.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return "browser";
}

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void;
  onerror: (e: { error: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

/** Listen once and resolve with a Cantonese transcript. */
export function listenCantonese(): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      reject(new Error("Speech recognition not supported in this browser"));
      return;
    }
    const rec = new Ctor();
    rec.lang = "zh-HK";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let settled = false;
    rec.onresult = (e) => {
      settled = true;
      resolve(e.results[0][0].transcript);
    };
    rec.onerror = (e) => {
      settled = true;
      reject(new Error(e.error));
    };
    rec.onend = () => {
      if (!settled) reject(new Error("No speech detected"));
    };
    rec.start();
  });
}
