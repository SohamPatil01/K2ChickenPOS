import { describe, it, expect } from 'vitest';
import { poLineReceivedValue, poLineValue, sumReceivedPoValue } from './poValue.js';

describe('poValue', () => {
  it('uses received kg only, not kg + pcs', () => {
    expect(
      poLineReceivedValue({
        requestedRate: 200,
        receivedQtyKg: 10,
        receivedQtyPcs: 5,
      })
    ).toBe(2000);
  });

  it('does not fall back to ordered qty for received value', () => {
    expect(
      poLineReceivedValue({
        requestedRate: 100,
        qtyKg: 50,
        qtyPcs: 10,
      })
    ).toBe(0);
  });

  it('poLineValue falls back to ordered qty when nothing received', () => {
    expect(
      poLineValue({
        requestedRate: 100,
        qtyKg: 5,
      })
    ).toBe(500);
  });

  it('sumReceivedPoValue skips non-closed POs', () => {
    expect(
      sumReceivedPoValue([
        {
          status: 'DRAFT',
          items: [{ requestedRate: 100, qtyKg: 100 }],
        },
        {
          status: 'CLOSED',
          items: [{ requestedRate: 100, receivedQtyKg: 2 }],
        },
      ])
    ).toBe(200);
  });
});
