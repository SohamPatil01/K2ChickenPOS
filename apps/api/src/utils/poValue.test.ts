import { describe, it, expect } from 'vitest';
import { poLineReceivedValue, sumReceivedPoValue } from './poValue.js';

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

  it('does not count ordered qty without received qty', () => {
    expect(
      poLineReceivedValue({
        requestedRate: 100,
        receivedQtyKg: 0,
        receivedQtyPcs: 0,
      })
    ).toBe(0);
  });

  it('sumReceivedPoValue skips non-closed POs', () => {
    expect(
      sumReceivedPoValue([
        {
          status: 'DRAFT',
          items: [{ requestedRate: 100, receivedQtyKg: 100 }],
        },
        {
          status: 'CLOSED',
          items: [{ requestedRate: 100, receivedQtyKg: 2 }],
        },
      ])
    ).toBe(200);
  });
});
