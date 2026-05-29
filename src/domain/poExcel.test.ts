import { describe, expect, it } from "vitest";
import { summarizePoWorksheet, validatePoSummary } from "./poExcel";

describe("summarizePoWorksheet", () => {
  it("extracts PO totals and detects formula errors from worksheet rows", () => {
    const rows = [
      [],
      ["", "", "", "", "", "", "", "", "", "เลขที่/No.", "POM2601083"],
      ["", "", "", "", "", "", "", "", "", "วันที่/Date", "2026-05-06"],
      [],
      ["", "", "", "", "", "", "", "มูลค่าสินค้าก่อนภาษี", "", "", 2429],
      ["", "", "", "", "", "", "", "ภาษีมูลค่าเพิ่ม / Vat 7 %", "", "", 170.03],
      ["", "", "", "", "", "", "", "ยอดมูลค่าสินค้ารวมภาษี", "", "", 2599.03],
      ["", "", "", "", "", "", "", "หักตามใบแจ้งหนี้ : ภาษีหัก ณ ที่จ่าย (3%)", "", "", "#REF!"],
      ["", "", "", "", "", "", "", "ยอดสุทธิ / Net Total", "", "", "#REF!"]
    ];

    expect(summarizePoWorksheet(rows)).toEqual({
      poNo: "POM2601083",
      poDate: "2026-05-06",
      beforeVat: 2429,
      vat: 170.03,
      total: 2599.03,
      netTotal: undefined,
      hasFormulaError: true
    });
  });
});

describe("validatePoSummary", () => {
  it("blocks PO validation when formula errors are present", () => {
    expect(validatePoSummary("2429.00", {
      beforeVat: 2429,
      hasFormulaError: true
    })).toEqual({
      status: "blocked",
      message: "PO has formula errors."
    });
  });

  it("warns when PO before VAT does not match the Lark ticket amount", () => {
    expect(validatePoSummary("2000.00", {
      beforeVat: 2429,
      hasFormulaError: false
    })).toEqual({
      status: "warning",
      message: "PO before VAT 2,429.00 does not match Lark before VAT 2,000.00."
    });
  });

  it("passes when PO before VAT matches the Lark ticket amount", () => {
    expect(validatePoSummary("2429.00", {
      beforeVat: 2429,
      hasFormulaError: false
    })).toEqual({
      status: "passed",
      message: "PO before VAT matches Lark ticket amount."
    });
  });
});
