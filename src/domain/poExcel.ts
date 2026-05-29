import type { AmountCheckStatus } from "./caseWorkflow";

export type PoSummary = {
  poNo?: string;
  poDate?: string;
  beforeVat?: number;
  vat?: number;
  total?: number;
  netTotal?: number;
  hasFormulaError: boolean;
};

export type PoValidation = {
  status: AmountCheckStatus;
  message: string;
};

type CellValue = string | number | boolean | Date | null | undefined;

export function summarizePoWorksheet(rows: CellValue[][]): PoSummary {
  const poNo = findValueAfterLabel(rows, "เลขที่/No.");
  const poDate = findValueAfterLabel(rows, "วันที่/Date");
  const beforeVat = findNumberAfterLabel(rows, "มูลค่าสินค้าก่อนภาษี");
  const vat = findNumberAfterLabel(rows, "ภาษีมูลค่าเพิ่ม");
  const total = findNumberAfterLabel(rows, "ยอดมูลค่าสินค้ารวมภาษี");
  const netTotal = findNumberAfterLabel(rows, "ยอดสุทธิ / Net Total");
  const hasFormulaError = rows.some((row) => row.some((cell) => String(cell ?? "").includes("#REF!")));

  return {
    poNo,
    poDate,
    beforeVat,
    vat,
    total,
    netTotal,
    hasFormulaError
  };
}

export function validatePoSummary(larkBeforeVat: string | undefined, summary: Partial<PoSummary>): PoValidation {
  if (summary.hasFormulaError) {
    return { status: "blocked", message: "PO has formula errors." };
  }

  const expectedAmount = parseAmount(larkBeforeVat);
  if (expectedAmount === undefined || summary.beforeVat === undefined) {
    return { status: "warning", message: "PO before VAT or Lark before VAT amount is missing." };
  }

  if (Math.abs(expectedAmount - summary.beforeVat) > 0.01) {
    return {
      status: "warning",
      message: `PO before VAT ${formatAmount(summary.beforeVat)} does not match Lark before VAT ${formatAmount(expectedAmount)}.`
    };
  }

  return { status: "passed", message: "PO before VAT matches Lark ticket amount." };
}

function findValueAfterLabel(rows: CellValue[][], label: string): string | undefined {
  for (const row of rows) {
    const index = row.findIndex((cell) => String(cell ?? "").includes(label));
    if (index >= 0) {
      const value = row.slice(index + 1).find((cell) => cell !== null && cell !== undefined && String(cell).trim() !== "");
      return value === undefined ? undefined : String(value);
    }
  }
  return undefined;
}

function findNumberAfterLabel(rows: CellValue[][], label: string): number | undefined {
  const value = findValueAfterLabel(rows, label);
  return parseAmount(value);
}

function parseAmount(value: string | number | undefined): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  const amount = typeof value === "number" ? value : Number(value.replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : undefined;
}

function formatAmount(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
