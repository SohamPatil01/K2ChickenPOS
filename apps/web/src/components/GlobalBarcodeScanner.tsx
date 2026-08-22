'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

function findProductBySkuOrPlu(products: Product[], normalized: string) {
  return products.find(
    (p) =>
      normalizeBarcodeForLookup(p.sku) === normalized ||
      normalizeBarcodeForLookup(p.plu) === normalized
  );
}

export default function GlobalBarcodeScanner() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { addItem } = useCartStore();
  const { showNotification } = useNotificationStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [cartAnimation, setCartAnimation] = useState<{
    productName: string;
    productImage?: string | null;
  } | null>(null);

  const barcodeBuffer = useRef('');
  const barcodeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyTime = useRef(0);
  const isProcessingRef = useRef(false);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const productsRef = useRef<Product[]>([]);
  const pathnameRef = useRef(pathname);
  const userRef = useRef(user);

  productsRef.current = products;
  pathnameRef.current = pathname;
  userRef.current = user;

  useEffect(() => {
    if (user) {
      void (async () => {
        try {
          const response = await api.get('/api/v1/products');
          setProducts(response.data || []);
        } catch (error) {
          console.error('Failed to load products for barcode scanner:', error);
        }
      })();
    }
  }, [user]);

  const fetchProductById = async (
    productId: string
  ): Promise<Product | undefined> => {
    try {
      const res = await api.get(`/api/v1/products/${productId}`);
      return res.data ?? undefined;
    } catch {
      return undefined;
    }
  };

  const fetchProductBySkuOrPlu = async (
    normalized: string
  ): Promise<Product | undefined> => {
    try {
      const res = await api.get('/api/v1/products', {
        params: { search: normalized },
      });
      const list: Product[] = res.data || [];
      return findProductBySkuOrPlu(list, normalized);
    } catch {
      return undefined;
    }
  };

  const processBarcode = useCallback(
    async (barcode: string) => {
      const normalized = normalizeBarcodeForLookup(barcode);
      const currentUser = userRef.current;
      if (!normalized || !currentUser) return;

      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.code === normalized && now - last.at < 600) {
        return;
      }
      if (isProcessingRef.current) return;

      isProcessingRef.current = true;
      lastScanRef.current = { code: normalized, at: now };

      try {
        const storeId = currentUser.storeId || currentUser.store?.id;
        if (!storeId) {
          showNotification(
            'Store ID not found. Please log in again.',
            'error',
            4000
          );
          return;
        }

        const catalog = productsRef.current;
        let product = findProductBySkuOrPlu(catalog, normalized);

        const addAndNotify = async (
          p: Product,
          qtyKg?: number,
          qtyPcs?: number,
          rateOverride?: number
        ) => {
          const useKg =
            qtyKg != null
              ? qtyKg
              : qtyPcs == null && p.unitType === 'KG'
                ? 1
                : undefined;
          const usePcs =
            qtyPcs != null
              ? qtyPcs
              : qtyKg == null && p.unitType === 'PCS'
                ? 1
                : undefined;
          const qty = useKg || usePcs || 1;
          const rate = rateOverride ?? p.pricePerUnit;
          const roundedRate = Math.round(rate * 100) / 100;
          const lineTotal = Math.round(qty * roundedRate * 100) / 100;

          await addItem({
            productId: p.id,
            productName: p.name,
            qtyKg: useKg,
            qtyPcs: usePcs,
            rate: roundedRate,
            taxRate: p.taxRate,
            lineTotal,
          });

          setCartAnimation({
            productName: p.name,
            productImage: p.imageUrl || null,
          });

          const qtyText = useKg
            ? `${useKg.toFixed(2)} kg`
            : usePcs
              ? `${usePcs} pcs`
              : p.unitType === 'KG'
                ? '1 kg'
                : '1 pcs';
          showNotification(
            `✅ Added ${p.name} (${qtyText}) to cart`,
            'success',
            2000
          );
          if (pathnameRef.current !== '/store/cart') {
            router.push('/store/cart');
          }
        };

        if (product) {
          await addAndNotify(product);
          return;
        }

        const parsed = await parseScaleBarcode(normalized, storeId);
        if (parsed) {
          product =
            catalog.find((p) => p.id === parsed.productId) ||
            (await fetchProductById(parsed.productId));
          if (product) {
            await addAndNotify(
              product,
              parsed.weightKg,
              parsed.qtyPcs,
              parsed.pricePerKg
            );
            return;
          }
        }

        product = await fetchProductBySkuOrPlu(normalized);
        if (product) {
          await addAndNotify(product);
          return;
        }

        showNotification(
          `❌ Product not found for barcode: ${normalized}`,
          'error',
          3000
        );
      } catch (error: any) {
        console.error('Failed to process barcode:', error);
        showNotification(
          `❌ Failed to process barcode: ${error.message || 'Unknown error'}`,
          'error',
          3000
        );
      } finally {
        isProcessingRef.current = false;
      }
    },
    [addItem, router, showNotification]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      const isPosPrimaryBarcode =
        isInput &&
        (target as HTMLInputElement).getAttribute('data-pos-primary-barcode') ===
          'true';

      // POS barcode field owns Enter — do not steal keys into the global buffer.
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

      const skipGlobalBarcode =
        isInput &&
        ((target as HTMLElement).getAttribute('data-skip-global-barcode') ===
          'true' ||
          !!(target as HTMLElement).closest('[data-skip-global-barcode]'));
      if (skipGlobalBarcode) {
        if (e.key === 'Enter') {
          barcodeBuffer.current = '';
          if (barcodeTimeout.current) {
            clearTimeout(barcodeTimeout.current);
            barcodeTimeout.current = null;
          }
        }
        return;
      }

      const placeholder = (
        (target as HTMLInputElement).placeholder || ''
      ).toLowerCase();
      const isBarcodeInput =
        isInput &&
        (placeholder.includes('barcode') ||
          placeholder.includes('scan') ||
          (target as HTMLInputElement).type === 'text' &&
            placeholder.includes('sku'));

      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTime.current;
      const isLikelyScanner = timeSinceLastKey < 50;

      if (
        isInput &&
        !isBarcodeInput &&
        timeSinceLastKey > 100 &&
        barcodeBuffer.current.length > 0
      ) {
        barcodeBuffer.current = '';
      }

      lastKeyTime.current = now;

      if (e.key.length > 1 && e.key !== 'Enter') {
        return;
      }

      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length > 0) {
          const isLongBarcode = barcodeBuffer.current.length >= 8;

          if (!isInput || isBarcodeInput || isLikelyScanner || isLongBarcode) {
            e.preventDefault();
            e.stopPropagation();

            const barcode = barcodeBuffer.current.trim();
            barcodeBuffer.current = '';

            if (barcodeTimeout.current) {
              clearTimeout(barcodeTimeout.current);
              barcodeTimeout.current = null;
            }

            if (normalizeBarcodeForLookup(barcode).length >= 3) {
              void processBarcode(barcode);
            }
          } else {
            barcodeBuffer.current = '';
          }
        }
        return;
      }

      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;

        if (barcodeTimeout.current) {
          clearTimeout(barcodeTimeout.current);
        }

        barcodeTimeout.current = setTimeout(() => {
          if (!isBarcodeInput && barcodeBuffer.current.length < 8) {
            barcodeBuffer.current = '';
          }
        }, 500);
      }
    };

    if (user && pathname !== '/store/pos') {
      window.addEventListener('keydown', handleKeyDown, true);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (barcodeTimeout.current) {
        clearTimeout(barcodeTimeout.current);
      }
    };
  }, [user, pathname, processBarcode]);

  useEffect(() => {
    if (pathname !== '/store/pos') return;
    const params = new URLSearchParams(window.location.search);
    const barcode = params.get('barcode');
    if (barcode && !isProcessingRef.current) {
      window.history.replaceState({}, '', '/store/pos');
      void processBarcode(barcode);
    }
  }, [pathname, processBarcode]);

  return (
    <>
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
