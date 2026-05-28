-- Enable Row Level Security on public tables exposed via Supabase PostgREST.
-- K2ChickenPOS uses Prisma from the API (postgres role); it does not query via Supabase client.
-- With RLS enabled and no permissive policies, anon/authenticated API access is denied by default.

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'Store',
      'User',
      'Customer',
      'CustomerAddress',
      'Product',
      'Category',
      'StoreProductPrice',
      'InventoryLedger',
      'Sale',
      'SaleItem',
      'Payment',
      'Shift',
      'ScaleBarcodeConfig',
      'PurchaseOrder',
      'PurchaseOrderItem',
      'Dispatch',
      'DispatchItem',
      'GRN',
      'DeliveryOrder',
      'DeliveryEvent',
      'AuditLog',
      'SyncEvent',
      'FranchiseConfig',
      'PricingPlan',
      'PricingRule',
      'PricingOverride',
      'ProductMaster',
      'Supplier',
      'CentralPurchaseOrder',
      'CentralPOItem',
      'InwardStock',
      'StockAllocation',
      'RoyaltyInvoice',
      'RoyaltyLedger',
      'ComplianceChecklistTemplate',
      'ComplianceRecord',
      'HQAlert',
      'AlertRule',
      'FranchiseHealthScore',
      'YieldIntelligence',
      'ReplenishmentRequest',
      'DiscountOverride',
      'DailyClosing',
      'LoyaltyTransaction'
    ])
  LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;
