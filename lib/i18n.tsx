"use client";

// Interface language. Dictionaries are generated once by
// scripts/translate-ui.mjs (HKGAI Modelhub) and shipped as static JSON, so
// switching language costs nothing at runtime.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  loadSimplified,
  simplify,
  simplifiedReady,
  subscribeSimplified,
} from "@/lib/simplified";
import { DEFAULT_LANGUAGE_CODE, getLanguage } from "@/data/languages";
import en from "@/data/i18n/en.json";
import zhHant from "@/data/i18n/zhHant.json";
import cmn from "@/data/i18n/cmn.json";
import id from "@/data/i18n/id.json";
import fil from "@/data/i18n/fil.json";
import hi from "@/data/i18n/hi.json";
import ne from "@/data/i18n/ne.json";
import ur from "@/data/i18n/ur.json";
import th from "@/data/i18n/th.json";

type Dict = Record<string, string>;

const DICTS: Record<string, Dict> = { en, zhHant, cmn, id, fil, hi, ne, ur, th };

export const STORAGE_KEY = "yau-lok-lang";

type Ctx = {
  lang: string;
  setLang: (code: string) => void;
  /** Translate a key, falling back to English then the key itself. */
  t: (key: string) => string;
};

const LanguageContext = createContext<Ctx>({
  lang: DEFAULT_LANGUAGE_CODE,
  setLang: () => {},
  t: (k) => (en as Dict)[k] ?? k,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState(DEFAULT_LANGUAGE_CODE);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && DICTS[saved]) setLangState(saved);
  }, []);

  // Urdu reads right-to-left; the whole document has to flip, not just text.
  useEffect(() => {
    const meta = getLanguage(lang);
    document.documentElement.lang = meta.bcp47;
    document.documentElement.dir = meta.rtl ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((code: string) => {
    if (!DICTS[code]) return;
    setLangState(code);
    localStorage.setItem(STORAGE_KEY, code);
  }, []);

  const t = useCallback(
    (key: string) => DICTS[lang]?.[key] ?? (en as Dict)[key] ?? key,
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/** Shorthand for components that only need the translator. */
export function useT() {
  return useContext(LanguageContext).t;
}

/**
 * Stop names are bilingual in the source data, and which half leads depends on
 * who is reading. A Chinese reader wants 石排灣邨公共運輸交匯處 first; everyone
 * else wants the English first — but never *only* English, because the sign at
 * the kerb and the driver both speak Chinese.
 */
export function useStopName() {
  const { lang } = useContext(LanguageContext);
  const chineseFirst = lang === "zhHant" || lang === "cmn";
  const sc = useSimplify();
  return useCallback(
    (stop?: { name: { tc: string; en: string } } | null) => {
      if (!stop) return { primary: "", secondary: "" };
      const tc = sc(stop.name.tc);
      const enName = stop.name.en;
      const primary = (chineseFirst ? tc : enName) || tc || enName || "";
      const secondaryRaw = chineseFirst ? enName : tc;
      // Don't repeat yourself when only one name exists.
      const secondary = secondaryRaw && secondaryRaw !== primary ? secondaryRaw : "";
      return { primary, secondary };
    },
    [chineseFirst, sc],
  );
}

/**
 * Converts Traditional Chinese coming from Hong Kong open data into Simplified
 * for readers who chose 简体中文. Every other language gets the string back
 * untouched, and never downloads the conversion table.
 */
export function useSimplify() {
  const { lang } = useContext(LanguageContext);
  const needed = lang === "cmn";
  const ready = useSyncExternalStore(
    subscribeSimplified,
    simplifiedReady,
    () => false,
  );
  useEffect(() => {
    if (needed) loadSimplified();
  }, [needed]);
  return useCallback(
    (text: string) => (needed && ready && text ? simplify(text) : text),
    [needed, ready],
  );
}

/** A place name kept in both scripts, so the reader picks it, not the writer. */
export type NamePair = { en: string; tc: string };

/**
 * Picks the reader's side of any bilingual `{ en, tc }` the Hong Kong feeds
 * return — hospital names, districts, waiting-time bands. Mandarin readers
 * get the Traditional text converted, exactly as stop names are.
 *
 * A bare string is passed through unchanged: saved routes written before this
 * carry one resolved name rather than a pair, and re-rendering that in another
 * language is not possible — but neither is losing it.
 */
export function useBilingual() {
  const { lang } = useContext(LanguageContext);
  const chinese = lang === "zhHant" || lang === "cmn";
  const sc = useSimplify();
  return useCallback(
    (pair?: NamePair | string | null) => {
      if (!pair) return "";
      if (typeof pair === "string") return pair;
      return chinese ? sc(pair.tc) || pair.en : pair.en || pair.tc;
    },
    [chinese, sc],
  );
}
