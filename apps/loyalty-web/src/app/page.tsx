'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import {
  getToken,
  portalLogin,
  portalRegister,
  SHOP_WEBSITE,
} from '@/lib/api';
import { loadLocale, saveLocale, t, type Locale } from '@/lib/i18n';

type Mode = 'login' | 'register';

export default function HomePage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>('en');
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');
  const [errorKey, setErrorKey] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLocale(loadLocale());
    if (getToken()) router.replace('/points');
  }, [router]);

  const changeLocale = (l: Locale) => {
    setLocale(l);
    saveLocale(l);
  };

  const showError = (msg: string) => {
    setError(msg);
    setErrorKey((k) => k + 1);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'register' && pin !== pin2) {
      showError(t(locale, 'pinMismatch'));
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        await portalLogin(phone, pin);
      } else {
        await portalRegister(name, phone, pin, referralCode.trim() || undefined);
      }
      router.push('/points');
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        (err?.response?.data?.code === 'NO_PIN'
          ? t(locale, 'switchToRegister')
          : t(locale, 'errorGeneric'));
      showError(msg);
      if (err?.response?.data?.code === 'NO_PIN' || err?.response?.data?.code === 'NOT_FOUND') {
        setMode('register');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="anim-page flex-1 flex flex-col px-6 sm:px-10 py-8 sm:py-10 max-w-lg mx-auto w-full">
      <header className="flex items-start justify-between gap-4 mb-16 sm:mb-20">
        <div>
          <p className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            {t(locale, 'brand')}
          </p>
          <p className="mt-1 text-[0.7rem] tracking-[0.2em] uppercase text-ink-mute">
            {t(locale, 'tagline')}
          </p>
        </div>
        <LanguageSwitcher locale={locale} onChange={changeLocale} />
      </header>

      <div className="flex-1 flex flex-col justify-center pb-10">
        <div key={mode} className="anim-mode">
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.05] text-ink">
            {mode === 'login' ? t(locale, 'loginTitle') : t(locale, 'registerTitle')}
          </h1>
          <p className="mt-4 text-ink-soft text-[0.95rem] leading-relaxed max-w-sm">
            {t(locale, 'claimHint')}
          </p>
        </div>

        <form onSubmit={onSubmit} className="anim-stagger mt-10 space-y-7">
          {mode === 'register' && (
            <label className="block">
              <span className="loyalty-label">{t(locale, 'name')}</span>
              <input
                className="loyalty-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </label>
          )}

          <label className="block">
            <span className="loyalty-label">{t(locale, 'phone')}</span>
            <input
              className="loyalty-input"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 12))}
              required
              minLength={10}
              autoComplete="tel"
              placeholder="98xxxxxxxx"
            />
          </label>

          <label className="block">
            <span className="loyalty-label">
              {t(locale, 'pin')} · {t(locale, 'pinHint')}
            </span>
            <input
              className="loyalty-input tracking-[0.35em]"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              minLength={4}
              maxLength={6}
              autoComplete="current-password"
            />
          </label>

          {mode === 'register' && (
            <>
              <label className="block">
                <span className="loyalty-label">{t(locale, 'pinConfirm')}</span>
                <input
                  className="loyalty-input tracking-[0.35em]"
                  type="password"
                  inputMode="numeric"
                  value={pin2}
                  onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  minLength={4}
                  maxLength={6}
                  autoComplete="new-password"
                />
              </label>
              <label className="block">
                <span className="loyalty-label">{t(locale, 'referralCodeOptional')}</span>
                <input
                  className="loyalty-input uppercase tracking-widest"
                  value={referralCode}
                  onChange={(e) =>
                    setReferralCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8))
                  }
                  autoComplete="off"
                  placeholder="XXXXXX"
                />
              </label>
            </>
          )}

          {error && (
            <p
              key={errorKey}
              className="anim-shake text-sm text-flame border-l-2 border-flame pl-3 py-1"
            >
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="loyalty-btn mt-2">
            {busy ? t(locale, 'loading') : mode === 'login' ? t(locale, 'login') : t(locale, 'register')}
          </button>

          <button
            type="button"
            className="loyalty-btn-ghost w-full"
            onClick={() => {
              setError('');
              setMode(mode === 'login' ? 'register' : 'login');
            }}
          >
            {mode === 'login' ? t(locale, 'switchToRegister') : t(locale, 'switchToLogin')}
          </button>
        </form>
      </div>

      <footer className="pt-6 border-t border-line">
        <a
          href={SHOP_WEBSITE}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-ink-soft hover:text-flame transition-colors"
        >
          {t(locale, 'visitWebsite')} →
        </a>
      </footer>
    </main>
  );
}
