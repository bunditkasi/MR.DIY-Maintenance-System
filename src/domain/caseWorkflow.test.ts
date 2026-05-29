import { describe, expect, it } from "vitest";
import { updateAmountCheck, updateDocumentStatus } from "./caseWorkflow";
import type { MaintenanceCase } from "./types";

describe("updateDocumentStatus", () => {
  it("updates one document status for the selected ticket only", () => {
    const cases = [makeCase("L00055"), makeCase("L00056")];

    const result = updateDocumentStatus(cases, "L00055", "po", "validated", "2026-05-29T12:00:00.000Z");

    expect(result[0].appWork.po).toBe("validated");
    expect(result[0].updatedAt).toBe("2026-05-29T12:00:00.000Z");
    expect(result[1]).toBe(cases[1]);
  });

  it("returns the original list when ticket is not found", () => {
    const cases = [makeCase("L00055")];

    expect(updateDocumentStatus(cases, "L99999", "po", "validated")).toBe(cases);
  });
});

describe("updateAmountCheck", () => {
  it("updates amount validation status without changing document statuses", () => {
    const cases = [makeCase("L00055"), makeCase("L00056")];
    cases[0].appWork.po = "validated";

    const result = updateAmountCheck(cases, "L00055", "blocked", "2026-05-29T13:00:00.000Z");

    expect(result[0].appWork.amountCheck).toBe("blocked");
    expect(result[0].appWork.po).toBe("validated");
    expect(result[0].updatedAt).toBe("2026-05-29T13:00:00.000Z");
    expect(result[1]).toBe(cases[1]);
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
      raw: { "Ticket No.": ticketNo }
    },
    appWork: {
      jobDetail: "missing",
      quotation: "missing",
      po: "missing",
      invoice: "missing",
      archive: "missing",
      notes: [],
      amountCheck: "not_started"
    }
  };
}
