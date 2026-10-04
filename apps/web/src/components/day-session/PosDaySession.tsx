'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '@/lib/api';
import { Button, Card } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import {
  fetchDayCurrent,
  useDaySessionStore,
  type DayCurrentResponse,
} from '@/store/daySession';

export type { DayCurrentResponse };
export { fetchDayCurrent };

function PinPad({
  value,
  onChange,
  label = 'Day PIN',
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const press = (d: string) => {
    if (value.length >= 8) return;
    onChange(value + d);
  };
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="password"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 8))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center tracking-[0.4em] text-lg mb-2"
        placeholder="••••"
        autoComplete="off"
      />
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'C'].map((k) => (
          <button
            key={k}
            type="button"
            className="py-2 rounded-lg bg-gray-100 hover:bg-gray-200 font-semibold"
            onClick={() => {
              if (k === '⌫') onChange(value.slice(0, -1));
              else if (k === 'C') onChange('');
              else press(k);
            }}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DayOutPanel({
  daySummary,
  shift,
  onDone,
  onCancel,
}: {
  daySummary: any;
  shift: any;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const notifyChanged = useDaySessionStore((s) => s.notifyChanged);
  const [dayPin, setDayPin] = useState('');
  const [cashTakenHome, setCashTakenHome] = useState(0);
  const [pettyCarry, setPettyCarry] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const expected = Number(daySummary?.expectedCash ?? 0);
  const closingCash = Math.round((cashTakenHome + pettyCarry) * 1000) / 1000;
  const diff = Math.round((closingCash - expected) * 1000) / 1000;

  const submit = async () => {
    setError('');
    if (!/^\d{4,8}$/.test(dayPin)) {
      setError('Enter a valid 4–8 digit Day PIN');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/v1/shifts/day-out', {
        dayPin,
        cashTakenHome,
        pettyCashCarryForward: pettyCarry,
        closingCash,
        notes: notes || undefined,
      });
      notifyChanged();
      onDone();
    } catch (e: any) {
      const code = e.response?.data?.code;
      // Another console already closed — sync and continue
      if (code === 'NO_OPEN_DAY') {
        notifyChanged();
        onDone();
        return;
      }
      setError(e.response?.data?.error || 'Day Out failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Day Out</h2>
      <p className="text-sm text-gray-600">
        Opened by {shift?.openedBy?.name || '—'} · Petty in ₹{Number(shift?.openingCash || 0).toFixed(0)}
      </p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 rounded-xl bg-gray-50">
          <div className="text-gray-500">Bills</div>
          <div className="font-bold text-lg">{daySummary?.totalSales ?? 0}</div>
        </div>
        <div className="p-3 rounded-xl bg-gray-50">
          <div className="text-gray-500">Revenue</div>
          <div className="font-bold text-lg">₹{Number(daySummary?.totalRevenue || 0).toFixed(0)}</div>
        </div>
        <div className="p-3 rounded-xl bg-gray-50">
          <div className="text-gray-500">Cash sales</div>
          <div className="font-bold">₹{Number(daySummary?.cashSales || 0).toFixed(0)}</div>
        </div>
        <div className="p-3 rounded-xl bg-gray-50">
          <div className="text-gray-500">Expected drawer</div>
          <div className="font-bold">₹{expected.toFixed(0)}</div>
        </div>
      </div>
      {shift?.movements?.length > 0 && (
        <div className="text-sm">
          <div className="font-medium mb-1">Cash movements</div>
          <ul className="max-h-28 overflow-y-auto space-y-1">
            {shift.movements.map((m: any) => (
              <li key={m.id} className="flex justify-between text-gray-600">
                <span>
                  {m.type} · {m.reason}
                </span>
                <span>₹{Number(m.amount).toFixed(0)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Cash taken home</label>
          <input
            type="number"
            min={0}
            step="1"
            value={cashTakenHome}
            onChange={(e) => setCashTakenHome(Number(e.target.value) || 0)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Petty to carry next day</label>
          <input
            type="number"
            min={0}
            step="1"
            value={pettyCarry}
            onChange={(e) => setPettyCarry(Number(e.target.value) || 0)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
      </div>
      <div className="text-sm flex justify-between">
        <span>Counted (take-home + petty)</span>
        <span className="font-semibold">₹{closingCash.toFixed(0)}</span>
      </div>
      <div
        className={`text-sm flex justify-between ${Math.abs(diff) > 1 ? 'text-amber-700' : 'text-gray-600'}`}
      >
        <span>Difference vs expected</span>
        <span className="font-semibold">
          {diff >= 0 ? '+' : ''}₹{diff.toFixed(0)}
        </span>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="Optional"
        />
      </div>
      <PinPad value={dayPin} onChange={setDayPin} label="Day PIN (who is closing)" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
        <Button type="button" onClick={submit} disabled={loading}>
          {loading ? 'Closing…' : 'Complete Day Out'}
        </Button>
      </div>
    </div>
  );
}

function Overlay({
  children,
  z = 10000,
}: {
  children: React.ReactNode;
  z?: number;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: z }}
    >
      {children}
    </div>,
    document.body
  );
}

/** Store-wide day session: Day In gate, movements, Day Out — syncs across consoles. */
export default function PosDaySession({
  onDayRequiredChange,
}: {
  onDayRequiredChange?: (required: boolean) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const status = useDaySessionStore((s) => s.status);
  const loading = useDaySessionStore((s) => s.loading);
  const loadError = useDaySessionStore((s) => s.error);
  const refresh = useDaySessionStore((s) => s.refresh);
  const notifyChanged = useDaySessionStore((s) => s.notifyChanged);
  const subscribeLifecycle = useDaySessionStore((s) => s.subscribeLifecycle);

  const [dayPin, setDayPin] = useState('');
  const [pettyCash, setPettyCash] = useState(0);
  const [useCarry, setUseCarry] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDayOut, setShowDayOut] = useState(false);
  const [showMovement, setShowMovement] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [reminderAck, setReminderAck] = useState(false);
  const [movType, setMovType] = useState<'IN' | 'OUT'>('OUT');
  const [movAmount, setMovAmount] = useState(0);
  const [movReason, setMovReason] = useState('');
  const [movPin, setMovPin] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overridePetty, setOverridePetty] = useState(0);

  useEffect(() => subscribeLifecycle(), [subscribeLifecycle]);

  useEffect(() => {
    if (!status) return;
    setPettyCash(status.suggestedCarry || 0);
    setUseCarry(true);
    onDayRequiredChange?.(!status.open);
    if (!status.needsDayOutReminder) setReminderAck(false);
    if (status.open) {
      setShowDayOut(false);
      setError('');
    }
  }, [status, onDayRequiredChange]);

  const submitDayIn = async () => {
    setError('');
    if (!/^\d{4,8}$/.test(dayPin)) {
      setError('Enter a valid 4–8 digit Day PIN');
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/v1/shifts/day-in', {
        dayPin,
        pettyCash: useCarry ? status?.suggestedCarry || 0 : pettyCash,
      });
      setDayPin('');
      notifyChanged();
    } catch (e: any) {
      const code = e.response?.data?.code;
      // Another console already opened the day — sync instead of stuck gate
      if (code === 'DAY_ALREADY_OPEN') {
        setDayPin('');
        notifyChanged();
        return;
      }
      setError(e.response?.data?.error || 'Day In failed');
    } finally {
      setBusy(false);
    }
  };

  const submitMovement = async () => {
    setError('');
    setBusy(true);
    try {
      await api.post('/api/v1/shifts/movements', {
        dayPin: movPin,
        type: movType,
        amount: movAmount,
        reason: movReason,
      });
      setShowMovement(false);
      setMovPin('');
      setMovAmount(0);
      setMovReason('');
      notifyChanged();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Movement failed');
    } finally {
      setBusy(false);
    }
  };

  const submitOverride = async () => {
    setError('');
    if (overrideReason.trim().length < 3) {
      setError('Enter a reason (min 3 characters)');
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/v1/shifts/override-open', {
        reason: overrideReason.trim(),
        pettyCash: overridePetty,
      });
      setShowOverride(false);
      setOverrideReason('');
      notifyChanged();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Override failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="mb-2 px-2 text-sm text-gray-500">Checking day session…</div>
    );
  }

  // Only gate when API confirmed the day is closed — never on a failed poll
  const dayConfirmedClosed = !!status && !status.open;
  const dayOpen = !!status?.open;

  return (
    <>
      {dayConfirmedClosed && (
        <Overlay z={10000}>
          <Card className="w-full max-w-md space-y-4 shadow-2xl">
            <h2 className="text-2xl font-bold">Day In required</h2>
            <p className="text-sm text-gray-600">
              Enter your Day PIN and petty cash to start billing for today. This opens the day
              for every console in this store.
            </p>
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                className={`flex-1 py-2 rounded-lg border ${useCarry ? 'bg-brand-100 border-brand-400' : ''}`}
                onClick={() => {
                  setUseCarry(true);
                  setPettyCash(status?.suggestedCarry || 0);
                }}
              >
                Carry forward ₹{(status?.suggestedCarry || 0).toFixed(0)}
              </button>
              <button
                type="button"
                className={`flex-1 py-2 rounded-lg border ${!useCarry ? 'bg-brand-100 border-brand-400' : ''}`}
                onClick={() => setUseCarry(false)}
              >
                Enter amount
              </button>
            </div>
            {!useCarry && (
              <div>
                <label className="block text-sm font-medium mb-1">Petty cash</label>
                <input
                  type="number"
                  min={0}
                  value={pettyCash}
                  onChange={(e) => setPettyCash(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            )}
            <PinPad value={dayPin} onChange={setDayPin} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button className="w-full" onClick={submitDayIn} disabled={busy}>
              {busy ? 'Opening…' : 'Start Day In'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => void refresh()}
              disabled={busy}
            >
              Refresh status
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Use the Day In/Out PIN from Settings → Staff (not the login password).
            </p>
            {user?.role === 'OWNER' && (
              <button
                type="button"
                className="w-full text-sm text-amber-800 underline"
                onClick={() => {
                  setShowOverride(true);
                  setOverridePetty(status?.suggestedCarry || 0);
                  setError('');
                }}
              >
                Unlock day (owner override)
              </button>
            )}
          </Card>
        </Overlay>
      )}

      {!status && loadError && (
        <div className="mb-2 mx-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 flex items-center justify-between gap-2 text-sm">
          <span className="text-red-800">{loadError}</span>
          <button
            type="button"
            className="shrink-0 px-2 py-1 rounded bg-red-100 hover:bg-red-200"
            onClick={() => void refresh()}
          >
            Retry
          </button>
        </div>
      )}

      {dayOpen && status?.needsDayOutReminder && !reminderAck && (
        <div className="mb-2 mx-2 rounded-xl bg-amber-100 border border-amber-300 px-3 py-2 flex items-center justify-between gap-2 text-sm">
          <span className="font-medium text-amber-900">
            Day still open — remember to Day Out when done.
          </span>
          <button
            type="button"
            className="shrink-0 px-2 py-1 rounded bg-amber-200 hover:bg-amber-300"
            onClick={() => setReminderAck(true)}
          >
            Got it
          </button>
        </div>
      )}

      {dayOpen && (
        <div className="mb-2 px-2 flex flex-wrap items-center gap-2">
          <span className="text-xs sm:text-sm px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 font-medium">
            Day open · {status?.shift?.openedBy?.name || '—'} · ₹
            {Number(status?.shift?.openingCash || 0).toFixed(0)}
          </span>
          <Button
            type="button"
            variant="secondary"
            className="!py-1 !px-3 text-sm"
            onClick={() => setShowMovement(true)}
          >
            Cash in/out
          </Button>
          <Button
            type="button"
            className="!py-1 !px-3 text-sm"
            onClick={() => {
              setShowDayOut(true);
              void refresh({ full: true });
            }}
          >
            Day Out
          </Button>
        </div>
      )}

      {showDayOut && status?.shift && (
        <Overlay z={10001}>
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <DayOutPanel
              shift={status.shift}
              daySummary={status.daySummary}
              onCancel={() => setShowDayOut(false)}
              onDone={async () => {
                setShowDayOut(false);
                notifyChanged();
              }}
            />
          </Card>
        </Overlay>
      )}

      {showMovement && (
        <Overlay z={10001}>
          <Card className="w-full max-w-sm space-y-3 shadow-2xl">
            <h3 className="text-lg font-bold">Cash movement</h3>
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 py-2 rounded-lg border ${movType === 'IN' ? 'bg-emerald-100' : ''}`}
                onClick={() => setMovType('IN')}
              >
                Cash in
              </button>
              <button
                type="button"
                className={`flex-1 py-2 rounded-lg border ${movType === 'OUT' ? 'bg-amber-100' : ''}`}
                onClick={() => setMovType('OUT')}
              >
                Cash out
              </button>
            </div>
            <input
              type="number"
              min={1}
              placeholder="Amount"
              value={movAmount || ''}
              onChange={(e) => setMovAmount(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <input
              placeholder="Reason"
              value={movReason}
              onChange={(e) => setMovReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <PinPad value={movPin} onChange={setMovPin} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowMovement(false)}>
                Cancel
              </Button>
              <Button
                onClick={submitMovement}
                disabled={busy || !movAmount || !movReason.trim()}
              >
                Save
              </Button>
            </div>
          </Card>
        </Overlay>
      )}

      {showOverride && (
        <Overlay z={10002}>
          <Card className="w-full max-w-sm space-y-3 shadow-2xl">
            <h3 className="text-lg font-bold">Owner override</h3>
            <p className="text-sm text-gray-600">
              Force-close any stuck open day and open a new session. This is logged.
            </p>
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Reason"
            />
            <div>
              <label className="block text-sm font-medium mb-1">Petty cash for new day</label>
              <input
                type="number"
                min={0}
                value={overridePetty}
                onChange={(e) => setOverridePetty(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowOverride(false)}>
                Cancel
              </Button>
              <Button onClick={submitOverride} disabled={busy}>
                Unlock
              </Button>
            </div>
          </Card>
        </Overlay>
      )}
    </>
  );
}
