--
-- PostgreSQL database dump
--

\restrict fnJFmGoWeAMNshUxtdc1o0LYfEca76fspyVFBhXvupuhWX6bKp6HBQkNukjgbJN

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.0 (Postgres.app)

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
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) FROM stdin;
\.


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.flow_state (id, user_id, auth_code, code_challenge_method, code_challenge, provider_type, provider_access_token, provider_refresh_token, created_at, updated_at, authentication_method, auth_code_issued_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) FROM stdin;
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id) FROM stdin;
\.


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.instances (id, uuid, raw_base_config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.oauth_clients (id, client_secret_hash, registration_type, redirect_uris, grant_types, client_name, client_uri, logo_uri, created_at, updated_at, deleted_at, client_type) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.sessions (id, user_id, created_at, updated_at, factor_id, aal, not_after, refreshed_at, user_agent, ip, tag, oauth_client_id, refresh_token_hmac_key, refresh_token_counter, scopes) FROM stdin;
\.


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method, id) FROM stdin;
\.


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret, phone, last_challenged_at, web_authn_credential, web_authn_aaguid, last_webauthn_challenge_data) FROM stdin;
\.


--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.mfa_challenges (id, factor_id, created_at, verified_at, ip_address, otp_code, web_authn_session_data) FROM stdin;
\.


--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.oauth_authorizations (id, authorization_id, client_id, user_id, redirect_uri, scope, state, resource, code_challenge, code_challenge_method, response_type, status, authorization_code, created_at, expires_at, approved_at, nonce) FROM stdin;
\.


--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.oauth_client_states (id, provider_type, code_verifier, created_at) FROM stdin;
\.


--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.oauth_consents (id, user_id, client_id, scopes, granted_at, revoked_at) FROM stdin;
\.


--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.one_time_tokens (id, user_id, token_type, token_hash, relates_to, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) FROM stdin;
\.


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.sso_providers (id, resource_id, created_at, updated_at, disabled) FROM stdin;
\.


--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.saml_providers (id, sso_provider_id, entity_id, metadata_xml, metadata_url, attribute_mapping, created_at, updated_at, name_id_format) FROM stdin;
\.


--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.saml_relay_states (id, sso_provider_id, request_id, for_email, redirect_to, created_at, updated_at, flow_state_id) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.schema_migrations (version) FROM stdin;
20171026211738
20171026211808
20171026211834
20180103212743
20180108183307
20180119214651
20180125194653
00
20210710035447
20210722035447
20210730183235
20210909172000
20210927181326
20211122151130
20211124214934
20211202183645
20220114185221
20220114185340
20220224000811
20220323170000
20220429102000
20220531120530
20220614074223
20220811173540
20221003041349
20221003041400
20221011041400
20221020193600
20221021073300
20221021082433
20221027105023
20221114143122
20221114143410
20221125140132
20221208132122
20221215195500
20221215195800
20221215195900
20230116124310
20230116124412
20230131181311
20230322519590
20230402418590
20230411005111
20230508135423
20230523124323
20230818113222
20230914180801
20231027141322
20231114161723
20231117164230
20240115144230
20240214120130
20240306115329
20240314092811
20240427152123
20240612123726
20240729123726
20240802193726
20240806073726
20241009103726
20250717082212
20250731150234
20250804100000
20250901200500
20250903112500
20250904133000
20250925093508
20251007112900
20251104100000
20251111201300
20251201000000
\.


