import { describe, expect, it } from "vitest";
import { addCaseNote, attachDocumentFile, updateAmountCheck, updateDocumentStatus } from "./caseWorkflow";
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

describe("addCaseNote", () => {
  it("adds a trimmed note to the selected ticket", () => {
    const cases = [makeCase("L00055"), makeCase("L00056")];
    cases[0].appWork.notes = ["Existing note"];

    const result = addCaseNote(cases, "L00055", "  Waiting supplier revise QT  ", "2026-05-29T14:00:00.000Z");

    expect(result[0].appWork.notes).toEqual(["Waiting supplier revise QT", "Existing note"]);
    expect(result[0].updatedAt).toBe("2026-05-29T14:00:00.000Z");
    expect(result[1]).toBe(cases[1]);
  });

  it("does not change cases when note is blank", () => {
    const cases = [makeCase("L00055")];

    expect(addCaseNote(cases, "L00055", "   ")).toBe(cases);
  });
});

describe("attachDocumentFile", () => {
  it("attaches file metadata to a document type and marks it uploaded", () => {
    const cases = [makeCase("L00055"), makeCase("L00056")];

    const result = attachDocumentFile(
      cases,
      "L00055",
      "quotation",
      { name: "QT-CNQC.xlsx", size: 2048, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      "2026-05-29T15:00:00.000Z"
    );

    expect(result[0].appWork.quotation).toBe("uploaded");
    expect(result[0].appWork.documents.quotation).toEqual([
      {
        id: "quotation-2026-05-29T15:00:00.000Z-QT-CNQC.xlsx",
        name: "QT-CNQC.xlsx",
        size: 2048,
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        uploadedAt: "2026-05-29T15:00:00.000Z"
      }
    ]);
    expect(result[0].updatedAt).toBe("2026-05-29T15:00:00.000Z");
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
      documents: {},
      amountCheck: "not_started"
    }
  };
}
