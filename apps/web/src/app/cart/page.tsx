"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { useCartStore } from "@/store/cart";
import { useAuthStore } from "@/store/auth";
import api from "@/lib/api";

export default function CartPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    items,
    removeItem,
    updateItem,
    clearCart,
    getTotal,
    customerId,
    customerPhone,
    customerName,
    setCustomer,
    discountTotal,
    setDiscount,
    loadCart,
  } = useCartStore();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [manualItem, setManualItem] = useState({
    sku: "",
    description: "",
    weight: "",
    rate: "",
    total: "",
    unitType: "KG" as "KG" | "PCS",
  });
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem("accessToken");
    const stored = localStorage.getItem("auth-storage");
    let hasUser = false;
    try {
      if (stored) {
        const parsed = JSON.parse(stored);
        hasUser = !!parsed.state?.user;
      }
    } catch (e) {
      // Ignore
    }

    if (!token || !hasUser) {
      window.location.href = "/login";
      return;
    }

    loadCart();
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await api.get("/api/v1/products");
      if (response.data && Array.isArray(response.data)) {
        setProducts(response.data);
      }
    } catch (error: any) {
      console.error("Failed to load products:", error);
    }
  };

  const handleManualItemSubmit = () => {
    if (!manualItem.description) {
      alert("Please enter item description");
      return;
    }
    if (!manualItem.rate || parseFloat(manualItem.rate) <= 0) {
      alert("Please enter a valid rate");
      return;
    }

    const qtyKg = manualItem.unitType === "KG" ? parseFloat(manualItem.weight) || 0 : undefined;
    const qtyPcs = manualItem.unitType === "PCS" ? parseFloat(manualItem.weight) || 0 : undefined;
    const rate = parseFloat(manualItem.rate);
    const total = parseFloat(manualItem.total) || (qtyKg ? qtyKg * rate : (qtyPcs || 1) * rate);

    useCartStore.getState().addItem({
      productId: manualItem.sku || "MANUAL",
      productName: manualItem.description,
      sku: manualItem.sku || "MANUAL",
      qtyKg,
      qtyPcs,
      rate,
      lineTotal: total,
      taxRate: 0,
    });

    setShowAddItemModal(false);
    setManualItem({
      sku: "",
      description: "",
      weight: "",
      rate: "",
      total: "",
      unitType: "KG",
    });
  };

  const handleCreateSale = async (paymentMethod: string, amountPaid: number) => {
    try {
      const { items, customerId, customerPhone, customerName, discountTotal } = useCartStore.getState();
      const { subTotal, taxTotal, grandTotal } = getTotal();

      if (items.length === 0) {
        alert("Cart is empty");
        return;
      }

      const saleData = {
        items: items.map((item) => ({
          productId: item.productId,
          qtyKg: item.qtyKg,
          qtyPcs: item.qtyPcs,
          rate: item.rate,
          taxRate: item.taxRate,
        })),
        customerId: customerId || undefined,
        customerPhone: customerPhone || undefined,
        customerName: customerName || undefined,
        paymentMethod,
        amountPaid,
        discountTotal,
        subTotal,
        taxTotal,
        grandTotal,
      };

      const response = await api.post("/api/v1/sales", saleData);
      
      // Check if discount override approval is required
      if (response.data?.requiresApproval) {
        setShowPaymentModal(false);
        alert(
          `Sale created but discount requires manager approval.\n\n` +
          `${response.data.message}\n\n` +
          `Sale #${response.data.sale.saleNo} is pending approval.`
        );
        await clearCart();
        router.push("/discount-approvals");
        return;
      }

      await clearCart();
      setShowPaymentModal(false);
      alert("Sale completed successfully!");
      router.push("/pos");
    } catch (error: any) {
      console.error("Failed to create sale:", error);
      alert(error.response?.data?.error || "Failed to create sale");
    }
  };

  const { subTotal, taxTotal, grandTotal } = getTotal();

  // Payment Modal Component
  const PaymentModal = ({ grandTotal, onClose, onPay }: { grandTotal: number; onClose: () => void; onPay: (method: string, amount: number) => void }) => {
    const [paymentMethod, setPaymentMethod] = useState("CASH");
    const [amountPaid, setAmountPaid] = useState(grandTotal.toFixed(2));

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 dark:text-white">Payment</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:placeholder-gray-400"
              >
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="UPI">UPI</option>
                <option value="ONLINE">Online</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Amount Paid</label>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:placeholder-gray-400"
                step="0.01"
                min="0"
              />
            </div>
            <div className="border-t pt-4">
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>₹{grandTotal.toFixed(2)}</span>
              </div>
              {parseFloat(amountPaid) >= grandTotal && (
                <div className="mt-2 text-sm text-accent-600">
                  Change: ₹{(parseFloat(amountPaid) - grandTotal).toFixed(2)}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => onPay(paymentMethod, parseFloat(amountPaid))}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                Pay ₹{parseFloat(amountPaid).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Add Item Modal Component
  const AddItemModal = ({ item, products, onChange, onClose, onSubmit }: any) => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 dark:text-white">Add Manual Item</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SKU (Optional)</label>
              <input
                type="text"
                value={item.sku}
                onChange={(e) => onChange("sku", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:placeholder-gray-400"
                placeholder="Enter SKU"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description *</label>
              <input
                type="text"
                value={item.description}
                onChange={(e) => onChange("description", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:placeholder-gray-400"
                placeholder="Enter item description"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit Type</label>
              <select
                value={item.unitType}
                onChange={(e) => onChange("unitType", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:placeholder-gray-400"
              >
                <option value="KG">KG</option>
                <option value="PCS">PCS</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {item.unitType === "KG" ? "Weight (kg)" : "Quantity (pcs)"} *
              </label>
              <input
                type="number"
                value={item.weight}
                onChange={(e) => onChange("weight", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:placeholder-gray-400"
                placeholder={item.unitType === "KG" ? "Enter weight" : "Enter quantity"}
                step={item.unitType === "KG" ? "0.01" : "1"}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rate (₹) *</label>
              <input
                type="number"
                value={item.rate}
                onChange={(e) => onChange("rate", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:placeholder-gray-400"
                placeholder="Enter rate"
                step="0.01"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total (₹)</label>
              <input
                type="number"
                value={item.total}
                onChange={(e) => onChange("total", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:placeholder-gray-400"
                placeholder="Auto-calculated"
                step="0.01"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={onSubmit}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl sm:text-2xl font-bold">Shopping Cart</h1>
          <button
            onClick={() => router.push("/pos")}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm sm:text-base"
          >
            ← Back to POS
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] p-4 sm:p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-lg sm:text-xl dark:text-white">Cart</h2>
            <button
              onClick={() => setShowAddItemModal(true)}
              className="px-3 sm:px-4 py-2 bg-primary-600 text-white text-sm sm:text-base rounded hover:bg-primary-700"
            >
              + Add Item
            </button>
          </div>

          {/* Customer */}
          <div className="mb-4">
            <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1">
              Customer phone
            </label>
            <input
              type="text"
              placeholder="Enter phone number"
              value={customerPhone || ""}
              onChange={(e) => {
                const phone = e.target.value;
                setCustomer(null, phone || null, null);
                if (phone && phone.length >= 6) {
                  api
                    .get(`/api/v1/customers?phone=${phone}`)
                    .then((res) => {
                      if (res.data) {
                        setCustomer(res.data.id, phone, res.data.name || null);
                      }
                    })
                    .catch(() => {
                      // ignore lookup errors
                    });
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm sm:text-base"
            />
            {customerName && (
              <p className="mt-1 text-xs sm:text-sm text-accent-700">
                Billing to: <span className="font-semibold">{customerName}</span>
              </p>
            )}
            {!customerName && customerPhone && customerPhone.length >= 6 && (
              <p className="mt-1 text-xs sm:text-sm text-gray-500">
                New customer – will be saved by phone.
              </p>
            )}
          </div>

          {/* Cart Items */}
          <div className="mb-4 max-h-[400px] overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Cart is empty</p>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-sm sm:text-base mb-1">{item.productName}</div>
                        <div className="text-xs sm:text-sm text-gray-600 mb-2">
                          {item.qtyKg ? `${item.qtyKg} kg` : `${item.qtyPcs} pcs`} × ₹{item.rate}
                        </div>
                        {item.taxRate > 0 && (
                          <div className="text-xs text-gray-500">Tax: {item.taxRate}%</div>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-semibold text-sm sm:text-base mb-2">
                          ₹{item.lineTotal.toFixed(2)}
                        </div>
                        <button
                          onClick={() => removeItem(item.id!)}
                          className="text-red-500 hover:text-red-700 text-xs sm:text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex justify-between text-sm sm:text-base">
              <span>Subtotal:</span>
              <span>₹{subTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm sm:text-base">
              <span>Tax:</span>
              <span>₹{taxTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm sm:text-base">
              <span>Discount:</span>
              <input
                type="number"
                value={discountTotal}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="w-24 sm:w-32 px-2 py-1 border border-gray-300 rounded text-right text-sm sm:text-base"
                step="0.01"
                min="0"
              />
            </div>
            <div className="flex justify-between font-bold text-lg sm:text-xl border-t pt-2">
              <span>Total:</span>
              <span>₹{grandTotal.toFixed(2)}</span>
            </div>
            <button
              onClick={() => setShowPaymentModal(true)}
              disabled={items.length === 0}
              className="w-full bg-primary-600 text-white py-3 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed mt-4 text-sm sm:text-base font-medium"
            >
              Pay ₹{grandTotal.toFixed(2)}
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          grandTotal={grandTotal}
          onClose={() => setShowPaymentModal(false)}
          onPay={handleCreateSale}
        />
      )}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <AddItemModal
          item={manualItem}
          products={products}
          onChange={(field: string, value: any) => {
            setManualItem((prev) => {
              const updated = { ...prev, [field]: value };
              // Auto-calculate total if weight/rate changed
              if (field === "weight" || field === "rate") {
                const weight = parseFloat(updated.weight) || 0;
                const rate = parseFloat(updated.rate) || 0;
                const qtyPcs = parseFloat(updated.weight) || 1;
                if (updated.unitType === "KG" && weight > 0 && rate > 0) {
                  updated.total = (weight * rate).toFixed(2);
                } else if (updated.unitType === "PCS" && qtyPcs > 0 && rate > 0) {
                  updated.total = (qtyPcs * rate).toFixed(2);
                }
              }
              // Auto-calculate rate if total/weight changed
              if (field === "total" || field === "weight") {
                const total = parseFloat(updated.total) || 0;
                const weight = parseFloat(updated.weight) || 0;
                const qtyPcs = parseFloat(updated.weight) || 1;
                if (updated.unitType === "KG" && weight > 0 && total > 0 && !updated.rate) {
                  updated.rate = (total / weight).toFixed(2);
                } else if (updated.unitType === "PCS" && qtyPcs > 0 && total > 0 && !updated.rate) {
                  updated.rate = (total / qtyPcs).toFixed(2);
                }
              }
              return updated;
            });
          }}
          onClose={() => {
            setShowAddItemModal(false);
            setManualItem({
              sku: "",
              description: "",
              weight: "",
              rate: "",
              total: "",
              unitType: "KG",
            });
          }}
          onSubmit={handleManualItemSubmit}
        />
      )}
    </Layout>
  );
}

