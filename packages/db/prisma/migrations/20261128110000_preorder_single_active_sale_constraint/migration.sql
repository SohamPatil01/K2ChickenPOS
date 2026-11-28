-- Purely additive database-level protection ensuring at most ONE active (non-VOID)
-- Sale can ever link to a PreOrder — across both PreOrder.saleId and
-- SaleItem.metaJson->>'preOrderId'. Never deletes or overwrites existing rows.

CREATE TABLE IF NOT EXISTS "PreOrderSaleLink" (
    "preOrderId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "PreOrderSaleLink_pkey" PRIMARY KEY ("preOrderId", "saleId"),
    CONSTRAINT "PreOrderSaleLink_preOrderId_fkey"
      FOREIGN KEY ("preOrderId") REFERENCES "PreOrder"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PreOrderSaleLink_saleId_fkey"
      FOREIGN KEY ("saleId") REFERENCES "Sale"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PreOrderSaleLink_saleId_idx"
ON "PreOrderSaleLink"("saleId");

ALTER TABLE public."PreOrderSaleLink" ENABLE ROW LEVEL SECURITY;

-- Backfill existing links from PreOrder.saleId and SaleItem.metaJson->>'preOrderId'
-- without modifying or deleting any existing table rows.
INSERT INTO "PreOrderSaleLink" ("preOrderId", "saleId", "isActive", "createdAt", "voidedAt")
SELECT
  links."preOrderId",
  links."saleId",
  (s.status IS DISTINCT FROM 'VOID'::"SaleStatus") AS "isActive",
  s."createdAt",
  CASE WHEN s.status = 'VOID'::"SaleStatus" THEN s."updatedAt" ELSE NULL END AS "voidedAt"
FROM (
  SELECT po.id AS "preOrderId", po."saleId" AS "saleId"
  FROM "PreOrder" po
  WHERE po."saleId" IS NOT NULL
  UNION
  SELECT po.id AS "preOrderId", si."saleId" AS "saleId"
  FROM "SaleItem" si
  JOIN "PreOrder" po ON po.id = NULLIF(BTRIM(si."metaJson"::jsonb->>'preOrderId'), '')
  WHERE si."metaJson" IS NOT NULL
    AND jsonb_typeof(si."metaJson"::jsonb) = 'object'
    AND (si."metaJson"::jsonb ? 'preOrderId')
) links
JOIN "Sale" s ON s.id = links."saleId"
ON CONFLICT ("preOrderId", "saleId") DO NOTHING;

-- Core DB-level invariant: only ONE active (non-VOID) Sale may link to a PreOrder.
CREATE UNIQUE INDEX IF NOT EXISTS "PreOrderSaleLink_one_active_sale_key"
ON "PreOrderSaleLink"("preOrderId")
WHERE "isActive" = true;

-- Guard 1: Forbid overwriting or clearing PreOrder.saleId while its linked Sale is active.
CREATE OR REPLACE FUNCTION public.preorder_guard_sale_link_overwrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_prev_status "SaleStatus";
BEGIN
  IF OLD."saleId" IS NOT NULL AND NEW."saleId" IS DISTINCT FROM OLD."saleId" THEN
    SELECT s.status INTO v_prev_status
    FROM "Sale" s
    WHERE s.id = OLD."saleId";

    IF v_prev_status IS NOT NULL AND v_prev_status <> 'VOID'::"SaleStatus" THEN
      RAISE EXCEPTION 'PreOrder % is already linked to active Sale % and cannot be overwritten',
        OLD.id, OLD."saleId"
        USING ERRCODE = '23505',
              CONSTRAINT = 'PreOrderSaleLink_one_active_sale_key',
              TABLE = 'PreOrderSaleLink';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER "trg_preorder_guard_sale_link_overwrite"
BEFORE UPDATE OF "saleId" ON "PreOrder"
FOR EACH ROW
EXECUTE FUNCTION public.preorder_guard_sale_link_overwrite();

-- Guard 2: Record PreOrder.saleId links into PreOrderSaleLink (blocks second active Sale via unique index).
CREATE OR REPLACE FUNCTION public.preorder_sync_sale_link_from_preorder()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_status "SaleStatus";
BEGIN
  IF NEW."saleId" IS NOT NULL THEN
    SELECT s.status INTO v_status
    FROM "Sale" s
    WHERE s.id = NEW."saleId";

    IF v_status IS NOT NULL THEN
      INSERT INTO "PreOrderSaleLink" ("preOrderId", "saleId", "isActive", "voidedAt")
      VALUES (
        NEW.id,
        NEW."saleId",
        (v_status <> 'VOID'::"SaleStatus"),
        CASE WHEN v_status = 'VOID'::"SaleStatus" THEN CURRENT_TIMESTAMP ELSE NULL END
      )
      ON CONFLICT ("preOrderId", "saleId") DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER "trg_preorder_sync_sale_link_from_preorder"
AFTER INSERT OR UPDATE OF "saleId" ON "PreOrder"
FOR EACH ROW
EXECUTE FUNCTION public.preorder_sync_sale_link_from_preorder();

-- Guard 3: Catch any code path that creates a SaleItem with metaJson.preOrderId
-- even if it skipped PreOrder.saleId or application-level locking.
CREATE OR REPLACE FUNCTION public.preorder_sync_sale_link_from_sale_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_po_id TEXT;
  v_po_id TEXT;
  v_status "SaleStatus";
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."metaJson" IS NOT NULL AND jsonb_typeof(OLD."metaJson"::jsonb) = 'object' THEN
    v_old_po_id := NULLIF(BTRIM(OLD."metaJson"::jsonb->>'preOrderId'), '');
    v_po_id := CASE
      WHEN NEW."metaJson" IS NOT NULL AND jsonb_typeof(NEW."metaJson"::jsonb) = 'object'
        THEN NULLIF(BTRIM(NEW."metaJson"::jsonb->>'preOrderId'), '')
      ELSE NULL
    END;
    IF v_old_po_id IS NOT NULL AND v_po_id IS DISTINCT FROM v_old_po_id THEN
      SELECT s.status INTO v_status FROM "Sale" s WHERE s.id = NEW."saleId";
      IF v_status IS NOT NULL AND v_status <> 'VOID'::"SaleStatus" THEN
        RAISE EXCEPTION 'SaleItem preOrderId (%) on active Sale % cannot be overwritten',
          v_old_po_id, NEW."saleId"
          USING ERRCODE = '23505',
                CONSTRAINT = 'PreOrderSaleLink_one_active_sale_key',
                TABLE = 'PreOrderSaleLink';
      END IF;
    END IF;
  END IF;

  IF NEW."metaJson" IS NULL OR jsonb_typeof(NEW."metaJson"::jsonb) <> 'object' THEN
    RETURN NEW;
  END IF;

  v_po_id := NULLIF(BTRIM(NEW."metaJson"::jsonb->>'preOrderId'), '');
  IF v_po_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "PreOrder" po WHERE po.id = v_po_id) THEN
    RETURN NEW;
  END IF;

  SELECT s.status INTO v_status
  FROM "Sale" s
  WHERE s.id = NEW."saleId";

  IF v_status IS NOT NULL THEN
    INSERT INTO "PreOrderSaleLink" ("preOrderId", "saleId", "isActive", "voidedAt")
    VALUES (
      v_po_id,
      NEW."saleId",
      (v_status <> 'VOID'::"SaleStatus"),
      CASE WHEN v_status = 'VOID'::"SaleStatus" THEN CURRENT_TIMESTAMP ELSE NULL END
    )
    ON CONFLICT ("preOrderId", "saleId") DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER "trg_preorder_sync_sale_link_from_sale_item"
