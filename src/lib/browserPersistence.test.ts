import { describe, expect, it } from "vitest";
import { loadBrowserState, saveBrowserState } from "./browserPersistence";
import type { ImportHistoryEntry, MaintenanceCase } from "../domain/types";

describe("browser persistence", () => {
  it("saves and loads cases with import history", () => {
    const storage = new Map<string, string>();
    const localStorageLike = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value)
    };
    const cases: MaintenanceCase[] = [makeCase("L00055")];
    const importHistory: ImportHistoryEntry[] = [{
      id: "local-1",
      fileName: "mtd.csv",
      importedAt: "2026-05-29T11:00:00.000Z",
      totalRows: 1,
      newCount: 1,
      updatedCount: 0,
      unchangedCount: 0,
      conflictCount: 0,
      invalidCount: 0,
      storageStatus: "local"
    }];

    saveBrowserState(localStorageLike, { cases, importHistory });

    expect(loadBrowserState(localStorageLike)).toEqual({ cases, importHistory });
  });

  it("returns null when stored JSON is not readable", () => {
    const localStorageLike = {
      getItem: () => "{broken",
      setItem: () => undefined
    };

    expect(loadBrowserState(localStorageLike)).toBeNull();
  });
});

function makeCase(ticketNo: string): MaintenanceCase {
  return {
    id: `case-${ticketNo}`,
    ticketNo,
    updatedAt: "2026-05-29T11:00:00.000Z",
    larkSnapshot: {
      ticketNo,
      storeCode: "PTNC",
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
