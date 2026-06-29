import { InventoryRecord } from "@/lib/types";
import { formatDateTime } from "@/lib/inventory";

export async function downloadInventoriesExcel(inventories: InventoryRecord[], fileName: string) {
  const xlsx = await import("xlsx");

  const rows = inventories.flatMap((inventory) =>
    inventory.items.map((item) => ({
      "Fecha del inventario": formatDateTime(inventory.submittedAt ?? inventory.createdAt),
      "Usuario/turno": `${inventory.userName} / ${inventory.shift}`,
      Producto: item.productName,
      Categoria: item.category,
      "Unidad de medida": item.unit,
      "Stock fisico": item.physicalStock,
      "Stock FUDO": item.fudoStock,
      Diferencia: item.difference,
      Comentario: item.comment ?? ""
    }))
  );

  const worksheet = xlsx.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 24 },
    { wch: 32 },
    { wch: 28 },
    { wch: 20 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 36 }
  ];

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Inventarios");
  xlsx.writeFile(workbook, fileName);
}
