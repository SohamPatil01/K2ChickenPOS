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
    <div className="flex items-center text-[12px] text-ink-mute">
      {LOCALES.map((l, i) => (
        <span key={l.id} className="flex items-center">
          {i > 0 && <span className="px-0.5">/</span>}
          <button
            type="button"
            onClick={() => onChange(l.id)}
            className={`bg-transparent border-none h-auto px-1.5 py-0.5 cursor-pointer text-[12px] transition-colors ${
              locale === l.id ? 'text-flame-ink font-medium' : 'text-ink-mute hover:text-ink'
            }`}
          >
            {l.label}
          </button>
        </span>
      ))}
    </div>
  );
}
