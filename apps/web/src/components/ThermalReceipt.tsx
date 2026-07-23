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
    area?: string | null;
  } | null;
  status: string;
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  deliveryFee?: number;
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

export default function ThermalReceipt({
  sale,
  storeName = "K2 Chicken POS",
}: ThermalReceiptProps) {
  const barcodeRefs = useRef<{ [key: string]: HTMLCanvasElement | null }>({});

  useEffect(() => {
    // Generate barcodes for each product
    sale.items.forEach((item) => {
      const barcodeValue =
        item.product.sku || item.product.plu || item.product.id;
      const canvasId = `barcode-${item.id}`;
      const canvas = barcodeRefs.current[canvasId];

      if (canvas && barcodeValue) {
        try {
          // Clear canvas first
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }

          JsBarcode(canvas, String(barcodeValue), {
            format: "CODE128",
            width: 1.5,
            height: 40,
            displayValue: true,
            fontSize: 10,
            margin: 3,
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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className="thermal-receipt"
      style={{
        width: "58mm",
        maxWidth: "58mm",
        margin: "0 auto",
        padding: "6px",
        fontFamily: "monospace",
        fontSize: "10px",
        lineHeight: "1.4",
        backgroundColor: "white",
        color: "black",
        boxSizing: "border-box",
      }}
    >
      {/* Store Header */}
      <div style={{ textAlign: "center", marginBottom: "12px" }}>
        <div
          style={{
            fontSize: "20px",
            fontWeight: "bold",
            margin: "8px 0 4px 0",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          K2 Chicken
        </div>
        <div
          style={{
            fontSize: "8px",
            marginTop: "2px",
            color: "#333",
          }}
        >
          GSTIN: 27ATGPP7842L1Z0
        </div>
        <div
          style={{
            fontSize: "8px",
            marginTop: "3px",
            color: "#555",
            lineHeight: 1.35,
          }}
        >
          Shop No. 4, 24K Glitterati, Vishal Nagar,
          <br />
          Pimple Nilakh, Pune 411027
        </div>
        <div
          style={{
            fontSize: "9px",
            marginTop: "4px",
            fontWeight: "bold",
            marginBottom: "2px",
          }}
        >
          WhatsApp / Call 8484978622
        </div>
        <div
          style={{
            fontSize: "8px",
            marginTop: "2px",
            color: "#555",
          }}
        >
          points.k2chicken.com
        </div>
      </div>

      <div
        style={{
          borderTop: "1px dashed #000",
          margin: "8px 0",
        }}
      />

      {/* Bill Information */}
      <div style={{ marginBottom: "8px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "3px",
            fontSize: "9px",
          }}
        >
          <span style={{ fontWeight: "bold" }}>Bill No:</span>
          <span style={{ fontWeight: "bold" }}>{sale.saleNo}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "3px",
            fontSize: "9px",
          }}
        >
          <span>Date:</span>
          <span>{formatDate(sale.createdAt)}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "3px",
            fontSize: "9px",
          }}
        >
          <span>Time:</span>
          <span>{formatTime(sale.createdAt)}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "3px",
            fontSize: "9px",
          }}
        >
          <span>Cashier:</span>
          <span>{sale.createdBy.name}</span>
        </div>
        {sale.customer && (
          <>
            <div
              style={{
                borderTop: "1px dashed #ccc",
                margin: "6px 0",
                paddingTop: "6px",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "4px",
                fontSize: "11px",
              }}
            >
              <span style={{ fontWeight: "bold" }}>Customer:</span>
              <span style={{ fontWeight: "bold" }}>{sale.customer.name}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "4px",
                fontSize: "11px",
              }}
            >
              <span>Phone:</span>
              <span>{sale.customer.phone}</span>
            </div>
            {sale.customer.area && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "4px",
                  fontSize: "11px",
                }}
              >
                <span>Area:</span>
                <span>{sale.customer.area}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div
        style={{
          borderTop: "1px dashed #000",
          margin: "8px 0",
        }}
      />

      {/* Items Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "3fr 1fr 1.2fr",
          fontWeight: "bold",
          marginBottom: "6px",
          paddingBottom: "4px",
          borderBottom: "2px solid #000",
          fontSize: "9px",
        }}
      >
        <span>Item</span>
        <span style={{ textAlign: "right" }}>Qty</span>
        <span style={{ textAlign: "right" }}>Amount</span>
      </div>

      {/* Items List */}
      <div style={{ marginBottom: "8px" }}>
        {sale.items.map((item, index) => {
          const qty = item.qtyKg
            ? `${item.qtyKg.toFixed(2)} kg`
            : item.qtyPcs
            ? `${item.qtyPcs} pcs`
            : "1";

          return (
            <div
              key={item.id}
              style={{
                marginBottom: index < sale.items.length - 1 ? "10px" : "0",
                paddingBottom: index < sale.items.length - 1 ? "8px" : "0",
                borderBottom:
                  index < sale.items.length - 1 ? "1px dashed #ccc" : "none",
              }}
            >
              {/* Product Name */}
              <div
                style={{
                  fontWeight: "bold",
                  marginBottom: "3px",
                  fontSize: "9px",
                }}
              >
                {item.product.name}
              </div>

              {/* Product Details */}
              <div
                style={{
                  fontSize: "9px",
                  color: "#666",
                  marginBottom: "4px",
                }}
              >
                SKU: {item.product.sku} | {item.product.unitType}
              </div>

              {/* Barcode */}
              {(item.product.sku || item.product.plu) && (
                <div
                  style={{
                    textAlign: "center",
                    margin: "4px 0",
                  }}
                >
                  <canvas
                    ref={(el) => {
                      barcodeRefs.current[`barcode-${item.id}`] = el;
                    }}
                    style={{
                      maxWidth: "100%",
                      height: "auto",
                      display: "block",
                    }}
                  />
                </div>
              )}

              {/* Price Details */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "3fr 1fr 1.2fr",
                  fontSize: "10px",
                  marginTop: "4px",
                }}
              >
                <span style={{ color: "#666" }}>
                  ₹{item.rate.toFixed(2)} × {qty}
                </span>
                <span style={{ textAlign: "right", color: "#666" }}>{qty}</span>
                <span
                  style={{
                    textAlign: "right",
                    fontWeight: "bold",
                  }}
                >
                  ₹{item.lineTotal.toFixed(2)}
                </span>
              </div>

              {/* Tax Info */}
              {item.taxRate > 0 && (
                <div
                  style={{
                    fontSize: "9px",
                    color: "#666",
                    marginTop: "3px",
                    textAlign: "right",
                  }}
                >
                  Tax ({item.taxRate}%): ₹{item.taxAmount.toFixed(2)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          borderTop: "1px dashed #000",
          margin: "8px 0",
        }}
      />

      {/* Totals Section */}
      <div style={{ marginBottom: "8px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "4px",
            fontSize: "9px",
          }}
        >
          <span>Subtotal:</span>
          <span>₹{sale.subTotal.toFixed(2)}</span>
        </div>
        {sale.taxTotal > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "4px",
              fontSize: "9px",
            }}
          >
            <span>Tax:</span>
            <span>₹{sale.taxTotal.toFixed(2)}</span>
          </div>
        )}
        {sale.discountTotal > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "4px",
              fontSize: "9px",
              color: "#d32f2f",
            }}
          >
            <span>Discount:</span>
            <span>-₹{sale.discountTotal.toFixed(2)}</span>
          </div>
        )}
        {(sale.deliveryFee ?? 0) > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "4px",
              fontSize: "9px",
            }}
          >
            <span>Delivery:</span>
            <span>₹{(sale.deliveryFee ?? 0).toFixed(2)}</span>
          </div>
        )}
        <div
          style={{
            borderTop: "2px solid #000",
            marginTop: "6px",
            paddingTop: "6px",
            display: "flex",
            justifyContent: "space-between",
            fontWeight: "bold",
            fontSize: "12px",
          }}
        >
          <span>GRAND TOTAL:</span>
          <span>₹{sale.grandTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Payment Section */}
      {sale.payments.length > 0 && (
        <>
          <div
            style={{
              borderTop: "1px dashed #000",
              margin: "8px 0",
            }}
          />
          <div style={{ marginBottom: "8px" }}>
            <div
              style={{
                fontWeight: "bold",
                marginBottom: "5px",
                fontSize: "9px",
              }}
            >
              Payment Details:
            </div>
            {sale.payments.map((payment, index) => (
              <div key={payment.id}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "3px",
                    fontSize: "9px",
                  }}
                >
                  <span style={{ fontWeight: "bold" }}>{payment.method}:</span>
                  <span style={{ fontWeight: "bold" }}>
                    ₹{payment.amount.toFixed(2)}
                  </span>
                </div>
                {payment.txnRef && (
                  <div
                    style={{
                      fontSize: "9px",
                      color: "#666",
                      marginBottom:
                        index < sale.payments.length - 1 ? "6px" : "0",
                      paddingBottom:
                        index < sale.payments.length - 1 ? "4px" : "0",
                      borderBottom:
                        index < sale.payments.length - 1
                          ? "1px dashed #ccc"
                          : "none",
                    }}
                  >
                    Transaction Ref: {payment.txnRef}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div
        style={{
          borderTop: "1px dashed #000",
          margin: "8px 0",
        }}
      />

      {/* Footer */}
      <div
        style={{
          textAlign: "center",
          marginTop: "12px",
          fontSize: "10px",
        }}
      >
        <div
          style={{
            marginBottom: "5px",
            fontWeight: "bold",
            fontSize: "9px",
          }}
        >
          Status:{" "}
          <span
            style={{
              color:
                sale.status === "PAID"
                  ? "#16a34a"
                  : sale.status === "VOID"
                  ? "#dc2626"
                  : "#f59e0b",
            }}
          >
            {sale.status === "PAID"
              ? "PAID"
              : sale.status === "VOID"
              ? "CANCELLED"
              : "OPEN"}
          </span>
        </div>

        <div
          style={{
            borderTop: "1px dashed #000",
            margin: "10px 0",
            paddingTop: "10px",
          }}
        />

        <div
          style={{
            marginTop: "6px",
            fontWeight: "bold",
            fontSize: "10px",
          }}
        >
          K2 Chicken
        </div>
        <div style={{ marginTop: "3px", fontSize: "9px" }}>WhatsApp / Call 8484978622</div>

        <div
          style={{
            marginTop: "6px",
            fontSize: "8px",
            fontStyle: "italic",
          }}
        >
          Thank you for your business!
        </div>
        <div
          style={{
            marginTop: "4px",
            fontSize: "8px",
            color: "#666",
          }}
        >
          Visit us again soon
        </div>
      </div>
    </div>
  );
}
