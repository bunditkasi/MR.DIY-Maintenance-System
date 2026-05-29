import { describe, expect, it } from "vitest";
import { loadPersistedCases, saveImportResult } from "./supabaseRepository";
import { parseCsv, syncLarkRows } from "../domain/csvImport";
import type { ImportResult, MaintenanceCase } from "../domain/types";

describe("saveImportResult", () => {
  it("persists an import batch, ticket snapshots, cases, changes and conflicts", async () => {
    const calls: Array<{ table: string; action: string; payload: unknown }> = [];
    const client = {
      from(table: string) {
        return {
          insert(payload: unknown) {
            calls.push({ table, action: "insert", payload });
            return {
              select() {
                return {
                  single: async () => ({ data: { id: "batch-1" }, error: null })
                };
              }
            };
          },
          upsert(payload: unknown) {
            calls.push({ table, action: "upsert", payload });
            return Promise.resolve({ error: null });
          }
        };
      }
    };
    const existing = syncLarkRows([], parseCsv([
      "Ticket No.,Store Code-Name,Store Code,Store Full Name,Ticket Status,L2 Sup",
      "L00055,PTNC Tanapol,PTNC,Tanapol Center,Assigned L1,CNQC"
    ].join("\n")).rows).cases;
    existing[0].appWork.quotation = "uploaded";

    const incoming = parseCsv([
      "Ticket No.,Store Code-Name,Store Code,Store Full Name,Ticket Status,L2 Sup",
      "L00055,PTNC Tanapol,PTNC,Tanapol Center,Assigned L2,A.N."
    ].join("\n"));
    const result = syncLarkRows(existing, incoming.rows, incoming.invalidRows);

    await saveImportResult(client, "lark.csv", result);

    expect(calls.map((call) => `${call.table}:${call.action}`)).toEqual([
      "import_batches:insert",
      "lark_ticket_snapshots:upsert",
      "maintenance_cases:upsert",
      "import_changes:insert",
      "import_conflicts:insert"
    ]);
    expect(calls[0].payload).toMatchObject({ file_name: "lark.csv", updated_count: 1, conflict_count: 1 });
    expect(calls[1].payload).toEqual([
      expect.objectContaining({ ticket_no: "L00055", ticket_status: "Assigned L2", supplier_name: "A.N." })
    ]);
    expect(calls[2].payload).toEqual([
      expect.objectContaining({ ticket_no: "L00055", quotation_status: "uploaded" })
    ]);
    expect(calls[4].payload).toEqual([
      expect.objectContaining({ batch_id: "batch-1", ticket_no: "L00055" })
    ]);
  });

  it("chunks large snapshot and case upserts for exported Lark files", async () => {
    const calls: Array<{ table: string; action: string; payload: unknown }> = [];
    const client = {
      from(table: string) {
        return {
          insert(payload: unknown) {
            calls.push({ table, action: "insert", payload });
            return {
              select() {
                return {
                  single: async () => ({ data: { id: "batch-1" }, error: null })
                };
              }
            };
          },
          upsert(payload: unknown) {
            calls.push({ table, action: "upsert", payload });
            return Promise.resolve({ error: null });
          }
        };
      }
    };
    const cases = Array.from({ length: 501 }, (_, index) => makeCase(`L${String(index).padStart(5, "0")}`));
    const result: ImportResult = {
      cases,
      newCases: cases,
      updatedCases: [],
      unchangedCases: [],
      changes: [],
      conflicts: [],
      invalidRows: []
    };

    await saveImportResult(client, "large-lark.csv", result);

    expect(calls.filter((call) => call.table === "lark_ticket_snapshots" && call.action === "upsert")).toHaveLength(2);
    expect(calls.filter((call) => call.table === "maintenance_cases" && call.action === "upsert")).toHaveLength(2);
  });
});

describe("loadPersistedCases", () => {
  it("maps persisted maintenance cases and joined Lark snapshots into app cases", async () => {
    const client = {
      from(table: string) {
        expect(table).toBe("maintenance_cases");
        return {
          select() {
            return {
              order: async () => ({
                error: null,
                data: [
                  {
                    id: "case-db-1",
                    ticket_no: "L00055",
                    job_detail_status: "approved",
                    quotation_status: "validated",
                    po_status: "approved",
                    invoice_status: "missing",
                    archive_status: "uploaded",
                    amount_check: "passed",
                    notes: ["Waiting invoice"],
                    updated_at: "2026-05-29T10:00:00.000Z",
                    lark_ticket_snapshots: {
                      ticket_no: "L00055",
                      record_id: "rec55",
                      store_code: "PTNC",
                      store_name: "Tanapol Center",
                      category: "AutoDoor",
                      ticket_status: "Done",
                      senior_name: "Waritphon",
                      supplier_name: "CNQC",
                      created_date: "2025-11-12",
                      quotation_no: "QT-1",
                      po_no: "PO-1",
                      raw_payload: { "Ticket No.": "L00055" }
                    }
                  }
                ]
              })
            };
          }
        };
      }
    };

    await expect(loadPersistedCases(client)).resolves.toEqual([
      expect.objectContaining({
        id: "case-db-1",
        ticketNo: "L00055",
        updatedAt: "2026-05-29T10:00:00.000Z",
        appWork: expect.objectContaining({ quotation: "validated", amountCheck: "passed" }),
        larkSnapshot: expect.objectContaining({ storeCode: "PTNC", poNo: "PO-1" })
      })
    ]);
  });
});

function makeCase(ticketNo: string): MaintenanceCase {
  return {
    id: `case-${ticketNo}`,
    ticketNo,
    updatedAt: "2026-05-29T10:00:00.000Z",
    larkSnapshot: {
      ticketNo,
      storeCode: "PTNC",
      storeName: "Tanapol Center",
      raw: { "Ticket No.": ticketNo }
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
