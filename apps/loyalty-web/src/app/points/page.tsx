'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PointsReels } from '@/components/PointsReels';
import {
  getToken,
  logout,
  portalChangePin,
  portalMe,
  portalUpdateProfile,
  type PortalCustomer,
  type PortalProfile,
} from '@/lib/api';
import { SHOP } from '@/lib/shop';
import { loadLocale, saveLocale, t, type Locale } from '@/lib/i18n';
import { nextTierProgress, titleCaseTier } from '@/lib/tiers';

function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length < 4) return phone;
  return `${d.slice(0, 2)}${'X'.repeat(Math.max(0, d.length - 4))}${d.slice(-2)}`;
}

function formatPhoneDisplay(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`;
  if (d.length === 12 && d.startsWith('91')) {
    return `${d.slice(2, 4)} ${d.slice(4, 8)} ${d.slice(8)}`;
  }
  return phone;
}

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export default function PointsPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>('en');
  const [customer, setCustomer] = useState<PortalCustomer | null>(null);
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cashierOpen, setCashierOpen] = useState(false);
  const [billAmount, setBillAmount] = useState(800);

  const [showPinForm, setShowPinForm] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPin2, setNewPin2] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileArea, setProfileArea] = useState('');
  const [profileLine1, setProfileLine1] = useState('');
  const [profileLine2, setProfileLine2] = useState('');
  const [profileCity, setProfileCity] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);

  const loadProfile = () =>
    portalMe()
      .then((p) => {
        setProfile(p);
        setCustomer(p.customer);
        setProfileName(p.customer.name || '');
        setProfileArea(p.customer.area || '');
        setProfileLine1(p.address?.line1 || '');
        setProfileLine2(p.address?.line2 || '');
        setProfileCity(p.address?.city || '');
      })
      .catch(() => {
        setFailed(true);
        logout();
        router.replace('/');
      });

  useEffect(() => {
    setLocale(loadLocale());
    if (!getToken()) {
      router.replace('/');
      return;
    }
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const points = customer ? Math.round(customer.loyaltyPoints) : 0;
  const tierInfo = useMemo(
    () => nextTierProgress(customer?.totalSpent || 0, customer?.loyaltyTier || 'BRONZE'),
    [customer?.totalSpent, customer?.loyaltyTier]
  );

  const redeemPlan = useMemo(() => {
    const used = Math.min(points, billAmount);
    const pay = Math.max(0, billAmount - used);
    const earn = Math.round(pay * 0.0125);
    return { used, pay, earn };
  }, [points, billAmount]);

  const onSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileErr('');
    setProfileMsg('');
    setProfileBusy(true);
    try {
      const updated = await portalUpdateProfile({
        name: profileName,
        area: profileArea || undefined,
        address: {
          line1: profileLine1,
          line2: profileLine2 || undefined,
          city: profileCity,
        },
      });
      setProfile(updated);
      setCustomer(updated.customer);
      setProfileMsg(t(locale, 'profileSaved'));
      if (updated.profile.isComplete) setShowProfileForm(false);
    } catch (err: any) {
      setProfileErr(err?.response?.data?.error || t(locale, 'errorGeneric'));
    } finally {
      setProfileBusy(false);
    }
  };

  const changeLocale = (l: Locale) => {
    setLocale(l);
    saveLocale(l);
  };

  const onLogout = () => {
    logout();
    router.replace('/');
  };

  const copyReferral = async () => {
    if (!customer?.referralCode) return;
    try {
      await navigator.clipboard.writeText(customer.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
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

  if (failed) return null;

  return (
    <main className="anim-page flex-1 flex flex-col justify-start px-0 sm:px-4 py-0 sm:py-8">
      <div className="pp-card w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5">
          <div>
            <div className="font-medium text-ink">{t(locale, 'brand')}</div>
            {customer ? (
              <div className="pp-mute text-[12px]">
                {t(locale, 'hiPrefix')} {customer.name.split(' ')[0]} · {maskPhone(customer.phone)}
              </div>
            ) : (
              <div className="pp-mute text-[12px] anim-loading">{t(locale, 'loading')}</div>
            )}
          </div>
          <div className="text-right">
            <LanguageSwitcher locale={locale} onChange={changeLocale} />
            {customer && (
              <button
                type="button"
                onClick={onLogout}
                className="block ml-auto bg-transparent border-none text-[12px] text-ink-mute cursor-pointer px-1.5 py-0.5 hover:text-ink"
              >
                {t(locale, 'logout')}
              </button>
            )}
          </div>
        </div>

        {/* Balance hero */}
        <div className="px-5 pb-5 pt-1">
          <div className="pp-lab">{t(locale, 'pointsTitle')}</div>
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <PointsReels value={customer ? customer.loyaltyPoints : null} />
            {customer && (
              <span className="pp-pill self-center">{titleCaseTier(customer.loyaltyTier)}</span>
            )}
          </div>
          {customer && (
            <p className="text-[15px] mt-1 text-ink">
              {t(locale, 'worthPrefix')} {inr(points)} {t(locale, 'worthSuffix')}
            </p>
          )}
          {customer && customer.loyaltyPoints === 0 && (
            <p className="mt-2 pp-mute">{t(locale, 'welcomeZero')}</p>
          )}
          <button
            type="button"
            className="pp-btn pp-btn-p w-full mt-4 h-[50px] text-[16px]"
            disabled={!customer}
            onClick={() => setCashierOpen(true)}
          >
            <CashIcon />
            {t(locale, 'showCashier')}
          </button>
        </div>

        {/* Cashier view */}
        {cashierOpen && customer && (
          <div className="px-5 py-[22px] bg-ink text-paper text-center">
            <div className="text-[12px] tracking-[0.12em] uppercase text-[#F2A27F]">
              {t(locale, 'cashierTitle')}
            </div>
            <div className="text-[36px] font-medium tracking-[0.04em] text-paper my-2">
              {formatPhoneDisplay(customer.phone)}
            </div>
            <div className="text-[14px] text-[#E4D6BE]">
              {t(locale, 'cashierRedeemUpTo')}{' '}
              <span className="text-paper font-medium">{points}</span> points · {inr(points)} off
            </div>
            <button
              type="button"
              className="pp-btn mt-3.5 bg-transparent text-paper border-[#E4D6BE]"
              onClick={() => setCashierOpen(false)}
            >
              {t(locale, 'cashierClose')}
            </button>
          </div>
        )}

        {/* Next tier */}
        {customer && (
          <div className="pp-sec">
            <div className="flex justify-between mb-2">
              <span className="pp-lab">{t(locale, 'nextTier')}</span>
              <span className="pp-mute text-[12px]">
                {tierInfo.next
                  ? `${titleCaseTier(tierInfo.next)} · ${inr(tierInfo.target)}`
                  : titleCaseTier(tierInfo.current)}
              </span>
            </div>
            <div className="pp-bar">
              <span
                className="pp-bar-fill"
                style={{ width: `${Math.round(tierInfo.progress * 100)}%` }}
              />
            </div>
            <p className="pp-mute mt-2">
              {tierInfo.next ? (
                <>
                  {t(locale, 'spendMorePrefix')} {inr(tierInfo.remaining)}{' '}
                  {t(locale, 'spendMoreSuffix')} {titleCaseTier(tierInfo.next)}{' '}
                  {t(locale, 'andEarnMore')}
                </>
              ) : (
                t(locale, 'tierMax')
              )}
            </p>
          </div>
        )}

        {/* Redeem planner */}
        {customer && points > 0 && (
          <div className="pp-sec bg-paper-warm">
            <div className="pp-lab">{t(locale, 'planRedeem')}</div>
            <p className="my-1.5 mb-2.5 text-[14px]">
              {t(locale, 'ifBillIs')} <b className="font-medium">{inr(billAmount)}</b>
            </p>
            <input
              className="pp-range"
              type="range"
              min={100}
              max={3000}
              step={50}
              value={billAmount}
              aria-label="Bill amount"
              onChange={(e) => setBillAmount(Number(e.target.value))}
            />
            <div className="flex gap-2.5 mt-3">
              <div className="flex-1 bg-white border-[0.5px] border-line rounded-[10px] px-3 py-2.5">
                <div className="pp-mute text-[12px]">{t(locale, 'pointsUsed')}</div>
                <div className="text-[22px] font-medium">{redeemPlan.used}</div>
              </div>
              <div className="flex-1 bg-white border-[0.5px] border-line rounded-[10px] px-3 py-2.5">
                <div className="pp-mute text-[12px]">{t(locale, 'youPay')}</div>
                <div className="text-[22px] font-medium text-flame-ink">{inr(redeemPlan.pay)}</div>
              </div>
            </div>
            <p className="pp-mute mt-2 text-[12px]">
              {t(locale, 'earnAbout')} {redeemPlan.earn} {t(locale, 'newPointsOnBill')}
            </p>
          </div>
        )}

        {/* Profile reward */}
        {profile && (
          <div className="pp-sec">
            <div className="flex gap-2.5 items-start px-3 py-2.5 border-l-[3px] border-flame bg-white">
              <DiscountIcon />
              <div className="min-w-0 flex-1">
                {profile.reward.redeemed ? (
                  <>
                    <p className="text-[14px]">{t(locale, 'profileRewardRedeemedBanner')}</p>
                  </>
                ) : profile.reward.pending ? (
                  <>
                    <p className="text-[14px]">10% off is waiting</p>
                    <p className="pp-mute text-[12px]">{t(locale, 'profileRewardPendingBanner')}</p>
                  </>
                ) : (
                  <>
                    <p className="text-[14px]">{t(locale, 'profileRewardBanner')}</p>
                    {!profile.profile.isComplete && (
                      <p className="pp-mute text-[12px] mt-0.5">
                        {t(locale, 'profileMissingLabel')}:{' '}
                        {profile.profile.missing
                          .map((m) =>
                            m === 'name'
                              ? t(locale, 'profileMissingName')
                              : t(locale, 'profileMissingAddress')
                          )
                          .join(', ')}
                      </p>
                    )}
                  </>
                )}

                {!showProfileForm && !profile.profile.isComplete && (
                  <button
                    type="button"
                    onClick={() => setShowProfileForm(true)}
                    className="mt-2 text-[13px] font-medium text-flame"
                  >
                    {t(locale, 'profileEdit')}
                  </button>
                )}
                {profile.profile.isComplete && !showProfileForm && (
                  <button
                    type="button"
                    onClick={() => setShowProfileForm(true)}
                    className="mt-2 text-[12px] text-ink-mute underline"
                  >
                    {t(locale, 'profileComplete')}
                  </button>
                )}
                {profileMsg && !showProfileForm && (
                  <p className="mt-1.5 text-[13px] text-ink-soft">{profileMsg}</p>
                )}

                {showProfileForm && (
                  <form onSubmit={onSaveProfile} className="mt-3 space-y-4">
                    <label className="block">
                      <span className="loyalty-label">{t(locale, 'name')}</span>
                      <input
                        className="loyalty-input"
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="loyalty-label">{t(locale, 'profileArea')}</span>
                      <input
                        className="loyalty-input"
                        type="text"
                        value={profileArea}
                        onChange={(e) => setProfileArea(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className="loyalty-label">{t(locale, 'profileLine1')}</span>
                      <input
                        className="loyalty-input"
                        type="text"
                        value={profileLine1}
                        onChange={(e) => setProfileLine1(e.target.value)}
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="loyalty-label">{t(locale, 'profileLine2')}</span>
                      <input
                        className="loyalty-input"
                        type="text"
                        value={profileLine2}
                        onChange={(e) => setProfileLine2(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className="loyalty-label">{t(locale, 'profileCity')}</span>
                      <input
                        className="loyalty-input"
                        type="text"
                        value={profileCity}
                        onChange={(e) => setProfileCity(e.target.value)}
                        required
                      />
                    </label>
                    {profileErr && (
                      <p className="text-sm text-flame border-l-[3px] border-flame pl-3">
                        {profileErr}
                      </p>
                    )}
                    <button type="submit" disabled={profileBusy} className="pp-btn pp-btn-p w-full">
                      {profileBusy ? t(locale, 'loading') : t(locale, 'profileSave')}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Referral */}
        {customer?.referralCode && (
          <div className="pp-sec">
            <div className="pp-lab">{t(locale, 'referralTitle')}</div>
            <p className="pp-mute my-1 mb-2.5">{t(locale, 'referralHint')}</p>
            <div className="flex justify-between items-center bg-white border-[0.5px] border-dashed border-line-strong rounded-[10px] px-3.5 py-2.5">
              <span className="text-[24px] font-medium tracking-[0.16em]">
                {customer.referralCode}
              </span>
              <button type="button" className="pp-btn h-9" onClick={copyReferral}>
                {copied ? t(locale, 'copied') : t(locale, 'shareCode')}
              </button>
            </div>
          </div>
        )}

        {/* How to redeem */}
        <div className="pp-sec">
          <div className="pp-lab">{t(locale, 'howToRedeem')}</div>
          <div className="text-[14px] mt-1.5 space-y-0.5">
            <p>1. {t(locale, 'redeemStep1')}</p>
            <p>2. {t(locale, 'redeemStep2')}</p>
            <p>3. {t(locale, 'redeemStep3')}</p>
          </div>
          <p className="pp-mute mt-2 text-[12px]">{t(locale, 'earnRuleShort')}</p>
        </div>

        {/* Shop */}
        <div className="pp-sec">
          <div className="pp-lab">{t(locale, 'shopDetails')}</div>
          <p className="text-[14px] font-normal my-1 mb-2">{SHOP.address}</p>
          <p className="pp-mute text-[12px]">
            Closed Monday · Tue, Wed, Fri to Sun 8 AM to 8 PM · Thu until 1 PM
          </p>
          <div className="flex gap-2 mt-3">
            <a href={SHOP.phoneHref} className="pp-btn pp-btn-p flex-1">
              {t(locale, 'callShop')}
            </a>
            <a
              href={SHOP.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pp-btn flex-1"
            >
              {t(locale, 'maps')}
            </a>
          </div>

          <div className="mt-3.5 text-center">
            <button
              type="button"
              onClick={() => {
                setShowPinForm((v) => !v);
                setPinErr('');
                setPinMsg('');
              }}
              className="pp-mute text-[12px] bg-transparent border-none cursor-pointer hover:text-ink"
            >
              {t(locale, 'changePin')}
            </button>
            {pinMsg && <p className="mt-1 text-[13px] text-ink-soft">{pinMsg}</p>}
            {showPinForm && (
              <form onSubmit={onChangePin} className="mt-4 space-y-4 text-left">
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
                  <p className="text-sm text-flame border-l-[3px] border-flame pl-3">{pinErr}</p>
                )}
                <button type="submit" disabled={pinBusy} className="pp-btn pp-btn-p w-full">
                  {pinBusy ? t(locale, 'loading') : t(locale, 'savePin')}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function CashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 8h14v11H5V8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 8V6.5A1.5 1.5 0 0 1 9.5 5h5A1.5 1.5 0 0 1 16 6.5V8" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="13.5" r="2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function DiscountIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-flame mt-0.5">
      <path
        d="M9.5 9.5h.01M14.5 14.5h.01M8 16l8-8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="9.5" cy="9.5" r="1" fill="currentColor" />
      <circle cx="14.5" cy="14.5" r="1" fill="currentColor" />
      <rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
