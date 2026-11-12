import { describe, expect, it } from 'vitest';
import { quantitiesForInventoryDeduction } from './saleItemLedger.js';

describe('quantitiesForInventoryDeduction', () => {
  it('accepts KG qty for KG products', () => {
    expect(quantitiesForInventoryDeduction({ qtyKg: 1.25 }, 'KG')).toEqual({
      qtyKg: 1.25,
      qtyPcs: null,
    });
  });

  it('rejects PCS qty on KG products', () => {
    expect(() => quantitiesForInventoryDeduction({ qtyPcs: 2 }, 'KG')).toThrow(
      /qtyKg/
    );
  });

  it('rejects KG qty on PCS products', () => {
    expect(() => quantitiesForInventoryDeduction({ qtyKg: 1 }, 'PCS')).toThrow(
      /qtyPcs/
    );
  });

  it('accepts PCS qty for PCS products', () => {
    expect(quantitiesForInventoryDeduction({ qtyPcs: 3 }, 'PCS')).toEqual({
      qtyKg: null,
      qtyPcs: 3,
    });
  });
});
