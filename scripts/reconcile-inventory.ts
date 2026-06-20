#!/usr/bin/env tsx
/**
 * One-time inventory reconciliation / correction.
 *
 * Detects and (optionally) corrects phantom stock created by historical bugs:
 *   1. Voided bills whose net ledger impact is not zero (edited-then-voided
 *      over-restore, or partial restores) — a voided sale must net to 0.
 *   2. Purchase orders received twice (RECEIVE rows keyed by BOTH the dispatch id
 *      and the PO id for the same dispatch) — the dispatch-keyed rows are the dup.
 *
 * Corrections are posted as InventoryLedger rows with reason CORRECTION and a
 * deterministic refId (RECON-VOID-<saleId> / RECON-PODUP-<dispatchId>), so the
 * script is idempotent: re-running never double-corrects.
 *
 * Usage:
 *   npx tsx scripts/reconcile-inventory.ts            # dry-run report only
 *   npx tsx scripts/reconcile-inventory.ts --apply     # post correction entries
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

const EPS = 0.001;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

type Net = { kg: number; pcs: number };

function addSigned(map: Map<string, Net>, productId: string, type: string, qtyKg: number | null, qtyPcs: number | null) {
  const sign = type === 'OUT' ? -1 : 1;
  const cur = map.get(productId) || { kg: 0, pcs: 0 };
  cur.kg = r3(cur.kg + sign * (qtyKg || 0));
  cur.pcs += sign * (qtyPcs || 0);
  map.set(productId, cur);
}

type Correction = {
  storeId: string;
  productId: string;
  type: 'IN' | 'OUT';
  qtyKg: number | null;
  qtyPcs: number | null;
  refId: string;
  note: string;
};

async function correctionExists(refId: string): Promise<boolean> {
  const found = await prisma.inventoryLedger.findFirst({ where: { refId } });
  return !!found;
}

async function reconcileVoidedSales(): Promise<Correction[]> {
  const corrections: Correction[] = [];
  const voided = await prisma.sale.findMany({
    where: { status: 'VOID' },
    select: { id: true, storeId: true, saleNo: true },
  });

  for (const sale of voided) {
    const refId = `RECON-VOID-${sale.id}`;
    if (await correctionExists(refId)) continue;

    const rows = await prisma.inventoryLedger.findMany({
      where: { refId: sale.id },
      select: { productId: true, type: true, qtyKg: true, qtyPcs: true },
    });
    if (rows.length === 0) continue;

    const net = new Map<string, Net>();
    for (const row of rows) {
      addSigned(net, row.productId, row.type, row.qtyKg, row.qtyPcs);
    }

    for (const [productId, n] of net) {
      const kg = r3(n.kg);
      const pcs = Math.round(n.pcs);
      // Voided sale should net to zero. Post the opposite of the residual.
      if (Math.abs(kg) < EPS && pcs === 0) continue;

      if (kg < -EPS || pcs < 0) {
        // Still net-deducted → give stock back.
        corrections.push({
          storeId: sale.storeId,
          productId,
          type: 'IN',
          qtyKg: kg < -EPS ? Math.abs(kg) : null,
          qtyPcs: pcs < 0 ? Math.abs(pcs) : null,
          refId,
          note: `void ${sale.saleNo}: net under-restored`,
        });
      } else {
        // Net over-restored (phantom stock) → remove the excess.
        corrections.push({
          storeId: sale.storeId,
          productId,
          type: 'OUT',
          qtyKg: kg > EPS ? kg : null,
          qtyPcs: pcs > 0 ? pcs : null,
          refId,
          note: `void ${sale.saleNo}: net over-restored (phantom stock)`,
        });
      }
    }
  }
  return corrections;
}

async function reconcileDuplicatePoReceipts(): Promise<Correction[]> {
  const corrections: Correction[] = [];
  const dispatches = await prisma.dispatch.findMany({
    include: { grn: true, po: { select: { id: true, poNo: true, franchiseStoreId: true } } },
  });

  for (const dispatch of dispatches) {
    if (!dispatch.grn) continue; // never received → no duplicate possible
    const refId = `RECON-PODUP-${dispatch.id}`;
    if (await correctionExists(refId)) continue;

    const dispRows = await prisma.inventoryLedger.findMany({
      where: { refId: dispatch.id, reason: 'RECEIVE', type: 'IN' },
      select: { storeId: true, productId: true, qtyKg: true, qtyPcs: true },
    });
    const poRows = await prisma.inventoryLedger.findMany({
      where: { refId: dispatch.poId, reason: 'RECEIVE', type: 'IN' },
      select: { id: true },
    });

    // A duplicate only exists if the PO was ALSO finalized (poId-keyed RECEIVE rows).
    if (dispRows.length === 0 || poRows.length === 0) continue;

    for (const row of dispRows) {
      corrections.push({
        storeId: row.storeId,
        productId: row.productId,
        type: 'OUT',
        qtyKg: row.qtyKg && row.qtyKg > EPS ? r3(row.qtyKg) : null,
        qtyPcs: row.qtyPcs && row.qtyPcs > 0 ? row.qtyPcs : null,
        refId,
        note: `PO ${dispatch.po.poNo}: duplicate dispatch-keyed receipt removed`,
      });
    }
  }
  return corrections;
}

async function main() {
  console.log(`\n=== Inventory reconciliation (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===\n`);

  const voidCorrections = await reconcileVoidedSales();
  const poCorrections = await reconcileDuplicatePoReceipts();
  const all = [...voidCorrections, ...poCorrections];

  if (all.length === 0) {
    console.log('No discrepancies found. Inventory ledger is consistent.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${all.length} correction(s):\n`);
  for (const c of all) {
    const qty = c.qtyKg != null ? `${c.qtyKg} kg` : `${c.qtyPcs} pcs`;
    console.log(
      `  [${c.type}] store=${c.storeId} product=${c.productId} ${qty}  (${c.note})`
    );
  }

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to post these CORRECTION entries.');
    await prisma.$disconnect();
    return;
  }

  console.log('\nApplying corrections...');
  let applied = 0;
  for (const c of all) {
    if ((c.qtyKg == null || c.qtyKg <= EPS) && (c.qtyPcs == null || c.qtyPcs <= 0)) continue;
    await prisma.inventoryLedger.create({
      data: {
        storeId: c.storeId,
        productId: c.productId,
        type: c.type,
        qtyKg: c.qtyKg,
        qtyPcs: c.qtyPcs,
        reason: 'CORRECTION',
        refId: c.refId,
      },
    });
    applied += 1;
  }
  console.log(`✅ Applied ${applied} correction entry(ies).`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Reconciliation failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
