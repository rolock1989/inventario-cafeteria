export type UserRole = "admin" | "trabajador";

export type Area = {
  id: string;
  name: string;
  active: boolean;
  createdAt?: string;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  areaId?: string | null;
  areaName?: string | null;
  shift?: string;
  active: boolean;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  categoryId?: string | null;
  areaId?: string | null;
  areaName?: string | null;
  unit: string;
  price: number;
  active: boolean;
};

export type Category = {
  id: string;
  name: string;
  areaId?: string | null;
  areaName?: string | null;
  active: boolean;
  createdAt?: string;
};

export type InventoryStatus = "draft" | "submitted";

export type InventoryItem = {
  id: string;
  productId: string;
  productName: string;
  category: string;
  categoryId?: string | null;
  areaId?: string | null;
  areaName?: string | null;
  productActive?: boolean;
  unit: string;
  unitPriceAtTime: number;
  lossAmount: number;
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
  areaId?: string | null;
  areaName?: string | null;
  shift: string;
  items: InventoryItem[];
};

export type InventoryListRecord = Omit<InventoryRecord, "items"> & {
  totalProducts: number;
  productsWithDifferences: number;
  totalDifference: number;
  totalLoss: number;
};

export type InventoryPage = {
  records: InventoryListRecord[];
  total: number;
  hasMore: boolean;
  userNames?: string[];
};

export type DashboardLatestInventory = {
  id: string;
  submittedAt: string;
  userName: string;
  areaId?: string | null;
  areaName?: string | null;
  shift: string;
  totalLoss?: number;
};

export type DashboardTopMissingItem = {
  key: string;
  productName: string;
  category: string;
  unit: string;
  areaId?: string | null;
  areaName?: string | null;
  missingQuantity: number;
  totalLoss?: number;
};

export type DashboardMetrics = {
  inventories: number;
  totalProducts: number;
  productsWithDifferences: number;
  totalLoss?: number;
  availableStartDate?: string;
  availableEndDate?: string;
  latestInventory?: DashboardLatestInventory;
  topMissing: DashboardTopMissingItem[];
};

export type InventorySummary = {
  totalProducts: number;
  productsWithDifferences: number;
  positiveDifferences: number;
  negativeDifferences: number;
};
