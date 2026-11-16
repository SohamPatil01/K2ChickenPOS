"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useCartStore } from "@/store/cart";
import { useNotificationStore } from "@/store/notification";
import api from "@/lib/api";
import { parseScaleBarcode } from "@/lib/barcode";
import Link from "next/link";
import CartAnimation from "@/components/CartAnimation";
import BillSuccessAnimation from "@/components/BillSuccessAnimation";
import NumPad from "@/components/NumPad";
import { SkeletonProductCard } from "@/components/ui";
import { printReceipt, generateReceiptData } from "@/lib/printReceipt";
import { normalizeBarcodeForLookup } from "@azela-pos/shared";
import {
  saveHeldCart,
  listHeldCarts,
  deleteHeldCart,
  getHeldCart,
  saveLocalProducts,
  getCachedProducts,
  type HeldCartSnapshot,
  type LocalProduct,
} from "@azela-pos/offline";
import CartPaymentModal from "@/components/CartPaymentModal";
import { executeCheckout } from "@/lib/executeCheckout";
import { setStockSnapshot } from "@/lib/stockSnapshot";
import CustomerDisplayButton from "@/components/customerDisplay/CustomerDisplayButton";
import PosPreOrders from "@/components/pre-orders/PosPreOrders";
import {
  publishPaymentMode,
  publishSuccessMode,
  publishIdleMode,
  publishCurrentBill,
  releaseDisplaySuccessLatch,
} from "@/lib/customerDisplay/publishHelpers";

interface Product {
  id: string;
  name: string;
  sku: string;
  plu: string;
  categoryId: string;
  categoryName: string;
  unitType: "KG" | "PCS";
  taxRate: number;
  pricePerUnit: number;
  imageUrl?: string | null;
  productMaster?: {
    isHQLocked: boolean;
    hqLockedPrice?: number | null;
  };
}

interface Category {
  id: string;
  name: string;
}

type PosImageFallback = "chicken" | "spice" | "package";

function PosProductTileImage({
  src,
  alt,
  fallback,
  aspectClass = "aspect-[4/3]",
}: {
  src?: string | null;
  alt: string;
  fallback: PosImageFallback;
  aspectClass?: string;
}) {
  const [failed, setFailed] = useState(false);
  const show = Boolean(src) && !failed;
  const icons: Record<PosImageFallback, string> = {
    chicken: "🍗",
    spice: "🧂",
    package: "📦",
  };
  return (
    <div
      className={`relative w-full ${aspectClass} rounded-xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800`}
    >
      {show ? (
        <img
          src={src!}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center text-5xl sm:text-6xl select-none"
          aria-hidden
        >
          {icons[fallback]}
        </div>
      )}
    </div>
  );
}

function posGridImageFallback(product: Product): PosImageFallback {
  const t = `${product.categoryName} ${product.name}`.toLowerCase();
  if (
    /(chicken|mutton|meat|fish|egg|bone|drum|wing|liver|breast|leg|raw|cut|mince|skin|gizzard|carcass|carcus|tandoor)/.test(
      t
    )
  ) {
    return "chicken";
  }
  return "package";
}

const POS_PRODUCT_DISPLAY_ORDER = [
  "Hot Tandoor",
  "Breast Boneless",
  "Leg",
  "Leg Boneless",
  "Drumstick",
  "Liver",
  "Carcus",
  "Egg",
  "Eggs",
  "Gizzard",
  "Wings",
];

function sortProductsByDisplayOrder<T extends { name: string }>(items: T[]): T[] {
  const order = POS_PRODUCT_DISPLAY_ORDER.map((n) => n.toLowerCase());
  return [...items].sort((a, b) => {
    const i = order.indexOf(a.name.toLowerCase());
    const j = order.indexOf(b.name.toLowerCase());
    if (i === -1 && j === -1) return a.name.localeCompare(b.name);
    if (i === -1) return 1;
    if (j === -1) return -1;
    return i - j;
  });
}

function mapCachedProduct(p: LocalProduct): Product {
  return {
    id: p.productId,
    name: p.name,
    sku: p.sku,
    plu: p.plu,
    categoryId: p.categoryId,
    categoryName: p.categoryName,
    unitType: p.unitType,
    taxRate: p.taxRate,
    pricePerUnit: p.pricePerUnit,
  };
}

function categoriesFromProducts(products: Product[]): Category[] {
  const byId = new Map<string, Category>();
  for (const p of products) {
    if (p.categoryId && !byId.has(p.categoryId)) {
      byId.set(p.categoryId, {
        id: p.categoryId,
        name: p.categoryName || "General",
      });
    }
  }
  return Array.from(byId.values());
}

async function loadProductsFromCache(): Promise<Product[]> {
  const cached = await getCachedProducts();
  return sortProductsByDisplayOrder(
    cached.filter((p) => p.isActive).map(mapCachedProduct)
  );
}

interface FranchiseConfig {
  isPricingLocked: boolean;
  isDiscountLocked: boolean;
}

