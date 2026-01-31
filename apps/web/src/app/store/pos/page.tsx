"use client";

import { useEffect, useState, useRef } from "react";
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

interface FranchiseConfig {
  isPricingLocked: boolean;
  isDiscountLocked: boolean;
}

export default function StorePOSPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { items, addItem } = useCartStore();
  const { showNotification } = useNotificationStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [franchiseConfig, setFranchiseConfig] =
    useState<FranchiseConfig | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showPriceOverrideModal, setShowPriceOverrideModal] = useState(false);
  const [priceOverrideData, setPriceOverrideData] = useState<{
    productId: string;
    productName: string;
    lockedPrice: number;
    requestedPrice: number;
    managerPin: string;
  } | null>(null);
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
  const [isCategoriesVisible, setIsCategoriesVisible] = useState(false);
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
  const [showQuickCheckout, setShowQuickCheckout] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [completedSale, setCompletedSale] = useState<{
    saleNo: string;
    grandTotal: number;
  } | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    loadProducts();
    loadCategories();
    loadFranchiseConfig();
    useCartStore.getState().loadCart();
    // Focus barcode input on mount
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [user, router]);

  const loadProducts = async () => {
    setLoading((prev) => ({ ...prev, products: true }));
    setError((prev) => ({ ...prev, products: undefined }));
    try {
      const response = await api.get("/api/v1/products");
      const productsData = response.data || [];

      // Load productMaster data for each product
      const productsWithMaster = await Promise.all(
        productsData.map(async (p: any) => {
          try {
            const masterRes = await api
              .get(`/api/v1/hq/product-master?productId=${p.id}`)
              .catch(() => null);
            return {
              ...p,
              productMaster: masterRes?.data?.[0] || null,
            };
          } catch {
            return p;
          }
        })
      );

      setProducts(productsWithMaster);
    } catch (error: any) {
      console.error("Failed to load products:", error);

      // Enhanced error handling for network errors
      let errorMessage = "Failed to load products. Please try again.";
      if (error.code === "ERR_NETWORK" || error.message === "Network Error") {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "Not configured";
        errorMessage = `Cannot connect to API server. Please check if the API is running and NEXT_PUBLIC_API_URL is set correctly. (Current: ${apiUrl})`;
        console.error("Network Error Details:", {
          apiUrl,
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
    try {
      const response = await api.get("/api/v1/products/categories");
      setCategories(response.data || []);
    } catch (error: any) {
      console.error("Failed to load categories:", error);
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

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) {
      showNotification("Please enter or scan a barcode", "warning", 3000);
      return;
    }

    try {
      const storeId = user?.storeId || user?.store?.id;
      if (!storeId) {
        showNotification(
          "Store ID not found. Please contact administrator.",
          "error",
          5000
        );
        return;
      }

      // Try parsing as scale barcode
      const parsed = await parseScaleBarcode(barcodeInput, storeId);

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
          await handleAddProductToCart(
            product,
            parsed.weightKg,
            parsed.qtyPcs,
            parsed.pricePerKg
          );
          setBarcodeInput("");
          if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
          }
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
                await handleAddProductToCart(
                  fetchedProduct,
                  parsed.weightKg,
                  parsed.qtyPcs,
                  parsed.pricePerKg
                );
                setBarcodeInput("");
                if (barcodeInputRef.current) {
                  barcodeInputRef.current.focus();
                }
                return;
              }
            } catch (error: any) {
              console.error("Failed to fetch product details:", error);
            }
          }
          showNotification(
            `Product not found for barcode: ${barcodeInput}`,
            "error",
            4000
          );
        }
      }

      // Try as SKU/PLU
      const product = products.find(
        (p) => p.sku === barcodeInput || p.plu === barcodeInput
      );
      if (product) {
        handleAddProduct(product);
        setBarcodeInput("");
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus();
        }
        return;
      }

      // If not found, open manual entry with SKU pre-filled
      showNotification(
        `Product not found. Opening manual entry for: ${barcodeInput}`,
        "info",
        3000
      );
      setManualItem({
        sku: barcodeInput,
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
      setManualItem({
        sku: barcodeInput,
        description: "",
        weight: "",
        rate: "",
        total: "",
        unitType: "KG",
      });
      setShowAddItemModal(true);
      setBarcodeInput("");
    }
  };

  const handleAddProduct = (product: Product) => {
    // Open manual entry modal with product pre-filled
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
  ) => {
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
        managerPin: "",
      });
      setShowPriceOverrideModal(true);
      return;
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
        barcode: barcodeInput || undefined,
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
    if (!priceOverrideData || !priceOverrideData.managerPin) {
      showNotification("Please enter manager PIN", "warning", 3000);
      return;
    }

    try {
      // Verify manager PIN (simplified - in production, verify against user's PIN)
      if (user?.role !== "MANAGER" && user?.role !== "OWNER") {
        showNotification(
          "Only managers can override locked prices",
          "error",
          3000
        );
        return;
      }

      // Find product and add to cart with override price
      const product = products.find(
        (p) => p.id === priceOverrideData!.productId
      );
      if (!product) {
        showNotification("Product not found", "error", 3000);
        return;
      }

      const qty = 1; // Default, would come from barcode/input
      const rate = priceOverrideData.requestedPrice;
      const lineTotal = qty * rate; // Base amount without tax

      await addItem({
        productId: product.id,
        productName: product.name,
        qtyKg: product.unitType === "KG" ? qty : undefined,
        qtyPcs: product.unitType === "PCS" ? qty : undefined,
        rate,
        taxRate: product.taxRate,
        lineTotal, // Store base amount, tax calculated separately
        metaJson: {
          isPriceLocked: true,
          lockedPrice: priceOverrideData.lockedPrice,
          overridePrice: priceOverrideData.requestedPrice,
          managerOverride: true,
          managerPin: priceOverrideData.managerPin,
        },
      });

      setShowPriceOverrideModal(false);
      setPriceOverrideData(null);
    } catch (error: any) {
      showNotification(
        "Failed to override price: " +
          (error.response?.data?.error || error.message),
        "error",
        5000
      );
    }
  };

  const handleQuickCheckoutPay = async (method: string) => {
    if (isProcessingPayment) return;
    setIsProcessingPayment(true);

    try {
      const {
        items: cartItems,
        customerId,
        customerPhone,
        customerName,
        discountTotal,
        getTotal,
      } = useCartStore.getState();
      const { subTotal, taxTotal, grandTotal } = getTotal();

      const saleData = {
        customerId: customerId || undefined,
        customerPhone: customerPhone || undefined,
        customerName: customerName || undefined,
        discountTotal: discountTotal || 0,
        items: cartItems.map((item) => ({
          productId: item.productId,
          qtyKg: item.qtyKg || undefined,
          qtyPcs: item.qtyPcs || undefined,
          rate: item.rate,
          taxRate: item.taxRate,
        })),
      };

      const saleResponse = await api.post("/api/v1/sales", saleData);

      if (saleResponse.data?.requiresApproval) {
        setShowQuickCheckout(false);
        showNotification(
          `Sale created but discount requires manager approval. Sale #${saleResponse.data.sale.saleNo} is pending approval.`,
          "info"
        );
        await useCartStore.getState().clearCart();
        setTimeout(() => router.push("/store/discount-approvals"), 2000);
        return;
      }

      const sale = saleResponse.data;
      if (!sale || !sale.id) {
        throw new Error("Invalid sale response");
      }

      const roundedSaleGrandTotal = Math.round(grandTotal);
      const paymentData = {
        payments: [
          {
            method,
            amount: roundedSaleGrandTotal,
          },
        ],
      };

      await api.post(`/api/v1/sales/${sale.id}/pay`, paymentData);
      await useCartStore.getState().clearCart();
      setShowQuickCheckout(false);

      setCompletedSale({
        saleNo: sale.saleNo || "N/A",
        grandTotal: roundedSaleGrandTotal,
      });
      setShowSuccessAnimation(true);

      window.dispatchEvent(
        new CustomEvent("sale-created", {
          detail: { saleId: sale.id, payments: paymentData.payments },
        })
      );

      if (method === "CASH") {
        window.dispatchEvent(
          new CustomEvent("cash-sale-completed", {
            detail: { amount: roundedSaleGrandTotal },
          })
        );
      }
    } catch (error: any) {
      console.error("[Quick Checkout] Payment error:", error);
      const errorMessage =
        error.response?.data?.error || error.message || "Payment failed";
      showNotification(errorMessage, "error", 5000);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (selectedCategory && p.categoryId !== selectedCategory) return false;
    if (
      searchQuery &&
      !p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full min-h-0 w-full max-w-full overflow-hidden">
      {/* Cart Animation */}
      {cartAnimation && (
        <CartAnimation
          productName={cartAnimation.productName}
          productImage={cartAnimation.productImage}
          onComplete={() => setCartAnimation(null)}
        />
      )}

      {/* Header */}
      <div className="relative mb-4 sm:mb-6 pb-4 sm:pb-6 flex-shrink-0 px-2 sm:px-0">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 rounded-2xl sm:rounded-3xl opacity-50 dark:opacity-30"></div>
        <div className="relative flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 p-4 sm:p-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent mb-1 sm:mb-2 leading-tight tracking-tight">
              Point of Sale
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-gray-300 font-medium">
              Browse products and build your order
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:gap-2 md:gap-3 flex-shrink-0 w-full sm:w-auto gap-2">
          <button
            onClick={() => setIsCategoriesVisible(!isCategoriesVisible)}
            className="px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 text-gray-700 dark:text-gray-200 rounded-xl sm:rounded-2xl hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-600 dark:hover:to-gray-700 active:scale-[0.97] font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-300 touch-target text-xs sm:text-sm border border-gray-200/50 dark:border-gray-600/50 min-h-[48px] backdrop-blur-sm"
            aria-label="Toggle categories"
          >
            <span className="text-base sm:text-lg md:text-xl">📁</span>
            <span className="hidden sm:inline md:hidden">Cat</span>
            <span className="hidden md:inline">Categories</span>
          </button>
          <button
            onClick={() => setShowAddItemModal(true)}
            className="px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl sm:rounded-2xl active:scale-[0.97] font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300 touch-target text-xs sm:text-sm min-h-[48px] transform hover:scale-105"
          >
            <span className="text-lg sm:text-xl md:text-2xl font-bold">+</span>
            <span className="hidden sm:inline md:hidden">Add</span>
            <span className="hidden md:inline">Add Item</span>
          </button>
          <button
            onClick={() => {
              if (items.length === 0) {
                showNotification("Cart is empty", "warning");
                return;
              }
              setShowQuickCheckout(true);
            }}
            className="px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl sm:rounded-2xl active:scale-[0.97] font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300 relative touch-target text-xs sm:text-sm group min-h-[48px] transform hover:scale-105"
          >
            <span className="text-base sm:text-lg md:text-xl group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300">
              ⚡
            </span>
            <span className="hidden sm:inline md:hidden">Pay</span>
            <span className="hidden md:inline">Quick Pay</span>
          </button>
          <Link
            href="/store/cart"
            className="px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 bg-gradient-to-br from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-xl sm:rounded-2xl active:scale-[0.97] font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300 relative touch-target text-xs sm:text-sm group min-h-[48px] transform hover:scale-105"
          >
            <span className="text-base sm:text-lg md:text-xl group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300">
              🛒
            </span>
            <span className="hidden sm:inline md:hidden">Cart</span>
            <span className="hidden md:inline">Cart</span>
            <span
              className={`absolute -top-1 -right-1 rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-bold min-w-[22px] text-center transition-all duration-300 shadow-md ${
                items.length > 0
                  ? "bg-white text-purple-600 scale-100 animate-pulse"
                  : "bg-white/20 text-white/70 scale-0"
              }`}
            >
              {items.length}
            </span>
          </Link>
          </div>
        </div>
      </div>

      {/* Categories Bar - Top (Hidden by default, shown when clicked) */}
      {isCategoriesVisible && (
        <div className="mb-3 sm:mb-4 md:mb-6 flex-shrink-0 px-2 sm:px-0">
          <div className="relative bg-gradient-to-br from-white/90 to-gray-50/90 dark:from-gray-800/90 dark:to-gray-900/90 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-xl dark:shadow-2xl p-4 sm:p-5 md:p-6 border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5"></div>
            <div className="relative flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="font-bold text-gray-800 dark:text-gray-100 text-sm sm:text-base md:text-lg tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                Categories
              </h2>
              <button
                onClick={() => setIsCategoriesVisible(false)}
                className="p-1 sm:p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 min-h-[32px] min-w-[32px] flex items-center justify-center"
                aria-label="Hide categories"
              >
                <svg
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4"
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
            <div className="flex flex-wrap gap-2 sm:gap-2.5 md:gap-3">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all duration-300 font-semibold text-xs sm:text-sm md:text-base min-h-[44px] sm:min-h-[48px] transform hover:scale-105 active:scale-95 ${
                  !selectedCategory
                    ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg scale-105"
                    : "bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-gray-700 dark:text-gray-200 hover:from-gray-200 hover:to-gray-300 dark:hover:from-gray-600 dark:hover:to-gray-700 border border-gray-300/50 dark:border-gray-600/50 shadow-md hover:shadow-lg"
                }`}
              >
                All Products
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all duration-300 font-semibold text-xs sm:text-sm md:text-base min-h-[44px] sm:min-h-[48px] transform hover:scale-105 active:scale-95 ${
                    selectedCategory === cat.id
                      ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg scale-105"
                      : "bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-gray-700 dark:text-gray-200 hover:from-gray-200 hover:to-gray-300 dark:hover:from-gray-600 dark:hover:to-gray-700 border border-gray-300/50 dark:border-gray-600/50 shadow-md hover:shadow-lg"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-2 sm:gap-3 md:gap-4 min-h-0 overflow-hidden px-2 sm:px-0">
        {/* Center: Products Area */}
        <div className="flex-1 relative bg-gradient-to-br from-white/80 via-gray-50/80 to-white/80 dark:from-gray-800/80 dark:via-gray-900/80 dark:to-gray-800/80 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-xl dark:shadow-2xl p-4 sm:p-5 md:p-6 lg:p-8 overflow-hidden flex flex-col min-h-0 h-full border border-gray-200/50 dark:border-gray-700/50">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none"></div>
          <div className="relative flex flex-col min-h-0 h-full">
          {/* Search and Barcode Inputs */}
          <div className="mb-4 sm:mb-5 md:mb-6 lg:mb-8 space-y-3 sm:space-y-4 flex-shrink-0">
            <form onSubmit={handleBarcodeSubmit} className="relative">
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Scan barcode or enter SKU..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="w-full px-4 sm:px-5 py-3 sm:py-3.5 text-sm sm:text-base border-2 border-gray-300/60 dark:border-gray-600/60 rounded-xl sm:rounded-2xl dark:text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/80 touch-target transition-all duration-300 shadow-lg hover:shadow-xl bg-white/90 dark:bg-gray-800/60 backdrop-blur-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 font-medium"
              />
              <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
                <svg
                  className="w-4 h-4 sm:w-5"
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
            </form>
            <div className="relative flex items-center w-full">
              <div
                className={`relative transition-all duration-300 ease-out w-full ${
                  isSearchExpanded || searchQuery
                    ? "flex-1"
                    : "w-12 sm:w-14 md:w-16"
                }`}
              >
                {!isSearchExpanded && !searchQuery ? (
                  <button
                    onClick={() => {
                      setIsSearchExpanded(true);
                      setTimeout(() => searchInputRef.current?.focus(), 100);
                    }}
                    className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg bg-white/60 dark:bg-gray-800/40 border border-gray-300/60 dark:border-gray-600/60 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-all duration-200 shadow-sm hover:shadow touch-target"
                    aria-label="Search products"
                  >
                    <svg
                      className="w-5 h-5 text-gray-600 dark:text-gray-400"
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
                  </button>
                ) : (
                  <div className="relative w-full">
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => setIsSearchExpanded(true)}
                      onBlur={() => {
                        // Keep expanded if there's text, otherwise collapse after a delay
                        if (!searchQuery) {
                          setTimeout(() => {
                            if (!searchInputRef.current?.matches(":focus")) {
                              setIsSearchExpanded(false);
                            }
                          }, 200);
                        }
                      }}
                      className="w-full px-4 sm:px-5 py-3 sm:py-3.5 pl-11 sm:pl-12 text-sm sm:text-base border-2 border-gray-300/60 dark:border-gray-600/60 dark:text-white rounded-xl sm:rounded-2xl dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/80 touch-target transition-all duration-300 shadow-lg hover:shadow-xl bg-white/90 dark:bg-gray-800/60 backdrop-blur-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 font-medium"
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
                      onClick={() => {
                        setSearchQuery("");
                        setIsSearchExpanded(false);
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all duration-300 p-2 rounded-xl hover:bg-red-50/80 dark:hover:bg-red-900/20 hover:scale-110 transform"
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
                            strokeWidth={2.5}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Price Lock Indicator */}
          {franchiseConfig?.isPricingLocked && (
            <div className="bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/40 dark:border-amber-800/30 rounded-md p-2 mb-3 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-amber-600 dark:text-amber-500 text-sm">
                  🔒
                </span>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Pricing is locked by HQ. Manager PIN required for price
                  overrides.
                </p>
              </div>
            </div>
          )}

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto -mx-2 px-2">
            {loading.products ? (
              <>
                {Array.from({ length: 12 }).map((_, i) => (
                  <SkeletonProductCard key={i} />
                ))}
              </>
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
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">
                  No products match your search/filter
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4 md:gap-5 lg:gap-6 overflow-y-auto">
                {filteredProducts.map((product, index) => {
                  const isLocked = product.productMaster?.isHQLocked;
                  const displayPrice =
                    product.productMaster?.hqLockedPrice ||
                    product.pricePerUnit;
                  return (
                    <button
                      key={product.id}
                      onClick={() => handleAddProduct(product)}
                      className="group relative flex flex-col h-full p-3 sm:p-4 md:p-5 border-2 border-gray-200/60 dark:border-gray-700/60 rounded-2xl sm:rounded-3xl hover:border-blue-400/80 dark:hover:border-blue-500/60 hover:bg-gradient-to-br hover:from-blue-50/50 hover:via-purple-50/30 hover:to-pink-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/10 dark:hover:to-pink-900/20 hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-white/90 to-gray-50/90 dark:from-gray-800/80 dark:to-gray-900/80 active:scale-[0.97] touch-target backdrop-blur-sm overflow-hidden min-h-[120px] sm:min-h-[140px] md:min-h-[160px] transform hover:scale-105 hover:-translate-y-1"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-blue-500/5 group-hover:via-purple-500/5 group-hover:to-pink-500/5 transition-all duration-300 rounded-2xl"></div>
                      <div className="relative z-10 flex flex-col h-full">
                      {/* Product Image */}
                      <div className="mb-2 sm:mb-3 md:mb-4 flex justify-center items-center transform group-hover:scale-110 group-hover:rotate-2 transition-all duration-300 flex-shrink-0">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full max-w-[60px] sm:max-w-[70px] md:max-w-[80px] lg:max-w-[90px] h-[60px] sm:h-[70px] md:h-[80px] lg:h-[90px] object-cover rounded-xl sm:rounded-2xl shadow-lg group-hover:shadow-2xl transition-all duration-300 ring-2 ring-gray-200/50 group-hover:ring-blue-400/50"
                            onError={(e) => {
                              // Show placeholder instead of hiding
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                              const placeholder =
                                target.nextElementSibling as HTMLElement;
                              if (placeholder) {
                                placeholder.style.display = "flex";
                              }
                            }}
                          />
                        ) : null}
                        <div
                          className={`w-full max-w-[60px] sm:max-w-[70px] md:max-w-[80px] lg:max-w-[90px] h-[60px] sm:h-[70px] md:h-[80px] lg:h-[90px] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg ring-2 ring-gray-200/50 group-hover:ring-blue-400/50 transition-all duration-300 ${
                            product.imageUrl ? "hidden" : ""
                          }`}
                        >
                          <span className="text-gray-500 dark:text-gray-400 text-2xl sm:text-3xl md:text-4xl group-hover:scale-110 transition-transform duration-300">
                            📦
                          </span>
                        </div>
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 flex flex-col justify-between min-h-0 space-y-2 sm:space-y-2.5 md:space-y-3">
                        {/* Product Name */}
                        <div className="font-bold text-xs sm:text-sm md:text-base mb-2 sm:mb-2.5 line-clamp-2 dark:text-gray-100 text-left transition-colors duration-300 text-gray-900 leading-tight min-h-[2.5rem] sm:min-h-[3rem] group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {product.name}
                        </div>

                        {/* Price Section */}
                        <div className="flex items-baseline gap-1 sm:gap-1.5 mb-2 sm:mb-2.5 flex-wrap bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg sm:rounded-xl p-2 sm:p-2.5">
                          <span className="text-sm sm:text-base md:text-lg lg:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent whitespace-nowrap">
                            ₹{displayPrice.toFixed(2)}
                          </span>
                          <span className="text-[10px] sm:text-xs md:text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap font-semibold">
                            /{product.unitType}
                          </span>
                          {isLocked && (
                            <span
                              className="ml-auto text-xs sm:text-sm flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
                              title="Price Locked"
                            >
                              🔒
                            </span>
                          )}
                        </div>

                        {/* SKU and Category */}
                        <div className="space-y-1.5 sm:space-y-2 pt-2 sm:pt-2.5 border-t-2 border-gray-200/60 dark:border-gray-700/60 mt-auto">
                          <div className="flex items-center justify-between bg-gradient-to-r from-gray-100/80 to-gray-200/80 dark:from-gray-700/40 dark:to-gray-800/40 rounded-lg sm:rounded-xl px-2 sm:px-2.5 py-1.5 sm:py-2 min-w-0 shadow-sm">
                            <span className="text-[9px] sm:text-[10px] md:text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex-shrink-0">
                              SKU
                            </span>
                            <span className="text-[10px] sm:text-xs font-semibold text-gray-800 dark:text-gray-200 truncate ml-2 min-w-0">
                              {product.sku}
                            </span>
                          </div>
                          {product.categoryName && (
                            <div className="flex items-center justify-between bg-gradient-to-r from-purple-100/80 to-pink-100/80 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg sm:rounded-xl px-2 sm:px-2.5 py-1.5 sm:py-2 min-w-0 shadow-sm">
                              <span className="text-[10px] sm:text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider flex-shrink-0">
                                Cat
                              </span>
                              <span className="text-[10px] sm:text-xs font-semibold text-purple-800 dark:text-purple-300 truncate ml-2 min-w-0">
                                {product.categoryName}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      </div>
                    </button>
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
          <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-6 w-full max-w-sm sm:max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] mx-2 sm:mx-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Manager PIN *
                </label>
                <input
                  type="password"
                  value={priceOverrideData.managerPin}
                  onChange={(e) =>
                    setPriceOverrideData({
                      ...priceOverrideData,
                      managerPin: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-brand-500 touch-target"
                  placeholder="Enter your PIN"
                />
              </div>
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
                  Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Checkout Modal */}
      {showQuickCheckout && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-3 md:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-2xl w-full max-w-sm sm:max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-y-auto border border-gray-200/50 dark:border-gray-700/50 animate-in zoom-in-95 duration-200 mx-2 sm:mx-0">
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Quick Checkout
                </h2>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Select payment method
                </p>
              </div>
              <button
                onClick={() => setShowQuickCheckout(false)}
                disabled={isProcessingPayment}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <svg
                  className="w-4 h-4"
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

            <div className="p-4 space-y-3">
              {/* Cart Items Summary */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 max-h-40 overflow-y-auto">
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Items ({items.length})
                </h3>
                <div className="space-y-1.5">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center text-xs"
                    >
                      <div className="flex-1">
                        <span className="text-gray-900 dark:text-white font-medium">
                          {item.productName}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 ml-2">
                          {item.qtyKg ? `${item.qtyKg}kg` : `${item.qtyPcs}pcs`}{" "}
                          × ₹{item.rate}
                        </span>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        ₹
                        {((item.qtyKg || item.qtyPcs || 0) * item.rate).toFixed(
                          2
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Summary */}
              <div className="bg-gradient-to-br from-brand-50 to-brand-100/50 dark:from-brand-900/20 dark:to-brand-800/10 border border-brand-200/50 dark:border-brand-800/30 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Total Amount
                  </span>
                  <span className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                    ₹{useCartStore.getState().getTotal().grandTotal}
                  </span>
                </div>
              </div>

              {/* Payment Method Buttons */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Select Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "CASH", label: "Cash", icon: "💵" },
                    { value: "CARD", label: "Card", icon: "💳" },
                    { value: "UPI", label: "UPI", icon: "📱" },
                    { value: "CREDIT", label: "Credit", icon: "📝" },
                    { value: "ONLINE", label: "Online", icon: "🌐" },
                  ].map((method) => (
                    <button
                      key={method.value}
                      onClick={() => handleQuickCheckoutPay(method.value)}
                      disabled={isProcessingPayment}
                      className="relative p-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-2xl">{method.icon}</span>
                        <span className="font-semibold text-xs text-gray-900 dark:text-white">
                          {method.label}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {isProcessingPayment && (
                <div className="text-center py-2">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500"></div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Processing payment...
                  </p>
                </div>
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
          onComplete={() => {
            setShowSuccessAnimation(false);
            setCompletedSale(null);
          }}
        />
      )}
    </div>
  );
}

function AddItemModal({
  item,
  products,
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
  onChange: (field: string, value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const [showWeightPad, setShowWeightPad] = useState(false);

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
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-lg sm:rounded-xl md:rounded-2xl shadow-lg dark:shadow-xl w-full max-w-sm sm:max-w-md md:max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto border border-gray-200/50 dark:border-gray-700/50 mx-2 sm:mx-0">
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
              autoFocus
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
                type="button"
                onClick={() => setShowWeightPad(true)}
                className="w-full px-3 sm:px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 dark:text-white rounded-lg hover:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400/60 transition-all duration-200 touch-target bg-white/80 dark:bg-gray-800/40 text-left font-semibold"
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
