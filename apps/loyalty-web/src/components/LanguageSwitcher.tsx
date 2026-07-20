'use client';

import { LOCALES, type Locale } from '@/lib/i18n';

export function LanguageSwitcher({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (l: Locale) => void;
}) {
  return (
    <div className="flex items-center gap-3 text-[0.7rem] tracking-[0.12em] uppercase">
      {LOCALES.map((l, i) => (
        <span key={l.id} className="flex items-center gap-3">
          {i > 0 && <span className="text-ink-mute">/</span>}
          <button
            type="button"
            onClick={() => onChange(l.id)}
            className={`transition-colors duration-200 ${
              locale === l.id ? 'text-flame font-semibold' : 'text-ink-mute hover:text-ink'
            }`}
          >
            {l.label}
          </button>
        </span>
      ))}
    </div>
  );
}
