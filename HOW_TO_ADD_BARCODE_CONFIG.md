# How to Add Barcode Configuration

This guide explains how to add a scale barcode configuration to your POS system.

## What is a Barcode Configuration?

A barcode configuration tells the system how to parse scale barcodes (weight-based product barcodes). When you scan a barcode from a weighing scale, the system needs to know:
- Where the product ID is located
- Where the weight is located (if encoded)
- Where the price is located (if encoded)
- What format each field uses

## Methods to Add Barcode Configuration

### Method 1: Through Web UI (Easiest) ✅

1. **Login** to your POS system
2. Go to **Settings** → **Scale Barcode Configuration**
3. Click **"Add Configuration"** or **"New Configuration"** button
4. Fill in the form:

#### Required Fields:

| Field | Description | Example |
|-------|-------------|---------|
| **Name** | A descriptive name for this configuration | "Machine Barcode Format" |
| **Prefix** | Fixed characters at the start of barcode | "20" |
| **Product ID Start** | Position where product ID starts (0-based) | 0 |
| **Product ID Length** | Number of digits for product ID | 5 |
| **Weight Start** | Position where weight starts (0 if not encoded) | 0 |
| **Weight Length** | Number of digits for weight (0 if not encoded) | 0 |
| **Weight Decimals** | Decimal places for weight | 2 |
| **Price Start** | Position where price starts (optional) | 5 |
| **Price Length** | Number of digits for price (optional) | 5 |
| **Price Decimals** | Decimal places for price (optional) | 2 |
| **Checksum Type** | Validation type: NONE, MOD10, or MOD11 | NONE |
| **Active** | Whether this config is active | ✓ |

5. Click **"Save"** or **"Create"**

### Method 2: Through API

Use the API endpoint to create a configuration programmatically:

```bash
POST /api/v1/scale/config
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "name": "Machine Barcode Format",
  "prefix": "20",
  "pluStart": 0,
  "pluLength": 5,
  "weightStart": 0,
  "weightLength": 0,
  "weightDecimal": 2,
  "priceStart": 5,
  "priceLength": 5,
  "priceDecimal": 2,
  "checksumType": "NONE",
  "isActive": true
}
```

**Example using curl:**
```bash
curl -X POST https://your-api.vercel.app/api/v1/scale/config \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Machine Barcode Format",
    "prefix": "20",
    "pluStart": 0,
    "pluLength": 5,
    "weightStart": 0,
    "weightLength": 0,
    "weightDecimal": 2,
    "priceStart": 5,
    "priceLength": 5,
    "priceDecimal": 2,
    "checksumType": "NONE",
    "isActive": true
  }'
```

### Method 3: Using Script

Run the provided script:

```bash
cd packages/db
npx tsx ../../scripts/add-barcode-config.ts
```

This will create an example configuration that you can modify.

## Understanding Barcode Format

### Example Barcode: `2000001730003`

Let's break it down:

```
Position:  0  1  2  3  4  5  6  7  8  9  10 11 12
Barcode:   2  0  0  0  0  1  7  3  0  0  0  3
           └─┘ └─────┘ └─────┘ └─┘
           │   │       │       │
           │   │       │       └─ Checksum (1 digit)
           │   │       └───────── Total Price: 73000 = ₹730.00 (5 digits)
           │   └───────────────── Product ID: 00001 (5 digits)
           └───────────────────── Prefix: 20 (2 digits, fixed)
```

### Configuration for this example:

- **Prefix**: `20` (always at the start)
- **Product ID Start**: `0` (starts right after prefix, position 0)
- **Product ID Length**: `5` (5 digits: 00001)
- **Weight Start**: `0` (not encoded, will be calculated)
- **Weight Length**: `0` (not encoded)
- **Price Start**: `5` (starts after product ID, position 5)
- **Price Length**: `5` (5 digits: 73000)
- **Price Decimals**: `2` (73000 = 730.00)

## Common Barcode Formats

### Format 1: With Weight Encoded
**Example**: `20123451234567890`
- Prefix: `20`
- Product ID: `12345` (5 digits)
- Weight: `12345` (5 digits = 123.45 kg)
- Price: `67890` (5 digits = ₹678.90)

**Configuration:**
```json
{
  "prefix": "20",
  "pluStart": 0,
  "pluLength": 5,
  "weightStart": 5,
  "weightLength": 5,
  "weightDecimal": 2,
  "priceStart": 10,
  "priceLength": 5,
  "priceDecimal": 2
}
```

### Format 2: Weight Calculated from Price
**Example**: `2000001730003` (our example)
- Prefix: `20`
- Product ID: `00001` (5 digits)
- Weight: Not encoded (calculated from price ÷ unit price)
- Price: `73000` (5 digits = ₹730.00)

**Configuration:**
```json
{
  "prefix": "20",
  "pluStart": 0,
  "pluLength": 5,
  "weightStart": 0,
  "weightLength": 0,
  "weightDecimal": 2,
  "priceStart": 5,
  "priceLength": 5,
  "priceDecimal": 2
}
```

### Format 3: Simple Product Barcode (No Scale)
**Example**: `8906148690207` (like Mutton Rassa Masala)
- This is a standard EAN-13 barcode
- No configuration needed - system looks up by SKU directly
- Product must have SKU matching the barcode

## How It Works

1. **Scan barcode**: Customer scans `2000001730003`
2. **System extracts**:
   - Checks prefix matches: `20` ✓
   - Extracts Product ID: `00001`
   - Finds product with PLU or SKU = `00001`
   - Extracts Total Price: `73000` = ₹730.00
3. **System calculates**:
   - Gets unit price from product: ₹500.00/kg
   - Calculates weight: 730.00 ÷ 500.00 = **1.46 kg**
4. **Adds to cart**:
   - Product: Found product
   - Weight: 1.46 kg
   - Rate: ₹500.00/kg
   - Total: ₹730.00

## Important Notes

1. **Product must exist**: The product ID in the barcode must match a product's PLU or SKU
2. **Price must be set**: The product must have a price set for weight calculation
3. **Only one active config**: Only one configuration can be active per store at a time
4. **Position is 0-based**: Start positions begin at 0 (first character is position 0)
5. **Weight calculation**: If weight is not encoded, it's calculated as: `Weight = Total Price ÷ Unit Price`

## Troubleshooting

### Barcode not recognized
- Check prefix matches
- Verify product exists with matching PLU/SKU
- Ensure configuration is active

### Wrong weight calculated
- Check price decimals setting
- Verify product unit price is correct
- Check weight decimal places

### Product not found
- Ensure product has PLU or SKU matching the barcode's product ID
- Check product is active
- Verify product belongs to the store

## Testing Your Configuration

After creating a configuration, test it:

1. Go to **Settings → Scale Barcode Configuration**
2. Click on your configuration
3. Use the "Test" or "Parse" feature (if available)
4. Or scan a barcode at the POS and verify it works correctly

## API Endpoints

- **GET** `/api/v1/scale/config` - List all configurations
- **POST** `/api/v1/scale/config` - Create new configuration
- **PUT** `/api/v1/scale/config/:id` - Update configuration
- **DELETE** `/api/v1/scale/config/:id` - Delete configuration
- **POST** `/api/v1/scale/parse` - Test barcode parsing

