import {
  lineSubtotalPaise,
  roundToRupee,
  taxPaise,
  type UnitType,
} from './money.js';
import { maxRedeemablePoints, estimateEarnPoints, type RewardsConfig } from './rewards.js';

export const WEIGHT_RULES = { minGrams: 250, stepGrams: 250, maxGrams: 10_000 } as const;
export const PIECE_RULES = { min: 1, max: 50 } as const;
/** Same soft tolerance the public pre-order route uses (shop may cut fresh). */
export const STOCK_TOLERANCE_GRAMS = 50;

export type RequestedLine = {
  productId: string;
  grams?: number | null;
  pieces?: number | null;
  cutOptionId?: string | null;
  notes?: string | null;
  /** Rate the customer saw previously (reorder / cart refresh), paise per unit. */
  previousRatePaise?: number | null;
};

export type ProductSnapshot = {
  id: string;
  name: string;
  unitType: UnitType;
  taxRate: number;
  ratePaise: number | null; // null = no active store price
  isActive: boolean;
  stockGrams: number;
  stockPieces: number;
  imageUrl: string | null;
};

export type LineStatus =
  | 'OK'
  | 'PRICE_CHANGED'
  | 'UNAVAILABLE'
  | 'OUT_OF_STOCK'
  | 'INSUFFICIENT_STOCK'
  | 'INVALID_QUANTITY';

export type QuoteLine = {
  productId: string;
  name: string;
  unitType: UnitType;
  grams: number | null;
  pieces: number | null;
  cutOptionId: string | null;
  cutLabel: string | null;
  notes: string | null;
  imageUrl: string | null;
  ratePaise: number | null;
  previousRatePaise: number | null;
  taxRate: number;
  subtotalPaise: number;
  taxPaise: number;
  status: LineStatus;
  message: string | null;
  orderable: boolean;
  availableGrams: number | null;
  availablePieces: number | null;
};

export type QuoteInput = {
  lines: RequestedLine[];
  products: Map<string, ProductSnapshot>;
  fulfillment: 'PICKUP' | 'DELIVERY';
  delivery: {
    enabled: boolean;
    feePaise: number;
    freeAbovePaise: number | null;
    serviceable: boolean | null; // null = no address yet
  };
  minOrderPaise: number;
  cutOptions: Array<{ id: string; label: string }>;
  loyalty: {
    requestedPoints: number;
    availablePoints: number | null; // null = guest
    config: RewardsConfig;
  };
};

export type QuoteIssueCode =
  | 'EMPTY_CART'
  | 'LINE_PROBLEMS'
  | 'BELOW_MINIMUM'
  | 'DELIVERY_UNAVAILABLE'
  | 'ADDRESS_NOT_SERVICEABLE'
  | 'ADDRESS_REQUIRED';

export type Quote = {
  lines: QuoteLine[];
  merchandisePaise: number;
  taxPaise: number;
  deliveryFeePaise: number;
  loyalty: {
    availablePoints: number | null;
    maxRedeemablePoints: number;
    appliedPoints: number;
    discountPaise: number;
  };
  roundOffPaise: number;
  totalPaise: number;
  estimatedEarnPoints: number;
  issues: Array<{ code: QuoteIssueCode; message: string }>;
  canCheckout: boolean;
  hasPriceChanges: boolean;
};

export function validateQuantity(unitType: UnitType, line: RequestedLine): string | null {
  if (unitType === 'KG') {
    const g = Number(line.grams);
    if (!Number.isInteger(g) || g < WEIGHT_RULES.minGrams || g > WEIGHT_RULES.maxGrams) {
      return `Choose between ${WEIGHT_RULES.minGrams / 1000} kg and ${WEIGHT_RULES.maxGrams / 1000} kg`;
    }
    if (g % WEIGHT_RULES.stepGrams !== 0) return `Weight must be in ${WEIGHT_RULES.stepGrams} g steps`;
    return null;
  }
  const p = Number(line.pieces);
  if (!Number.isInteger(p) || p < PIECE_RULES.min || p > PIECE_RULES.max) {
    return `Choose ${PIECE_RULES.min}–${PIECE_RULES.max} pieces`;
  }
  return null;
}

