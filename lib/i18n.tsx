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
} from "react";
import { DEFAULT_LANGUAGE_CODE, getLanguage } from "@/data/languages";
import en from "@/data/i18n/en.json";
import cmn from "@/data/i18n/cmn.json";
import id from "@/data/i18n/id.json";
import fil from "@/data/i18n/fil.json";
import hi from "@/data/i18n/hi.json";
import ne from "@/data/i18n/ne.json";
import ur from "@/data/i18n/ur.json";
import th from "@/data/i18n/th.json";

type Dict = Record<string, string>;

const DICTS: Record<string, Dict> = { en, cmn, id, fil, hi, ne, ur, th };

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
