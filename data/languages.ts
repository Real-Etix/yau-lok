// Languages Yau Lok users actually speak. The model accepts input in any of
// them; this list also decides which language the confirmation is written
// back in — a Tagalog speaker can't check an English back-translation.
export type UserLanguage = {
  code: string;
  /** Shown in the picker, in the language itself */
  label: string;
  /** Name given to the model, in English, for the back-translation */
  name: string;
  /** BCP-47 tag for the browser speech-recognition fallback */
  bcp47: string;
  /** Right-to-left script — the whole document flips, not just text */
  rtl?: boolean;
};

export const USER_LANGUAGES: UserLanguage[] = [
  { code: "en", label: "English", name: "English", bcp47: "en-US" },
  {
    code: "zhHant",
    label: "繁體中文 · Traditional Chinese",
    name: "Traditional Chinese as written in Hong Kong",
    bcp47: "zh-HK",
  },
  { code: "cmn", label: "简体中文 · Mandarin", name: "Mandarin Chinese (simplified characters)", bcp47: "zh-CN" },
  { code: "id", label: "Bahasa Indonesia", name: "Indonesian", bcp47: "id-ID" },
  { code: "fil", label: "Filipino · Tagalog", name: "Filipino (Tagalog)", bcp47: "fil-PH" },
  { code: "hi", label: "हिन्दी · Hindi", name: "Hindi", bcp47: "hi-IN" },
  { code: "ne", label: "नेपाली · Nepali", name: "Nepali", bcp47: "ne-NP" },
  { code: "ur", label: "اردو · Urdu", name: "Urdu", bcp47: "ur-PK", rtl: true },
  { code: "th", label: "ไทย · Thai", name: "Thai", bcp47: "th-TH" },
];

export const DEFAULT_LANGUAGE_CODE = "en";

export function getLanguage(code: string | null | undefined): UserLanguage {
  return (
    USER_LANGUAGES.find((l) => l.code === code) ??
    USER_LANGUAGES.find((l) => l.code === DEFAULT_LANGUAGE_CODE)!
  );
}
