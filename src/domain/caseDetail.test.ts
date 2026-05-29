import { describe, expect, it } from "vitest";
import { getCaseDetail } from "./caseDetail";
import type { MaintenanceCase } from "./types";

describe("getCaseDetail", () => {
  it("extracts operational details from the Lark raw payload", () => {
    const item = makeCase({
      "รายละเอียดงาน (สาขา)": "Lighting at storefront is broken",
      "รายละเอียดงานแจ้งแก้ไข (Maintenance team)": "Replace damaged lamps",
      "Sup-Category": "Lighting repair",
      "Rank": "D",
      "Job Done by": "Sup",
      "สถานะผู้รับเหมา": "Done",
      "SLA (Day)": "30.00",
      "L2 วันที่จ่ายงาน Sup": "2025/12/02 11:42",
      "L2 ต้องเสร็จสิ้นภายใน": "2026/01/31 11:42",
      "แผนเข้าทำงานวันที่": "2025/12/02 18:00",
      "L2 วันที่จบงาน": "2025/12/17 14:10",
      "MAP": "https://maps.example/store",
      "Phone Number": "0806930736",
      "PO Status": "วางบิลแล้ว",
      "ยอด Before VAT 7%": "2429.00"
    });

    expect(getCaseDetail(item)).toEqual({
      branchRequest: "Lighting at storefront is broken",
      maintenanceScope: "Replace damaged lamps",
      supplierCategory: "Lighting repair",
      rank: "D",
      jobDoneBy: "Sup",
      contractorStatus: "Done",
      slaDays: "30.00",
      assignedToSupplierAt: "2025/12/02 11:42",
      dueAt: "2026/01/31 11:42",
      plannedAt: "2025/12/02 18:00",
      finishedAt: "2025/12/17 14:10",
      mapUrl: "https://maps.example/store",
      phoneNumber: "0806930736",
      poStatus: "วางบิลแล้ว",
      beforeVatAmount: "2429.00"
    });
  });

  it("falls back to empty strings when raw fields are missing", () => {
    expect(getCaseDetail(makeCase({}))).toMatchObject({
      branchRequest: "",
      maintenanceScope: "",
      mapUrl: "",
      beforeVatAmount: ""
    });
  });
});

function makeCase(raw: Record<string, string>): MaintenanceCase {
  return {
    id: "case-L00055",
    ticketNo: "L00055",
    updatedAt: "2026-05-29T12:00:00.000Z",
    larkSnapshot: {
      ticketNo: "L00055",
      storeCode: "PTNC",
      raw
    },
    appWork: {
      jobDetail: "missing",
      quotation: "missing",
      po: "missing",
      invoice: "missing",
      archive: "missing",
      notes: [],
      documents: {},
      amountCheck: "not_started"
    }
  };
}
