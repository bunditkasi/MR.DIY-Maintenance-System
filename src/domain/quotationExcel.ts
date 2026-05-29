import type { AmountCheckStatus } from "./caseWorkflow";

export type QuotationSummary = {
  quotationNo?: string;
  quotationDate?: string;
  beforeVat?: number;
  vat?: number;
  total?: number;
  finalTotal?: number;
  hasFormulaError: boolean;
};

export type QuotationValidation = {
  status: AmountCheckStatus;
  message: string;
};

type CellValue = string | number | boolean | Date | null | undefined;

export function summarizeQuotationWorksheet(rows: CellValue[][]): QuotationSummary {
  const quotationNo = findInlineValue(rows, "NO.");
  const quotationDate = findInlineValue(rows, "DATE");
  const beforeVat = findNumberAfterLabel(rows, "Total");
  const vat = findNumberAfterLabel(rows, "Vat 7%");
  const total = findNumberAfterLabel(rows, "Sum Total");
  const finalTotal = findNumberAfterLabel(rows, "Final Quotation");
  const hasFormulaError = rows.some((row) => row.some((cell) => String(cell ?? "").includes("#REF!")));

  return {
    quotationNo,
    quotationDate,
    beforeVat,
    vat,
    total,
    finalTotal,
    hasFormulaError
  };
}

export function validateQuotationSummary(
  larkQuotationNo: string | undefined,
  larkBeforeVat: string | undefined,
  summary: Partial<QuotationSummary>
): QuotationValidation {
  if (summary.hasFormulaError) {
    return { status: "blocked", message: "Quotation has formula errors." };
  }

  if (larkQuotationNo && summary.quotationNo && normalize(larkQuotationNo) !== normalize(summary.quotationNo)) {
    return {
      status: "warning",
      message: `Quotation number ${summary.quotationNo} does not match Lark quotation ${larkQuotationNo}.`
    };
  }

  const expectedAmount = parseAmount(larkBeforeVat);
  if (expectedAmount === undefined || summary.beforeVat === undefined) {
    return { status: "warning", message: "Quotation before VAT or Lark before VAT amount is missing." };
  }

  if (Math.abs(expectedAmount - summary.beforeVat) > 0.01) {
    return {
      status: "warning",
      message: `Quotation before VAT ${formatAmount(summary.beforeVat)} does not match Lark before VAT ${formatAmount(expectedAmount)}.`
    };
  }

  return { status: "passed", message: "Quotation number and before VAT match Lark ticket." };
}

function findInlineValue(rows: CellValue[][], label: string): string | undefined {
  for (const row of rows) {
    for (const cell of row) {
      const text = String(cell ?? "");
      if (!text.includes(label)) {
        continue;
      }

      const [, value] = text.split(":");
      if (value?.trim()) {
        return value.trim().replace(/\s+/g, " ");
      }
    }
  }
  return undefined;
}

function findValueAfterLabel(rows: CellValue[][], label: string): string | undefined {
  for (const row of rows) {
    const index = row.findIndex((cell) => String(cell ?? "").trim() === label);
    if (index >= 0) {
      const value = row.slice(index + 1).find((cell) => cell !== null && cell !== undefined && String(cell).trim() !== "");
      return value === undefined ? undefined : String(value);
    }
  }
  return undefined;
}

function findNumberAfterLabel(rows: CellValue[][], label: string): number | undefined {
  return parseAmount(findValueAfterLabel(rows, label));
}

function parseAmount(value: string | number | undefined): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  const amount = typeof value === "number" ? value : Number(value.replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : undefined;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function formatAmount(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
