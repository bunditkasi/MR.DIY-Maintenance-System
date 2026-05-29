export type PriceMasterItem = {
  sourceSheet: string;
  itemCode?: string;
  diyCode: string;
  description: string;
  quantity: number;
  materialPrice: number;
  laborPrice: number;
  unit: string;
  totalPrice: number;
};

type CellValue = string | number | boolean | Date | null | undefined;

export function parsePriceMasterSheets(sheets: Array<{ sheetName: string; rows: CellValue[][] }>): PriceMasterItem[] {
  return sheets.flatMap(({ sheetName, rows }) => {
    if (sheetName.toLowerCase().includes("air")) {
      return parseAirRows(sheetName, rows);
    }
    return parseMaintenanceRows(sheetName, rows);
  });
}

function parseMaintenanceRows(sourceSheet: string, rows: CellValue[][]): PriceMasterItem[] {
  return rows.flatMap((row) => {
    const itemCode = toText(row[1]);
    const diyCode = toText(row[2]);
    const description = toText(row[3]);
    const totalPrice = toNumber(row[18]);

    if (!diyCode || !description || totalPrice === undefined) {
      return [];
    }

    return [{
      sourceSheet,
      itemCode,
      diyCode,
      description,
      quantity: toNumber(row[14]) ?? 0,
      materialPrice: toNumber(row[15]) ?? 0,
      laborPrice: toNumber(row[17]) ?? 0,
      unit: toText(row[16]) ?? "",
      totalPrice
    }];
  });
}

function parseAirRows(sourceSheet: string, rows: CellValue[][]): PriceMasterItem[] {
  return rows.flatMap((row) => {
    const diyCode = toText(row[0]);
    const description = toText(row[1]);
    const totalPrice = toNumber(row[6]);

    if (!diyCode || !description || totalPrice === undefined || !diyCode.includes(".")) {
      return [];
    }

    return [{
      sourceSheet,
      itemCode: undefined,
      diyCode,
      description,
      quantity: toNumber(row[2]) ?? 0,
      materialPrice: toNumber(row[3]) ?? 0,
      laborPrice: toNumber(row[5]) ?? 0,
      unit: toText(row[4]) ?? "",
      totalPrice
    }];
  });
}

function toText(value: CellValue): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const text = String(value).trim().replace(/\s+/g, " ");
  return text || undefined;
}

function toNumber(value: CellValue): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const number = Number(value.replace(/,/g, ""));
    return Number.isFinite(number) ? number : undefined;
  }
  return undefined;
}
