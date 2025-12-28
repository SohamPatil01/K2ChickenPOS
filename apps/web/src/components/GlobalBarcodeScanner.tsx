'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useCartStore } from '@/store/cart';
import { useNotificationStore } from '@/store/notification';
import { parseScaleBarcode } from '@/lib/barcode';
import api from '@/lib/api';

interface Product {
  id: string;
  sku: string;
  plu: string;
  name: string;
  unitType: 'KG' | 'PCS';
  pricePerUnit: number;
  taxRate: number;
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
    if (!barcode.trim() || isProcessing || !user) return;
    
    setIsProcessing(true);
    
    try {
      const storeId = user?.storeId || user?.store?.id;
      if (!storeId) {
        console.error('Store ID not found');
        setIsProcessing(false);
        return;
      }

      // Try parsing as scale barcode
      const parsed = await parseScaleBarcode(barcode, storeId);

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
          const lineTotal = qty * rate;
          const taxAmount = lineTotal * (product.taxRate / 100);

          await addItem({
            productId: product.id,
            productName: product.name,
            qtyKg: parsed.weightKg,
            qtyPcs: parsed.qtyPcs,
            rate,
            taxRate: product.taxRate,
            lineTotal: lineTotal + taxAmount,
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

      // Try as SKU/PLU
      const product = products.find((p) => p.sku === barcode || p.plu === barcode);
      if (product) {
        // Navigate to POS if not already there
        if (pathname !== '/store/pos' && pathname !== '/store/cart') {
          router.push('/store/pos');
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Add to cart with default quantity
        const qty = 1;
        const rate = product.pricePerUnit;
        const lineTotal = qty * rate;
        const taxAmount = lineTotal * (product.taxRate / 100);

        await addItem({
          productId: product.id,
          productName: product.name,
          qtyKg: product.unitType === 'KG' ? 1 : undefined,
          qtyPcs: product.unitType === 'PCS' ? 1 : undefined,
          rate,
          taxRate: product.taxRate,
          lineTotal: lineTotal + taxAmount,
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
        `❌ Product not found for barcode: ${barcode}`,
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
      
      // If typing in input, check timing to distinguish barcode scanner from manual typing
      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTime.current;
      
      // If typing in an input field and it's been slow (>100ms), it's manual typing
      // Barcode scanners typically send characters in < 50ms intervals
      if (isInput && timeSinceLastKey > 100 && barcodeBuffer.current.length > 0) {
        // Reset buffer on slow typing (manual input)
        barcodeBuffer.current = '';
      }
      
      lastKeyTime.current = now;

      // Ignore modifier keys and special keys (except Enter)
      if (e.key.length > 1 && e.key !== 'Enter') {
        return;
      }

      // If Enter is pressed, process the barcode
      if (e.key === 'Enter') {
        // Don't intercept Enter if user is in an input field (let form submission handle it)
        if (isInput && barcodeBuffer.current.length === 0) {
          return;
        }
        
        if (barcodeBuffer.current.length > 0) {
          // Only prevent default if we have a barcode buffer
          // This allows normal form submissions to work
          e.preventDefault();
          e.stopPropagation();
          
          const barcode = barcodeBuffer.current.trim();
          barcodeBuffer.current = '';
          
          // Clear any pending timeout
          if (barcodeTimeout.current) {
            clearTimeout(barcodeTimeout.current);
            barcodeTimeout.current = null;
          }
          
          // Only process if it looks like a barcode (at least 3 characters)
          // and was entered quickly (barcode scanner pattern)
          if (barcode.length >= 3) {
            processBarcode(barcode);
          }
        }
        return;
      }

      // If typing in an input field and it's been slow, don't treat as barcode
      if (isInput && timeSinceLastKey > 100) {
        // Reset buffer on slow typing
        if (barcodeBuffer.current.length > 0) {
          barcodeBuffer.current = '';
        }
        return;
      }

      // Accumulate characters for barcode
      // Barcode scanners typically send characters very quickly (< 50ms intervals)
      if (e.key.length === 1) {
        // Only accumulate if not in an input field, or if input is very fast (scanner)
        if (!isInput || timeSinceLastKey < 50) {
          barcodeBuffer.current += e.key;
          
          // Clear buffer after 500ms of no input (timeout)
          if (barcodeTimeout.current) {
            clearTimeout(barcodeTimeout.current);
          }
          
          barcodeTimeout.current = setTimeout(() => {
            barcodeBuffer.current = '';
          }, 500);
        }
      }
    };

    // Only enable barcode scanning for authenticated users on store pages
    if (user && pathname?.startsWith('/store')) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
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

  return null; // This component doesn't render anything
}