--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.sso_domains (id, sso_provider_id, domain, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: Store; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Store" (id, name, type, "parentOwnerStoreId", "createdAt", "updatedAt") FROM stdin;
cmjten76p0000viumjxwes8nz	Main Owner Store	OWNER	\N	2025-12-31 02:36:30.626	2025-12-31 02:36:30.626
cmjten7ko0002viumzdic2lbf	Franchise Store 1	FRANCHISE	cmjten76p0000viumjxwes8nz	2025-12-31 02:36:31.128	2025-12-31 02:36:31.128
\.


--
-- Data for Name: AlertRule; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AlertRule" (id, "ownerStoreId", name, "ruleType", threshold, severity, "isActive", description, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, "storeId", name, phone, email, role, "passwordHash", "isActive", "createdAt", "updatedAt") FROM stdin;
cmjten85j0004viumsifvy7nr	cmjten76p0000viumjxwes8nz	Owner User	9999999999	owner@azela.com	OWNER	$2a$10$VXyivEH2nhc.HLYFJkE1c.L6mKEQcU0M6iqAZKbofL9fYR.4HGYjq	t	2025-12-31 02:36:31.879	2025-12-31 02:36:31.879
cmjten8jh0006vium78ek3p0s	cmjten7ko0002viumzdic2lbf	Manager User	8888888888	manager@azela.com	MANAGER	$2a$10$TymNQkoZKoqBDrN5uTZvMu9ztRJsADSQ4yCDyGkuXWr3ITq/FmPtC	t	2025-12-31 02:36:32.381	2025-12-31 02:36:32.381
cmjten8qk0008viumbzkrvtz3	cmjten7ko0002viumzdic2lbf	Cashier User	7777777777	cashier@azela.com	CASHIER	$2a$10$trIhq4xc6OMe9LBDbUXE4.LBUWF7cgRnuULlOb7hFME6R3o44b3Bq	t	2025-12-31 02:36:32.636	2025-12-31 02:36:32.636
cmjten8xg000aviumsq4s5tq8	cmjten7ko0002viumzdic2lbf	Driver User	6666666666	driver@azela.com	DRIVER	$2a$10$c4O3Tvspw8FiHlYAEuipZ.GzqH9EWBQ3lLaMdyyKHokLtD0zKVZxi	t	2025-12-31 02:36:32.885	2025-12-31 02:36:32.885
\.


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AuditLog" (id, "storeId", "actorUserId", action, "entityType", "entityId", "metaJson", "createdAt") FROM stdin;
\.


--
-- Data for Name: Category; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Category" (id, "ownerStoreId", name, "sortOrder", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Supplier; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Supplier" (id, "ownerStoreId", name, "contactName", phone, email, address, city, state, zip, gstin, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: CentralPurchaseOrder; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CentralPurchaseOrder" (id, "ownerStoreId", "supplierId", "poNo", "orderDate", "expectedDate", status, "totalAmount", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Product; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Product" (id, "ownerStoreId", sku, plu, name, "categoryId", "unitType", "taxRate", "isActive", "createdAt", "updatedAt", "imageUrl") FROM stdin;
\.


--
-- Data for Name: CentralPOItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CentralPOItem" (id, "centralPOId", "productId", "qtyKg", "qtyPcs", "unitRate", "totalAmount", "createdAt") FROM stdin;
\.


--
-- Data for Name: ComplianceChecklistTemplate; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ComplianceChecklistTemplate" (id, "ownerStoreId", name, "checkType", items, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: PricingPlan; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PricingPlan" (id, name, type, description, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: FranchiseConfig; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."FranchiseConfig" (id, "franchiseStoreId", status, "pricingPlanId", "royaltyPercentage", "royaltyCalculationBase", "allowedWastagePercent", "allowedDiscountPercent", "areaManagerId", "onboardingCompletedAt", "onboardingData", "isPricingLocked", "isDiscountLocked", "isWastageLocked", "lockedBy", "lockedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ComplianceRecord; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ComplianceRecord" (id, "franchiseConfigId", "templateId", "checkType", status, "checkedBy", "checkedAt", temperature, "photoUrl", "documentUrl", "expiryDate", notes, score, "submissionData", "reviewedBy", "reviewedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Customer; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Customer" (id, "storeId", name, phone, email, "createdAt", "updatedAt", "loyaltyPoints", "loyaltyTier", "totalSpent") FROM stdin;
\.


--
-- Data for Name: CustomerAddress; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CustomerAddress" (id, "customerId", label, line1, line2, city, state, zip, "geoLat", "geoLng", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Shift; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Shift" (id, "storeId", "openedAt", "closedAt", "createdAt", "updatedAt", "closedByUserId", "closingCash", notes, "openedByUserId", "openingCash") FROM stdin;
\.


--
-- Data for Name: DailyClosing; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DailyClosing" (id, "storeId", "shiftId", "closingDate", "closedBy", "openingCash", "cashSales", "cardSales", "upiSales", "cashReceived", "cashExpected", "cashDifference", "closingCash", "totalWeightSoldKg", "totalWastageKg", "closingStockJson", "totalSales", "totalRevenue", "totalDiscounts", "totalTax", notes, "isFinalized", "finalizedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Sale; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Sale" (id, "storeId", "saleNo", "customerId", status, "subTotal", "discountTotal", "taxTotal", "grandTotal", "createdByUserId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: DeliveryOrder; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DeliveryOrder" (id, "storeId", "saleId", type, status, "assignedDriverId", "deliveryFee", "addressId", "otpCodeHash", "outForDeliveryAt", "deliveredAt", "failureReason", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: DeliveryEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DeliveryEvent" (id, "deliveryOrderId", status, note, "createdBy", "createdAt") FROM stdin;
\.


--
-- Data for Name: DiscountOverride; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DiscountOverride" (id, "saleId", "storeId", "requestedBy", "approvedBy", "originalDiscount", "overrideDiscount", reason, status, "approvedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: PurchaseOrder; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PurchaseOrder" (id, "franchiseStoreId", "ownerStoreId", "poNo", status, notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Dispatch; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Dispatch" (id, "poId", "dispatchNo", status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: DispatchItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DispatchItem" (id, "dispatchId", "productId", "qtyKg", "qtyPcs", "createdAt") FROM stdin;
\.


--
-- Data for Name: FranchiseHealthScore; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."FranchiseHealthScore" (id, "franchiseConfigId", "scoreDate", "salesGrowthScore", "yieldEfficiencyScore", "wastageScore", "discountScore", "complianceScore", "stockVarianceScore", "overallScore", "salesGrowthPercent", "yieldEfficiencyPercent", "wastagePercent", "discountPercent", "compliancePercent", "stockVariancePercent", metadata, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: GRN; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."GRN" (id, "dispatchId", "receivedBy", "receivedAt", status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: HQAlert; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."HQAlert" (id, "ownerStoreId", "franchiseStoreId", "alertType", severity, title, message, metadata, "isRead", "isResolved", "resolvedBy", "resolvedAt", "acknowledgedBy", "acknowledgedAt", "acknowledgmentNotes", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: InventoryLedger; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InventoryLedger" (id, "storeId", "productId", type, "qtyKg", "qtyPcs", reason, "refId", "createdAt") FROM stdin;
\.


--
-- Data for Name: InwardStock; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InwardStock" (id, "ownerStoreId", "centralPOId", "supplierId", "productId", "batchNo", "totalWeightKg", "temperatureCheck", "receivedBy", "receivedAt", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: LoyaltyTransaction; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."LoyaltyTransaction" (id, "customerId", "storeId", type, points, balance, description, "saleId", "createdAt", "createdBy") FROM stdin;
\.


--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Payment" (id, "saleId", method, amount, "txnRef", "createdAt") FROM stdin;
\.


--
-- Data for Name: PricingOverride; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PricingOverride" (id, "franchiseConfigId", "productId", "overridePrice", "lockStatus", "approvedByHQ", "approvedByUserId", "approvedAt", reason, "effectiveFrom", "effectiveTo", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: PricingRule; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PricingRule" (id, "pricingPlanId", "productId", "categoryId", "basePrice", "minPrice", "maxPrice", "effectiveFrom", "effectiveTo", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ProductMaster; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProductMaster" (id, "ownerStoreId", "productId", "productType", "expectedYieldPercent", "wastageTolerancePercent", "taxCategory", "hqLockedPrice", "isHQLocked", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: PurchaseOrderItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PurchaseOrderItem" (id, "poId", "productId", "qtyKg", "qtyPcs", "requestedRate", "createdAt") FROM stdin;
\.


--
-- Data for Name: ReplenishmentRequest; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ReplenishmentRequest" (id, "franchiseStoreId", "productId", "salesVelocity7d", "salesVelocity14d", "salesVelocity30d", "currentStockKg", "currentStockPcs", "requestedQtyKg", "requestedQtyPcs", "leadTimeDays", "safetyBufferDays", "calculatedDemandKg", "calculatedDemandPcs", status, "approvedBy", "approvedAt", "approvalNotes", "adjustedQtyKg", "adjustedQtyPcs", "adjustmentReason", "requestedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: RoyaltyInvoice; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RoyaltyInvoice" (id, "franchiseConfigId", "invoiceNo", "periodStart", "periodEnd", "grossSales", "netSales", "totalDiscounts", "totalWastage", "wastagePenalty", "pricingViolationPenalty", "compliancePenalty", "baseRoyalty", "totalRoyalty", status, "dueDate", "paidAt", "paymentReference", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: RoyaltyLedger; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RoyaltyLedger" (id, "franchiseConfigId", "invoiceId", type, amount, description, reference, "createdAt", "createdBy") FROM stdin;
\.


--
-- Data for Name: SaleItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SaleItem" (id, "saleId", "productId", "qtyKg", "qtyPcs", rate, "lineTotal", "taxRate", "taxAmount", "metaJson", "createdAt") FROM stdin;
\.


--
-- Data for Name: ScaleBarcodeConfig; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ScaleBarcodeConfig" (id, "storeId", name, prefix, "pluStart", "pluLength", "weightStart", "weightLength", "weightDecimal", "priceStart", "priceLength", "priceDecimal", "checksumType", "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: StockAllocation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StockAllocation" (id, "ownerStoreId", "centralPOId", "inwardStockId", "franchiseStoreId", "productId", "allocatedQtyKg", "allocatedQtyPcs", "allocatedAt", "dispatchedAt", "receivedAt", status, notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: StoreProductPrice; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StoreProductPrice" (id, "storeId", "productId", "pricePerUnit", "effectiveFrom", "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: SyncEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SyncEvent" (id, "storeId", "deviceId", "eventType", "payloadJson", "clientCreatedAt", "serverReceivedAt", "ackedAt") FROM stdin;
\.


--
-- Data for Name: YieldIntelligence; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."YieldIntelligence" (id, "franchiseConfigId", "productId", "periodStart", "periodEnd", "expectedYieldKg", "actualYieldKg", "yieldEfficiency", "cuttingLossKg", "spoilageLossKg", "theftSuspicionKg", "otherLossKg", "totalReceivedKg", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
4db8104c-26e4-475f-88f2-d6ed903710ba	bbc60e6117c9f0d611748120b06295a17386417a94334d8ceff9182dcfd9b4f1	2025-12-28 17:08:23.027419+00	20251214192423_init	\N	\N	2025-12-28 17:08:21.320566+00	1
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.schema_migrations (version, inserted_at) FROM stdin;
20211116024918	2025-12-28 15:02:22
20211116045059	2025-12-28 15:02:25
20211116050929	2025-12-28 15:02:28
20211116051442	2025-12-28 15:02:30
20211116212300	2025-12-28 15:02:32
20211116213355	2025-12-28 15:02:34
20211116213934	2025-12-28 15:02:37
20211116214523	2025-12-28 15:02:39
20211122062447	2025-12-28 15:02:42
20211124070109	2025-12-28 15:02:44
20211202204204	2025-12-28 15:02:46
20211202204605	2025-12-28 15:02:48
20211210212804	2025-12-28 15:02:55
20211228014915	2025-12-28 15:02:57
20220107221237	2025-12-28 15:02:59
20220228202821	2025-12-28 15:03:01
20220312004840	2025-12-28 15:03:03
20220603231003	2025-12-28 15:03:07
20220603232444	2025-12-28 15:03:09
20220615214548	2025-12-28 15:03:11
20220712093339	2025-12-28 15:03:14
20220908172859	2025-12-28 15:03:16
20220916233421	2025-12-28 15:03:18
20230119133233	2025-12-28 15:03:20
20230128025114	2025-12-28 15:03:23
20230128025212	2025-12-28 15:03:25
20230227211149	2025-12-28 15:03:27
20230228184745	2025-12-28 15:03:29
20230308225145	2025-12-28 15:03:31
20230328144023	2025-12-28 15:03:34
20231018144023	2025-12-28 15:03:36
20231204144023	2025-12-28 15:03:40
20231204144024	2025-12-28 15:03:42
20231204144025	2025-12-28 15:03:44
20240108234812	2025-12-28 15:03:46
20240109165339	2025-12-28 15:03:48
20240227174441	2025-12-28 15:03:52
20240311171622	2025-12-28 15:03:55
20240321100241	2025-12-28 15:04:00
20240401105812	2025-12-28 15:04:06
20240418121054	2025-12-28 15:04:09
20240523004032	2025-12-28 15:04:16
20240618124746	2025-12-28 15:04:18
20240801235015	2025-12-28 15:04:20
20240805133720	2025-12-28 15:04:22
20240827160934	2025-12-28 15:04:25
20240919163303	2025-12-28 15:04:28
20240919163305	2025-12-28 15:04:30
20241019105805	2025-12-28 15:04:32
20241030150047	2025-12-28 15:04:40
20241108114728	2025-12-28 15:04:43
20241121104152	2025-12-28 15:04:45
20241130184212	2025-12-28 15:04:48
20241220035512	2025-12-28 15:04:50
20241220123912	2025-12-28 15:04:52
20241224161212	2025-12-28 15:04:54
20250107150512	2025-12-28 15:04:56
20250110162412	2025-12-28 15:04:58
20250123174212	2025-12-28 15:05:00
20250128220012	2025-12-28 15:05:02
20250506224012	2025-12-28 15:05:04
20250523164012	2025-12-28 15:05:06
20250714121412	2025-12-28 15:05:08
20250905041441	2025-12-28 15:05:10
20251103001201	2025-12-28 15:05:13
\.


--
-- Data for Name: subscription; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.subscription (id, subscription_id, entity, filters, claims, created_at) FROM stdin;
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.buckets (id, name, owner, created_at, updated_at, public, avif_autodetection, file_size_limit, allowed_mime_types, owner_id, type) FROM stdin;
\.


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.buckets_analytics (name, type, format, created_at, updated_at, id, deleted_at) FROM stdin;
\.


--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.buckets_vectors (id, type, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.migrations (id, name, hash, executed_at) FROM stdin;
0	create-migrations-table	e18db593bcde2aca2a408c4d1100f6abba2195df	2025-12-28 15:02:19.59095
1	initialmigration	6ab16121fbaa08bbd11b712d05f358f9b555d777	2025-12-28 15:02:19.603683
2	storage-schema	5c7968fd083fcea04050c1b7f6253c9771b99011	2025-12-28 15:02:19.61012
3	pathtoken-column	2cb1b0004b817b29d5b0a971af16bafeede4b70d	2025-12-28 15:02:19.634862
4	add-migrations-rls	427c5b63fe1c5937495d9c635c263ee7a5905058	2025-12-28 15:02:19.685143
5	add-size-functions	79e081a1455b63666c1294a440f8ad4b1e6a7f84	2025-12-28 15:02:19.690812
6	change-column-name-in-get-size	f93f62afdf6613ee5e7e815b30d02dc990201044	2025-12-28 15:02:19.697252
7	add-rls-to-buckets	e7e7f86adbc51049f341dfe8d30256c1abca17aa	2025-12-28 15:02:19.703937
8	add-public-to-buckets	fd670db39ed65f9d08b01db09d6202503ca2bab3	2025-12-28 15:02:19.709536
9	fix-search-function	3a0af29f42e35a4d101c259ed955b67e1bee6825	2025-12-28 15:02:19.715422
10	search-files-search-function	68dc14822daad0ffac3746a502234f486182ef6e	2025-12-28 15:02:19.723052
11	add-trigger-to-auto-update-updated_at-column	7425bdb14366d1739fa8a18c83100636d74dcaa2	2025-12-28 15:02:19.729393
12	add-automatic-avif-detection-flag	8e92e1266eb29518b6a4c5313ab8f29dd0d08df9	2025-12-28 15:02:19.73586
13	add-bucket-custom-limits	cce962054138135cd9a8c4bcd531598684b25e7d	2025-12-28 15:02:19.741542
14	use-bytes-for-max-size	941c41b346f9802b411f06f30e972ad4744dad27	2025-12-28 15:02:19.747472
15	add-can-insert-object-function	934146bc38ead475f4ef4b555c524ee5d66799e5	2025-12-28 15:02:19.77879
16	add-version	76debf38d3fd07dcfc747ca49096457d95b1221b	2025-12-28 15:02:19.786628
17	drop-owner-foreign-key	f1cbb288f1b7a4c1eb8c38504b80ae2a0153d101	2025-12-28 15:02:19.792296
18	add_owner_id_column_deprecate_owner	e7a511b379110b08e2f214be852c35414749fe66	2025-12-28 15:02:19.798084
19	alter-default-value-objects-id	02e5e22a78626187e00d173dc45f58fa66a4f043	2025-12-28 15:02:19.805439
20	list-objects-with-delimiter	cd694ae708e51ba82bf012bba00caf4f3b6393b7	2025-12-28 15:02:19.811221
21	s3-multipart-uploads	8c804d4a566c40cd1e4cc5b3725a664a9303657f	2025-12-28 15:02:19.820323
22	s3-multipart-uploads-big-ints	9737dc258d2397953c9953d9b86920b8be0cdb73	2025-12-28 15:02:19.836286
23	optimize-search-function	9d7e604cddc4b56a5422dc68c9313f4a1b6f132c	2025-12-28 15:02:19.849057
24	operation-function	8312e37c2bf9e76bbe841aa5fda889206d2bf8aa	2025-12-28 15:02:19.855348
25	custom-metadata	d974c6057c3db1c1f847afa0e291e6165693b990	2025-12-28 15:02:19.861283
26	objects-prefixes	ef3f7871121cdc47a65308e6702519e853422ae2	2025-12-28 15:02:19.868519
27	search-v2	33b8f2a7ae53105f028e13e9fcda9dc4f356b4a2	2025-12-28 15:02:19.887321
28	object-bucket-name-sorting	ba85ec41b62c6a30a3f136788227ee47f311c436	2025-12-28 15:02:19.899641
29	create-prefixes	a7b1a22c0dc3ab630e3055bfec7ce7d2045c5b7b	2025-12-28 15:02:19.905309
30	update-object-levels	6c6f6cc9430d570f26284a24cf7b210599032db7	2025-12-28 15:02:19.91065
31	objects-level-index	33f1fef7ec7fea08bb892222f4f0f5d79bab5eb8	2025-12-28 15:02:19.920682
32	backward-compatible-index-on-objects	2d51eeb437a96868b36fcdfb1ddefdf13bef1647	2025-12-28 15:02:19.928096
33	backward-compatible-index-on-prefixes	fe473390e1b8c407434c0e470655945b110507bf	2025-12-28 15:02:19.935377
34	optimize-search-function-v1	82b0e469a00e8ebce495e29bfa70a0797f7ebd2c	2025-12-28 15:02:19.93766
35	add-insert-trigger-prefixes	63bb9fd05deb3dc5e9fa66c83e82b152f0caf589	2025-12-28 15:02:19.94456
36	optimise-existing-functions	81cf92eb0c36612865a18016a38496c530443899	2025-12-28 15:02:19.950599
37	add-bucket-name-length-trigger	3944135b4e3e8b22d6d4cbb568fe3b0b51df15c1	2025-12-28 15:02:19.959572
38	iceberg-catalog-flag-on-buckets	19a8bd89d5dfa69af7f222a46c726b7c41e462c5	2025-12-28 15:02:19.966108
39	add-search-v2-sort-support	39cf7d1e6bf515f4b02e41237aba845a7b492853	2025-12-28 15:02:19.978439
40	fix-prefix-race-conditions-optimized	fd02297e1c67df25a9fc110bf8c8a9af7fb06d1f	2025-12-28 15:02:19.984739
41	add-object-level-update-trigger	44c22478bf01744b2129efc480cd2edc9a7d60e9	2025-12-28 15:02:19.994066
42	rollback-prefix-triggers	f2ab4f526ab7f979541082992593938c05ee4b47	2025-12-28 15:02:20.003859
43	fix-object-level	ab837ad8f1c7d00cc0b7310e989a23388ff29fc6	2025-12-28 15:02:20.013309
44	vector-bucket-type	99c20c0ffd52bb1ff1f32fb992f3b351e3ef8fb3	2025-12-28 15:02:20.020396
45	vector-buckets	049e27196d77a7cb76497a85afae669d8b230953	2025-12-28 15:02:20.026565
46	buckets-objects-grants	fedeb96d60fefd8e02ab3ded9fbde05632f84aed	2025-12-28 15:02:20.041475
47	iceberg-table-metadata	649df56855c24d8b36dd4cc1aeb8251aa9ad42c2	2025-12-28 15:02:20.048329
48	iceberg-catalog-ids	2666dff93346e5d04e0a878416be1d5fec345d6f	2025-12-28 15:02:20.059373
49	buckets-objects-grants-postgres	072b1195d0d5a2f888af6b2302a1938dd94b8b3d	2025-12-28 15:02:20.081135
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata, version, owner_id, user_metadata, level) FROM stdin;
\.


--
-- Data for Name: prefixes; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.prefixes (bucket_id, name, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.s3_multipart_uploads (id, in_progress_size, upload_signature, bucket_id, key, version, owner_id, created_at, user_metadata) FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.s3_multipart_uploads_parts (id, upload_id, size, part_number, bucket_id, key, etag, owner_id, version, created_at) FROM stdin;
\.


--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.vector_indexes (id, name, bucket_id, data_type, dimension, distance_metric, metadata_configuration, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: secrets; Type: TABLE DATA; Schema: vault; Owner: -
--

COPY vault.secrets (id, name, description, secret, key_id, nonce, created_at, updated_at) FROM stdin;
\.


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: -
--

SELECT pg_catalog.setval('auth.refresh_tokens_id_seq', 1, false);


--
-- Name: subscription_id_seq; Type: SEQUENCE SET; Schema: realtime; Owner: -
--

SELECT pg_catalog.setval('realtime.subscription_id_seq', 1, false);


--
-- PostgreSQL database dump complete
--

\unrestrict fnJFmGoWeAMNshUxtdc1o0LYfEca76fspyVFBhXvupuhWX6bKp6HBQkNukjgbJN

