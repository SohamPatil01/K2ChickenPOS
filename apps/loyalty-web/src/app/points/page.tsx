'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PointsReels } from '@/components/PointsReels';
import {
  getToken,
  logout,
  portalChangePin,
  portalMe,
  SHOP_WEBSITE,
  type PortalCustomer,
} from '@/lib/api';
import { SHOP } from '@/lib/shop';
import { loadLocale, saveLocale, t, type Locale } from '@/lib/i18n';

export default function PointsPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>('en');
  const [customer, setCustomer] = useState<PortalCustomer | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPinForm, setShowPinForm] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPin2, setNewPin2] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

  useEffect(() => {
    setLocale(loadLocale());
    if (!getToken()) {
      router.replace('/');
      return;
    }
    portalMe()
      .then(setCustomer)
      .catch(() => {
        setFailed(true);
        logout();
        router.replace('/');
      });
  }, [router]);

  const changeLocale = (l: Locale) => {
    setLocale(l);
    saveLocale(l);
  };

  const onLogout = () => {
    logout();
    router.replace('/');
  };

  const shareReferral = async () => {
    if (!customer?.referralCode) return;
    const text = `Join K2 Chicken loyalty with my code ${customer.referralCode} — or tell them my number ${customer.phone} at the counter. Both get 50 points after your first paid bill. https://loyalty.k2chicken.com`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'K2 Chicken Loyalty', text });
        return;
      }
    } catch {
      /* fall through to copy */
    }
    try {
      await navigator.clipboard.writeText(
        `${customer.referralCode} · ${customer.phone}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const onChangePin = async (e: FormEvent) => {
    e.preventDefault();
    setPinErr('');
    setPinMsg('');
    if (newPin !== newPin2) {
      setPinErr(t(locale, 'pinMismatch'));
      return;
    }
    setPinBusy(true);
    try {
      await portalChangePin(currentPin, newPin);
      setPinMsg(t(locale, 'pinChanged'));
      setCurrentPin('');
      setNewPin('');
      setNewPin2('');
      setShowPinForm(false);
    } catch (err: any) {
      setPinErr(err?.response?.data?.error || t(locale, 'errorGeneric'));
    } finally {
      setPinBusy(false);
    }
  };

  if (failed) {
    return null;
  }

  const worth = customer ? Math.round(customer.loyaltyPoints) : 0;

  return (
    <main className="anim-page flex-1 flex flex-col px-6 sm:px-10 py-8 sm:py-10 max-w-lg mx-auto w-full">
      <header className="flex items-start justify-between gap-4 mb-14 sm:mb-16">
        <div>
          <p className="font-display text-xl font-extrabold tracking-tight text-ink">
            {t(locale, 'brand')}
          </p>
          {customer ? (
            <>
              <p className="mt-2 text-ink-soft text-sm anim-mode">{customer.name}</p>
              <p className="text-ink-mute text-xs tracking-wide">{customer.phone}</p>
            </>
          ) : (
            <p className="mt-2 text-ink-mute text-sm anim-loading">{t(locale, 'loading')}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-4">
          <LanguageSwitcher locale={locale} onChange={changeLocale} />
          {customer && (
            <button type="button" onClick={onLogout} className="loyalty-btn-ghost !p-0 text-xs">
              {t(locale, 'logout')}
            </button>
          )}
        </div>
      </header>

      <section className="flex-1 flex flex-col justify-center">
        <p className="text-[0.68rem] tracking-[0.18em] uppercase text-ink-mute">
          {t(locale, 'pointsTitle')}
        </p>
        <PointsReels value={customer ? customer.loyaltyPoints : null} />

        {customer && (
          <div className="anim-mode">
            <p className="mt-4 text-sm text-ink-soft">
              {t(locale, 'worthPrefix')}{' '}
              <span className="font-semibold text-ink">₹{worth.toLocaleString('en-IN')}</span>{' '}
              {t(locale, 'worthSuffix')}
            </p>

            {customer.loyaltyPoints === 0 && (
              <p className="mt-3 text-ink-soft text-sm max-w-xs">{t(locale, 'welcomeZero')}</p>
            )}

            <div className="mt-10 pt-8 border-t border-line">
              <p className="text-[0.68rem] tracking-[0.18em] uppercase text-ink-mute">
                {t(locale, 'tier')}
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-flame">{customer.loyaltyTier}</p>
            </div>

            <div className="mt-10 pt-8 border-t border-line">
              <p className="text-[0.68rem] tracking-[0.18em] uppercase text-ink-mute mb-4">
                {t(locale, 'howToRedeem')}
              </p>
              <ol className="space-y-3 text-sm text-ink-soft">
                <li className="flex gap-3">
                  <span className="text-flame font-bold tabular-nums">1</span>
                  <span>{t(locale, 'redeemStep1')}</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-flame font-bold tabular-nums">2</span>
                  <span>{t(locale, 'redeemStep2')}</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-flame font-bold tabular-nums">3</span>
                  <span>{t(locale, 'redeemStep3')}</span>
                </li>
              </ol>
              <p className="mt-5 text-ink font-medium text-[0.95rem] leading-snug border-l-2 border-flame pl-4">
                {t(locale, 'redeemAtShop')}
              </p>
            </div>

            <div className="mt-10 pt-8 border-t border-line">
              <p className="text-[0.68rem] tracking-[0.18em] uppercase text-ink-mute mb-3">
                {t(locale, 'shopDetails')}
              </p>
              <p className="text-sm text-ink-soft leading-relaxed">{SHOP.address}</p>
              <p className="mt-3 text-[0.68rem] tracking-[0.18em] uppercase text-ink-mute">
                {t(locale, 'shopHours')}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                {SHOP.hoursLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={SHOP.phoneHref}
                  className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold bg-flame text-white"
                >
                  {t(locale, 'callShop')}
                </a>
                <a
                  href={SHOP.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold border border-line text-ink hover:border-flame transition-colors"
                >
                  {t(locale, 'maps')}
                </a>
              </div>
            </div>

            <div className="mt-10 pt-8 border-t border-line">
              <p className="text-[0.68rem] tracking-[0.18em] uppercase text-ink-mute mb-2">
                {t(locale, 'referralTitle')}
              </p>
              <p className="text-sm text-ink-soft leading-relaxed">{t(locale, 'referralHint')}</p>
              {customer.referralCode && (
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[0.68rem] tracking-[0.14em] uppercase text-ink-mute">
                      {t(locale, 'referralCode')}
                    </p>
                    <p className="mt-1 font-display text-3xl font-extrabold tracking-[0.2em] text-ink">
                      {customer.referralCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={shareReferral}
                    className="shrink-0 px-4 py-2.5 text-sm font-semibold border border-line hover:border-flame transition-colors"
                  >
                    {copied ? t(locale, 'copied') : t(locale, 'shareCode')}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-10 pt-8 border-t border-line">
              <button
                type="button"
                onClick={() => {
                  setShowPinForm((v) => !v);
                  setPinErr('');
                  setPinMsg('');
                }}
                className="text-sm font-semibold text-flame"
              >
                {t(locale, 'changePin')}
              </button>
              {pinMsg && <p className="mt-2 text-sm text-ink-soft">{pinMsg}</p>}
              {showPinForm && (
                <form onSubmit={onChangePin} className="mt-5 space-y-5">
                  <label className="block">
                    <span className="loyalty-label">{t(locale, 'currentPin')}</span>
                    <input
                      className="loyalty-input tracking-[0.35em]"
                      type="password"
                      inputMode="numeric"
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      minLength={4}
                      maxLength={6}
                    />
                  </label>
                  <label className="block">
                    <span className="loyalty-label">{t(locale, 'newPin')}</span>
                    <input
                      className="loyalty-input tracking-[0.35em]"
                      type="password"
                      inputMode="numeric"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      minLength={4}
                      maxLength={6}
                    />
                  </label>
                  <label className="block">
                    <span className="loyalty-label">{t(locale, 'pinConfirm')}</span>
                    <input
                      className="loyalty-input tracking-[0.35em]"
                      type="password"
                      inputMode="numeric"
                      value={newPin2}
                      onChange={(e) => setNewPin2(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      minLength={4}
                      maxLength={6}
                    />
                  </label>
                  {pinErr && (
                    <p className="text-sm text-flame border-l-2 border-flame pl-3">{pinErr}</p>
                  )}
                  <button type="submit" disabled={pinBusy} className="loyalty-btn">
                    {pinBusy ? t(locale, 'loading') : t(locale, 'savePin')}
                  </button>
                </form>
              )}
            </div>

            <ul className="anim-stagger mt-10 space-y-3 text-sm text-ink-soft">
              <li className="flex gap-3">
                <span className="text-flame shrink-0">—</span>
                <span>{t(locale, 'earnRule')}</span>
              </li>
              <li className="flex gap-3">
                <span className="text-flame shrink-0">—</span>
                <span>{t(locale, 'redeemRule')}</span>
              </li>
            </ul>
          </div>
        )}
      </section>

      <footer className="pt-10 mt-8 border-t border-line">
        <a
          href={SHOP_WEBSITE}
          target="_blank"
          rel="noopener noreferrer"
          className={`loyalty-btn ${!customer ? 'pointer-events-none opacity-40' : ''}`}
        >
          {t(locale, 'visitWebsite')}
        </a>
      </footer>
    </main>
  );
}
