import { InventoryItem, InventoryRecord, InventorySummary, Product } from "@/lib/types";

export function getInventoryDate(inventory: InventoryRecord) {
  return new Date(inventory.submittedAt ?? inventory.createdAt);
}

export function filterInventoriesByDateRange(inventories: InventoryRecord[], startDate?: string, endDate?: string) {
  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

  return inventories.filter((inventory) => {
    const inventoryDate = getInventoryDate(inventory);
    const afterStart = !start || inventoryDate >= start;
    const beforeEnd = !end || inventoryDate <= end;

    return afterStart && beforeEnd;
  });
}

export function calculateDifference(physicalStock: number, fudoStock: number) {
  return physicalStock - fudoStock;
}

export function summarizeInventory(inventory?: InventoryRecord): InventorySummary {
  if (!inventory) {
    return {
      totalProducts: 0,
      productsWithDifferences: 0,
      positiveDifferences: 0,
      negativeDifferences: 0
    };
  }

  return inventory.items.reduce<InventorySummary>(
    (summary, item) => ({
      totalProducts: summary.totalProducts + 1,
      productsWithDifferences: summary.productsWithDifferences + (item.difference !== 0 ? 1 : 0),
      positiveDifferences: summary.positiveDifferences + (item.difference > 0 ? 1 : 0),
      negativeDifferences: summary.negativeDifferences + (item.difference < 0 ? 1 : 0)
    }),
    {
      totalProducts: 0,
      productsWithDifferences: 0,
      positiveDifferences: 0,
      negativeDifferences: 0
    }
  );
}

export function createInventoryRows(products: Product[]): InventoryItem[] {
  return products.map((product) => ({
    id: `draft-${product.id}`,
    productId: product.id,
    productName: product.name,
    category: product.category,
    categoryId: product.categoryId,
    unit: product.unit,
    physicalStock: 0,
    fudoStock: 0,
    difference: 0,
    comment: ""
  }));
}

export function formatDateTime(value?: string) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatDateForInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function getUniqueCategories(products: Product[] | InventoryItem[]) {
  return Array.from(new Set(products.map((product) => product.category))).sort((a, b) => a.localeCompare(b, "es"));
}

export function differenceTone(value: number) {
  if (value > 0) {
    return "positive";
  }

  if (value < 0) {
    return "negative";
  }

  return "neutral";
}
