export type UserRole = "admin" | "trabajador";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  shift?: string;
  active: boolean;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  unit: string;
  active: boolean;
};

export type InventoryStatus = "draft" | "submitted";

export type InventoryItem = {
  id: string;
  productId: string;
  productName: string;
  category: string;
  unit: string;
  physicalStock: number;
  fudoStock: number;
  difference: number;
  comment?: string;
};

export type InventoryRecord = {
  id: string;
  status: InventoryStatus;
  createdAt: string;
  submittedAt?: string;
  userId: string;
  userName: string;
  shift: string;
  items: InventoryItem[];
};

export type InventorySummary = {
  totalProducts: number;
  productsWithDifferences: number;
  positiveDifferences: number;
  negativeDifferences: number;
};
