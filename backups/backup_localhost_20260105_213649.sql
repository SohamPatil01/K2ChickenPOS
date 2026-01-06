pg_dump: executing SELECT pg_catalog.set_config('search_path', '', false);
pg_dump: last built-in OID is 16383
pg_dump: reading extensions
pg_dump: identifying extension members
pg_dump: reading schemas
pg_dump: reading user-defined tables
pg_dump: reading user-defined functions
pg_dump: reading user-defined types
pg_dump: reading procedural languages
pg_dump: reading user-defined aggregate functions
pg_dump: reading user-defined operators
pg_dump: reading user-defined access methods
pg_dump: reading user-defined operator classes
pg_dump: reading user-defined operator families
pg_dump: reading user-defined text search parsers
pg_dump: reading user-defined text search templates
pg_dump: reading user-defined text search dictionaries
pg_dump: reading user-defined text search configurations
pg_dump: reading user-defined foreign-data wrappers
pg_dump: reading user-defined foreign servers
pg_dump: reading default privileges
pg_dump: reading user-defined collations
pg_dump: reading user-defined conversions
pg_dump: reading type casts
pg_dump: reading transforms
pg_dump: reading table inheritance information
pg_dump: reading event triggers
pg_dump: finding extension tables
pg_dump: finding inheritance relationships
pg_dump: reading column info for interesting tables
pg_dump: finding table default expressions
pg_dump: flagging inherited columns in subtables
pg_dump: reading partitioning data
pg_dump: reading indexes
pg_dump: flagging indexes in partitioned tables
pg_dump: reading extended statistics
pg_dump: reading constraints
pg_dump: reading triggers
pg_dump: reading rewrite rules
pg_dump: reading policies
pg_dump: reading row-level security policies
pg_dump: reading publications
pg_dump: reading publication membership of tables
pg_dump: reading publication membership of schemas
pg_dump: reading subscriptions
pg_dump: reading subscription membership of tables
pg_dump: reading large objects
pg_dump: reading dependency data
pg_dump: saving encoding = UTF8
pg_dump: saving "standard_conforming_strings = on"
pg_dump: saving "search_path = "
pg_dump: creating SCHEMA "public"
pg_dump: creating COMMENT "SCHEMA public"
pg_dump: creating TYPE "public.AlertSeverity"
pg_dump: creating TYPE "public.AlertType"
pg_dump: creating TYPE "public.ChecksumType"
pg_dump: creating TYPE "public.ComplianceCheckType"
pg_dump: creating TYPE "public.ComplianceStatus"
pg_dump: creating TYPE "public.DeliveryStatus"
pg_dump: creating TYPE "public.DeliveryType"
pg_dump: creating TYPE "public.DiscountOverrideStatus"
pg_dump: creating TYPE "public.DispatchStatus"
pg_dump: creating TYPE "public.FranchiseStatus"
pg_dump: creating TYPE "public.GRNStatus"
pg_dump: creating TYPE "public.InventoryReason"
pg_dump: creating TYPE "public.POStatus"
pg_dump: creating TYPE "public.PaymentMethod"
--
-- PostgreSQL database dump
--

\restrict VV6J9ozEmGiRh3gVl6A9A6ZWjhiiD4nahvBoNEoOiIpnORNw1cxKyZjwPhLoE1l

-- Dumped from database version 18.0 (Postgres.app)
-- Dumped by pg_dump version 18.0 (Postgres.app)

-- Started on 2026-01-05 21:36:50 IST

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5 (class 2615 OID 26317)
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- TOC entry 4572 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- TOC entry 1022 (class 1247 OID 28540)
-- Name: AlertSeverity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AlertSeverity" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);


--
-- TOC entry 1019 (class 1247 OID 28524)
-- Name: AlertType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AlertType" AS ENUM (
    'ABNORMAL_WASTAGE',
    'ABNORMAL_DISCOUNTING',
    'WEIGHT_MANIPULATION',
    'STOCK_MISMATCH',
    'EXPIRED_STOCK',
    'PRICING_VIOLATION',
    'COMPLIANCE_FAILURE'
);


--
-- TOC entry 932 (class 1247 OID 26436)
-- Name: ChecksumType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ChecksumType" AS ENUM (
    'NONE',
    'MOD10',
    'MOD11'
);


--
-- TOC entry 1013 (class 1247 OID 28504)
-- Name: ComplianceCheckType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ComplianceCheckType" AS ENUM (
    'DAILY_CLEANING',
    'TEMPERATURE_LOG',
    'PHOTO_PROOF',
    'LICENSE_EXPIRY',
    'DOCUMENT_EXPIRY'
);


--
-- TOC entry 1016 (class 1247 OID 28516)
-- Name: ComplianceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ComplianceStatus" AS ENUM (
    'COMPLIANT',
    'WARNING',
    'NON_COMPLIANT'
);


--
-- TOC entry 926 (class 1247 OID 26410)
-- Name: DeliveryStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DeliveryStatus" AS ENUM (
    'CREATED',
    'READY',
    'ASSIGNED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'FAILED',
    'RETURNED'
);


--
-- TOC entry 923 (class 1247 OID 26404)
-- Name: DeliveryType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DeliveryType" AS ENUM (
    'PICKUP',
    'DELIVERY'
);


--
-- TOC entry 1031 (class 1247 OID 28578)
-- Name: DiscountOverrideStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DiscountOverrideStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- TOC entry 917 (class 1247 OID 26390)
-- Name: DispatchStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DispatchStatus" AS ENUM (
    'CREATED',
    'IN_TRANSIT',
    'DELIVERED'
);


--
-- TOC entry 1001 (class 1247 OID 28468)
-- Name: FranchiseStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FranchiseStatus" AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'UNDER_AUDIT',
    'INACTIVE'
);


--
-- TOC entry 920 (class 1247 OID 26398)
-- Name: GRNStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."GRNStatus" AS ENUM (
    'RECEIVED',
    'PARTIAL'
);


--
-- TOC entry 911 (class 1247 OID 26362)
-- Name: InventoryReason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InventoryReason" AS ENUM (
    'SALE',
    'RECEIVE',
    'WASTAGE',
    'ADJUSTMENT',
    'TRANSFER',
    'CORRECTION',
    'DAMAGE',
    'OTHER',
    'OPENING',
    'RETURN',
    'YIELD'
);


--
-- TOC entry 914 (class 1247 OID 26374)
-- Name: POStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."POStatus" AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'DISPATCHED',
    'RECEIVED',
    'CLOSED'
);


--
-- TOC entry 908 (class 1247 OID 26354)
-- Name: PaymentMethod; Type: Tpg_dump: creating TYPE "public.PricingLockStatus"
pg_dump: creating TYPE "public.PricingPlanType"
pg_dump: creating TYPE "public.ProductType"
pg_dump: creating TYPE "public.RoyaltyCalculationBase"
pg_dump: creating TYPE "public.RoyaltyStatus"
pg_dump: creating TYPE "public.SaleStatus"
pg_dump: creating TYPE "public.StoreType"
pg_dump: creating TYPE "public.UnitType"
pg_dump: creating TYPE "public.UserRole"
pg_dump: creating TABLE "public.AlertRule"
pg_dump: creating TABLE "public.AuditLog"
pg_dump: creating TABLE "public.Category"
pg_dump: creating TABLE "public.CentralPOItem"
pg_dump: creating TABLE "public.CentralPurchaseOrder"
YPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentMethod" AS ENUM (
    'CASH',
    'CARD',
    'UPI',
    'CREDIT',
    'ONLINE'
);


--
-- TOC entry 1028 (class 1247 OID 28570)
-- Name: PricingLockStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PricingLockStatus" AS ENUM (
    'UNLOCKED',
    'LOCKED_BY_HQ',
    'LOCKED_BY_REGION'
);


--
-- TOC entry 1004 (class 1247 OID 28478)
-- Name: PricingPlanType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PricingPlanType" AS ENUM (
    'STANDARD',
    'PREMIUM',
    'CUSTOM'
);


--
-- TOC entry 1025 (class 1247 OID 28550)
-- Name: ProductType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProductType" AS ENUM (
    'WHOLE_CHICKEN',
    'BREAST',
    'LEG',
    'WINGS',
    'LIVER',
    'GIZZARD',
    'SKIN',
    'MINCE',
    'CUSTOM_CUT'
);


--
-- TOC entry 1007 (class 1247 OID 28486)
-- Name: RoyaltyCalculationBase; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RoyaltyCalculationBase" AS ENUM (
    'GROSS_SALES',
    'NET_SALES'
);


--
-- TOC entry 1010 (class 1247 OID 28492)
-- Name: RoyaltyStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RoyaltyStatus" AS ENUM (
    'PENDING',
    'CALCULATED',
    'INVOICED',
    'PAID',
    'OVERDUE'
);


--
-- TOC entry 905 (class 1247 OID 26344)
-- Name: SaleStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SaleStatus" AS ENUM (
    'OPEN',
    'PAID',
    'VOID',
    'REFUNDED'
);


--
-- TOC entry 899 (class 1247 OID 26333)
-- Name: StoreType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StoreType" AS ENUM (
    'OWNER',
    'FRANCHISE'
);


--
-- TOC entry 902 (class 1247 OID 26338)
-- Name: UnitType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UnitType" AS ENUM (
    'KG',
    'PCS'
);


--
-- TOC entry 929 (class 1247 OID 26426)
-- Name: UserRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserRole" AS ENUM (
    'OWNER',
    'MANAGER',
    'CASHIER',
    'DRIVER'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 257 (class 1259 OID 28897)
-- Name: AlertRule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AlertRule" (
    id text NOT NULL,
    "ownerStoreId" text NOT NULL,
    name text NOT NULL,
    "ruleType" text NOT NULL,
    threshold double precision NOT NULL,
    severity public."AlertSeverity" DEFAULT 'MEDIUM'::public."AlertSeverity" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 240 (class 1259 OID 26772)
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    "storeId" text NOT NULL,
    "actorUserId" text NOT NULL,
    action text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" text NOT NULL,
    "metaJson" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 225 (class 1259 OID 26526)
-- Name: Category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Category" (
    id text NOT NULL,
    "ownerStoreId" text NOT NULL,
    name text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 249 (class 1259 OID 28743)
-- Name: CentralPOItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CentralPOItem" (
    id text NOT NULL,
    "centralPOId" text NOT NULL,
    "productId" text NOT NULL,
    "qtyKg" double precision,
    "qtyPcs" integer,
    "unitRate" double precision NOT NULL,
    "totalAmount" double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 248 (class 1259 OID 28723)
-- Name: CentralPurchaseOrder; Type: TABLE; Schepg_dump: creating TABLE "public.ComplianceChecklistTemplate"
pg_dump: creating TABLE "public.ComplianceRecord"
pg_dump: creating TABLE "public.Customer"
pg_dump: creating TABLE "public.CustomerAddress"
pg_dump: creating TABLE "public.DailyClosing"
ma: public; Owner: -
--

CREATE TABLE public."CentralPurchaseOrder" (
    id text NOT NULL,
    "ownerStoreId" text NOT NULL,
    "supplierId" text NOT NULL,
    "poNo" text NOT NULL,
    "orderDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expectedDate" timestamp(3) without time zone,
    status public."POStatus" DEFAULT 'DRAFT'::public."POStatus" NOT NULL,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 254 (class 1259 OID 28843)
-- Name: ComplianceChecklistTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ComplianceChecklistTemplate" (
    id text NOT NULL,
    "ownerStoreId" text NOT NULL,
    name text NOT NULL,
    "checkType" public."ComplianceCheckType" NOT NULL,
    items jsonb NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 255 (class 1259 OID 28860)
-- Name: ComplianceRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ComplianceRecord" (
    id text NOT NULL,
    "franchiseConfigId" text NOT NULL,
    "templateId" text,
    "checkType" public."ComplianceCheckType" NOT NULL,
    status public."ComplianceStatus" NOT NULL,
    "checkedBy" text NOT NULL,
    "checkedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    temperature double precision,
    "photoUrl" text,
    "documentUrl" text,
    "expiryDate" timestamp(3) without time zone,
    notes text,
    score integer,
    "submissionData" jsonb,
    "reviewedBy" text,
    "reviewedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 222 (class 1259 OID 26474)
-- Name: Customer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Customer" (
    id text NOT NULL,
    "storeId" text NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "loyaltyPoints" double precision DEFAULT 0 NOT NULL,
    "loyaltyTier" text DEFAULT 'BRONZE'::text NOT NULL,
    "totalSpent" double precision DEFAULT 0 NOT NULL
);


--
-- TOC entry 223 (class 1259 OID 26488)
-- Name: CustomerAddress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CustomerAddress" (
    id text NOT NULL,
    "customerId" text NOT NULL,
    label text NOT NULL,
    line1 text NOT NULL,
    line2 text,
    city text NOT NULL,
    state text NOT NULL,
    zip text NOT NULL,
    "geoLat" double precision,
    "geoLng" double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 262 (class 1259 OID 29028)
-- Name: DailyClosing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DailyClosing" (
    id text NOT NULL,
    "storeId" text NOT NULL,
    "shiftId" text,
    "closingDate" timestamp(3) without time zone NOT NULL,
    "closedBy" text NOT NULL,
    "openingCash" double precision DEFAULT 0 NOT NULL,
    "cashSales" double precision DEFAULT 0 NOT NULL,
    "cardSales" double precision DEFAULT 0 NOT NULL,
    "upiSales" double precision DEFAULT 0 NOT NULL,
    "cashReceived" double precision DEFAULT 0 NOT NULL,
    "cashExpected" double precision DEFAULT 0 NOT NULL,
    "cashDifference" double precision DEFAULT 0 NOT NULL,
    "closingCash" double precision DEFAULT 0 NOT NULL,
    "totalWeightSoldKg" double precision DEFAULT 0 NOT NULL,
    "totalWastageKg" double precision DEFAULT 0 NOT NULL,
    "closingStockJson" jsonb,
    "totalSales" integer DEFAULT 0 NOT NULL,
    "totalRevenue" double precision DEFAULT 0 NOT NULpg_dump: creating TABLE "public.DeliveryEvent"
pg_dump: creating TABLE "public.DeliveryOrder"
pg_dump: creating TABLE "public.DiscountOverride"
pg_dump: creating TABLE "public.Dispatch"
pg_dump: creating TABLE "public.DispatchItem"
pg_dump: creating TABLE "public.FranchiseConfig"
L,
    "totalDiscounts" double precision DEFAULT 0 NOT NULL,
    "totalTax" double precision DEFAULT 0 NOT NULL,
    notes text,
    "isFinalized" boolean DEFAULT false NOT NULL,
    "finalizedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 239 (class 1259 OID 26759)
-- Name: DeliveryEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DeliveryEvent" (
    id text NOT NULL,
    "deliveryOrderId" text NOT NULL,
    status public."DeliveryStatus" NOT NULL,
    note text,
    "createdBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 238 (class 1259 OID 26741)
-- Name: DeliveryOrder; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DeliveryOrder" (
    id text NOT NULL,
    "storeId" text NOT NULL,
    "saleId" text NOT NULL,
    type public."DeliveryType" NOT NULL,
    status public."DeliveryStatus" DEFAULT 'CREATED'::public."DeliveryStatus" NOT NULL,
    "assignedDriverId" text,
    "deliveryFee" double precision DEFAULT 0 NOT NULL,
    "addressId" text,
    "otpCodeHash" text,
    "outForDeliveryAt" timestamp(3) without time zone,
    "deliveredAt" timestamp(3) without time zone,
    "failureReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 261 (class 1259 OID 29009)
-- Name: DiscountOverride; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DiscountOverride" (
    id text NOT NULL,
    "saleId" text NOT NULL,
    "storeId" text NOT NULL,
    "requestedBy" text NOT NULL,
    "approvedBy" text,
    "originalDiscount" double precision NOT NULL,
    "overrideDiscount" double precision NOT NULL,
    reason text NOT NULL,
    status public."DiscountOverrideStatus" DEFAULT 'PENDING'::public."DiscountOverrideStatus" NOT NULL,
    "approvedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 235 (class 1259 OID 26697)
-- Name: Dispatch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Dispatch" (
    id text NOT NULL,
    "poId" text NOT NULL,
    "dispatchNo" text NOT NULL,
    status public."DispatchStatus" DEFAULT 'CREATED'::public."DispatchStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 236 (class 1259 OID 26712)
-- Name: DispatchItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DispatchItem" (
    id text NOT NULL,
    "dispatchId" text NOT NULL,
    "productId" text NOT NULL,
    "qtyKg" double precision,
    "qtyPcs" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 242 (class 1259 OID 28610)
-- Name: FranchiseConfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FranchiseConfig" (
    id text NOT NULL,
    "franchiseStoreId" text NOT NULL,
    status public."FranchiseStatus" DEFAULT 'ACTIVE'::public."FranchiseStatus" NOT NULL,
    "pricingPlanId" text,
    "royaltyPercentage" double precision DEFAULT 0 NOT NULL,
    "royaltyCalculationBase" public."RoyaltyCalculationBase" DEFAULT 'GROSS_SALES'::public."RoyaltyCalculationBase" NOT NULL,
    "allowedWastagePercent" double precision DEFAULT 5.0 NOT NULL,
    "allowedDiscountPercent" double precision DEFAULT 10.0 NOT NULL,
    "areaManagerId" text,
    "onboardingCompletedAt" timestamp(3) without time zone,
    "onboardingData" jsonb,
    "isPricingLocked" boolean DEFAULT false NOT NULL,
    "isDiscountLocked" boolean DEFAULT false NOT NULL,
    "isWastageLocked" boolean DEFAULT false NOT NULL,
    "lockedBy" text,
    "lockedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT Cpg_dump: creating TABLE "public.FranchiseHealthScore"
pg_dump: creating TABLE "public.GRN"
pg_dump: creating TABLE "public.HQAlert"
pg_dump: creating TABLE "public.InventoryLedger"
pg_dump: creating TABLE "public.InwardStock"
pg_dump: creating TABLE "public.LoyaltyTransaction"
URRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 258 (class 1259 OID 28916)
-- Name: FranchiseHealthScore; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FranchiseHealthScore" (
    id text NOT NULL,
    "franchiseConfigId" text NOT NULL,
    "scoreDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "salesGrowthScore" double precision DEFAULT 0 NOT NULL,
    "yieldEfficiencyScore" double precision DEFAULT 0 NOT NULL,
    "wastageScore" double precision DEFAULT 0 NOT NULL,
    "discountScore" double precision DEFAULT 0 NOT NULL,
    "complianceScore" double precision DEFAULT 0 NOT NULL,
    "stockVarianceScore" double precision DEFAULT 0 NOT NULL,
    "overallScore" double precision DEFAULT 0 NOT NULL,
    "salesGrowthPercent" double precision,
    "yieldEfficiencyPercent" double precision,
    "wastagePercent" double precision,
    "discountPercent" double precision,
    "compliancePercent" double precision,
    "stockVariancePercent" double precision,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 237 (class 1259 OID 26724)
-- Name: GRN; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GRN" (
    id text NOT NULL,
    "dispatchId" text NOT NULL,
    "receivedBy" text NOT NULL,
    "receivedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status public."GRNStatus" DEFAULT 'RECEIVED'::public."GRNStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 256 (class 1259 OID 28877)
-- Name: HQAlert; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."HQAlert" (
    id text NOT NULL,
    "ownerStoreId" text NOT NULL,
    "franchiseStoreId" text,
    "alertType" public."AlertType" NOT NULL,
    severity public."AlertSeverity" NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    metadata jsonb,
    "isRead" boolean DEFAULT false NOT NULL,
    "isResolved" boolean DEFAULT false NOT NULL,
    "resolvedBy" text,
    "resolvedAt" timestamp(3) without time zone,
    "acknowledgedBy" text,
    "acknowledgedAt" timestamp(3) without time zone,
    "acknowledgmentNotes" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 227 (class 1259 OID 26559)
-- Name: InventoryLedger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InventoryLedger" (
    id text NOT NULL,
    "storeId" text NOT NULL,
    "productId" text NOT NULL,
    type text NOT NULL,
    "qtyKg" double precision,
    "qtyPcs" integer,
    reason public."InventoryReason" NOT NULL,
    "refId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 250 (class 1259 OID 28757)
-- Name: InwardStock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InwardStock" (
    id text NOT NULL,
    "ownerStoreId" text NOT NULL,
    "centralPOId" text,
    "supplierId" text NOT NULL,
    "productId" text NOT NULL,
    "batchNo" text,
    "totalWeightKg" double precision NOT NULL,
    "temperatureCheck" double precision,
    "receivedBy" text NOT NULL,
    "receivedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 263 (class 1259 OID 29072)
-- Name: LoyaltyTransaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LoyaltyTransaction" (
    id text NOT NULL,
    "customerId" text NOT NULL,
    "storeId" text NOT NULL,
    type text NOT NULL,
    points double precision NOT NULL,
    balance double precision NOT NULL,
    description text,
    "saleId" text,
    "createdAt" timestamp(3) witpg_dump: creating TABLE "public.Payment"
pg_dump: creating TABLE "public.PricingOverride"
pg_dump: creating TABLE "public.PricingPlan"
pg_dump: creating TABLE "public.PricingRule"
pg_dump: creating TABLE "public.Product"
pg_dump: creating TABLE "public.ProductMaster"
pg_dump: creating TABLE "public.PurchaseOrder"
hout time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdBy" text
);


--
-- TOC entry 230 (class 1259 OID 26615)
-- Name: Payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Payment" (
    id text NOT NULL,
    "saleId" text NOT NULL,
    method public."PaymentMethod" NOT NULL,
    amount double precision NOT NULL,
    "txnRef" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 245 (class 1259 OID 28668)
-- Name: PricingOverride; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PricingOverride" (
    id text NOT NULL,
    "franchiseConfigId" text NOT NULL,
    "productId" text NOT NULL,
    "overridePrice" double precision NOT NULL,
    "lockStatus" public."PricingLockStatus" DEFAULT 'UNLOCKED'::public."PricingLockStatus" NOT NULL,
    "approvedByHQ" boolean DEFAULT false NOT NULL,
    "approvedByUserId" text,
    "approvedAt" timestamp(3) without time zone,
    reason text,
    "effectiveFrom" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "effectiveTo" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 243 (class 1259 OID 28638)
-- Name: PricingPlan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PricingPlan" (
    id text NOT NULL,
    name text NOT NULL,
    type public."PricingPlanType" NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 244 (class 1259 OID 28653)
-- Name: PricingRule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PricingRule" (
    id text NOT NULL,
    "pricingPlanId" text NOT NULL,
    "productId" text,
    "categoryId" text,
    "basePrice" double precision NOT NULL,
    "minPrice" double precision,
    "maxPrice" double precision,
    "effectiveFrom" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "effectiveTo" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 224 (class 1259 OID 26505)
-- Name: Product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Product" (
    id text NOT NULL,
    "ownerStoreId" text NOT NULL,
    sku text NOT NULL,
    plu text NOT NULL,
    name text NOT NULL,
    "categoryId" text NOT NULL,
    "unitType" public."UnitType" NOT NULL,
    "taxRate" double precision DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "imageUrl" text
);


--
-- TOC entry 246 (class 1259 OID 28688)
-- Name: ProductMaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductMaster" (
    id text NOT NULL,
    "ownerStoreId" text NOT NULL,
    "productId" text NOT NULL,
    "productType" public."ProductType" NOT NULL,
    "expectedYieldPercent" double precision DEFAULT 100.0 NOT NULL,
    "wastageTolerancePercent" double precision DEFAULT 5.0 NOT NULL,
    "taxCategory" text,
    "hqLockedPrice" double precision,
    "isHQLocked" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 233 (class 1259 OID 26669)
-- Name: PurchaseOrder; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PurchaseOrder" (
    id text NOT NULL,
    "franchiseStoreId" text NOT NULL,
    "ownerStoreId" text NOT NULL,
    "poNo" text NOT NULL,
    status public."POStatus" DEFAULT 'DRAFT'::public."POStatus" NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) withoupg_dump: creating TABLE "public.PurchaseOrderItem"
pg_dump: creating TABLE "public.ReplenishmentRequest"
pg_dump: creating TABLE "public.RoyaltyInvoice"
pg_dump: creating TABLE "public.RoyaltyLedger"
pg_dump: creating TABLE "public.Sale"
t time zone NOT NULL
);


--
-- TOC entry 234 (class 1259 OID 26685)
-- Name: PurchaseOrderItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PurchaseOrderItem" (
    id text NOT NULL,
    "poId" text NOT NULL,
    "productId" text NOT NULL,
    "qtyKg" double precision,
    "qtyPcs" integer,
    "requestedRate" double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "receivedQtyKg" double precision,
    "receivedQtyPcs" integer,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 260 (class 1259 OID 28974)
-- Name: ReplenishmentRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ReplenishmentRequest" (
    id text NOT NULL,
    "franchiseStoreId" text NOT NULL,
    "productId" text NOT NULL,
    "salesVelocity7d" double precision DEFAULT 0 NOT NULL,
    "salesVelocity14d" double precision DEFAULT 0 NOT NULL,
    "salesVelocity30d" double precision DEFAULT 0 NOT NULL,
    "currentStockKg" double precision DEFAULT 0 NOT NULL,
    "currentStockPcs" integer DEFAULT 0 NOT NULL,
    "requestedQtyKg" double precision,
    "requestedQtyPcs" integer,
    "leadTimeDays" integer DEFAULT 3 NOT NULL,
    "safetyBufferDays" integer DEFAULT 2 NOT NULL,
    "calculatedDemandKg" double precision DEFAULT 0 NOT NULL,
    "calculatedDemandPcs" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "approvedBy" text,
    "approvedAt" timestamp(3) without time zone,
    "approvalNotes" text,
    "adjustedQtyKg" double precision,
    "adjustedQtyPcs" integer,
    "adjustmentReason" text,
    "requestedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 252 (class 1259 OID 28794)
-- Name: RoyaltyInvoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RoyaltyInvoice" (
    id text NOT NULL,
    "franchiseConfigId" text NOT NULL,
    "invoiceNo" text NOT NULL,
    "periodStart" timestamp(3) without time zone NOT NULL,
    "periodEnd" timestamp(3) without time zone NOT NULL,
    "grossSales" double precision DEFAULT 0 NOT NULL,
    "netSales" double precision DEFAULT 0 NOT NULL,
    "totalDiscounts" double precision DEFAULT 0 NOT NULL,
    "totalWastage" double precision DEFAULT 0 NOT NULL,
    "wastagePenalty" double precision DEFAULT 0 NOT NULL,
    "pricingViolationPenalty" double precision DEFAULT 0 NOT NULL,
    "compliancePenalty" double precision DEFAULT 0 NOT NULL,
    "baseRoyalty" double precision DEFAULT 0 NOT NULL,
    "totalRoyalty" double precision DEFAULT 0 NOT NULL,
    status public."RoyaltyStatus" DEFAULT 'PENDING'::public."RoyaltyStatus" NOT NULL,
    "dueDate" timestamp(3) without time zone NOT NULL,
    "paidAt" timestamp(3) without time zone,
    "paymentReference" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 253 (class 1259 OID 28830)
-- Name: RoyaltyLedger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RoyaltyLedger" (
    id text NOT NULL,
    "franchiseConfigId" text NOT NULL,
    "invoiceId" text,
    type text NOT NULL,
    amount double precision NOT NULL,
    description text,
    reference text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdBy" text
);


--
-- TOC entry 228 (class 1259 OID 26573)
-- Name: Sale; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Sale" (
    id text NOT NULL,
    "storeId" text NOT NULL,
    "saleNo" text NOT NULL,
    "customerId" text,
    status public."SaleStatus" DEFAULT 'OPEN'::public."SaleStatus" NOT NULL,
    "subTotal" double precision DEFAULT 0 NOT NULL,
    "discountTotal" double precision DEFAULT 0 NOT NULL,
    "taxTotal" double precision DEFAULT 0 NOT NULL,
    "grandTotal" double precision DEFAULT 0 NOT NULL,
    "createdByUserId" pg_dump: creating TABLE "public.SaleItem"
pg_dump: creating TABLE "public.ScaleBarcodeConfig"
pg_dump: creating TABLE "public.Shift"
pg_dump: creating TABLE "public.StockAllocation"
pg_dump: creating TABLE "public.Store"
pg_dump: creating TABLE "public.StoreProductPrice"
pg_dump: creating TABLE "public.Supplier"
text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 229 (class 1259 OID 26597)
-- Name: SaleItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SaleItem" (
    id text NOT NULL,
    "saleId" text NOT NULL,
    "productId" text NOT NULL,
    "qtyKg" double precision,
    "qtyPcs" integer,
    rate double precision NOT NULL,
    "lineTotal" double precision NOT NULL,
    "taxRate" double precision DEFAULT 0 NOT NULL,
    "taxAmount" double precision DEFAULT 0 NOT NULL,
    "metaJson" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 232 (class 1259 OID 26645)
-- Name: ScaleBarcodeConfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ScaleBarcodeConfig" (
    id text NOT NULL,
    "storeId" text NOT NULL,
    name text NOT NULL,
    prefix text NOT NULL,
    "pluStart" integer NOT NULL,
    "pluLength" integer NOT NULL,
    "weightStart" integer NOT NULL,
    "weightLength" integer NOT NULL,
    "weightDecimal" integer DEFAULT 2 NOT NULL,
    "priceStart" integer,
    "priceLength" integer,
    "priceDecimal" integer,
    "checksumType" public."ChecksumType" DEFAULT 'NONE'::public."ChecksumType" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 231 (class 1259 OID 26628)
-- Name: Shift; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Shift" (
    id text NOT NULL,
    "storeId" text NOT NULL,
    "openedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "closedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "closedByUserId" text,
    "closingCash" double precision,
    notes text,
    "openedByUserId" text NOT NULL,
    "openingCash" double precision DEFAULT 0 NOT NULL
);


--
-- TOC entry 251 (class 1259 OID 28775)
-- Name: StockAllocation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StockAllocation" (
    id text NOT NULL,
    "ownerStoreId" text NOT NULL,
    "centralPOId" text,
    "inwardStockId" text,
    "franchiseStoreId" text NOT NULL,
    "productId" text NOT NULL,
    "allocatedQtyKg" double precision NOT NULL,
    "allocatedQtyPcs" integer,
    "allocatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dispatchedAt" timestamp(3) without time zone,
    "receivedAt" timestamp(3) without time zone,
    status public."DispatchStatus" DEFAULT 'CREATED'::public."DispatchStatus" NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 220 (class 1259 OID 26443)
-- Name: Store; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Store" (
    id text NOT NULL,
    name text NOT NULL,
    type public."StoreType" NOT NULL,
    "parentOwnerStoreId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 226 (class 1259 OID 26541)
-- Name: StoreProductPrice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StoreProductPrice" (
    id text NOT NULL,
    "storeId" text NOT NULL,
    "productId" text NOT NULL,
    "pricePerUnit" double precision NOT NULL,
    "effectiveFrom" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 247 (class 1259 OID 28708)
-- Name: Supplier; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Supplier" (
    id text NOT NULpg_dump: creating TABLE "public.SyncEvent"
pg_dump: creating TABLE "public.User"
pg_dump: creating TABLE "public.YieldIntelligence"
pg_dump: creating TABLE "public._prisma_migrations"
pg_dump: processing data for table "public.AlertRule"
pg_dump: dumping contents of table "public.AlertRule"
pg_dump: processing data for table "public.AuditLog"
pg_dump: dumping contents of table "public.AuditLog"
L,
    "ownerStoreId" text NOT NULL,
    name text NOT NULL,
    "contactName" text,
    phone text,
    email text,
    address text,
    city text,
    state text,
    zip text,
    gstin text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 241 (class 1259 OID 26787)
-- Name: SyncEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SyncEvent" (
    id text NOT NULL,
    "storeId" text NOT NULL,
    "deviceId" text NOT NULL,
    "eventType" text NOT NULL,
    "payloadJson" jsonb NOT NULL,
    "clientCreatedAt" timestamp(3) without time zone NOT NULL,
    "serverReceivedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP,
    "ackedAt" timestamp(3) without time zone
);


--
-- TOC entry 221 (class 1259 OID 26456)
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    "storeId" text NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    role public."UserRole" NOT NULL,
    "passwordHash" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 259 (class 1259 OID 28944)
