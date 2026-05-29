import { describe, expect, it } from "vitest";
import { addPriceMasterItemToCasePacket, updateCasePacketItemQuantity } from "./caseWorkflow";
import type { MaintenanceCase, PriceMasterItem } from "./types";

describe("case packet workflow", () => {
  it("adds and edits packet items for the selected ticket only", () => {
    const cases = [makeCase("L0001"), makeCase("L0002")];
    const withItem = addPriceMasterItemToCasePacket(cases, "L0001", makePriceMasterItem(), "2026-05-29T12:30:00.000Z");
    const itemId = withItem[0].appWork.casePacket?.items[0].id ?? "";
    const updated = updateCasePacketItemQuantity(withItem, "L0001", itemId, 3, "2026-05-29T12:45:00.000Z");

    expect(updated[0].appWork.casePacket?.items[0].quantity).toBe(3);
    expect(updated[0].appWork.casePacket?.subtotal).toBe(54331.2);
    expect(updated[0].updatedAt).toBe("2026-05-29T12:45:00.000Z");
    expect(updated[1].appWork.casePacket).toBeUndefined();
  });
});

function makeCase(ticketNo: string): MaintenanceCase {
  return {
    id: `case-${ticketNo}`,
    ticketNo,
    updatedAt: "2026-05-29T12:00:00.000Z",
    larkSnapshot: { ticketNo, storeCode: "PTNC", raw: { "Ticket No.": ticketNo } },
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

function makePriceMasterItem(): PriceMasterItem {
  return {
    sourceSheet: "Maintin Price (2026)",
    itemCode: "1001",
    diyCode: "DIY 1.1",
    description: "Replace LP panel",
    quantity: 1,
    materialPrice: 14414.4,
    laborPrice: 3696,
    unit: "set",
    totalPrice: 18110.4
  };
}
