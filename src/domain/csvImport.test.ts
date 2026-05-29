import { describe, expect, it } from "vitest";
import { parseCsv, syncLarkRows } from "./csvImport";
import type { MaintenanceCase } from "./types";

const existingCase: MaintenanceCase = {
  id: "case-L00055",
  ticketNo: "L00055",
  updatedAt: "2026-05-01T00:00:00.000Z",
  larkSnapshot: {
    ticketNo: "L00055",
    recordId: "rec-55",
    storeCode: "PTNC",
    storeName: "Tanapol Center",
    category: "AutoDoor",
    status: "Assigned L1",
    senior: "Apisit",
    supplier: "CNQC",
    createdDate: "2026-05-01",
    raw: {
      "Ticket No.": "L00055",
      "Store Code-name": "PTNC Tanapol Center",
      "Ticket Status": "Assigned L1"
    }
  },
  appWork: {
    jobDetail: "validated",
    quotation: "uploaded",
    po: "missing",
    invoice: "missing",
    archive: "missing",
    notes: ["Job detail checked by Sr.Ex"],
    amountCheck: "warning"
  }
};

describe("parseCsv", () => {
  it("parses quoted Lark CSV cells and normalizes ticket fields", () => {
    const csv = [
      "Ticket No.,Store Code-name,Ticket Status,L1 Senior,L2 Sup,Create date",
      'L00055,"PTNC Tanapol Center",Assigned L2,Apisit,CNQC,2026-05-06'
    ].join("\n");

    const result = parseCsv(csv);

    expect(result.invalidRows).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      ticketNo: "L00055",
      storeCode: "PTNC",
      storeName: "Tanapol Center",
      status: "Assigned L2",
      senior: "Apisit",
      supplier: "CNQC",
      createdDate: "2026-05-06"
    });
  });

  it("parses the exported MTD Table header format from Lark", () => {
    const csv = [
      "\uFEFFTicket No.,Create date,L1 Senior,L2 Sup,Store Code-Name,Store Code,Store Full Name,Category,Ticket Status,Quotation number,PO",
      "L00046,2025/11/09 12:45,Waritphon Aekbunyrit,ธนไพศาล,U141 PNRC,U141,Nong Bua Rawe,เพดาน (Ceiling),Done,QT6901005,POM2601083"
    ].join("\n");

    const result = parseCsv(csv);

    expect(result.invalidRows).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      ticketNo: "L00046",
      storeCode: "U141",
      storeName: "Nong Bua Rawe",
      category: "เพดาน (Ceiling)",
      status: "Done",
      senior: "Waritphon Aekbunyrit",
      supplier: "ธนไพศาล",
      createdDate: "2025/11/09 12:45",
      quotationNo: "QT6901005",
      poNo: "POM2601083"
    });
  });

  it("reports rows without a ticket number as invalid", () => {
    const csv = [
      "Ticket No.,Store Code-name,Ticket Status",
      ",PTNC Tanapol Center,Open"
    ].join("\n");

    const result = parseCsv(csv);

    expect(result.rows).toEqual([]);
    expect(result.invalidRows).toEqual([
      { rowNumber: 2, reason: "Missing Ticket No." }
    ]);
  });
});

describe("syncLarkRows", () => {
  it("creates new cases for tickets not already imported", () => {
    const parsed = parseCsv([
      "Ticket No.,Store Code-name,Ticket Status,L1 Senior",
      "L00056,PCPY Some Branch,Open,Waritphon"
    ].join("\n"));

    const result = syncLarkRows([], parsed.rows, parsed.invalidRows);

    expect(result.newCases).toHaveLength(1);
    expect(result.newCases[0].ticketNo).toBe("L00056");
    expect(result.newCases[0].appWork).toMatchObject({
      jobDetail: "missing",
      quotation: "missing",
      po: "missing",
      invoice: "missing",
      archive: "missing",
      amountCheck: "not_started"
    });
  });

  it("updates Lark snapshot fields while preserving app work data", () => {
    const parsed = parseCsv([
      "Ticket No.,Store Code-name,Ticket Status,L1 Senior,L2 Sup",
      "L00055,PTNC Tanapol Center,Assigned L2,Apisit,CNQC"
    ].join("\n"));

    const result = syncLarkRows([existingCase], parsed.rows, parsed.invalidRows);

    expect(result.updatedCases).toHaveLength(1);
    expect(result.updatedCases[0].larkSnapshot.status).toBe("Assigned L2");
    expect(result.updatedCases[0].appWork).toEqual(existingCase.appWork);
    expect(result.changes).toContainEqual({
      ticketNo: "L00055",
      field: "status",
      before: "Assigned L1",
      after: "Assigned L2"
    });
  });

  it("detects conflicts when supplier changes after quotation work started", () => {
    const parsed = parseCsv([
      "Ticket No.,Store Code-name,Ticket Status,L1 Senior,L2 Sup",
      "L00055,PTNC Tanapol Center,Assigned L2,Apisit,AN"
    ].join("\n"));

    const result = syncLarkRows([existingCase], parsed.rows, parsed.invalidRows);

    expect(result.conflicts).toEqual([
      {
        ticketNo: "L00055",
        reason: "Supplier changed after quotation work started"
      }
    ]);
  });
});
