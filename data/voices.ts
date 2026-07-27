// HKGAI Cantonese TTS personas (Modelhub speech).
// tts-v1 takes female/male; tts-v2 takes named presets.
export type VoicePersona = {
  key: string; // also the /public/audio/<key>/ folder name
  model: "tts-v1" | "tts-v2";
  voice: string;
  label: string;
};

export const VOICE_PERSONAS: VoicePersona[] = [
  { key: "v1-female", model: "tts-v1", voice: "female", label: "經典女聲 · Classic Female" },
  { key: "v1-male", model: "tts-v1", voice: "male", label: "經典男聲 · Classic Male" },
  { key: "auntie", model: "tts-v2", voice: "Cantonese_暖心师奶", label: "暖心師奶 · Warm Auntie" },
  { key: "trendy", model: "tts-v2", voice: "Cantonese_潮流女声", label: "潮流女聲 · Trendy Female" },
  { key: "cool", model: "tts-v2", voice: "Cantonese_潮酷男声", label: "潮酷男聲 · Cool Male" },
  { key: "ahsir", model: "tts-v2", voice: "Cantonese_金牌阿Sir", label: "金牌阿Sir · Gold-Badge Sir" },
];

export const DEFAULT_PERSONA_KEY = "v1-female";

export function getPersona(key: string | null | undefined): VoicePersona {
  return (
    VOICE_PERSONAS.find((p) => p.key === key) ??
    VOICE_PERSONAS.find((p) => p.key === DEFAULT_PERSONA_KEY)!
  );
}
