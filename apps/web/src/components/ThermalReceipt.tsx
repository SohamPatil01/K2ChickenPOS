"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface Sale {
  id: string;
  saleNo: string;
  customer: {
    id: string;
    name: string;
    phone: string;
  } | null;
  status: string;
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  createdAt: string;
  createdBy: {
    name: string;
  };
  items: Array<{
    id: string;
    product: {
      id: string;
      name: string;
      sku: string;
      plu: string;
      unitType: "KG" | "PCS";
    };
    qtyKg?: number;
    qtyPcs?: number;
    rate: number;
    lineTotal: number;
    taxRate: number;
    taxAmount: number;
  }>;
  payments: Array<{
    id: string;
    method: string;
    amount: number;
    txnRef?: string;
  }>;
}

interface ThermalReceiptProps {
  sale: Sale;
  storeName?: string;
}

export default function ThermalReceipt({ sale, storeName = "K2 Chicken POS" }: ThermalReceiptProps) {
  const barcodeRefs = useRef<{ [key: string]: HTMLCanvasElement | null }>({});

  useEffect(() => {
    // Generate barcodes for each product
    sale.items.forEach((item) => {
      const barcodeValue = item.product.sku || item.product.plu || item.product.id;
      const canvasId = `barcode-${item.id}`;
      const canvas = barcodeRefs.current[canvasId];
      
      if (canvas && barcodeValue) {
        try {
          // Clear canvas first
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
          
          JsBarcode(canvas, String(barcodeValue), {
            format: "CODE128",
            width: 2,
            height: 50,
            displayValue: true,
            fontSize: 12,
            margin: 5,
            background: "transparent",
          });
        } catch (error) {
          console.error("Failed to generate barcode:", error);
        }
      }
    });
  }, [sale.items]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="thermal-receipt" style={{ 
      width: "80mm", 
      maxWidth: "80mm",
      margin: "0 auto",
      padding: "10px",
      fontFamily: "monospace",
      fontSize: "12px",
      lineHeight: "1.4",
      backgroundColor: "white",
      color: "black",
      boxSizing: "border-box"
    }}>
      {/* Store Header */}
      <div style={{ textAlign: "center", marginBottom: "10px" }}>
        <h2 style={{ 
          fontSize: "18px", 
          fontWeight: "bold", 
          margin: "5px 0",
          textTransform: "uppercase"
        }}>
          {storeName}
        </h2>
        <div style={{ fontSize: "10px", marginTop: "5px" }}>
          Thank you for your visit!
        </div>
      </div>

      <hr style={{ border: "1px dashed #000", margin: "10px 0" }} />

      {/* Sale Info */}
      <div style={{ marginBottom: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
          <span>Bill No:</span>
          <span style={{ fontWeight: "bold" }}>{sale.saleNo}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
          <span>Date:</span>
          <span>{formatDate(sale.createdAt)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
          <span>Cashier:</span>
          <span>{sale.createdBy.name}</span>
        </div>
        {sale.customer && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
              <span>Customer:</span>
              <span>{sale.customer.name}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
              <span>Phone:</span>
              <span>{sale.customer.phone}</span>
            </div>
          </>
        )}
      </div>

      <hr style={{ border: "1px dashed #000", margin: "10px 0" }} />

      {/* Items */}
      <div style={{ marginBottom: "10px" }}>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "2fr 1fr 1fr",
          fontWeight: "bold",
          marginBottom: "8px",
          paddingBottom: "5px",
          borderBottom: "1px solid #000"
        }}>
          <span>Item</span>
          <span style={{ textAlign: "right" }}>Qty</span>
          <span style={{ textAlign: "right" }}>Amount</span>
        </div>
        
        {sale.items.map((item) => {
          const qty = item.qtyKg 
            ? `${item.qtyKg.toFixed(2)} kg`
            : item.qtyPcs 
            ? `${item.qtyPcs} pcs`
            : "1";
          
          return (
            <div key={item.id} style={{ marginBottom: "12px" }}>
              <div style={{ marginBottom: "5px" }}>
                <div style={{ fontWeight: "bold", marginBottom: "3px" }}>
                  {item.product.name}
                </div>
                <div style={{ fontSize: "10px", color: "#666" }}>
                  SKU: {item.product.sku} | {item.product.unitType}
                </div>
              </div>
              
              {/* Barcode */}
              {(item.product.sku || item.product.plu) && (
                <div style={{ textAlign: "center", margin: "5px 0" }}>
                  <canvas
                    ref={(el) => {
                      barcodeRefs.current[`barcode-${item.id}`] = el;
                    }}
                    style={{ maxWidth: "100%", height: "auto", display: "block" }}
                  />
                </div>
              )}
              
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "2fr 1fr 1fr",
                fontSize: "11px",
                marginTop: "5px"
              }}>
                <span>₹{item.rate.toFixed(2)} × {qty}</span>
                <span style={{ textAlign: "right" }}>{qty}</span>
                <span style={{ textAlign: "right", fontWeight: "bold" }}>
                  ₹{item.lineTotal.toFixed(2)}
                </span>
              </div>
              
              {item.taxRate > 0 && (
                <div style={{ fontSize: "10px", color: "#666", marginTop: "3px" }}>
                  Tax ({item.taxRate}%): ₹{item.taxAmount.toFixed(2)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <hr style={{ border: "1px dashed #000", margin: "10px 0" }} />

      {/* Totals */}
      <div style={{ marginBottom: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
          <span>Subtotal:</span>
          <span>₹{sale.subTotal.toFixed(2)}</span>
        </div>
        {sale.taxTotal > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
            <span>Tax:</span>
            <span>₹{sale.taxTotal.toFixed(2)}</span>
          </div>
        )}
        {sale.discountTotal > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px", color: "#d32f2f" }}>
            <span>Discount:</span>
            <span>-₹{sale.discountTotal.toFixed(2)}</span>
          </div>
        )}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          marginTop: "10px",
          paddingTop: "10px",
          borderTop: "2px solid #000",
          fontWeight: "bold",
          fontSize: "14px"
        }}>
          <span>Grand Total:</span>
          <span>₹{sale.grandTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Payments */}
      {sale.payments.length > 0 && (
        <>
          <hr style={{ border: "1px dashed #000", margin: "10px 0" }} />
          <div style={{ marginBottom: "10px" }}>
            <div style={{ fontWeight: "bold", marginBottom: "5px" }}>Payment:</div>
            {sale.payments.map((payment) => (
              <div key={payment.id} style={{ 
                display: "flex", 
                justifyContent: "space-between",
                marginBottom: "3px",
                fontSize: "11px"
              }}>
                <span>{payment.method}:</span>
                <span>₹{payment.amount.toFixed(2)}</span>
                {payment.txnRef && (
                  <div style={{ fontSize: "10px", color: "#666", width: "100%" }}>
                    Ref: {payment.txnRef}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <hr style={{ border: "1px dashed #000", margin: "10px 0" }} />

      {/* Footer */}
      <div style={{ textAlign: "center", marginTop: "15px", fontSize: "10px" }}>
        <div style={{ marginBottom: "5px" }}>
          Status: {sale.status === "PAID" ? "PAID" : sale.status === "VOID" ? "CANCELLED" : "OPEN"}
        </div>
        <div style={{ marginTop: "10px" }}>
          Thank you for your business!
        </div>
        <div style={{ marginTop: "5px", fontSize: "9px" }}>
          Visit us again soon
        </div>
      </div>
    </div>
  );
}

