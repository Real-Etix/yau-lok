"use client";

import { USER_LANGUAGES } from "@/data/languages";
import { Globe } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

/**
 * One control for one idea: the language you speak. It sets the interface
 * language AND the language we translate back into, because a user who
 * can't read English can't check an English back-translation either.
 */
export default function LanguagePicker({ hint }: { hint?: boolean }) {
  const { lang, setLang, t } = useLanguage();
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-muted">
        {t("app.language")}
      </span>
      <span className="field">
        <span className="field-icon">
          <Globe className="size-5" aria-hidden strokeWidth={2.2} />
        </span>
        <select
          className="field-select"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
        >
          {USER_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </span>
      {hint && (
        <span className="mt-1 block text-xs text-ink-faint">
          {t("app.languageHint")}
        </span>
      )}
    </label>
  );
}
