import { AppUser, InventoryRecord, Product } from "@/lib/types";

export const mockUsers: AppUser[] = [
  {
    id: "usr-admin-1",
    name: "Camila Reyes",
    email: "admin@inventariocafe.cl",
    role: "admin",
    shift: "Administracion"
  },
  {
    id: "usr-worker-1",
    name: "Mateo Silva",
    email: "trabajador@inventariocafe.cl",
    role: "trabajador",
    shift: "Turno manana"
  },
  {
    id: "usr-worker-2",
    name: "Antonia Perez",
    email: "antonia@inventariocafe.cl",
    role: "trabajador",
    shift: "Turno tarde"
  }
];

export const mockProducts: Product[] = [
  {
    id: "prd-espresso",
    name: "Cafe espresso blend",
    category: "Cafe",
    unit: "kg",
    active: true
  },
  {
    id: "prd-leche-entera",
    name: "Leche entera",
    category: "Lacteos",
    unit: "litros",
    active: true
  },
  {
    id: "prd-avena",
    name: "Bebida de avena",
    category: "Bebidas vegetales",
    unit: "litros",
    active: true
  },
  {
    id: "prd-azucar",
    name: "Azucar rubia",
    category: "Insumos",
    unit: "kg",
    active: true
  },
  {
    id: "prd-croissant",
    name: "Croissant mantequilla",
    category: "Pasteleria",
    unit: "unidades",
    active: true
  },
  {
    id: "prd-vasos-12",
    name: "Vasos compostables 12 oz",
    category: "Packaging",
    unit: "unidades",
    active: true
  },
  {
    id: "prd-cacao",
    name: "Cacao amargo",
    category: "Insumos",
    unit: "kg",
    active: false
  }
];

export const mockInventories: InventoryRecord[] = [
  {
    id: "inv-2026-06-24",
    status: "submitted",
    createdAt: "2026-06-24T08:30:00.000Z",
    submittedAt: "2026-06-24T09:05:00.000Z",
    userId: "usr-worker-1",
    userName: "Mateo Silva",
    shift: "Turno manana",
    items: [
      {
        id: "itm-1",
        productId: "prd-espresso",
        productName: "Cafe espresso blend",
        category: "Cafe",
        unit: "kg",
        physicalStock: 18,
        fudoStock: 20,
        difference: -2,
        comment: "Se uso para calibracion de molino."
      },
      {
        id: "itm-2",
        productId: "prd-leche-entera",
        productName: "Leche entera",
        category: "Lacteos",
        unit: "litros",
        physicalStock: 42,
        fudoStock: 39,
        difference: 3
      },
      {
        id: "itm-3",
        productId: "prd-avena",
        productName: "Bebida de avena",
        category: "Bebidas vegetales",
        unit: "litros",
        physicalStock: 16,
        fudoStock: 16,
        difference: 0
      },
      {
        id: "itm-4",
        productId: "prd-azucar",
        productName: "Azucar rubia",
        category: "Insumos",
        unit: "kg",
        physicalStock: 11,
        fudoStock: 13,
        difference: -2
      },
      {
        id: "itm-5",
        productId: "prd-croissant",
        productName: "Croissant mantequilla",
        category: "Pasteleria",
        unit: "unidades",
        physicalStock: 28,
        fudoStock: 25,
        difference: 3,
        comment: "Produccion extra del dia anterior."
      }
    ]
  },
  {
    id: "inv-2026-06-17",
    status: "submitted",
    createdAt: "2026-06-17T20:10:00.000Z",
    submittedAt: "2026-06-17T20:32:00.000Z",
    userId: "usr-worker-2",
    userName: "Antonia Perez",
    shift: "Turno tarde",
    items: [
      {
        id: "itm-6",
        productId: "prd-espresso",
        productName: "Cafe espresso blend",
        category: "Cafe",
        unit: "kg",
        physicalStock: 21,
        fudoStock: 21,
        difference: 0
      },
      {
        id: "itm-7",
        productId: "prd-leche-entera",
        productName: "Leche entera",
        category: "Lacteos",
        unit: "litros",
        physicalStock: 34,
        fudoStock: 36,
        difference: -2
      },
      {
        id: "itm-8",
        productId: "prd-vasos-12",
        productName: "Vasos compostables 12 oz",
        category: "Packaging",
        unit: "unidades",
        physicalStock: 420,
        fudoStock: 400,
        difference: 20
      }
    ]
  }
];
