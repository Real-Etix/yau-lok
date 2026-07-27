"use client";

// Speech I/O, degradation order:
//   TTS: pre-generated phrase audio (/audio/{id}.wav, instant, offline-safe)
//        → HKGAI openspeech via /api/tts → browser speechSynthesis (zh-HK)
//   ASR: mic → 16 kHz WAV → HKGAI speech_recognize via /api/asr
//        → browser SpeechRecognition (zh-HK)

async function playUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const type = res.headers.get("Content-Type") ?? "";
    if (!type.startsWith("audio")) return false;
    const audio = new Audio(URL.createObjectURL(await res.blob()));
    audio.volume = 1;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

function browserSpeak(text: string) {
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
}

/**
 * Speak a phrase from the pack: cached file first (generated at build time by
 * scripts/generate-phrase-audio.mjs), then live HKGAI TTS, then browser voice.
 */
export async function speakPhrase(
  id: string,
  text: string,
): Promise<"cached" | "hkgai" | "browser"> {
  if (await playUrl(`/audio/${id}.wav`)) return "cached";
  return speakCantonese(text);
}

/** Speak arbitrary Cantonese text (dynamic content, e.g. suggested replies). */
export async function speakCantonese(
  text: string,
): Promise<"hkgai" | "browser"> {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const audio = new Audio(URL.createObjectURL(await res.blob()));
      audio.volume = 1;
      await audio.play();
      return "hkgai";
    }
  } catch {
    // fall through to browser TTS
  }
  browserSpeak(text);
  return "browser";
}

// ---------------------------------------------------------------------------
// ASR

const RECORD_MS = 4000;
const TARGET_SAMPLE_RATE = 16000;

/** Encode an AudioBuffer's first channel as 16-bit mono PCM WAV. */
function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const samples = buffer.getChannelData(0);
  const out = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(out);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return out;
}

async function recordWavBase64(): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  try {
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.start();
    await new Promise((r) => setTimeout(r, RECORD_MS));
    recorder.stop();
    await done;

    const raw = await new Blob(chunks).arrayBuffer();
    const ctx = new AudioContext();
    const decoded = await ctx.decodeAudioData(raw);
    await ctx.close();

    // Resample to 16 kHz mono for the recognizer.
    const frames = Math.ceil(decoded.duration * TARGET_SAMPLE_RATE);
    const offline = new OfflineAudioContext(1, frames, TARGET_SAMPLE_RATE);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    const resampled = await offline.startRendering();

    const bytes = new Uint8Array(encodeWav(resampled));
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

async function hkgaiListen(): Promise<string> {
  const audioBase64 = await recordWavBase64();
  const res = await fetch("/api/asr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioBase64 }),
  });
  if (!res.ok) throw new Error(`ASR ${res.status}`);
  const body = await res.json();
  // HKGAI shape: { code: 200, msg, data: { result: "text", ... } }
  const text = body?.data?.result;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("No speech recognized");
  }
  return text;
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

function browserListen(): Promise<string> {
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

/**
 * Listen once (~4 s) and resolve with a Cantonese transcript.
 * HKGAI's recognizer first; browser SpeechRecognition as fallback.
 */
export async function listenCantonese(): Promise<string> {
  try {
    return await hkgaiListen();
  } catch {
    return browserListen();
  }
}