AFTER INSERT OR UPDATE OF "metaJson" ON "SaleItem"
FOR EACH ROW
EXECUTE FUNCTION public.preorder_sync_sale_link_from_sale_item();

-- Guard 4: Keep PreOrderSaleLink.isActive in sync with Sale.status (VOID frees re-billing
-- while keeping full history; un-voiding is blocked by the unique index if re-billed).
CREATE OR REPLACE FUNCTION public.preorder_sync_sale_link_on_sale_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'VOID'::"SaleStatus" AND OLD.status IS DISTINCT FROM 'VOID'::"SaleStatus" THEN
    UPDATE "PreOrderSaleLink"
    SET "isActive" = false,
        "voidedAt" = COALESCE("voidedAt", CURRENT_TIMESTAMP)
    WHERE "saleId" = NEW.id
      AND "isActive" = true;
  ELSIF OLD.status = 'VOID'::"SaleStatus" AND NEW.status IS DISTINCT FROM 'VOID'::"SaleStatus" THEN
    UPDATE "PreOrderSaleLink"
    SET "isActive" = true,
        "voidedAt" = NULL
    WHERE "saleId" = NEW.id
      AND "isActive" = false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER "trg_preorder_sync_sale_link_on_sale_status"
AFTER UPDATE OF status ON "Sale"
FOR EACH ROW
EXECUTE FUNCTION public.preorder_sync_sale_link_on_sale_status();
