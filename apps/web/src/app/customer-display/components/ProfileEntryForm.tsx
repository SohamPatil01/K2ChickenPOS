"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export interface ProfileEntrySubmission {
  phone: string;
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
}

type SubmitState = "idle" | "sending" | "sent" | "error";

export default function ProfileEntryForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: ProfileEntrySubmission) => void;
  onCancel: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<SubmitState>("idle");

  const handleSubmit = () => {
    const trimmedPhone = phone.trim();
    const trimmedName = name.trim();
    const trimmedLine1 = addressLine1.trim();
    const trimmedCity = city.trim();

    if (trimmedPhone.length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }
    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }
    const anyAddress = Boolean(trimmedLine1 || addressLine2.trim() || trimmedCity);
    if (anyAddress && (!trimmedLine1 || !trimmedCity)) {
      setError("Please fill in both address line 1 and city, or leave address blank.");
      return;
    }

    setError(null);
    setState("sending");
    try {
      onSubmit({
        phone: trimmedPhone,
        name: trimmedName,
        addressLine1: trimmedLine1 || undefined,
        addressLine2: addressLine2.trim() || undefined,
        city: trimmedCity || undefined,
      });
      setState("sent");
    } catch {
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-full bg-emerald-500/15 p-6"
        >
          <span className="text-6xl">✓</span>
        </motion.div>
        <p className="mt-6 text-3xl font-bold text-emerald-300">Thanks — saved!</p>
        <p className="mt-2 text-lg text-white/60">Your cashier will confirm your bill.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-8">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/40 p-8 backdrop-blur">
        <h2 className="mb-1 text-2xl font-bold text-white">Enter your details</h2>
        <p className="mb-6 text-sm text-white/50">
          Used to track loyalty points and delivery address only.
        </p>

        <div className="space-y-4">
          <Field label="Phone number">
            <input
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 12))}
              placeholder="98xxxxxxxx"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xl text-white outline-none placeholder:text-white/30 focus:border-amber-400/60"
            />
          </Field>
          <Field label="Name">
            <input
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xl text-white outline-none placeholder:text-white/30 focus:border-amber-400/60"
            />
          </Field>
          <Field label="Address line 1 (optional)">
            <input
              autoComplete="address-line1"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="House / street"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xl text-white outline-none placeholder:text-white/30 focus:border-amber-400/60"
            />
          </Field>
          <Field label="Address line 2 (optional)">
            <input
              autoComplete="address-line2"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Landmark, area"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xl text-white outline-none placeholder:text-white/30 focus:border-amber-400/60"
            />
          </Field>
          <Field label="City (optional)">
            <input
              autoComplete="address-level2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xl text-white outline-none placeholder:text-white/30 focus:border-amber-400/60"
            />
          </Field>
        </div>

        {error && <p className="mt-4 text-base font-medium text-rose-300">{error}</p>}
        {state === "error" && (
          <p className="mt-4 text-base font-medium text-rose-300">
            Couldn&apos;t send — please ask the cashier for help.
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/15 bg-white/5 py-3 text-lg font-semibold text-white/70 active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={state === "sending"}
            className="flex-1 rounded-xl bg-amber-500 py-3 text-lg font-bold text-black active:scale-95 disabled:opacity-60"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-white/50">{label}</span>
      {children}
    </label>
  );
}
