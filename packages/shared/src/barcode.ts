/** Normalize scanned or entered barcodes for lookup (matches API behavior). */
export function normalizeBarcodeForLookup(barcode: string): string {
  return barcode.trim().replace(/\s/g, '');
}
