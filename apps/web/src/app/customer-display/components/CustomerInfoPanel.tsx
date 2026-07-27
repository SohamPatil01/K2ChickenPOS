"use client";

import type { DraftFieldKey } from "@/lib/customerDisplay/types";

export interface CustomerInfoValues {
  phone: string;
  name: string;
  line1: string;
  line2: string;
  city: string;
}

type SaveState = "idle" | "sent" | "error";

export default function CustomerInfoPanel({
  values,
  activeField,
  onTapField,
  onSave,
  saveState,
}: {
  values: CustomerInfoValues;
  activeField: DraftFieldKey | null;
  onTapField: (field: DraftFieldKey) => void;
  onSave: () => void;
  saveState: SaveState;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <p className="mb-3 text-sm font-semibold text-white/60">Your details</p>
      <div className="grid grid-cols-2 gap-2">
        <Row label="Phone" value={values.phone} placeholder="Tap to add" active={activeField === "phone"} onTap={() => onTapField("phone")} />
        <Row label="Name" value={values.name} placeholder="Tap to add" active={activeField === "name"} onTap={() => onTapField("name")} />
        <Row label="Address" value={values.line1} placeholder="Tap to add" active={activeField === "line1"} onTap={() => onTapField("line1")} />
        <Row label="Landmark" value={values.line2} placeholder="Optional" active={activeField === "line2"} onTap={() => onTapField("line2")} />
        <Row label="City" value={values.city} placeholder="Optional" active={activeField === "city"} onTap={() => onTapField("city")} />
        <button
          type="button"
          onClick={onSave}
          className="rounded-xl bg-amber-500 px-4 py-2 text-base font-bold text-black active:scale-95"
        >
          {saveState === "sent" ? "Saved ✓" : "Save"}
        </button>
      </div>
      {saveState === "error" && (
        <p className="mt-2 text-sm font-medium text-rose-300">
          Couldn&apos;t save — please ask the cashier for help.
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  placeholder,
  active,
  onTap,
}: {
  label: string;
  value: string;
  placeholder: string;
  active: boolean;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={`rounded-xl border px-4 py-2 text-left transition ${
        active ? "border-amber-400/60 bg-amber-500/10" : "border-white/10 bg-white/5"
      }`}
    >
      <span className="block text-xs font-medium text-white/40">{label}</span>
      <span className={`block truncate text-base font-semibold ${value ? "text-white" : "text-white/30"}`}>
        {value || placeholder}
      </span>
    </button>
  );
}
