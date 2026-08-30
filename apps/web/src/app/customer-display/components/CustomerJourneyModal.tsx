"use client";

import { formatINR } from "@/lib/customerDisplay/brand";

export type CustomerJourneyStep = "identify" | "register" | "loyalty";

export interface CustomerJourneyMatch {
  id: string;
  name: string;
  phone: string;
  area?: string;
  loyaltyPoints?: number;
}

export interface SelectedDisplayCustomer {
  id: string;
  name: string;
  phone: string;
  loyaltyPoints: number;
}

export default function CustomerJourneyModal({
  step,
  phone,
  name,
  matches,
  customer,
  billTotal,
  earnedEstimate,
  redeemablePoints,
  saveState,
  onTapPhone,
  onTapName,
  onSelectMatch,
  onRegister,
  onRedeem,
  onKeep,
  onNewCustomer,
  onSkip,
}: {
  step: CustomerJourneyStep;
  phone: string;
  name: string;
  matches: CustomerJourneyMatch[];
  customer: SelectedDisplayCustomer | null;
  billTotal: number;
  earnedEstimate: number;
  redeemablePoints: number;
  saveState: "idle" | "sent" | "error";
  onTapPhone: () => void;
  onTapName: () => void;
  onSelectMatch: (match: CustomerJourneyMatch) => void;
  onRegister: () => void;
  onRedeem: () => void;
  onKeep: () => void;
  onNewCustomer: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/20 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-orange-100 bg-[#fffaf4] text-slate-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-orange-100 px-7 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b5422b]">
              K2 Rewards
            </p>
            <h2 className="mt-1 text-2xl font-black sm:text-3xl">
              {step === "loyalty"
                ? `Welcome${customer?.name ? `, ${customer.name}` : ""}!`
                : "Earn rewards on this bill"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-full px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-orange-50"
          >
            Skip
          </button>
        </div>

        <div className="space-y-5 px-7 py-6">
          <div className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-orange-100">
            <span className="text-sm font-semibold text-slate-500">Current bill</span>
            <span className="text-2xl font-black text-[#a92e21]">{formatINR(billTotal)}</span>
          </div>

          {step === "identify" && (
            <>
              <p className="text-base text-slate-600">
                Enter your mobile number to find your customer account.
              </p>
              <button
                type="button"
                onClick={onTapPhone}
                className="w-full rounded-2xl border-2 border-orange-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-[#d65a32]"
              >
                <span className="block text-xs font-bold uppercase tracking-wide text-slate-400">
                  Mobile number
                </span>
                <span className={`mt-1 block text-2xl font-black tracking-wider ${phone ? "text-slate-900" : "text-slate-300"}`}>
                  {phone || "Tap to enter"}
                </span>
              </button>

              {matches.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
                  <p className="border-b border-orange-100 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                    Matching customers
                  </p>
                  {matches.slice(0, 6).map((match) => (
                    <button
                      type="button"
                      key={match.id}
                      onClick={() => onSelectMatch(match)}
                      className="flex min-h-14 w-full items-center justify-between border-b border-orange-50 px-4 py-3 text-left last:border-0 hover:bg-orange-50 active:bg-orange-100"
                    >
                      <span>
                        <span className="block font-bold text-slate-800">{match.name || "Customer"}</span>
                        <span className="block text-sm text-slate-500">
                          {match.phone.replace(/^(\d{4})\d+(\d{2})$/, "$1••••••$2")}
                          {match.area ? ` · ${match.area}` : ""}
                        </span>
                      </span>
                      <span className="text-xl text-[#d65a32]">›</span>
                    </button>
                  ))}
                </div>
              )}

              {phone.replace(/\D/g, "").length >= 10 && matches.length === 0 && (
                <button
                  type="button"
                  onClick={onNewCustomer}
                  className="w-full rounded-xl border border-dashed border-orange-300 bg-orange-50 px-4 py-3 text-left font-semibold text-[#a92e21]"
                >
                  No account found — create one with your name
                </button>
              )}

              <button
                type="button"
                onClick={onSkip}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-600 hover:bg-slate-50"
              >
                I&apos;ll tell the cashier
              </button>
            </>
          )}

          {step === "register" && (
            <>
              <p className="text-base text-slate-600">
                Just your name and mobile number are needed. No email or address required.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={onTapPhone}
                  className="rounded-2xl border-2 border-orange-200 bg-white px-4 py-4 text-left"
                >
                  <span className="block text-xs font-bold uppercase tracking-wide text-slate-400">Mobile</span>
                  <span className="mt-1 block truncate text-lg font-bold">{phone || "Tap to enter"}</span>
                </button>
                <button
                  type="button"
                  onClick={onTapName}
                  className="rounded-2xl border-2 border-orange-200 bg-white px-4 py-4 text-left"
                >
                  <span className="block text-xs font-bold uppercase tracking-wide text-slate-400">Name</span>
                  <span className={`mt-1 block truncate text-lg font-bold ${name ? "text-slate-900" : "text-slate-300"}`}>
                    {name || "Tap to enter"}
                  </span>
                </button>
              </div>
              {saveState === "error" && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  Please enter a valid mobile number and your name.
                </p>
              )}
              {saveState === "sent" && (
                <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  Saving your rewards account…
                </p>
              )}
              <button
                type="button"
                onClick={onRegister}
                disabled={saveState === "sent"}
                className="w-full rounded-xl bg-[#b98269] px-4 py-3.5 font-black text-white shadow-lg shadow-[#8f6758]/15 transition hover:bg-[#a97059] disabled:opacity-50"
              >
                {saveState === "sent" ? "Saving…" : "Continue"}
              </button>
            </>
          )}

          {step === "loyalty" && customer && (
            <>
              <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 px-5 py-5 ring-1 ring-orange-200">
                <p className="text-sm font-semibold text-slate-500">Your current balance</p>
                <p className="mt-1 text-4xl font-black text-[#a92e21]">
                  {customer.loyaltyPoints} <span className="text-lg">points</span>
                </p>
                <p className="mt-1 text-sm font-medium text-slate-600">
                  This bill earns approximately {earnedEstimate} points.
                </p>
              </div>

              {redeemablePoints > 0 ? (
                <>
                  <p className="text-center text-lg font-bold text-slate-700">
                    Would you like to use your points today?
                  </p>
                  <button
                    type="button"
                    onClick={onRedeem}
                    className="w-full rounded-xl bg-[#b98269] px-4 py-4 font-black text-white shadow-lg shadow-[#8f6758]/15 transition hover:bg-[#a97059]"
                  >
                    Redeem {redeemablePoints} points · Save {formatINR(redeemablePoints)}
                  </button>
                  <button
                    type="button"
                    onClick={onKeep}
                    className="w-full rounded-xl border border-orange-200 bg-white px-4 py-3 font-bold text-slate-600 hover:bg-orange-50"
                  >
                    No thanks, keep my points
                  </button>
                </>
              ) : (
                <>
                  <p className="text-center text-slate-600">
                    You&apos;ll earn points on this purchase. You can redeem them on a future visit.
                  </p>
                  <button
                    type="button"
                    onClick={onKeep}
                    className="w-full rounded-xl bg-[#b98269] px-4 py-4 font-black text-white shadow-lg shadow-[#8f6758]/15"
                  >
                    Continue
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
