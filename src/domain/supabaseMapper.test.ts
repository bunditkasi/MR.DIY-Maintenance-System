import { describe, expect, it } from "vitest";
import { toImportBatchInsert, toImportChangeRows, toTicketSnapshotUpserts } from "./supabaseMapper";
import type { ImportResult, MaintenanceCase } from "./types";

const caseItem: MaintenanceCase = {
  id: "case-L00055",
  ticketNo: "L00055",
  updatedAt: "2026-05-29T04:00:00.000Z",
  larkSnapshot: {
    ticketNo: "L00055",
    recordId: "rec55",
    storeCode: "PTNC",
    storeName: "Tanapol Center",
    category: "AutoDoor",
    status: "Assigned L2",
    senior: "Waritphon",
    supplier: "CNQC",
    createdDate: "2025-11-12",
    quotationNo: "CNQC-2025-QT-283",
    poNo: "POM2505022",
    raw: {
      "Ticket No.": "L00055",
      "Store Code-name": "PTNC Tanapol Center"
    }
  },
  appWork: {
    jobDetail: "approved",
    quotation: "validated",
    po: "approved",
    invoice: "missing",
    archive: "uploaded",
    notes: ["Waiting invoice"],
    documents: {},
    amountCheck: "passed"
  }
};

const importResult: ImportResult = {
  cases: [caseItem],
  newCases: [],
  updatedCases: [caseItem],
  unchangedCases: [],
  changes: [
    {
      ticketNo: "L00055",
      field: "status",
      before: "Assigned L1",
      after: "Assigned L2"
    }
  ],
  conflicts: [
    {
      ticketNo: "L00055",
      reason: "Supplier changed after quotation work started"
    }
  ],
  invalidRows: [
    {
      rowNumber: 3,
      reason: "Missing Ticket No."
    }
  ]
};

describe("supabase mapper", () => {
  it("maps case snapshots into snake_case ticket snapshot upsert rows", () => {
    expect(toTicketSnapshotUpserts([caseItem])).toEqual([
      {
        ticket_no: "L00055",
        record_id: "rec55",
        store_code: "PTNC",
        store_name: "Tanapol Center",
        category: "AutoDoor",
        ticket_status: "Assigned L2",
        senior_name: "Waritphon",
        supplier_name: "CNQC",
        created_date: "2025-11-12",
        quotation_no: "CNQC-2025-QT-283",
        po_no: "POM2505022",
        raw_payload: {
          "Ticket No.": "L00055",
          "Store Code-name": "PTNC Tanapol Center"
        }
      }
    ]);
  });

  it("summarizes import results into an import batch row", () => {
    expect(toImportBatchInsert("mtd-export.csv", importResult)).toEqual({
      file_name: "mtd-export.csv",
      total_case_count: 2,
      new_count: 0,
      updated_count: 1,
      unchanged_count: 0,
      conflict_count: 1,
      invalid_count: 1
    });
  });

  it("maps import changes with a batch id", () => {
    expect(toImportChangeRows("batch-1", importResult.changes)).toEqual([
      {
        batch_id: "batch-1",
        ticket_no: "L00055",
        field_name: "status",
        before_value: "Assigned L1",
        after_value: "Assigned L2"
      }
    ]);
  });
});
