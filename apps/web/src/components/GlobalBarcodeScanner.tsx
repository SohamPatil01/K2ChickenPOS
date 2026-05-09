'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useCartStore } from '@/store/cart';
import { useNotificationStore } from '@/store/notification';
import { normalizeBarcodeForLookup } from '@azela-pos/shared';
import { parseScaleBarcode } from '@/lib/barcode';
import api from '@/lib/api';
import CartAnimation from './CartAnimation';

interface Product {
  id: string;
  sku: string;
  plu: string;
  name: string;
  unitType: 'KG' | 'PCS';
  pricePerUnit: number;
  taxRate: number;
  imageUrl?: string | null;
  productMaster?: {
    isHQLocked?: boolean;
    hqLockedPrice?: number;
  } | null;
}

export default function GlobalBarcodeScanner() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { addItem } = useCartStore();
  const { showNotification } = useNotificationStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cartAnimation, setCartAnimation] = useState<{
    productName: string;
    productImage?: string | null;
  } | null>(null);
  
  // Barcode scanning state
  const barcodeBuffer = useRef('');
  const barcodeTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastKeyTime = useRef(0);
  const isTypingInInput = useRef(false);

  // Load products on mount
  useEffect(() => {
    if (user) {
      loadProducts();
    }
  }, [user]);

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


  const processBarcode = async (barcode: string) => {
    const normalized = normalizeBarcodeForLookup(barcode);
    if (!normalized || isProcessing || !user) return;
    
    setIsProcessing(true);
    
    try {
      const storeId = user?.storeId || user?.store?.id;
      if (!storeId) {
        console.error('Store ID not found');
        setIsProcessing(false);
        return;
      }

      // Try parsing as scale barcode
      const parsed = await parseScaleBarcode(normalized, storeId);

      if (parsed) {
        const product = products.find((p) => p.id === parsed.productId);
        if (product) {
          // Navigate to POS if not already there
          if (pathname !== '/store/pos' && pathname !== '/store/cart') {
            router.push('/store/pos');
            // Wait a bit for navigation
            await new Promise(resolve => setTimeout(resolve, 300));
          }

          // Add to cart
          const qty = parsed.weightKg || parsed.qtyPcs || 1;
          const rate = parsed.pricePerKg || product.pricePerUnit;
          // Round to 2 decimal places to avoid floating point precision issues
          const roundedRate = Math.round(rate * 100) / 100;
          const lineTotal = Math.round((qty * roundedRate) * 100) / 100; // Base amount without tax

          await addItem({
            productId: product.id,
            productName: product.name,
            qtyKg: parsed.weightKg,
            qtyPcs: parsed.qtyPcs,
            rate: roundedRate,
            taxRate: product.taxRate,
            lineTotal, // Store base amount, tax calculated separately
          });

          // Trigger cart animation
          setCartAnimation({
            productName: product.name,
            productImage: product.imageUrl || null,
          });

          const qtyText = parsed.weightKg 
            ? `${parsed.weightKg.toFixed(2)} kg` 
            : parsed.qtyPcs 
            ? `${parsed.qtyPcs} pcs` 
            : '1';
          showNotification(
            `✅ Added ${product.name} (${qtyText}) to cart`,
            'success',
            2000
          );
          console.log('Barcode scanned and added to cart:', product.name);
          setIsProcessing(false);
          return;
        }
      }

      // Try as SKU/PLU (normalize so DB spacing / scan spacing both match)
      const product = products.find(
        (p) =>
          normalizeBarcodeForLookup(p.sku) === normalized ||
          normalizeBarcodeForLookup(p.plu) === normalized
      );
      if (product) {
        // Navigate to POS if not already there
        if (pathname !== '/store/pos' && pathname !== '/store/cart') {
          router.push('/store/pos');
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Add to cart with default quantity
        const qty = 1;
        const rate = product.pricePerUnit;
        // Round to 2 decimal places to avoid floating point precision issues
        const roundedRate = Math.round(rate * 100) / 100;
        const lineTotal = Math.round((qty * roundedRate) * 100) / 100; // Base amount without tax

        await addItem({
          productId: product.id,
          productName: product.name,
          qtyKg: product.unitType === 'KG' ? 1 : undefined,
          qtyPcs: product.unitType === 'PCS' ? 1 : undefined,
          rate: roundedRate,
          taxRate: product.taxRate,
          lineTotal, // Store base amount, tax calculated separately
        });

        // Trigger cart animation
        setCartAnimation({
          productName: product.name,
          productImage: product.imageUrl || null,
        });

        const qtyText = product.unitType === 'KG' ? '1 kg' : '1 pcs';
        showNotification(
          `✅ Added ${product.name} (${qtyText}) to cart`,
          'success',
          2000
        );
        console.log('Barcode scanned and added to cart:', product.name);
        setIsProcessing(false);
        return;
      }

      // If product not found, show error notification
      showNotification(
        `❌ Product not found for barcode: ${normalized}`,
        'error',
        3000
      );
      
      setIsProcessing(false);
    } catch (error: any) {
      console.error('Failed to process barcode:', error);
      showNotification(
        `❌ Failed to process barcode: ${error.message || 'Unknown error'}`,
        'error',
        3000
      );
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is actively typing in an input
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // POS page form owns this field — do not buffer keys or handle Enter here (avoids double add with onSubmit)
      const isPosPrimaryBarcode =
        isInput &&
        (target as HTMLInputElement).getAttribute('data-pos-primary-barcode') === 'true';
      if (isPosPrimaryBarcode) {
        if (e.key === 'Enter') {
          barcodeBuffer.current = '';
          if (barcodeTimeout.current) {
            clearTimeout(barcodeTimeout.current);
            barcodeTimeout.current = null;
          }
        }
        return;
      }
      
      // Check if it's the barcode input field specifically
      const isBarcodeInput = isInput && (target as HTMLInputElement).placeholder?.toLowerCase().includes('barcode') || 
                            (target as HTMLInputElement).type === 'text' && 
                            (target as HTMLInputElement).placeholder?.toLowerCase().includes('scan');
      
      // If typing in input, check timing to distinguish barcode scanner from manual typing
      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTime.current;
      
      // Barcode scanners typically send characters in < 50ms intervals
      // Manual typing is usually > 100ms between keystrokes
      const isLikelyScanner = timeSinceLastKey < 50;
      
      // If typing in an input field (but not the barcode input) and it's been slow, it's manual typing
      // But if it's fast, it might be a scanner, so we should still capture it
      if (isInput && !isBarcodeInput && timeSinceLastKey > 100 && barcodeBuffer.current.length > 0) {
        // Reset buffer on slow typing (manual input) only if not in barcode input
        barcodeBuffer.current = '';
      }
      
      lastKeyTime.current = now;

      // Ignore modifier keys and special keys (except Enter)
      if (e.key.length > 1 && e.key !== 'Enter') {
        return;
      }

      // If Enter is pressed, process the barcode
      if (e.key === 'Enter') {
        // Always process barcode if we have a buffer
        // Prioritize barcode scanning over form submission
        if (barcodeBuffer.current.length > 0) {
          // Process if:
          // 1. Not in an input field, OR
          // 2. In barcode input field, OR
          // 3. Input was fast (scanner pattern), OR
          // 4. Buffer is long enough to be a barcode (>= 8 chars suggests scanner)
          const isLongBarcode = barcodeBuffer.current.length >= 8;
          
          if (!isInput || isBarcodeInput || isLikelyScanner || isLongBarcode) {
            e.preventDefault();
            e.stopPropagation();
            
            const barcode = barcodeBuffer.current.trim();
            barcodeBuffer.current = '';
            
            // Clear any pending timeout
            if (barcodeTimeout.current) {
              clearTimeout(barcodeTimeout.current);
              barcodeTimeout.current = null;
            }
            
            // Process barcode if it looks valid (at least 3 characters after normalizing)
            if (normalizeBarcodeForLookup(barcode).length >= 3) {
              processBarcode(barcode);
            }
          } else {
            // Slow typing in input field - clear buffer and let form handle Enter
            barcodeBuffer.current = '';
          }
        }
        return;
      }

      // Accumulate characters for barcode
      // Always capture characters to detect barcode scanners
      if (e.key.length === 1) {
        // Always accumulate, but be smart about it
        // If in input and slow typing, we'll clear it on Enter
        barcodeBuffer.current += e.key;
        
        // Clear buffer after 500ms of no input (timeout)
        // This helps distinguish scanner input (fast) from manual typing (slow)
        if (barcodeTimeout.current) {
          clearTimeout(barcodeTimeout.current);
        }
        
        barcodeTimeout.current = setTimeout(() => {
          // Only clear if we're not in a barcode input field
          // and the buffer is short (likely manual typing)
          if (!isBarcodeInput && barcodeBuffer.current.length < 8) {
            barcodeBuffer.current = '';
          }
        }, 500);
      }
    };

    // Enable barcode scanning for authenticated users on all pages
    // This allows barcode scanning to work globally, not just on specific pages
    if (user) {
      window.addEventListener('keydown', handleKeyDown, true); // Use capture phase for better detection
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (barcodeTimeout.current) {
        clearTimeout(barcodeTimeout.current);
      }
    };
  }, [user, pathname, products, router, addItem, isProcessing]);

  // Handle barcode from URL query (when navigating from scanner)
  useEffect(() => {
    if (pathname === '/store/pos') {
      const params = new URLSearchParams(window.location.search);
      const barcode = params.get('barcode');
      if (barcode && !isProcessing) {
        // Remove from URL
        window.history.replaceState({}, '', '/store/pos');
        processBarcode(barcode);
      }
    }
  }, [pathname, isProcessing]);

  return (
    <>
      {/* Cart Animation */}
      {cartAnimation && (
        <CartAnimation
          productName={cartAnimation.productName}
          productImage={cartAnimation.productImage}
          onComplete={() => setCartAnimation(null)}
        />
      )}
    </>
  );
}

