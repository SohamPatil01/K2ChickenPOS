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
  onClose,
}: {
  values: CustomerInfoValues;
  activeField: DraftFieldKey | null;
  onTapField: (field: DraftFieldKey) => void;
  onSave: () => void;
  saveState: SaveState;
  onClose: () => void;
}) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-4 text-slate-900 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-extrabold text-slate-700">Your details</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-1 text-slate-400 transition hover:bg-orange-50 hover:text-slate-700"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Row label="Phone" value={values.phone} placeholder="Tap to add" active={activeField === "phone"} onTap={() => onTapField("phone")} />
        <Row label="Name" value={values.name} placeholder="Tap to add" active={activeField === "name"} onTap={() => onTapField("name")} />
        <Row label="Address" value={values.line1} placeholder="Tap to add" active={activeField === "line1"} onTap={() => onTapField("line1")} />
        <Row label="Landmark" value={values.line2} placeholder="Optional" active={activeField === "line2"} onTap={() => onTapField("line2")} />
        <Row label="City" value={values.city} placeholder="Optional" active={activeField === "city"} onTap={() => onTapField("city")} />
        <button
          type="button"
          onClick={onSave}
          className="rounded-xl bg-[#b98269] px-4 py-2 text-base font-bold text-white active:scale-95"
        >
          {saveState === "sent" ? "Saved ✓" : "Save"}
        </button>
      </div>
      {saveState === "error" && (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
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
        active ? "border-orange-300 bg-orange-50" : "border-orange-100 bg-[#fffaf4]"
      }`}
    >
      <span className="block text-xs font-bold text-slate-400">{label}</span>
      <span className={`block truncate text-base font-semibold ${value ? "text-slate-800" : "text-slate-400"}`}>
        {value || placeholder}
      </span>
    </button>
  );
}
