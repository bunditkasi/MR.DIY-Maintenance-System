import { describe, expect, it } from "vitest";
import { addPacketItemFromPriceMaster, createEmptyCasePacket, getCasePacket, updatePacketItemQuantity } from "./casePacket";
import type { AppWorkData, PriceMasterItem } from "./types";

describe("case packet", () => {
  it("defaults old app work to an empty packet", () => {
    const appWork = makeAppWork();

    expect(getCasePacket(appWork)).toEqual(createEmptyCasePacket());
  });

  it("adds a price master item and calculates totals", () => {
    const packet = addPacketItemFromPriceMaster(createEmptyCasePacket(), makePriceMasterItem());

    expect(packet.items).toHaveLength(1);
    expect(packet.items[0]).toMatchObject({
      priceMasterCode: "DIY 1.1",
      description: "Replace LP panel",
      quantity: 1,
      unit: "set",
      materialUnitPrice: 14414.4,
      laborUnitPrice: 3696,
      matchStatus: "matched"
    });
    expect(packet.subtotal).toBe(18110.4);
    expect(packet.vat).toBe(1267.73);
    expect(packet.grandTotal).toBe(19378.13);
  });

  it("updates quantity and recalculates line and packet totals", () => {
    const packet = addPacketItemFromPriceMaster(createEmptyCasePacket(), makePriceMasterItem());
    const updated = updatePacketItemQuantity(packet, packet.items[0].id, 2);

    expect(updated.items[0].quantity).toBe(2);
    expect(updated.items[0].lineTotal).toBe(36220.8);
    expect(updated.subtotal).toBe(36220.8);
    expect(updated.vat).toBe(2535.46);
    expect(updated.grandTotal).toBe(38756.26);
  });

  it("creates unique ids when the same price master item is added more than once", () => {
    const first = addPacketItemFromPriceMaster(createEmptyCasePacket(), makePriceMasterItem());
    const second = addPacketItemFromPriceMaster(first, makePriceMasterItem());

    expect(second.items[0].id).not.toBe(second.items[1].id);
  });
});

function makeAppWork(): AppWorkData {
  return {
    jobDetail: "missing",
    quotation: "missing",
    po: "missing",
    invoice: "missing",
    archive: "missing",
    notes: [],
    documents: {},
    amountCheck: "not_started"
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
