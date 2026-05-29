import { describe, expect, it } from "vitest";
import { createImportHistoryEntry } from "./importHistory";
import type { ImportResult } from "./types";

describe("createImportHistoryEntry", () => {
  it("summarizes import results for the history table", () => {
    const result = {
      newCases: [{ ticketNo: "L00001" }],
      updatedCases: [{ ticketNo: "L00002" }, { ticketNo: "L00003" }],
      unchangedCases: [{ ticketNo: "L00004" }],
      conflicts: [{ ticketNo: "L00003" }],
      invalidRows: [{ rowNumber: 5 }],
      cases: []
    } as unknown as ImportResult;

    expect(createImportHistoryEntry("mtd.csv", result, "2026-05-29T12:00:00.000Z")).toEqual({
      id: "local-2026-05-29T12:00:00.000Z",
      fileName: "mtd.csv",
      importedAt: "2026-05-29T12:00:00.000Z",
      totalRows: 5,
      newCount: 1,
      updatedCount: 2,
      unchangedCount: 1,
      conflictCount: 1,
      invalidCount: 1,
      storageStatus: "local"
    });
  });
});