export default function StorePOSPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    items,
    addItem,
    fulfillmentType,
    setFulfillmentType,
    deliveryFee,
    setDeliveryFee,
    customerId,
    clearCart,
    loadCart,
    setCustomer,
    setDiscount,
    setDiscountType,
    setDiscountPercentage,
  } = useCartStore();
  const checkoutGrandTotal = useCartStore((s) => s.getCheckoutTotal());
  const cartTotals = useCartStore((s) => s.getTotal());
  const cartGrandTotal = cartTotals.grandTotal;
  const cartSubTotal = cartTotals.subTotal;
  const cartTaxTotal = cartTotals.taxTotal;
  const cartDiscountTotal = useCartStore((s) => s.discountTotal || 0);
  const pendingSettlements = useCartStore((s) => s.pendingSettlements);
  const { showNotification } = useNotificationStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [franchiseConfig, setFranchiseConfig] =
    useState<FranchiseConfig | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [addItemModalFocusWeightFirst, setAddItemModalFocusWeightFirst] =
    useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showPriceOverrideModal, setShowPriceOverrideModal] = useState(false);
  const [priceOverrideData, setPriceOverrideData] = useState<{
    productId: string;
    productName: string;
    lockedPrice: number;
    requestedPrice: number;
    qtyKg?: number;
    qtyPcs?: number;
  } | null>(null);
  const [showHoldLabelModal, setShowHoldLabelModal] = useState(false);
  const [holdLabel, setHoldLabel] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [manualItem, setManualItem] = useState({
    sku: "",
    description: "",
    weight: "",
    rate: "",
    total: "",
    unitType: "KG" as "KG" | "PCS",
  });
  const [cartAnimation, setCartAnimation] = useState<{
    productName: string;
    productImage?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState({
    products: false,
    categories: false,
    config: false,
  });
  const [error, setError] = useState<{
    products?: string;
    categories?: string;
    config?: string;
  }>({});
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  /** Prevents double-add when Enter fires both keydown and form submit. */
  const barcodeInFlightRef = useRef(false);
  const lastBarcodeScanRef = useRef<{ code: string; at: number } | null>(null);
  const [showQuickCheckout, setShowQuickCheckout] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  /** Sync guard — React state is async; prevents double /sales + /pay (credit often hit twice). */
  const paymentInFlightRef = useRef(false);
  const [completedSale, setCompletedSale] = useState<{
    saleNo: string;
    grandTotal: number;
    saleId?: string | null;
  } | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  /** Mirrors success overlay — barcode handler must not wait on React state. */
  const showSuccessAnimationRef = useRef(false);
  const [stockByProductId, setStockByProductId] = useState<
    Record<string, { kg: number; pcs: number }>
  >({});
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [heldRows, setHeldRows] = useState<
    Array<{
      id: number;
      label: string;
      createdAt: number;
      _serverId?: string;
      _snapshot?: HeldCartSnapshot;
    }>
  >([]);
  const [shortcutsBanner, setShortcutsBanner] = useState(false);

  const loadStockSummary = useCallback(async () => {
    if (!user?.storeId) return;
    try {
      const res = await api.get("/api/v1/inventory/summary", {
        params: { storeId: user.storeId },
      });
      const map: Record<string, { kg: number; pcs: number }> = {};
      for (const row of res.data || []) {
        map[row.productId] = {
          kg: Number(row.currentQtyKg) || 0,
          pcs: Number(row.currentQtyPcs) || 0,
        };
      }
      setStockByProductId(map);
      setStockSnapshot(map);
    } catch (e) {
      console.warn("POS: could not load inventory summary for stock hints", e);
    }
  }, [user?.storeId]);

  const openHoldModal = useCallback(async () => {
    try {
      const local = await listHeldCarts();
      setHeldRows(local);
      setShowHoldModal(true);
      // Merge server holds from other registers (best-effort)
      try {
        const res = await api.get("/api/v1/held-carts");
        const remote = Array.isArray(res.data?.items) ? res.data.items : [];
        if (remote.length > 0) {
          setHeldRows((prev) => {
            const labels = new Set(prev.map((p) => `${p.label}|${p.createdAt}`));
            const extras = remote
              .filter((r: any) => r?.id && r?.label && r?.snapshot)
              .map((r: any, idx: number) => ({
                id: -(idx + 1) - Math.abs(
                  String(r.id)
                    .split("")
                    .reduce((a: number, c: string) => a + c.charCodeAt(0), 0)
                ),
                label: `☁ ${r.label}`,
                createdAt: new Date(r.createdAt).getTime() || Date.now(),
                _serverId: String(r.id),
                _snapshot: r.snapshot as HeldCartSnapshot,
              }));
            const merged = [...prev];
            const serverSeen = new Set(
              prev.map((p) => p._serverId).filter(Boolean)
            );
            for (const e of extras) {
              if (e._serverId && serverSeen.has(e._serverId)) continue;
              const key = `${e.label}|${e.createdAt}`;
              if (!labels.has(key)) merged.push(e);
            }
            return merged.sort((a, b) => b.createdAt - a.createdAt);
          });
        }
      } catch {
        /* local-only is fine */
      }
    } catch {
      showNotification("Could not load held carts", "error");
    }
  }, [showNotification]);

  const toggleFavorite = useCallback(
    (productId: string) => {
      if (!user?.storeId) return;
      setFavoriteIds((prev) => {
        const next = prev.includes(productId)
          ? prev.filter((id) => id !== productId)
          : [...prev, productId];
        localStorage.setItem(
          `pos-favorites-${user.storeId}`,
          JSON.stringify(next)
        );
        return next;
      });
    },
    [user?.storeId]
  );

  useEffect(() => {
    if (!user?.storeId || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(`pos-favorites-${user.storeId}`);
      setFavoriteIds(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setFavoriteIds([]);
    }
  }, [user?.storeId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT"
      ) {
        return;
      }
      if (e.altKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        void openHoldModal();
      }
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsBanner(true);
        window.setTimeout(() => setShortcutsBanner(false), 7000);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openHoldModal]);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    loadProducts();
    loadCategories();
    loadFranchiseConfig();
    loadStockSummary();
    useCartStore.getState().loadCart();
    // Focus barcode input on mount
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [user, router, loadStockSummary]);

  function assertStockForLine(
    product: Product,
    qtyKg?: number,
    qtyPcs?: number
  ): boolean {
    const st = stockByProductId[product.id];
    if (!st || product.id === "manual") return true;
    if (product.unitType === "KG") {
      const need = qtyKg ?? qtyPcs ?? 1;
      if (st.kg + 1e-6 < need) {
        showNotification(
          `Low stock: ${product.name} — only ${st.kg.toFixed(3)} kg on hand`,
          "warning",
          4500
        );
        return false;
      }
    } else {
      const need = Math.ceil(qtyPcs ?? qtyKg ?? 1);
      if (st.pcs < need) {
        showNotification(
          `Low stock: ${product.name} — only ${st.pcs} pcs on hand`,
          "warning",
          4500
        );
        return false;
      }
    }
    return true;
  }

  const loadProducts = async () => {
    setLoading((prev) => ({ ...prev, products: true }));
    setError((prev) => ({ ...prev, products: undefined }));

    const applyCachedProducts = async (opts?: { silent?: boolean }): Promise<boolean> => {
      const offlineProducts = await loadProductsFromCache();
      if (offlineProducts.length === 0) return false;
      setProducts(offlineProducts);
      setCategories(categoriesFromProducts(offlineProducts));
      if (!opts?.silent) {
        showNotification(
          `Offline catalog: ${offlineProducts.length} products loaded`,
          "warning",
          4500
        );
      }
      return true;
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      if (!(await applyCachedProducts())) {
        setError((prev) => ({
          ...prev,
          products:
            "You are offline and no product catalog is cached. Go online once to sync the catalog.",
        }));
      }
      setLoading((prev) => ({ ...prev, products: false }));
      return;
    }

    // Always fetch when online so prices stay current; IndexedDB is offline fallback only
    try {
      const response = await api.get("/api/v1/products", {});
      const productsData = response.data || [];

      // productMaster is included on GET /products — no per-product HQ round-trips
      setProducts(productsData);
      await saveLocalProducts(
        productsData.map((p: Product) => ({
          productId: p.id,
          sku: p.sku || "",
          plu: p.plu || "",
          name: p.name,
          categoryId: p.categoryId,
          categoryName: p.categoryName || "",
          unitType: p.unitType,
          taxRate: p.taxRate,
          pricePerUnit: p.pricePerUnit,
          isActive: true,
        }))
      );
    } catch (error: any) {
      console.error("Failed to load products:", error);

      if (await applyCachedProducts()) {
        return;
      }

      let errorMessage = "Failed to load products. Please try again.";
      if (error.code === "ERR_NETWORK" || error.message === "Network Error") {
        errorMessage =
          "Cannot connect to API server. Connect once while online to cache products for offline use.";
        console.error("Network Error Details:", {
          errorCode: error.code,
          errorMessage: error.message,
          url: error.config?.url,
          baseURL: error.config?.baseURL,
        });
      } else if (error.response) {
        errorMessage =
          error.response.data?.error ||
          `Server error: ${error.response.status}`;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError((prev) => ({ ...prev, products: errorMessage }));
      showNotification(errorMessage, "error", 5000);
    } finally {
      setLoading((prev) => ({ ...prev, products: false }));
    }
  };

  const loadCategories = async () => {
    setLoading((prev) => ({ ...prev, categories: true }));
    setError((prev) => ({ ...prev, categories: undefined }));

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const offlineProducts = await loadProductsFromCache();
      if (offlineProducts.length > 0) {
        setCategories(categoriesFromProducts(offlineProducts));
      }
      setLoading((prev) => ({ ...prev, categories: false }));
      return;
    }

    try {
      const response = await api.get("/api/v1/products/categories");
      setCategories(response.data || []);
    } catch (error: any) {
      console.error("Failed to load categories:", error);
      const offlineProducts = await loadProductsFromCache();
      if (offlineProducts.length > 0) {
        setCategories(categoriesFromProducts(offlineProducts));
        return;
      }
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to load categories. Please try again.";
      setError((prev) => ({ ...prev, categories: errorMessage }));
      showNotification(errorMessage, "error", 5000);
    } finally {
      setLoading((prev) => ({ ...prev, categories: false }));
    }
  };

  const loadFranchiseConfig = async () => {
    setLoading((prev) => ({ ...prev, config: true }));
    setError((prev) => ({ ...prev, config: undefined }));
    try {
      const storeId = user?.storeId;
      if (!storeId) {
        setLoading((prev) => ({ ...prev, config: false }));
        return;
      }

      const response = await api
        .get("/api/v1/stores/franchise-config")
        .catch(() => ({ data: null }));
      const config = response.data;
      if (config) {
        setFranchiseConfig({
          isPricingLocked: config.isPricingLocked || false,
          isDiscountLocked: config.isDiscountLocked || false,
        });
      }
    } catch (error: any) {
      console.error("Failed to load franchise config:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to load franchise configuration.";
      setError((prev) => ({ ...prev, config: errorMessage }));
      // Don't show notification for config errors as they're not critical
    } finally {
      setLoading((prev) => ({ ...prev, config: false }));
    }
  };

  const dismissSuccessForNewBill = async () => {
    // [checkout-success] Scan / new bill during success → start a fresh cart.
    if (!showSuccessAnimationRef.current) return;
    showSuccessAnimationRef.current = false;
    setShowSuccessAnimation(false);
    setCompletedSale(null);
    releaseDisplaySuccessLatch();
    try {
      await useCartStore.getState().clearCart();
    } catch (err) {
      console.error("[POS] clearCart before next bill:", err);
    }
  };

  const handleBarcodeSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const raw =
      barcodeInputRef.current?.value ?? barcodeInput;
    const lookup = normalizeBarcodeForLookup(raw);
    if (!lookup) {
      showNotification("Please enter or scan a barcode", "warning", 3000);
      return;
    }

    const now = Date.now();
    const last = lastBarcodeScanRef.current;
    if (last && last.code === lookup && now - last.at < 600) {
      return;
    }
    if (barcodeInFlightRef.current) return;

    barcodeInFlightRef.current = true;
    lastBarcodeScanRef.current = { code: lookup, at: now };

    try {
      // Next scan during success animation opens a NEW bill (never the paid cart).
      await dismissSuccessForNewBill();
      const storeId = user?.storeId || user?.store?.id;
      if (!storeId) {
        showNotification(
          "Store ID not found. Please contact administrator.",
          "error",
          5000
        );
        return;
      }

      // Local catalog first — avoids a DB round-trip on every simple SKU/PLU scan.
      const localProduct = products.find(
        (p) =>
          normalizeBarcodeForLookup(p.sku) === lookup ||
          normalizeBarcodeForLookup(p.plu) === lookup
      );
      if (localProduct) {
        setBarcodeInput("");
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus();
        }
        // KG without encoded weight → same weight pad as grid tap
        if (localProduct.unitType === "KG") {
          handleAddProduct(localProduct);
          return;
        }
        await handleAddProductToCart(localProduct, undefined, 1);
        return;
      }

      // Scale / weighted barcodes (or catalog miss) — server parse.
      const parsed = await parseScaleBarcode(lookup, storeId);

      if (parsed) {
        let product = products.find((p) => p.id === parsed.productId);

        // If product not in local array, fetch it from API
        if (!product) {
          try {
            const productResponse = await api.get(
              `/api/v1/products/${parsed.productId}`
            );
            const fetchedProduct: Product | undefined = productResponse.data;

            // Add to local products array for future use
            if (fetchedProduct) {
              product = fetchedProduct;
              setProducts((prev) => {
                // Check if product already exists to avoid duplicates
                if (!prev.find((p) => p.id === fetchedProduct.id)) {
                  return [...prev, fetchedProduct];
                }
                return prev;
              });
            }
          } catch (error: any) {
            console.error("Failed to fetch product:", error);
          }
        }

        if (product) {
          // Scale barcodes encode weight/qty — add directly (no pad)
          const needsWeightPad =
            product.unitType === "KG" &&
            !(Number(parsed.weightKg) > 0) &&
            !(Number(parsed.qtyPcs) > 0);
          setBarcodeInput("");
          if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
          }
          if (needsWeightPad) {
            handleAddProduct(product);
            return;
          }
          await handleAddProductToCart(
            product,
            parsed.weightKg,
            parsed.qtyPcs,
            parsed.pricePerKg
          );
          return;
        } else {
          // If we have parsed data but no product, try to add directly using parsed data
          if (parsed.productId && parsed.pricePerKg) {
            try {
              // Fetch product details
              const productResponse = await api.get(
                `/api/v1/products/${parsed.productId}`
              );
              const fetchedProduct = productResponse.data;

              if (fetchedProduct) {
                const added = await handleAddProductToCart(
                  fetchedProduct,
                  parsed.weightKg,
                  parsed.qtyPcs,
                  parsed.pricePerKg
                );
                setBarcodeInput("");
                if (barcodeInputRef.current) {
                  barcodeInputRef.current.focus();
                }
                if (added) {
                  router.push("/store/cart");
                }
                return;
              }
            } catch (error: any) {
              console.error("Failed to fetch product details:", error);
            }
          }
          showNotification(
            `Product not found for barcode: ${lookup}`,
            "error",
            4000
          );
          setBarcodeInput("");
          return;
        }
      }

      // If not found, open manual entry with SKU pre-filled
      showNotification(
        `Product not found. Opening manual entry for: ${lookup}`,
        "info",
        3000
      );
      setAddItemModalFocusWeightFirst(false);
      setManualItem({
        sku: lookup,
        description: "",
        weight: "",
        rate: "",
        total: "",
        unitType: "KG",
      });
      setShowAddItemModal(true);
      setBarcodeInput("");
    } catch (error: any) {
      console.error("Failed to process barcode:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to process barcode. Please try again.";
      showNotification(errorMessage, "error", 5000);
      // On error, open manual entry modal
      setAddItemModalFocusWeightFirst(false);
      setManualItem({
        sku: lookup,
        description: "",
        weight: "",
        rate: "",
        total: "",
        unitType: "KG",
      });
      setShowAddItemModal(true);
      setBarcodeInput("");
    } finally {
      barcodeInFlightRef.current = false;
    }
  };

  const handleAddProduct = (product: Product) => {
    // Open manual entry modal with product pre-filled; focus weight first for faster entry
    setAddItemModalFocusWeightFirst(true);
    setManualItem({
      sku: product.sku,
      description: product.name,
      weight: "",
      rate: product.pricePerUnit.toString(),
      total: "",
      unitType: product.unitType,
    });
    setShowAddItemModal(true);
  };

  const handleAddProductToCart = async (
    product: Product,
    qtyKg?: number,
    qtyPcs?: number,
    overridePrice?: number
  ): Promise<boolean> => {
    // Check if price is locked
    const isPriceLocked =
      franchiseConfig?.isPricingLocked || product.productMaster?.isHQLocked;
    const lockedPrice =
      product.productMaster?.hqLockedPrice || product.pricePerUnit;
    const requestedPrice = overridePrice || product.pricePerUnit;

    // If price is locked and requested price differs, require manager PIN
    if (isPriceLocked && overridePrice && overridePrice !== lockedPrice) {
      setPriceOverrideData({
        productId: product.id,
        productName: product.name,
        lockedPrice: lockedPrice!,
        requestedPrice: overridePrice,
        qtyKg,
        qtyPcs,
      });
      setShowPriceOverrideModal(true);
      return false;
    }

    if (!assertStockForLine(product, qtyKg, qtyPcs)) {
      return false;
    }

    // Calculate line total (base amount without tax) - matching backend logic
    const qty = qtyKg || qtyPcs || 1;
    const rate = overridePrice || lockedPrice || product.pricePerUnit;
    const lineTotal = qty * rate; // Base amount without tax

    await addItem({
      productId: product.id,
      productName: product.name,
      qtyKg: qtyKg,
      qtyPcs: qtyPcs,
      rate,
      taxRate: product.taxRate,
      lineTotal, // Store base amount, tax calculated separately
      metaJson: {
        isPriceLocked,
        lockedPrice,
        overridePrice:
          overridePrice && overridePrice !== lockedPrice
            ? overridePrice
            : undefined,
      },
    });

    // Trigger cart animation
    setCartAnimation({
      productName: product.name,
      productImage: product.imageUrl,
    });
    return true;
  };

  const handleManualItemSubmit = () => {
    const rate = parseFloat(manualItem.rate) || 0;
    const weight = parseFloat(manualItem.weight) || 0;
    const qtyPcs = parseFloat(manualItem.weight) || 1; // For PCS, weight field is used as quantity
    const total = parseFloat(manualItem.total) || 0;

    // Validation - standardized with cart page
    if (!manualItem.description.trim()) {
      showNotification("Please enter item description", "warning", 3000);
      return;
    }

    if (manualItem.unitType === "KG" && weight <= 0) {
      showNotification("Please enter valid weight", "warning", 3000);
      return;
    }

    if (manualItem.unitType === "PCS" && qtyPcs <= 0) {
      showNotification("Please enter valid quantity", "warning", 3000);
      return;
    }

    if (!rate || rate <= 0) {
      showNotification("Please enter a valid rate", "warning", 3000);
      return;
    }

    // Find product by SKU if exists
    const product = products.find((p) => p.sku === manualItem.sku);

    if (
      product &&
      !assertStockForLine(
        product,
        manualItem.unitType === "KG" ? weight : undefined,
        manualItem.unitType === "PCS" ? qtyPcs : undefined
      )
    ) {
      return;
    }

    // Calculate base line total (qty * rate) - matching backend logic
    const finalRate =
      rate || total / (manualItem.unitType === "KG" ? weight : qtyPcs);
    const qty = manualItem.unitType === "KG" ? weight : qtyPcs;
    const lineTotal = qty * finalRate; // Base amount without tax

    addItem({
      productId: product?.id || "manual",
      productName: manualItem.description,
      qtyKg: manualItem.unitType === "KG" ? weight : undefined,
      qtyPcs: manualItem.unitType === "PCS" ? qtyPcs : undefined,
      rate: finalRate,
      taxRate: product?.taxRate || 0,
      lineTotal, // Store base amount, tax calculated separately
      metaJson: {
        sku: manualItem.sku,
        manualEntry: true,
        barcode: manualItem.sku || undefined,
      },
    });

    // Trigger cart animation
    const foundProduct = products.find((p) => p.sku === manualItem.sku);
    setCartAnimation({
      productName: manualItem.description,
      productImage: foundProduct?.imageUrl || null,
    });

    // Reset and close
    setManualItem({
      sku: "",
      description: "",
      weight: "",
      rate: "",
      total: "",
      unitType: "KG",
    });
    setShowAddItemModal(false);
  };

  const handlePriceOverride = async () => {
    if (!priceOverrideData) return;

    if (user?.role !== "MANAGER" && user?.role !== "OWNER") {
      showNotification(
        "Only managers or owners can override locked prices",
        "error",
        3000
      );
      return;
    }

    try {
      const product = products.find(
        (p) => p.id === priceOverrideData.productId
      );
      if (!product) {
        showNotification("Product not found", "error", 3000);
        return;
      }

      const qtyKg =
        priceOverrideData.qtyKg ??
        (product.unitType === "KG" ? 1 : undefined);
      const qtyPcs =
        priceOverrideData.qtyPcs ??
        (product.unitType === "PCS" ? 1 : undefined);
      const qty = qtyKg || qtyPcs || 1;
      const rate = priceOverrideData.requestedPrice;
      const lineTotal = qty * rate;

      if (!assertStockForLine(product, qtyKg, qtyPcs)) {
        return;
      }

      await addItem({
        productId: product.id,
        productName: product.name,
        qtyKg,
        qtyPcs,
        rate,
        taxRate: product.taxRate,
        lineTotal,
        metaJson: {
          isPriceLocked: true,
          lockedPrice: priceOverrideData.lockedPrice,
          overridePrice: priceOverrideData.requestedPrice,
          managerOverride: true,
          overriddenBy: user?.id || user?.role,
        },
      });

      setShowPriceOverrideModal(false);
      setPriceOverrideData(null);
      setCartAnimation({
        productName: product.name,
        productImage: product.imageUrl,
      });
      showNotification("Price override applied", "success", 2500);
    } catch (error: any) {
      showNotification(
        "Failed to override price: " +
          (error.response?.data?.error || error.message),
        "error",
        5000
      );
    }
  };

  const openParkCartModal = () => {
    if (items.length === 0) {
      showNotification("Cart is empty", "warning");
      return;
    }
    setHoldLabel(`Hold ${items.length} items`);
    setShowHoldLabelModal(true);
  };

  const confirmHoldCart = async () => {
    const label = holdLabel.trim() || `Hold ${items.length} items`;
    const st = useCartStore.getState();
    const snap: HeldCartSnapshot = {
      customerId: st.customerId,
      customerPhone: st.customerPhone,
      customerName: st.customerName,
      discountTotal: st.discountTotal,
      discountType: st.discountType,
      discountPercentage: st.discountPercentage,
      fulfillmentType: st.fulfillmentType,
      items: st.items.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        qtyKg: i.qtyKg,
        qtyPcs: i.qtyPcs,
        rate: i.rate,
        taxRate: i.taxRate,
        lineTotal: i.lineTotal,
        metaJson: i.metaJson as Record<string, unknown> | undefined,
      })),
    };
    const localId = await saveHeldCart(label, snap);
    // Sync to server so other registers can recall
    const clientHeldId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `hold-${localId}-${Date.now()}`;
    try {
      await api.put("/api/v1/held-carts", {
        clientHeldId,
        label,
        snapshot: snap,
      });
    } catch (syncErr) {
      console.warn("[POS] Server hold sync failed (local hold kept):", syncErr);
    }
    await clearCart();
    await loadCart();
    setShowHoldLabelModal(false);
    showNotification(`Held as “${label}”`, "success");
    try {
      setHeldRows(await listHeldCarts());
    } catch {
      /* ignore */
    }
  };

  const recallHeldCartById = async (heldId: number) => {
    const listed = heldRows.find((h) => h.id === heldId);
    let snap: HeldCartSnapshot | null = listed?._snapshot || null;
    let label = listed?.label || "Hold";
    if (!snap && heldId > 0) {
      const row = await getHeldCart(heldId);
      if (!row) return;
      snap = row.snapshot;
      label = row.label;
    }
    if (!snap?.items?.length) {
      showNotification("Held cart not found", "error");
      return;
    }
    await clearCart();
    setCustomer(snap.customerId, snap.customerPhone, snap.customerName);
    setFulfillmentType(snap.fulfillmentType);
    setDiscountType(snap.discountType);
    if (snap.discountType === "percentage") {
      setDiscountPercentage(snap.discountPercentage);
    } else {
      setDiscount(snap.discountTotal);
    }
    for (const line of snap.items) {
      await addItem({
        productId: line.productId,
        productName: line.productName,
        qtyKg: line.qtyKg,
        qtyPcs: line.qtyPcs,
        rate: line.rate,
        taxRate: line.taxRate,
        lineTotal: line.lineTotal,
        metaJson: line.metaJson,
      });
    }
    if (heldId > 0) {
      await deleteHeldCart(heldId);
    }
    if (listed?._serverId) {
      try {
        await api.delete(`/api/v1/held-carts/${listed._serverId}`);
      } catch {
        /* ignore */
      }
    }
    await loadCart();
    showNotification(`Recalled: ${label}`, "success");
    setShowHoldModal(false);
  };

  const handleQuickCheckoutPay = async (
    payments: Array<{ method: string; amount: number }>
  ) => {
    if (paymentInFlightRef.current || isProcessingPayment) return;

    paymentInFlightRef.current = true;
    setIsProcessingPayment(true);

    try {
      await executeCheckout({
        api,
        payments,
        skipCustomer: false,
        clearCart: async () => {
          await useCartStore.getState().clearCart();
          // Refresh product strip in background — don't hold the next bill.
          void loadCart();
        },
        onClosePaymentUi: () => setShowQuickCheckout(false),
        onPaymentFailedUi: () => publishCurrentBill(),
        onNotify: showNotification,
        onLoyaltyBalance: (balance) => {
          useCartStore.getState().setCustomerLoyaltyPoints(balance);
        },
        onDiscountApproval: async (saleNo) => {
          publishIdleMode();
          showNotification(
            `Sale #${saleNo} created. Discount needs manager approval before payment.`,
            "info",
            6000
          );
          try {
            await useCartStore.getState().clearCart();
          } catch (clearErr) {
            console.error("[POS] clearCart after discount approval:", clearErr);
          }
          setTimeout(() => router.push("/store/discount-approvals"), 1500);
        },
        onSuccess: ({ saleNo, saleId, checkoutGrandTotal, loyaltyPointsRedeemed, offline }) => {
          setCompletedSale({
            saleNo,
            grandTotal: checkoutGrandTotal,
            saleId,
          });
          showSuccessAnimationRef.current = true;
          setShowSuccessAnimation(true);
          publishSuccessMode(checkoutGrandTotal, offline ? null : saleNo, saleId, {
            loyaltyPointsRedeemed,
            loyaltyPointsBalance: null,
          });
          // Keep scanner ready so the next barcode jumps to a new bill.
          requestAnimationFrame(() => barcodeInputRef.current?.focus());
        },
      });
    } catch (error: any) {
      console.error("[Quick Checkout] Payment error:", error);
    } finally {
      paymentInFlightRef.current = false;
      setIsProcessingPayment(false);
    }
  };

  // While Quick Pay is open, keep the display total in sync (no UPI until method chosen).
  useEffect(() => {
    if (!showQuickCheckout) return;
    let lastTotal = useCartStore.getState().getCheckoutTotal();
    const unsub = useCartStore.subscribe(() => {
      const total = useCartStore.getState().getCheckoutTotal();
      if (total !== lastTotal) {
        lastTotal = total;
        publishPaymentMode(total, null);
      }
    });
    return () => unsub();
  }, [showQuickCheckout]);

  // Masale products: category Spices/Masale or name contains Masala/Masale (resolve category from list if needed)
  const masaleProducts = products.filter((p) => {
    const cat = (
      p.categoryName ||
      categories.find((c) => c.id === p.categoryId)?.name ||
      ""
    ).toLowerCase();
    const name = (p.name || "").toLowerCase();
    return (
      cat.includes("spice") ||
      cat.includes("masale") ||
      name.includes("masala") ||
      name.includes("masale")
    );
  });

  const masaleIds = new Set(masaleProducts.map((p) => p.id));

  // Main grid: exclude masale; filter by search + optional category chip
  const productsForGrid = sortProductsByDisplayOrder(
    products.filter((p) => {
      if (masaleIds.has(p.id)) return false;
      if (categoryFilter !== "all" && p.categoryId !== categoryFilter) return false;
      if (
        searchQuery &&
        !p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !p.sku.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      return true;
    })
  );

  const masaleFiltered = masaleProducts.filter((p) => {
    if (
      searchQuery &&
      !p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });
  const favoriteProducts = sortProductsByDisplayOrder(
    products.filter((p) => favoriteIds.includes(p.id))
  );

  return (
    <div className="flex flex-col h-full min-h-0 w-full max-w-full overflow-hidden">
      {/* Day In/Out lives in StoreShell so it syncs across all consoles */}
      {/* Cart Animation */}
      {cartAnimation && (
        <CartAnimation
          productName={cartAnimation.productName}
          productImage={cartAnimation.productImage}
          onComplete={() => setCartAnimation(null)}
        />
      )}

      {/* Header */}
      <div className="mb-2 flex-shrink-0 px-2">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-3 glass-panel rounded-2xl">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-ink">
              Point of Sale
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Scan or tap products to add
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 hidden sm:block">
              Shortcuts: Alt+H held carts · ? hint · Stock shown from inventory
              summary
            </p>
          </div>
          <div className="grid grid-cols-3 sm:flex sm:flex-wrap sm:gap-2 flex-shrink-0 w-full sm:w-auto gap-2">
            <PosPreOrders products={products} />
            <button
              onClick={() => {
                setAddItemModalFocusWeightFirst(false);
                setShowAddItemModal(true);
              }}
              className="min-h-[44px] px-2 sm:px-4 py-2.5 glass-panel text-ink hover:shadow-glow-brand rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1 sm:gap-2 transition-all active:scale-[0.98] touch-manipulation"
            >
              <span>+</span> Add Item
            </button>
            <button
              onClick={() => {
                if (items.length === 0) {
                  showNotification("Cart is empty", "warning");
                  return;
                }
                // Move the customer display into payment mode (QR only after UPI is tapped).
                publishPaymentMode(
                  useCartStore.getState().getCheckoutTotal(),
                  null
                );
                setShowQuickCheckout(true);
              }}
              className="min-h-[44px] px-2 sm:px-4 py-2.5 bg-gradient-brand text-white shadow-glow-brand hover:shadow-glow-brand-lg hover:brightness-105 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1 sm:gap-2 transition-all active:scale-[0.98] touch-manipulation"
            >
              ⚡ Quick Pay
            </button>
            <button
              type="button"
              onClick={() => openParkCartModal()}
              className="min-h-[44px] px-2 sm:px-4 py-2.5 glass-panel text-ink hover:shadow-glow-brand rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1 sm:gap-2 transition-all active:scale-[0.98] touch-manipulation"
            >
              ⏸ Hold
            </button>
            <button
              type="button"
              onClick={() => void openHoldModal()}
              className="min-h-[44px] px-2 sm:px-4 py-2.5 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1 sm:gap-2 transition-all active:scale-[0.98] touch-manipulation"
            >
              📋 Held
            </button>
            <Link
              href="/store/cart"
              className="min-h-[44px] px-2 sm:px-4 py-2.5 glass-panel text-ink hover:shadow-glow-brand rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1 sm:gap-2 relative transition-all active:scale-[0.98] touch-manipulation"
            >
              🛒 Cart
              <span
                className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold min-w-[20px] text-center ${
                  items.length > 0 ? "bg-gradient-brand text-white" : "hidden"
                }`}
              >
                {items.length}
              </span>
            </Link>
            <CustomerDisplayButton className="min-h-[44px] px-2 sm:px-4 py-2.5 text-xs sm:text-sm" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-1.5 min-h-0 overflow-hidden px-2">
        <div className="flex-1 relative glass-panel rounded-2xl p-3 sm:p-4 overflow-hidden flex flex-col min-h-0">
          <div className="relative flex flex-col min-h-0 h-full">
            {/* Barcode + search — always visible */}
            <div className="mb-2 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 flex-shrink-0">
              <form onSubmit={handleBarcodeSubmit}>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                  Barcode / SKU
                </label>
                <div className="relative">
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    data-pos-primary-barcode="true"
                    placeholder="Scan or type, then Enter"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="w-full min-h-[48px] px-4 py-3 pr-11 text-base border-2 border-strong rounded-xl text-ink bg-surface focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 placeholder:text-ink-muted touch-manipulation"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <button type="submit" className="sr-only" tabIndex={-1}>
                    Add barcode
                  </button>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                      />
                    </svg>
                  </div>
                </div>
              </form>
              <div className="relative">
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                  Search products
                </label>
                <div className="relative w-full">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Name or SKU…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full min-h-[48px] px-4 py-3 pl-11 text-base border-2 border-strong text-ink rounded-xl bg-surface placeholder:text-ink-muted focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 touch-manipulation"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-red-500 rounded-lg touch-manipulation"
                      aria-label="Clear search"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {categories.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1 flex-shrink-0 scrollbar-thin touch-pan-x">
                <button
                  type="button"
                  onClick={() => setCategoryFilter("all")}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    categoryFilter === "all"
                      ? "bg-brand-600 text-white"
                      : "bg-surface-2 text-ink-secondary"
                  }`}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryFilter(c.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      categoryFilter === c.id
                        ? "bg-brand-600 text-white"
                        : "bg-surface-2 text-ink-secondary"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {franchiseConfig?.isPricingLocked && (
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-2 mb-2 flex-shrink-0 flex items-center gap-2">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  HQ locked pricing. Manager/owner can confirm an override when needed.
                </p>
              </div>
            )}

            {favoriteProducts.length > 0 && (
              <div className="mb-2 flex-shrink-0">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Favorites — tap to add
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin touch-pan-x">
                  {favoriteProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleAddProduct(product)}
                      className="flex-shrink-0 min-h-[44px] px-4 py-2.5 rounded-xl border-2 border-brand-300 dark:border-brand-600 bg-brand-50 dark:bg-brand-950/40 text-sm font-semibold text-brand-900 dark:text-brand-100 whitespace-nowrap touch-manipulation active:scale-[0.98]"
                    >
                      {product.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Masale — text-only chips, horizontal scroll */}
            {masaleProducts.length > 0 && (
              <div className="mb-2 flex-shrink-0 border-b border-amber-200/70 dark:border-amber-800/70 pb-2">
                <h3 className="text-xs font-bold text-amber-900 dark:text-amber-100 mb-1.5 flex flex-wrap items-center gap-2">
                  <span aria-hidden>🧂</span>
                  Masale
                  <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400">
                    Swipe · tap adds 1
                  </span>
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-thin touch-pan-x snap-x snap-mandatory">
                  {masaleFiltered.length === 0 ? (
                    <p className="text-xs text-amber-800/80 dark:text-amber-200/80 py-2 px-1">
                      No masale match search
                    </p>
                  ) : (
                    masaleFiltered.map((product) => {
                      const displayPrice =
                        product.productMaster?.hqLockedPrice ??
                        product.pricePerUnit;
                      const qtyKg = product.unitType === "KG" ? 1 : undefined;
                      const qtyPcs = product.unitType === "PCS" ? 1 : undefined;
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() =>
                            handleAddProductToCart(product, qtyKg, qtyPcs)
                          }
                          className="flex-shrink-0 snap-start max-w-[11rem] min-h-[44px] px-3 py-2 rounded-xl border border-amber-400/85 dark:border-amber-600/75 bg-amber-50/95 dark:bg-amber-950/35 hover:bg-amber-100/95 dark:hover:bg-amber-900/45 active:scale-[0.98] touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 text-left"
                        >
                          <span className="text-xs font-semibold text-gray-900 dark:text-gray-50 line-clamp-2 leading-snug block">
                            {product.name}
                          </span>
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-300 tabular-nums mt-0.5 block">
                            ₹{displayPrice.toFixed(2)}
                            <span className="font-normal text-gray-500 dark:text-gray-400 ml-1">
                              /{product.unitType}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Main product grid */}
            <div className="flex-1 overflow-y-auto -mx-1 px-1 min-h-0">
              {loading.products ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <SkeletonProductCard key={i} />
                  ))}
                </div>
              ) : error.products ? (
                <div className="text-center py-12">
                  <p className="text-sm text-red-500/80 dark:text-red-400/80 mb-3">
                    {error.products}
                  </p>
                  <button
                    onClick={loadProducts}
                    className="px-3 py-1.5 text-sm bg-brand-500/90 text-white rounded-md hover:bg-brand-500 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    No products found
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
                    Products need to be added to the system
                  </p>
                </div>
              ) : productsForGrid.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">
                    No products match your search
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                  {productsForGrid.map((product) => {
                    const isLocked = product.productMaster?.isHQLocked;
                    const displayPrice =
                      product.productMaster?.hqLockedPrice ||
                      product.pricePerUnit;
                    const st = stockByProductId[product.id];
                    const isFav = favoriteIds.includes(product.id);
                    return (
                      <div
                        key={product.id}
                        className="relative flex flex-col rounded-2xl border border-subtle bg-surface hover:border-brand-400 hover:shadow-glow-brand transition-all duration-150 overflow-hidden active:scale-[0.98]"
                      >
                        <button
                          type="button"
                          title={isFav ? "Remove favorite" : "Add favorite"}
                          className="absolute top-1 right-1 z-10 min-h-[44px] min-w-[44px] rounded-full bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-600 text-lg leading-none flex items-center justify-center text-amber-500 hover:bg-amber-50 dark:hover:bg-gray-800 touch-manipulation shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(product.id);
                          }}
                        >
                          {isFav ? "★" : "☆"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddProduct(product)}
                          className="flex flex-col flex-1 text-left p-2 pt-1.5 active:scale-[0.99] touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 rounded-2xl"
                        >
                          <PosProductTileImage
                            src={product.imageUrl}
                            alt={product.name}
                            fallback={posGridImageFallback(product)}
                            aspectClass="aspect-[16/9] max-h-[72px] sm:max-h-[84px]"
                          />
                          <div className="font-bold text-xs sm:text-sm line-clamp-2 text-gray-900 dark:text-gray-50 leading-snug mt-2 min-h-[2rem]">
                            {product.name}
                          </div>
                          <div className="flex items-baseline gap-1 mt-1 flex-wrap">
                            <span className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white tabular-nums">
                              ₹{displayPrice.toFixed(2)}
                            </span>
                            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                              /{product.unitType}
                            </span>
                            {isLocked && (
                              <span
                                className="text-[11px] ml-0.5"
                                title="Price locked"
                              >
                                🔒
                              </span>
                            )}
                          </div>
                          {st && (
                            <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">
                              Stock:{" "}
                              {product.unitType === "KG"
                                ? `${st.kg.toFixed(2)} kg`
                                : `${st.pcs} pcs`}
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddItemModal && (
        <AddItemModal
          item={manualItem}
          products={products}
          focusWeightFirst={addItemModalFocusWeightFirst}
          onChange={(field, value) => {
            setManualItem((prev) => {
              const updated = { ...prev, [field]: value };
              // Auto-calculate total if weight/rate changed
              if (field === "weight" || field === "rate") {
                const weight = parseFloat(updated.weight) || 0;
                const rate = parseFloat(updated.rate) || 0;
                const qtyPcs = parseFloat(updated.weight) || 1;
                if (updated.unitType === "KG" && weight > 0 && rate > 0) {
                  updated.total = (weight * rate).toFixed(2);
                } else if (
                  updated.unitType === "PCS" &&
                  qtyPcs > 0 &&
                  rate > 0
                ) {
                  updated.total = (qtyPcs * rate).toFixed(2);
                }
              }
              // Auto-calculate rate if total/weight changed
              if (field === "total" || field === "weight") {
                const total = parseFloat(updated.total) || 0;
                const weight = parseFloat(updated.weight) || 0;
                const qtyPcs = parseFloat(updated.weight) || 1;
                if (
                  updated.unitType === "KG" &&
                  weight > 0 &&
                  total > 0 &&
                  !updated.rate
                ) {
                  updated.rate = (total / weight).toFixed(2);
                } else if (
                  updated.unitType === "PCS" &&
                  qtyPcs > 0 &&
                  total > 0 &&
                  !updated.rate
                ) {
                  updated.rate = (total / qtyPcs).toFixed(2);
                }
              }
              return updated;
            });
          }}
          onClose={() => {
            setAddItemModalFocusWeightFirst(false);
            setShowAddItemModal(false);
            setManualItem({
              sku: "",
              description: "",
              weight: "",
              rate: "",
              total: "",
              unitType: "KG",
            });
          }}
          onSubmit={handleManualItemSubmit}
        />
      )}

      {/* Price Override Modal */}
      {showPriceOverrideModal && priceOverrideData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-3 md:p-4 safe-top safe-bottom">
          <div className="glass-panel-strong rounded-2xl p-3 sm:p-4 md:p-6 w-full max-w-sm sm:max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-y-auto animate-scale-in mx-2 sm:mx-4">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold dark:text-white mb-3 sm:mb-4">
              Price Override Required
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Product:
                </p>
                <p className="font-semibold dark:text-white">
                  {priceOverrideData.productName}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Locked Price:
                </p>
                <p className="font-semibold dark:text-white">
                  ₹{priceOverrideData.lockedPrice.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Requested Price:
                </p>
                <p className="font-semibold dark:text-white">
                  ₹{priceOverrideData.requestedPrice.toFixed(2)}
                </p>
              </div>
              <p className="text-sm text-ink-muted">
                Confirm as {user?.role === "OWNER" ? "owner" : "manager"} to sell
                at the requested price. Qty:{" "}
                {priceOverrideData.qtyKg
                  ? `${priceOverrideData.qtyKg} kg`
                  : priceOverrideData.qtyPcs
                    ? `${priceOverrideData.qtyPcs} pcs`
                    : "1"}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                <button
                  onClick={() => {
                    setShowPriceOverrideModal(false);
                    setPriceOverrideData(null);
                  }}
                  className="flex-1 px-4 py-3 text-base bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 touch-target"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePriceOverride}
                  className="flex-1 px-4 py-3 text-base bg-brand-500 text-white rounded-md hover:bg-brand-600 touch-target font-semibold"
                >
                  Confirm override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Checkout — same payment surface as Cart */}
      {showQuickCheckout && (
        <CartPaymentModal
          grandTotal={checkoutGrandTotal}
          cartGrandTotal={cartGrandTotal}
          pendingSettlementLines={pendingSettlements}
          subTotal={cartSubTotal}
          taxTotal={cartTaxTotal}
          discountTotal={cartDiscountTotal}
          deliveryFee={deliveryFee}
          setDeliveryFee={setDeliveryFee}
          fulfillmentType={fulfillmentType}
          setFulfillmentType={setFulfillmentType}
          customerId={customerId}
          isProcessing={isProcessingPayment}
          onClose={() => {
            setShowQuickCheckout(false);
            publishCurrentBill();
          }}
          onPay={handleQuickCheckoutPay}
        />
      )}

      {showHoldLabelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
          <div className="glass-panel-strong rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div>
              <h2 className="text-lg font-bold text-ink">Hold cart</h2>
              <p className="text-sm text-ink-muted mt-1">
                {items.length} lines · ₹
                {Math.round(cartGrandTotal).toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink-secondary mb-1.5">
                Label
              </label>
              <input
                type="text"
                value={holdLabel}
                onChange={(e) => setHoldLabel(e.target.value)}
                className="w-full px-3 py-3 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm"
                autoFocus
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {["Counter 1", "Counter 2", "Phone order", "Waiting"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setHoldLabel(preset)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface-2 text-ink-secondary hover:text-ink"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowHoldLabelModal(false)}
                className="flex-1 py-3 rounded-xl border border-[color:var(--border-strong)] font-semibold text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmHoldCart()}
                className="flex-1 py-3 rounded-xl bg-gradient-brand text-white font-semibold"
              >
                Hold
              </button>
            </div>
          </div>
        </div>
      )}

      {shortcutsBanner && (
        <div className="fixed bottom-4 left-1/2 z-[100] max-w-md -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-center text-sm text-white shadow-xl">
          <p className="mb-1 font-semibold">POS shortcuts</p>
          <p className="text-xs text-gray-300">
            Alt+H — Held carts · ? — This hint · Hold — Park current cart · ☆ on a
            tile — Favorites · Checkout warns if stock is low (from inventory)
          </p>
        </div>
      )}

      {showHoldModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl glass-panel-strong animate-scale-in">
            <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
              <h2 className="text-lg font-semibold dark:text-white">
                Held carts
              </h2>
              <button
                type="button"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setShowHoldModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 overflow-y-auto p-4">
              {heldRows.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No held carts
                </p>
              ) : (
                heldRows.map((h) => (
                  <div
                    key={h._serverId || h.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-600"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium dark:text-white">
                        {h.label}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(h.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="flex-shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                      onClick={() => void recallHeldCartById(h.id)}
                    >
                      Recall
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Animation */}
      {showSuccessAnimation && completedSale && (
        <BillSuccessAnimation
          saleNo={completedSale.saleNo}
          grandTotal={completedSale.grandTotal}
          subtitle={
            completedSale.saleNo.includes("offline")
              ? "Saved offline — will sync when internet is back."
              : "Scan next item or tap ✕ for a new bill…"
          }
          autoDismissMs={2500}
          onPrint={
            completedSale.saleNo.includes("offline")
              ? undefined
              : () => {
                  printReceipt(
                    generateReceiptData(completedSale, user?.store)
                  );
                }
          }
          billUrl={
            completedSale.saleId
              ? `/bill/${completedSale.saleId}`
              : null
          }
          onComplete={() => {
            showSuccessAnimationRef.current = false;
            setShowSuccessAnimation(false);
            setCompletedSale(null);
            // Soft-reset publisher mode only — do not Ably-idle the display
            // while it is still running success → review.
            releaseDisplaySuccessLatch();
            void clearCart();
            requestAnimationFrame(() => barcodeInputRef.current?.focus());
          }}
        />
      )}
    </div>
  );
}

function AddItemModal({
  item,
  products,
  focusWeightFirst = false,
  onChange,
  onClose,
  onSubmit,
}: {
  item: {
    sku: string;
    description: string;
    weight: string;
    rate: string;
    total: string;
    unitType: "KG" | "PCS";
  };
  products: Product[];
  focusWeightFirst?: boolean;
  onChange: (field: string, value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const [showWeightPad, setShowWeightPad] = useState(false);
  const weightButtonRef = useRef<HTMLButtonElement>(null);

  // When opening from product click (KG), auto-open weight pad so user can enter weight immediately
  useEffect(() => {
    if (focusWeightFirst && item.unitType === "KG") {
      setShowWeightPad(true);
    }
  }, [focusWeightFirst, item.unitType]);

  // When opening from product click (PCS), focus the weight/quantity button so user can tap to open pad
  useEffect(() => {
    if (focusWeightFirst && item.unitType === "PCS" && !showWeightPad) {
      weightButtonRef.current?.focus();
    }
  }, [focusWeightFirst, item.unitType, showWeightPad]);

  const handleSkuChange = (sku: string) => {
    onChange("sku", sku);
    // Auto-fill product details if found
    const product = products.find((p) => p.sku === sku || p.plu === sku);
    if (product) {
      onChange("description", product.name);
      onChange("rate", product.pricePerUnit.toString());
      onChange("unitType", product.unitType);
    }
  };

  // Calculate totals for display
  const weight = parseFloat(item.weight) || 0;
  const qtyPcs = parseFloat(item.weight) || 1;
  const rate = parseFloat(item.rate) || 0;
  const total =
    parseFloat(item.total) ||
    (item.unitType === "KG" ? weight * rate : qtyPcs * rate);
  const calculatedTotal =
    item.unitType === "KG" ? weight * rate : qtyPcs * rate;
  const showAutoCalc =
    (item.weight && item.rate && !item.total) ||
    (item.total && Math.abs(parseFloat(item.total) - calculatedTotal) < 0.01);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-3 md:p-4 safe-top safe-bottom">
      <div className="glass-panel-strong rounded-2xl w-full max-w-sm sm:max-w-md md:max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto animate-scale-in mx-2 sm:mx-0">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50 px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 flex items-center justify-between">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 dark:text-gray-100">
            Add Item to Cart
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-5">
          {/* SKU / Barcode */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              SKU / Barcode
            </label>
            <input
              type="text"
              value={item.sku}
              onChange={(e) => handleSkuChange(e.target.value)}
              placeholder="Enter SKU or scan barcode"
              className="w-full px-3 sm:px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400/60 transition-all duration-200 touch-target bg-white/80 dark:bg-gray-800/40"
              autoFocus={!focusWeightFirst}
            />
            {products.length > 0 && (
              <select
                value={item.sku}
                onChange={(e) => handleSkuChange(e.target.value)}
                className="w-full mt-2 px-3 sm:px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400/60 transition-all duration-200 touch-target bg-white/80 dark:bg-gray-800/40"
              >
                <option value="">Or select from products...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.sku}>
                    {p.sku} - {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={item.description}
              onChange={(e) => onChange("description", e.target.value)}
              placeholder="Enter product description"
              className="w-full px-3 sm:px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400/60 transition-all duration-200 touch-target bg-white/80 dark:bg-gray-800/40"
              required
            />
          </div>

          {/* Unit Type and Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Unit Type
              </label>
              <select
                value={item.unitType}
                onChange={(e) => onChange("unitType", e.target.value)}
                className="w-full px-3 sm:px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400/60 transition-all duration-200 touch-target bg-white/80 dark:bg-gray-800/40"
              >
                <option value="KG">KG</option>
                <option value="PCS">PCS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {item.unitType === "KG" ? "Weight (kg)" : "Quantity"}{" "}
                <span className="text-red-500">*</span>
              </label>
              <button
                ref={weightButtonRef}
                type="button"
                onClick={() => setShowWeightPad(true)}
                className="w-full px-3 sm:px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 dark:text-white rounded-lg hover:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400/60 transition-all duration-200 touch-target bg-white/80 dark:bg-gray-800/40 text-left font-semibold"
                tabIndex={focusWeightFirst ? 0 : undefined}
              >
                {item.weight || (
                  <span className="text-gray-400 dark:text-gray-500 font-normal">
                    {item.unitType === "KG"
                      ? "Tap to enter weight"
                      : "Tap to enter quantity"}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Rate and Total */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Rate (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={item.rate}
                onChange={(e) => onChange("rate", e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full px-3 sm:px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400/60 transition-all duration-200 touch-target bg-white/80 dark:bg-gray-800/40"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Total (₹)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={item.total}
                  onChange={(e) => onChange("total", e.target.value)}
                  placeholder={
                    showAutoCalc ? calculatedTotal.toFixed(2) : "0.00"
                  }
                  step="0.01"
                  min="0"
                  className="w-full px-3 sm:px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400/60 transition-all duration-200 touch-target bg-white/80 dark:bg-gray-800/40"
                />
                {showAutoCalc && !item.total && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500">
                    Auto: ₹{calculatedTotal.toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Summary Card */}
          {item.weight && item.rate && (
            <div className="bg-brand-50/50 dark:bg-brand-900/10 border border-brand-200/40 dark:border-brand-800/30 rounded-lg p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Subtotal:
                </span>
                <span className="text-sm sm:text-base font-semibold text-brand-600 dark:text-brand-400">
                  ₹{total.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-white touch-target font-medium transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              className="flex-1 px-4 py-2.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg touch-target font-medium shadow-sm hover:shadow transition-all duration-200"
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>

      {/* Weight/Quantity NumPad */}
      {showWeightPad && (
        <NumPad
          value={item.weight}
          onChange={(value) => onChange("weight", value)}
          onClose={() => setShowWeightPad(false)}
          onSubmit={() => setShowWeightPad(false)}
          placeholder={
            item.unitType === "KG" ? "Enter weight (kg)" : "Enter quantity"
          }
          allowDecimal={item.unitType === "KG"}
          quickPresets={item.unitType === "KG" ? [0.5, 1, 2, 5] : [1, 2, 5, 10]}
          maxLength={10}
        />
      )}
    </div>
  );
}
