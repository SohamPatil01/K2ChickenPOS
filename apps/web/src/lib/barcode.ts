import api from './api';

export interface ParsedBarcode {
  productId: string;
  plu: string;
  weightKg?: number;
  qtyPcs?: number;
  pricePerKg?: number;
  lineTotal?: number;
  raw: string;
}

export async function parseScaleBarcode(
  barcode: string,
  storeId: string,
  configId?: string
): Promise<ParsedBarcode | null> {
  try {
    const response = await api.post('/api/v1/scale/parse', {
      barcode,
      configId,
    });
    return response.data;
  } catch (error: any) {
    console.error('Failed to parse barcode:', error);
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    // If it's a 400 error, it might mean no config exists - that's okay, we'll try SKU lookup
    if (error.response?.status === 400) {
      console.log('Scale barcode config may not exist or barcode format doesn\'t match');
    }
    return null;
  }
}

