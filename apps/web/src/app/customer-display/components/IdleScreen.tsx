"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BRAND, LOYALTY, REFERRAL } from "@/lib/customerDisplay/brand";
import QrCode from "@/components/customerDisplay/QrCode";
import styles from "./IdleScreen.module.css";

const SLIDE_MS = 9000;
type SlideId = "loyalty" | "referral";
const SLIDES: SlideId[] = ["loyalty", "referral"];

export default function IdleScreen() {
  const [slide, setSlide] = useState(0);
  const active = SLIDES[slide];

  useEffect(() => {
    const id = setTimeout(() => {
      setSlide((i) => (i + 1) % SLIDES.length);
    }, SLIDE_MS);
    return () => clearTimeout(id);
  }, [slide]);

  return (
    <div className={styles.root}>
      <div className={styles.burst} aria-hidden />

      <main className={styles.stage}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.brandMark}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BRAND.logoPath} alt="" />
            </div>
            <div>
              <div className={styles.brandName}>{BRAND.name}</div>
              <div className={styles.brandTag}>{BRAND.displayTagline}</div>
            </div>
          </div>
          <div className={styles.openPill}>
            <span className={styles.openDot} />
            {BRAND.openPill}
          </div>
        </header>

        <section className={styles.carousel}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              className={`${styles.slide} ${
                active === "loyalty" ? styles.themeRewards : styles.themeReferral
              }`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              {active === "loyalty" ? <LoyaltySlide /> : <ReferralSlide />}
            </motion.div>
          </AnimatePresence>
        </section>

        <div className={styles.controls}>
          {SLIDES.map((id, i) => (
            <button
              key={id}
              type="button"
              aria-label={id === "loyalty" ? "Loyalty rewards" : "Referral bonus"}
              className={`${styles.dot} ${i === slide ? styles.dotActive : ""}`}
              style={{ ["--dur" as string]: `${SLIDE_MS / 1000}s` }}
              onClick={() => setSlide(i)}
            >
              {i === slide && (
                <span key={`fill-${slide}`} className={styles.dotFill} />
              )}
            </button>
          ))}
        </div>

        <div className={styles.orderbar}>
          <span className={styles.orderLabel}>
            <b>Welcome!</b> Your order will appear here
          </span>
        </div>
      </main>
    </div>
  );
}

function LoyaltySlide() {
  const accent = LOYALTY.headlineAccent;
  const full = LOYALTY.headline;
  const accentAt = full.lastIndexOf(accent);
  const lead = accentAt > 0 ? full.slice(0, accentAt) : full;
  const accentText = accentAt >= 0 ? full.slice(accentAt) : "";

  return (
    <>
      <div className={styles.slideBody}>
        <span className={styles.eyebrow}>{LOYALTY.title}</span>
        <h1 className={styles.headline}>
          {lead ? <span className={styles.headlineLead}>{lead}</span> : null}
          {accentText ? (
            <span className={styles.accent}>{accentText}</span>
          ) : null}
        </h1>
        <p className={styles.sub}>{LOYALTY.subhead}</p>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={styles.statBig}>
              <CountUp value={LOYALTY.earnPercent} decimals={2} />%
            </div>
            <div className={styles.statCap}>{LOYALTY.earnDetail}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statBig}>{LOYALTY.redeemLabel}</div>
            <div className={styles.statCap}>{LOYALTY.redeemDetail}</div>
          </div>
        </div>
        <div className={styles.chips}>
          {LOYALTY.tips.map((tip) => (
            <span key={tip} className={styles.chip}>
              {tip}
            </span>
          ))}
        </div>
      </div>
      <QrPanel
        url={LOYALTY.portalUrl}
        hint={LOYALTY.portalHint}
        host={LOYALTY.portalUrl.replace(/^https?:\/\//, "")}
      />
    </>
  );
}

function ReferralSlide() {
  const accent = REFERRAL.headlineAccent;
  const full = REFERRAL.headline;
  const accentAt = full.lastIndexOf(accent);
  const lead = accentAt > 0 ? full.slice(0, accentAt) : full;
  const accentText = accentAt >= 0 ? full.slice(accentAt) : "";

  return (
    <>
      <div className={styles.slideBody}>
        <span className={styles.eyebrow}>{REFERRAL.title}</span>
        <h1 className={styles.headline}>
          {lead ? <span className={styles.headlineLead}>{lead}</span> : null}
          {accentText ? (
            <span className={styles.accent}>{accentText}</span>
          ) : null}
        </h1>
        <p className={styles.sub}>{REFERRAL.subhead}</p>
        <div className={styles.rewardPair}>
          <div className={styles.rewardCard}>
            <div className={styles.rewardAmt}>{REFERRAL.bonusLabel}</div>
            <div className={styles.rewardWho}>{REFERRAL.youLabel}</div>
          </div>
          <div className={styles.rewardPlus} aria-hidden>
            +
          </div>
          <div className={styles.rewardCard}>
            <div className={styles.rewardAmt}>{REFERRAL.bonusLabel}</div>
            <div className={styles.rewardWho}>{REFERRAL.friendLabel}</div>
          </div>
        </div>
        <div className={styles.steps}>
          {REFERRAL.howItWorks.map((step, i) => (
            <div key={step} className={styles.step}>
              <span className={styles.stepN}>{i + 1}</span>
              {step}
            </div>
          ))}
        </div>
      </div>
      <QrPanel
        url={REFERRAL.inviteUrl}
        hint={REFERRAL.portalHint}
        host={LOYALTY.portalUrl.replace(/^https?:\/\//, "")}
      />
    </>
  );
}

function QrPanel({
  url,
  hint,
  host,
}: {
  url: string;
  hint: string;
  host: string;
}) {
  return (
    <aside className={styles.qrPanel}>
      <div className={styles.qrFrame}>
        <i className={styles.qrC3} />
        <i className={styles.qrC4} />
        <QrCode value={url} size={160} margin={1} alt={hint} />
      </div>
      <div className={styles.qrCta}>
        <div className={styles.qrLead}>{hint}</div>
        <div className={styles.qrUrl}>{host}</div>
      </div>
      <div className={styles.phoneHint}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <rect x="6" y="2" width="12" height="20" rx="3" />
          <line x1="10" y1="18" x2="14" y2="18" />
        </svg>
        Point your camera here
      </div>
    </aside>
  );
}

function CountUp({ value, decimals }: { value: number; decimals: number }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setN(value);
      return;
    }
    const start = performance.now();
    const dur = 1100;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setN(value * e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{n.toFixed(decimals)}</>;
}
