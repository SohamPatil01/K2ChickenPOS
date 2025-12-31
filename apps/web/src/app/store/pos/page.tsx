'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useCartStore } from '@/store/cart';
import api from '@/lib/api';
import { parseScaleBarcode } from '@/lib/barcode';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  sku: string;
  plu: string;
  categoryId: string;
  categoryName: string;
  unitType: 'KG' | 'PCS';
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
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [franchiseConfig, setFranchiseConfig] = useState<FranchiseConfig | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showPriceOverrideModal, setShowPriceOverrideModal] = useState(false);
  const [priceOverrideData, setPriceOverrideData] = useState<{
    productId: string;
    productName: string;
    lockedPrice: number;
    requestedPrice: number;
    managerPin: string;
  } | null>(null);
  const [manualItem, setManualItem] = useState({
    sku: '',
    description: '',
    weight: '',
    rate: '',
    total: '',
    unitType: 'KG' as 'KG' | 'PCS',
  });
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
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
    try {
      const response = await api.get('/api/v1/products');
      const productsData = response.data || [];
      
      // Load productMaster data for each product
      const productsWithMaster = await Promise.all(
        productsData.map(async (p: any) => {
          try {
            const masterRes = await api.get(`/api/v1/hq/product-master?productId=${p.id}`).catch(() => null);
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
      console.error('Failed to load products:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await api.get('/api/v1/products/categories');
      setCategories(response.data || []);
    } catch (error: any) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadFranchiseConfig = async () => {
    try {
      const storeId = user?.storeId;
      if (!storeId) return;

      const response = await api.get('/api/v1/stores/franchise-config').catch(() => ({ data: null }));
      const config = response.data;
      if (config) {
        setFranchiseConfig({
          isPricingLocked: config.isPricingLocked || false,
          isDiscountLocked: config.isDiscountLocked || false,
        });
      }
    } catch (error: any) {
      console.error('Failed to load franchise config:', error);
    }
  };

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    try {
      const storeId = user?.storeId || user?.store?.id;
      if (!storeId) {
        alert('Store ID not found');
        return;
      }

      // Try parsing as scale barcode
      const parsed = await parseScaleBarcode(barcodeInput, storeId);

      if (parsed) {
        const product = products.find((p) => p.id === parsed.productId);
        if (product) {
          await handleAddProductToCart(product, parsed.weightKg, parsed.qtyPcs, parsed.pricePerKg);
          setBarcodeInput('');
          if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
          }
          return;
        }
      }

      // Try as SKU/PLU
      const product = products.find((p) => p.sku === barcodeInput || p.plu === barcodeInput);
      if (product) {
        handleAddProduct(product);
        setBarcodeInput('');
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus();
        }
        return;
      }

      // If not found, open manual entry with SKU pre-filled
      setManualItem({
        sku: barcodeInput,
        description: '',
        weight: '',
        rate: '',
        total: '',
        unitType: 'KG',
      });
      setShowAddItemModal(true);
      setBarcodeInput('');
    } catch (error: any) {
      console.error('Failed to process barcode:', error);
      // On error, open manual entry modal
      setManualItem({
        sku: barcodeInput,
        description: '',
        weight: '',
        rate: '',
        total: '',
        unitType: 'KG',
      });
      setShowAddItemModal(true);
      setBarcodeInput('');
    }
  };

  const handleAddProduct = (product: Product) => {
    // Open manual entry modal with product pre-filled
    setManualItem({
      sku: product.sku,
      description: product.name,
      weight: '',
      rate: product.pricePerUnit.toString(),
      total: '',
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
    const isPriceLocked = franchiseConfig?.isPricingLocked || product.productMaster?.isHQLocked;
    const lockedPrice = product.productMaster?.hqLockedPrice || product.pricePerUnit;
    const requestedPrice = overridePrice || product.pricePerUnit;

    // If price is locked and requested price differs, require manager PIN
    if (isPriceLocked && overridePrice && overridePrice !== lockedPrice) {
      setPriceOverrideData({
        productId: product.id,
        productName: product.name,
        lockedPrice: lockedPrice!,
        requestedPrice: overridePrice,
        managerPin: '',
      });
      setShowPriceOverrideModal(true);
      return;
    }

    // Calculate line total
    const qty = qtyKg || qtyPcs || 1;
    const rate = overridePrice || lockedPrice || product.pricePerUnit;
    const lineTotal = qty * rate;
    const taxAmount = lineTotal * (product.taxRate / 100);

    await addItem({
      productId: product.id,
      productName: product.name,
      qtyKg: qtyKg,
      qtyPcs: qtyPcs,
      rate,
      taxRate: product.taxRate,
      lineTotal: lineTotal + taxAmount,
      metaJson: {
        isPriceLocked,
        lockedPrice,
        overridePrice: overridePrice && overridePrice !== lockedPrice ? overridePrice : undefined,
      },
    });
  };

  const handleManualItemSubmit = () => {
    const rate = parseFloat(manualItem.rate) || 0;
    const weight = parseFloat(manualItem.weight) || 0;
    const qtyPcs = parseFloat(manualItem.weight) || 1; // For PCS, weight field is used as quantity
    const total = parseFloat(manualItem.total) || 0;

    if (!manualItem.description.trim()) {
      alert('Please enter description');
      return;
    }

    if (manualItem.unitType === 'KG' && weight <= 0) {
      alert('Please enter valid weight');
      return;
    }

    if (rate <= 0 && total <= 0) {
      alert('Please enter rate or total amount');
      return;
    }

    // Find product by SKU if exists
    const product = products.find((p) => p.sku === manualItem.sku);

    const finalRate = rate || total / (manualItem.unitType === 'KG' ? weight : qtyPcs);
    const finalTotal = total || finalRate * (manualItem.unitType === 'KG' ? weight : qtyPcs);

    addItem({
      productId: product?.id || 'manual',
      productName: manualItem.description,
      qtyKg: manualItem.unitType === 'KG' ? weight : undefined,
      qtyPcs: manualItem.unitType === 'PCS' ? qtyPcs : undefined,
      rate: finalRate,
      taxRate: product?.taxRate || 0,
      lineTotal: finalTotal,
      metaJson: {
        sku: manualItem.sku,
        manualEntry: true,
        barcode: barcodeInput || undefined,
      },
    });

    // Reset and close
    setManualItem({
      sku: '',
      description: '',
      weight: '',
      rate: '',
      total: '',
      unitType: 'KG',
    });
    setShowAddItemModal(false);
  };

  const handlePriceOverride = async () => {
    if (!priceOverrideData || !priceOverrideData.managerPin) {
      alert('Please enter manager PIN');
      return;
    }

    try {
      // Verify manager PIN (simplified - in production, verify against user's PIN)
      if (user?.role !== 'MANAGER' && user?.role !== 'OWNER') {
        alert('Only managers can override locked prices');
        return;
      }

      // Find product and add to cart with override price
      const product = products.find((p) => p.id === priceOverrideData!.productId);
      if (!product) {
        alert('Product not found');
        return;
      }

      const qty = 1; // Default, would come from barcode/input
      const rate = priceOverrideData.requestedPrice;
      const lineTotal = qty * rate;
      const taxAmount = lineTotal * (product.taxRate / 100);

      await addItem({
        productId: product.id,
        productName: product.name,
        qtyKg: product.unitType === 'KG' ? qty : undefined,
        qtyPcs: product.unitType === 'PCS' ? qty : undefined,
        rate,
        taxRate: product.taxRate,
        lineTotal: lineTotal + taxAmount,
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
      alert('Failed to override price: ' + (error.response?.data?.error || error.message));
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
    <div className="h-[calc(100vh-8rem)] sm:h-[calc(100vh-9rem)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-200 dark:border-gray-700 gap-3 sm:gap-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">Point of Sale</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Select products and add to cart</p>
        </div>
        <div className="flex gap-2 sm:gap-3 flex-shrink-0">
          <button
            onClick={() => setShowAddItemModal(true)}
            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-brand-500 text-white rounded-lg hover:bg-brand-600 active:bg-brand-700 font-semibold flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-200 border-2 border-brand-400 touch-target text-sm sm:text-base"
          >
            <span className="text-lg sm:text-xl font-bold text-white">+</span>
            <span className="text-white hidden sm:inline">Add Item</span>
            <span className="text-white sm:hidden">Add</span>
          </button>
          <Link
            href="/store/cart"
            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-brand-500 text-white rounded-lg hover:bg-brand-600 active:bg-brand-700 font-semibold flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-200 relative border-2 border-brand-400 touch-target text-sm sm:text-base"
          >
            <span className="text-lg sm:text-xl text-white">🛒</span>
            <span className="text-white hidden sm:inline">Cart</span>
            <span className={`rounded-full px-2 sm:px-2.5 py-1 text-xs font-bold min-w-[20px] sm:min-w-[24px] text-center ${
              items.length > 0 
                ? 'bg-white text-brand-600 shadow-sm' 
                : 'bg-white/30 text-white'
            }`}>
              {items.length}
            </span>
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row gap-3 sm:gap-4 min-h-0">
        {/* Left: Categories Sidebar */}
        <div className="hidden md:block w-48 flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] p-4 overflow-y-auto">
          <h2 className="font-bold mb-4 text-gray-900 dark:text-gray-100 text-base">Categories</h2>
          <div className="space-y-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`w-full text-left px-3 py-2.5 rounded-md transition-all ${
                !selectedCategory
                  ? 'bg-brand-500 text-white font-semibold shadow-sm'
                  : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full text-left px-3 py-2.5 rounded-md transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-brand-500 text-white font-semibold shadow-sm'
                    : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Categories - Horizontal Scroll */}
        <div className="md:hidden w-full bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] p-2 overflow-x-auto mb-3 sm:mb-4 -mx-3 sm:-mx-4 px-3 sm:px-4">
          <div className="flex space-x-2 min-w-max">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 sm:px-4 py-2 rounded-md whitespace-nowrap transition-all touch-target text-sm ${
                !selectedCategory
                  ? 'bg-brand-500 text-white font-semibold shadow-sm'
                  : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 sm:px-4 py-2 rounded-md whitespace-nowrap transition-all touch-target text-sm ${
                  selectedCategory === cat.id
                    ? 'bg-brand-500 text-white font-semibold shadow-sm'
                    : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Products Area */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] p-3 sm:p-4 overflow-y-auto flex flex-col min-h-0">
          {/* Search and Barcode Inputs */}
          <div className="mb-3 sm:mb-4 space-y-2 flex-shrink-0">
            <form onSubmit={handleBarcodeSubmit}>
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Scan barcode..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-base border-2 border-brand-500 dark:border-brand-400 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 touch-target"
              />
            </form>
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-base border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent touch-target"
            />
          </div>

          {/* Price Lock Indicator */}
          {franchiseConfig?.isPricingLocked && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-2.5 mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-yellow-600 dark:text-yellow-400">🔒</span>
                <p className="text-xs text-yellow-800 dark:text-yellow-300">
                  Pricing is locked by HQ. Manager PIN required for price overrides.
                </p>
              </div>
            </div>
          )}

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto">
            {products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 mb-4">No products found</p>
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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                {filteredProducts.map((product) => {
                  const isLocked = product.productMaster?.isHQLocked;
                  const displayPrice = product.productMaster?.hqLockedPrice || product.pricePerUnit;
                  return (
                    <button
                      key={product.id}
                      onClick={() => handleAddProduct(product)}
                      className="p-2 sm:p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-brand-500 dark:hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:shadow-md transition-all bg-white dark:bg-gray-800 active:scale-95 touch-target"
                    >
                      {/* Product Image */}
                      <div className="mb-1.5 sm:mb-2 flex justify-center">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 object-cover rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                            <span className="text-gray-400 dark:text-gray-500 text-xs">No Image</span>
                          </div>
                        )}
                      </div>

                      {/* Product Details */}
                      <div>
                        <div className="font-semibold text-xs sm:text-sm mb-1 line-clamp-2 dark:text-white text-left">
                          {product.name}
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-brand-600 dark:text-brand-400 mb-0.5 sm:mb-1 text-left">
                          ₹{displayPrice.toFixed(2)}/{product.unitType}
                          {isLocked && <span className="ml-1 text-xs">🔒</span>}
                        </div>
                        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 text-left truncate">
                          SKU: {product.sku}
                        </div>
                        {product.categoryName && (
                          <div className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mt-0.5 text-left truncate">
                            {product.categoryName}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
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
              if (field === 'weight' || field === 'rate') {
                const weight = parseFloat(updated.weight) || 0;
                const rate = parseFloat(updated.rate) || 0;
                const qtyPcs = parseFloat(updated.weight) || 1;
                if (updated.unitType === 'KG' && weight > 0 && rate > 0) {
                  updated.total = (weight * rate).toFixed(2);
                } else if (updated.unitType === 'PCS' && qtyPcs > 0 && rate > 0) {
                  updated.total = (qtyPcs * rate).toFixed(2);
                }
              }
              // Auto-calculate rate if total/weight changed
              if (field === 'total' || field === 'weight') {
                const total = parseFloat(updated.total) || 0;
                const weight = parseFloat(updated.weight) || 0;
                const qtyPcs = parseFloat(updated.weight) || 1;
                if (updated.unitType === 'KG' && weight > 0 && total > 0 && !updated.rate) {
                  updated.rate = (total / weight).toFixed(2);
                } else if (updated.unitType === 'PCS' && qtyPcs > 0 && total > 0 && !updated.rate) {
                  updated.rate = (total / qtyPcs).toFixed(2);
                }
              }
              return updated;
            });
          }}
          onClose={() => {
            setShowAddItemModal(false);
            setManualItem({
              sku: '',
              description: '',
              weight: '',
              rate: '',
              total: '',
              unitType: 'KG',
            });
          }}
          onSubmit={handleManualItemSubmit}
        />
      )}

      {/* Price Override Modal */}
      {showPriceOverrideModal && priceOverrideData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 safe-top safe-bottom">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
            <h2 className="text-xl sm:text-2xl font-bold dark:text-white mb-3 sm:mb-4">Price Override Required</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Product:</p>
                <p className="font-semibold dark:text-white">{priceOverrideData.productName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Locked Price:</p>
                <p className="font-semibold dark:text-white">₹{priceOverrideData.lockedPrice.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Requested Price:</p>
                <p className="font-semibold dark:text-white">₹{priceOverrideData.requestedPrice.toFixed(2)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Manager PIN *
                </label>
                <input
                  type="password"
                  value={priceOverrideData.managerPin}
                  onChange={(e) =>
                    setPriceOverrideData({ ...priceOverrideData, managerPin: e.target.value })
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
    unitType: 'KG' | 'PCS';
  };
  products: Product[];
  onChange: (field: string, value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const handleSkuChange = (sku: string) => {
    onChange('sku', sku);
    // Auto-fill product details if found
    const product = products.find((p) => p.sku === sku || p.plu === sku);
    if (product) {
      onChange('description', product.name);
      onChange('rate', product.pricePerUnit.toString());
      onChange('unitType', product.unitType);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 safe-top safe-bottom">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
        <h2 className="text-xl sm:text-2xl font-bold dark:text-white mb-3 sm:mb-4">Add Item</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              SKU / Barcode
            </label>
            <input
              type="text"
              value={item.sku}
              onChange={(e) => handleSkuChange(e.target.value)}
              placeholder="Enter SKU or scan barcode"
              className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 touch-target"
              autoFocus
            />
            {products.length > 0 && (
              <select
                value={item.sku}
                onChange={(e) => handleSkuChange(e.target.value)}
                className="w-full mt-2 px-4 py-3 text-base border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 touch-target"
              >
                <option value="">Select from products...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.sku}>
                    {p.sku} - {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={item.description}
              onChange={(e) => onChange('description', e.target.value)}
              placeholder="Product description"
              className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 touch-target"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Unit Type
              </label>
              <select
                value={item.unitType}
                onChange={(e) => onChange('unitType', e.target.value)}
                className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 touch-target"
              >
                <option value="KG">KG</option>
                <option value="PCS">PCS</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {item.unitType === 'KG' ? 'Weight (kg)' : 'Quantity'}
              </label>
              <input
                type="number"
                value={item.weight}
                onChange={(e) => onChange('weight', e.target.value)}
                placeholder={item.unitType === 'KG' ? '0.00' : '1'}
                step={item.unitType === 'KG' ? '0.01' : '1'}
                min="0"
                className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 touch-target"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rate
              </label>
              <input
                type="number"
                value={item.rate}
                onChange={(e) => onChange('rate', e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 touch-target"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Total
              </label>
              <input
                type="number"
                value={item.total}
                onChange={(e) => onChange('total', e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 touch-target"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 mt-4 sm:mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white touch-target"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              className="flex-1 px-4 py-3 text-base bg-brand-500 text-white rounded hover:bg-brand-600 touch-target font-semibold"
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