-- Name: YieldIntelligence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."YieldIntelligence" (
    id text NOT NULL,
    "franchiseConfigId" text NOT NULL,
    "productId" text,
    "periodStart" timestamp(3) without time zone NOT NULL,
    "periodEnd" timestamp(3) without time zone NOT NULL,
    "expectedYieldKg" double precision DEFAULT 0 NOT NULL,
    "actualYieldKg" double precision DEFAULT 0 NOT NULL,
    "yieldEfficiency" double precision DEFAULT 0 NOT NULL,
    "cuttingLossKg" double precision DEFAULT 0 NOT NULL,
    "spoilageLossKg" double precision DEFAULT 0 NOT NULL,
    "theftSuspicionKg" double precision DEFAULT 0 NOT NULL,
    "otherLossKg" double precision DEFAULT 0 NOT NULL,
    "totalReceivedKg" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 219 (class 1259 OID 26318)
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- TOC entry 4560 (class 0 OID 28897)
-- Dependencies: 257
-- Data for Name: AlertRule; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AlertRule" (id, "ownerStoreId", name, "ruleType", threshold, severity, "isActive", description, "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 4543 (class 0 OID 26772)
-- Dependencies: 240
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AuditLog" (id, "storeId", "actorUserId", action, "entityType", "entityId", "metaJson", "createdAt") FROM stdin;
cmjtomcmf0006htji00qtqr34	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjtomckh0001htjienhv4avq	{"saleNo": "SALE-20251231-0001", "grandTotal": 1072}	2025-12-31 07:15:47.175
cmjtomd7c000dhtji9wqb1kt8	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjtomckh0001htjienhv4avq	{"payments": [{"amount": 1072, "method": "CASH"}]}	2025-12-31 07:15:47.928
cmjtomdqk000mhtji5u9f8i0d	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjtomdpg000fhtjil2kg6ess	{"saleNo": "SALE-20251231-0002", "grandTotal": 2788.32}	2025-12-31 07:15:48.62
cmjtoml6r00089n87sf8plt27	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjtoml5y00019n87frf4wj9j	{"saleNo": "SALE-20251231-0003", "grandTotal": 2788.32}	2025-12-31 07:15:58.275
cmjtomodh000h9n87cas8crpr	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjtomocn000a9n87ezasnisg	{"saleNo": "SALE-20251231-0004", "grandTotal": 2788.32}	2025-12-31 07:16:02.405
cmjtomr8u000q9n87f40474sd	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjtomr83000j9n8786xxfxd5	{"saleNo": "SALE-20251231-0005", "grandTotal": 2788.32}	2025-12-31 07:16:06.127
cmjtomusy0008zrlo34idoz1k	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjtomus80001zrlo0qqdnm21	{"saleNo": "SALE-20251231-0006", "grandTotal": 2788.32}	2025-12-31 07:16:10.738
cmjtomyqt000hzrlogs4ls6p0	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjtomyq1000azrlo9nkye0lc	{"saleNo": "SALE-20251231-0007", "grandTotal": 2788.32}	2025-12-31 07:16:15.845
cmjtt5myh00084ur6e8c584em	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjtt5mw700014ur68tu8st9v	{"saleNo": "SALE-20251231-0008", "grandTotal": 2788.32}	2025-12-31 09:22:45.497
cmjtt5njt000j4ur6at09brdt	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjtt5mw700014ur68tu8st9v	{"payments": [{"amount": 2788.32, "method": "CASH"}]}	2025-12-31 09:22:46.265
cmjtw1j3s00051g1y5afh60m2	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjtw1j1y00011g1y3rhnxn7b	{"saleNo": "SALE-20251231-0001", "grandTotal": 180}	2025-12-31 10:43:32.728
cmjtw1jmf000a1g1y9pra36ia	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjtw1j1y00011g1y3rhnxn7b	{"payments": [{"amount": 180, "method": "CASH"}]}	2025-12-31 10:43:33.4
cmjtw2jiv0005v4a8t9cdw22x	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjtw2jh60001v4a87xyo5299	{"saleNo": "SALE-20251231-0002", "grandTotal": 400}	2025-12-31 10:44:19.927
cmjtw2k79000av4a8vk496pav	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjtw2jh60001v4a87xyo5299	{"payments": [{"amount": 400, "method": "UPI"}]}	2025-12-31 10:44:20.806
cmjtwb0cl0005sr4me2lylvv6	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjtwb0bg0001sr4mxj4bniaq	{"saleNo": "SALE-20251231-0001", "grandTotal": 745.9199999999998}	2025-12-31 10:50:54.981
cmjtwb0x0000asr4mdyqh4w4d	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjtwb0bg0001sr4mxj4bniaq	{"payments": [{"amount": 745.9199999999998, "method": "CASH"}]}	2025-12-31 10:50:55.716
cmjtydtjr0005vlypk3mww63c	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjtydti90001vlypl5tt23wa	{"saleNo": "SALE-20251231-0001", "grandTotal": 577.92}	2025-12-31 11:49:05.367
cmjtyducb000avlyp58gdkmgf	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjtydti90001vlypl5tt23wa	{"payments": [{"amount": 577.92, "method": "UPI"}]}	2025-12-31 11:49:06.396
cmju1utnz0005pbdjs24l1ckx	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmju1utmo0001pbdjcgsftjeh	{"saleNo": "SALE-20251231-0002", "grandTotal": 213.9}	2025-12-31 13:26:17.519
cmju1uu5h000apbdjgscaq81i	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmju1utmo0001pbdjcgsftjeh	{"payments": [{"amount": 213.9, "method": "CASH"}]}	2025-12-31 13:26:18.149
cmjuvnozf0009pofx9gbrxh5m	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjuvnoyq0007pofxech9wb45	{"qtyKg": -1, "reason": "ADJUSTMENT", "productId": "cmjtfylpc000dmw9vtbj4su00", "adjustmentType": "OUT"}	2026-01-01 03:20:33.34
cmjuwap100009oqc35ej5a6r8	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjuwap0n0007oqc36x7mypp9	{"qtyKg": 0.3, "reason": "ADJUSTMENT", "productId": "cmjtfymb5000hmw9vlsdpz75l", "adjustmentType": "IN"}	2026-01-01 03:38:26.484
cmjuwva0y00039f08gb6t4r4y	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjuwv9zp00019f08s2bup8rx	{"qtyKg": 2, "reason": "ADJUSTMENT", "productId": "cmjtfynix000pmw9vh4n9s2l9", "adjustmentType": "IN"}	2026-01-01 03:54:26.818
cmjuww2ok00079f08puulha5f	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjuww2nk00059f0894oi2ea8	{"qtyKg": 8.5, "reason": "ADJUSTMENT", "productId": "cmjtfyk5i0005mw9vji8icng4", "adjustmentType": "IN"}	2026-01-01 03:55:03.957
cmjuwwlyi000b9f08gbz4tsr0	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjuwwly700099f08h9w74bvo	{"qtyKg": 2.4, "reason": "ADJUSTMENT", "productId": "cmjtfyl260009mw9vktuvk4rd", "adjustmentType": "IN"}	2026-01-01 03:55:28.939
cmjuwwyde000f9f083qw9l8lq	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjuwwyd2000d9f086s6uc1xi	{"qtyKg": 49, "reason": "ADJUSTMENT", "productId": "cmjten9z3000iviumzzz362v3", "adjustmentType": "IN"}	2026-01-01 03:55:45.026
cmjv0is290007bkdl3lmt04u2	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjv0is0p0003bkdlso3hiulz	{"saleNo": "SALE-20260101-0001", "grandTotal": 350.4}	2026-01-01 05:36:42.13
cmjv0isl6000ebkdl8jjwdrhw	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjv0is0p0003bkdlso3hiulz	{"payments": [{"amount": 350, "method": "UPI"}]}	2026-01-01 05:36:42.81
cmjwdozwf0005wc8nsudeth9k	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwdozu70001wc8ntff9xxy6	{"saleNo": "SALE-20260102-0001", "grandTotal": 297.6}	2026-01-02 04:33:13.408
cmjwdp0js000awc8ng5217itt	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwdozu70001wc8ntff9xxy6	{"payments": [{"amount": 298, "method": "UPI"}]}	2026-01-02 04:33:14.248
cmjwdpwk60005vy0c0p2chg8j	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwdpwh00001vy0ckde98071	{"saleNo": "SALE-20260102-0002", "grandTotal": 110.4}	2026-01-02 04:33:55.735
cmjwdpx6u000avy0c3085xeq4	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwdpwh00001vy0ckde98071	{"payments": [{"amount": 110, "method": "UPI"}]}	2026-01-02 04:33:56.551
cmjwdutwx000iwc8ngfs0dgot	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwdutvb000ewc8nbcsv9f2l	{"saleNo": "SALE-20260102-0003", "grandTotal": 122.4}	2026-01-02 04:37:45.585
cmjwduuip000pwc8ndgf2x3ai	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwdutvb000ewc8nbcsv9f2l	{"payments": [{"amount": 122, "method": "CASH"}]}	2026-01-02 04:37:46.37
cmjwe1nde0007v5heg5el3uv9	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwe1ncc0003v5hehm2yjmt5	{"saleNo": "SALE-20260102-0004", "grandTotal": 235.2}	2026-01-02 04:43:03.699
cmjwe1nyd000ev5he0rvlve2o	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwe1ncc0003v5hehm2yjmt5	{"payments": [{"amount": 235, "method": "CASH"}]}	2026-01-02 04:43:04.453
cmjwe3n8f000710r11athui6f	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwe3n74000310r1kc11xwh3	{"saleNo": "SALE-20260102-0005", "grandTotal": 153.6}	2026-01-02 04:44:36.831
cmjwe3nss000e10r1sdt990d0	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwe3n74000310r1kc11xwh3	{"payments": [{"amount": 154, "method": "CASH"}]}	2026-01-02 04:44:37.564
cmjwecsof0006q9fz3rm13pvf	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwecsn10001q9fz2ok74dab	{"saleNo": "SALE-20260102-0006", "grandTotal": 366.8}	2026-01-02 04:51:43.791
cmjwectow000iq9fzxi2312yn	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwecsn10001q9fz2ok74dab	{"payments": [{"amount": 367, "method": "UPI"}]}	2026-01-02 04:51:45.104
cmjwectp8000kq9fztn4iiynd	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwectns0009q9fzidqk7fry	{"saleNo": "SALE-20260102-0007", "grandTotal": 366.8}	2026-01-02 04:51:45.116
cmjwecumu000rq9fztmqj60tk	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwectns0009q9fzidqk7fry	{"payments": [{"amount": 367, "method": "UPI"}]}	2026-01-02 04:51:46.326
cmjweg8cn0007vkn6rb5ad02n	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjweg8ap0003vkn6pzoq8gs7	{"saleNo": "SALE-20260102-0008", "grandTotal": 348.8}	2026-01-02 04:54:24.072
cmjweg8vq000evkn6x3c230si	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjweg8ap0003vkn6pzoq8gs7	{"payments": [{"amount": 349, "method": "UPI"}]}	2026-01-02 04:54:24.758
cmjwehb2c0005brvkb825doao	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwehb0t0001brvkfafx2tn7	{"saleNo": "SALE-20260102-0009", "grandTotal": 323.2}	2026-01-02 04:55:14.245
cmjwehbnq000abrvkzwjqjbsr	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwehb0t0001brvkfafx2tn7	{"payments": [{"amount": 323, "method": "UPI"}]}	2026-01-02 04:55:15.014
cmjwemd7a0005u38mdq217jkz	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwemd5s0001u38m9xb2m18j	{"saleNo": "SALE-20260102-0010", "grandTotal": 323.2}	2026-01-02 04:59:10.294
cmjwemdrz000au38mr12xiap3	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwemd5s0001u38m9xb2m18j	{"payments": [{"amount": 323, "method": "CASH"}]}	2026-01-02 04:59:11.04
cmjweoo5500096ho93adbsu8u	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjweoo3r00056ho9a5hqs347	{"saleNo": "SALE-20260102-0011", "grandTotal": 209.3}	2026-01-02 05:00:57.785
cmjweoosf000g6ho9qamuvw06	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjweoo3r00056ho9a5hqs347	{"payments": [{"amount": 209, "method": "CASH"}]}	2026-01-02 05:00:58.624
cmjweqo490005kgjc8iv8ggxr	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjweqo2t0001kgjc3tyc2jb5	{"saleNo": "SALE-20260102-0012", "grandTotal": 248.4}	2026-01-02 05:02:31.065
cmjweqowp000akgjct58fai08	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjweqo2t0001kgjc3tyc2jb5	{"payments": [{"amount": 248, "method": "UPI"}]}	2026-01-02 05:02:32.089
cmjwg5tm40005y12rh1arfjlr	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwg5tkh0001y12rbd9dqa4y	{"saleNo": "SALE-20260102-0013", "grandTotal": 239.2}	2026-01-02 05:42:17.644
cmjwg5u56000ay12r1h6dcl87	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwg5tkh0001y12rbd9dqa4y	{"payments": [{"amount": 239, "method": "CASH"}]}	2026-01-02 05:42:18.331
cmjwgagz200055wvdfkgxlv1c	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwgagxi00015wvdvvgksty3	{"saleNo": "SALE-20260102-0014", "grandTotal": 200}	2026-01-02 05:45:54.543
cmjwgahjk000a5wvdcthggvb8	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwgagxi00015wvdvvgksty3	{"payments": [{"amount": 200, "method": "CASH"}]}	2026-01-02 05:45:55.281
cmjwgd8kh0005nhq4u3jj578q	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwgd8jd0001nhq4bomk1m9s	{"saleNo": "SALE-20260102-0015", "grandTotal": 66.7}	2026-01-02 05:48:03.618
cmjwgd96b000anhq4am9gxtyp	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwgd8jd0001nhq4bomk1m9s	{"payments": [{"amount": 67, "method": "UPI"}]}	2026-01-02 05:48:04.404
cmjwggayz00085t5zt2leropv	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwggaxp00035t5zgq0huy4f	{"saleNo": "SALE-20260102-0016", "grandTotal": 522.4}	2026-01-02 05:50:26.699
cmjwggblu000h5t5zx12l7u29	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwggaxp00035t5zgq0huy4f	{"payments": [{"amount": 522, "method": "UPI"}]}	2026-01-02 05:50:27.522
cmjwgrsra0008g4lrw9jco0qf	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwgrsq50003g4lr5kt318dk	{"saleNo": "SALE-20260102-0017", "grandTotal": 305.6}	2026-01-02 05:59:22.967
cmjwgrtdp000hg4lr1pwi1cot	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwgrsq50003g4lr5kt318dk	{"payments": [{"amount": 306, "method": "UPI"}]}	2026-01-02 05:59:23.773
cmjwh4ksr00058o18gtbw2rxk	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwh4kr000018o18g0dxojc4	{"saleNo": "SALE-20260102-0018", "grandTotal": 497.6}	2026-01-02 06:09:19.179
cmjwh4leb000a8o18szwkkrt1	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwh4kr000018o18g0dxojc4	{"payments": [{"amount": 498, "method": "CASH"}]}	2026-01-02 06:09:19.956
cmjwh8eoi0005kpvqvdo6yp65	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwh8enc0001kpvq0w0i9p7l	{"saleNo": "SALE-20260102-0019", "grandTotal": 129.6}	2026-01-02 06:12:17.875
cmjwh8f9w000akpvqpg9bixxl	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwh8enc0001kpvq0w0i9p7l	{"payments": [{"amount": 130, "method": "UPI"}]}	2026-01-02 06:12:18.644
cmjwj56qw0005x539zslzvuah	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwj56oo0001x539bhp1xfsb	{"saleNo": "SALE-20260102-0020", "grandTotal": 464.6}	2026-01-02 07:05:46.856
cmjwj57hq000cx5396euelbb1	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwj56oo0001x539bhp1xfsb	{"payments": [{"amount": 465, "method": "UPI"}]}	2026-01-02 07:05:47.822
cmjwk23s90005uqv77b7ls45j	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwk23qw0001uqv7qjw2xw1e	{"saleNo": "SALE-20260102-0021", "grandTotal": 462.3000000000001}	2026-01-02 07:31:22.665
cmjwk24e2000auqv7jc3dgu8s	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwk23qw0001uqv7qjw2xw1e	{"payments": [{"amount": 462, "method": "UPI"}]}	2026-01-02 07:31:23.45
cmjwk24ge000guqv7p59uax37	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwk24f8000cuqv789ek4id7	{"saleNo": "SALE-20260102-0022", "grandTotal": 462.3000000000001}	2026-01-02 07:31:23.535
cmjwk24xk000luqv73gsu0amv	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwk24f8000cuqv789ek4id7	{"payments": [{"amount": 462, "method": "UPI"}]}	2026-01-02 07:31:24.153
cmjwkvgf10007xn4k5zguiqfj	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwkvgcw0003xn4k7jpexbq0	{"saleNo": "SALE-20260102-0023", "grandTotal": 164.8}	2026-01-02 07:54:12.062
cmjwkvh1x000exn4kgu9h1wfa	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwkvgcw0003xn4k7jpexbq0	{"payments": [{"amount": 165, "method": "CASH"}]}	2026-01-02 07:54:12.885
cmjwlyae80008ix8k52esad3g	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwlyacc0003ix8k6uq6ueqv	{"saleNo": "SALE-20260102-0024", "grandTotal": 909.6999999999999}	2026-01-02 08:24:23.841
cmjwlyax500062agp9oxvu2em	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwlyawc00012agplkub0p6c	{"saleNo": "SALE-20260102-0025", "grandTotal": 909.6999999999999}	2026-01-02 08:24:24.521
cmjwlyazt000hix8k3zmy9lem	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwlyacc0003ix8k6uq6ueqv	{"payments": [{"amount": 910, "method": "UPI"}]}	2026-01-02 08:24:24.618
cmjwlybja000qix8k110m2xt5	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwlyawc00012agplkub0p6c	{"payments": [{"amount": 910, "method": "UPI"}]}	2026-01-02 08:24:25.318
cmjwmn8gj0007bnb02pe6n5ty	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwmn8eo0003bnb0grzo3pfp	{"saleNo": "SALE-20260102-0026", "grandTotal": 123.2}	2026-01-02 08:43:47.732
cmjwmn9ci000ebnb0c6ty7v12	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwmn8eo0003bnb0grzo3pfp	{"payments": [{"amount": 123, "method": "UPI"}]}	2026-01-02 08:43:48.883
cmjwnuxqo0005bgd9z9tevt1b	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwnuxos0001bgd981rxwjhq	{"saleNo": "SALE-20260102-0027", "grandTotal": 708.4}	2026-01-02 09:17:46.704
cmjwnuych000abgd950nwh6bg	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwnuxos0001bgd981rxwjhq	{"payments": [{"amount": 708, "method": "UPI"}]}	2026-01-02 09:17:47.489
cmjwp932b00074u7erurzzxqa	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwp930l00034u7e93n1g54d	{"saleNo": "SALE-20260102-0028", "grandTotal": 638.4}	2026-01-02 09:56:46.403
cmjwp93o7000g4u7eca3ba1i8	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwp93n6000c4u7et6xuxig4	{"saleNo": "SALE-20260102-0029", "grandTotal": 638.4}	2026-01-02 09:56:47.191
cmjwp93p3000k4u7e9pp98w4o	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwp930l00034u7e93n1g54d	{"payments": [{"amount": 638, "method": "CARD"}]}	2026-01-02 09:56:47.223
cmjwp94a6000r4u7e3a3hk9kt	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwp93n6000c4u7et6xuxig4	{"payments": [{"amount": 638, "method": "CARD"}]}	2026-01-02 09:56:47.982
cmjwrqrvt0005d2o5yhm65bjd	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwrqrtl0001d2o5o4w3zdzv	{"saleNo": "SALE-20260102-0030", "grandTotal": 107.2}	2026-01-02 11:06:30.953
cmjwrqsja000ad2o5jv3lj2me	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwrqrtl0001d2o5o4w3zdzv	{"payments": [{"amount": 107, "method": "UPI"}]}	2026-01-02 11:06:31.798
cmjwu8zsm0005ijyxoylv36e1	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwu8zqt0001ijyxwwtryla7	{"saleNo": "SALE-20260102-0031", "grandTotal": 115}	2026-01-02 12:16:40.246
cmjwu909n000aijyxuq2igwtk	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwu8zqt0001ijyxwwtryla7	{"payments": [{"amount": 115, "method": "UPI"}]}	2026-01-02 12:16:40.859
cmjwukqwz0005qmchnx0urrzt	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwukqul0001qmchudmzv5hn	{"saleNo": "SALE-20260102-0032", "grandTotal": 212.4}	2026-01-02 12:25:48.611
cmjwukzxb000bqmch4d6a9ej4	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwukzvy0007qmchkmgvvchk	{"saleNo": "SALE-20260102-0033", "grandTotal": 212.4}	2026-01-02 12:26:00.287
cmjwul0fs000gqmch9woisb2g	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwukzvy0007qmchkmgvvchk	{"payments": [{"amount": 212, "method": "CARD"}]}	2026-01-02 12:26:00.953
cmjwve6zs0005ehx6rgerkcla	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwve6yn0001ehx60lgfwfy1	{"saleNo": "SALE-20260102-0034", "grandTotal": 548.58}	2026-01-02 12:48:42.472
cmjwve7lu000aehx6njj94ww9	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwve6yn0001ehx60lgfwfy1	{"payments": [{"amount": 549, "method": "CASH"}]}	2026-01-02 12:48:43.266
cmjwy56wg0005que21i5x5pal	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwy56tr0001que2vy0hoql6	{"saleNo": "SALE-20260102-0035", "grandTotal": 115}	2026-01-02 14:05:41.296
cmjwy57fx000aque2vamdivch	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwy56tr0001que2vy0hoql6	{"payments": [{"amount": 115, "method": "UPI"}]}	2026-01-02 14:05:41.998
cmjwyfdhw0005zgl0w4j6nn7m	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwyfdg70001zgl0bzz5csou	{"saleNo": "SALE-20260102-0036", "grandTotal": 713.6}	2026-01-02 14:13:36.404
cmjwyfe4f000azgl0lnjd4grt	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwyfdg70001zgl0bzz5csou	{"payments": [{"amount": 714, "method": "UPI"}]}	2026-01-02 14:13:37.216
cmjwygdny000512232r80du8n	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwygdmn00011223p5fz2ahs	{"saleNo": "SALE-20260102-0037", "grandTotal": 306.4}	2026-01-02 14:14:23.278
cmjwygf09000a1223pzwq687c	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwygdmn00011223p5fz2ahs	{"payments": [{"amount": 306, "method": "UPI"}]}	2026-01-02 14:14:25.017
cmjwygf80000g1223wu6edldc	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwygf6w000c1223jyng958z	{"saleNo": "SALE-20260102-0038", "grandTotal": 306.4}	2026-01-02 14:14:25.296
cmjwygfug000l1223gjhzwi0j	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwygf6w000c1223jyng958z	{"payments": [{"amount": 306, "method": "CASH"}]}	2026-01-02 14:14:26.105
cmjwyhjlj000511dpejy9az7r	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwyhjko000111dp1o9x8j36	{"saleNo": "SALE-20260102-0039", "grandTotal": 189}	2026-01-02 14:15:17.623
cmjwyhk5t000a11dp840pl8v2	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwyhjko000111dp1o9x8j36	{"payments": [{"amount": 189, "method": "UPI"}]}	2026-01-02 14:15:18.353
cmjwyif4i0005h8riwfbdskr5	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwyif390001h8riainec3hj	{"saleNo": "SALE-20260102-0040", "grandTotal": 335.8}	2026-01-02 14:15:58.482
cmjwyifot000ch8rimzhjf9hk	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwyifo40008h8riuqbcwbup	{"saleNo": "SALE-20260102-0041", "grandTotal": 335.8}	2026-01-02 14:15:59.214
cmjwyifpk000gh8riz2xo5r6j	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwyif390001h8riainec3hj	{"payments": [{"amount": 336, "method": "CASH"}]}	2026-01-02 14:15:59.241
cmjwyiga0000lh8ri06dbec8t	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwyifo40008h8riuqbcwbup	{"payments": [{"amount": 336, "method": "CASH"}]}	2026-01-02 14:15:59.977
cmjwyj6270009789lrzyq9m5r	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwyj60x0005789lk8qcytl5	{"saleNo": "SALE-20260102-0042", "grandTotal": 363.2}	2026-01-02 14:16:33.391
cmjwyj6ni000e789ld4ykkz3y	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwyj60x0005789lk8qcytl5	{"payments": [{"amount": 363, "method": "CASH"}]}	2026-01-02 14:16:34.158
cmjwyk3s6000gzgl0dai46wfh	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwyk3re000czgl0or6sbrxv	{"saleNo": "SALE-20260102-0043", "grandTotal": 161.6}	2026-01-02 14:17:17.094
cmjwyk4cf000lzgl02crq9kiu	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwyk3re000czgl0or6sbrxv	{"payments": [{"amount": 162, "method": "UPI"}]}	2026-01-02 14:17:17.823
cmjwyl0ir000k789l8mnh48z6	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwyl0hc000g789l0y6pbhbm	{"saleNo": "SALE-20260102-0044", "grandTotal": 232}	2026-01-02 14:17:59.522
cmjwyl159000p789ldoqdvxun	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwyl0hc000g789l0y6pbhbm	{"payments": [{"amount": 232, "method": "UPI"}]}	2026-01-02 14:18:00.333
cmjwyly660005ghnx2uay09nm	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjwyly4w0001ghnx2kjf3spu	{"saleNo": "SALE-20260102-0045", "grandTotal": 107.2}	2026-01-02 14:18:43.135
cmjwylyrl000aghnxve8g8wyh	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjwyly4w0001ghnx2kjf3spu	{"payments": [{"amount": 107, "method": "UPI"}]}	2026-01-02 14:18:43.906
cmjx40ka500017gdc7nahgs9g	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_VOIDED	Sale	cmjwk24f8000cuqv789ek4id7	{"reason": "Cancelled by owner"}	2026-01-02 16:50:03.053
cmjx40zwi00037gdcqmqd6xj5	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_VOIDED	Sale	cmjwygf6w000c1223jyng958z	{"reason": "Cancelled by owner"}	2026-01-02 16:50:23.298
cmjx41tcs00057gdc3l9ofmgs	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_VOIDED	Sale	cmjwp93n6000c4u7et6xuxig4	{"reason": "Cancelled by owner"}	2026-01-02 16:51:01.468
cmjx422nb00077gdcp2nnum19	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_VOIDED	Sale	cmjwlyawc00012agplkub0p6c	{"reason": "Cancelled by owner"}	2026-01-02 16:51:13.511
cmjxrwe4d0003dpmdly49fpkj	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxrwe3h0001dpmdx2mgz5t5	{"qtyKg": 2, "reason": "ADJUSTMENT", "productId": "cmjtfylpc000dmw9vtbj4su00", "adjustmentType": "IN"}	2026-01-03 03:58:39.23
cmjxrwxxw0007dpmd1jk6ed8h	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxrwxxg0005dpmdjga9lpdo	{"qtyKg": 4, "reason": "ADJUSTMENT", "productId": "cmjtfymb5000hmw9vlsdpz75l", "adjustmentType": "IN"}	2026-01-03 03:59:04.916
cmjxrxbrs000bdpmduh7j576f	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxrxbrd0009dpmdyur0ib1h	{"qtyKg": 4, "reason": "ADJUSTMENT", "productId": "cmjtfynix000pmw9vh4n9s2l9", "adjustmentType": "IN"}	2026-01-03 03:59:22.841
cmjxrxo6z000fdpmdzwnk7kw2	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxrxo6h000ddpmdtbhhp47s	{"qtyKg": 3, "reason": "ADJUSTMENT", "productId": "cmjtfyo4s000tmw9v1cceq7rv", "adjustmentType": "IN"}	2026-01-03 03:59:38.94
cmjxryjop000jdpmd8qkgpkdu	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxryjoa000hdpmdwdegb73r	{"qtyKg": 13.2, "reason": "ADJUSTMENT", "productId": "cmjtfyk5i0005mw9vji8icng4", "adjustmentType": "IN"}	2026-01-03 04:00:19.753
cmjxrz59u000ndpmdqy4t4btz	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxrz59d000ldpmd46n8wp41	{"qtyKg": 8.5, "reason": "ADJUSTMENT", "productId": "cmjtfyl260009mw9vktuvk4rd", "adjustmentType": "IN"}	2026-01-03 04:00:47.731
cmjxrzu30000rdpmdwe92jua7	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxrzu26000pdpmd5gzcpqdp	{"qtyKg": 54.5, "reason": "ADJUSTMENT", "productId": "cmjten9z3000iviumzzz362v3", "adjustmentType": "IN"}	2026-01-03 04:01:19.885
cmjxs12vp000vdpmdzpf72t0f	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxs12v8000tdpmdsevvy643	{"qtyKg": 1, "reason": "ADJUSTMENT", "productId": "cmjtfymx1000lmw9v6odxz662", "adjustmentType": "IN"}	2026-01-03 04:02:17.942
cmjxs1ylb000zdpmdz7hapvn8	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxs1yks000xdpmd3pz6nx7j	{"qtyKg": 2, "reason": "ADJUSTMENT", "productId": "cmjtfynix000pmw9vh4n9s2l9", "adjustmentType": "IN"}	2026-01-03 04:02:59.039
cmjxs3v180003nmqmd3v9d6hf	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxs3v0r0001nmqmz6lm2935	{"qtyKg": 1, "reason": "ADJUSTMENT", "productId": "cmjtfymx1000lmw9v6odxz662", "adjustmentType": "IN"}	2026-01-03 04:04:27.74
cmjxs49de0007nmqm8lwn7pqd	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxs49cx0005nmqmrrmxutjw	{"qtyKg": 2, "reason": "ADJUSTMENT", "productId": "cmjtfymx1000lmw9v6odxz662", "adjustmentType": "IN"}	2026-01-03 04:04:46.322
cmjxs53vh000bnmqmhqxg8vdn	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxs53uz0009nmqm3g7w9wg7	{"qtyKg": 1, "reason": "ADJUSTMENT", "productId": "cmjtfymx1000lmw9v6odxz662", "adjustmentType": "IN"}	2026-01-03 04:05:25.854
cmjxsf7fy0003tt7khizimg5f	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	DAILY_CLOSING_CREATED	DailyClosing	cmjxsf7ea0001tt7k3y0mut5b	{"totalSales": 0, "closingDate": "2026-01-03T00:00:00.000Z", "totalRevenue": 0, "cashDifference": -1330}	2026-01-03 04:13:17.038
cmjxwtkmc0005106o7qu9hq1m	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjxwtkkl0001106oy4khruja	{"saleNo": "SALE-20260103-0010", "grandTotal": 257.6}	2026-01-03 06:16:25.765
cmjxsnk560003o9ptm408f611	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	DAILY_CLOSING_CREATED	DailyClosing	cmjxsf7ea0001tt7k3y0mut5b	{"totalSales": 0, "closingDate": "2026-01-03T00:00:00.000Z", "totalRevenue": 0, "cashDifference": -1330}	2026-01-03 04:19:46.746
cmjxtpsvl0007975l9583krjq	cmjten7ko0002viumzdic2lbf	cmjten8jh0006vium78ek3p0s	INVENTORY_ADJUSTED	InventoryLedger	cmjxtpsuy0005975l7g6tlfy3	{"qtyKg": 54.5, "reason": "RECEIVE", "productId": "cmjten9z3000iviumzzz362v3", "adjustmentType": "IN"}	2026-01-03 04:49:30.993
cmjxtx4mt00039ucmwt6c9dw9	cmjten7ko0002viumzdic2lbf	cmjten8jh0006vium78ek3p0s	INVENTORY_ADJUSTED	InventoryLedger	cmjxtx4lo00019ucm7dbjlun6	{"qtyKg": 54.5, "reason": "RECEIVE", "productId": "cmjten9z3000iviumzzz362v3", "adjustmentType": "IN"}	2026-01-03 04:55:12.821
cmjxtyxtw0003tlq431d9yaqj	cmjten7ko0002viumzdic2lbf	cmjten8jh0006vium78ek3p0s	INVENTORY_ADJUSTED	InventoryLedger	cmjxtyxt20001tlq4ejtixa6v	{"qtyKg": 54.5, "reason": "ADJUSTMENT", "productId": "cmjten9z3000iviumzzz362v3", "adjustmentType": "IN"}	2026-01-03 04:56:37.316
cmjxubbdg0003y0aczzfrmi2a	cmjten7ko0002viumzdic2lbf	cmjten8jh0006vium78ek3p0s	INVENTORY_ADJUSTED	InventoryLedger	cmjxubbbw0001y0acxq2q3zta	{"qtyKg": 54.5, "reason": "RECEIVE", "productId": "cmjten9z3000iviumzzz362v3", "adjustmentType": "IN"}	2026-01-03 05:06:14.74
cmjxud5zi0003e7887a03jma3	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxud5yy0001e7886w3383hk	{"qtyKg": 54.5, "reason": "RECEIVE", "productId": "cmjten9z3000iviumzzz362v3", "adjustmentType": "IN"}	2026-01-03 05:07:41.07
cmjxum9cr0009y0acrpwpyze1	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxum9cb0007y0ac3che9nmi	{"qtyKg": 13.2, "reason": "RECEIVE", "productId": "cmjtfyk5i0005mw9vji8icng4", "adjustmentType": "IN"}	2026-01-03 05:14:45.339
cmjxum9kr000dy0ac7r4e555q	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxum9ke000by0acoj7aa5dv	{"qtyKg": 2, "reason": "RECEIVE", "productId": "cmjtfylpc000dmw9vtbj4su00", "adjustmentType": "IN"}	2026-01-03 05:14:45.627
cmjxum9sr000hy0ac6wammd7x	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxum9se000fy0aceg862oa4	{"qtyKg": 8.5, "reason": "RECEIVE", "productId": "cmjtfyl260009mw9vktuvk4rd", "adjustmentType": "IN"}	2026-01-03 05:14:45.915
cmjxuma0k000ly0ac5o7h3faj	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxuma06000jy0ac35mocldb	{"qtyKg": 2, "reason": "RECEIVE", "productId": "cmjtfymx1000lmw9v6odxz662", "adjustmentType": "IN"}	2026-01-03 05:14:46.196
cmjxuma9t000py0ac3c65ht7o	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxuma9g000ny0ac1urtqgu6	{"qtyKg": 4, "reason": "RECEIVE", "productId": "cmjtfymb5000hmw9vlsdpz75l", "adjustmentType": "IN"}	2026-01-03 05:14:46.529
cmjxumahl000ty0aclmn99gxw	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxumah8000ry0act1ri9m8j	{"qtyKg": 3, "reason": "RECEIVE", "productId": "cmjtfyo4s000tmw9v1cceq7rv", "adjustmentType": "IN"}	2026-01-03 05:14:46.81
cmjxumap1000xy0ac7efbxp2r	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxumaoo000vy0ac4j6fedfo	{"qtyKg": 4, "reason": "RECEIVE", "productId": "cmjtfynix000pmw9vh4n9s2l9", "adjustmentType": "IN"}	2026-01-03 05:14:47.077
cmjxunzc60005x98qdfokb5rv	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjxunzb40001x98qkttcxnn5	{"saleNo": "SALE-20260103-0001", "grandTotal": 488}	2026-01-03 05:16:05.67
cmjxunzws000ax98qskfocijb	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjxunzb40001x98qkttcxnn5	{"payments": [{"amount": 488, "method": "CASH"}]}	2026-01-03 05:16:06.413
cmjxuo06l000gx98q81to53h1	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjxuo05r000cx98qaww0nb4i	{"saleNo": "SALE-20260103-0002", "grandTotal": 488}	2026-01-03 05:16:06.765
cmjxuo0pa000lx98qdl4faxon	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjxuo05r000cx98qaww0nb4i	{"payments": [{"amount": 488, "method": "CASH"}]}	2026-01-03 05:16:07.438
cmjxuomtf0005e788eh8g6g23	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_VOIDED	Sale	cmjxuo05r000cx98qaww0nb4i	{"reason": "Cancelled by owner"}	2026-01-03 05:16:36.099
cmjxuptz90007pyan59pgnvn3	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjxuptxv0003pyan5k3mdpvs	{"saleNo": "SALE-20260103-0003", "grandTotal": 227.7}	2026-01-03 05:17:32.038
cmjxupum5000epyanqo1t7lge	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjxuptxv0003pyan5k3mdpvs	{"payments": [{"amount": 228, "method": "UPI"}]}	2026-01-03 05:17:32.862
cmjxuqprf0005n7sigzbenfkh	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjxuqpqd0001n7sibs1zligj	{"saleNo": "SALE-20260103-0004", "grandTotal": 232.3}	2026-01-03 05:18:13.227
cmjxuqqcf000an7si35g665po	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjxuqpqd0001n7sibs1zligj	{"payments": [{"amount": 232, "method": "UPI"}]}	2026-01-03 05:18:13.983
cmjxv3apu00076gz517s1smve	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjxv3anu00036gz5itmjtlg8	{"saleNo": "SALE-20260103-0005", "grandTotal": 181.8}	2026-01-03 05:28:00.259
cmjxv3bdl000e6gz5xn8inp8y	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjxv3anu00036gz5itmjtlg8	{"payments": [{"amount": 182, "method": "UPI"}]}	2026-01-03 05:28:01.113
cmjxwaorp0007lloec45cr321	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjxwaopx0003lloenhz1f7mx	{"saleNo": "SALE-20260103-0006", "grandTotal": 268.2}	2026-01-03 06:01:44.677
cmjxwapcw000elloeaypml6i8	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjxwaopx0003lloenhz1f7mx	{"payments": [{"amount": 268, "method": "CASH"}]}	2026-01-03 06:01:45.44
cmjxwd1y90005315n22jsgb9f	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjxwd1ww0001315ne4ephaip	{"saleNo": "SALE-20260103-0007", "grandTotal": 190.9}	2026-01-03 06:03:35.073
cmjxwd2ig000a315nzsmyjgoj	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjxwd1ww0001315ne4ephaip	{"payments": [{"amount": 191, "method": "CASH"}]}	2026-01-03 06:03:35.801
cmjxwh63s000791pwav7mvkxh	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjxwh62b000391pws06r9y46	{"saleNo": "SALE-20260103-0008", "grandTotal": 232}	2026-01-03 06:06:47.081
cmjxwh6p5000e91pwjc7jq4qu	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjxwh62b000391pws06r9y46	{"payments": [{"amount": 232, "method": "CASH"}]}	2026-01-03 06:06:47.849
cmjxwj37y000m91pwx2tag3fo	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjxwj36i000i91pwdf92tmcb	{"saleNo": "SALE-20260103-0009", "grandTotal": 195.2}	2026-01-03 06:08:16.654
cmjxwj3ua000t91pwuv7ojnky	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjxwj36i000i91pwdf92tmcb	{"payments": [{"amount": 195, "method": "UPI"}]}	2026-01-03 06:08:17.459
cmjxwtlb2000653b0qejlzmes	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjxwtkkl0001106oy4khruja	{"payments": [{"amount": 258, "method": "UPI"}]}	2026-01-03 06:16:26.654
cmjxwyp15000c53b0ziehkf98	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjxwyozz000853b04sal1ua9	{"saleNo": "SALE-20260103-0011", "grandTotal": 211.2}	2026-01-03 06:20:24.761
cmjxwypn0000h53b0qy8cvcy8	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjxwyozz000853b04sal1ua9	{"payments": [{"amount": 211, "method": "UPI"}]}	2026-01-03 06:20:25.548
cmjxx6gtl0005xek6l6atx59a	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjxx6grt0001xek6j1wcp9uh	{"saleNo": "SALE-20260103-0012", "grandTotal": 180}	2026-01-03 06:26:27.369
cmjxx6p3p000bxek6zcl3augy	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjxx6p2g0007xek6yxbb8fr8	{"saleNo": "SALE-20260103-0013", "grandTotal": 180}	2026-01-03 06:26:38.102
cmjxx6po3000gxek6ruz6y6eg	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjxx6p2g0007xek6yxbb8fr8	{"payments": [{"amount": 180, "method": "CARD"}]}	2026-01-03 06:26:38.836
cmjxxj2260008oqvx2umxkf9s	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	DISCOUNT_OVERRIDE_REQUESTED	Sale	cmjxxj1z90001oqvxouy9fk30	{"saleNo": "SALE-20260103-0014", "discountPercent": 15.0, "originalDiscount": 0, "overrideDiscount": 587.73, "allowedDiscountPercent": 10}	2026-01-03 06:36:14.766
cmjxxszm500015nekjdmcgb83	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	DISCOUNT_OVERRIDE_APPROVED	Sale	cmjxxj1z90001oqvxouy9fk30	{"reason": "Discount of 15.00% exceeds allowed limit of 10%", "overrideId": "cmjxxj20v0006oqvx7phvi0xg", "originalDiscount": 0, "overrideDiscount": 587.73}	2026-01-03 06:43:58.157
cmjxxv8l5000314mawk2p6ok9	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_UPDATED	Sale	cmjxxj1z90001oqvxouy9fk30	{"saleNo": "SALE-20260103-0014", "grandTotal": 3330.47}	2026-01-03 06:45:43.097
cmjxxyfgr0007y10jm3wxiwzh	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjxxyff40003y10j5d0h79wy	{"saleNo": "SALE-20260103-0015", "grandTotal": 214.4}	2026-01-03 06:48:11.978
cmjxxyg32000cy10j8e91jnop	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjxxyff40003y10j5d0h79wy	{"payments": [{"amount": 214, "method": "CASH"}]}	2026-01-03 06:48:12.783
cmjxy54h60003oknonbwbtlrw	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxy54gn0001oknogzy0e6c3	{"qtyPcs": 3, "reason": "CORRECTION", "productId": "cmjtfyo4s000tmw9v1cceq7rv", "adjustmentType": "IN"}	2026-01-03 06:53:24.331
cmjxy5h9h0003qftpklytpbfb	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	INVENTORY_ADJUSTED	InventoryLedger	cmjxy5h950001qftp88hs8evf	{"qtyPcs": 2, "reason": "CORRECTION", "productId": "cmjtfyo4s000tmw9v1cceq7rv", "adjustmentType": "IN"}	2026-01-03 06:53:40.901
cmjxy5jns0009qftpiy2rcz06	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjxy5jmo0005qftpuxrs6nkd	{"saleNo": "SALE-20260103-0016", "grandTotal": 96.6}	2026-01-03 06:53:44.008
cmjxy5k8i000gqftp5v7b5pdy	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjxy5jmo0005qftpuxrs6nkd	{"payments": [{"amount": 97, "method": "UPI"}]}	2026-01-03 06:53:44.755
cmjxy69nt000lqftp3imzkuwk	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjxx6grt0001xek6j1wcp9uh	{"payments": [{"amount": 180, "method": "CASH"}]}	2026-01-03 06:54:17.705
cmjxy6m53000nqftpbg8ozj8p	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_VOIDED	Sale	cmjxx6grt0001xek6j1wcp9uh	{"reason": "Cancelled by owner"}	2026-01-03 06:54:33.88
cmjxy6qih000uqftp9g3xbc2i	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjxxj1z90001oqvxouy9fk30	{"payments": [{"amount": 3330, "method": "CASH"}]}	2026-01-03 06:54:39.545
cmjy1ihrf0007em7gg9oa0h83	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjy1ihp60001em7gt7gq2xt1	{"saleNo": "SALE-20260103-0017", "grandTotal": 90}	2026-01-03 08:27:46.923
cmjy1ijl4000jem7gfaakk7pi	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjy1ijjb000aem7g6xkty3tk	{"saleNo": "SALE-20260103-0018", "grandTotal": 681.44}	2026-01-03 08:27:49.289
cmjy1ik2j000mem7gyjdd3z0x	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjy1ijjb000aem7g6xkty3tk	{"payments": [{"amount": 681, "method": "UPI"}]}	2026-01-03 08:27:49.916
cmjy1klq9000xem7g655q5rlm	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjy1klo7000oem7gb41bco4c	{"saleNo": "SALE-20260103-0019", "grandTotal": 332.16}	2026-01-03 08:29:25.377
cmjy1kmv90010em7gr5srbdpw	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjy1klo7000oem7gb41bco4c	{"payments": [{"amount": 332, "method": "UPI"}]}	2026-01-03 08:29:26.853
cmjy1mtsc0007126ffmjo22rw	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjy1mtqj0001126fd3gpnlht	{"saleNo": "SALE-20260103-0020", "grandTotal": 200.96}	2026-01-03 08:31:09.132
cmjy1mubw000a126fll19lmul	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjy1mtqj0001126fd3gpnlht	{"payments": [{"amount": 201, "method": "CASH"}]}	2026-01-03 08:31:09.836
cmjy20zxv0007s9jxhh9krqxl	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjy20zvk0001s9jx11ht8tlc	{"saleNo": "SALE-20260103-0021", "grandTotal": 90}	2026-01-03 08:42:10.292
cmjy210fk000as9jxf4l7w8pb	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjy20zvk0001s9jx11ht8tlc	{"payments": [{"amount": 90, "method": "CASH"}]}	2026-01-03 08:42:10.928
cmjy21nkn0001a78onatim654	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_VOIDED	Sale	cmjy20zvk0001s9jx11ht8tlc	{"reason": "test data \\n"}	2026-01-03 08:42:40.919
cmjy78ot60007n4ulri4j5kqc	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjy78osu0001n4uldievaw5q	{"saleNo": "SALE-20260103-0022", "grandTotal": 460}	2026-01-03 11:08:07.194
cmjy78otr000an4ulqmsatv0o	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjy78osu0001n4uldievaw5q	{"payments": [{"amount": 460, "method": "CREDIT"}]}	2026-01-03 11:08:07.216
cmjy7erux0007lfgflv9hhlc8	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjy7erum0001lfgf23vt4oca	{"saleNo": "SALE-20260103-0023", "grandTotal": 90}	2026-01-03 11:12:51.081
cmjy7ervp000clfgft4wm1f0f	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjy7erum0001lfgf23vt4oca	{"payments": [{"amount": 90, "method": "CREDIT"}]}	2026-01-03 11:12:51.109
cmjy7ikg30002mfalhzu1ajql	cmjten76p0000viumjxwes8nz	cmpg_dump: processing data for table "public.Category"
pg_dump: dumping contents of table "public.Category"
pg_dump: processing data for table "public.CentralPOItem"
pg_dump: dumping contents of table "public.CentralPOItem"
pg_dump: processing data for table "public.CentralPurchaseOrder"
pg_dump: dumping contents of table "public.CentralPurchaseOrder"
pg_dump: processing data for table "public.ComplianceChecklistTemplate"
jten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjy1ihp60001em7gt7gq2xt1	{"payments": [{"amount": 90, "method": "CASH"}]}	2026-01-03 11:15:48.099
cmjy7lvgt0007tzayl6fofegv	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmjy7lvgm0001tzayedhhot63	{"saleNo": "SALE-20260103-0024", "grandTotal": 200}	2026-01-03 11:18:22.35
cmjy7lx2p000atzayty1u517r	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmjy7lvgm0001tzayedhhot63	{"payments": [{"amount": 200, "method": "CREDIT"}]}	2026-01-03 11:18:24.434
cmk0zd2870007mjott3kpuafj	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_CREATED	Sale	cmk0zd27r0001mjoteb2t5b9r	{"saleNo": "SALE-20260105-0001", "grandTotal": 160}	2026-01-05 09:50:52.808
cmk0zd298000amjott5pj33h0	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	SALE_PAID	Sale	cmk0zd27r0001mjoteb2t5b9r	{"payments": [{"amount": 160, "method": "CASH"}]}	2026-01-05 09:50:52.844
cmk0zp4dw000d13mqq9ncq48z	cmjten7ko0002viumzdic2lbf	cmjten8jh0006vium78ek3p0s	INVENTORY_ADJUSTED	InventoryLedger	cmk0zp4du000b13mqecmr1nok	{"qtyKg": 10, "reason": "RECEIVE", "productId": "cmjten9z3000iviumzzz362v3", "adjustmentType": "IN"}	2026-01-05 10:00:15.476
cmk100ou80003nl1wpxwk2p0q	cmjten7ko0002viumzdic2lbf	cmjten8jh0006vium78ek3p0s	INVENTORY_ADJUSTED	InventoryLedger	cmk100ou00001nl1wqvw6cta9	{"qtyKg": 10, "reason": "RECEIVE", "productId": "cmjten9z3000iviumzzz362v3", "adjustmentType": "IN"}	2026-01-05 10:09:15.2
cmk16g1eo000bnl1wzg95ktvy	cmjten7ko0002viumzdic2lbf	cmjten8jh0006vium78ek3p0s	SALE_CREATED	Sale	cmk16g1eg0005nl1w1keh82lw	{"saleNo": "SALE-20260105-0001", "grandTotal": 90}	2026-01-05 13:09:09.025
cmk16g1fi000gnl1wmwq4ywvr	cmjten7ko0002viumzdic2lbf	cmjten8jh0006vium78ek3p0s	SALE_PAID	Sale	cmk16g1eg0005nl1w1keh82lw	{"payments": [{"amount": 90, "method": "CASH"}]}	2026-01-05 13:09:09.054
cmk16ggl5000onl1wimd9dapq	cmjten7ko0002viumzdic2lbf	cmjten8jh0006vium78ek3p0s	SALE_CREATED	Sale	cmk16ggl1000inl1wzh22gjtb	{"saleNo": "SALE-20260105-0002", "grandTotal": 920}	2026-01-05 13:09:28.698
cmk16gglo000tnl1w00vv2qx7	cmjten7ko0002viumzdic2lbf	cmjten8jh0006vium78ek3p0s	SALE_PAID	Sale	cmk16ggl1000inl1wzh22gjtb	{"payments": [{"amount": 920, "method": "CREDIT"}]}	2026-01-05 13:09:28.717
cmk16gtfm0011nl1wxa2eyij0	cmjten7ko0002viumzdic2lbf	cmjten8jh0006vium78ek3p0s	SALE_CREATED	Sale	cmk16gtfd000vnl1wkb7p37fu	{"saleNo": "SALE-20260105-0003", "grandTotal": 800}	2026-01-05 13:09:45.346
cmk16gtg60016nl1wvb5aimtc	cmjten7ko0002viumzdic2lbf	cmjten8jh0006vium78ek3p0s	SALE_PAID	Sale	cmk16gtfd000vnl1wkb7p37fu	{"payments": [{"amount": 800, "method": "CREDIT"}]}	2026-01-05 13:09:45.366
\.


--
-- TOC entry 4528 (class 0 OID 26526)
-- Dependencies: 225
-- Data for Name: Category; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Category" (id, "ownerStoreId", name, "sortOrder", "createdAt", "updatedAt") FROM stdin;
cmjten94g000cviumsxbagugw	cmjten76p0000viumjxwes8nz	Raw Chicken	1	2025-12-31 02:36:33.136	2025-12-31 02:36:33.136
cmjten9jn000eviumu7313diu	cmjten76p0000viumjxwes8nz	Cuts	2	2025-12-31 02:36:33.683	2025-12-31 02:36:33.683
cmjten9s5000gviumjl8n6wo2	cmjten76p0000viumjxwes8nz	Add-ons	3	2025-12-31 02:36:33.99	2025-12-31 02:36:33.99
cmjtfyhgj0001mw9vl5bpcr8c	cmjten76p0000viumjxwes8nz	Chicken Cuts	1	2025-12-31 03:13:16.769	2025-12-31 03:13:16.769
\.


--
-- TOC entry 4552 (class 0 OID 28743)
-- Dependencies: 249
-- Data for Name: CentralPOItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CentralPOItem" (id, "centralPOId", "productId", "qtyKg", "qtyPcs", "unitRate", "totalAmount", "createdAt") FROM stdin;
\.


--
-- TOC entry 4551 (class 0 OID 28723)
-- Dependencies: 248
-- Data for Name: CentralPurchaseOrder; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CentralPurchaseOrder" (id, "ownerStoreId", "supplierId", "poNo", "orderDate", "expectedDate", status, "totalAmount", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 4557 (class 0 OID 28843)
-- Dependencies: 254
-- Data for Name: ComplianceChecklistTemplate; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Complpg_dump: dumping contents of table "public.ComplianceChecklistTemplate"
pg_dump: processing data for table "public.ComplianceRecord"
pg_dump: dumping contents of table "public.ComplianceRecord"
pg_dump: processing data for table "public.Customer"
pg_dump: dumping contents of table "public.Customer"
ianceChecklistTemplate" (id, "ownerStoreId", name, "checkType", items, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 4558 (class 0 OID 28860)
-- Dependencies: 255
-- Data for Name: ComplianceRecord; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ComplianceRecord" (id, "franchiseConfigId", "templateId", "checkType", status, "checkedBy", "checkedAt", temperature, "photoUrl", "documentUrl", "expiryDate", notes, score, "submissionData", "reviewedBy", "reviewedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 4525 (class 0 OID 26474)
-- Dependencies: 222
-- Data for Name: Customer; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Customer" (id, "storeId", name, phone, email, "createdAt", "updatedAt", "loyaltyPoints", "loyaltyTier", "totalSpent") FROM stdin;
cmjtenfo6001uviumez68z4tb	cmjten7ko0002viumzdic2lbf	John Doe	5555555555	john@example.com	2025-12-31 02:36:41.622	2025-12-31 02:36:41.622	0	BRONZE	0
cmjuvapgu0001s5oc8a24dex1	cmjten76p0000viumjxwes8nz	Nilesh Patil	9022938302	\N	2026-01-01 03:10:27.438	2026-01-01 03:10:27.438	0	BRONZE	0
cmjxwairm0001lloe4v7hcig7	cmjten76p0000viumjxwes8nz	nitin	7447440889	\N	2026-01-03 06:01:36.897	2026-01-03 06:01:45.406	26	BRONZE	268.2
cmjxwh1r1000191pwxxom2ocw	cmjten76p0000viumjxwes8nz	sathe	9665985525	\N	2026-01-03 06:06:41.437	2026-01-03 06:06:47.814	23	BRONZE	232
cmjuwz828000112jwsmd9d6uf	cmjten76p0000viumjxwes8nz	Nirmala Patil	9730583796	\N	2026-01-01 03:57:30.895	2026-01-01 03:58:15.425	0	BRONZE	0
cmjv0ie0b0001bkdl3cb9k8f5	cmjten76p0000viumjxwes8nz	deepak	9689388206	\N	2026-01-01 05:36:23.914	2026-01-01 05:37:13.304	35	BRONZE	350.4
cmjwe1cfc0001v5henesbzwim	cmjten76p0000viumjxwes8nz	shital	9975533405	\N	2026-01-02 04:42:49.49	2026-01-02 04:43:04.427	23	BRONZE	235.2
cmjwefyhk0001vkn6wqwasgt5	cmjten76p0000viumjxwes8nz	yogita madane	7709864143	\N	2026-01-02 04:54:11.287	2026-01-02 04:54:24.727	34	BRONZE	348.8
cmjxwikld000g91pw3vgo6y14	cmjten76p0000viumjxwes8nz	vitthal	8625074612	\N	2026-01-03 06:07:52.513	2026-01-03 06:10:58.394	19	BRONZE	195.2
cmjweoj1h00016ho9oa5hvmkr	cmjten76p0000viumjxwes8nz	sakore	9518955088	\N	2026-01-02 05:00:51.172	2026-01-02 05:00:58.585	20	BRONZE	209.3
cmjwe3n52000110r14w1vn32c	cmjten76p0000viumjxwes8nz	maruti kavade	9552595985	\N	2026-01-02 04:44:36.71	2026-01-02 05:03:52.015	15	BRONZE	153.6
cmjwduttr000cwc8n3tyldczh	cmjten76p0000viumjxwes8nz	shilapa borade	8381043999	\N	2026-01-02 04:37:45.471	2026-01-02 05:04:49.349	12	BRONZE	122.4
cmjwgfv9v00015t5z5erb6xs8	cmjten76p0000viumjxwes8nz	vivevk nangude	9822753911	\N	2026-01-02 05:50:06.355	2026-01-02 05:50:27.479	52	BRONZE	522.4
cmjwgr8hk0001g4lrf5p9jhv3	cmjten76p0000viumjxwes8nz	bss	9623878444	\N	2026-01-02 05:58:56.695	2026-01-02 05:59:23.738	30	BRONZE	305.6
cmjwhi5rb000c8o18thh50pz7	cmjten76p0000viumjxwes8nz	hotle jagdamb	7507171819	\N	2026-01-02 06:19:52.871	2026-01-02 07:05:47.756	46	BRONZE	464.6
cmjwk1f7i0001132n8b4g6ryb	cmjten76p0000viumjxwes8nz	d	9552451808	\N	2026-01-02 07:30:50.813	2026-01-02 07:30:50.813	0	BRONZE	0
cmjwkv0us0001xn4kt4ys35nn	cmjten76p0000viumjxwes8nz	rhon	8999530531	\N	2026-01-02 07:53:51.891	2026-01-02 07:54:12.84	16	BRONZE	164.8
cmjwlxfnm0001ix8k6367e3p8	cmjten76p0000viumjxwes8nz	m	9657800303	\N	2026-01-02 08:23:44.001	2026-01-02 08:24:25.292	180	BRONZE	1819.4
cmjwmmfmq0001bnb07gr6b2d8	cmjten76p0000viumjxwes8nz	bh	8237960490	\N	2026-01-02 08:43:10.369	2026-01-02 08:43:48.844	12	BRONZE	123.2
cmjxwqpcf0001126mg2m4c2fj	cmjten76p0000viumjxwes8nz	atul kad	8149471510	\N	2026-01-03 06:14:11.918	2026-01-03 06:16:50.82	25	BRONZE	257.6
cmjwp8byu00014u7evwflgyd5	cmjten76p0000viumjxwes8nz	raj yab	70579790468	\N	2026-01-02 09:56:11.286	2026-01-02 09:56:47.952	126	BRONZE	1276.8
cmjxupmr70001pyanch0xlbtj	cmjten76p0000viumjxwes8nz	manog mirpagar	9552523030	\N	2026-01-03 05:17:22.674	2026-01-03 05:17:32.827	22	BRONZE	227.7
cmjxv33qd00016gz5w0s3rv77	cmjten76p0000viumjxwes8nz	vikram naik	9168033366	\N	2026-01-03 05:27:51.204	2026-01-03 05:28:01.07	18	BRONZE	181.8
cmjxx45rg0001z6fsd0dpb0u9	cmjten76p0000viumjxwes8nz	aarthi sanjay res	894068995pg_dump: processing data for table "public.CustomerAddress"
pg_dump: dumping contents of table "public.CustomerAddress"
pg_dump: processing data for table "public.DailyClosing"
pg_dump: dumping contents of table "public.DailyClosing"
pg_dump: processing data for table "public.DeliveryEvent"
pg_dump: dumping contents of table "public.DeliveryEvent"
pg_dump: processing data for table "public.DeliveryOrder"
pg_dump: dumping contents of table "public.DeliveryOrder"
pg_dump: processing data for table "public.DiscountOverride"
pg_dump: dumping contents of table "public.DiscountOverride"
pg_dump: processing data for table "public.Dispatch"
pg_dump: dumping contents of table "public.Dispatch"
pg_dump: processing data for table "public.DispatchItem"
6	\N	2026-01-03 06:24:39.723	2026-01-03 06:25:05.745	0	BRONZE	0
cmjxy57pz0005oknom0z91dra	cmjten76p0000viumjxwes8nz	ameya	9762861972	\N	2026-01-03 06:53:28.535	2026-01-03 06:53:44.722	9	BRONZE	96.6
cmjuw914m0001oqc3o2xh0386	cmjten76p0000viumjxwes8nz	S	7028556887	\N	2026-01-01 03:37:08.853	2026-01-05 13:09:45.364	190	BRONZE	1900
\.


--
-- TOC entry 4526 (class 0 OID 26488)
-- Dependencies: 223
-- Data for Name: CustomerAddress; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CustomerAddress" (id, "customerId", label, line1, line2, city, state, zip, "geoLat", "geoLng", "createdAt", "updatedAt") FROM stdin;
cmjteng23001wviumlhasklfq	cmjtenfo6001uviumez68z4tb	Home	123 Main St	Apt 4B	Mumbai	Maharashtra	400001	\N	\N	2025-12-31 02:36:42.124	2025-12-31 02:36:42.124
\.


--
-- TOC entry 4565 (class 0 OID 29028)
-- Dependencies: 262
-- Data for Name: DailyClosing; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DailyClosing" (id, "storeId", "shiftId", "closingDate", "closedBy", "openingCash", "cashSales", "cardSales", "upiSales", "cashReceived", "cashExpected", "cashDifference", "closingCash", "totalWeightSoldKg", "totalWastageKg", "closingStockJson", "totalSales", "totalRevenue", "totalDiscounts", "totalTax", notes, "isFinalized", "finalizedAt", "createdAt", "updatedAt") FROM stdin;
cmjxsf7ea0001tt7k3y0mut5b	cmjten76p0000viumjxwes8nz	\N	2026-01-03 00:00:00	cmjten85j0004viumsifvy7nr	1330	0	0	0	0	1330	-1330	0	0	0	{"cmjten9z3000iviumzzz362v3": {"qtyKg": 0, "qtyPcs": 0}, "cmjtfyk5i0005mw9vji8icng4": {"qtyKg": 0, "qtyPcs": 0}, "cmjtfyl260009mw9vktuvk4rd": {"qtyKg": 0, "qtyPcs": 0}, "cmjtfylpc000dmw9vtbj4su00": {"qtyKg": 0, "qtyPcs": 0}, "cmjtfymb5000hmw9vlsdpz75l": {"qtyKg": 0, "qtyPcs": 0}, "cmjtfymx1000lmw9v6odxz662": {"qtyKg": 0, "qtyPcs": 0}, "cmjtfynix000pmw9vh4n9s2l9": {"qtyKg": 0, "qtyPcs": 0}, "cmjtfyo4s000tmw9v1cceq7rv": {"qtyKg": 0, "qtyPcs": 0}, "cmjtfyoqo000xmw9vj7evt5dp": {"qtyKg": 0, "qtyPcs": 0}}	0	0	0	0	\N	f	\N	2026-01-03 04:13:16.978	2026-01-03 04:19:46.705
\.


--
-- TOC entry 4542 (class 0 OID 26759)
-- Dependencies: 239
-- Data for Name: DeliveryEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DeliveryEvent" (id, "deliveryOrderId", status, note, "createdBy", "createdAt") FROM stdin;
\.


--
-- TOC entry 4541 (class 0 OID 26741)
-- Dependencies: 238
-- Data for Name: DeliveryOrder; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DeliveryOrder" (id, "storeId", "saleId", type, status, "assignedDriverId", "deliveryFee", "addressId", "otpCodeHash", "outForDeliveryAt", "deliveredAt", "failureReason", "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 4564 (class 0 OID 29009)
-- Dependencies: 261
-- Data for Name: DiscountOverride; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DiscountOverride" (id, "saleId", "storeId", "requestedBy", "approvedBy", "originalDiscount", "overrideDiscount", reason, status, "approvedAt", "createdAt", "updatedAt") FROM stdin;
cmjxxj20v0006oqvx7phvi0xg	cmjxxj1z90001oqvxouy9fk30	cmjten76p0000viumjxwes8nz	cmjten85j0004viumsifvy7nr	cmjten85j0004viumsifvy7nr	0	587.73	Discount of 15.00% exceeds allowed limit of 10%	APPROVED	2026-01-03 06:43:58.108	2026-01-03 06:36:14.719	2026-01-03 06:43:58.109
\.


--
-- TOC entry 4538 (class 0 OID 26697)
-- Dependencies: 235
-- Data for Name: Dispatch; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Dispatch" (id, "poId", "dispatchNo", status, "createdAt", "updatedAt") FROM stdin;
cmjxsw2gq000ffhcuamh2nc4n	cmjxsbsde00013q1jgtgc9300	DISP-20260103-0001	CREATED	2026-01-03 04:26:23.738	2026-01-03 04:26:23.738
cmk0zfmy7000umjot27tp7kxv	cmk0zexhr000qmjotd5yqw93q	DISP-20260105-0001	CREATED	2026-01-05 09:52:52.976	2026-01-05 09:52:52.976
cmk0zo2wo000513mqcgepz3ty	cmk0zndt3000113mqsy6o95pj	DISP-20260105-0002	CREATED	2026-01-05 09:59:26.904	2026-01-05 09:59:26.904
\.


--
-- TOC entry 4539 (class 0 OID 26712)
-- Dependencies: 236
-- Data for Name: DispatchItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DispatchItem" (id, "dispatchId", "productId", "qtyKg", "qtyPcs", "cpg_dump: dumping contents of table "public.DispatchItem"
pg_dump: processing data for table "public.FranchiseConfig"
pg_dump: dumping contents of table "public.FranchiseConfig"
pg_dump: processing data for table "public.FranchiseHealthScore"
pg_dump: dumping contents of table "public.FranchiseHealthScore"
pg_dump: processing data for table "public.GRN"
pg_dump: dumping contents of table "public.GRN"
pg_dump: processing data for table "public.HQAlert"
pg_dump: dumping contents of table "public.HQAlert"
pg_dump: processing data for table "public.InventoryLedger"
pg_dump: dumping contents of table "public.InventoryLedger"
reatedAt") FROM stdin;
cmjxsw2gq000hfhcunw05kcm4	cmjxsw2gq000ffhcuamh2nc4n	cmjten9z3000iviumzzz362v3	54.5	\N	2026-01-03 04:26:23.738
cmjxsw2gq000ifhcukhkbakqd	cmjxsw2gq000ffhcuamh2nc4n	cmjtfyk5i0005mw9vji8icng4	13.2	\N	2026-01-03 04:26:23.738
cmjxsw2gq000jfhcuw18qqi49	cmjxsw2gq000ffhcuamh2nc4n	cmjtfylpc000dmw9vtbj4su00	2	\N	2026-01-03 04:26:23.738
cmjxsw2gq000kfhcuvjs1796t	cmjxsw2gq000ffhcuamh2nc4n	cmjtfyl260009mw9vktuvk4rd	8.5	\N	2026-01-03 04:26:23.738
cmjxsw2gq000lfhcud47jduw5	cmjxsw2gq000ffhcuamh2nc4n	cmjtfymx1000lmw9v6odxz662	2	\N	2026-01-03 04:26:23.738
cmjxsw2gq000mfhcu2txi153g	cmjxsw2gq000ffhcuamh2nc4n	cmjtfymb5000hmw9vlsdpz75l	4.3	\N	2026-01-03 04:26:23.738
cmjxsw2gq000nfhcubxhhh42d	cmjxsw2gq000ffhcuamh2nc4n	cmjtfynix000pmw9vh4n9s2l9	4	\N	2026-01-03 04:26:23.738
cmk0zfmy7000wmjotshvlt4w5	cmk0zfmy7000umjot27tp7kxv	cmjten9z3000iviumzzz362v3	1	\N	2026-01-05 09:52:52.976
cmk0zo2wo000713mqjofu7712	cmk0zo2wo000513mqcgepz3ty	cmjten9z3000iviumzzz362v3	10	\N	2026-01-05 09:59:26.904
\.


--
-- TOC entry 4545 (class 0 OID 28610)
-- Dependencies: 242
-- Data for Name: FranchiseConfig; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."FranchiseConfig" (id, "franchiseStoreId", status, "pricingPlanId", "royaltyPercentage", "royaltyCalculationBase", "allowedWastagePercent", "allowedDiscountPercent", "areaManagerId", "onboardingCompletedAt", "onboardingData", "isPricingLocked", "isDiscountLocked", "isWastageLocked", "lockedBy", "lockedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 4561 (class 0 OID 28916)
-- Dependencies: 258
-- Data for Name: FranchiseHealthScore; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."FranchiseHealthScore" (id, "franchiseConfigId", "scoreDate", "salesGrowthScore", "yieldEfficiencyScore", "wastageScore", "discountScore", "complianceScore", "stockVarianceScore", "overallScore", "salesGrowthPercent", "yieldEfficiencyPercent", "wastagePercent", "discountPercent", "compliancePercent", "stockVariancePercent", metadata, "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 4540 (class 0 OID 26724)
-- Dependencies: 237
-- Data for Name: GRN; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."GRN" (id, "dispatchId", "receivedBy", "receivedAt", status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 4559 (class 0 OID 28877)
-- Dependencies: 256
-- Data for Name: HQAlert; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."HQAlert" (id, "ownerStoreId", "franchiseStoreId", "alertType", severity, title, message, metadata, "isRead", "isResolved", "resolvedBy", "resolvedAt", "acknowledgedBy", "acknowledgedAt", "acknowledgmentNotes", "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 4530 (class 0 OID 26559)
-- Dependencies: 227
-- Data for Name: InventoryLedger; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InventoryLedger" (id, "storeId", "productId", type, "qtyKg", "qtyPcs", reason, "refId", "createdAt") FROM stdin;
cmjtg2dqi000j12atgla3pqas	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	IN	10	\N	ADJUSTMENT	\N	2025-12-31 03:16:18.57
cmjtg2ef5000l12at4auhab8n	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	IN	10	\N	ADJUSTMENT	\N	2025-12-31 03:16:19.457
cmjtg2ex8000n12atvgs99nyk	cmjten76p0000viumjxwes8nz	cmjtfyl260009mw9vktuvk4rd	IN	10	\N	ADJUSTMENT	\N	2025-12-31 03:16:20.108
cmjtg2fda000p12atc7ll6otl	cmjten76p0000viumjxwes8nz	cmjtfylpc000dmw9vtbj4su00	IN	10	\N	ADJUSTMENT	\N	2025-12-31 03:16:20.686
cmjtg2fuq000r12at7kxk5lhc	cmjten76p0000viumjxwes8nz	cmjtfymb5000hmw9vlsdpz75l	IN	10	\N	ADJUSTMENT	\N	2025-12-31 03:16:21.314
cmjtg2g9r000t12atrh8xdji8	cmjten76p0000viumjxwes8nz	cmjtfymx1000lmw9v6odxz662	IN	10	\N	ADJUSTMENT	\N	2025-12-31 03:16:21.855
cmjtg2got000v12atv9i2vd8r	cmjten76p0000viumjxwes8nz	cmjtfynix000pmw9vh4n9s2l9	IN	10	\N	ADJUSTMENT	\N	2025-12-31 03:16:22.398
cmjtg2h3v000x12atzs0ktgbi	cmjten76p0000viumjxwes8nz	cmjtfyo4s000tmw9v1cceq7rv	IN	10	\N	ADJUSTMENT	\N	2025-12-31 03:16:22.939
cmjtg2hiy000z12atv6gtjk8h	cmjten76p0000viumjxwes8nz	cmjtfyoqo000xmw9vj7evt5dp	IN	10	\N	ADJUSTMENT	\N	2025-12-31 03:16:23.483
cmjtydubn0008vlyp2wkxdbqy	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	1.72	\N	SALE	cmjtydti90001vlypl5tt23wa	2025-12-31 11:49:06.371
cmju1uu4y0008pbdjf5c3xtdq	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	0.465	\N	SALE	cmju1utmo0001pbdjcgsftjeh	2025-12-31 13:26:18.13
cmjuvnoyq0007pofxech9wb45	cmjten76p0000viumjxwes8nz	cmjtfylpc000dmw9vtbj4su00	OUT	1	\N	ADJUSTMENT	\N	2026-01-01 03:20:33.281
cmjuvu0kb0001of76piwbzc1v	cmjten76p0000viumjxwes8nz	cmjtfylpc000dmw9vtbj4su00	OUT	9	\N	ADJUSTMENT	\N	2026-01-01 03:25:28.282
cmjuvu1ky0003of76enf0us4j	cmjten76p0000viumjxwes8nz	cmjtfymb5000hmw9vlsdpz75l	OUT	10	\N	ADJUSTMENT	\N	2026-01-01 03:25:29.602
cmjuvu2k50005of767mb9ml8g	cmjten76p0000viumjxwes8nz	cmjtfynix000pmw9vh4n9s2l9	OUT	10	\N	ADJUSTMENT	\N	2026-01-01 03:25:30.87
cmjuvu3j50007of76vvjaatuc	cmjten76p0000viumjxwes8nz	cmjtfyo4s000tmw9v1cceq7rv	OUT	10	\N	ADJUSTMENT	\N	2026-01-01 03:25:32.13
cmjuvu4ie0009of765pgnybxm	cmjten76p0000viumjxwes8nz	cmjtfyoqo000xmw9vj7evt5dp	OUT	10	\N	ADJUSTMENT	\N	2026-01-01 03:25:33.398
cmjuvu5hl000bof761khld5sx	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	9.535	\N	ADJUSTMENT	\N	2026-01-01 03:25:34.665
cmjuvu6gb000dof76bad4byk6	cmjten76p0000viumjxwes8nz	cmjtfyl260009mw9vktuvk4rd	OUT	10	\N	ADJUSTMENT	\N	2026-01-01 03:25:35.916
cmjuvu7e4000fof76iufqxns9	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	8.28	\N	ADJUSTMENT	\N	2026-01-01 03:25:37.132
cmjuvu8i6000hof76egj90p8f	cmjten76p0000viumjxwes8nz	cmjtfymx1000lmw9v6odxz662	OUT	10	\N	ADJUSTMENT	\N	2026-01-01 03:25:38.575
cmjuwap0n0007oqc36x7mypp9	cmjten76p0000viumjxwes8nz	cmjtfymb5000hmw9vlsdpz75l	IN	0.3	\N	ADJUSTMENT	\N	2026-01-01 03:38:26.471
cmjuwv9zp00019f08s2bup8rx	cmjten76p0000viumjxwes8nz	cmjtfynix000pmw9vh4n9s2l9	IN	2	\N	ADJUSTMENT	\N	2026-01-01 03:54:26.773
cmjuww2nk00059f0894oi2ea8	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	IN	8.5	\N	ADJUSTMENT	\N	2026-01-01 03:55:03.921
cmjuwwly700099f08h9w74bvo	cmjten76p0000viumjxwes8nz	cmjtfyl260009mw9vktuvk4rd	IN	2.4	\N	ADJUSTMENT	\N	2026-01-01 03:55:28.928
cmjuwwyd2000d9f086s6uc1xi	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	IN	49	\N	ADJUSTMENT	\N	2026-01-01 03:55:45.014
cmjv0isj5000abkdlbozft58u	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	1.095	\N	SALE	cmjv0is0p0003bkdlso3hiulz	2026-01-01 05:36:42.738
cmjwdp0j20008wc8n2t7oriem	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	0.93	\N	SALE	cmjwdozu70001wc8ntff9xxy6	2026-01-02 04:33:14.222
cmjwdpx620008vy0c0v2ya0cu	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	0.24	\N	SALE	cmjwdpwh00001vy0ckde98071	2026-01-02 04:33:56.522
cmjwduugc000lwc8nz8mene00	cmjten76p0000viumjxwes8nz	cmjtfyl260009mw9vktuvk4rd	OUT	0.34	\N	SALE	cmjwdutvb000ewc8nbcsv9f2l	2026-01-02 04:37:46.285
cmjwe1nwy000av5hefvf5i0c2	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	0.735	\N	SALE	cmjwe1ncc0003v5hehm2yjmt5	2026-01-02 04:43:04.402
cmjwe3nre000a10r1k4wbe5pt	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	0.48	\N	SALE	cmjwe3n74000310r1kc11xwh3	2026-01-02 04:44:37.514
cmjwectnx000eq9fz6xebed8q	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	1	\N	SALE	cmjwecsn10001q9fz2ok74dab	2026-01-02 04:51:45.07
cmjwectof000gq9fz3paf0dd0	cmjten76p0000viumjxwes8nz	cmjtfynix000pmw9vh4n9s2l9	OUT	0.52	\N	SALE	cmjwecsn10001q9fz2ok74dab	2026-01-02 04:51:45.088
cmjweculw000nq9fzpvosp54p	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	1	\N	SALE	cmjwectns0009q9fzidqk7fry	2026-01-02 04:51:46.292
cmjwecumd000pq9fz0rraoanh	cmjten76p0000viumjxwes8nz	cmjtfynix000pmw9vh4n9s2l9	OUT	0.52	\N	SALE	cmjwectns0009q9fzidqk7fry	2026-01-02 04:51:46.309
cmjweg8u6000avkn6aksgsypz	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	1.09	\N	SALE	cmjweg8ap0003vkn6pzoq8gs7	2026-01-02 04:54:24.702
cmjwehbmw0008brvkohbfdsrn	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	1.01	\N	SALE	cmjwehb0t0001brvkfafx2tn7	2026-01-02 04:55:14.984
cmjwemdre0008u38mtvc1e4e3	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	1.01	\N	SALE	cmjwemd5s0001u38m9xb2m18j	2026-01-02 04:59:11.018
cmjweooqh000c6ho947vjsa8x	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	0.455	\N	SALE	cmjweoo3r00056ho9a5hqs347	2026-01-02 05:00:58.553
cmjweqow50008kgjczzlajmg3	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	0.54	\N	SALE	cmjweqo2t0001kgjc3tyc2jb5	2026-01-02 05:02:32.069
cmjwg5u4k0008y12r8t1y9qjm	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	0.52	\N	SALE	cmjwg5tkh0001y12rbd9dqa4y	2026-01-02 05:42:18.308
cmjwgahiz00085wvdd93k1f91	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	0.625	\N	SALE	cmjwgagxi00015wvdvvgksty3	2026-01-02 05:45:55.26
cmjwgd95x0008nhq4f8vzfdqr	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	0.145	\N	SALE	cmjwgd8jd0001nhq4bomk1m9s	2026-01-02 05:48:04.39
cmjwggbjh000b5t5zrz7iyabm	cmjten76p0000viumjxwes8nz	cmjtfyo4s000tmw9v1cceq7rv	OUT	\N	2	SALE	cmjwggaxp00035t5zgq0huy4f	2026-01-02 05:50:27.437
cmjwggbjw000d5t5zpzividm7	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	1.07	\N	SALE	cmjwggaxp00035t5zgq0huy4f	2026-01-02 05:50:27.452
cmjwgrtbm000bg4lrgjktw6uz	cmjten76p0000viumjxwes8nz	cmjtfymb5000hmw9vlsdpz75l	OUT	0.16	\N	SALE	cmjwgrsq50003g4lr5kt318dk	2026-01-02 05:59:23.699
cmjwgrtc3000dg4lrr54g98cx	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	0.755	\N	SALE	cmjwgrsq50003g4lr5kt318dk	2026-01-02 05:59:23.715
cmjwh4ldt00088o18bcpxw4wt	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	1.555	\N	SALE	cmjwh4kr000018o18g0dxojc4	2026-01-02 06:09:19.937
cmjwh8f960008kpvq9v6i6lde	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	0.405	\N	SALE	cmjwh8enc0001kpvq0w0i9p7l	2026-01-02 06:12:18.618
cmjwj57ed0008x539yvc3fyb2	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	1.01	\N	SALE	cmjwj56oo0001x539bhp1xfsb	2026-01-02 07:05:47.701
cmjwk24dm0008uqv72e9gh4hu	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	1.005	\N	SALE	cmjwk23qw0001uqv7qjw2xw1e	2026-01-02 07:31:23.434
cmjwk24x5000juqv7ly21xicm	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	1.005	\N	SALE	cmjwk24f8000cuqv789ek4id7	2026-01-02 07:31:24.137
cmjwkvgzi000axn4kvz0zk54u	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	0.515	\N	SALE	cmjwkvgcw0003xn4k7jpexbq0	2026-01-02 07:54:12.798
cmjwlyaxr000bix8ktnma6xcz	cmjten76p0000viumjxwes8nz	cmjtfyl260009mw9vktuvk4rd	OUT	0.54	\N	SALE	cmjwlyacc0003ix8k6uq6ueqv	2026-01-02 08:24:24.544
cmjwlyay8000dix8kp4sksbir	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	1.555	\N	SALE	cmjwlyacc0003ix8k6uq6ueqv	2026-01-02 08:24:24.56
cmjwlybhf000kix8k4351nlhu	cmjten76p0000viumjxwes8nz	cmjtfyl260009mw9vktuvk4rd	OUT	0.54	\N	SALE	cmjwlyawc00012agplkub0p6c	2026-01-02 08:24:25.251
cmjwlybhu000mix8kt8pdyz6e	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	1.555	\N	SALE	cmjwlyawc00012agplkub0p6c	2026-01-02 08:24:25.266
cmjwmn9ah000abnb044mqbnu5	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	0.385	\N	SALE	cmjwmn8eo0003bnb0grzo3pfp	2026-01-02 08:43:48.809
cmjwnuybt0008bgd99zhgftoh	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	1.54	\N	SALE	cmjwnuxos0001bgd981rxwjhq	2026-01-02 09:17:47.466
cmjwp93mr000a4u7ei1gw4phz	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	1.995	\N	SALE	cmjwp930l00034u7e93n1g54d	2026-01-02 09:56:47.14
cmjwp948k000n4u7e919wpac4	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	1.995	\N	SALE	cmjwp93n6000c4u7et6xuxig4	2026-01-02 09:56:47.924
cmjwrqsif0008d2o5afnflk7y	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	0.335	\N	SALE	cmjwrqrtl0001d2o5o4w3zdzv	2026-01-02 11:06:31.768
cmjwu908w0008ijyx4edk5o3j	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	0.25	\N	SALE	cmjwu8zqt0001ijyxwwtryla7	2026-01-02 12:16:40.832
cmjwul0f3000eqmchtcs0xhkx	cmjten76p0000viumjxwes8nz	cmjtfyl260009mw9vktuvk4rd	OUT	0.59	\N	SALE	cmjwukzvy0007qmchkmgvvchk	2026-01-02 12:26:00.927
cmjwve7l20008ehx65uchgmzb	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	2.23	\N	SALE	cmjwve6yn0001ehx60lgfwfy1	2026-01-02 12:48:43.238
cmjwy57f30008que2q9xyzp0j	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	0.25	\N	SALE	cmjwy56tr0001que2vy0hoql6	2026-01-02 14:05:41.968
cmjwyfe3v0008zgl0zl25iabg	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	2.23	\N	SALE	cmjwyfdg70001zgl0bzz5csou	2026-01-02 14:13:37.196
cmjwygezs000812237de3hg73	cmjten76p0000viumjxwes8nz	cmjtfymx1000lmw9v6odxz662	OUT	1.915	\N	SALE	cmjwygdmn00011223p5fz2ahs	2026-01-02 14:14:25
cmjwygfu1000j1223h64bl5ij	cmjten76p0000viumjxwes8nz	cmjtfymx1000lmw9v6odxz662	OUT	1.915	\N	SALE	cmjwygf6w000c1223jyng958z	2026-01-02 14:14:26.09
cmjwyhk5e000811dpmdhw4je9	cmjten76p0000viumjxwes8nz	cmjtfynix000pmw9vh4n9s2l9	OUT	2.1	\N	SALE	cmjwyhjko000111dp1o9x8j36	2026-01-02 14:15:18.338
cmjwyifp2000eh8ri14zpzgus	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	0.73	\N	SALE	cmjwyif390001h8riainec3hj	2026-01-02 14:15:59.222
cmjwyig9j000jh8ridpr4qqz9	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	0.73	\N	SALE	cmjwyifo40008h8riuqbcwbup	2026-01-02 14:15:59.96
cmjwyj6my000c789lv2981bak	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	1.135	\N	SALE	cmjwyj60x0005789lk8qcytl5	2026-01-02 14:16:34.138
cmjwyk4c4000jzgl02yzu1197	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	0.505	\N	SALE	cmjwyk3re000czgl0or6sbrxv	2026-01-02 14:17:17.812
cmjwyl14p000n789lr4gl1pe3	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	0.725	\N	SALE	cmjwyl0hc000g789l0y6pbhbm	2026-01-02 14:18:00.313
cmjwylyr20008ghnx1gx1xt3a	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	0.335	\N	SALE	cmjwyly4w0001ghnx2kjf3spu	2026-01-02 14:18:43.886
cmjxrwe3h0001dpmdx2mgz5t5	cmjten76p0000viumjxwes8nz	cmjtfylpc000dmw9vtbj4su00	IN	2	\N	ADJUSTMENT	\N	2026-01-03 03:58:39.197
cmjxrwxxg0005dpmdjga9lpdo	cmjten76p0000viumjxwes8nz	cmjtfymb5000hmw9vlsdpz75l	IN	4	\N	ADJUSTMENT	\N	2026-01-03 03:59:04.901
cmjxrxbrd0009dpmdyur0ib1h	cmjten76p0000viumjxwes8nz	cmjtfynix000pmw9vh4n9s2l9	IN	4	\N	ADJUSTMENT	\N	2026-01-03 03:59:22.826
cmjxrxo6h000ddpmdtbhhp47s	cmjten76p0000viumjxwes8nz	cmjtfyo4s000tmw9v1cceq7rv	IN	3	\N	ADJUSTMENT	\N	2026-01-03 03:59:38.922
cmjxryjoa000hdpmdwdegb73r	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	IN	13.2	\N	ADJUSTMENT	\N	2026-01-03 04:00:19.739
cmjxrz59d000ldpmd46n8wp41	cmjten76p0000viumjxwes8nz	cmjtfyl260009mw9vktuvk4rd	IN	8.5	\N	ADJUSTMENT	\N	2026-01-03 04:00:47.714
cmjxrzu26000pdpmd5gzcpqdp	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	IN	54.5	\N	ADJUSTMENT	\N	2026-01-03 04:01:19.855
cmjxs12v8000tdpmdsevvy643	cmjten76p0000viumjxwes8nz	cmjtfymx1000lmw9v6odxz662	IN	1	\N	ADJUSTMENT	\N	2026-01-03 04:02:17.925
cmjxs1yks000xdpmd3pz6nx7j	cmjten76p0000viumjxwes8nz	cmjtfynix000pmw9vh4n9s2l9	IN	2	\N	ADJUSTMENT	\N	2026-01-03 04:02:59.02
cmjxs3v0r0001nmqmz6lm2935	cmjten76p0000viumjxwes8nz	cmjtfymx1000lmw9v6odxz662	IN	1	\N	ADJUSTMENT	\N	2026-01-03 04:04:27.722
cmjxs49cx0005nmqmrrmxutjw	cmjten76p0000viumjxwes8nz	cmjtfymx1000lmw9v6odxz662	IN	2	\N	ADJUSTMENT	\N	2026-01-03 04:04:46.306
cmjxs53uz0009nmqm3g7w9wg7	cmjten76p0000viumjxwes8nz	cmjtfymx1000lmw9v6odxz662	IN	1	\N	ADJUSTMENT	\N	2026-01-03 04:05:25.835
cmjxs6mko000114inob0gpkhg	cmjten76p0000viumjxwes8nz	cmjtfylpc000dmw9vtbj4su00	OUT	2	\N	ADJUSTMENT	\N	2026-01-03 04:06:36.745
cmjxs6n1q000314inr7n5jp8t	cmjten76p0000viumjxwes8nz	cmjtfymb5000hmw9vlsdpz75l	OUT	4.14	\N	ADJUSTMENT	\N	2026-01-03 04:06:37.358
cmjxs6na4000514ino1fu0fqe	cmjten76p0000viumjxwes8nz	cmjtfynix000pmw9vh4n9s2l9	OUT	4.859999999999999	\N	ADJUSTMENT	\N	2026-01-03 04:06:37.661
cmjxs6nin000714ind7eds7rl	cmjten76p0000viumjxwes8nz	cmjtfyo4s000tmw9v1cceq7rv	OUT	3	\N	ADJUSTMENT	\N	2026-01-03 04:06:37.967
cmjxs6nr7000914inz3aohp9n	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	10.17	\N	ADJUSTMENT	\N	2026-01-03 04:06:38.275
cmjxs6ny6000b14inboag1dt4	cmjten76p0000viumjxwes8nz	cmjtfyl260009mw9vktuvk4rd	OUT	8.89	\N	ADJUSTMENT	\N	2026-01-03 04:06:38.527
cmjxs6o59000d14inr7wo27g3	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	78.355	\N	ADJUSTMENT	\N	2026-01-03 04:06:38.781
cmjxs6oe3000f14inoixz4tz1	cmjten76p0000viumjxwes8nz	cmjtfymx1000lmw9v6odxz662	OUT	1.17	\N	ADJUSTMENT	\N	2026-01-03 04:06:39.099
cmjxtpsuy0005975l7g6tlfy3	cmjten7ko0002viumzdic2lbf	cmjten9z3000iviumzzz362v3	IN	54.5	\N	RECEIVE	\N	2026-01-03 04:49:30.97
cmjxtx4lo00019ucm7dbjlun6	cmjten7ko0002viumzdic2lbf	cmjten9z3000iviumzzz362v3	IN	54.5	\N	RECEIVE	\N	2026-01-03 04:55:12.779
cmjxtyxt20001tlq4ejtixa6v	cmjten7ko0002viumzdic2lbf	cmjten9z3000iviumzzz362v3	IN	54.5	\N	ADJUSTMENT	\N	2026-01-03 04:56:37.285
cmjxubbbw0001y0acxq2q3zta	cmjten7ko0002viumzdic2lbf	cmjten9z3000iviumzzz362v3	IN	54.5	\N	RECEIVE	\N	2026-01-03 05:06:14.683
cmjxud5yy0001e7886w3383hk	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	IN	54.5	\N	RECEIVE	\N	2026-01-03 05:07:41.049
cmjxum9cb0007y0ac3che9nmi	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	IN	13.2	\N	RECEIVE	\N	2026-01-03 05:14:45.323
cmjxum9ke000by0acoj7aa5dv	cmjten76p0000viumjxwes8nz	cmjtfylpc000dmw9vtbj4su00	IN	2	\N	RECEIVE	\N	2026-01-03 05:14:45.615
cmjxum9se000fy0aceg862oa4	cmjten76p0000viumjxwes8nz	cmjtfyl260009mw9vktuvk4rd	IN	8.5	\N	RECEIVE	\N	2026-01-03 05:14:45.902
cmjxuma06000jy0ac35mocldb	cmjten76p0000viumjxwes8nz	cmjtfymx1000lmw9v6odxz662	IN	2	\N	RECEIVE	\N	2026-01-03 05:14:46.182
cmjxuma9g000ny0ac1urtqgu6	cmjten76p0000viumjxwes8nz	cmjtfymb5000hmw9vlsdpz75l	IN	4	\N	RECEIVE	\N	2026-01-03 05:14:46.516
cmjxumah8000ry0act1ri9m8j	cmjten76p0000viumjxwes8nz	cmjtfyo4s000tmw9v1cceq7rv	IN	3	\N	RECEIVE	\N	2026-01-03 05:14:46.797
cmjxumaoo000vy0ac4j6fedfo	cmjten76p0000viumjxwes8nz	cmjtfynix000pmw9vh4n9s2l9	IN	4	\N	RECEIVE	\N	2026-01-03 05:14:47.064
cmjxunzwf0008x98qbe7wx5up	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	1.525	\N	SALE	cmjxunzb40001x98qkttcxnn5	2026-01-03 05:16:06.4
cmjxuo0oy000jx98qg7a6dot7	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	1.525	\N	SALE	cmjxuo05r000cx98qaww0nb4i	2026-01-03 05:16:07.426
cmjxupukb000apyanen9yfcki	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	0.495	\N	SALE	cmjxuptxv0003pyan5k3mdpvs	2026-01-03 05:17:32.795
cmjxuqqbz0008n7si1jdxmmpu	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	0.505	\N	SALE	cmjxuqpqd0001n7sibs1zligj	2026-01-03 05:18:13.967
cmjxv3bba000a6gz5ocbs7xyt	cmjten76p0000viumjxwes8nz	cmjtfynix000pmw9vh4n9s2l9	OUT	2.02	\N	SALE	cmjxv3anu00036gz5itmjtlg8	2026-01-03 05:28:01.031
cmjxwapb4000alloefd9t9d3o	cmjten76p0000viumjxwes8nz	cmjtfyl260009mw9vktuvk4rd	OUT	0.745	\N	SALE	cmjxwaopx0003lloenhz1f7mx	2026-01-03 06:01:45.376
cmjxwd2hx0008315nmlid4g36	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	0.415	\N	SALE	cmjxwd1ww0001315ne4ephaip	2026-01-03 06:03:35.782
cmjxwh6n7000a91pwiyhjp46j	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	0.725	\N	SALE	cmjxwh62b000391pws06r9y46	2026-01-03 06:06:47.779
cmjxwj3sa000p91pw84pzbrl7	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	0.61	\N	SALE	cmjxwj36i000i91pwdf92tmcb	2026-01-03 06:08:17.386
cmjxwtl91000253b0wfe2bndk	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	0.805	\N	SALE	cmjxwtkkl0001106oy4khruja	2026-01-03 06:16:26.581
cmjxwypmk000f53b0tjkn4spl	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	0.66	\N	SALE	cmjxwyozz000853b04sal1ua9	2026-01-03 06:20:25.532
cmjxx6pni000exek6zydps116	cmjten76p0000viumjxwes8nz	cmjtfynix000pmw9vh4n9s2l9	OUT	2	\N	SALE	cmjxx6p2g0007xek6yxbb8fr8	2026-01-03 06:26:38.814
cmjxxyg2g000ay10jaek7pj89	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	0.67	\N	SALE	cmjxxyff40003y10j5d0h79wy	2026-01-03 06:48:12.761
cmjxy54gn0001oknogzy0e6c3	cmjten76p0000viumjxwes8nz	cmjtfyo4s000tmw9v1cceq7rv	IN	\N	3	ADJUSTMENT	\N	2026-01-03 06:53:24.311
cmjxy5h950001qftp88hs8evf	cmjten76p0000viumjxwes8nz	cmjtfyo4s000tmw9v1cceq7rv	IN	\N	2	ADJUSTMENT	\N	2026-01-03 06:53:40.888
cmjxy5k6z000cqftpfuwczmbv	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	0.21	\N	SALE	cmjxy5jmo0005qftpuxrs6nkd	2026-01-03 06:53:44.699
cmjxy69nc000jqftpz5ij628i	cmjten76p0000viumjxwes8nz	cmjtfynix000pmw9vh4n9s2l9	OUT	2	\N	SALE	cmjxx6grt0001xek6j1wcp9uh	2026-01-03 06:54:17.688
cmjxy6qhs000qqftpivt59d2k	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	10.6	\N	SALE	cmjxxj1z90001oqvxouy9fk30	2026-01-03 06:54:39.521
cmjxy6qi5000sqftpqw50ka3v	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	2.01	\N	SALE	cmjxxj1z90001oqvxouy9fk30	2026-01-03 06:54:39.533
cmjy1ihqp0005em7grd3zds0o	cmjten76p0000viumjxwes8nz	cmjtfyo4s000tmw9v1cceq7rv	OUT	\N	1	SALE	cmjypg_dump: processing data for table "public.InwardStock"
pg_dump: dumping contents of table "public.InwardStock"
pg_dump: processing data for table "public.LoyaltyTransaction"
1ihp60001em7gt7gq2xt1	2026-01-03 08:27:46.898
cmjy1ijkb000fem7g4h739feb	cmjten76p0000viumjxwes8nz	cmjtfylpc000dmw9vtbj4su00	OUT	0.774	\N	SALE	cmjy1ijjb000aem7g6xkty3tk	2026-01-03 08:27:49.259
cmjy1ijkp000hem7gbkk4cbug	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	1.162	\N	SALE	cmjy1ijjb000aem7g6xkty3tk	2026-01-03 08:27:49.274
cmjy1klpg000tem7ghp8blnoo	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	0.788	\N	SALE	cmjy1klo7000oem7gb41bco4c	2026-01-03 08:29:25.348
cmjy1klpv000vem7ghzmnr208	cmjten76p0000viumjxwes8nz	cmjtfymx1000lmw9v6odxz662	OUT	0.5	\N	SALE	cmjy1klo7000oem7gb41bco4c	2026-01-03 08:29:25.364
cmjy1mtrt0005126fiv7qg976	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	OUT	0.628	\N	SALE	cmjy1mtqj0001126fd3gpnlht	2026-01-03 08:31:09.113
cmjy20zxb0005s9jxkbjxqsz1	cmjten76p0000viumjxwes8nz	cmjtfyo4s000tmw9v1cceq7rv	OUT	\N	1	SALE	cmjy20zvk0001s9jx11ht8tlc	2026-01-03 08:42:10.271
cmjy78ot30005n4ulk58j25xz	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	OUT	1	\N	SALE	cmjy78osu0001n4uldievaw5q	2026-01-03 11:08:07.191
cmjy7eruu0005lfgfncwpkjk5	cmjten76p0000viumjxwes8nz	cmjtfyo4s000tmw9v1cceq7rv	OUT	\N	1	SALE	cmjy7erum0001lfgf23vt4oca	2026-01-03 11:12:51.078
cmjy7lvgs0005tzaynzpgxi5i	cmjten76p0000viumjxwes8nz	cmjtenb6i000ovium4ep6cvrl	OUT	\N	2	SALE	cmjy7lvgm0001tzayedhhot63	2026-01-03 11:18:22.349
cmk0zd2850005mjot3xajapel	cmjten76p0000viumjxwes8nz	cmjtfyoqo000xmw9vj7evt5dp	OUT	1	\N	SALE	cmk0zd27r0001mjoteb2t5b9r	2026-01-05 09:50:52.805
cmk0zdtbd000cmjothoruyim9	cmjten7ko0002viumzdic2lbf	cmjten9z3000iviumzzz362v3	IN	50	\N	RECEIVE	cmjxsbsde00013q1jgtgc9300	2026-01-05 09:51:27.913
cmk0zdtbf000emjotvr6lb5ec	cmjten7ko0002viumzdic2lbf	cmjtfyk5i0005mw9vji8icng4	IN	13.2	\N	RECEIVE	cmjxsbsde00013q1jgtgc9300	2026-01-05 09:51:27.916
cmk0zdtbh000gmjotimi8u0id	cmjten7ko0002viumzdic2lbf	cmjtfylpc000dmw9vtbj4su00	IN	2	\N	RECEIVE	cmjxsbsde00013q1jgtgc9300	2026-01-05 09:51:27.917
cmk0zdtbi000imjotackfcunx	cmjten7ko0002viumzdic2lbf	cmjtfyl260009mw9vktuvk4rd	IN	8.5	\N	RECEIVE	cmjxsbsde00013q1jgtgc9300	2026-01-05 09:51:27.919
cmk0zdtbl000kmjoti0jeq1ms	cmjten7ko0002viumzdic2lbf	cmjtfymx1000lmw9v6odxz662	IN	2	\N	RECEIVE	cmjxsbsde00013q1jgtgc9300	2026-01-05 09:51:27.921
cmk0zdtbm000mmjotz3c6j1vr	cmjten7ko0002viumzdic2lbf	cmjtfymb5000hmw9vlsdpz75l	IN	4.3	\N	RECEIVE	cmjxsbsde00013q1jgtgc9300	2026-01-05 09:51:27.923
cmk0zdtbo000omjotm7p84oe8	cmjten7ko0002viumzdic2lbf	cmjtfynix000pmw9vh4n9s2l9	IN	4	\N	RECEIVE	cmjxsbsde00013q1jgtgc9300	2026-01-05 09:51:27.924
cmk0zg233000ymjotfwl8dft9	cmjten7ko0002viumzdic2lbf	cmjten9z3000iviumzzz362v3	IN	0.5	\N	RECEIVE	cmk0zexhr000qmjotd5yqw93q	2026-01-05 09:53:12.591
cmk0zofww000913mqz16n2mzn	cmjten7ko0002viumzdic2lbf	cmjten9z3000iviumzzz362v3	IN	5	\N	RECEIVE	cmk0zndt3000113mqsy6o95pj	2026-01-05 09:59:43.761
cmk0zp4du000b13mqecmr1nok	cmjten7ko0002viumzdic2lbf	cmjten9z3000iviumzzz362v3	IN	10	\N	RECEIVE	\N	2026-01-05 10:00:15.474
cmk100ou00001nl1wqvw6cta9	cmjten7ko0002viumzdic2lbf	cmjten9z3000iviumzzz362v3	IN	10	\N	RECEIVE	\N	2026-01-05 10:09:15.193
cmk16g1em0009nl1wpogqybiz	cmjten7ko0002viumzdic2lbf	cmjtfyo4s000tmw9v1cceq7rv	OUT	\N	1	SALE	cmk16g1eg0005nl1w1keh82lw	2026-01-05 13:09:09.022
cmk16ggl4000mnl1w6qlq4uu9	cmjten7ko0002viumzdic2lbf	cmjtfyk5i0005mw9vji8icng4	OUT	2	\N	SALE	cmk16ggl1000inl1wzh22gjtb	2026-01-05 13:09:28.696
cmk16gtfl000znl1wmlem1mts	cmjten7ko0002viumzdic2lbf	cmjtfylpc000dmw9vtbj4su00	OUT	2	\N	SALE	cmk16gtfd000vnl1wkb7p37fu	2026-01-05 13:09:45.345
\.


--
-- TOC entry 4553 (class 0 OID 28757)
-- Dependencies: 250
-- Data for Name: InwardStock; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InwardStock" (id, "ownerStoreId", "centralPOId", "supplierId", "productId", "batchNo", "totalWeightKg", "temperatureCheck", "receivedBy", "receivedAt", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 4566 (class 0 OID 29072)
-- Dependencies: 263
-- Data for Name: LoyaltyTransaction; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."LoyaltyTransaction" (id, "customerId", "storeId", type, points, balance, description, "saleId", "createdAt", "createpg_dump: dumping contents of table "public.LoyaltyTransaction"
dBy") FROM stdin;
cmjv0iskd000cbkdlbf050bm1	cmjv0ie0b0001bkdl3cb9k8f5	cmjten76p0000viumjxwes8nz	EARN	35	35	Earned 35 points from purchase SALE-20260101-0001	cmjv0is0p0003bkdlso3hiulz	2026-01-01 05:36:42.781	cmjten85j0004viumsifvy7nr
cmjwduuht000nwc8nly5l41mw	cmjwduttr000cwc8n3tyldczh	cmjten76p0000viumjxwes8nz	EARN	12	12	Earned 12 points from purchase SALE-20260102-0003	cmjwdutvb000ewc8nbcsv9f2l	2026-01-02 04:37:46.338	cmjten85j0004viumsifvy7nr
cmjwe1ny1000cv5helqw4s5jt	cmjwe1cfc0001v5henesbzwim	cmjten76p0000viumjxwes8nz	EARN	23	23	Earned 23 points from purchase SALE-20260102-0004	cmjwe1ncc0003v5hehm2yjmt5	2026-01-02 04:43:04.441	cmjten85j0004viumsifvy7nr
cmjwe3nsf000c10r1alcpu9cn	cmjwe3n52000110r14w1vn32c	cmjten76p0000viumjxwes8nz	EARN	15	15	Earned 15 points from purchase SALE-20260102-0005	cmjwe3n74000310r1kc11xwh3	2026-01-02 04:44:37.552	cmjten85j0004viumsifvy7nr
cmjweg8v6000cvkn611pq3syf	cmjwefyhk0001vkn6wqwasgt5	cmjten76p0000viumjxwes8nz	EARN	34	34	Earned 34 points from purchase SALE-20260102-0008	cmjweg8ap0003vkn6pzoq8gs7	2026-01-02 04:54:24.739	cmjten85j0004viumsifvy7nr
cmjweooru000e6ho9uih0tgo0	cmjweoj1h00016ho9oa5hvmkr	cmjten76p0000viumjxwes8nz	EARN	20	20	Earned 20 points from purchase SALE-20260102-0011	cmjweoo3r00056ho9a5hqs347	2026-01-02 05:00:58.602	cmjten85j0004viumsifvy7nr
cmjwggbl0000f5t5zu318cxk2	cmjwgfv9v00015t5z5erb6xs8	cmjten76p0000viumjxwes8nz	EARN	52	52	Earned 52 points from purchase SALE-20260102-0016	cmjwggaxp00035t5zgq0huy4f	2026-01-02 05:50:27.493	cmjten85j0004viumsifvy7nr
cmjwgrtd5000fg4lro6r83xaz	cmjwgr8hk0001g4lrf5p9jhv3	cmjten76p0000viumjxwes8nz	EARN	30	30	Earned 30 points from purchase SALE-20260102-0017	cmjwgrsq50003g4lr5kt318dk	2026-01-02 05:59:23.753	cmjten85j0004viumsifvy7nr
cmjwj57go000ax539kf0xj8bq	cmjwhi5rb000c8o18thh50pz7	cmjten76p0000viumjxwes8nz	EARN	46	46	Earned 46 points from purchase SALE-20260102-0020	cmjwj56oo0001x539bhp1xfsb	2026-01-02 07:05:47.784	cmjten85j0004viumsifvy7nr
cmjwkvh15000cxn4k6imn6y2r	cmjwkv0us0001xn4kt4ys35nn	cmjten76p0000viumjxwes8nz	EARN	16	16	Earned 16 points from purchase SALE-20260102-0023	cmjwkvgcw0003xn4k7jpexbq0	2026-01-02 07:54:12.857	cmjten85j0004viumsifvy7nr
cmjwlyazc000fix8k271hjm74	cmjwlxfnm0001ix8k6367e3p8	cmjten76p0000viumjxwes8nz	EARN	90	90	Earned 90 points from purchase SALE-20260102-0024	cmjwlyacc0003ix8k6uq6ueqv	2026-01-02 08:24:24.6	cmjten85j0004viumsifvy7nr
cmjwlybix000oix8keqq6v77n	cmjwlxfnm0001ix8k6367e3p8	cmjten76p0000viumjxwes8nz	EARN	90	180	Earned 90 points from purchase SALE-20260102-0025	cmjwlyawc00012agplkub0p6c	2026-01-02 08:24:25.305	cmjten85j0004viumsifvy7nr
cmjwmn9by000cbnb01x9p0drs	cmjwmmfmq0001bnb07gr6b2d8	cmjten76p0000viumjxwes8nz	EARN	12	12	Earned 12 points from purchase SALE-20260102-0026	cmjwmn8eo0003bnb0grzo3pfp	2026-01-02 08:43:48.862	cmjten85j0004viumsifvy7nr
cmjwp93o9000i4u7exmvtxav0	cmjwp8byu00014u7evwflgyd5	cmjten76p0000viumjxwes8nz	EARN	63	63	Earned 63 points from purchase SALE-20260102-0028	cmjwp930l00034u7e93n1g54d	2026-01-02 09:56:47.194	cmjten85j0004viumsifvy7nr
cmjwp949q000p4u7e27zjax2k	cmjwp8byu00014u7evwflgyd5	cmjten76p0000viumjxwes8nz	EARN	63	126	Earned 63 points from purchase SALE-20260102-0029	cmjwp93n6000c4u7et6xuxig4	2026-01-02 09:56:47.966	cmjten85j0004viumsifvy7nr
cmjxupuln000cpyanba69jfah	cmjxupmr70001pyanch0xlbtj	cmjten76p0000viumjxwes8nz	EARN	22	22	Earned 22 points from purchase SALE-20260103-0003	cmjxuptxv0003pyan5k3mdpvs	2026-01-03 05:17:32.844	cmjten85j0004viumsifvy7nr
cmjxv3bcy000c6gz5nd3t5omr	cmjxv33qd00016gz5w0s3rv77	cmjten76p0000viumjxwes8nz	EARN	18	18	Earned 18 points from purchase SALE-20260103-0005	cmjxv3anu00036gz5itmjtlg8	2026-01-03 05:28:01.09	cmjten85j0004viumsifvy7nr
cmjxwapc8000clloeypuap67j	cmjxwairm0001lloe4v7hcig7	cmjten76p0000viumjxwes8nz	EARN	26	26	Earned 26 points from purchase SALE-20260103-0006	cmjxwaopx0003lloenhz1f7mx	2026-01-03 06:01:45.417	cmjten85j0004viumsifvy7nr
cmjxwh6on000c91pwjr56thtw	cmjxwh1r1000191pwxxom2ocw	cmjten76p0000viumjxwes8nz	EARN	23	23	Earned 23 points from purchase SALE-20260103-0008	cmjxwh62b000391pws06r9y46	2026-01-03 06:06:47.831	cmjten85j0004viumsifpg_dump: processing data for table "public.Payment"
pg_dump: dumping contents of table "public.Payment"
vy7nr
cmjxwj3tr000r91pwkknsygrz	cmjxwikld000g91pw3vgo6y14	cmjten76p0000viumjxwes8nz	EARN	19	19	Earned 19 points from purchase SALE-20260103-0009	cmjxwj36i000i91pwdf92tmcb	2026-01-03 06:08:17.44	cmjten85j0004viumsifvy7nr
cmjxwtlaj000453b0wfzht7pa	cmjxwqpcf0001126mg2m4c2fj	cmjten76p0000viumjxwes8nz	EARN	25	25	Earned 25 points from purchase SALE-20260103-0010	cmjxwtkkl0001106oy4khruja	2026-01-03 06:16:26.636	cmjten85j0004viumsifvy7nr
cmjxy5k7z000eqftp3herq0e1	cmjxy57pz0005oknom0z91dra	cmjten76p0000viumjxwes8nz	EARN	9	9	Earned 9 points from purchase SALE-20260103-0016	cmjxy5jmo0005qftpuxrs6nkd	2026-01-03 06:53:44.735	cmjten85j0004viumsifvy7nr
cmjy7ervn000alfgfi9tto0nh	cmjuw914m0001oqc3o2xh0386	cmjten76p0000viumjxwes8nz	EARN	9	9	Earned 9 points from purchase SALE-20260103-0023	cmjy7erum0001lfgf23vt4oca	2026-01-03 11:12:51.107	cmjten85j0004viumsifvy7nr
cmk16g1fe000enl1w5xolur5s	cmjuw914m0001oqc3o2xh0386	cmjten7ko0002viumzdic2lbf	EARN	9	18	Earned 9 points from purchase SALE-20260105-0001	cmk16g1eg0005nl1w1keh82lw	2026-01-05 13:09:09.051	cmjten8jh0006vium78ek3p0s
cmk16ggln000rnl1wqtiffyad	cmjuw914m0001oqc3o2xh0386	cmjten7ko0002viumzdic2lbf	EARN	92	110	Earned 92 points from purchase SALE-20260105-0002	cmk16ggl1000inl1wzh22gjtb	2026-01-05 13:09:28.716	cmjten8jh0006vium78ek3p0s
cmk16gtg40014nl1wewf1hw8m	cmjuw914m0001oqc3o2xh0386	cmjten7ko0002viumzdic2lbf	EARN	80	190	Earned 80 points from purchase SALE-20260105-0003	cmk16gtfd000vnl1wkb7p37fu	2026-01-05 13:09:45.365	cmjten8jh0006vium78ek3p0s
\.


--
-- TOC entry 4533 (class 0 OID 26615)
-- Dependencies: 230
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Payment" (id, "saleId", method, amount, "txnRef", "createdAt") FROM stdin;
cmjtydua20006vlypkvwv8569	cmjtydti90001vlypl5tt23wa	UPI	577.92	\N	2025-12-31 11:49:06.314
cmju1uu3g0006pbdjqjks5daw	cmju1utmo0001pbdjcgsftjeh	CASH	213.9	\N	2025-12-31 13:26:18.077
cmjv0ishh0008bkdl77ymd4xy	cmjv0is0p0003bkdlso3hiulz	UPI	350	\N	2026-01-01 05:36:42.677
cmjwdp0h40006wc8nq1utis8i	cmjwdozu70001wc8ntff9xxy6	UPI	298	\N	2026-01-02 04:33:14.152
cmjwdpx3p0006vy0c2s7mu5f5	cmjwdpwh00001vy0ckde98071	UPI	110	\N	2026-01-02 04:33:56.438
cmjwduueh000jwc8nsy2fz33q	cmjwdutvb000ewc8nbcsv9f2l	CASH	122	\N	2026-01-02 04:37:46.217
cmjwe1nvs0008v5hed2tr2m3i	cmjwe1ncc0003v5hehm2yjmt5	CASH	235	\N	2026-01-02 04:43:04.36
cmjwe3npy000810r1d8ffehmo	cmjwe3n74000310r1kc11xwh3	CASH	154	\N	2026-01-02 04:44:37.462
cmjwectm40007q9fzwvm6dxyz	cmjwecsn10001q9fz2ok74dab	UPI	367	\N	2026-01-02 04:51:45.005
cmjwecuk7000lq9fz3pxlk4z0	cmjwectns0009q9fzidqk7fry	UPI	367	\N	2026-01-02 04:51:46.232
cmjweg8sp0008vkn6binv1mzj	cmjweg8ap0003vkn6pzoq8gs7	UPI	349	\N	2026-01-02 04:54:24.65
cmjwehbl20006brvkz62w2kj4	cmjwehb0t0001brvkfafx2tn7	UPI	323	\N	2026-01-02 04:55:14.918
cmjwemdpf0006u38mosh2hh4a	cmjwemd5s0001u38m9xb2m18j	CASH	323	\N	2026-01-02 04:59:10.947
cmjweoooj000a6ho93ecqpn5d	cmjweoo3r00056ho9a5hqs347	CASH	209	\N	2026-01-02 05:00:58.483
cmjweqoud0006kgjcry5mmavg	cmjweqo2t0001kgjc3tyc2jb5	UPI	248	\N	2026-01-02 05:02:32.005
cmjwg5u2r0006y12r49wid3yb	cmjwg5tkh0001y12rbd9dqa4y	CASH	239	\N	2026-01-02 05:42:18.243
cmjwgahh900065wvd3e77poa8	cmjwgagxi00015wvdvvgksty3	CASH	200	\N	2026-01-02 05:45:55.198
cmjwgd94j0006nhq4w69beixx	cmjwgd8jd0001nhq4bomk1m9s	UPI	67	\N	2026-01-02 05:48:04.339
cmjwggbhx00095t5z5eqxvxe7	cmjwggaxp00035t5zgq0huy4f	UPI	522	\N	2026-01-02 05:50:27.381
cmjwgrta90009g4lrwa1isgg2	cmjwgrsq50003g4lr5kt318dk	UPI	306	\N	2026-01-02 05:59:23.65
cmjwh4lbp00068o18mpzr9uxf	cmjwh4kr000018o18g0dxojc4	CASH	498	\N	2026-01-02 06:09:19.861
cmjwh8f7h0006kpvqtexr2mwi	cmjwh8enc0001kpvq0w0i9p7l	UPI	130	\N	2026-01-02 06:12:18.558
cmjwj57c90006x539tx4t5rfn	cmjwj56oo0001x539bhp1xfsb	UPI	465	\N	2026-01-02 07:05:47.625
cmjwk24c60006uqv7803blotp	cmjwk23qw0001uqv7qjw2xw1e	UPI	462	\N	2026-01-02 07:31:23.382
cmjwk24vu000huqv7nb788cwj	cmjwk24f8000cuqv789ek4id7	UPI	462	\N	2026-01-02 07:31:24.09
cmjwkvgx80008xn4kyyy63oz6	cmjwkvgcw0003xn4k7jpexbq0	CASH	165	\N	2026-01-02 07:54:12.716
cmjwlyavx0009ix8kpyk8yo0z	cmjwlyacc0003ix8k6uq6ueqv	UPI	910	\N	2026-01-02 08:24:24.477
cmjwlybfy000iix8kxua1c1mh	cmjwlyawc00012agplkub0p6c	UPI	910	\N	2026-01-02 08:24:25.198
cmjwmn98h0008bnb0ut7gvqbo	cmjwmn8eo0003bnb0grzo3pfp	UPI	123	\N	2026-01-02 08:43:48.737
cmjwnuya00006bgd9cgphmwii	cmjwnuxos0001bgd981rxwjhq	UPI	708	\N	2026-01-02 09:17:47.401
cmjwp93kr00084u7ezunduygf	cmjwp930l00034u7e93n1g54d	CARD	638	\N	2026-01-02 09:56:47.067
cmjwp9471000l4u7enul0oaam	cmjwp93n6000c4u7et6xuxig4	CARD	638	\N	2026-01-02 09:56:47.87
cmjwrqsgj0006d2o5cd85cyh8	cmjwrqrtl0001d2o5o4w3zdzv	UPI	107	\N	2026-01-02 11:06:31.7
cmjwu907l0006ijyxo8xo3pg9	cmjwu8zqt0001ijyxwwtryla7	UPI	115	\N	2026-01-02 12:16:40.786
cmjwul0d0000cqmchtt6vxfmz	cmjwukzvy0007qmchkmgvvchk	CARD	212	\N	2026-01-02 12:26:00.852
cmjwve7jp0006ehx6215kaygx	cmjwve6yn0001ehx60lgfwfy1	CASH	549	\N	2026-01-02 12:48:43.189
cmjwy57d00006que2zb71kzmd	cmjwy56tr0001que2vy0hoql6	UPI	115	\N	2026-01-02 14:05:41.892
cmjwyfe200006zgl0v1n0l69d	cmjwyfdg70001zgl0bzz5csou	UPI	714	\N	2026-01-02 14:13:37.128
cmjwygey7000612236yuy4z4d	cmjwygdmn00011223p5fz2ahs	UPI	306	\N	2026-01-02 14:14:24.944
cmjwygfsg000h1223u1xo7iic	cmjwygf6w000c1223jyng958z	CASH	306	\N	2026-01-02 14:14:26.032
cmjwyhk48000611dp8vk0qxyn	cmjwyhjko000111dp1o9x8j36	UPI	189	\N	2026-01-02 14:15:18.297
cmjwyifn20006h8riswjh9a10	cmjwyif390001h8riainec3hj	CASH	336	\N	2026-01-02 14:15:59.15
cmjwyig7j000hh8ridxb1n3st	cmjwyifo40008h8riuqbcwbup	CASH	336	\N	2026-01-02 14:15:59.887
cmjwyj6l8000a789ljk53dfu1	cmjwyj60x0005789lk8qcytl5	CASH	363	\N	2026-01-02 14:16:34.076
cmjwyk4b0000hzgl0x4nffvi8	cmjwyk3re000czgl0or6sbrxv	UPI	162	\N	2026-01-02 14:17:17.772
cmjwyl12v000l789li14srlg4	cmjwyl0hc000g789l0y6pbhbm	UPI	232	\N	2026-01-02 14:18:00.247
cmjwylyp20006ghnxcmxaw75g	cmjwyly4w0001ghnx2kjf3spu	UPI	107	\N	2026-01-02 14:18:43.815
cmjxunzuy0006x98qhsemh8kp	cmjxunzb40001x98qkttcxnn5	CASH	488	\N	2026-01-03 05:16:06.347
cmjxuo0np000hx98qioxm5k3q	cmjxuo05r000cx98qaww0nb4i	CASH	488	\N	2026-01-03 05:16:07.382
cmjxupuik0008pyan2nkmtz22	cmjxuptxv0003pyan5k3mdpvs	UPI	228	\N	2026-01-03 05:17:32.733
cmjxuqqan0006n7sigdqw7sfk	cmjxuqpqd0001n7sibs1zligj	UPI	232	\N	2026-01-03 05:18:13.919
cmjxv3b9500086gz5cnh3jvor	cmjxv3anu00036gz5itmjtlg8	UPI	182	\N	2026-01-03 05:28:00.953
cmjxwap9l0008lloecbpicgua	cmjxwaopx0003lloenhz1f7mx	CASH	268	\N	2026-01-03 06:01:45.321
cmjxwd2g50006315nweq5sf2n	cmjxwd1ww0001315ne4ephaip	CASH	191	\N	2026-01-03 06:03:35.717
cmjxwh6lc000891pw2366g30j	cmjxwh62b000391pws06r9y46	CASH	232	\N	2026-01-03 06:06:47.712
cmjxwj3qe000n91pwwa24ukpq	cmjxwj36i000i91pwdf92tmcb	UPI	195	\N	2026-01-03 06:08:17.318
cmjxwtl6z000053b01wvpq9km	cmjxwtkkl0001106oy4khruja	UPI	258	\N	2026-01-03 06:16:26.507
cmjxwypl7000d53b0806pkumy	cmjxwyozz000853b04sal1ua9	UPI	211	\N	2026-01-03 06:20:25.483
cmjxx6pln000cxek61ki8w2ss	cmjxx6p2g0007xek6yxbb8fr8	CARD	180	\N	2026-01-03 06:26:38.747
cmjxxyg0h0008y10jg5lsubqq	cmjxxyff40003y10j5d0h79wy	CASH	214	\N	2026-01-03 06:48:12.689
cmjxy5k5k000aqftp5b4ow131	cmjxy5jmo0005qftpuxrs6nkd	UPI	97	\N	2026-01-03 06:53:44.648
cmjxy69le000hqftpq0npvgk0	cmjxx6grt0001xek6j1wcp9uh	CASH	180	\N	2026-01-03 06:54:17.618
cmjxy6qgm000oqftpcynhopy0	cmjxxj1z90001oqvxouy9fk30	CASH	3330	\N	2026-01-03 06:54:39.478
cmjy1ik0o000kem7gt54rq01l	cmjy1ijjb000aem7g6xkty3tk	UPI	681	\N	2026-01-03 08:27:49.849
cmjy1kmtb000yem7gr8rhpsmg	cmjy1klo7000oem7gb41bco4c	UPI	332	\N	2026-01-03 08:29:26.783
cmjy1mu9k0008126fi2hyy8de	cmjy1mtqj0001126fd3gpnlht	CASH	201	\N	2026-01-03 08:31:09.752
cmjy210dd0008s9jxg84z2bwh	cmjy20zvk0001s9jx11ht8tlc	CASH	90	\N	2026-01-03 08:42:10.849
cmjy78otj0008n4ul6cm4yl7v	cmjy78osu0001n4uldievaw5q	CREDIT	460	\N	2026-01-03 11:08:07.208
cmjy7ervd0008lfgfl4j4mtf0	cmjy7erum0001lfgf23vt4oca	CREDIT	90	\N	2026-01-03 11:12:51.097
cmjy7ikfq0000mfaloz2jr7zv	cmjy1ihp60001em7gt7gq2xt1	CASH	90	\N	2026-01-03 11:15:48.087
cmjy7lx2l0008tzay0epuwh2w	cmjy7lvgm0001tzayedhhot63	CREDIT	200	\N	2026-01-03 11:18:24.43
cmk0zd28y0008mjothttlto24	cmk0zd27r0001mjoteb2t5b9r	CASH	160	\N	2026-01-05 09:50:52.834
cmk16g1f3000cnl1wdf2cngsb	cmk16g1eg0005nl1w1keh82lw	CASH	90	\N	2026-01-05 13:09:09.04
cmk16gglg000pnl1w4x1niian	cmk16ggl1000inl1wzh22gjtb	CREDIT	920	\N	2026-01-05 pg_dump: processing data for table "public.PricingOverride"
pg_dump: dumping contents of table "public.PricingOverride"
pg_dump: processing data for table "public.PricingPlan"
pg_dump: dumping contents of table "public.PricingPlan"
pg_dump: processing data for table "public.PricingRule"
pg_dump: dumping contents of table "public.PricingRule"
pg_dump: processing data for table "public.Product"
pg_dump: dumping contents of table "public.Product"
13:09:28.708
cmk16gtfx0012nl1wfvv8atia	cmk16gtfd000vnl1wkb7p37fu	CREDIT	800	\N	2026-01-05 13:09:45.357
\.


--
-- TOC entry 4548 (class 0 OID 28668)
-- Dependencies: 245
-- Data for Name: PricingOverride; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PricingOverride" (id, "franchiseConfigId", "productId", "overridePrice", "lockStatus", "approvedByHQ", "approvedByUserId", "approvedAt", reason, "effectiveFrom", "effectiveTo", "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 4546 (class 0 OID 28638)
-- Dependencies: 243
-- Data for Name: PricingPlan; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PricingPlan" (id, name, type, description, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 4547 (class 0 OID 28653)
-- Dependencies: 244
-- Data for Name: PricingRule; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PricingRule" (id, "pricingPlanId", "productId", "categoryId", "basePrice", "minPrice", "maxPrice", "effectiveFrom", "effectiveTo", "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 4527 (class 0 OID 26505)
-- Dependencies: 224
-- Data for Name: Product; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Product" (id, "ownerStoreId", sku, plu, name, "categoryId", "unitType", "taxRate", "isActive", "createdAt", "updatedAt", "imageUrl") FROM stdin;
cmjtenb6i000ovium4ep6cvrl	cmjten76p0000viumjxwes8nz	CHK001	10001	Whole Chicken	cmjten94g000cviumsxbagugw	KG	5	f	2025-12-31 02:36:35.803	2025-12-31 05:01:47.497	\N
cmjtfylpc000dmw9vtbj4su00	cmjten76p0000viumjxwes8nz	00004	00004	Drumstick	cmjtfyhgj0001mw9vl5bpcr8c	KG	0	t	2025-12-31 03:13:22.272	2025-12-31 09:39:44.736	https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSRcLzg0TeG-BVJJrgBvmWHdm5HiNCNp4Q9FA&s
cmjtfymb5000hmw9vlsdpz75l	cmjten76p0000viumjxwes8nz	00005	00005	Lollipop	cmjtfyhgj0001mw9vl5bpcr8c	KG	0	t	2025-12-31 03:13:23.057	2025-12-31 09:40:31.972	https://sliceandcube.com/wp-content/uploads/2023/11/1000016563.jpg
cmjtencyx0016vium42mf2yap	cmjten76p0000viumjxwes8nz	CHK004	10004	Chicken Wings	cmjten9jn000eviumu7313diu	KG	5	f	2025-12-31 02:36:38.121	2025-12-31 05:01:07.143	\N
cmjtene4f001ivium9eb2uuy8	cmjten76p0000viumjxwes8nz	PKG001	30001	Packaging	cmjten9s5000gviumjl8n6wo2	PCS	0	f	2025-12-31 02:36:39.616	2025-12-31 05:01:37.278	\N
cmjtfynix000pmw9vh4n9s2l9	cmjten76p0000viumjxwes8nz	00007	00007	Carcus	cmjtfyhgj0001mw9vl5bpcr8c	KG	0	t	2025-12-31 03:13:24.634	2025-12-31 09:40:58.056	https://coyotecreekfarm.com/cdn/shop/files/f77ec7df-4308-497f-bb57-fee5b57c1f73.png?v=1747871733
cmjtfyoqo000xmw9vj7evt5dp	cmjten76p0000viumjxwes8nz	00009	00009	Gizzard	cmjtfyhgj0001mw9vl5bpcr8c	KG	0	t	2025-12-31 03:13:26.209	2025-12-31 09:42:08.379	https://www.oifood.in/files/products/c1596c45d11a1ded7db6f5ff0245353d.jpg
cmjtfyk5i0005mw9vji8icng4	cmjten76p0000viumjxwes8nz	00002	00002	Breast Boneless	cmjtfyhgj0001mw9vl5bpcr8c	KG	0	t	2025-12-31 03:13:20.262	2025-12-31 09:44:21.796	https://www.tastingtable.com/img/gallery/what-it-means-if-your-raw-chicken-looks-shredded/l-intro-1715103098.jpg
cmjtfyl260009mw9vktuvk4rd	cmjten76p0000viumjxwes8nz	00003	00003	Leg	cmjtfyhgj0001mw9vl5bpcr8c	KG	0	t	2025-12-31 03:13:21.439	2025-12-31 09:44:50.599	https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTrNH5MSxlQUBy5m87DIwCsHSBueYgzgYSsfA&s
cmjten9z3000iviumzzz362v3	cmjten76p0000viumjxwes8nz	00001	00001	Hot Tandoor	cmjten94g000cviumsxbagugw	KG	0	t	2025-12-31 02:36:34.24	2026-01-03 04:01:54.153	https://cti.farziengineer.co/products/Chicken_Curry_Cut_1-1ba61e8cf37d.png?auto=format&sharp=20&ixlib=react-9.3.0
cmjtfyo4s000tmw9v1cceq7rv	cmjten76p0000viumjxwes8nz	00008	00008	Egg	cmjtfyhgj0001mw9vl5bpcr8c	PCS	0	t	2025-12-31 03:13:25.421	2026-01-03 06:16:31.499	https://img.freepik.com/free-photo/raw-chicken-eggs-egg-box-white-surface_114579-53521.jpg
cmjtfymx1000lmw9v6odxz662	cmjten76p0000viumjxwes8nz	00006	00006	Liver	cmjtfyhgj0001mw9vl5bpcr8c	KG	0	t	2025-12-31 03:13:23.845	2025-12-31 09:37:10.806	data:image/jpeg;base64,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_dump: processing data for table "public.ProductMaster"
pg_dump: dumping contents of table "public.ProductMaster"
pg_dump: processing data for table "public.PurchaseOrder"
pg_dump: dumping contents of table "public.PurchaseOrder"
pg_dump: processing data for table "public.PurchaseOrderItem"
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
\.


--
-- TOC entry 4549 (class 0 OID 28688)
-- Dependencies: 246
-- Data for Name: ProductMaster; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProductMaster" (id, "ownerStoreId", "productId", "productType", "expectedYieldPercent", "wastageTolerancePercent", "taxCategory", "hqLockedPrice", "isHQLocked", "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 4536 (class 0 OID 26669)
-- Dependencies: 233
-- Data for Name: PurchaseOrder; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PurchaseOrder" (id, "franchiseStoreId", "ownerStoreId", "poNo", status, notes, "createdAt", "updatedAt") FROM stdin;
cmjxsbsde00013q1jgtgc9300	cmjten7ko0002viumzdic2lbf	cmjten76p0000viumjxwes8nz	PO-20260103-0001	CLOSED	\N	2026-01-03 04:10:37.538	2026-01-05 09:51:27.925
cmk0zexhr000qmjotd5yqw93q	cmjten7ko0002viumzdic2lbf	cmjten76p0000viumjxwes8nz	PO-20260105-0001	CLOSED	\N	2026-01-05 09:52:19.984	2026-01-05 09:53:12.594
cmk0zndt3000113mqsy6o95pj	cmjten7ko0002viumzdic2lbf	cmjten76p0000viumjxwes8nz	PO-20260105-0002	CLOSED	\N	2026-01-05 09:58:54.375	2026-01-05 09:59:43.763
\.


--
-- TOC entry 4537 (class 0 OID 26685)
-- Dependencies: 234
-- Data for Name: PurchaseOrderItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PurchaseOrdpg_dump: dumping contents of table "public.PurchaseOrderItem"
pg_dump: processing data for table "public.ReplenishmentRequest"
pg_dump: dumping contents of table "public.ReplenishmentRequest"
pg_dump: processing data for table "public.RoyaltyInvoice"
pg_dump: dumping contents of table "public.RoyaltyInvoice"
pg_dump: processing data for table "public.RoyaltyLedger"
pg_dump: dumping contents of table "public.RoyaltyLedger"
pg_dump: processing data for table "public.Sale"
pg_dump: dumping contents of table "public.Sale"
erItem" (id, "poId", "productId", "qtyKg", "qtyPcs", "requestedRate", "createdAt", "receivedQtyKg", "receivedQtyPcs", "updatedAt") FROM stdin;
cmjxsbsdf00033q1jhjqpgnc3	cmjxsbsde00013q1jgtgc9300	cmjten9z3000iviumzzz362v3	54.5	\N	210	2026-01-03 04:10:37.538	50	\N	2026-01-05 09:30:21.512
cmjxsbsdf00043q1jjzd4vs2z	cmjxsbsde00013q1jgtgc9300	cmjtfyk5i0005mw9vji8icng4	13.2	\N	280	2026-01-03 04:10:37.538	\N	\N	2026-01-05 09:30:21.519
cmjxsbsdf00053q1jce0y4ux4	cmjxsbsde00013q1jgtgc9300	cmjtfylpc000dmw9vtbj4su00	2	\N	240	2026-01-03 04:10:37.538	\N	\N	2026-01-05 09:30:21.521
cmjxsbsdf00063q1jxet2oxaa	cmjxsbsde00013q1jgtgc9300	cmjtfyl260009mw9vktuvk4rd	8.5	\N	220	2026-01-03 04:10:37.538	\N	\N	2026-01-05 09:30:21.523
cmjxsbsdf00073q1jlhytiscg	cmjxsbsde00013q1jgtgc9300	cmjtfymx1000lmw9v6odxz662	2	\N	95	2026-01-03 04:10:37.538	\N	\N	2026-01-05 09:30:21.524
cmjxsbsdf00083q1jk3evp31c	cmjxsbsde00013q1jgtgc9300	cmjtfymb5000hmw9vlsdpz75l	4.3	\N	240	2026-01-03 04:10:37.538	\N	\N	2026-01-05 09:30:21.525
cmjxsbsdf00093q1jcaurldim	cmjxsbsde00013q1jgtgc9300	cmjtfynix000pmw9vh4n9s2l9	4	\N	55	2026-01-03 04:10:37.538	\N	\N	2026-01-05 09:30:21.525
cmk0zexhr000smjotcz21sxqt	cmk0zexhr000qmjotd5yqw93q	cmjten9z3000iviumzzz362v3	1	\N	320	2026-01-05 09:52:19.984	0.5	\N	2026-01-05 09:53:01.604
cmk0zndt3000313mq4e1v8obl	cmk0zndt3000113mqsy6o95pj	cmjten9z3000iviumzzz362v3	10	\N	320	2026-01-05 09:58:54.375	5	\N	2026-01-05 09:59:35.201
\.


--
-- TOC entry 4563 (class 0 OID 28974)
-- Dependencies: 260
-- Data for Name: ReplenishmentRequest; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ReplenishmentRequest" (id, "franchiseStoreId", "productId", "salesVelocity7d", "salesVelocity14d", "salesVelocity30d", "currentStockKg", "currentStockPcs", "requestedQtyKg", "requestedQtyPcs", "leadTimeDays", "safetyBufferDays", "calculatedDemandKg", "calculatedDemandPcs", status, "approvedBy", "approvedAt", "approvalNotes", "adjustedQtyKg", "adjustedQtyPcs", "adjustmentReason", "requestedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 4555 (class 0 OID 28794)
-- Dependencies: 252
-- Data for Name: RoyaltyInvoice; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RoyaltyInvoice" (id, "franchiseConfigId", "invoiceNo", "periodStart", "periodEnd", "grossSales", "netSales", "totalDiscounts", "totalWastage", "wastagePenalty", "pricingViolationPenalty", "compliancePenalty", "baseRoyalty", "totalRoyalty", status, "dueDate", "paidAt", "paymentReference", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 4556 (class 0 OID 28830)
-- Dependencies: 253
-- Data for Name: RoyaltyLedger; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RoyaltyLedger" (id, "franchiseConfigId", "invoiceId", type, amount, description, reference, "createdAt", "createdBy") FROM stdin;
\.


--
-- TOC entry 4531 (class 0 OID 26573)
-- Dependencies: 228
-- Data for Name: Sale; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Sale" (id, "storeId", "saleNo", "customerId", status, "subTotal", "discountTotal", "taxTotal", "grandTotal", "createdByUserId", "createdAt", "updatedAt") FROM stdin;
cmjwk24f8000cuqv789ek4id7	cmjten76p0000viumjxwes8nz	SALE-20260102-0022	\N	VOID	462.3000000000001	0	0	462.3000000000001	cmjten85j0004viumsifvy7nr	2026-01-02 07:31:23.492	2026-01-02 16:50:03.028
cmjwp93n6000c4u7et6xuxig4	cmjten76p0000viumjxwes8nz	SALE-20260102-0029	cmjwp8byu00014u7evwflgyd5	VOID	638.4	0	0	638.4	cmjten85j0004viumsifvy7nr	2026-01-02 09:56:47.155	2026-01-02 16:51:01.456
cmjwlyawc00012agplkub0p6c	cmjten76p0000viumjxwes8nz	SALE-20260102-0025	cmjwlxfnm0001ix8k6367e3p8	VOID	909.6999999999999	0	0	909.6999999999999	cmjten85j0004viumsifvy7nr	2026-01-02 08:24:24.491	2026-01-02 16:51:13.501
cmjtydti90001vlypl5tt23wa	cmjten76p0000viumjxwes8nz	SALE-20251231-0001	\N	PAID	550.4	0	27.52	577.92	cmjten85j0004viumsifvy7nr	2025-12-31 11:49:05.312	2025-12-31 11:49:06.334
cmju1utmo0001pbdjcgsftjeh	cmjten76p0000viumjxwes8nz	SALE-20251231-0002	\N	PAID	213.9	0	0	213.9	cmjten85j0004viumsifvy7nr	2025-12-31 13:26:17.471	2025-12-31 13:26:18.094
cmjv0is0p0003bkdlso3hiulz	cmjten76p0000viumjxwes8nz	SALE-20260101-0001	cmjv0ie0b0001bkdl3cb9k8f5	PAID	350.4	0	0	350.4	cmjten85j0004viumsifvy7nr	2026-01-01 05:36:42.073	2026-01-01 05:36:42.694
cmjwdozu70001wc8ntff9xxy6	cmjten76p0000viumjxwes8nz	SALE-20260102-0001	\N	PAID	297.6	0	0	297.6	cmjten85j0004viumsifvy7nr	2026-01-02 04:33:13.326	2026-01-02 04:33:14.173
cmjwdpwh00001vy0ckde98071	cmjten76p0000viumjxwes8nz	SALE-20260102-0002	\N	PAID	110.4	0	0	110.4	cmjten85j0004viumsifvy7nr	2026-01-02 04:33:55.619	2026-01-02 04:33:56.466
cmjwdutvb000ewc8nbcsv9f2l	cmjten76p0000viumjxwes8nz	SALE-20260102-0003	cmjwduttr000cwc8n3tyldczh	PAID	122.4	0	0	122.4	cmjten85j0004viumsifvy7nr	2026-01-02 04:37:45.527	2026-01-02 04:37:46.235
cmjwe1ncc0003v5hehm2yjmt5	cmjten76p0000viumjxwes8nz	SALE-20260102-0004	cmjwe1cfc0001v5henesbzwim	PAID	235.2	0	0	235.2	cmjten85j0004viumsifvy7nr	2026-01-02 04:43:03.661	2026-01-02 04:43:04.371
cmjwe3n74000310r1kc11xwh3	cmjten76p0000viumjxwes8nz	SALE-20260102-0005	cmjwe3n52000110r14w1vn32c	PAID	153.6	0	0	153.6	cmjten85j0004viumsifvy7nr	2026-01-02 04:44:36.784	2026-01-02 04:44:37.478
cmjwecsn10001q9fz2ok74dab	cmjten76p0000viumjxwes8nz	SALE-20260102-0006	\N	PAID	366.8	0	0	366.8	cmjten85j0004viumsifvy7nr	2026-01-02 04:51:43.741	2026-01-02 04:51:45.027
cmjwectns0009q9fzidqk7fry	cmjten76p0000viumjxwes8nz	SALE-20260102-0007	\N	PAID	366.8	0	0	366.8	cmjten85j0004viumsifvy7nr	2026-01-02 04:51:45.065	2026-01-02 04:51:46.249
cmjweg8ap0003vkn6pzoq8gs7	cmjten76p0000viumjxwes8nz	SALE-20260102-0008	cmjwefyhk0001vkn6wqwasgt5	PAID	348.8	0	0	348.8	cmjten85j0004viumsifvy7nr	2026-01-02 04:54:24.001	2026-01-02 04:54:24.663
cmjwehb0t0001brvkfafx2tn7	cmjten76p0000viumjxwes8nz	SALE-20260102-0009	\N	PAID	323.2	0	0	323.2	cmjten85j0004viumsifvy7nr	2026-01-02 04:55:14.188	2026-01-02 04:55:14.937
cmjwemd5s0001u38m9xb2m18j	cmjten76p0000viumjxwes8nz	SALE-20260102-0010	\N	PAID	323.2	0	0	323.2	cmjten85j0004viumsifvy7nr	2026-01-02 04:59:10.24	2026-01-02 04:59:10.966
cmjweoo3r00056ho9a5hqs347	cmjten76p0000viumjxwes8nz	SALE-20260102-0011	cmjweoj1h00016ho9oa5hvmkr	PAID	209.3	0	0	209.3	cmjten85j0004viumsifvy7nr	2026-01-02 05:00:57.735	2026-01-02 05:00:58.501
cmjweqo2t0001kgjc3tyc2jb5	cmjten76p0000viumjxwes8nz	SALE-20260102-0012	\N	PAID	248.4	0	0	248.4	cmjten85j0004viumsifvy7nr	2026-01-02 05:02:31.013	2026-01-02 05:02:32.023
cmjwg5tkh0001y12rbd9dqa4y	cmjten76p0000viumjxwes8nz	SALE-20260102-0013	\N	PAID	239.2	0	0	239.2	cmjten85j0004viumsifvy7nr	2026-01-02 05:42:17.584	2026-01-02 05:42:18.264
cmjwgagxi00015wvdvvgksty3	cmjten76p0000viumjxwes8nz	SALE-20260102-0014	\N	PAID	200	0	0	200	cmjten85j0004viumsifvy7nr	2026-01-02 05:45:54.485	2026-01-02 05:45:55.215
cmjwgd8jd0001nhq4bomk1m9s	cmjten76p0000viumjxwes8nz	SALE-20260102-0015	\N	PAID	66.7	0	0	66.7	cmjten85j0004viumsifvy7nr	2026-01-02 05:48:03.576	2026-01-02 05:48:04.356
cmjwggaxp00035t5zgq0huy4f	cmjten76p0000viumjxwes8nz	SALE-20260102-0016	cmjwgfv9v00015t5z5erb6xs8	PAID	522.4	0	0	522.4	cmjten85j0004viumsifvy7nr	2026-01-02 05:50:26.653	2026-01-02 05:50:27.396
cmjwgrsq50003g4lr5kt318dk	cmjten76p0000viumjxwes8nz	SALE-20260102-0017	cmjwgr8hk0001g4lrf5p9jhv3	PAID	305.6	0	0	305.6	cmjten85j0004viumsifvy7nr	2026-01-02 05:59:22.925	2026-01-02 05:59:23.665
cmjwh4kr000018o18g0dxojc4	cmjten76p0000viumjxwes8nz	SALE-20260102-0018	\N	PAID	497.6	0	0	497.6	cmjten85j0004viumsifvy7nr	2026-01-02 06:09:19.115	2026-01-02 06:09:19.879
cmjwh8enc0001kpvq0w0i9p7l	cmjten76p0000viumjxwes8nz	SALE-20260102-0019	\N	PAID	129.6	0	0	129.6	cmjten85j0004viumsifvy7nr	2026-01-02 06:12:17.831	2026-01-02 06:12:18.574
cmjwj56oo0001x539bhp1xfsb	cmjten76p0000viumjxwes8nz	SALE-20260102-0020	cmjwhi5rb000c8o18thh50pz7	PAID	464.6	0	0	464.6	cmjten85j0004viumsifvy7nr	2026-01-02 07:05:46.775	2026-01-02 07:05:47.647
cmjwk23qw0001uqv7qjw2xw1e	cmjten76p0000viumjxwes8nz	SALE-20260102-0021	\N	PAID	462.3000000000001	0	0	462.3000000000001	cmjten85j0004viumsifvy7nr	2026-01-02 07:31:22.615	2026-01-02 07:31:23.401
cmjwkvgcw0003xn4k7jpexbq0	cmjten76p0000viumjxwes8nz	SALE-20260102-0023	cmjwkv0us0001xn4kt4ys35nn	PAID	164.8	0	0	164.8	cmjten85j0004viumsifvy7nr	2026-01-02 07:54:11.984	2026-01-02 07:54:12.741
cmjwlyacc0003ix8k6uq6ueqv	cmjten76p0000viumjxwes8nz	SALE-20260102-0024	cmjwlxfnm0001ix8k6367e3p8	PAID	909.6999999999999	0	0	909.6999999999999	cmjten85j0004viumsifvy7nr	2026-01-02 08:24:23.772	2026-01-02 08:24:24.494
cmjwmn8eo0003bnb0grzo3pfp	cmjten76p0000viumjxwes8nz	SALE-20260102-0026	cmjwmmfmq0001bnb07gr6b2d8	PAID	123.2	0	0	123.2	cmjten85j0004viumsifvy7nr	2026-01-02 08:43:47.665	2026-01-02 08:43:48.757
cmjwnuxos0001bgd981rxwjhq	cmjten76p0000viumjxwes8nz	SALE-20260102-0027	\N	PAID	708.4	0	0	708.4	cmjten85j0004viumsifvy7nr	2026-01-02 09:17:46.635	2026-01-02 09:17:47.422
cmjwp930l00034u7e93n1g54d	cmjten76p0000viumjxwes8nz	SALE-20260102-0028	cmjwp8byu00014u7evwflgyd5	PAID	638.4	0	0	638.4	cmjten85j0004viumsifvy7nr	2026-01-02 09:56:46.341	2026-01-02 09:56:47.086
cmjwrqrtl0001d2o5o4w3zdzv	cmjten76p0000viumjxwes8nz	SALE-20260102-0030	\N	PAID	107.2	0	0	107.2	cmjten85j0004viumsifvy7nr	2026-01-02 11:06:30.872	2026-01-02 11:06:31.723
cmjwu8zqt0001ijyxwwtryla7	cmjten76p0000viumjxwes8nz	SALE-20260102-0031	\N	PAID	115	0	0	115	cmjten85j0004viumsifvy7nr	2026-01-02 12:16:40.18	2026-01-02 12:16:40.798
cmjwukqul0001qmchudmzv5hn	cmjten76p0000viumjxwes8nz	SALE-20260102-0032	\N	OPEN	212.4	0	0	212.4	cmjten85j0004viumsifvy7nr	2026-01-02 12:25:48.524	2026-01-02 12:25:48.524
cmjwukzvy0007qmchkmgvvchk	cmjten76p0000viumjxwes8nz	SALE-20260102-0033	\N	PAID	212.4	0	0	212.4	cmjten85j0004viumsifvy7nr	2026-01-02 12:26:00.238	2026-01-02 12:26:00.877
cmjwve6yn0001ehx60lgfwfy1	cmjten76p0000viumjxwes8nz	SALE-20260102-0034	\N	PAID	548.58	0	0	548.58	cmjten85j0004viumsifvy7nr	2026-01-02 12:48:42.43	2026-01-02 12:48:43.207
cmjwy56tr0001que2vy0hoql6	cmjten76p0000viumjxwes8nz	SALE-20260102-0035	\N	PAID	115	0	0	115	cmjten85j0004viumsifvy7nr	2026-01-02 14:05:41.198	2026-01-02 14:05:41.919
cmjwyfdg70001zgl0bzz5csou	cmjten76p0000viumjxwes8nz	SALE-20260102-0036	\N	PAID	713.6	0	0	713.6	cmjten85j0004viumsifvy7nr	2026-01-02 14:13:36.342	2026-01-02 14:13:37.147
cmjwygdmn00011223p5fz2ahs	cmjten76p0000viumjxwes8nz	SALE-20260102-0037	\N	PAID	306.4	0	0	306.4	cmjten85j0004viumsifvy7nr	2026-01-02 14:14:23.23	2026-01-02 14:14:24.959
cmjwyhjko000111dp1o9x8j36	cmjten76p0000viumjxwes8nz	SALE-20260102-0039	\N	PAID	189	0	0	189	cmjten85j0004viumsifvy7nr	2026-01-02 14:15:17.591	2026-01-02 14:15:18.309
cmjwyif390001h8riainec3hj	cmjten76p0000viumjxwes8nz	SALE-20260102-0040	\N	PAID	335.8	0	0	335.8	cmjten85j0004viumsifvy7nr	2026-01-02 14:15:58.437	2026-01-02 14:15:59.177
cmjwyifo40008h8riuqbcwbup	cmjten76p0000viumjxwes8nz	SALE-20260102-0041	\N	PAID	335.8	0	0	335.8	cmjten85j0004viumsifvy7nr	2026-01-02 14:15:59.188	2026-01-02 14:15:59.919
cmjwyj60x0005789lk8qcytl5	cmjten76p0000viumjxwes8nz	SALE-20260102-0042	\N	PAID	363.2	0	0	363.2	cmjten85j0004viumsifvy7nr	2026-01-02 14:16:33.346	2026-01-02 14:16:34.094
cmjwyk3re000czgl0or6sbrxv	cmjten76p0000viumjxwes8nz	SALE-20260102-0043	\N	PAID	161.6	0	0	161.6	cmjten85j0004viumsifvy7nr	2026-01-02 14:17:17.066	2026-01-02 14:17:17.785
cmjwyl0hc000g789l0y6pbhbm	cmjten76p0000viumjxwes8nz	SALE-20260102-0044	\N	PAID	232	0	0	232	cmjten85j0004viumsifvy7nr	2026-01-02 14:17:59.473	2026-01-02 14:18:00.265
cmjwyly4w0001ghnx2kjf3spu	cmjten76p0000viumjxwes8nz	SALE-20260102-0045	\N	PAID	107.2	0	0	107.2	cmjten85j0004viumsifvy7nr	2026-01-02 14:18:43.087	2026-01-02 14:18:43.832
cmjwygf6w000c1223jyng958z	cmjten76p0000viumjxwes8nz	SALE-20260102-0038	\N	VOID	306.4	0	0	306.4	cmjten85j0004viumsifvy7nr	2026-01-02 14:14:25.256	2026-01-02 16:50:23.287
cmjxunzb40001x98qkttcxnn5	cmjten76p0000viumjxwes8nz	SALE-20260103-0001	\N	PAID	488	0	0	488	cmjten85j0004viumsifvy7nr	2026-01-03 05:16:05.631	2026-01-03 05:16:06.363
cmjxuo05r000cx98qaww0nb4i	cmjten76p0000viumjxwes8nz	SALE-20260103-0002	\N	VOID	488	0	0	488	cmjten85j0004viumsifvy7nr	2026-01-03 05:16:06.735	2026-01-03 05:16:36.084
cmjxuptxv0003pyan5k3mdpvs	cmjten76p0000viumjxwes8nz	SALE-20260103-0003	cmjxupmr70001pyanch0xlbtj	PAID	227.7	0	0	227.7	cmjten85j0004viumsifvy7nr	2026-01-03 05:17:31.987	2026-01-03 05:17:32.749
cmjxuqpqd0001n7sibs1zligj	cmjten76p0000viumjxwes8nz	SALE-20260103-0004	\N	PAID	232.3	0	0	232.3	cmjten85j0004viumsifvy7nr	2026-01-03 05:18:13.189	2026-01-03 05:18:13.935
cmjxv3anu00036gz5itmjtlg8	cmjten76p0000viumjxwes8nz	SALE-20260103-0005	cmjxv33qd00016gz5w0s3rv77	PAID	181.8	0	0	181.8	cmjten85j0004viumsifvy7nr	2026-01-03 05:28:00.187	2026-01-03 05:28:00.975
cmjxwaopx0003lloenhz1f7mx	cmjten76p0000viumjxwes8nz	SALE-20260103-0006	cmjxwairm0001lloe4v7hcig7	PAID	268.2	0	0	268.2	cmjten85j0004viumsifvy7nr	2026-01-03 06:01:44.613	2026-01-03 06:01:45.34
cmjxwd1ww0001315ne4ephaip	cmjten76p0000viumjxwes8nz	SALE-20260103-0007	\N	PAID	190.9	0	0	190.9	cmjten85j0004viumsifvy7nr	2026-01-03 06:03:35.023	2026-01-03 06:03:35.736
cmjxwh62b000391pws06r9y46	cmjten76p0000viumjxwes8nz	SALE-20260103-0008	cmjxwh1r1000191pwxxom2ocw	PAID	232	0	0	232	cmjten85j0004viumsifvy7nr	2026-01-03 06:06:47.027	2026-01-03 06:06:47.73
cmjxwj36i000i91pwdf92tmcb	cmjten76p0000viumjxwes8nz	SALE-20260103-0009	cmjxwikld000g91pw3vgo6y14	PAID	195.2	0	0	195.2	cmjten85j0004viumsifvy7nr	2026-01-03 06:08:16.602	2026-01-03 06:08:17.337
cmjxwtkkl0001106oy4khruja	cmjten76p0000viumjxwes8nz	SALE-20260103-0010	cmjxwqpcf0001126mg2m4c2fj	PAID	257.6	0	0	257.6	cmjten85j0004viumsifvy7nr	2026-01-03 06:16:25.7	2026-01-03 06:16:26.527
cmjxwyozz000853b04sal1ua9	cmjten76p0000viumjxwes8nz	SALE-20260103-0011	\N	PAID	211.2	0	0	211.2	cmjten85j0004viumsifvy7nr	2026-01-03 06:20:24.719	2026-01-03 06:20:25.497
cmjxx6p2g0007xek6yxbb8fr8	cmjten76p0000viumjxwes8nz	SALE-20260103-0013	\N	PAID	180	0	0	180	cmjten85j0004viumsifvy7nr	2026-01-03 06:26:38.056	2026-01-03 06:26:38.769
cmjxxj1z90001oqvxouy9fk30	cmjten76p0000viumjxwes8nz	SALE-20260103-0014	\N	PAID	3918.2	587.73	0	3330.47	cmjten85j0004viumsifvy7nr	2026-01-03 06:36:14.66	2026-01-03 06:54:39.49
cmjxxyff40003y10j5d0h79wy	cmjten76p0000viumjxwes8nz	SALE-20260103-0015	\N	PAID	214.4	0	0	214.4	cmjten85j0004viumsifvy7nr	2026-01-03 06:48:11.921	2026-01-03 06:48:12.715
cmjxy5jmo0005qftpuxrs6nkd	cmjten76p0000viumjxwes8nz	SALE-20260103-0016	cmjxy57pz0005oknom0z91dra	PAID	96.6	0	0	96.6	cmjten85j0004viumsifvy7nr	2026-01-03 06:53:43.968	2026-01-03 06:53:44.661
cmjxx6grt0001xek6j1wcp9uh	cmjten76p0000viumjxwes8nz	SALE-20260103-0012	\N	VOID	180	0	0	180	cmjten85j0004viumsifvy7nr	2026-01-03 06:26:27.304	2026-01-03 06:54:33.867
cmjy1ijjb000aem7g6xkty3tk	cmjten76p0000viumjxwes8nz	SALE-20260103-0018	\N	PAID	681.44	0	0	681.44	cmjten85j0004viumsifvy7nr	2026-01-03 08:27:49.223	2026-01-03 08:27:49.866
cmjy1klo7000oem7gb41bco4c	cmjten76p0000viumjxwes8nz	SALE-20260103-0019	\N	PAID	332.16	0	0	332.16	cmjten85j0004viumsifvy7nr	2026-01-03 08:29:25.303	2026-01-03 08:29:26.799
cmjy1mtqj0001126fd3gpnlht	cmjten76p0000viumjxwes8nz	SALE-20260103-0020	\N	PAID	200.96	0	0	200.96	cmjten85j0004viumsifvy7nr	2026-01-03 08:31:09.066	2026-01-03 08:31:09.77
cmjy20zvk0001s9jx11ht8tlc	cmjten76p0000viumjxwes8nz	SALE-20260103-0021	\N	VOID	90	0	0	90	cmjten85j0004viumsifvy7nr	2026-01-03 08:42:10.208	2026-01-03 08:42:40.894
cmjy1ihp60001em7gt7gq2xt1	cmjten76p0000viumjxwes8nz	SALE-20260103-0017	\N	PAID	90	0	0	90	cmjten85j0004viumsifvy7nr	2026-01-03 08:27:46.842	2026-01-03 11:15:48.09
cmjy78osu0001n4uldievaw5q	cmjten76p0000viumjxwes8nz	SALE-20260103-0022	\N	OPEN	460	0	0	460	cmjten85j0004viumsifvy7nr	2026-01-03 11:08:07.182	2026-01-03 11:08:07.21
cmjy7erum0001lfgf23vt4oca	cmjten76p0000viumjxwes8nz	SALE-20260103-0023	cmjuw914m0001oqc3o2xh0386	OPEN	90	0	0	90	cmjten85j0004viumsifvy7nr	2026-01-03 11:12:51.07	2026-01-03 11:12:51.099
cmjy7lvgm0001tzayedhhot63	cmjten76p0000viumjxwes8nz	SALE-20260103-0024	\N	OPEN	200	0	0	200	cmjten85j0004viumsifvy7nr	2026-01-03 11:18:22.342	2026-01-03 11:18:24.431
cmk0zd27r0001mjoteb2t5b9r	cmjten76p0000viumjxwes8nz	SALE-20260105-0001	\N	PAID	160	0	0	160	cmjten85j0004viumsifvy7nr	2026-01-05 09:50:52.79	2026-01-05 09:50:52.837
cmk16g1eg0005nl1w1keh82lw	cmjten7ko0002viumzdic2lbf	SALE-20260105-0001	cmjuw914m0001oqc3o2xh0386	PAID	90	0	0	90	cmjten8jh0006vium78ek3p0s	2026-01-05 13:09:09.016	2026-01-05 13:09:09.043
cmk16ggl1000inl1wzh22gjtb	cmjten7ko0002viumzdic2lbf	SALE-20260105-0002	cmjuw914m0001oqc3o2xh0386	OPEN	920	0	0	920	cmjten8jh0006vium78ek3p0s	2026-01-05 13:09:28.693	2026-01-05 13:0pg_dump: processing data for table "public.SaleItem"
pg_dump: dumping contents of table "public.SaleItem"
9:28.71
cmk16gtfd000vnl1wkb7p37fu	cmjten7ko0002viumzdic2lbf	SALE-20260105-0003	cmjuw914m0001oqc3o2xh0386	OPEN	800	0	0	800	cmjten8jh0006vium78ek3p0s	2026-01-05 13:09:45.337	2026-01-05 13:09:45.359
\.


--
-- TOC entry 4532 (class 0 OID 26597)
-- Dependencies: 229
-- Data for Name: SaleItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SaleItem" (id, "saleId", "productId", "qtyKg", "qtyPcs", rate, "lineTotal", "taxRate", "taxAmount", "metaJson", "createdAt") FROM stdin;
cmjtydti90003vlypg1kqh2ij	cmjtydti90001vlypl5tt23wa	cmjten9z3000iviumzzz362v3	1.72	\N	320	550.4	5	27.52	\N	2025-12-31 11:49:05.312
cmju1utmo0003pbdjefiezyhh	cmju1utmo0001pbdjcgsftjeh	cmjtfyk5i0005mw9vji8icng4	0.465	\N	460	213.9	0	0	\N	2025-12-31 13:26:17.471
cmjv0is0p0005bkdldg9f7mn5	cmjv0is0p0003bkdlso3hiulz	cmjten9z3000iviumzzz362v3	1.095	\N	320	350.4	0	0	{"sku": "00001", "manualEntry": true}	2026-01-01 05:36:42.073
cmjwdozu70003wc8nfm6ul3pr	cmjwdozu70001wc8ntff9xxy6	cmjten9z3000iviumzzz362v3	0.93	\N	320	297.6	0	0	{"sku": "00001", "manualEntry": true}	2026-01-02 04:33:13.326
cmjwdpwh00003vy0crxa4lm7o	cmjwdpwh00001vy0ckde98071	cmjtfyk5i0005mw9vji8icng4	0.24	\N	460	110.4	0	0	{"sku": "00002", "manualEntry": true}	2026-01-02 04:33:55.619
cmjwdutvb000gwc8nhhq7gaxp	cmjwdutvb000ewc8nbcsv9f2l	cmjtfyl260009mw9vktuvk4rd	0.34	\N	360	122.4	0	0	{"sku": "00003", "manualEntry": true}	2026-01-02 04:37:45.527
cmjwe1ncc0005v5hepz71iayo	cmjwe1ncc0003v5hehm2yjmt5	cmjten9z3000iviumzzz362v3	0.735	\N	320	235.2	0	0	{"sku": "00001", "manualEntry": true}	2026-01-02 04:43:03.661
cmjwe3n74000510r1b0jgg3pp	cmjwe3n74000310r1kc11xwh3	cmjten9z3000iviumzzz362v3	0.48	\N	320	153.6	0	0	{"sku": "00001", "manualEntry": true}	2026-01-02 04:44:36.784
cmjwecsn20003q9fz77rj1g7b	cmjwecsn10001q9fz2ok74dab	cmjten9z3000iviumzzz362v3	1	\N	320	320	0	0	{"sku": "00001", "manualEntry": true}	2026-01-02 04:51:43.741
cmjwecsn20004q9fz5wqkheeg	cmjwecsn10001q9fz2ok74dab	cmjtfynix000pmw9vh4n9s2l9	0.52	\N	90	46.8	0	0	{"sku": "00007", "manualEntry": true}	2026-01-02 04:51:43.741
cmjwectnt000bq9fzmzir4caq	cmjwectns0009q9fzidqk7fry	cmjten9z3000iviumzzz362v3	1	\N	320	320	0	0	{"sku": "00001", "manualEntry": true}	2026-01-02 04:51:45.065
cmjwectnt000cq9fzatkvv8ct	cmjwectns0009q9fzidqk7fry	cmjtfynix000pmw9vh4n9s2l9	0.52	\N	90	46.8	0	0	{"sku": "00007", "manualEntry": true}	2026-01-02 04:51:45.065
cmjweg8ap0005vkn6jd3k7ece	cmjweg8ap0003vkn6pzoq8gs7	cmjten9z3000iviumzzz362v3	1.09	\N	320	348.8	0	0	{"sku": "00001", "manualEntry": true}	2026-01-02 04:54:24.001
cmjwehb0t0003brvk6pwbkzk5	cmjwehb0t0001brvkfafx2tn7	cmjten9z3000iviumzzz362v3	1.01	\N	320	323.2	0	0	{"sku": "00001", "manualEntry": true}	2026-01-02 04:55:14.188
cmjwemd5t0003u38mqkghh3ce	cmjwemd5s0001u38m9xb2m18j	cmjten9z3000iviumzzz362v3	1.01	\N	320	323.2	0	0	{"sku": "00001", "manualEntry": true}	2026-01-02 04:59:10.24
cmjweoo3r00076ho9axl9p5ry	cmjweoo3r00056ho9a5hqs347	cmjtfyk5i0005mw9vji8icng4	0.455	\N	460	209.3	0	0	{"sku": "00002", "manualEntry": true}	2026-01-02 05:00:57.735
cmjweqo2u0003kgjcyoeifb17	cmjweqo2t0001kgjc3tyc2jb5	cmjtfyk5i0005mw9vji8icng4	0.54	\N	460	248.4	0	0	{"sku": "00002", "manualEntry": true}	2026-01-02 05:02:31.013
cmjwg5tkh0003y12rrdor8cv0	cmjwg5tkh0001y12rbd9dqa4y	cmjtfyk5i0005mw9vji8icng4	0.52	\N	460	239.2	0	0	\N	2026-01-02 05:42:17.584
cmjwgagxi00035wvdcyichoal	cmjwgagxi00015wvdvvgksty3	cmjten9z3000iviumzzz362v3	0.625	\N	320	200	0	0	\N	2026-01-02 05:45:54.485
cmjwgd8jd0003nhq46sec94d1	cmjwgd8jd0001nhq4bomk1m9s	cmjtfyk5i0005mw9vji8icng4	0.145	\N	460	66.7	0	0	\N	2026-01-02 05:48:03.576
cmjwggaxp00055t5zwnsqg7ly	cmjwggaxp00035t5zgq0huy4f	cmjtfyo4s000tmw9v1cceq7rv	\N	2	90	180	0	0	{"sku": "00008", "manualEntry": true}	2026-01-02 05:50:26.653
cmjwggaxp00065t5zclpoln0r	cmjwggaxp00035t5zgq0huy4f	cmjten9z3000iviumzzz362v3	1.07	\N	320	342.4	0	0	\N	2026-01-02 05:50:26.653
cmjwgrsq50005g4lrps55tlj6	cmjwgrsq50003g4lr5kt318dk	cmjtfymb5000hmw9vlsdpz75l	0.16	\N	400	64	0	0	\N	2026-01-02 05:59:22.925
cmjwgrsq50006g4lrk2fec9zl	cmjwgrsq50003g4lr5kt318dk	cmjten9z3000iviumzzz362v3	0.755	\N	320	241.6	0	0	\N	2026-01-02 05:59:22.925
cmjwh4kr000038o18wdb64tkx	cmjwh4kr000018o18g0dxojc4	cmjten9z3000iviumzzz362v3	1.555	\N	320	497.6	0	0	\N	2026-01-02 06:09:19.115
cmjwh8enc0003kpvq213lc30a	cmjwh8enc0001kpvq0w0i9p7l	cmjten9z3000iviumzzz362v3	0.405	\N	320	129.6	0	0	\N	2026-01-02 06:12:17.831
cmjwj56oo0003x5391mita2nl	cmjwj56oo0001x539bhp1xfsb	cmjtfyk5i0005mw9vji8icng4	1.01	\N	460	464.6	0	0	\N	2026-01-02 07:05:46.775
cmjwk23qw0003uqv7gor0i9wm	cmjwk23qw0001uqv7qjw2xw1e	cmjtfyk5i0005mw9vji8icng4	1.005	\N	460	462.3000000000001	0	0	\N	2026-01-02 07:31:22.615
cmjwk24f8000euqv71w8cqh24	cmjwk24f8000cuqv789ek4id7	cmjtfyk5i0005mw9vji8icng4	1.005	\N	460	462.3000000000001	0	0	\N	2026-01-02 07:31:23.492
cmjwkvgcw0005xn4k1uiqgftc	cmjwkvgcw0003xn4k7jpexbq0	cmjten9z3000iviumzzz362v3	0.515	\N	320	164.8	0	0	\N	2026-01-02 07:54:11.984
cmjwlyacc0005ix8ki0ttm0th	cmjwlyacc0003ix8k6uq6ueqv	cmjtfyl260009mw9vktuvk4rd	0.54	\N	360	194.4	0	0	\N	2026-01-02 08:24:23.772
cmjwlyacc0006ix8kaf0kwrw8	cmjwlyacc0003ix8k6uq6ueqv	cmjtfyk5i0005mw9vji8icng4	1.555	\N	460	715.3	0	0	\N	2026-01-02 08:24:23.772
cmjwlyawc00032agp5ok106fy	cmjwlyawc00012agplkub0p6c	cmjtfyl260009mw9vktuvk4rd	0.54	\N	360	194.4	0	0	\N	2026-01-02 08:24:24.491
cmjwlyawc00042agpa41bjosn	cmjwlyawc00012agplkub0p6c	cmjtfyk5i0005mw9vji8icng4	1.555	\N	460	715.3	0	0	\N	2026-01-02 08:24:24.491
cmjwmn8eo0005bnb0x8kyn5mp	cmjwmn8eo0003bnb0grzo3pfp	cmjten9z3000iviumzzz362v3	0.385	\N	320	123.2	0	0	\N	2026-01-02 08:43:47.665
cmjwnuxos0003bgd9hh3yip3u	cmjwnuxos0001bgd981rxwjhq	cmjtfyk5i0005mw9vji8icng4	1.54	\N	460	708.4	0	0	\N	2026-01-02 09:17:46.635
cmjwp930l00054u7eynfh2f8z	cmjwp930l00034u7e93n1g54d	cmjten9z3000iviumzzz362v3	1.995	\N	320	638.4	0	0	\N	2026-01-02 09:56:46.341
cmjwp93n6000e4u7epkjw6evf	cmjwp93n6000c4u7et6xuxig4	cmjten9z3000iviumzzz362v3	1.995	\N	320	638.4	0	0	\N	2026-01-02 09:56:47.155
cmjwrqrtl0003d2o5bfr15r3s	cmjwrqrtl0001d2o5o4w3zdzv	cmjten9z3000iviumzzz362v3	0.335	\N	320	107.2	0	0	{"sku": "00001", "manualEntry": true}	2026-01-02 11:06:30.872
cmjwu8zqt0003ijyx2zdoedb3	cmjwu8zqt0001ijyxwwtryla7	cmjtfyk5i0005mw9vji8icng4	0.25	\N	460	115	0	0	{"sku": "00002", "manualEntry": true}	2026-01-02 12:16:40.18
cmjwukqul0003qmch8nj0z9z3	cmjwukqul0001qmchudmzv5hn	cmjtfyl260009mw9vktuvk4rd	0.59	\N	360	212.4	0	0	{"sku": "00003", "manualEntry": true}	2026-01-02 12:25:48.524
cmjwukzvy0009qmch4tiavrr4	cmjwukzvy0007qmchkmgvvchk	cmjtfyl260009mw9vktuvk4rd	0.59	\N	360	212.4	0	0	{"sku": "00003", "manualEntry": true}	2026-01-02 12:26:00.238
cmjwve6yn0003ehx6c6b6vb3v	cmjwve6yn0001ehx60lgfwfy1	cmjten9z3000iviumzzz362v3	2.23	\N	246	548.58	0	0	{"sku": "00001", "manualEntry": true}	2026-01-02 12:48:42.43
cmjwy56tr0003que24p9rcnxk	cmjwy56tr0001que2vy0hoql6	cmjtfyk5i0005mw9vji8icng4	0.25	\N	460	115	0	0	{"sku": "00002", "manualEntry": true}	2026-01-02 14:05:41.198
cmjwyfdg70003zgl0ynxnlom5	cmjwyfdg70001zgl0bzz5csou	cmjten9z3000iviumzzz362v3	2.23	\N	320	713.6	0	0	{"sku": "00001", "manualEntry": true}	2026-01-02 14:13:36.342
cmjwygdmn00031223xr59xsha	cmjwygdmn00011223p5fz2ahs	cmjtfymx1000lmw9v6odxz662	1.915	\N	160	306.4	0	0	{"sku": "00006", "manualEntry": true}	2026-01-02 14:14:23.23
cmjwygf6w000e1223wvgc2bq2	cmjwygf6w000c1223jyng958z	cmjtfymx1000lmw9v6odxz662	1.915	\N	160	306.4	0	0	{"sku": "00006", "manualEntry": true}	2026-01-02 14:14:25.256
cmjwyhjko000311dpsiecorah	cmjwyhjko000111dp1o9x8j36	cmjtfynix000pmw9vh4n9s2l9	2.1	\N	90	189	0	0	{"sku": "00007", "manualEntry": true}	2026-01-02 14:15:17.591
cmjwyif390003h8rici6593me	cmjwyif390001h8riainec3hj	cmjtfyk5i0005mw9vji8icng4	0.73	\N	460	335.8	0	0	{"sku": "00002", "manualEntry": true}	2026-01-02 14:15:58.437
cmjwyifo4000ah8ri1o814f94	cmjwyifo40008h8riuqbcwbup	cmjtfyk5i0005mw9vji8icng4	0.73	\N	460	335.8	0	0	{"sku": "00002", "manualEntry": true}	2026-01-02 14:15:59.188
cmjwyj60x0007789ldls71s7x	cmjwyj60x0005789lk8qcytl5	cmjten9z3000iviumzzz362v3	1.135	\N	320	363.2	0	0	{"sku": "00001", "manualEntry": true}	2026-01-02 14:16:33.346
cmjwyk3re000ezgl04ahrwwjh	cmjwyk3re000czgl0or6sbrxv	cmjten9z3000iviumzzz362v3	0.505	\N	320	161.6	0	0	{"sku": "00001", "manualEntry": true}	2026-01-02 14:17:17.066
cmjwyl0hc000i789lva62otab	cmjwyl0hc000g789l0y6pbhbm	cmjten9z3000iviumzzz362v3	0.725	\N	320	232	0	0	{"sku": "00001", "manualEntry": true}	2026-01-02 14:17:59.473
cmjwyly4w0003ghnxbohfvea3	cmjwyly4w0001ghnx2kjf3spu	cmjten9z3000iviumzzz362v3	0.335	\N	320	107.2	0	0	{"sku": "00001", "manualEntry": true}	2026-01-02 14:18:43.087
cmjxunzb40003x98qkxn98ego	cmjxunzb40001x98qkttcxnn5	cmjten9z3000iviumzzz362v3	1.525	\N	320	488	0	0	{"sku": "00001", "manualEntry": true}	2026-01-03 05:16:05.631
cmjxuo05r000ex98qywg9sare	cmjxuo05r000cx98qaww0nb4i	cmjten9z3000iviumzzz362v3	1.525	\N	320	488	0	0	{"sku": "00001", "manualEntry": true}	2026-01-03 05:16:06.735
cmjxuptxv0005pyansfrnn48u	cmjxuptxv0003pyan5k3mdpvs	cmjtfyk5i0005mw9vji8icng4	0.495	\N	460	227.7	0	0	{"sku": "00002", "manualEntry": true}	2026-01-03 05:17:31.987
cmjxuqpqd0003n7sirqhe7jtc	cmjxuqpqd0001n7sibs1zligj	cmjtfyk5i0005mw9vji8icng4	0.505	\N	460	232.3	0	0	{"sku": "00002", "manualEntry": true}	2026-01-03 05:18:13.189
cmjxv3anu00056gz51yqfvxwl	cmjxv3anu00036gz5itmjtlg8	cmjtfynix000pmw9vh4n9s2l9	2.02	\N	90	181.8	0	0	{"sku": "00007", "manualEntry": true}	2026-01-03 05:28:00.187
cmjxwaopx0005lloegpkdl7oc	cmjxwaopx0003lloenhz1f7mx	cmjtfyl260009mw9vktuvk4rd	0.745	\N	360	268.2	0	0	{"sku": "00003", "manualEntry": true}	2026-01-03 06:01:44.613
cmjxwd1ww0003315n3w1vz41x	cmjxwd1ww0001315ne4ephaip	cmjtfyk5i0005mw9vji8icng4	0.415	\N	460	190.9	0	0	{"sku": "00002", "manualEntry": true}	2026-01-03 06:03:35.023
cmjxwh62b000591pwxveavtq9	cmjxwh62b000391pws06r9y46	cmjten9z3000iviumzzz362v3	0.725	\N	320	232	0	0	{"sku": "00001", "manualEntry": true}	2026-01-03 06:06:47.027
cmjxwj36i000k91pw86m27b8y	cmjxwj36i000i91pwdf92tmcb	cmjten9z3000iviumzzz362v3	0.61	\N	320	195.2	0	0	{"sku": "00001", "manualEntry": true}	2026-01-03 06:08:16.602
cmjxwtkkl0003106ozte7hi8z	cmjxwtkkl0001106oy4khruja	cmjten9z3000iviumzzz362v3	0.805	\N	320	257.6	0	0	{"sku": "00001", "manualEntry": true}	2026-01-03 06:16:25.7
cmjxwyozz000a53b0zducmj22	cmjxwyozz000853b04sal1ua9	cmjten9z3000iviumzzz362v3	0.66	\N	320	211.2	0	0	{"sku": "00001", "manualEntry": true}	2026-01-03 06:20:24.719
cmjxx6grt0003xek6un31jv86	cmjxx6grt0001xek6j1wcp9uh	cmjtfynix000pmw9vh4n9s2l9	2	\N	90	180	0	0	{"sku": "00007", "manualEntry": true}	2026-01-03 06:26:27.304
cmjxx6p2g0009xek6h1coiydw	cmjxx6p2g0007xek6yxbb8fr8	cmjtfynix000pmw9vh4n9s2l9	2	\N	90	180	0	0	{"sku": "00007", "manualEntry": true}	2026-01-03 06:26:38.056
cmjxxv8ij000014maa9e6lp2s	cmjxxj1z90001oqvxouy9fk30	cmjten9z3000iviumzzz362v3	10.6	\N	290	3074	0	0	\N	2026-01-03 06:45:43.004
cmjxxv8ik000114mag35nv9fx	cmjxxj1z90001oqvxouy9fk30	cmjtfyk5i0005mw9vji8icng4	2.01	\N	420	844.1999999999999	0	0	\N	2026-01-03 06:45:43.004
cmjxxyff40005y10jhcssmlt2	cmjxxyff40003y10j5d0h79wy	cmjten9z3000iviumzzz362v3	0.67	\N	320	214.4	0	0	{"sku": "00001", "manualEntry": true}	2026-01-03 06:48:11.921
cmjxy5jmo0007qftpuby355m7	cmjxy5jmo0005qftpuxrs6nkd	cmjtfyk5i0005mw9vji8icng4	0.21	\N	460	96.6	0	0	{"sku": "00002", "manualEntry": true}	2026-01-03 06:53:43.968
cmjy1ihp60003em7gxd15e8sg	cmjy1ihp60001em7gt7gq2xt1	cmjtfyo4s000tmw9v1cceq7rv	\N	1	90	90	0	0	{"sku": "00008", "manualEntry": true}	2026-01-03 08:27:46.842
cmjy1ijjb000cem7gy6cuj6r1	cmjy1ijjb000aem7g6xkty3tk	cmjtfylpc000dmw9vtbj4su00	0.774	\N	400	309.6	0	0	{"sku": "00004", "manualEntry": true}	2026-01-03 08:27:49.223
cmjy1ijjb000dem7gtv7np3sa	cmjy1ijjb000aem7g6xkty3tk	cmjten9z3000iviumzzz362v3	1.162	\N	320	371.84	0	0	{"sku": "00001", "manualEntry": true}	2026-01-03 08:27:49.223
cmjy1klo7000qem7g3cl2ip3v	cmjy1klo7000oem7gb41bco4c	cmjten9z3000iviumzzz362v3	0.788	\N	320	252.16	0	0	{"sku": "00001", "manualEntry": true}	2026-01-03 08:29:25.303
cmjy1klo7000rem7go712hh1p	cmjy1klo7000oem7gb41bco4c	cmjtfymx1000lmw9v6odxz662	0.5	\N	160	80	0	0	{"sku": "00006", "manualEntry": true}	2026-01-03 08:29:25.303
cmjy1mtqj0003126f0auua19p	cmjy1mtqj0001126fd3gpnlht	cmjten9z3000iviumzzz362v3	0.628	\N	320	200.96	0	0	{"sku": "00001", "manualEntry": true}	2026-01-03 08:31:09.066
cmjy20zvl0003s9jxvylag83s	cmjy20zvk0001s9jx11ht8tlc	cmjtfyo4s000tmw9v1cceq7rv	\N	1	90	90	0	0	{"sku": "00008", "manualEntry": true}	2026-01-03 08:42:10.208
cmjy7pg_dump: processing data for table "public.ScaleBarcodeConfig"
pg_dump: dumping contents of table "public.ScaleBarcodeConfig"
pg_dump: processing data for table "public.Shift"
pg_dump: dumping contents of table "public.Shift"
pg_dump: processing data for table "public.StockAllocation"
pg_dump: dumping contents of table "public.StockAllocation"
pg_dump: processing data for table "public.Store"
pg_dump: dumping contents of table "public.Store"
pg_dump: processing data for table "public.StoreProductPrice"
pg_dump: dumping contents of table "public.StoreProductPrice"
8osu0003n4ulz1im7k8m	cmjy78osu0001n4uldievaw5q	cmjtfyk5i0005mw9vji8icng4	1	\N	460	460	0	0	{"sku": "00002", "manualEntry": true}	2026-01-03 11:08:07.182
cmjy7erum0003lfgf8tj1t3cq	cmjy7erum0001lfgf23vt4oca	cmjtfyo4s000tmw9v1cceq7rv	\N	1	90	90	0	0	{"sku": "00008", "manualEntry": true}	2026-01-03 11:12:51.07
cmjy7lvgm0003tzay2quvp7jm	cmjy7lvgm0001tzayedhhot63	cmjtenb6i000ovium4ep6cvrl	\N	2	100	200	0	0	\N	2026-01-03 11:18:22.342
cmk0zd27r0003mjotdu1z2akd	cmk0zd27r0001mjoteb2t5b9r	cmjtfyoqo000xmw9vj7evt5dp	1	\N	160	160	0	0	{"sku": "00009", "manualEntry": true}	2026-01-05 09:50:52.79
cmk16g1eg0007nl1w5bq6dka2	cmk16g1eg0005nl1w1keh82lw	cmjtfyo4s000tmw9v1cceq7rv	\N	1	90	90	0	0	{"sku": "00008", "manualEntry": true}	2026-01-05 13:09:09.016
cmk16ggl1000knl1w3bixngkd	cmk16ggl1000inl1wzh22gjtb	cmjtfyk5i0005mw9vji8icng4	2	\N	460	920	0	0	{"sku": "00002", "manualEntry": true}	2026-01-05 13:09:28.693
cmk16gtfd000xnl1wxy87lvz1	cmk16gtfd000vnl1wkb7p37fu	cmjtfylpc000dmw9vtbj4su00	2	\N	400	800	0	0	{"sku": "00004", "manualEntry": true}	2026-01-05 13:09:45.337
\.


--
-- TOC entry 4535 (class 0 OID 26645)
-- Dependencies: 232
-- Data for Name: ScaleBarcodeConfig; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ScaleBarcodeConfig" (id, "storeId", name, prefix, "pluStart", "pluLength", "weightStart", "weightLength", "weightDecimal", "priceStart", "priceLength", "priceDecimal", "checksumType", "isActive", "createdAt", "updatedAt") FROM stdin;
cmjtfypjt0011mw9vtc58nqnj	cmjten76p0000viumjxwes8nz	Machine Barcode Format	20	0	5	0	0	2	5	5	2	NONE	t	2025-12-31 03:13:27.257	2025-12-31 03:13:27.257
\.


--
-- TOC entry 4534 (class 0 OID 26628)
-- Dependencies: 231
-- Data for Name: Shift; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Shift" (id, "storeId", "openedAt", "closedAt", "createdAt", "updatedAt", "closedByUserId", "closingCash", notes, "openedByUserId", "openingCash") FROM stdin;
\.


--
-- TOC entry 4554 (class 0 OID 28775)
-- Dependencies: 251
-- Data for Name: StockAllocation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StockAllocation" (id, "ownerStoreId", "centralPOId", "inwardStockId", "franchiseStoreId", "productId", "allocatedQtyKg", "allocatedQtyPcs", "allocatedAt", "dispatchedAt", "receivedAt", status, notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 4523 (class 0 OID 26443)
-- Dependencies: 220
-- Data for Name: Store; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Store" (id, name, type, "parentOwnerStoreId", "createdAt", "updatedAt") FROM stdin;
cmjten76p0000viumjxwes8nz	Main Owner Store	OWNER	\N	2025-12-31 02:36:30.626	2025-12-31 02:36:30.626
cmjten7ko0002viumzdic2lbf	Franchise Store 1	FRANCHISE	cmjten76p0000viumjxwes8nz	2025-12-31 02:36:31.128	2025-12-31 02:36:31.128
\.


--
-- TOC entry 4529 (class 0 OID 26541)
-- Dependencies: 226
-- Data for Name: StoreProductPrice; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StoreProductPrice" (id, "storeId", "productId", "pricePerUnit", "effectiveFrom", "isActive", "createdAt", "updatedAt") FROM stdin;
cmjtenazk000mvium3k8o7yqf	cmjten7ko0002viumzdic2lbf	cmjten9z3000iviumzzz362v3	500	2025-12-31 02:36:35.307	t	2025-12-31 02:36:35.307	2025-12-31 02:36:35.307
cmjtenbdf000qvium22nk02re	cmjten76p0000viumjxwes8nz	cmjtenb6i000ovium4ep6cvrl	200	2025-12-31 02:36:36.051	t	2025-12-31 02:36:36.051	2025-12-31 02:36:36.051
cmjtenbkc000sviumn2j00a0a	cmjten7ko0002viumzdic2lbf	cmjtenb6i000ovium4ep6cvrl	220	2025-12-31 02:36:36.301	t	2025-12-31 02:36:36.301	2025-12-31 02:36:36.301
cmjtend5u0018viumw1137435	cmjten76p0000viumjxwes8nz	cmjtencyx0016vium42mf2yap	200	2025-12-31 02:36:38.37	t	2025-12-31 02:36:38.37	2025-12-31 02:36:38.37
cmjtendcq001aviumy389tzoa	cmjten7ko0002viumzdic2lbf	cmjtencyx0016vium42mf2yap	220	2025-12-31 02:36:38.618	t	2025-12-31 02:36:38.618	2025-12-31 02:36:38.618
cmjtenebl001kviumurgel4k9	cmjten76p0000viumjxwes8nz	cmjtene4f001ivium9eb2uuy8	5	2025-12-31 02:36:39.873	t	2025-12-31 02:36:39.873	2025-12-31 02:36:39.873
cmjteneij001mviumub8zwntv	cmjten7ko0002viumzdic2lbf	cmjtene4f001ivium9eb2uuy8	6	2025-12-31 02:3pg_dump: processing data for table "public.Supplier"
pg_dump: dumping contents of table "public.Supplier"
pg_dump: processing data for table "public.SyncEvent"
pg_dump: dumping contents of table "public.SyncEvent"
pg_dump: processing data for table "public.User"
pg_dump: dumping contents of table "public.User"
6:40.123	t	2025-12-31 02:36:40.123	2025-12-31 02:36:40.123
cmjtenaex000kvium940vxpbi	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	500	2025-12-31 02:36:34.809	f	2025-12-31 02:36:34.809	2025-12-31 03:13:18.918
cmjtfyjjl0003mw9v8r92ieke	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	320	2025-12-31 03:13:19.474	f	2025-12-31 03:13:19.474	2025-12-31 03:16:01.83
cmjtg2194000112attqlnj565	cmjten76p0000viumjxwes8nz	cmjten9z3000iviumzzz362v3	320	2025-12-31 03:16:02.392	t	2025-12-31 03:16:02.392	2025-12-31 03:16:02.392
cmjtfyknl0007mw9vmog1p7di	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	460	2025-12-31 03:13:20.913	f	2025-12-31 03:13:20.913	2025-12-31 03:16:03.825
cmjtg22lg000312atwco05dfw	cmjten76p0000viumjxwes8nz	cmjtfyk5i0005mw9vji8icng4	460	2025-12-31 03:16:04.133	t	2025-12-31 03:16:04.133	2025-12-31 03:16:04.133
cmjtfyl9k000bmw9vqe323o88	cmjten76p0000viumjxwes8nz	cmjtfyl260009mw9vktuvk4rd	360	2025-12-31 03:13:21.704	f	2025-12-31 03:13:21.704	2025-12-31 03:16:05.361
cmjtg23r3000512at24bii31g	cmjten76p0000viumjxwes8nz	cmjtfyl260009mw9vktuvk4rd	360	2025-12-31 03:16:05.631	t	2025-12-31 03:16:05.631	2025-12-31 03:16:05.631
cmjtfylwl000fmw9vaki7tjl2	cmjten76p0000viumjxwes8nz	cmjtfylpc000dmw9vtbj4su00	400	2025-12-31 03:13:22.533	f	2025-12-31 03:13:22.533	2025-12-31 03:16:06.826
cmjtg24vr000712atvj6cwroq	cmjten76p0000viumjxwes8nz	cmjtfylpc000dmw9vtbj4su00	400	2025-12-31 03:16:07.095	t	2025-12-31 03:16:07.095	2025-12-31 03:16:07.095
cmjtfymig000jmw9v8ks0yeqr	cmjten76p0000viumjxwes8nz	cmjtfymb5000hmw9vlsdpz75l	400	2025-12-31 03:13:23.32	f	2025-12-31 03:13:23.32	2025-12-31 03:16:08.228
cmjtg25yp000912athmy2bec9	cmjten76p0000viumjxwes8nz	cmjtfymb5000hmw9vlsdpz75l	400	2025-12-31 03:16:08.498	t	2025-12-31 03:16:08.498	2025-12-31 03:16:08.498
cmjtfyn4c000nmw9vq3h7owlh	cmjten76p0000viumjxwes8nz	cmjtfymx1000lmw9v6odxz662	160	2025-12-31 03:13:24.108	f	2025-12-31 03:13:24.108	2025-12-31 03:16:09.662
cmjtg273l000b12atjy4rms2l	cmjten76p0000viumjxwes8nz	cmjtfymx1000lmw9v6odxz662	160	2025-12-31 03:16:09.97	t	2025-12-31 03:16:09.97	2025-12-31 03:16:09.97
cmjtfynq8000rmw9v4kb4jorv	cmjten76p0000viumjxwes8nz	cmjtfynix000pmw9vh4n9s2l9	90	2025-12-31 03:13:24.896	f	2025-12-31 03:13:24.896	2025-12-31 03:16:11.164
cmjtg2889000d12atpx2crq1f	cmjten76p0000viumjxwes8nz	cmjtfynix000pmw9vh4n9s2l9	90	2025-12-31 03:16:11.433	t	2025-12-31 03:16:11.433	2025-12-31 03:16:11.433
cmjtfyoc4000vmw9v31y3vdze	cmjten76p0000viumjxwes8nz	cmjtfyo4s000tmw9v1cceq7rv	90	2025-12-31 03:13:25.684	f	2025-12-31 03:13:25.684	2025-12-31 03:16:12.594
cmjtg29c1000f12atdxdt7bl0	cmjten76p0000viumjxwes8nz	cmjtfyo4s000tmw9v1cceq7rv	90	2025-12-31 03:16:12.865	t	2025-12-31 03:16:12.865	2025-12-31 03:16:12.865
cmjtfyoxy000zmw9vw6ufark6	cmjten76p0000viumjxwes8nz	cmjtfyoqo000xmw9vj7evt5dp	160	2025-12-31 03:13:26.471	f	2025-12-31 03:13:26.471	2025-12-31 03:16:14.362
cmjtg2ap3000h12atzk3dkpls	cmjten76p0000viumjxwes8nz	cmjtfyoqo000xmw9vj7evt5dp	160	2025-12-31 03:16:14.632	t	2025-12-31 03:16:14.632	2025-12-31 03:16:14.632
\.


--
-- TOC entry 4550 (class 0 OID 28708)
-- Dependencies: 247
-- Data for Name: Supplier; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Supplier" (id, "ownerStoreId", name, "contactName", phone, email, address, city, state, zip, gstin, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 4544 (class 0 OID 26787)
-- Dependencies: 241
-- Data for Name: SyncEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SyncEvent" (id, "storeId", "deviceId", "eventType", "payloadJson", "clientCreatedAt", "serverReceivedAt", "ackedAt") FROM stdin;
\.


--
-- TOC entry 4524 (class 0 OID 26456)
-- Dependencies: 221
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, "storeId", name, phone, email, role, "passwordHash", "isActive", "createdAt", "updatedAt") FROM stdin;
cmjten85j0004viumsifvy7nr	cmjten76p0000viumjxwes8nz	Owner User	9999999999	owner@azela.com	OWNER	$2a$10$xSy1NwtD3WwvtCl0dmmAY.q2MBsm0XFuCD2b2XnajVFW/mecwTGB.	t	2025-12-31 02:36:31.879	2025-12-31 02:36:31.879
cmjten8jh0006vium78ekpg_dump: processing data for table "public.YieldIntelligence"
pg_dump: dumping contents of table "public.YieldIntelligence"
pg_dump: processing data for table "public._prisma_migrations"
pg_dump: dumping contents of table "public._prisma_migrations"
pg_dump: creating CONSTRAINT "public.AlertRule AlertRule_pkey"
pg_dump: creating CONSTRAINT "public.AuditLog AuditLog_pkey"
pg_dump: creating CONSTRAINT "public.Category Category_pkey"
pg_dump: creating CONSTRAINT "public.CentralPOItem CentralPOItem_pkey"
pg_dump: creating CONSTRAINT "public.CentralPurchaseOrder CentralPurchaseOrder_pkey"
pg_dump: creating CONSTRAINT "public.ComplianceChecklistTemplate ComplianceChecklistTemplate_pkey"
pg_dump: creating CONSTRAINT "public.ComplianceRecord ComplianceRecord_pkey"
pg_dump: creating CONSTRAINT "public.CustomerAddress CustomerAddress_pkey"
pg_dump: creating CONSTRAINT "public.Customer Customer_pkey"
3p0s	cmjten7ko0002viumzdic2lbf	Manager User	8888888888	manager@azela.com	MANAGER	$2a$10$GebPQqsP8nzbpTMLhLjWJev331vd3tRpYmvauUCCY1CT3cLBsBivS	t	2025-12-31 02:36:32.381	2025-12-31 02:36:32.381
cmjten8qk0008viumbzkrvtz3	cmjten7ko0002viumzdic2lbf	Cashier User	7777777777	cashier@azela.com	CASHIER	$2a$10$tMxg5F5PoipLXxFkVCES9.Jch9/GOgMG9zhbxzdcdkoy7gY5twHR2	t	2025-12-31 02:36:32.636	2025-12-31 02:36:32.636
cmjten8xg000aviumsq4s5tq8	cmjten7ko0002viumzdic2lbf	Driver User	6666666666	driver@azela.com	DRIVER	$2a$10$A.mJNSrd7ligJ1iIEWRUKOZ8.M0.E0/20mqwngH6M0eRb4MK1QkZ6	t	2025-12-31 02:36:32.885	2025-12-31 02:36:32.885
\.


--
-- TOC entry 4562 (class 0 OID 28944)
-- Dependencies: 259
-- Data for Name: YieldIntelligence; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."YieldIntelligence" (id, "franchiseConfigId", "productId", "periodStart", "periodEnd", "expectedYieldKg", "actualYieldKg", "yieldEfficiency", "cuttingLossKg", "spoilageLossKg", "theftSuspicionKg", "otherLossKg", "totalReceivedKg", "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 4522 (class 0 OID 26318)
-- Dependencies: 219
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
b9f97392-5bdb-45dc-8ed9-0f26ab776f80	bbc60e6117c9f0d611748120b06295a17386417a94334d8ceff9182dcfd9b4f1	2026-01-03 14:04:12.672487+05:30	20251214192423_init	\N	\N	2026-01-03 14:04:12.636787+05:30	1
d6486e34-3fd1-4950-8af9-10ec5d0288f5	fd4cfc7beda76ad4d19922092c1676ac95f910856eeec14708428b096f6c392b	2026-01-03 14:04:13.268692+05:30	20260103083413_add_credit_online_payment_methods	\N	\N	2026-01-03 14:04:13.209419+05:30	1
4db8104c-26e4-475f-88f2-d6ed903710ba	bbc60e6117c9f0d611748120b06295a17386417a94334d8ceff9182dcfd9b4f1	2025-12-28 22:38:23.027419+05:30	20251214192423_init	\N	\N	2025-12-28 22:38:21.320566+05:30	1
\.


--
-- TOC entry 4244 (class 2606 OID 28915)
-- Name: AlertRule AlertRule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AlertRule"
    ADD CONSTRAINT "AlertRule_pkey" PRIMARY KEY (id);


--
-- TOC entry 4156 (class 2606 OID 26786)
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- TOC entry 4094 (class 2606 OID 26540)
-- Name: Category Category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY (id);


--
-- TOC entry 4197 (class 2606 OID 28756)
-- Name: CentralPOItem CentralPOItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CentralPOItem"
    ADD CONSTRAINT "CentralPOItem_pkey" PRIMARY KEY (id);


--
-- TOC entry 4193 (class 2606 OID 28742)
-- Name: CentralPurchaseOrder CentralPurchaseOrder_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CentralPurchaseOrder"
    ADD CONSTRAINT "CentralPurchaseOrder_pkey" PRIMARY KEY (id);


--
-- TOC entry 4226 (class 2606 OID 28859)
-- Name: ComplianceChecklistTemplate ComplianceChecklistTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ComplianceChecklistTemplate"
    ADD CONSTRAINT "ComplianceChecklistTemplate_pkey" PRIMARY KEY (id);


--
-- TOC entry 4232 (class 2606 OID 28876)
-- Name: ComplianceRecord ComplianceRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ComplianceRecord"
    ADD CONSTRAINT "ComplianceRecord_pkey" PRIMARY KEY (id);


--
-- TOC entry 4085 (class 2606 OID 26504)
-- Name: CustomerAddress CustomerAddress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerAddress"
    ADD CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY (id);


--
-- TOC entry 4080 (class 2606 OID 26487)
-- Name: Customer Customer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_pkey" PRIMARY KEY (id);

pg_dump: creating CONSTRAINT "public.DailyClosing DailyClosing_pkey"
pg_dump: creating CONSTRAINT "public.DeliveryEvent DeliveryEvent_pkey"
pg_dump: creating CONSTRAINT "public.DeliveryOrder DeliveryOrder_pkey"
pg_dump: creating CONSTRAINT "public.DiscountOverride DiscountOverride_pkey"
pg_dump: creating CONSTRAINT "public.DispatchItem DispatchItem_pkey"
pg_dump: creating CONSTRAINT "public.Dispatch Dispatch_pkey"
pg_dump: creating CONSTRAINT "public.FranchiseConfig FranchiseConfig_pkey"
pg_dump: creating CONSTRAINT "public.FranchiseHealthScore FranchiseHealthScore_pkey"
pg_dump: creating CONSTRAINT "public.GRN GRN_pkey"
pg_dump: creating CONSTRAINT "public.HQAlert HQAlert_pkey"
pg_dump: creating CONSTRAINT "public.InventoryLedger InventoryLedger_pkey"
pg_dump: creating CONSTRAINT "public.InwardStock InwardStock_pkey"
pg_dump: creating CONSTRAINT "public.LoyaltyTransaction LoyaltyTransaction_pkey"
pg_dump: creating CONSTRAINT "public.Payment Payment_pkey"
pg_dump: creating CONSTRAINT "public.PricingOverride PricingOverride_pkey"
pg_dump: creating CONSTRAINT "public.PricingPlan PricingPlan_pkey"
pg_dump: creating CONSTRAINT "public.PricingRule PricingRule_pkey"
pg_dump: creating CONSTRAINT "public.ProductMaster ProductMaster_pkey"

--
-- TOC entry 4273 (class 2606 OID 29071)
-- Name: DailyClosing DailyClosing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DailyClosing"
    ADD CONSTRAINT "DailyClosing_pkey" PRIMARY KEY (id);


--
-- TOC entry 4152 (class 2606 OID 26771)
-- Name: DeliveryEvent DeliveryEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeliveryEvent"
    ADD CONSTRAINT "DeliveryEvent_pkey" PRIMARY KEY (id);


--
-- TOC entry 4145 (class 2606 OID 26758)
-- Name: DeliveryOrder DeliveryOrder_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeliveryOrder"
    ADD CONSTRAINT "DeliveryOrder_pkey" PRIMARY KEY (id);


--
-- TOC entry 4265 (class 2606 OID 29027)
-- Name: DiscountOverride DiscountOverride_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DiscountOverride"
    ADD CONSTRAINT "DiscountOverride_pkey" PRIMARY KEY (id);


--
-- TOC entry 4138 (class 2606 OID 26723)
-- Name: DispatchItem DispatchItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DispatchItem"
    ADD CONSTRAINT "DispatchItem_pkey" PRIMARY KEY (id);


--
-- TOC entry 4134 (class 2606 OID 26711)
-- Name: Dispatch Dispatch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Dispatch"
    ADD CONSTRAINT "Dispatch_pkey" PRIMARY KEY (id);


--
-- TOC entry 4166 (class 2606 OID 28637)
-- Name: FranchiseConfig FranchiseConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FranchiseConfig"
    ADD CONSTRAINT "FranchiseConfig_pkey" PRIMARY KEY (id);


--
-- TOC entry 4250 (class 2606 OID 28943)
-- Name: FranchiseHealthScore FranchiseHealthScore_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FranchiseHealthScore"
    ADD CONSTRAINT "FranchiseHealthScore_pkey" PRIMARY KEY (id);


--
-- TOC entry 4141 (class 2606 OID 26740)
-- Name: GRN GRN_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GRN"
    ADD CONSTRAINT "GRN_pkey" PRIMARY KEY (id);


--
-- TOC entry 4239 (class 2606 OID 28896)
-- Name: HQAlert HQAlert_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HQAlert"
    ADD CONSTRAINT "HQAlert_pkey" PRIMARY KEY (id);


--
-- TOC entry 4100 (class 2606 OID 26572)
-- Name: InventoryLedger InventoryLedger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryLedger"
    ADD CONSTRAINT "InventoryLedger_pkey" PRIMARY KEY (id);


--
-- TOC entry 4203 (class 2606 OID 28774)
-- Name: InwardStock InwardStock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InwardStock"
    ADD CONSTRAINT "InwardStock_pkey" PRIMARY KEY (id);


--
-- TOC entry 4279 (class 2606 OID 29086)
-- Name: LoyaltyTransaction LoyaltyTransaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LoyaltyTransaction"
    ADD CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY (id);


--
-- TOC entry 4115 (class 2606 OID 26627)
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- TOC entry 4178 (class 2606 OID 28687)
-- Name: PricingOverride PricingOverride_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PricingOverride"
    ADD CONSTRAINT "PricingOverride_pkey" PRIMARY KEY (id);


--
-- TOC entry 4170 (class 2606 OID 28652)
-- Name: PricingPlan PricingPlan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PricingPlan"
    ADD CONSTRAINT "PricingPlan_pkey" PRIMARY KEY (id);


--
-- TOC entry 4173 (class 2606 OID 28667)
-- Name: PricingRule PricingRule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PricingRule"
    ADD CONSTRAINT "PricingRule_pkey" PRIMARY KEY (id);


--
-- TOC entry 4182 (class 2606 OID 28707)
-- Name: ProductMaster ProductMaster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductMaster"pg_dump: creating CONSTRAINT "public.Product Product_pkey"
pg_dump: creating CONSTRAINT "public.PurchaseOrderItem PurchaseOrderItem_pkey"
pg_dump: creating CONSTRAINT "public.PurchaseOrder PurchaseOrder_pkey"
pg_dump: creating CONSTRAINT "public.ReplenishmentRequest ReplenishmentRequest_pkey"
pg_dump: creating CONSTRAINT "public.RoyaltyInvoice RoyaltyInvoice_pkey"
pg_dump: creating CONSTRAINT "public.RoyaltyLedger RoyaltyLedger_pkey"
pg_dump: creating CONSTRAINT "public.SaleItem SaleItem_pkey"
pg_dump: creating CONSTRAINT "public.Sale Sale_pkey"
pg_dump: creating CONSTRAINT "public.ScaleBarcodeConfig ScaleBarcodeConfig_pkey"
pg_dump: creating CONSTRAINT "public.Shift Shift_pkey"
pg_dump: creating CONSTRAINT "public.StockAllocation StockAllocation_pkey"
pg_dump: creating CONSTRAINT "public.StoreProductPrice StoreProductPrice_pkey"
pg_dump: creating CONSTRAINT "public.Store Store_pkey"
pg_dump: creating CONSTRAINT "public.Supplier Supplier_pkey"
pg_dump: creating CONSTRAINT "public.SyncEvent SyncEvent_pkey"
pg_dump: creating CONSTRAINT "public.User User_pkey"
pg_dump: creating CONSTRAINT "public.YieldIntelligence YieldIntelligence_pkey"
pg_dump: creating CONSTRAINT "public._prisma_migrations _prisma_migrations_pkey"

    ADD CONSTRAINT "ProductMaster_pkey" PRIMARY KEY (id);


--
-- TOC entry 4090 (class 2606 OID 26525)
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- TOC entry 4130 (class 2606 OID 26696)
-- Name: PurchaseOrderItem PurchaseOrderItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrderItem"
    ADD CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY (id);


--
-- TOC entry 4128 (class 2606 OID 26684)
-- Name: PurchaseOrder PurchaseOrder_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrder"
    ADD CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY (id);


--
-- TOC entry 4260 (class 2606 OID 29008)
-- Name: ReplenishmentRequest ReplenishmentRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReplenishmentRequest"
    ADD CONSTRAINT "ReplenishmentRequest_pkey" PRIMARY KEY (id);


--
-- TOC entry 4216 (class 2606 OID 28829)
-- Name: RoyaltyInvoice RoyaltyInvoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RoyaltyInvoice"
    ADD CONSTRAINT "RoyaltyInvoice_pkey" PRIMARY KEY (id);


--
-- TOC entry 4222 (class 2606 OID 28842)
-- Name: RoyaltyLedger RoyaltyLedger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RoyaltyLedger"
    ADD CONSTRAINT "RoyaltyLedger_pkey" PRIMARY KEY (id);


--
-- TOC entry 4111 (class 2606 OID 26614)
-- Name: SaleItem SaleItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SaleItem"
    ADD CONSTRAINT "SaleItem_pkey" PRIMARY KEY (id);


--
-- TOC entry 4106 (class 2606 OID 26596)
-- Name: Sale Sale_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Sale"
    ADD CONSTRAINT "Sale_pkey" PRIMARY KEY (id);


--
-- TOC entry 4122 (class 2606 OID 26668)
-- Name: ScaleBarcodeConfig ScaleBarcodeConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScaleBarcodeConfig"
    ADD CONSTRAINT "ScaleBarcodeConfig_pkey" PRIMARY KEY (id);


--
-- TOC entry 4119 (class 2606 OID 26644)
-- Name: Shift Shift_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Shift"
    ADD CONSTRAINT "Shift_pkey" PRIMARY KEY (id);


--
-- TOC entry 4209 (class 2606 OID 28793)
-- Name: StockAllocation StockAllocation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockAllocation"
    ADD CONSTRAINT "StockAllocation_pkey" PRIMARY KEY (id);


--
-- TOC entry 4096 (class 2606 OID 26558)
-- Name: StoreProductPrice StoreProductPrice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StoreProductPrice"
    ADD CONSTRAINT "StoreProductPrice_pkey" PRIMARY KEY (id);


--
-- TOC entry 4073 (class 2606 OID 26455)
-- Name: Store Store_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Store"
    ADD CONSTRAINT "Store_pkey" PRIMARY KEY (id);


--
-- TOC entry 4189 (class 2606 OID 28722)
-- Name: Supplier Supplier_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Supplier"
    ADD CONSTRAINT "Supplier_pkey" PRIMARY KEY (id);


--
-- TOC entry 4159 (class 2606 OID 26800)
-- Name: SyncEvent SyncEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SyncEvent"
    ADD CONSTRAINT "SyncEvent_pkey" PRIMARY KEY (id);


--
-- TOC entry 4077 (class 2606 OID 26473)
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- TOC entry 4256 (class 2606 OID 28973)
-- Name: YieldIntelligence YieldIntelligence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."YieldIntelligence"
    ADD CONSTRAINT "YieldIntelligence_pkey" PRIMARY KEY (id);


--
-- TOC entry 4070 (class 2606 OID 26331)
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY publpg_dump: creating INDEX "public.AlertRule_isActive_idx"
pg_dump: creating INDEX "public.AlertRule_ownerStoreId_idx"
pg_dump: creating INDEX "public.AlertRule_ruleType_idx"
pg_dump: creating INDEX "public.AuditLog_actorUserId_idx"
pg_dump: creating INDEX "public.AuditLog_entityType_entityId_idx"
pg_dump: creating INDEX "public.AuditLog_storeId_createdAt_idx"
pg_dump: creating INDEX "public.Category_ownerStoreId_idx"
pg_dump: creating INDEX "public.Category_ownerStoreId_name_key"
pg_dump: creating INDEX "public.CentralPOItem_centralPOId_idx"
pg_dump: creating INDEX "public.CentralPOItem_productId_idx"
pg_dump: creating INDEX "public.CentralPurchaseOrder_ownerStoreId_poNo_key"
pg_dump: creating INDEX "public.CentralPurchaseOrder_ownerStoreId_status_idx"
pg_dump: creating INDEX "public.CentralPurchaseOrder_supplierId_idx"
pg_dump: creating INDEX "public.ComplianceChecklistTemplate_checkType_idx"
pg_dump: creating INDEX "public.ComplianceChecklistTemplate_ownerStoreId_idx"
pg_dump: creating INDEX "public.ComplianceRecord_checkType_idx"
pg_dump: creating INDEX "public.ComplianceRecord_checkedAt_idx"
ic._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 4241 (class 1259 OID 29138)
-- Name: AlertRule_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AlertRule_isActive_idx" ON public."AlertRule" USING btree ("isActive");


--
-- TOC entry 4242 (class 1259 OID 29136)
-- Name: AlertRule_ownerStoreId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AlertRule_ownerStoreId_idx" ON public."AlertRule" USING btree ("ownerStoreId");


--
-- TOC entry 4245 (class 1259 OID 29137)
-- Name: AlertRule_ruleType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AlertRule_ruleType_idx" ON public."AlertRule" USING btree ("ruleType");


--
-- TOC entry 4153 (class 1259 OID 26844)
-- Name: AuditLog_actorUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_actorUserId_idx" ON public."AuditLog" USING btree ("actorUserId");


--
-- TOC entry 4154 (class 1259 OID 26845)
-- Name: AuditLog_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_entityType_entityId_idx" ON public."AuditLog" USING btree ("entityType", "entityId");


--
-- TOC entry 4157 (class 1259 OID 26843)
-- Name: AuditLog_storeId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_storeId_createdAt_idx" ON public."AuditLog" USING btree ("storeId", "createdAt");


--
-- TOC entry 4091 (class 1259 OID 26811)
-- Name: Category_ownerStoreId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Category_ownerStoreId_idx" ON public."Category" USING btree ("ownerStoreId");


--
-- TOC entry 4092 (class 1259 OID 26812)
-- Name: Category_ownerStoreId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Category_ownerStoreId_name_key" ON public."Category" USING btree ("ownerStoreId", name);


--
-- TOC entry 4195 (class 1259 OID 29106)
-- Name: CentralPOItem_centralPOId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CentralPOItem_centralPOId_idx" ON public."CentralPOItem" USING btree ("centralPOId");


--
-- TOC entry 4198 (class 1259 OID 29107)
-- Name: CentralPOItem_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CentralPOItem_productId_idx" ON public."CentralPOItem" USING btree ("productId");


--
-- TOC entry 4190 (class 1259 OID 29105)
-- Name: CentralPurchaseOrder_ownerStoreId_poNo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CentralPurchaseOrder_ownerStoreId_poNo_key" ON public."CentralPurchaseOrder" USING btree ("ownerStoreId", "poNo");


--
-- TOC entry 4191 (class 1259 OID 29103)
-- Name: CentralPurchaseOrder_ownerStoreId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CentralPurchaseOrder_ownerStoreId_status_idx" ON public."CentralPurchaseOrder" USING btree ("ownerStoreId", status);


--
-- TOC entry 4194 (class 1259 OID 29104)
-- Name: CentralPurchaseOrder_supplierId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CentralPurchaseOrder_supplierId_idx" ON public."CentralPurchaseOrder" USING btree ("supplierId");


--
-- TOC entry 4223 (class 1259 OID 29125)
-- Name: ComplianceChecklistTemplate_checkType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ComplianceChecklistTemplate_checkType_idx" ON public."ComplianceChecklistTemplate" USING btree ("checkType");


--
-- TOC entry 4224 (class 1259 OID 29124)
-- Name: ComplianceChecklistTemplate_ownerStoreId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ComplianceChecklistTemplate_ownerStoreId_idx" ON public."ComplianceChecklistTemplate" USING btree ("ownerStoreId");


--
-- TOC entry 4227 (class 1259 OID 29127)
-- Name: ComplianceRecord_checkType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ComplianceRecord_checkType_idx" ON public."ComplianceRecord" USING btree ("checkType");


--
-- TOC entry 4228 (class 1259 OID 29129)
-- Name: ComplianceRecord_checkedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ComplianceRecord_checkedAt_idx" ON public."ComplianceRecord" USING btree ("checkpg_dump: creating INDEX "public.ComplianceRecord_expiryDate_idx"
pg_dump: creating INDEX "public.ComplianceRecord_franchiseConfigId_idx"
pg_dump: creating INDEX "public.ComplianceRecord_status_idx"
pg_dump: creating INDEX "public.CustomerAddress_customerId_idx"
pg_dump: creating INDEX "public.Customer_storeId_phone_idx"
pg_dump: creating INDEX "public.Customer_storeId_phone_key"
pg_dump: creating INDEX "public.DailyClosing_closedBy_idx"
pg_dump: creating INDEX "public.DailyClosing_storeId_closingDate_idx"
pg_dump: creating INDEX "public.DailyClosing_storeId_closingDate_key"
pg_dump: creating INDEX "public.DeliveryEvent_createdBy_idx"
pg_dump: creating INDEX "public.DeliveryEvent_deliveryOrderId_idx"
pg_dump: creating INDEX "public.DeliveryOrder_assignedDriverId_idx"
pg_dump: creating INDEX "public.DeliveryOrder_saleId_key"
pg_dump: creating INDEX "public.DeliveryOrder_status_idx"
pg_dump: creating INDEX "public.DeliveryOrder_storeId_status_idx"
pg_dump: creating INDEX "public.DiscountOverride_requestedBy_idx"
pg_dump: creating INDEX "public.DiscountOverride_saleId_idx"
pg_dump: creating INDEX "public.DiscountOverride_saleId_key"
edAt");


--
-- TOC entry 4229 (class 1259 OID 29130)
-- Name: ComplianceRecord_expiryDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ComplianceRecord_expiryDate_idx" ON public."ComplianceRecord" USING btree ("expiryDate");


--
-- TOC entry 4230 (class 1259 OID 29126)
-- Name: ComplianceRecord_franchiseConfigId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ComplianceRecord_franchiseConfigId_idx" ON public."ComplianceRecord" USING btree ("franchiseConfigId");


--
-- TOC entry 4233 (class 1259 OID 29128)
-- Name: ComplianceRecord_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ComplianceRecord_status_idx" ON public."ComplianceRecord" USING btree (status);


--
-- TOC entry 4083 (class 1259 OID 26807)
-- Name: CustomerAddress_customerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerAddress_customerId_idx" ON public."CustomerAddress" USING btree ("customerId");


--
-- TOC entry 4081 (class 1259 OID 26805)
-- Name: Customer_storeId_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Customer_storeId_phone_idx" ON public."Customer" USING btree ("storeId", phone);


--
-- TOC entry 4082 (class 1259 OID 26806)
-- Name: Customer_storeId_phone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Customer_storeId_phone_key" ON public."Customer" USING btree ("storeId", phone);


--
-- TOC entry 4271 (class 1259 OID 29157)
-- Name: DailyClosing_closedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DailyClosing_closedBy_idx" ON public."DailyClosing" USING btree ("closedBy");


--
-- TOC entry 4274 (class 1259 OID 29156)
-- Name: DailyClosing_storeId_closingDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DailyClosing_storeId_closingDate_idx" ON public."DailyClosing" USING btree ("storeId", "closingDate");


--
-- TOC entry 4275 (class 1259 OID 29158)
-- Name: DailyClosing_storeId_closingDate_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DailyClosing_storeId_closingDate_key" ON public."DailyClosing" USING btree ("storeId", "closingDate");


--
-- TOC entry 4149 (class 1259 OID 26842)
-- Name: DeliveryEvent_createdBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DeliveryEvent_createdBy_idx" ON public."DeliveryEvent" USING btree ("createdBy");


--
-- TOC entry 4150 (class 1259 OID 26841)
-- Name: DeliveryEvent_deliveryOrderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DeliveryEvent_deliveryOrderId_idx" ON public."DeliveryEvent" USING btree ("deliveryOrderId");


--
-- TOC entry 4143 (class 1259 OID 26839)
-- Name: DeliveryOrder_assignedDriverId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DeliveryOrder_assignedDriverId_idx" ON public."DeliveryOrder" USING btree ("assignedDriverId");


--
-- TOC entry 4146 (class 1259 OID 26837)
-- Name: DeliveryOrder_saleId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DeliveryOrder_saleId_key" ON public."DeliveryOrder" USING btree ("saleId");


--
-- TOC entry 4147 (class 1259 OID 26840)
-- Name: DeliveryOrder_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DeliveryOrder_status_idx" ON public."DeliveryOrder" USING btree (status);


--
-- TOC entry 4148 (class 1259 OID 26838)
-- Name: DeliveryOrder_storeId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DeliveryOrder_storeId_status_idx" ON public."DeliveryOrder" USING btree ("storeId", status);


--
-- TOC entry 4266 (class 1259 OID 29154)
-- Name: DiscountOverride_requestedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DiscountOverride_requestedBy_idx" ON public."DiscountOverride" USING btree ("requestedBy");


--
-- TOC entry 4267 (class 1259 OID 29152)
-- Name: DiscountOverride_saleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DiscountOverride_saleId_idx" ON public."DiscountOverride" USING btree ("saleId");


--
-- TOC entry 4268 (class 1259 OID 29151)
-- Name: DiscountOverride_saleId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE Ipg_dump: creating INDEX "public.DiscountOverride_status_idx"
pg_dump: creating INDEX "public.DiscountOverride_storeId_idx"
pg_dump: creating INDEX "public.DispatchItem_dispatchId_idx"
pg_dump: creating INDEX "public.Dispatch_dispatchNo_idx"
pg_dump: creating INDEX "public.Dispatch_poId_key"
pg_dump: creating INDEX "public.FranchiseConfig_areaManagerId_idx"
pg_dump: creating INDEX "public.FranchiseConfig_franchiseStoreId_idx"
pg_dump: creating INDEX "public.FranchiseConfig_franchiseStoreId_key"
pg_dump: creating INDEX "public.FranchiseConfig_status_idx"
pg_dump: creating INDEX "public.FranchiseHealthScore_franchiseConfigId_idx"
pg_dump: creating INDEX "public.FranchiseHealthScore_franchiseConfigId_scoreDate_key"
pg_dump: creating INDEX "public.FranchiseHealthScore_overallScore_idx"
pg_dump: creating INDEX "public.FranchiseHealthScore_scoreDate_idx"
pg_dump: creating INDEX "public.GRN_dispatchId_key"
pg_dump: creating INDEX "public.GRN_receivedBy_idx"
pg_dump: creating INDEX "public.HQAlert_alertType_idx"
pg_dump: creating INDEX "public.HQAlert_franchiseStoreId_idx"
pg_dump: creating INDEX "public.HQAlert_isRead_isResolved_idx"
NDEX "DiscountOverride_saleId_key" ON public."DiscountOverride" USING btree ("saleId");


--
-- TOC entry 4269 (class 1259 OID 29155)
-- Name: DiscountOverride_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DiscountOverride_status_idx" ON public."DiscountOverride" USING btree (status);


--
-- TOC entry 4270 (class 1259 OID 29153)
-- Name: DiscountOverride_storeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DiscountOverride_storeId_idx" ON public."DiscountOverride" USING btree ("storeId");


--
-- TOC entry 4136 (class 1259 OID 26834)
-- Name: DispatchItem_dispatchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DispatchItem_dispatchId_idx" ON public."DispatchItem" USING btree ("dispatchId");


--
-- TOC entry 4132 (class 1259 OID 26833)
-- Name: Dispatch_dispatchNo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Dispatch_dispatchNo_idx" ON public."Dispatch" USING btree ("dispatchNo");


--
-- TOC entry 4135 (class 1259 OID 26832)
-- Name: Dispatch_poId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Dispatch_poId_key" ON public."Dispatch" USING btree ("poId");


--
-- TOC entry 4162 (class 1259 OID 29090)
-- Name: FranchiseConfig_areaManagerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FranchiseConfig_areaManagerId_idx" ON public."FranchiseConfig" USING btree ("areaManagerId");


--
-- TOC entry 4163 (class 1259 OID 29088)
-- Name: FranchiseConfig_franchiseStoreId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FranchiseConfig_franchiseStoreId_idx" ON public."FranchiseConfig" USING btree ("franchiseStoreId");


--
-- TOC entry 4164 (class 1259 OID 29087)
-- Name: FranchiseConfig_franchiseStoreId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FranchiseConfig_franchiseStoreId_key" ON public."FranchiseConfig" USING btree ("franchiseStoreId");


--
-- TOC entry 4167 (class 1259 OID 29089)
-- Name: FranchiseConfig_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FranchiseConfig_status_idx" ON public."FranchiseConfig" USING btree (status);


--
-- TOC entry 4246 (class 1259 OID 29139)
-- Name: FranchiseHealthScore_franchiseConfigId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FranchiseHealthScore_franchiseConfigId_idx" ON public."FranchiseHealthScore" USING btree ("franchiseConfigId");


--
-- TOC entry 4247 (class 1259 OID 29142)
-- Name: FranchiseHealthScore_franchiseConfigId_scoreDate_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FranchiseHealthScore_franchiseConfigId_scoreDate_key" ON public."FranchiseHealthScore" USING btree ("franchiseConfigId", "scoreDate");


--
-- TOC entry 4248 (class 1259 OID 29141)
-- Name: FranchiseHealthScore_overallScore_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FranchiseHealthScore_overallScore_idx" ON public."FranchiseHealthScore" USING btree ("overallScore");


--
-- TOC entry 4251 (class 1259 OID 29140)
-- Name: FranchiseHealthScore_scoreDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FranchiseHealthScore_scoreDate_idx" ON public."FranchiseHealthScore" USING btree ("scoreDate");


--
-- TOC entry 4139 (class 1259 OID 26835)
-- Name: GRN_dispatchId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "GRN_dispatchId_key" ON public."GRN" USING btree ("dispatchId");


--
-- TOC entry 4142 (class 1259 OID 26836)
-- Name: GRN_receivedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GRN_receivedBy_idx" ON public."GRN" USING btree ("receivedBy");


--
-- TOC entry 4234 (class 1259 OID 29133)
-- Name: HQAlert_alertType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HQAlert_alertType_idx" ON public."HQAlert" USING btree ("alertType");


--
-- TOC entry 4235 (class 1259 OID 29132)
-- Name: HQAlert_franchiseStoreId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HQAlert_franchiseStoreId_idx" ON public."HQAlert" USING btree ("franchiseStoreId");


--
-- TOC entry 4236 (class 1259 OID 29135)
-- Name: HQAlert_isRead_isRespg_dump: creating INDEX "public.HQAlert_ownerStoreId_idx"
pg_dump: creating INDEX "public.HQAlert_severity_idx"
pg_dump: creating INDEX "public.InventoryLedger_refId_idx"
pg_dump: creating INDEX "public.InventoryLedger_storeId_createdAt_idx"
pg_dump: creating INDEX "public.InventoryLedger_storeId_productId_idx"
pg_dump: creating INDEX "public.InwardStock_batchNo_idx"
pg_dump: creating INDEX "public.InwardStock_centralPOId_idx"
pg_dump: creating INDEX "public.InwardStock_ownerStoreId_idx"
pg_dump: creating INDEX "public.InwardStock_productId_idx"
pg_dump: creating INDEX "public.InwardStock_supplierId_idx"
pg_dump: creating INDEX "public.LoyaltyTransaction_createdAt_idx"
pg_dump: creating INDEX "public.LoyaltyTransaction_customerId_idx"
pg_dump: creating INDEX "public.LoyaltyTransaction_saleId_idx"
pg_dump: creating INDEX "public.LoyaltyTransaction_storeId_idx"
pg_dump: creating INDEX "public.Payment_saleId_idx"
pg_dump: creating INDEX "public.PricingOverride_franchiseConfigId_productId_idx"
pg_dump: creating INDEX "public.PricingOverride_productId_idx"
pg_dump: creating INDEX "public.PricingPlan_isActive_idx"
olved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HQAlert_isRead_isResolved_idx" ON public."HQAlert" USING btree ("isRead", "isResolved");


--
-- TOC entry 4237 (class 1259 OID 29131)
-- Name: HQAlert_ownerStoreId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HQAlert_ownerStoreId_idx" ON public."HQAlert" USING btree ("ownerStoreId");


--
-- TOC entry 4240 (class 1259 OID 29134)
-- Name: HQAlert_severity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HQAlert_severity_idx" ON public."HQAlert" USING btree (severity);


--
-- TOC entry 4101 (class 1259 OID 26817)
-- Name: InventoryLedger_refId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryLedger_refId_idx" ON public."InventoryLedger" USING btree ("refId");


--
-- TOC entry 4102 (class 1259 OID 26816)
-- Name: InventoryLedger_storeId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryLedger_storeId_createdAt_idx" ON public."InventoryLedger" USING btree ("storeId", "createdAt");


--
-- TOC entry 4103 (class 1259 OID 26815)
-- Name: InventoryLedger_storeId_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryLedger_storeId_productId_idx" ON public."InventoryLedger" USING btree ("storeId", "productId");


--
-- TOC entry 4199 (class 1259 OID 29112)
-- Name: InwardStock_batchNo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InwardStock_batchNo_idx" ON public."InwardStock" USING btree ("batchNo");


--
-- TOC entry 4200 (class 1259 OID 29109)
-- Name: InwardStock_centralPOId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InwardStock_centralPOId_idx" ON public."InwardStock" USING btree ("centralPOId");


--
-- TOC entry 4201 (class 1259 OID 29108)
-- Name: InwardStock_ownerStoreId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InwardStock_ownerStoreId_idx" ON public."InwardStock" USING btree ("ownerStoreId");


--
-- TOC entry 4204 (class 1259 OID 29111)
-- Name: InwardStock_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InwardStock_productId_idx" ON public."InwardStock" USING btree ("productId");


--
-- TOC entry 4205 (class 1259 OID 29110)
-- Name: InwardStock_supplierId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InwardStock_supplierId_idx" ON public."InwardStock" USING btree ("supplierId");


--
-- TOC entry 4276 (class 1259 OID 29162)
-- Name: LoyaltyTransaction_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LoyaltyTransaction_createdAt_idx" ON public."LoyaltyTransaction" USING btree ("createdAt");


--
-- TOC entry 4277 (class 1259 OID 29159)
-- Name: LoyaltyTransaction_customerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LoyaltyTransaction_customerId_idx" ON public."LoyaltyTransaction" USING btree ("customerId");


--
-- TOC entry 4280 (class 1259 OID 29161)
-- Name: LoyaltyTransaction_saleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LoyaltyTransaction_saleId_idx" ON public."LoyaltyTransaction" USING btree ("saleId");


--
-- TOC entry 4281 (class 1259 OID 29160)
-- Name: LoyaltyTransaction_storeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LoyaltyTransaction_storeId_idx" ON public."LoyaltyTransaction" USING btree ("storeId");


--
-- TOC entry 4116 (class 1259 OID 26824)
-- Name: Payment_saleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_saleId_idx" ON public."Payment" USING btree ("saleId");


--
-- TOC entry 4176 (class 1259 OID 29095)
-- Name: PricingOverride_franchiseConfigId_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PricingOverride_franchiseConfigId_productId_idx" ON public."PricingOverride" USING btree ("franchiseConfigId", "productId");


--
-- TOC entry 4179 (class 1259 OID 29096)
-- Name: PricingOverride_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PricingOverride_productId_idx" ON public."PricingOverride" USING btree ("productId");


--
-- TOC entry 4168 (class 1259 OID 29091)
-- Name: PricingPlanpg_dump: creating INDEX "public.PricingRule_categoryId_idx"
pg_dump: creating INDEX "public.PricingRule_pricingPlanId_idx"
pg_dump: creating INDEX "public.PricingRule_productId_idx"
pg_dump: creating INDEX "public.ProductMaster_ownerStoreId_idx"
pg_dump: creating INDEX "public.ProductMaster_productId_idx"
pg_dump: creating INDEX "public.ProductMaster_productId_key"
pg_dump: creating INDEX "public.ProductMaster_productType_idx"
pg_dump: creating INDEX "public.Product_ownerStoreId_categoryId_idx"
pg_dump: creating INDEX "public.Product_ownerStoreId_plu_key"
pg_dump: creating INDEX "public.Product_ownerStoreId_sku_key"
pg_dump: creating INDEX "public.PurchaseOrderItem_poId_idx"
pg_dump: creating INDEX "public.PurchaseOrder_franchiseStoreId_poNo_key"
pg_dump: creating INDEX "public.PurchaseOrder_franchiseStoreId_status_idx"
pg_dump: creating INDEX "public.PurchaseOrder_ownerStoreId_status_idx"
pg_dump: creating INDEX "public.ReplenishmentRequest_franchiseStoreId_idx"
pg_dump: creating INDEX "public.ReplenishmentRequest_productId_idx"
pg_dump: creating INDEX "public.ReplenishmentRequest_requestedAt_idx"
_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PricingPlan_isActive_idx" ON public."PricingPlan" USING btree ("isActive");


--
-- TOC entry 4171 (class 1259 OID 29094)
-- Name: PricingRule_categoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PricingRule_categoryId_idx" ON public."PricingRule" USING btree ("categoryId");


--
-- TOC entry 4174 (class 1259 OID 29092)
-- Name: PricingRule_pricingPlanId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PricingRule_pricingPlanId_idx" ON public."PricingRule" USING btree ("pricingPlanId");


--
-- TOC entry 4175 (class 1259 OID 29093)
-- Name: PricingRule_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PricingRule_productId_idx" ON public."PricingRule" USING btree ("productId");


--
-- TOC entry 4180 (class 1259 OID 29098)
-- Name: ProductMaster_ownerStoreId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProductMaster_ownerStoreId_idx" ON public."ProductMaster" USING btree ("ownerStoreId");


--
-- TOC entry 4183 (class 1259 OID 29099)
-- Name: ProductMaster_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProductMaster_productId_idx" ON public."ProductMaster" USING btree ("productId");


--
-- TOC entry 4184 (class 1259 OID 29097)
-- Name: ProductMaster_productId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ProductMaster_productId_key" ON public."ProductMaster" USING btree ("productId");


--
-- TOC entry 4185 (class 1259 OID 29100)
-- Name: ProductMaster_productType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProductMaster_productType_idx" ON public."ProductMaster" USING btree ("productType");


--
-- TOC entry 4086 (class 1259 OID 26808)
-- Name: Product_ownerStoreId_categoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_ownerStoreId_categoryId_idx" ON public."Product" USING btree ("ownerStoreId", "categoryId");


--
-- TOC entry 4087 (class 1259 OID 26810)
-- Name: Product_ownerStoreId_plu_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Product_ownerStoreId_plu_key" ON public."Product" USING btree ("ownerStoreId", plu);


--
-- TOC entry 4088 (class 1259 OID 26809)
-- Name: Product_ownerStoreId_sku_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Product_ownerStoreId_sku_key" ON public."Product" USING btree ("ownerStoreId", sku);


--
-- TOC entry 4131 (class 1259 OID 26831)
-- Name: PurchaseOrderItem_poId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PurchaseOrderItem_poId_idx" ON public."PurchaseOrderItem" USING btree ("poId");


--
-- TOC entry 4124 (class 1259 OID 26830)
-- Name: PurchaseOrder_franchiseStoreId_poNo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PurchaseOrder_franchiseStoreId_poNo_key" ON public."PurchaseOrder" USING btree ("franchiseStoreId", "poNo");


--
-- TOC entry 4125 (class 1259 OID 26828)
-- Name: PurchaseOrder_franchiseStoreId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PurchaseOrder_franchiseStoreId_status_idx" ON public."PurchaseOrder" USING btree ("franchiseStoreId", status);


--
-- TOC entry 4126 (class 1259 OID 26829)
-- Name: PurchaseOrder_ownerStoreId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PurchaseOrder_ownerStoreId_status_idx" ON public."PurchaseOrder" USING btree ("ownerStoreId", status);


--
-- TOC entry 4258 (class 1259 OID 29147)
-- Name: ReplenishmentRequest_franchiseStoreId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReplenishmentRequest_franchiseStoreId_idx" ON public."ReplenishmentRequest" USING btree ("franchiseStoreId");


--
-- TOC entry 4261 (class 1259 OID 29148)
-- Name: ReplenishmentRequest_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReplenishmentRequest_productId_idx" ON public."ReplenishmentRequest" USING btree ("productId");


--
-- TOC entry 4262 (class 1259 OID 29150)
-- Name: ReplenishmentRequest_requestedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "pg_dump: creating INDEX "public.ReplenishmentRequest_status_idx"
pg_dump: creating INDEX "public.RoyaltyInvoice_franchiseConfigId_idx"
pg_dump: creating INDEX "public.RoyaltyInvoice_franchiseConfigId_invoiceNo_key"
pg_dump: creating INDEX "public.RoyaltyInvoice_periodStart_periodEnd_idx"
pg_dump: creating INDEX "public.RoyaltyInvoice_status_idx"
pg_dump: creating INDEX "public.RoyaltyLedger_createdAt_idx"
pg_dump: creating INDEX "public.RoyaltyLedger_franchiseConfigId_idx"
pg_dump: creating INDEX "public.RoyaltyLedger_invoiceId_idx"
pg_dump: creating INDEX "public.SaleItem_productId_idx"
pg_dump: creating INDEX "public.SaleItem_saleId_idx"
pg_dump: creating INDEX "public.Sale_customerId_idx"
pg_dump: creating INDEX "public.Sale_status_idx"
pg_dump: creating INDEX "public.Sale_storeId_createdAt_idx"
pg_dump: creating INDEX "public.Sale_storeId_saleNo_key"
pg_dump: creating INDEX "public.ScaleBarcodeConfig_storeId_isActive_idx"
pg_dump: creating INDEX "public.Shift_openedByUserId_idx"
pg_dump: creating INDEX "public.Shift_storeId_openedAt_idx"
pg_dump: creating INDEX "public.StockAllocation_franchiseStoreId_idx"
ReplenishmentRequest_requestedAt_idx" ON public."ReplenishmentRequest" USING btree ("requestedAt");


--
-- TOC entry 4263 (class 1259 OID 29149)
-- Name: ReplenishmentRequest_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReplenishmentRequest_status_idx" ON public."ReplenishmentRequest" USING btree (status);


--
-- TOC entry 4212 (class 1259 OID 29117)
-- Name: RoyaltyInvoice_franchiseConfigId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RoyaltyInvoice_franchiseConfigId_idx" ON public."RoyaltyInvoice" USING btree ("franchiseConfigId");


--
-- TOC entry 4213 (class 1259 OID 29120)
-- Name: RoyaltyInvoice_franchiseConfigId_invoiceNo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RoyaltyInvoice_franchiseConfigId_invoiceNo_key" ON public."RoyaltyInvoice" USING btree ("franchiseConfigId", "invoiceNo");


--
-- TOC entry 4214 (class 1259 OID 29119)
-- Name: RoyaltyInvoice_periodStart_periodEnd_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RoyaltyInvoice_periodStart_periodEnd_idx" ON public."RoyaltyInvoice" USING btree ("periodStart", "periodEnd");


--
-- TOC entry 4217 (class 1259 OID 29118)
-- Name: RoyaltyInvoice_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RoyaltyInvoice_status_idx" ON public."RoyaltyInvoice" USING btree (status);


--
-- TOC entry 4218 (class 1259 OID 29123)
-- Name: RoyaltyLedger_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RoyaltyLedger_createdAt_idx" ON public."RoyaltyLedger" USING btree ("createdAt");


--
-- TOC entry 4219 (class 1259 OID 29121)
-- Name: RoyaltyLedger_franchiseConfigId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RoyaltyLedger_franchiseConfigId_idx" ON public."RoyaltyLedger" USING btree ("franchiseConfigId");


--
-- TOC entry 4220 (class 1259 OID 29122)
-- Name: RoyaltyLedger_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RoyaltyLedger_invoiceId_idx" ON public."RoyaltyLedger" USING btree ("invoiceId");


--
-- TOC entry 4112 (class 1259 OID 26823)
-- Name: SaleItem_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SaleItem_productId_idx" ON public."SaleItem" USING btree ("productId");


--
-- TOC entry 4113 (class 1259 OID 26822)
-- Name: SaleItem_saleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SaleItem_saleId_idx" ON public."SaleItem" USING btree ("saleId");


--
-- TOC entry 4104 (class 1259 OID 26819)
-- Name: Sale_customerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Sale_customerId_idx" ON public."Sale" USING btree ("customerId");


--
-- TOC entry 4107 (class 1259 OID 26820)
-- Name: Sale_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Sale_status_idx" ON public."Sale" USING btree (status);


--
-- TOC entry 4108 (class 1259 OID 26818)
-- Name: Sale_storeId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Sale_storeId_createdAt_idx" ON public."Sale" USING btree ("storeId", "createdAt");


--
-- TOC entry 4109 (class 1259 OID 26821)
-- Name: Sale_storeId_saleNo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Sale_storeId_saleNo_key" ON public."Sale" USING btree ("storeId", "saleNo");


--
-- TOC entry 4123 (class 1259 OID 26827)
-- Name: ScaleBarcodeConfig_storeId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ScaleBarcodeConfig_storeId_isActive_idx" ON public."ScaleBarcodeConfig" USING btree ("storeId", "isActive");


--
-- TOC entry 4117 (class 1259 OID 29163)
-- Name: Shift_openedByUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Shift_openedByUserId_idx" ON public."Shift" USING btree ("openedByUserId");


--
-- TOC entry 4120 (class 1259 OID 26825)
-- Name: Shift_storeId_openedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Shift_storeId_openedAt_idx" ON public."Shift" USING btree ("storeId", "openedAt");


--
-- TOC entry 4206 (class 1259 OID 29114)
-- Name: StockAllocation_franchiseStoreId_idx; Type: INDEX; Schema: public; Owner: -
--pg_dump: creating INDEX "public.StockAllocation_ownerStoreId_idx"
pg_dump: creating INDEX "public.StockAllocation_productId_idx"
pg_dump: creating INDEX "public.StockAllocation_status_idx"
pg_dump: creating INDEX "public.StoreProductPrice_storeId_productId_effectiveFrom_key"
pg_dump: creating INDEX "public.StoreProductPrice_storeId_productId_isActive_idx"
pg_dump: creating INDEX "public.Store_parentOwnerStoreId_idx"
pg_dump: creating INDEX "public.Supplier_isActive_idx"
pg_dump: creating INDEX "public.Supplier_ownerStoreId_idx"
pg_dump: creating INDEX "public.SyncEvent_storeId_deviceId_ackedAt_idx"
pg_dump: creating INDEX "public.SyncEvent_storeId_serverReceivedAt_idx"
pg_dump: creating INDEX "public.User_phone_idx"
pg_dump: creating INDEX "public.User_phone_key"
pg_dump: creating INDEX "public.User_storeId_idx"
pg_dump: creating INDEX "public.YieldIntelligence_franchiseConfigId_idx"
pg_dump: creating INDEX "public.YieldIntelligence_franchiseConfigId_productId_periodStart_p_key"
pg_dump: creating INDEX "public.YieldIntelligence_periodStart_periodEnd_idx"
pg_dump: creating INDEX "public.YieldIntelligence_productId_idx"


CREATE INDEX "StockAllocation_franchiseStoreId_idx" ON public."StockAllocation" USING btree ("franchiseStoreId");


--
-- TOC entry 4207 (class 1259 OID 29113)
-- Name: StockAllocation_ownerStoreId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StockAllocation_ownerStoreId_idx" ON public."StockAllocation" USING btree ("ownerStoreId");


--
-- TOC entry 4210 (class 1259 OID 29115)
-- Name: StockAllocation_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StockAllocation_productId_idx" ON public."StockAllocation" USING btree ("productId");


--
-- TOC entry 4211 (class 1259 OID 29116)
-- Name: StockAllocation_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StockAllocation_status_idx" ON public."StockAllocation" USING btree (status);


--
-- TOC entry 4097 (class 1259 OID 26814)
-- Name: StoreProductPrice_storeId_productId_effectiveFrom_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StoreProductPrice_storeId_productId_effectiveFrom_key" ON public."StoreProductPrice" USING btree ("storeId", "productId", "effectiveFrom");


--
-- TOC entry 4098 (class 1259 OID 26813)
-- Name: StoreProductPrice_storeId_productId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StoreProductPrice_storeId_productId_isActive_idx" ON public."StoreProductPrice" USING btree ("storeId", "productId", "isActive");


--
-- TOC entry 4071 (class 1259 OID 26801)
-- Name: Store_parentOwnerStoreId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Store_parentOwnerStoreId_idx" ON public."Store" USING btree ("parentOwnerStoreId");


--
-- TOC entry 4186 (class 1259 OID 29102)
-- Name: Supplier_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Supplier_isActive_idx" ON public."Supplier" USING btree ("isActive");


--
-- TOC entry 4187 (class 1259 OID 29101)
-- Name: Supplier_ownerStoreId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Supplier_ownerStoreId_idx" ON public."Supplier" USING btree ("ownerStoreId");


--
-- TOC entry 4160 (class 1259 OID 26846)
-- Name: SyncEvent_storeId_deviceId_ackedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SyncEvent_storeId_deviceId_ackedAt_idx" ON public."SyncEvent" USING btree ("storeId", "deviceId", "ackedAt");


--
-- TOC entry 4161 (class 1259 OID 26847)
-- Name: SyncEvent_storeId_serverReceivedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SyncEvent_storeId_serverReceivedAt_idx" ON public."SyncEvent" USING btree ("storeId", "serverReceivedAt");


--
-- TOC entry 4074 (class 1259 OID 26804)
-- Name: User_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_phone_idx" ON public."User" USING btree (phone);


--
-- TOC entry 4075 (class 1259 OID 26802)
-- Name: User_phone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_phone_key" ON public."User" USING btree (phone);


--
-- TOC entry 4078 (class 1259 OID 26803)
-- Name: User_storeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_storeId_idx" ON public."User" USING btree ("storeId");


--
-- TOC entry 4252 (class 1259 OID 29143)
-- Name: YieldIntelligence_franchiseConfigId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "YieldIntelligence_franchiseConfigId_idx" ON public."YieldIntelligence" USING btree ("franchiseConfigId");


--
-- TOC entry 4253 (class 1259 OID 29146)
-- Name: YieldIntelligence_franchiseConfigId_productId_periodStart_p_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "YieldIntelligence_franchiseConfigId_productId_periodStart_p_key" ON public."YieldIntelligence" USING btree ("franchiseConfigId", "productId", "periodStart", "periodEnd");


--
-- TOC entry 4254 (class 1259 OID 29145)
-- Name: YieldIntelligence_periodStart_periodEnd_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "YieldIntelligence_periodStart_periodEnd_idx" ON public."YieldIntelligence" USING btree ("periodStart", "periodEnd");


--
-- TOC entry 4257 (class 1259 OID 29144)
-- Name: YieldIntelligence_productId_idx;pg_dump: creating FK CONSTRAINT "public.AlertRule AlertRule_ownerStoreId_fkey"
pg_dump: creating FK CONSTRAINT "public.AuditLog AuditLog_actorUserId_fkey"
pg_dump: creating FK CONSTRAINT "public.AuditLog AuditLog_storeId_fkey"
pg_dump: creating FK CONSTRAINT "public.Category Category_ownerStoreId_fkey"
pg_dump: creating FK CONSTRAINT "public.CentralPOItem CentralPOItem_centralPOId_fkey"
pg_dump: creating FK CONSTRAINT "public.CentralPOItem CentralPOItem_productId_fkey"
pg_dump: creating FK CONSTRAINT "public.CentralPurchaseOrder CentralPurchaseOrder_ownerStoreId_fkey"
pg_dump: creating FK CONSTRAINT "public.CentralPurchaseOrder CentralPurchaseOrder_supplierId_fkey"
pg_dump: creating FK CONSTRAINT "public.ComplianceChecklistTemplate ComplianceChecklistTemplate_ownerStoreId_fkey"
pg_dump: creating FK CONSTRAINT "public.ComplianceRecord ComplianceRecord_checkedBy_fkey"
pg_dump: creating FK CONSTRAINT "public.ComplianceRecord ComplianceRecord_franchiseConfigId_fkey"
pg_dump: creating FK CONSTRAINT "public.ComplianceRecord ComplianceRecord_templateId_fkey"
 Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "YieldIntelligence_productId_idx" ON public."YieldIntelligence" USING btree ("productId");


--
-- TOC entry 4358 (class 2606 OID 29359)
-- Name: AlertRule AlertRule_ownerStoreId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AlertRule"
    ADD CONSTRAINT "AlertRule_ownerStoreId_fkey" FOREIGN KEY ("ownerStoreId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4318 (class 2606 OID 27033)
-- Name: AuditLog AuditLog_actorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4319 (class 2606 OID 27028)
-- Name: AuditLog AuditLog_storeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4288 (class 2606 OID 26878)
-- Name: Category Category_ownerStoreId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_ownerStoreId_fkey" FOREIGN KEY ("ownerStoreId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4335 (class 2606 OID 29244)
-- Name: CentralPOItem CentralPOItem_centralPOId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CentralPOItem"
    ADD CONSTRAINT "CentralPOItem_centralPOId_fkey" FOREIGN KEY ("centralPOId") REFERENCES public."CentralPurchaseOrder"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4336 (class 2606 OID 29249)
-- Name: CentralPOItem CentralPOItem_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CentralPOItem"
    ADD CONSTRAINT "CentralPOItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 4333 (class 2606 OID 29234)
-- Name: CentralPurchaseOrder CentralPurchaseOrder_ownerStoreId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CentralPurchaseOrder"
    ADD CONSTRAINT "CentralPurchaseOrder_ownerStoreId_fkey" FOREIGN KEY ("ownerStoreId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4334 (class 2606 OID 29239)
-- Name: CentralPurchaseOrder CentralPurchaseOrder_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CentralPurchaseOrder"
    ADD CONSTRAINT "CentralPurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public."Supplier"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 4350 (class 2606 OID 29319)
-- Name: ComplianceChecklistTemplate ComplianceChecklistTemplate_ownerStoreId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ComplianceChecklistTemplate"
    ADD CONSTRAINT "ComplianceChecklistTemplate_ownerStoreId_fkey" FOREIGN KEY ("ownerStoreId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4351 (class 2606 OID 29334)
-- Name: ComplianceRecord ComplianceRecord_checkedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ComplianceRecord"
    ADD CONSTRAINT "ComplianceRecord_checkedBy_fkey" FOREIGN KEY ("checkedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 4352 (class 2606 OID 29324)
-- Name: ComplianceRecord ComplianceRecord_franchiseConfigId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ComplianceRecord"
    ADD CONSTRAINT "ComplianceRecord_franchiseConfigId_fkey" FOREIGN KEY ("franchiseConfigId") REFERENCES public."FranchiseConfig"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4353 (class 2606 OID 29329)
-- Name: ComplianceRecord ComplianceRecord_templateId_fkey; Type: FK CONSTRAINT; Schema: pupg_dump: creating FK CONSTRAINT "public.CustomerAddress CustomerAddress_customerId_fkey"
pg_dump: creating FK CONSTRAINT "public.Customer Customer_storeId_fkey"
pg_dump: creating FK CONSTRAINT "public.DailyClosing DailyClosing_closedBy_fkey"
pg_dump: creating FK CONSTRAINT "public.DailyClosing DailyClosing_shiftId_fkey"
pg_dump: creating FK CONSTRAINT "public.DailyClosing DailyClosing_storeId_fkey"
pg_dump: creating FK CONSTRAINT "public.DeliveryEvent DeliveryEvent_createdBy_fkey"
pg_dump: creating FK CONSTRAINT "public.DeliveryEvent DeliveryEvent_deliveryOrderId_fkey"
pg_dump: creating FK CONSTRAINT "public.DeliveryOrder DeliveryOrder_addressId_fkey"
pg_dump: creating FK CONSTRAINT "public.DeliveryOrder DeliveryOrder_assignedDriverId_fkey"
pg_dump: creating FK CONSTRAINT "public.DeliveryOrder DeliveryOrder_saleId_fkey"
pg_dump: creating FK CONSTRAINT "public.DeliveryOrder DeliveryOrder_storeId_fkey"
pg_dump: creating FK CONSTRAINT "public.DiscountOverride DiscountOverride_approvedBy_fkey"
blic; Owner: -
--

ALTER TABLE ONLY public."ComplianceRecord"
    ADD CONSTRAINT "ComplianceRecord_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public."ComplianceChecklistTemplate"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4285 (class 2606 OID 26863)
-- Name: CustomerAddress CustomerAddress_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerAddress"
    ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4284 (class 2606 OID 26858)
-- Name: Customer Customer_storeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4369 (class 2606 OID 29424)
-- Name: DailyClosing DailyClosing_closedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DailyClosing"
    ADD CONSTRAINT "DailyClosing_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 4370 (class 2606 OID 29419)
-- Name: DailyClosing DailyClosing_shiftId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DailyClosing"
    ADD CONSTRAINT "DailyClosing_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES public."Shift"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4371 (class 2606 OID 29414)
-- Name: DailyClosing DailyClosing_storeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DailyClosing"
    ADD CONSTRAINT "DailyClosing_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4316 (class 2606 OID 27023)
-- Name: DeliveryEvent DeliveryEvent_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeliveryEvent"
    ADD CONSTRAINT "DeliveryEvent_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 4317 (class 2606 OID 27018)
-- Name: DeliveryEvent DeliveryEvent_deliveryOrderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeliveryEvent"
    ADD CONSTRAINT "DeliveryEvent_deliveryOrderId_fkey" FOREIGN KEY ("deliveryOrderId") REFERENCES public."DeliveryOrder"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4312 (class 2606 OID 27013)
-- Name: DeliveryOrder DeliveryOrder_addressId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeliveryOrder"
    ADD CONSTRAINT "DeliveryOrder_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES public."CustomerAddress"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4313 (class 2606 OID 27008)
-- Name: DeliveryOrder DeliveryOrder_assignedDriverId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeliveryOrder"
    ADD CONSTRAINT "DeliveryOrder_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4314 (class 2606 OID 27003)
-- Name: DeliveryOrder DeliveryOrder_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeliveryOrder"
    ADD CONSTRAINT "DeliveryOrder_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public."Sale"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4315 (class 2606 OID 26998)
-- Name: DeliveryOrder DeliveryOrder_storeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeliveryOrder"
    ADD CONSTRAINT "DeliveryOrder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4365 (class 2606 OID 29409)
-- Name: DiscountOverride DiscountOverride_approvedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DiscountOverride"
    ADD pg_dump: creating FK CONSTRAINT "public.DiscountOverride DiscountOverride_requestedBy_fkey"
pg_dump: creating FK CONSTRAINT "public.DiscountOverride DiscountOverride_saleId_fkey"
pg_dump: creating FK CONSTRAINT "public.DiscountOverride DiscountOverride_storeId_fkey"
pg_dump: creating FK CONSTRAINT "public.DispatchItem DispatchItem_dispatchId_fkey"
pg_dump: creating FK CONSTRAINT "public.DispatchItem DispatchItem_productId_fkey"
pg_dump: creating FK CONSTRAINT "public.Dispatch Dispatch_poId_fkey"
pg_dump: creating FK CONSTRAINT "public.FranchiseConfig FranchiseConfig_areaManagerId_fkey"
pg_dump: creating FK CONSTRAINT "public.FranchiseConfig FranchiseConfig_franchiseStoreId_fkey"
pg_dump: creating FK CONSTRAINT "public.FranchiseConfig FranchiseConfig_pricingPlanId_fkey"
pg_dump: creating FK CONSTRAINT "public.FranchiseHealthScore FranchiseHealthScore_franchiseConfigId_fkey"
pg_dump: creating FK CONSTRAINT "public.GRN GRN_dispatchId_fkey"
pg_dump: creating FK CONSTRAINT "public.GRN GRN_receivedBy_fkey"
CONSTRAINT "DiscountOverride_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4366 (class 2606 OID 29404)
-- Name: DiscountOverride DiscountOverride_requestedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DiscountOverride"
    ADD CONSTRAINT "DiscountOverride_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 4367 (class 2606 OID 29394)
-- Name: DiscountOverride DiscountOverride_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DiscountOverride"
    ADD CONSTRAINT "DiscountOverride_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public."Sale"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4368 (class 2606 OID 29399)
-- Name: DiscountOverride DiscountOverride_storeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DiscountOverride"
    ADD CONSTRAINT "DiscountOverride_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4308 (class 2606 OID 26978)
-- Name: DispatchItem DispatchItem_dispatchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DispatchItem"
    ADD CONSTRAINT "DispatchItem_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES public."Dispatch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4309 (class 2606 OID 26983)
-- Name: DispatchItem DispatchItem_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DispatchItem"
    ADD CONSTRAINT "DispatchItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 4307 (class 2606 OID 26973)
-- Name: Dispatch Dispatch_poId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Dispatch"
    ADD CONSTRAINT "Dispatch_poId_fkey" FOREIGN KEY ("poId") REFERENCES public."PurchaseOrder"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4321 (class 2606 OID 29184)
-- Name: FranchiseConfig FranchiseConfig_areaManagerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FranchiseConfig"
    ADD CONSTRAINT "FranchiseConfig_areaManagerId_fkey" FOREIGN KEY ("areaManagerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4322 (class 2606 OID 29174)
-- Name: FranchiseConfig FranchiseConfig_franchiseStoreId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FranchiseConfig"
    ADD CONSTRAINT "FranchiseConfig_franchiseStoreId_fkey" FOREIGN KEY ("franchiseStoreId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4323 (class 2606 OID 29179)
-- Name: FranchiseConfig FranchiseConfig_pricingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FranchiseConfig"
    ADD CONSTRAINT "FranchiseConfig_pricingPlanId_fkey" FOREIGN KEY ("pricingPlanId") REFERENCES public."PricingPlan"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4359 (class 2606 OID 29364)
-- Name: FranchiseHealthScore FranchiseHealthScore_franchiseConfigId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FranchiseHealthScore"
    ADD CONSTRAINT "FranchiseHealthScore_franchiseConfigId_fkey" FOREIGN KEY ("franchiseConfigId") REFERENCES public."FranchiseConfig"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4310 (class 2606 OID 26988)
-- Name: GRN GRN_dispatchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GRN"
    ADD CONSTRAINT "GRN_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES public."Dispatch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4311 (class 2606 OID 26993)
-- Name: GRN GRN_receivedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GRN"
    ADD CONSTRAINT "GRN_receivedBy_fkey"pg_dump: creating FK CONSTRAINT "public.HQAlert HQAlert_acknowledgedBy_fkey"
pg_dump: creating FK CONSTRAINT "public.HQAlert HQAlert_franchiseStoreId_fkey"
pg_dump: creating FK CONSTRAINT "public.HQAlert HQAlert_ownerStoreId_fkey"
pg_dump: creating FK CONSTRAINT "public.HQAlert HQAlert_resolvedBy_fkey"
pg_dump: creating FK CONSTRAINT "public.InventoryLedger InventoryLedger_productId_fkey"
pg_dump: creating FK CONSTRAINT "public.InventoryLedger InventoryLedger_storeId_fkey"
pg_dump: creating FK CONSTRAINT "public.InwardStock InwardStock_centralPOId_fkey"
pg_dump: creating FK CONSTRAINT "public.InwardStock InwardStock_ownerStoreId_fkey"
pg_dump: creating FK CONSTRAINT "public.InwardStock InwardStock_productId_fkey"
pg_dump: creating FK CONSTRAINT "public.InwardStock InwardStock_receivedBy_fkey"
pg_dump: creating FK CONSTRAINT "public.InwardStock InwardStock_supplierId_fkey"
pg_dump: creating FK CONSTRAINT "public.LoyaltyTransaction LoyaltyTransaction_customerId_fkey"
pg_dump: creating FK CONSTRAINT "public.LoyaltyTransaction LoyaltyTransaction_saleId_fkey"
 FOREIGN KEY ("receivedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 4354 (class 2606 OID 29354)
-- Name: HQAlert HQAlert_acknowledgedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HQAlert"
    ADD CONSTRAINT "HQAlert_acknowledgedBy_fkey" FOREIGN KEY ("acknowledgedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4355 (class 2606 OID 29344)
-- Name: HQAlert HQAlert_franchiseStoreId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HQAlert"
    ADD CONSTRAINT "HQAlert_franchiseStoreId_fkey" FOREIGN KEY ("franchiseStoreId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4356 (class 2606 OID 29339)
-- Name: HQAlert HQAlert_ownerStoreId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HQAlert"
    ADD CONSTRAINT "HQAlert_ownerStoreId_fkey" FOREIGN KEY ("ownerStoreId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4357 (class 2606 OID 29349)
-- Name: HQAlert HQAlert_resolvedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HQAlert"
    ADD CONSTRAINT "HQAlert_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4291 (class 2606 OID 26898)
-- Name: InventoryLedger InventoryLedger_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryLedger"
    ADD CONSTRAINT "InventoryLedger_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4292 (class 2606 OID 26893)
-- Name: InventoryLedger InventoryLedger_storeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryLedger"
    ADD CONSTRAINT "InventoryLedger_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4337 (class 2606 OID 29259)
-- Name: InwardStock InwardStock_centralPOId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InwardStock"
    ADD CONSTRAINT "InwardStock_centralPOId_fkey" FOREIGN KEY ("centralPOId") REFERENCES public."CentralPurchaseOrder"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4338 (class 2606 OID 29254)
-- Name: InwardStock InwardStock_ownerStoreId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InwardStock"
    ADD CONSTRAINT "InwardStock_ownerStoreId_fkey" FOREIGN KEY ("ownerStoreId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4339 (class 2606 OID 29269)
-- Name: InwardStock InwardStock_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InwardStock"
    ADD CONSTRAINT "InwardStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 4340 (class 2606 OID 29274)
-- Name: InwardStock InwardStock_receivedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InwardStock"
    ADD CONSTRAINT "InwardStock_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 4341 (class 2606 OID 29264)
-- Name: InwardStock InwardStock_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InwardStock"
    ADD CONSTRAINT "InwardStock_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public."Supplier"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 4372 (class 2606 OID 29429)
-- Name: LoyaltyTransaction LoyaltyTransaction_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LoyaltyTransaction"
    ADD CONSTRAINT "LoyaltyTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4373 pg_dump: creating FK CONSTRAINT "public.LoyaltyTransaction LoyaltyTransaction_storeId_fkey"
pg_dump: creating FK CONSTRAINT "public.Payment Payment_saleId_fkey"
pg_dump: creating FK CONSTRAINT "public.PricingOverride PricingOverride_approvedByUserId_fkey"
pg_dump: creating FK CONSTRAINT "public.PricingOverride PricingOverride_franchiseConfigId_fkey"
pg_dump: creating FK CONSTRAINT "public.PricingOverride PricingOverride_productId_fkey"
pg_dump: creating FK CONSTRAINT "public.PricingRule PricingRule_categoryId_fkey"
pg_dump: creating FK CONSTRAINT "public.PricingRule PricingRule_pricingPlanId_fkey"
pg_dump: creating FK CONSTRAINT "public.PricingRule PricingRule_productId_fkey"
pg_dump: creating FK CONSTRAINT "public.ProductMaster ProductMaster_ownerStoreId_fkey"
pg_dump: creating FK CONSTRAINT "public.ProductMaster ProductMaster_productId_fkey"
pg_dump: creating FK CONSTRAINT "public.Product Product_categoryId_fkey"
pg_dump: creating FK CONSTRAINT "public.Product Product_ownerStoreId_fkey"
(class 2606 OID 29439)
-- Name: LoyaltyTransaction LoyaltyTransaction_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LoyaltyTransaction"
    ADD CONSTRAINT "LoyaltyTransaction_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public."Sale"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4374 (class 2606 OID 29434)
-- Name: LoyaltyTransaction LoyaltyTransaction_storeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LoyaltyTransaction"
    ADD CONSTRAINT "LoyaltyTransaction_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4298 (class 2606 OID 26928)
-- Name: Payment Payment_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public."Sale"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4327 (class 2606 OID 29214)
-- Name: PricingOverride PricingOverride_approvedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PricingOverride"
    ADD CONSTRAINT "PricingOverride_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4328 (class 2606 OID 29204)
-- Name: PricingOverride PricingOverride_franchiseConfigId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PricingOverride"
    ADD CONSTRAINT "PricingOverride_franchiseConfigId_fkey" FOREIGN KEY ("franchiseConfigId") REFERENCES public."FranchiseConfig"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4329 (class 2606 OID 29209)
-- Name: PricingOverride PricingOverride_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PricingOverride"
    ADD CONSTRAINT "PricingOverride_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 4324 (class 2606 OID 29199)
-- Name: PricingRule PricingRule_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PricingRule"
    ADD CONSTRAINT "PricingRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4325 (class 2606 OID 29189)
-- Name: PricingRule PricingRule_pricingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PricingRule"
    ADD CONSTRAINT "PricingRule_pricingPlanId_fkey" FOREIGN KEY ("pricingPlanId") REFERENCES public."PricingPlan"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4326 (class 2606 OID 29194)
-- Name: PricingRule PricingRule_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PricingRule"
    ADD CONSTRAINT "PricingRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4330 (class 2606 OID 29219)
-- Name: ProductMaster ProductMaster_ownerStoreId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductMaster"
    ADD CONSTRAINT "ProductMaster_ownerStoreId_fkey" FOREIGN KEY ("ownerStoreId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4331 (class 2606 OID 29224)
-- Name: ProductMaster ProductMaster_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductMaster"
    ADD CONSTRAINT "ProductMaster_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4286 (class 2606 OID 26873)
-- Name: Product Product_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 4287 (class 2606 OID 26868)
-- Name: Product Ppg_dump: creating FK CONSTRAINT "public.PurchaseOrderItem PurchaseOrderItem_poId_fkey"
pg_dump: creating FK CONSTRAINT "public.PurchaseOrderItem PurchaseOrderItem_productId_fkey"
pg_dump: creating FK CONSTRAINT "public.PurchaseOrder PurchaseOrder_franchiseStoreId_fkey"
pg_dump: creating FK CONSTRAINT "public.PurchaseOrder PurchaseOrder_ownerStoreId_fkey"
pg_dump: creating FK CONSTRAINT "public.ReplenishmentRequest ReplenishmentRequest_approvedBy_fkey"
pg_dump: creating FK CONSTRAINT "public.ReplenishmentRequest ReplenishmentRequest_franchiseStoreId_fkey"
pg_dump: creating FK CONSTRAINT "public.ReplenishmentRequest ReplenishmentRequest_productId_fkey"
pg_dump: creating FK CONSTRAINT "public.RoyaltyInvoice RoyaltyInvoice_franchiseConfigId_fkey"
pg_dump: creating FK CONSTRAINT "public.RoyaltyLedger RoyaltyLedger_franchiseConfigId_fkey"
pg_dump: creating FK CONSTRAINT "public.RoyaltyLedger RoyaltyLedger_invoiceId_fkey"
pg_dump: creating FK CONSTRAINT "public.SaleItem SaleItem_productId_fkey"
roduct_ownerStoreId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_ownerStoreId_fkey" FOREIGN KEY ("ownerStoreId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4305 (class 2606 OID 26963)
-- Name: PurchaseOrderItem PurchaseOrderItem_poId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrderItem"
    ADD CONSTRAINT "PurchaseOrderItem_poId_fkey" FOREIGN KEY ("poId") REFERENCES public."PurchaseOrder"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4306 (class 2606 OID 26968)
-- Name: PurchaseOrderItem PurchaseOrderItem_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrderItem"
    ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 4303 (class 2606 OID 26953)
-- Name: PurchaseOrder PurchaseOrder_franchiseStoreId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrder"
    ADD CONSTRAINT "PurchaseOrder_franchiseStoreId_fkey" FOREIGN KEY ("franchiseStoreId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4304 (class 2606 OID 26958)
-- Name: PurchaseOrder PurchaseOrder_ownerStoreId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrder"
    ADD CONSTRAINT "PurchaseOrder_ownerStoreId_fkey" FOREIGN KEY ("ownerStoreId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4362 (class 2606 OID 29389)
-- Name: ReplenishmentRequest ReplenishmentRequest_approvedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReplenishmentRequest"
    ADD CONSTRAINT "ReplenishmentRequest_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4363 (class 2606 OID 29379)
-- Name: ReplenishmentRequest ReplenishmentRequest_franchiseStoreId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReplenishmentRequest"
    ADD CONSTRAINT "ReplenishmentRequest_franchiseStoreId_fkey" FOREIGN KEY ("franchiseStoreId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4364 (class 2606 OID 29384)
-- Name: ReplenishmentRequest ReplenishmentRequest_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReplenishmentRequest"
    ADD CONSTRAINT "ReplenishmentRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4347 (class 2606 OID 29304)
-- Name: RoyaltyInvoice RoyaltyInvoice_franchiseConfigId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RoyaltyInvoice"
    ADD CONSTRAINT "RoyaltyInvoice_franchiseConfigId_fkey" FOREIGN KEY ("franchiseConfigId") REFERENCES public."FranchiseConfig"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4348 (class 2606 OID 29309)
-- Name: RoyaltyLedger RoyaltyLedger_franchiseConfigId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RoyaltyLedger"
    ADD CONSTRAINT "RoyaltyLedger_franchiseConfigId_fkey" FOREIGN KEY ("franchiseConfigId") REFERENCES public."FranchiseConfig"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4349 (class 2606 OID 29314)
-- Name: RoyaltyLedger RoyaltyLedger_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RoyaltyLedger"
    ADD CONSTRAINT "RoyaltyLedger_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."RoyaltyInvoice"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4296 (class 2606 OID 26923)
-- Name: SaleItem SaleItem_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SaleItem"
    ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(pg_dump: creating FK CONSTRAINT "public.SaleItem SaleItem_saleId_fkey"
pg_dump: creating FK CONSTRAINT "public.Sale Sale_createdByUserId_fkey"
pg_dump: creating FK CONSTRAINT "public.Sale Sale_customerId_fkey"
pg_dump: creating FK CONSTRAINT "public.Sale Sale_storeId_fkey"
pg_dump: creating FK CONSTRAINT "public.ScaleBarcodeConfig ScaleBarcodeConfig_storeId_fkey"
pg_dump: creating FK CONSTRAINT "public.Shift Shift_closedByUserId_fkey"
pg_dump: creating FK CONSTRAINT "public.Shift Shift_openedByUserId_fkey"
pg_dump: creating FK CONSTRAINT "public.Shift Shift_storeId_fkey"
pg_dump: creating FK CONSTRAINT "public.StockAllocation StockAllocation_centralPOId_fkey"
pg_dump: creating FK CONSTRAINT "public.StockAllocation StockAllocation_franchiseStoreId_fkey"
pg_dump: creating FK CONSTRAINT "public.StockAllocation StockAllocation_inwardStockId_fkey"
pg_dump: creating FK CONSTRAINT "public.StockAllocation StockAllocation_ownerStoreId_fkey"
pg_dump: creating FK CONSTRAINT "public.StockAllocation StockAllocation_productId_fkey"
id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 4297 (class 2606 OID 26918)
-- Name: SaleItem SaleItem_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SaleItem"
    ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public."Sale"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4293 (class 2606 OID 26913)
-- Name: Sale Sale_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Sale"
    ADD CONSTRAINT "Sale_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 4294 (class 2606 OID 26908)
-- Name: Sale Sale_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Sale"
    ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4295 (class 2606 OID 26903)
-- Name: Sale Sale_storeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Sale"
    ADD CONSTRAINT "Sale_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4302 (class 2606 OID 26948)
-- Name: ScaleBarcodeConfig ScaleBarcodeConfig_storeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScaleBarcodeConfig"
    ADD CONSTRAINT "ScaleBarcodeConfig_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4299 (class 2606 OID 29169)
-- Name: Shift Shift_closedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Shift"
    ADD CONSTRAINT "Shift_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4300 (class 2606 OID 29164)
-- Name: Shift Shift_openedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Shift"
    ADD CONSTRAINT "Shift_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 4301 (class 2606 OID 26933)
-- Name: Shift Shift_storeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Shift"
    ADD CONSTRAINT "Shift_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4342 (class 2606 OID 29284)
-- Name: StockAllocation StockAllocation_centralPOId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockAllocation"
    ADD CONSTRAINT "StockAllocation_centralPOId_fkey" FOREIGN KEY ("centralPOId") REFERENCES public."CentralPurchaseOrder"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4343 (class 2606 OID 29294)
-- Name: StockAllocation StockAllocation_franchiseStoreId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockAllocation"
    ADD CONSTRAINT "StockAllocation_franchiseStoreId_fkey" FOREIGN KEY ("franchiseStoreId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4344 (class 2606 OID 29289)
-- Name: StockAllocation StockAllocation_inwardStockId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockAllocation"
    ADD CONSTRAINT "StockAllocation_inwardStockId_fkey" FOREIGN KEY ("inwardStockId") REFERENCES public."InwardStock"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4345 (class 2606 OID 29279)
-- Name: StockAllocation StockAllocation_ownerStoreId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockAllocation"
    ADD CONSTRAINT "StockAllocation_ownerStoreId_fkey" FOREIGN KEY ("ownerStoreId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4346 (class 2606 OID 29299)
-- Name: StockAllocation StockAllocation_productId_fkey; Type: FK CONSTRAINT; Schema: public; Ownepg_dump: creating FK CONSTRAINT "public.StoreProductPrice StoreProductPrice_productId_fkey"
pg_dump: creating FK CONSTRAINT "public.StoreProductPrice StoreProductPrice_storeId_fkey"
pg_dump: creating FK CONSTRAINT "public.Store Store_parentOwnerStoreId_fkey"
pg_dump: creating FK CONSTRAINT "public.Supplier Supplier_ownerStoreId_fkey"
pg_dump: creating FK CONSTRAINT "public.SyncEvent SyncEvent_storeId_fkey"
pg_dump: creating FK CONSTRAINT "public.User User_storeId_fkey"
pg_dump: creating FK CONSTRAINT "public.YieldIntelligence YieldIntelligence_franchiseConfigId_fkey"
pg_dump: creating FK CONSTRAINT "public.YieldIntelligence YieldIntelligence_productId_fkey"
r: -
--

ALTER TABLE ONLY public."StockAllocation"
    ADD CONSTRAINT "StockAllocation_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 4289 (class 2606 OID 26888)
-- Name: StoreProductPrice StoreProductPrice_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StoreProductPrice"
    ADD CONSTRAINT "StoreProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4290 (class 2606 OID 26883)
-- Name: StoreProductPrice StoreProductPrice_storeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StoreProductPrice"
    ADD CONSTRAINT "StoreProductPrice_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4282 (class 2606 OID 26848)
-- Name: Store Store_parentOwnerStoreId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Store"
    ADD CONSTRAINT "Store_parentOwnerStoreId_fkey" FOREIGN KEY ("parentOwnerStoreId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4332 (class 2606 OID 29229)
-- Name: Supplier Supplier_ownerStoreId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Supplier"
    ADD CONSTRAINT "Supplier_ownerStoreId_fkey" FOREIGN KEY ("ownerStoreId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4320 (class 2606 OID 27038)
-- Name: SyncEvent SyncEvent_storeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SyncEvent"
    ADD CONSTRAINT "SyncEvent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4283 (class 2606 OID 26853)
-- Name: User User_storeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES public."Store"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4360 (class 2606 OID 29369)
-- Name: YieldIntelligence YieldIntelligence_franchiseConfigId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."YieldIntelligence"
    ADD CONSTRAINT "YieldIntelligence_franchiseConfigId_fkey" FOREIGN KEY ("franchiseConfigId") REFERENCES public."FranchiseConfig"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4361 (class 2606 OID 29374)
-- Name: YieldIntelligence YieldIntelligence_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."YieldIntelligence"
    ADD CONSTRAINT "YieldIntelligence_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE SET NULL;


-- Completed on 2026-01-05 21:36:50 IST

--
-- PostgreSQL database dump complete
--

\unrestrict VV6J9ozEmGiRh3gVl6A9A6ZWjhiiD4nahvBoNEoOiIpnORNw1cxKyZjwPhLoE1l

