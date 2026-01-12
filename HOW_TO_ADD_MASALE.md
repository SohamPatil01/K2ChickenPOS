# How to Add Masale Products

Masale (spice) products use **standard EAN-13 barcodes** and **do NOT require barcode configuration**. The system automatically looks them up by barcode.

## Quick Answer: No Configuration Needed! ✅

For masale products:
- ✅ **No barcode configuration required**
- ✅ Just add the product with barcode as SKU
- ✅ Scan the barcode - it works automatically!

## How It Works

1. **You scan barcode**: `8906148690207`
2. **System looks up**: Finds product where SKU = `8906148690207`
3. **Adds to cart**: Product added automatically
4. **That's it!** No configuration needed.

## Adding Masale Products

### Method 1: Using the Script (Easiest)

1. Edit `scripts/add-masale-product-template.ts`
2. Add your products to the array:

```typescript
const masaleProducts: MasaleProduct[] = [
  { name: 'Mutton Rassa Masala', barcode: '8906148690207', price: 30 },
  { name: 'Chicken Masala', barcode: '8906148690208', price: 35 },
  { name: 'Biryani Masala', barcode: '8906148690209', price: 40 },
];
```

3. Run the script:
```bash
cd packages/db
npx tsx ../../scripts/add-masale-product-template.ts
```

### Method 2: Through Web UI

1. Go to **Products** → **Add Product**
2. Fill in:
   - **Name**: Product name (e.g., "Mutton Rassa Masala")
   - **SKU**: The barcode number (e.g., `8906148690207`)
   - **PLU**: Same as SKU (e.g., `8906148690207`)
   - **Category**: Spices
   - **Unit Type**: PCS (pieces)
   - **Price**: Price per piece
3. Save

### Method 3: Through API

```bash
POST /api/v1/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Mutton Rassa Masala",
  "sku": "8906148690207",
  "plu": "8906148690207",
  "categoryId": "<spices-category-id>",
  "unitType": "PCS",
  "taxRate": 0
}
```

Then set the price:
```bash
POST /api/v1/products/<product-id>/price
Authorization: Bearer <token>
Content-Type: application/json

{
  "pricePerUnit": 30
}
```

## Example: Mutton Rassa Masala

**Product Details:**
- Name: Mutton Rassa Masala
- Barcode: `8906148690207`
- SKU: `8906148690207` (same as barcode)
- PLU: `8906148690207` (same as barcode)
- Category: Spices
- Unit: PCS (pieces)
- Price: ₹30/piece

**How to use:**
1. Product is already added ✅
2. Just scan the barcode `8906148690207` at POS
3. Product automatically added to cart
4. No configuration needed!

## Difference: Masale vs Scale Products

### Masale Products (Standard Barcodes)
- **Barcode Type**: EAN-13 (13 digits, starts with 8 or 9)
- **Example**: `8906148690207`
- **Configuration**: ❌ Not needed
- **How it works**: Direct SKU lookup
- **Use case**: Packaged products sold by pieces

### Scale Products (Weight-based)
- **Barcode Type**: Custom format from weighing machine
- **Example**: `2000001730003`
- **Configuration**: ✅ Required
- **How it works**: Parses barcode format to extract product ID, weight, price
- **Use case**: Fresh products sold by weight (chicken, vegetables, etc.)

## Adding More Masale Products

### Step 1: Get Product Information
- Product name
- Barcode (from package)
- Price per piece

### Step 2: Add to System
Use any of the 3 methods above (Script, Web UI, or API)

### Step 3: Test
1. Go to POS
2. Scan the barcode
3. Product should appear in cart automatically

## Troubleshooting

### Barcode not working?
1. **Check SKU matches barcode exactly**
   - No spaces
   - No extra characters
   - Exact match required

2. **Verify product is active**
   - Product must be marked as active
   - Check in Products list

3. **Check product belongs to your store**
   - Product must be available for your store
   - Check store assignment

4. **Verify price is set**
   - Product must have a price
   - Check in product details

### Product not found when scanning?
- Ensure SKU exactly matches the barcode
- Check for leading/trailing spaces
- Verify product is in the correct category
- Make sure product is active

## Summary

✅ **Masale products = No barcode configuration needed**
- Just add product with barcode as SKU
- System automatically recognizes it
- Scan and go!

❌ **Scale products = Barcode configuration required**
- Need to configure barcode format
- System parses weight and price from barcode
- More complex setup

For masale, it's that simple! 🎉

