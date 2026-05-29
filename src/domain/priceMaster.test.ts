import { describe, expect, it } from "vitest";
import { parsePriceMasterSheets } from "./priceMaster";

describe("parsePriceMasterSheets", () => {
  it("parses maintenance standard price rows using 2026 columns", () => {
    const rows = [
      [],
      [],
      [],
      ["NO.", "", "", "", "Quantity", "ค่าของ", "", "ค่าแรง", "Total", "", "", "", "", "", "Quantity", "ค่าวัสดุ", "", "ค่าแรง", "Total"],
      ["", "", "", "", "จำนวน", "ราคา", "หน่วย", "", "Amount", "", "", "", "", "", "จำนวน", "ราคา 2026", "หน่วย", "ราคา 2026", "Amount"],
      ["1", "", "DIY 1", "งานไฟฟ้า Electrical"],
      ["", "1001", "DIY 1.1", "เปลี่ยนตู้ LP 48CK 250A SQD", "", "", "", "", "", "", "", "", "", "", 1, 14414.4, "ตัว", 3696, 18110.4]
    ];

    expect(parsePriceMasterSheets([{ sheetName: "Maintin Price (2026)", rows }])).toEqual([
      {
        sourceSheet: "Maintin Price (2026)",
        itemCode: "1001",
        diyCode: "DIY 1.1",
        description: "เปลี่ยนตู้ LP 48CK 250A SQD",
        quantity: 1,
        materialPrice: 14414.4,
        laborPrice: 3696,
        unit: "ตัว",
        totalPrice: 18110.4
      }
    ]);
  });

  it("parses air price rows", () => {
    const rows = [
      ["Item Code", "Descriptions", "2025-2026", "", "", "", "Total"],
      ["", "", "Quantity", "ค่าของ", "", "ค่าแรง", "Total"],
      ["", "", "จำนวน", "ราคา", "หน่วย", "หน่วย", "Amount"],
      ["DIY 1", "Air-condition"],
      ["DIY 1.1", "เครื่องปรับอากาศแบบ CEILING TYPE", 1, 0, "เครื่อง", 5500, 5500]
    ];

    expect(parsePriceMasterSheets([{ sheetName: "Air2026", rows }])).toEqual([
      {
        sourceSheet: "Air2026",
        itemCode: undefined,
        diyCode: "DIY 1.1",
        description: "เครื่องปรับอากาศแบบ CEILING TYPE",
        quantity: 1,
        materialPrice: 0,
        laborPrice: 5500,
        unit: "เครื่อง",
        totalPrice: 5500
      }
    ]);
  });
});
