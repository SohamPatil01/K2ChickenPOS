"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import api from "@/lib/api";
import { resolveSaleDeliveryFee } from "@azela-pos/shared";
import { useNotificationStore } from "@/store/notification";
import { useReactToPrint } from "react-to-print";
import CustomerBill from "@/components/CustomerBill";
import { downloadCustomerBill } from "@/lib/customerBill";
import BillSuccessAnimation from "@/components/BillSuccessAnimation";
import { exportSalesCSV } from "@/lib/exportCSV";
import { FilterSystem, FilterCriteria } from "@/components/FilterSystem";
import { localDateRangeToApiBounds, buildDefaultFilterCriteria } from "@/lib/dateRangeParams";

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
  deliveryOrder?: { deliveryFee?: number } | null;
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

export default function OrdersPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editForm, setEditForm] = useState({
    discountTotal: "0",
    items: [] as Array<{
      id: string;
      productId: string;
      productName: string;
      unitType: "KG" | "PCS";
      qtyKg?: number;
      qtyPcs?: number;
      rate: number;
      taxRate: number;
    }>,
  });
  const [filters, setFilters] = useState<FilterCriteria>(buildDefaultFilterCriteria);
  const [products, setProducts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingSale, setCancellingSale] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [showCompleteAnimation, setShowCompleteAnimation] = useState(false);
  const [completedSaleForAnimation, setCompletedSaleForAnimation] = useState<{
    saleNo: string;
    grandTotal: number;
  } | null>(null);
  const [completingSale, setCompletingSale] = useState<Sale | null>(null);
  const [completeMethod, setCompleteMethod] = useState<'CASH' | 'CARD' | 'UPI' | 'ONLINE'>('UPI');
  const [completing, setCompleting] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [billForPrint, setBillForPrint] = useState<Sale | null>(null);

  const storeBillInfo = {
    name: user?.store?.name || "K2 Chicken",
    phone: "8484978622",
  };

  const handleFilterChange = useCallback((next: FilterCriteria) => {
    setFilters(next);
  }, []);

  const loadSalesRef = useRef<() => Promise<void>>(async () => {});

  const handlePrint = useReactToPrint({
    content: () => receiptRef.current,
    documentTitle: `Bill-${billForPrint?.saleNo || selectedSale?.saleNo || "Receipt"}`,
    onAfterPrint: () => setBillForPrint(null),
    pageStyle: `
      @page {
        size: A4;
        margin: 12mm;
      }
      @media print {
        body {
          margin: 0;
          padding: 0;
          background: white;
        }
        .customer-bill-print-root {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
        }
      }
    `,
  });

  const triggerPrintBill = (sale: Sale) => {
    setBillForPrint(sale);
    setTimeout(() => handlePrint(), 150);
  };

  const triggerDownloadBill = (sale: Sale) => {
    downloadCustomerBill(sale, storeBillInfo);
    showNotification(`Bill ${sale.saleNo} downloaded`, "success");
  };

  // Separate useEffect for auth check (no dependencies that change)
  useEffect(() => {
    if (user === undefined) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (
      user.role !== "OWNER" &&
      user.role !== "MANAGER" &&
      user.role !== "CASHIER"
    ) {
      router.push("/store");
      return;
    }
  }, [user, router]);

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const bounds = localDateRangeToApiBounds(
        filters.dateRange.start,
        filters.dateRange.end
      );

      const params: Record<string, string | number> = {
        startDate: bounds.startDate,
        endDate: bounds.endDate,
        businessDayStart: bounds.businessDayStart,
        businessDayEnd: bounds.businessDayEnd,
        limit: 500,
      };

      if (filters.status && filters.status.trim() !== "") {
        params.status = filters.status;
      }
      if (filters.paymentMethod && filters.paymentMethod.trim() !== "") {
        params.paymentMethod = filters.paymentMethod;
      }

      const response = await api.get("/api/v1/sales", { params });
      setSales(response.data || []);
    } catch (error: any) {
      console.error("Failed to load sales:", error);
      showNotification("Failed to load orders", "error");
    } finally {
      setLoading(false);
    }
  }, [filters, showNotification]);

  loadSalesRef.current = loadSales;

  const loadProducts = useCallback(async () => {
    try {
      const response = await api.get("/api/v1/products");
      setProducts(response.data || []);
    } catch (error) {
      console.error("Failed to load products:", error);
    }
  }, []);

  useEffect(() => {
    if (
      !user ||
      (user.role !== "OWNER" &&
        user.role !== "MANAGER" &&
        user.role !== "CASHIER")
    ) {
      return;
    }
    loadSales();
  }, [user, filters, loadSales]);

  useEffect(() => {
    if (
      !user ||
      (user.role !== "OWNER" &&
        user.role !== "MANAGER" &&
        user.role !== "CASHIER")
    ) {
      return;
    }
    loadProducts();
  }, [user, loadProducts]);

  useEffect(() => {
    if (
      !user ||
      (user.role !== "OWNER" &&
        user.role !== "MANAGER" &&
        user.role !== "CASHIER")
    ) {
      return;
    }

    const handleSaleCreated = () => {
      loadSalesRef.current();
    };
    const handleSaleUpdated = () => {
      loadSalesRef.current();
    };
    const handleSaleDeleted = () => {
      loadSalesRef.current();
    };

    window.addEventListener("sale-created", handleSaleCreated);
    window.addEventListener("sale-updated", handleSaleUpdated);
    window.addEventListener("sale-deleted", handleSaleDeleted);

    // 5GB Neon budget: event-driven only (no 5-min full sales list poll)
    return () => {
      window.removeEventListener("sale-created", handleSaleCreated);
      window.removeEventListener("sale-updated", handleSaleUpdated);
      window.removeEventListener("sale-deleted", handleSaleDeleted);
    };
  }, [user]);

  const openEditModal = (sale: Sale) => {
    setEditingSale(sale);
    setEditForm({
      discountTotal: sale.discountTotal.toString(),
      items: sale.items.map((item) => ({
        id: item.id,
        productId: item.product.id,
        productName: item.product.name,
        unitType: item.product.unitType,
        qtyKg: item.qtyKg,
        qtyPcs: item.qtyPcs,
        rate: item.rate,
        taxRate: item.taxRate,
      })),
    });
    setShowEditModal(true);
  };

  const handleAddItem = () => {
    setEditForm({
      ...editForm,
      items: [
        ...editForm.items,
        {
          id: "",
          productId: "",
          productName: "",
          unitType: "KG",
          qtyKg: undefined,
          qtyPcs: undefined,
          rate: 0,
          taxRate: 0,
        },
      ],
    });
  };

  const handleRemoveItem = (index: number) => {
    setEditForm({
      ...editForm,
      items: editForm.items.filter((_, i) => i !== index),
    });
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...editForm.items];
    if (field === "productId") {
      const product = products.find((p) => p.id === value);
      newItems[index] = {
        ...newItems[index],
        productId: value,
        productName: product?.name || "",
        unitType: product?.unitType || "KG",
        rate: product?.pricePerUnit || 0,
        taxRate: product?.taxRate || 0,
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        [field]: value,
      };
    }
    setEditForm({ ...editForm, items: newItems });
  };

  const calculateTotals = () => {
    let subTotal = 0;
    let taxTotal = 0;

    editForm.items.forEach((item) => {
      const qty =
        item.unitType === "PCS"
          ? Number(item.qtyPcs) || 0
          : Number(item.qtyKg) || 0;
      const lineTotal = qty * item.rate;
      subTotal += lineTotal;
      taxTotal += lineTotal * (item.taxRate / 100);
    });

    // Round to 2 decimal places to avoid floating point precision issues
    subTotal = Math.round(subTotal * 100) / 100;
    taxTotal = Math.round(taxTotal * 100) / 100;

    const discountTotal = parseFloat(editForm.discountTotal) || 0;
    const deliveryFee = editingSale ? resolveSaleDeliveryFee(editingSale) : 0;
    // Calculate grand total and round to nearest integer to match backend
    const grandTotal =
      Math.round((subTotal + taxTotal - discountTotal + deliveryFee) * 100) / 100;
    const roundedGrandTotal = Math.round(grandTotal);

    return { subTotal, taxTotal, discountTotal, grandTotal: roundedGrandTotal };
  };

  const handleSave = async () => {
    if (!editingSale) return;

    if (editForm.items.length === 0) {
      showNotification("Please add at least one item", "error");
      return;
    }

    const invalidItems = editForm.items.filter((item) => {
      if (!item.productId || item.rate <= 0) return true;
      if (item.unitType === "PCS") {
        const q = Number(item.qtyPcs);
        return !Number.isFinite(q) || q <= 0;
      }
      const q = Number(item.qtyKg);
      return !Number.isFinite(q) || q <= 0;
    });

    if (invalidItems.length > 0) {
      showNotification("Please fill in all item details correctly", "error");
      return;
    }

    setSaving(true);
    try {
      const { subTotal, taxTotal, discountTotal, grandTotal } =
        calculateTotals();

      await api.put(`/api/v1/sales/${editingSale.id}`, {
        items: editForm.items.map((item) => ({
          productId: item.productId,
          qtyKg: item.qtyKg,
          qtyPcs: item.qtyPcs,
          rate: item.rate,
          taxRate: item.taxRate,
        })),
        discountTotal,
        subTotal,
        taxTotal,
        grandTotal,
      });

      showNotification("Order updated successfully", "success");
      setShowEditModal(false);
      setEditingSale(null);
      loadSales();

      // Notify other consoles about the update
      window.dispatchEvent(
        new CustomEvent("sale-updated", { detail: { saleId: editingSale.id } })
      );
    } catch (error: any) {
      console.error("Failed to update sale:", error);
      showNotification(
        error.response?.data?.error || "Failed to update order",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancelBill = (sale: Sale) => {
    if (sale.status === "VOID") {
      showNotification("This bill is already cancelled", "warning");
      return;
    }
    if (sale.status !== "PAID" && sale.status !== "OPEN") {
      showNotification("Only paid or open bills can be cancelled", "warning");
      return;
    }
    setCancellingSale(sale);
    setCancelReason("");
    setShowCancelModal(true);
  };

  const confirmCancel = async () => {
    if (!cancellingSale) return;

    setCancelling(true);
    try {
      await api.post(`/api/v1/sales/${cancellingSale.id}/void`, {
        reason: cancelReason || "Cancelled by owner",
      });

      const cancelledSaleId = cancellingSale.id;
      showNotification("Bill cancelled successfully", "success");
      setShowCancelModal(false);
      setCancellingSale(null);
      setCancelReason("");
      loadSales();

      // Notify other consoles about the deletion/cancellation
      window.dispatchEvent(
        new CustomEvent("sale-deleted", { detail: { saleId: cancelledSaleId } })
      );
    } catch (error: any) {
      console.error("Failed to cancel bill:", error);
      showNotification(
        error.response?.data?.error || "Failed to cancel bill",
        "error"
      );
    } finally {
      setCancelling(false);
    }
  };

  const openCompleteOrder = (sale: Sale) => {
    if (sale.status !== "OPEN") {
      showNotification("Only open orders can be completed", "warning");
      return;
    }
    setCompletingSale(sale);
    setCompleteMethod("UPI");
  };

  const handleCompleteOrder = async (
    sale: Sale,
    method: 'CASH' | 'CARD' | 'UPI' | 'ONLINE' = completeMethod
  ) => {
    if (sale.status !== "OPEN") {
      showNotification("Only open orders can be completed", "warning");
      return;
    }

    setCompleting(true);
    try {
      // CREDIT is a promise to pay — do not count it as money received.
      const existingPayments = sale.payments || [];
      const actualPaid = existingPayments
        .filter((p) => String(p.method).toUpperCase() !== "CREDIT")
        .reduce((sum, p) => sum + p.amount, 0);
      const remainingAmount = Math.round(sale.grandTotal - actualPaid);

      // amount 0 = mark PAID when already settled (e.g. credit booked in full).
      const paymentAmount = remainingAmount <= 0 ? 0 : remainingAmount;

      await api.post(`/api/v1/sales/${sale.id}/pay`, {
        payments: [
          {
            method,
            amount: paymentAmount,
          },
        ],
      });

      setCompletingSale(null);
      setCompletedSaleForAnimation({
        saleNo: sale.saleNo || "N/A",
        grandTotal: Math.round(sale.grandTotal),
      });
      setShowCompleteAnimation(true);
      showNotification(
        paymentAmount > 0
          ? `Order completed — ₹${paymentAmount} as ${method}`
          : "Order completed successfully",
        "success"
      );
      loadSales();

      window.dispatchEvent(
        new CustomEvent("sale-updated", { detail: { saleId: sale.id } })
      );

      if (selectedSale?.id === sale.id) {
        setSelectedSale(null);
      }
    } catch (error: any) {
      console.error("Failed to complete order:", error);
      showNotification(
        error.response?.data?.error || "Failed to complete order",
        "error"
      );
    } finally {
      setCompleting(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="w-full max-w-7xl mx-auto h-full min-h-0 flex flex-col">
      {/* Order complete success animation */}
      {showCompleteAnimation && completedSaleForAnimation && (
        <BillSuccessAnimation
          saleNo={completedSaleForAnimation.saleNo}
          grandTotal={completedSaleForAnimation.grandTotal}
          subtitle="Order completed."
          onComplete={() => {
            setShowCompleteAnimation(false);
            setCompletedSaleForAnimation(null);
          }}
        />
      )}
      {/* Header */}
      <div className="mb-3 sm:mb-4 flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-ink mb-1 sm:mb-2">
            Orders
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted">
            {filters?.status === "OPEN"
              ? "View and complete pending orders"
              : "View and edit all orders"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              exportSalesCSV(
                sales,
                `orders-${new Date().toISOString().split("T")[0]}.csv`
              )
            }
            className="px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors font-medium text-sm border border-green-200 dark:border-green-800"
            disabled={sales.length === 0}
          >
            📊 Export CSV
          </button>
          <button
            onClick={() => loadSales()}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-ink-secondary rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-sm"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      <FilterSystem
        onFilterChange={handleFilterChange}
        showPaymentMethodFilter={true}
        showStatusFilter={true}
        storageKey="orders_filters"
      />

      {/* Sales List */}
      <div className="flex-1 min-h-0 flex flex-col glass-panel-strong rounded-2xl overflow-hidden">
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-ink-muted">Loading orders...</p>
            </div>
          ) : sales.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-ink-muted">
                {sales.length === 0
                  ? "No orders found"
                  : "No orders match the selected filters"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {sales.map((sale) => {
                return (
                  <div
                    key={sale.id}
                    className={`p-4 hover:bg-brand-100/30 dark:hover:bg-brand-900/10 transition-colors ${ selectedSale?.id === sale.id ?"bg-brand-50 dark:bg-brand-900/20"
                        : ""
                    }`}
                    onClick={() => setSelectedSale(sale)}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-base sm:text-lg dark:text-white">
                            {sale.saleNo}
                          </h3>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${ sale.status ==="PAID"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                                : sale.status === "OPEN"
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                                : sale.status === "VOID"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {sale.status === "VOID" ? "CANCELLED" : sale.status}
                          </span>
                        </div>
                        <div className="text-sm text-ink-secondary space-y-1">
                          <p>
                            Customer:{" "}
                            {sale.customer
                              ? `${sale.customer.name} (${sale.customer.phone})`
                              : "Walk-in"}
                          </p>
                          <p>
                            Created by: {sale.createdBy.name} •{" "}
                            {new Date(sale.createdAt).toLocaleString()}
                          </p>
                          <p className="text-xs">
                            {sale.items.length} item(s) • Total: ₹
                            {sale.grandTotal.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSale(sale);
                          }}
                          className="px-3 sm:px-4 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded-md hover:bg-gray-600 dark:hover:bg-gray-700 text-sm transition-colors touch-target font-medium"
                        >
                          View Details
                        </button>
                        {sale.status === "PAID" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(sale);
                            }}
                            className="px-3 sm:px-4 py-2 bg-brand-500 text-white rounded-md hover:bg-brand-600 text-sm transition-colors touch-target font-medium"
                          >
                            Edit
                          </button>
                        )}
                        {(sale.status === "PAID" || sale.status === "OPEN") && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerPrintBill(sale);
                            }}
                            className="px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm transition-colors touch-target font-medium"
                          >
                            Print
                          </button>
                        )}
                        {(sale.status === "PAID" || sale.status === "OPEN") && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerDownloadBill(sale);
                            }}
                            className="px-3 sm:px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 text-sm transition-colors touch-target font-medium"
                          >
                            Download
                          </button>
                        )}
                        {sale.status === "OPEN" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openCompleteOrder(sale);
                            }}
                            className="px-3 sm:px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm transition-colors touch-target font-medium"
                          >
                            Complete Order
                          </button>
                        )}
                        {(sale.status === "PAID" || sale.status === "OPEN") && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelBill(sale);
                            }}
                            className="px-3 sm:px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm transition-colors touch-target font-medium"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* View Details Modal */}
      {selectedSale && !showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-panel-strong rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 sticky top-0">
              <h2 className="text-xl sm:text-2xl font-semibold text-ink">
                Order Details - {selectedSale.saleNo}
              </h2>
              <button
                onClick={() => setSelectedSale(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* Customer Info */}
              <div className="mb-4 sm:mb-6">
                <h3 className="text-sm font-semibold text-ink-secondary mb-2">
                  Customer Information
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4">
                  <p className="text-sm dark:text-white">
                    <span className="font-medium">Name:</span>{" "}
                    {selectedSale.customer?.name || "Walk-in"}
                  </p>
                  {selectedSale.customer && (
                    <p className="text-sm dark:text-white mt-1">
                      <span className="font-medium">Phone:</span>{" "}
                      {selectedSale.customer.phone}
                    </p>
                  )}
                  {selectedSale.customer?.area && (
                    <p className="text-sm dark:text-white mt-1">
                      <span className="font-medium">Area:</span>{" "}
                      {selectedSale.customer.area}
                    </p>
                  )}
                  <p className="text-sm dark:text-white mt-1">
                    <span className="font-medium">Created by:</span>{" "}
                    {selectedSale.createdBy.name}
                  </p>
                  <p className="text-sm dark:text-white mt-1">
                    <span className="font-medium">Date:</span>{" "}
                    {new Date(selectedSale.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div className="mb-4 sm:mb-6">
                <h3 className="text-sm font-semibold text-ink-secondary mb-2">
                  Items ({selectedSale.items.length})
                </h3>
                <div className="space-y-2">
                  {selectedSale.items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4 flex justify-between items-start"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm sm:text-base dark:text-white">
                          {item.product.name}
                        </p>
                        <p className="text-xs sm:text-sm text-ink-secondary mt-1">
                          SKU: {item.product.sku} • {item.product.unitType}
                        </p>
                        <p className="text-xs sm:text-sm text-ink-secondary">
                          {item.qtyKg
                            ? `${item.qtyKg.toFixed(2)} kg`
                            : `${item.qtyPcs} pcs`}{" "}
                          × ₹{item.rate.toFixed(2)} = ₹
                          {item.lineTotal.toFixed(2)}
                        </p>
                        {item.taxRate > 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            Tax ({item.taxRate}%): ₹{item.taxAmount.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="mb-4 sm:mb-6">
                <h3 className="text-sm font-semibold text-ink-secondary mb-2">
                  Price Breakdown
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4 space-y-2">
                  <div className="flex justify-between text-sm dark:text-white">
                    <span>Subtotal:</span>
                    <span>₹{selectedSale.subTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm dark:text-white">
                    <span>Tax:</span>
                    <span>₹{selectedSale.taxTotal.toFixed(2)}</span>
                  </div>
                  {selectedSale.discountTotal > 0 && (
                    <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
                      <span>Discount:</span>
                      <span>-₹{selectedSale.discountTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {resolveSaleDeliveryFee(selectedSale) > 0 && (
                    <div className="flex justify-between text-sm dark:text-white">
                      <span>Delivery fee:</span>
                      <span>₹{resolveSaleDeliveryFee(selectedSale).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-300 dark:border-gray-600 pt-2 mt-2">
                    <div className="flex justify-between text-base sm:text-lg font-semibold text-ink">
                      <span>Grand Total:</span>
                      <span>₹{selectedSale.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payments */}
              {selectedSale.payments.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-ink-secondary mb-2">
                    Payments ({selectedSale.payments.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedSale.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4 flex justify-between items-center"
                      >
                        <div>
                          <p className="font-medium text-sm sm:text-base dark:text-white">
                            {payment.method}
                          </p>
                          {payment.txnRef && (
                            <p className="text-xs text-ink-secondary mt-1">
                              Ref: {payment.txnRef}
                            </p>
                          )}
                        </div>
                        <p className="font-semibold text-sm sm:text-base dark:text-white">
                          ₹{payment.amount.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex gap-2 sm:gap-3 sticky bottom-0">
              {selectedSale.status === "OPEN" && (
                <button
                  onClick={() => {
                    openCompleteOrder(selectedSale);
                  }}
                  className="flex-1 px-4 py-2.5 sm:py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-all touch-target"
                >
                  Complete Order
                </button>
              )}
              {selectedSale.status === "PAID" && (
                <button
                  onClick={() => {
                    setSelectedSale(null);
                    openEditModal(selectedSale);
                  }}
                  className="flex-1 px-4 py-2.5 sm:py-3 bg-brand-500 text-white rounded-lg font-semibold hover:bg-brand-600 transition-all touch-target"
                >
                  Edit Order
                </button>
              )}
              <button
                onClick={() => triggerPrintBill(selectedSale)}
                className="px-4 py-2.5 sm:py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all touch-target flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
                Print Bill
              </button>
              <button
                onClick={() => triggerDownloadBill(selectedSale)}
                className="px-4 py-2.5 sm:py-3 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 transition-all touch-target flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
              <button
                onClick={() => setSelectedSale(null)}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-gray-200 dark:bg-gray-700 text-ink rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all touch-target"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill for printing — hidden off-screen */}
      {(billForPrint || selectedSale) && (
        <div
          ref={receiptRef}
          className="customer-bill-print-root"
          style={{
            position: "absolute",
            left: "-9999px",
            top: 0,
            width: "210mm",
          }}
        >
          <CustomerBill
            sale={(billForPrint || selectedSale)!}
            store={storeBillInfo}
          />
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingSale && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-panel-strong rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 sticky top-0">
              <h2 className="text-xl sm:text-2xl font-semibold text-ink">
                Edit Order - {editingSale.saleNo}
              </h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingSale(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* Items */}
              <div className="mb-4 sm:mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-ink-secondary">
                    Items
                  </h3>
                  <button
                    onClick={handleAddItem}
                    className="px-3 py-1.5 bg-brand-500 text-white rounded-md hover:bg-brand-600 text-sm transition-colors touch-target font-medium"
                  >
                    + Add Item
                  </button>
                </div>
                <div className="space-y-3">
                  {editForm.items.map((item, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-600"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-ink-secondary mb-1">
                            Product *
                          </label>
                          <select
                            value={item.productId}
                            onChange={(e) =>
                              handleUpdateItem(
                                index,
                                "productId",
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm"
                          >
                            <option value="">Select product</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku}) - ₹
                                {p.pricePerUnit?.toFixed(2) || "0.00"}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-ink-secondary mb-1">
                            {products.find((p) => p.id === item.productId)
                              ?.unitType === "KG"
                              ? "Quantity (Kg)"
                              : "Quantity (Pcs)"}{" "}
                            *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={
                              products.find((p) => p.id === item.productId)
                                ?.unitType === "KG"
                                ? item.qtyKg || ""
                                : item.qtyPcs || ""
                            }
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              if (
                                products.find((p) => p.id === item.productId)
                                  ?.unitType === "KG"
                              ) {
                                handleUpdateItem(index, "qtyKg", value);
                              } else {
                                handleUpdateItem(index, "qtyPcs", value);
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-ink-secondary mb-1">
                            Rate (₹) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.rate || ""}
                            onChange={(e) =>
                              handleUpdateItem(
                                index,
                                "rate",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-ink-secondary">
                          Line Total: ₹
                          {(
                            (item.qtyKg || item.qtyPcs || 0) * item.rate
                          ).toFixed(2)}
                        </div>
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm transition-colors touch-target font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discount */}
              <div className="mb-4 sm:mb-6">
                <label className="block text-sm font-semibold text-ink-secondary mb-2">
                  Discount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.discountTotal}
                  onChange={(e) =>
                    setEditForm({ ...editForm, discountTotal: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  placeholder="0.00"
                />
              </div>

              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4">
                <h3 className="text-sm font-semibold text-ink-secondary mb-3">
                  Order Summary
                </h3>
                {(() => {
                  const totals = calculateTotals();
                  return (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm dark:text-white">
                        <span>Subtotal:</span>
                        <span>₹{totals.subTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm dark:text-white">
                        <span>Tax:</span>
                        <span>₹{totals.taxTotal.toFixed(2)}</span>
                      </div>
                      {totals.discountTotal > 0 && (
                        <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
                          <span>Discount:</span>
                          <span>-₹{totals.discountTotal.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t border-gray-300 dark:border-gray-600 pt-2 mt-2">
                        <div className="flex justify-between text-base sm:text-lg font-semibold text-ink">
                          <span>Grand Total:</span>
                          <span>₹{totals.grandTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex gap-2 sm:gap-3 sticky bottom-0">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingSale(null);
                }}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-gray-200 dark:bg-gray-700 text-ink rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all touch-target"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-brand-500 text-white rounded-lg font-semibold hover:bg-brand-600 transition-all touch-target"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Order — pick payment method (was hardcoded to CASH) */}
      {completingSale && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-panel rounded-2xl w-full max-w-md animate-scale-in">
            <div className="p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-ink mb-2">
                Complete Order — {completingSale.saleNo}
              </h2>
              <p className="text-sm text-ink-secondary mb-4">
                How did the customer pay the remaining balance?
              </p>
              {(() => {
                const actualPaid = (completingSale.payments || [])
                  .filter((p) => String(p.method).toUpperCase() !== "CREDIT")
                  .reduce((sum, p) => sum + p.amount, 0);
                const remaining = Math.max(
                  0,
                  Math.round(completingSale.grandTotal - actualPaid)
                );
                return (
                  <p className="text-lg font-bold text-brand-600 dark:text-brand-400 mb-4">
                    Amount: ₹{remaining}
                  </p>
                );
              })()}
              <div className="grid grid-cols-2 gap-2 mb-6">
                {(
                  [
                    { value: "UPI" as const, label: "UPI", icon: "📱" },
                    { value: "CASH" as const, label: "Cash", icon: "💵" },
                    { value: "CARD" as const, label: "Card", icon: "💳" },
                    { value: "ONLINE" as const, label: "Online", icon: "🌐" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setCompleteMethod(m.value)}
                    disabled={completing}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      completeMethod === m.value
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-md"
                        : "border-gray-200 dark:border-gray-600 hover:border-brand-300"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-2xl">{m.icon}</span>
                      <span className="text-sm font-semibold dark:text-white">
                        {m.label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCompletingSale(null)}
                  disabled={completing}
                  className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-gray-700 text-ink rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleCompleteOrder(completingSale, completeMethod)}
                  disabled={completing}
                  className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-all disabled:opacity-50"
                >
                  {completing ? "Saving..." : `Confirm ${completeMethod}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Bill Modal */}
      {showCancelModal && cancellingSale && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-panel rounded-2xl w-full max-w-md animate-fade-in-up">
            <div className="p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-ink mb-4">
                Cancel Bill - {cancellingSale.saleNo}
              </h2>
              <p className="text-sm text-ink-secondary mb-4">
                Are you sure you want to cancel this bill? This action cannot be
                undone.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-ink-secondary mb-2">
                  Reason (Optional)
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Enter reason for cancellation..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancellingSale(null);
                    setCancelReason("");
                  }}
                  className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-gray-700 text-ink rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                  disabled={cancelling}
                >
                  No, Keep Bill
                </button>
                <button
                  onClick={confirmCancel}
                  className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={cancelling}
                >
                  {cancelling ? "Cancelling..." : "Yes, Cancel Bill"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
