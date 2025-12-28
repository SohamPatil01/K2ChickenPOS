# Barcode Configuration Guide

## Your Barcode Format

**Example:** `2000001730003`

**Breakdown:**

- **Prefix (fixed):** `20` (2 digits, always the same)
- **Product ID:** `00001` (5 digits, identifies the product)
- **Total Price:** `73000` (5 digits = ₹730.00, total price for this item)
- **Checksum:** `3` (1 digit, verification number)

## Configuration Values for Settings Page

When creating the scale barcode configuration in **Settings → Scale Barcode Configuration**, use these exact values:

| Field                         | Value                    | Explanation                                                       |
| ----------------------------- | ------------------------ | ----------------------------------------------------------------- |
| **Name**                      | `Machine Barcode Format` | Any name you prefer                                               |
| **Prefix**                    | `20`                     | First 2 fixed digits                                              |
| **Product ID Start Position** | `0`                      | Starts right after prefix                                         |
| **Product ID Length**         | `5`                      | 5 digits for product ID                                           |
| **Weight Start Position**     | `0`                      | Weight not encoded                                                |
| **Weight Length**             | `0`                      | Weight not encoded (will be calculated)                           |
| **Weight Decimals**           | `2`                      | Not used, but required                                            |
| **Price Start Position**      | `5`                      | Starts after product ID (position 0-4 = product ID, so 5 is next) |
| **Price Length**              | `5`                      | 5 digits for total price                                          |
| **Price Decimals**            | `2`                      | 73000 = 730.00                                                    |
| **Checksum Type**             | `NONE`                   | Or MOD10/MOD11 if you implement validation                        |
| **Active**                    | ✓                        | Check this box                                                    |

## How It Works

1. **Scan barcode:** `2000001730003`
2. **System extracts:**
   - Product ID: `00001` → Finds product "Aniket" (SKU: 00001)
   - Total Price: `73000` → ₹730.00
3. **System calculates:**
   - Gets unit price from product: ₹500.00/kg
   - Calculates weight: 730.00 ÷ 500.00 = **1.46 kg**
4. **Adds to cart:**
   - Product: Aniket
   - Weight: 1.46 kg
   - Rate: ₹500.00/kg
   - Total: ₹730.00

## Important Notes

- Make sure your product has **SKU = "00001"** (or PLU = "00001")
- The product must have a **price set** (unit price per kg)
- The **weight is calculated automatically** from total price ÷ unit price
- The configuration must be **Active** for it to work
