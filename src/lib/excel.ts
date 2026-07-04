import { InventoryItem, InventoryRecord } from "@/lib/types";
import { formatDateTime, getItemLossAmount } from "@/lib/inventory";

function getIncidenceType(item: InventoryItem) {
  if (item.physicalStock < item.fudoStock) {
    return "Faltante";
  }

  if (item.physicalStock > item.fudoStock) {
    return "Sobrante";
  }

  return "";
}

export async function downloadInventoriesExcel(inventories: InventoryRecord[], fileName: string, includeLoss = false) {
  const xlsx = await import("xlsx");
  const headers = [
    "Fecha del inventario",
    "Usuario/turno",
    "Producto",
    "Categoria",
    "Unidad de medida",
    "Stock fisico",
    "Stock FUDO",
    "Diferencia",
    "Tipo de incidencia",
    "Comentario",
    ...(includeLoss ? ["Monto pérdida"] : [])
  ];

  const rows = inventories.flatMap((inventory) =>
    inventory.items.filter((item) => item.difference !== 0).map((item) => {
      const row: Record<string, string | number> = {
        "Fecha del inventario": formatDateTime(inventory.submittedAt ?? inventory.createdAt),
        "Usuario/turno": `${inventory.userName} / ${inventory.shift}`,
        Producto: item.productName,
        Categoria: item.category,
        "Unidad de medida": item.unit,
        "Stock fisico": item.physicalStock,
        "Stock FUDO": item.fudoStock,
        Diferencia: item.difference,
        "Tipo de incidencia": getIncidenceType(item),
        Comentario: item.comment ?? ""
      };

      if (includeLoss) {
        row["Monto pérdida"] = getItemLossAmount(item);
      }

      return row;
    })
  );

  const worksheet = xlsx.utils.json_to_sheet(rows, { header: headers });
  worksheet["!cols"] = [
    { wch: 24 },
    { wch: 32 },
    { wch: 28 },
    { wch: 20 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 18 },
    { wch: 36 },
    ...(includeLoss ? [{ wch: 16 }] : [])
  ];

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Inventarios");
  xlsx.writeFile(workbook, fileName);
}
