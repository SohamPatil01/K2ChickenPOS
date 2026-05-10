"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { useAuthStore } from "@/store/auth";
import api from "@/lib/api";

interface InventoryItem {
  productId: string;
  productName: string;
  sku: string;
  plu: string;
  unitType: "KG" | "PCS";
  currentQtyKg: number;
  currentQtyPcs: number;
  imageUrl?: string | null;
}

interface Category {
  id: string;
  name: string;
}

export default function InventoryPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    sku: "",
    plu: "",
    categoryId: "",
    unitType: "KG" as "KG" | "PCS",
    taxRate: "0",
    pricePerUnit: "",
    imageUrl: "",
    imageFile: null as File | null,
  });
  const [editLoading, setEditLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Check role - only MANAGER and OWNER can access
  useEffect(() => {
    // Wait for user to load
    if (user === undefined) {
      return; // Still loading
    }

    if (!user) {
      router.push("/login");
      return;
    }

    if (user.role !== "MANAGER" && user.role !== "OWNER") {
      alert(
        "Access denied. Only Managers and Owners can access inventory management."
      );
      router.push("/pos");
      return;
    }

    // Only load inventory & supporting data if user is valid and has correct role
    if (user && (user.role === "MANAGER" || user.role === "OWNER")) {
      loadInventory();
      loadCategories();
    }
  }, [user]); // Removed router from dependencies as it's stable

  const loadCategories = async () => {
    try {
      const response = await api.get("/api/v1/products/categories");
      if (Array.isArray(response.data)) {
        setCategories(response.data);
      } else {
        setCategories([]);
      }
    } catch (error) {
      console.error("Failed to load categories", error);
      setCategories([]);
    }
  };

  const loadInventory = async () => {
    setLoading(true);
    try {
      // Add cache-busting timestamp to ensure fresh data
      const timestamp = Date.now();
      const response = await api.get("/api/v1/inventory/summary", {
        params: { _t: timestamp },
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
      console.log("Inventory loaded:", response.data?.length || 0);
      if (response.data && Array.isArray(response.data)) {
        setInventory(response.data);
        if (response.data.length === 0) {
          console.warn(
            "No inventory data found. Products may not have inventory entries."
          );
        }
      } else {
        console.error("Invalid inventory response:", response.data);
        setInventory([]);
      }
    } catch (error: any) {
      console.error("Failed to load inventory:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      setInventory([]);
    } finally {
      setLoading(false);
    }
  };

  const generateNextSKUAndPLU = async () => {
    try {
      const response = await api.get("/api/v1/products");
      const products = response.data || [];
      
      // Extract numeric parts from SKUs and PLUs
      const skuNumbers: number[] = [];
      const pluNumbers: number[] = [];
      
      products.forEach((p: any) => {
        // Extract numeric part from SKU
        const skuMatch = p.sku.match(/\d+/);
        if (skuMatch) {
          skuNumbers.push(parseInt(skuMatch[0], 10));
        }
        
        // Extract numeric part from PLU
        const pluMatch = p.plu.match(/\d+/);
        if (pluMatch) {
          pluNumbers.push(parseInt(pluMatch[0], 10));
        }
      });
      
      // Generate next SKU and PLU
      const nextSkuNum = skuNumbers.length > 0 ? Math.max(...skuNumbers) + 1 : 1;
      const nextPluNum = pluNumbers.length > 0 ? Math.max(...pluNumbers) + 1 : 1;
      
      // Format as 5-digit strings (e.g., "00001", "00002")
      const nextSKU = String(nextSkuNum).padStart(5, '0');
      const nextPLU = String(nextPluNum).padStart(5, '0');
      
      return { sku: nextSKU, plu: nextPLU };
    } catch (error) {
      console.error("Failed to generate SKU/PLU:", error);
      // Fallback to simple increment
      return { sku: "00001", plu: "00001" };
    }
  };

  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(
    null
  );
  const [adjustForm, setAdjustForm] = useState({
    qtyKg: "",
    qtyPcs: "",
    reason: "ADJUSTMENT",
  });

  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addProductLoading, setAddProductLoading] = useState(false);
  const [addProductForm, setAddProductForm] = useState({
    name: "",
    sku: "",
    plu: "",
    categoryId: "",
    unitType: "KG" as "KG" | "PCS",
    taxRate: "0",
    pricePerUnit: "",
    imageUrl: "",
    imageFile: null as File | null,
  });
  const [addProductImagePreview, setAddProductImagePreview] = useState<string | null>(null);

  const handleAdjust = async () => {
    if (!selectedProduct) return;

    const qtyKg = parseFloat(adjustForm.qtyKg) || 0;
    const qtyPcs = parseFloat(adjustForm.qtyPcs) || 0;

    if (selectedProduct.unitType === "KG" && qtyKg === 0) {
      alert("Please enter quantity");
      return;
    }
    if (selectedProduct.unitType === "PCS" && qtyPcs === 0) {
      alert("Please enter quantity");
      return;
    }

    try {
      // Send the quantity as-is (positive to add, negative to subtract)
      // The API will determine IN/OUT based on the sign
      await api.post("/api/v1/inventory/adjust", {
        productId: selectedProduct.productId,
        qtyKg: selectedProduct.unitType === "KG" ? qtyKg : undefined,
        qtyPcs: selectedProduct.unitType === "PCS" ? qtyPcs : undefined,
        reason: adjustForm.reason || "ADJUSTMENT",
      });
      await loadInventory();
      setShowAdjustModal(false);
      setSelectedProduct(null);
      setAdjustForm({ qtyKg: "", qtyPcs: "", reason: "ADJUSTMENT" });
      alert("Inventory adjusted successfully!");
    } catch (error: any) {
      console.error("Inventory adjustment error:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to adjust inventory";
      alert(errorMessage);
    }
  };

  const openAdjustModal = (item: InventoryItem) => {
    setSelectedProduct(item);
    setAdjustForm({
      qtyKg: "",
      qtyPcs: "",
      reason: "ADJUSTMENT",
    });
    setShowAdjustModal(true);
  };

  const resetAddProductForm = () => {
    setAddProductForm({
      name: "",
      sku: "",
      plu: "",
      categoryId: "",
      unitType: "KG",
      taxRate: "0",
      pricePerUnit: "",
      imageUrl: "",
      imageFile: null,
    });
    setAddProductImagePreview(null);
  };

  const handleAddProductImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }

      setAddProductForm({ ...addProductForm, imageFile: file, imageUrl: "" });
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAddProductImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const openAddProductModal = async () => {
    const { sku, plu } = await generateNextSKUAndPLU();
    setAddProductForm({
      ...addProductForm,
      sku,
      plu,
    });
    setShowAddProductModal(true);
  };

  const handleCreateProduct = async () => {
    if (!addProductForm.name) {
      alert("Please fill in Product Name");
      return;
    }
    if (!addProductForm.sku || !addProductForm.plu) {
      alert("SKU and PLU are required");
      return;
    }
    if (!addProductForm.categoryId) {
      alert("Please select a category");
      return;
    }
    if (!addProductForm.pricePerUnit) {
      alert("Please enter a price");
      return;
    }

    setAddProductLoading(true);
    try {
      const taxRate = parseFloat(addProductForm.taxRate || "0") || 0;
      const pricePerUnit = parseFloat(addProductForm.pricePerUnit);

      // Handle image - convert file to base64 if uploaded
      let imageUrl = addProductForm.imageUrl;
      if (addProductForm.imageFile) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(addProductForm.imageFile);
        imageUrl = await base64Promise;
      }

      // 1) Create product
      const createRes = await api.post("/api/v1/products", {
        sku: addProductForm.sku,
        plu: addProductForm.plu,
        name: addProductForm.name,
        categoryId: addProductForm.categoryId,
        unitType: addProductForm.unitType,
        taxRate,
        imageUrl: imageUrl || undefined,
      });

      const productId = createRes.data?.id;
      if (!productId) {
        throw new Error("Product created but no ID returned");
      }

      // 2) Set price for current store
      await api.post(`/api/v1/products/${productId}/price`, {
        pricePerUnit,
      });

      // 3) Refresh inventory list so the new product shows up
      await loadInventory();

      resetAddProductForm();
      setShowAddProductModal(false);
      alert("Product created successfully! You can now adjust its inventory.");
    } catch (error: any) {
      console.error("Failed to create product:", error);
      const message =
        error?.response?.data?.error ||
        error.message ||
        "Failed to create product";
      alert(message);
    } finally {
      setAddProductLoading(false);
    }
  };

  const openEditModal = async (item: InventoryItem) => {
    try {
      // Fetch full product details
      const response = await api.get(`/api/v1/products/${item.productId}`);
      const product = response.data;

      setEditingProduct(product);
      setEditForm({
        name: product.name || "",
        sku: product.sku || "",
        plu: product.plu || "",
        categoryId: product.categoryId || "",
        unitType: product.unitType || "KG",
        taxRate: product.taxRate?.toString() || "0",
        pricePerUnit: product.pricePerUnit?.toString() || "",
        imageUrl: product.imageUrl || "",
        imageFile: null,
      });
      setImagePreview(product.imageUrl || null);
      setShowEditModal(true);
    } catch (error: any) {
      console.error("Failed to load product details:", error);
      alert("Failed to load product details");
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }

      setEditForm({ ...editForm, imageFile: file });
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;

    if (!editForm.name || !editForm.sku || !editForm.plu) {
      alert("Please fill in Name, SKU and PLU");
      return;
    }
    if (!editForm.categoryId) {
      alert("Please select a category");
      return;
    }
    if (!editForm.pricePerUnit) {
      alert("Please enter a price");
      return;
    }

    setEditLoading(true);
    try {
      let imageUrl = editForm.imageUrl;

      // If image file is selected, convert to base64 data URL
      if (editForm.imageFile) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(editForm.imageFile);
        imageUrl = await base64Promise;
      }

      // Update product
      await api.put(`/api/v1/products/${editingProduct.id}`, {
        name: editForm.name,
        sku: editForm.sku,
        plu: editForm.plu,
        categoryId: editForm.categoryId,
        unitType: editForm.unitType,
        taxRate: parseFloat(editForm.taxRate || "0") || 0,
        imageUrl: imageUrl || null,
      });

      // Update price if changed
      const currentPrice = editingProduct.pricePerUnit || 0;
      const newPrice = parseFloat(editForm.pricePerUnit);
      if (currentPrice !== newPrice) {
        await api.post(`/api/v1/products/${editingProduct.id}/price`, {
          pricePerUnit: newPrice,
        });
      }

      // Force refresh to ensure updated product data is loaded
      await loadInventory();

      setShowEditModal(false);
      setEditingProduct(null);
      setEditForm({
        name: "",
        sku: "",
        plu: "",
        categoryId: "",
        unitType: "KG",
        taxRate: "0",
        pricePerUnit: "",
        imageUrl: "",
        imageFile: null,
      });
      setImagePreview(null);
      alert("Product updated successfully!");
    } catch (error: any) {
      console.error("Failed to update product:", error);
      const message =
        error?.response?.data?.error ||
        error.message ||
        "Failed to update product";
      alert(message);
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Inventory</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Click "Adjust" on any product to add or subtract inventory
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={openAddProductModal}
            className="flex-1 sm:flex-none px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm sm:text-base"
          >
            Add Product
          </button>
          <button
            onClick={loadInventory}
            className="flex-1 sm:flex-none px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm sm:text-base"
          >
            Refresh
          </button>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Image
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Product
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">
                SKU
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">
                PLU
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Unit
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Stock
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center">
                  Loading...
                </td>
              </tr>
            ) : inventory.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center">
                  <div className="py-8">
                    <p className="text-gray-500 mb-2">
                      No inventory data found
                    </p>
                    <p className="text-sm text-gray-400 mb-4">
                      Products may not have inventory entries yet.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              inventory.map((item) => (
                <tr key={item.productId}>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
                        No Image
                      </div>
                    )}
                  </td>
                  <td className="px-3 sm:px-6 py-4 font-medium">
                    <div className="text-sm sm:text-base">{item.productName}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 sm:hidden mt-1">SKU: {item.sku}</div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                    {item.sku}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                    {item.plu}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {item.unitType}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    {item.unitType === "KG" ? (
                      <span
                        className={`font-semibold text-sm sm:text-base ${
                          item.currentQtyKg < 0
                            ? "text-red-600"
                            : item.currentQtyKg === 0
                            ? "text-yellow-600"
                            : "text-gray-900"
                        }`}
                      >
                        {item.currentQtyKg.toFixed(2)} kg
                      </span>
                    ) : (
                      <span
                        className={`font-semibold text-sm sm:text-base ${
                          item.currentQtyPcs < 0
                            ? "text-red-600"
                            : item.currentQtyPcs === 0
                            ? "text-yellow-600"
                            : "text-gray-900"
                        }`}
                      >
                        {item.currentQtyPcs} pcs
                      </span>
                    )}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                      <button
                        onClick={() => openEditModal(item)}
                        className="px-2 sm:px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openAdjustModal(item)}
                        className="px-2 sm:px-3 py-1 text-xs text-primary-600 hover:text-primary-800 border border-primary-600 rounded sm:border-0"
                      >
                        Adjust
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Adjust Inventory Modal */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 dark:text-white">Adjust Inventory</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  Product: <strong>{selectedProduct.productName}</strong>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Current Stock:{" "}
                  {selectedProduct.unitType === "KG"
                    ? `${selectedProduct.currentQtyKg.toFixed(2)} kg`
                    : `${selectedProduct.currentQtyPcs} pcs`}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {selectedProduct.unitType === "KG"
                    ? "Quantity (kg)"
                    : "Quantity (pcs)"}{" "}
                  *
                </label>
                <input
                  type="number"
                  value={
                    selectedProduct.unitType === "KG"
                      ? adjustForm.qtyKg
                      : adjustForm.qtyPcs
                  }
                  onChange={(e) => {
                    if (selectedProduct.unitType === "KG") {
                      setAdjustForm({ ...adjustForm, qtyKg: e.target.value });
                    } else {
                      setAdjustForm({ ...adjustForm, qtyPcs: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  placeholder={selectedProduct.unitType === "KG" ? "0.00" : "0"}
                  step={selectedProduct.unitType === "KG" ? "0.01" : "1"}
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enter positive value to add, negative to subtract
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const current =
                        selectedProduct.unitType === "KG"
                          ? parseFloat(adjustForm.qtyKg) || 0
                          : parseFloat(adjustForm.qtyPcs) || 0;
                      const add = selectedProduct.unitType === "KG" ? 1 : 10;
                      if (selectedProduct.unitType === "KG") {
                        setAdjustForm({
                          ...adjustForm,
                          qtyKg: (current + add).toString(),
                        });
                      } else {
                        setAdjustForm({
                          ...adjustForm,
                          qtyPcs: (current + add).toString(),
                        });
                      }
                    }}
                    className="px-3 py-1 text-xs bg-primary-100 text-primary-700 rounded hover:bg-primary-200"
                  >
                    +{selectedProduct.unitType === "KG" ? "1 kg" : "10 pcs"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const current =
                        selectedProduct.unitType === "KG"
                          ? parseFloat(adjustForm.qtyKg) || 0
                          : parseFloat(adjustForm.qtyPcs) || 0;
                      const add = selectedProduct.unitType === "KG" ? 5 : 50;
                      if (selectedProduct.unitType === "KG") {
                        setAdjustForm({
                          ...adjustForm,
                          qtyKg: (current + add).toString(),
                        });
                      } else {
                        setAdjustForm({
                          ...adjustForm,
                          qtyPcs: (current + add).toString(),
                        });
                      }
                    }}
                    className="px-3 py-1 text-xs bg-primary-100 text-primary-700 rounded hover:bg-primary-200"
                  >
                    +{selectedProduct.unitType === "KG" ? "5 kg" : "50 pcs"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const current =
                        selectedProduct.unitType === "KG"
                          ? parseFloat(adjustForm.qtyKg) || 0
                          : parseFloat(adjustForm.qtyPcs) || 0;
                      const subtract =
                        selectedProduct.unitType === "KG" ? 1 : 10;
                      if (selectedProduct.unitType === "KG") {
                        setAdjustForm({
                          ...adjustForm,
                          qtyKg: Math.max(0, current - subtract).toString(),
                        });
                      } else {
                        setAdjustForm({
                          ...adjustForm,
                          qtyPcs: Math.max(0, current - subtract).toString(),
                        });
                      }
                    }}
                    className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    -{selectedProduct.unitType === "KG" ? "1 kg" : "10 pcs"}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason
                </label>
                <select
                  value={adjustForm.reason}
                  onChange={(e) =>
                    setAdjustForm({ ...adjustForm, reason: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                >
                  <option value="ADJUSTMENT">Manual Adjustment</option>
                  <option value="CORRECTION">Correction</option>
                  <option value="DAMAGE">Damage</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowAdjustModal(false);
                    setSelectedProduct(null);
                    setAdjustForm({
                      qtyKg: "",
                      qtyPcs: "",
                      reason: "ADJUSTMENT",
                    });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjust}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                >
                  Adjust Inventory
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Add New Product</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={addProductForm.name}
                  onChange={(e) =>
                    setAddProductForm({
                      ...addProductForm,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  placeholder="Example: Whole Chicken"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category *
                </label>
                <select
                  value={addProductForm.categoryId}
                  onChange={(e) =>
                    setAddProductForm({
                      ...addProductForm,
                      categoryId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  SKU *
                </label>
                <input
                  type="text"
                  data-skip-global-barcode="true"
                  value={addProductForm.sku}
                  onChange={(e) =>
                    setAddProductForm({
                      ...addProductForm,
                      sku: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:text-white"
                  placeholder="Type or scan barcode"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Defaults when you open this form; edit or scan to set.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  PLU *
                </label>
                <input
                  type="text"
                  data-skip-global-barcode="true"
                  value={addProductForm.plu}
                  onChange={(e) =>
                    setAddProductForm({
                      ...addProductForm,
                      plu: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:text-white"
                  placeholder="Type or scan barcode"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Often same as SKU for retail barcodes.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Unit Type *
                </label>
                <select
                  value={addProductForm.unitType}
                  onChange={(e) =>
                    setAddProductForm({
                      ...addProductForm,
                      unitType: e.target.value as "KG" | "PCS",
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                >
                  <option value="KG">KG</option>
                  <option value="PCS">PCS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  value={addProductForm.taxRate}
                  onChange={(e) =>
                    setAddProductForm({
                      ...addProductForm,
                      taxRate: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Price per unit *
                </label>
                <input
                  type="number"
                  value={addProductForm.pricePerUnit}
                  onChange={(e) =>
                    setAddProductForm({
                      ...addProductForm,
                      pricePerUnit: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Product Image
                </label>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Upload from local machine:
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAddProductImageFileChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div className="text-xs text-gray-500">OR</div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Enter image URL:
                    </label>
                    <input
                      type="url"
                      value={addProductForm.imageUrl}
                      onChange={(e) => {
                        setAddProductForm({
                          ...addProductForm,
                          imageUrl: e.target.value,
                          imageFile: null,
                        });
                        setAddProductImagePreview(e.target.value || null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                  {addProductImagePreview && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 mb-1">Preview:</p>
                      <img
                        src={addProductImagePreview}
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded border border-gray-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              After creating the product, you can use the "Adjust" button in the
              inventory table to add opening stock.
            </p>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowAddProductModal(false);
                  resetAddProductForm();
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                disabled={addProductLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProduct}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-60"
                disabled={addProductLoading}
              >
                {addProductLoading ? "Creating..." : "Create Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Edit Product</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  placeholder="Product name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category *
                </label>
                <select
                  value={editForm.categoryId}
                  onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  SKU *
                </label>
                <input
                  type="text"
                  value={editForm.sku}
                  onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  placeholder="Unique code"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  PLU *
                </label>
                <input
                  type="text"
                  value={editForm.plu}
                  onChange={(e) => setEditForm({ ...editForm, plu: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  placeholder="Price look-up code"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Unit Type *
                </label>
                <select
                  value={editForm.unitType}
                  onChange={(e) => setEditForm({ ...editForm, unitType: e.target.value as "KG" | "PCS" })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                >
                  <option value="KG">KG</option>
                  <option value="PCS">PCS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  value={editForm.taxRate}
                  onChange={(e) => setEditForm({ ...editForm, taxRate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Price per unit *
                </label>
                <input
                  type="number"
                  value={editForm.pricePerUnit}
                  onChange={(e) => setEditForm({ ...editForm, pricePerUnit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Product Image
                </label>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Upload from local machine:
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div className="text-xs text-gray-500">OR</div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Enter image URL:
                    </label>
                    <input
                      type="url"
                      value={editForm.imageUrl}
                      onChange={(e) => {
                        setEditForm({ ...editForm, imageUrl: e.target.value, imageFile: null });
                        setImagePreview(e.target.value || null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                  {imagePreview && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 mb-1">Preview:</p>
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded border border-gray-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingProduct(null);
                  setEditForm({
                    name: "",
                    sku: "",
                    plu: "",
                    categoryId: "",
                    unitType: "KG",
                    taxRate: "0",
                    pricePerUnit: "",
                    imageUrl: "",
                    imageFile: null,
                  });
                  setImagePreview(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                disabled={editLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateProduct}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-60"
                disabled={editLoading}
              >
                {editLoading ? "Updating..." : "Update Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
