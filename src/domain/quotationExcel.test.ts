import { describe, expect, it } from "vitest";
import { summarizeQuotationWorksheet, validateQuotationSummary } from "./quotationExcel";

describe("summarizeQuotationWorksheet", () => {
  it("extracts quotation number, date and totals from CNQC-style rows", () => {
    const rows = [
      [],
      ["", "Quotation"],
      ["", "ATTENTION:", "", "", "", "", "", "", "", "NO. :CNQC-2025-QT-713"],
      ["", "CUSTOMER NAME:", "", "", "", "", "", "", "", "DATE  :2025/04/17"],
      [],
      ["", "", "", "", "", "", "Total", "", "", "", "", "", 2429],
      ["", "", "", "", "", "", "Vat 7%", "", "", "", "", "", 170.03],
      ["", "", "", "", "", "", "Sum Total", "", "", "", "", "", 2599.03],
      ["", "", "", "", "", "", "Final Quotation", "", "", "", "", "", 2599.03]
    ];

    expect(summarizeQuotationWorksheet(rows)).toEqual({
      quotationNo: "CNQC-2025-QT-713",
      quotationDate: "2025/04/17",
      beforeVat: 2429,
      vat: 170.03,
      total: 2599.03,
      finalTotal: 2599.03,
      hasFormulaError: false
    });
  });
});

describe("validateQuotationSummary", () => {
  it("warns when quotation number does not match Lark", () => {
    expect(validateQuotationSummary("CNQC-2025-QT-999", "2429.00", {
      quotationNo: "CNQC-2025-QT-713",
      beforeVat: 2429,
      hasFormulaError: false
    })).toEqual({
      status: "warning",
      message: "Quotation number CNQC-2025-QT-713 does not match Lark quotation CNQC-2025-QT-999."
    });
  });

  it("warns when quotation before VAT does not match Lark amount", () => {
    expect(validateQuotationSummary("CNQC-2025-QT-713", "2000.00", {
      quotationNo: "CNQC-2025-QT-713",
      beforeVat: 2429,
      hasFormulaError: false
    })).toEqual({
      status: "warning",
      message: "Quotation before VAT 2,429.00 does not match Lark before VAT 2,000.00."
    });
  });

  it("passes when quotation number and before VAT match Lark", () => {
    expect(validateQuotationSummary("CNQC-2025-QT-713", "2429.00", {
      quotationNo: "CNQC-2025-QT-713",
      beforeVat: 2429,
      hasFormulaError: false
    })).toEqual({
      status: "passed",
      message: "Quotation number and before VAT match Lark ticket."
    });
  });
});