export function buildQuote(input: QuoteInput): Quote {
  const issues: Quote['issues'] = [];
  const cutById = new Map(input.cutOptions.map((c) => [c.id, c.label]));

  const lines: QuoteLine[] = input.lines.map((req) => {
    const p = input.products.get(req.productId);
    const base = {
      productId: req.productId,
      cutOptionId: null as string | null,
      cutLabel: null as string | null,
      notes: req.notes?.trim() || null,
      previousRatePaise: req.previousRatePaise ?? null,
      subtotalPaise: 0,
      taxPaise: 0,
    };
    if (!p || !p.isActive || p.ratePaise == null || p.ratePaise <= 0) {
      return {
        ...base,
        name: p?.name ?? 'Item no longer sold',
        unitType: p?.unitType ?? 'KG',
        grams: req.grams ?? null,
        pieces: req.pieces ?? null,
        imageUrl: p?.imageUrl ?? null,
        ratePaise: null,
        taxRate: p?.taxRate ?? 0,
        status: 'UNAVAILABLE' as const,
        message: 'This item is not currently sold at this store',
        orderable: false,
        availableGrams: null,
        availablePieces: null,
      };
    }
    const isKg = p.unitType === 'KG';
    const grams = isKg ? Math.round(Number(req.grams) || 0) : null;
    const pieces = isKg ? null : Math.round(Number(req.pieces) || 0);
    const cutOptionId = isKg && req.cutOptionId && cutById.has(req.cutOptionId) ? req.cutOptionId : null;
    const common = {
      ...base,
      name: p.name,
      unitType: p.unitType,
      grams,
      pieces,
      cutOptionId,
      cutLabel: cutOptionId ? cutById.get(cutOptionId) ?? null : null,
      imageUrl: p.imageUrl,
      ratePaise: p.ratePaise,
      taxRate: p.taxRate,
      availableGrams: isKg ? p.stockGrams : null,
      availablePieces: isKg ? null : p.stockPieces,
    };

    const qtyError = validateQuantity(p.unitType, req);
    if (qtyError) {
      return { ...common, status: 'INVALID_QUANTITY' as const, message: qtyError, orderable: false };
    }
    const outOfStock = isKg ? p.stockGrams <= 1 : p.stockPieces <= 0;
    if (outOfStock) {
      return { ...common, status: 'OUT_OF_STOCK' as const, message: 'Out of stock right now', orderable: false };
    }
    if (isKg && (grams as number) > p.stockGrams + STOCK_TOLERANCE_GRAMS) {
      return {
        ...common,
        status: 'INSUFFICIENT_STOCK' as const,
        message: `Only ${(p.stockGrams / 1000).toFixed(2)} kg available`,
        orderable: false,
      };
    }
    if (!isKg && (pieces as number) > p.stockPieces) {
      return {
        ...common,
        status: 'INSUFFICIENT_STOCK' as const,
        message: `Only ${p.stockPieces} pcs available`,
        orderable: false,
      };
    }

    const subtotalPaise = lineSubtotalPaise(p.unitType, p.ratePaise, { grams: grams ?? 0, pieces: pieces ?? 0 });
    const lineTax = taxPaise(subtotalPaise, p.taxRate);
    const priceChanged = req.previousRatePaise != null && req.previousRatePaise !== p.ratePaise;
    return {
      ...common,
      subtotalPaise,
      taxPaise: lineTax,
      status: priceChanged ? ('PRICE_CHANGED' as const) : ('OK' as const),
      message: priceChanged ? 'Price has changed since you last ordered' : null,
      orderable: true,
    };
  });

  const orderable = lines.filter((l) => l.orderable);
  const merchandisePaise = orderable.reduce((s, l) => s + l.subtotalPaise, 0);
  const totalTax = orderable.reduce((s, l) => s + l.taxPaise, 0);

  if (input.lines.length === 0) issues.push({ code: 'EMPTY_CART', message: 'Your cart is empty' });
  if (lines.some((l) => !l.orderable)) {
    issues.push({ code: 'LINE_PROBLEMS', message: 'Some items need attention before checkout' });
  }
  if (orderable.length > 0 && merchandisePaise < input.minOrderPaise) {
    issues.push({ code: 'BELOW_MINIMUM', message: `Minimum order is ₹${Math.ceil(input.minOrderPaise / 100)}` });
  }

  let deliveryFeePaise = 0;
  if (input.fulfillment === 'DELIVERY') {
    if (!input.delivery.enabled) {
      issues.push({ code: 'DELIVERY_UNAVAILABLE', message: 'Delivery is not available from this store yet. Choose pickup.' });
    } else if (input.delivery.serviceable === null) {
      issues.push({ code: 'ADDRESS_REQUIRED', message: 'Add a delivery address' });
    } else if (!input.delivery.serviceable) {
      issues.push({ code: 'ADDRESS_NOT_SERVICEABLE', message: 'We do not deliver to this pincode yet' });
    }
    const free = input.delivery.freeAbovePaise != null && merchandisePaise >= input.delivery.freeAbovePaise;
    deliveryFeePaise = free ? 0 : Math.max(0, input.delivery.feePaise);
  }

  const available = input.loyalty.availablePoints;
  const maxPoints =
    available == null
      ? 0
      : maxRedeemablePoints({ availablePoints: available, merchandisePaise, config: input.loyalty.config });
  const appliedPoints = Math.max(0, Math.min(Math.floor(input.loyalty.requestedPoints || 0), maxPoints));
  const discountPaise = appliedPoints * input.loyalty.config.pointValuePaise;

  const preRound = Math.max(0, merchandisePaise + totalTax + deliveryFeePaise - discountPaise);
  const { totalPaise, roundOffPaise } = roundToRupee(preRound);

  return {
    lines,
    merchandisePaise,
    taxPaise: totalTax,
    deliveryFeePaise,
    loyalty: { availablePoints: available, maxRedeemablePoints: maxPoints, appliedPoints, discountPaise },
    roundOffPaise,
    totalPaise,
    estimatedEarnPoints: estimateEarnPoints(totalPaise),
    issues,
    canCheckout: issues.length === 0 && orderable.length > 0,
    hasPriceChanges: lines.some((l) => l.status === 'PRICE_CHANGED'),
  };
}
