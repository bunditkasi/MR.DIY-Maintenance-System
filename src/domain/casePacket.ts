import type { AppWorkData, CasePacket, CasePacketItem, PacketDocumentReadiness, PriceMasterItem } from "./types";

const VAT_RATE = 0.07;

export function createEmptyCasePacket(): CasePacket {
  return {
    items: [],
    subtotal: 0,
    vat: 0,
    grandTotal: 0
  };
}

export function getCasePacket(appWork: AppWorkData): CasePacket {
  return recalculatePacket(appWork.casePacket ?? createEmptyCasePacket());
}

export function addPacketItemFromPriceMaster(packet: CasePacket, priceItem: PriceMasterItem): CasePacket {
  const id = createPacketItemId(packet, priceItem);
  return recalculatePacket({
    ...packet,
    items: [
      ...packet.items,
      {
        id,
        priceMasterCode: priceItem.diyCode,
        priceMasterSheet: priceItem.sourceSheet,
        itemCode: priceItem.itemCode,
        description: priceItem.description,
        quantity: priceItem.quantity || 1,
        unit: priceItem.unit,
        materialUnitPrice: priceItem.materialPrice,
        laborUnitPrice: priceItem.laborPrice,
        lineTotal: 0,
        matchStatus: "matched"
      }
    ]
  });
}

export function updatePacketItemQuantity(packet: CasePacket, itemId: string, quantity: number): CasePacket {
  const safeQuantity = Math.max(0, quantity);
  return recalculatePacket({
    ...packet,
    items: packet.items.map((item) => item.id === itemId ? { ...item, quantity: safeQuantity } : item)
  });
}

export function searchPriceMasterItems(items: PriceMasterItem[], query: string, limit = 80): PriceMasterItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return items.slice(0, limit);
  }

  const terms = needle.split(/\s+/).filter(Boolean);
  return items
    .filter((item) => {
      const haystack = [
        item.sourceSheet,
        item.itemCode,
        item.diyCode,
        item.description,
        item.unit
      ].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, limit);
}

export function getPacketDocumentReadiness(packet: CasePacket): PacketDocumentReadiness[] {
  if (packet.items.length === 0) {
    return [
      blockedReadiness("Job Detail", "Add at least one work item."),
      blockedReadiness("Quotation", "Add at least one work item."),
      blockedReadiness("PO", "Add at least one work item.")
    ];
  }

  const hasManualItems = packet.items.some((item) => item.matchStatus !== "matched");
  const workItemText = `${packet.items.length.toLocaleString()} work ${packet.items.length === 1 ? "item" : "items"}`;

  return [
    { label: "Job Detail", status: "ready", message: `Ready to draft from ${workItemText}.` },
    {
      label: "Quotation",
      status: hasManualItems ? "review" : "ready",
      message: hasManualItems ? "Review manual items before drafting." : "Ready to draft from price-matched items."
    },
    {
      label: "PO",
      status: hasManualItems ? "review" : "ready",
      message: hasManualItems
        ? `Review price matching before PO. Current total ${formatMoney(packet.grandTotal)}.`
        : `Ready with total ${formatMoney(packet.grandTotal)} including VAT.`
    }
  ];
}

function recalculatePacket(packet: CasePacket): CasePacket {
  const items = packet.items.map(recalculateItem);
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const vat = roundMoney(subtotal * VAT_RATE);

  return {
    ...packet,
    items,
    subtotal,
    vat,
    grandTotal: roundMoney(subtotal + vat)
  };
}

function recalculateItem(item: CasePacketItem): CasePacketItem {
  return {
    ...item,
    lineTotal: roundMoney(item.quantity * (item.materialUnitPrice + item.laborUnitPrice))
  };
}

function createPacketItemId(packet: CasePacket, priceItem: PriceMasterItem): string {
  const key = `${priceItem.sourceSheet}-${priceItem.diyCode}-${priceItem.description}`;
  const baseId = `packet-${key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const matchingIds = new Set(packet.items.map((item) => item.id));

  if (!matchingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (matchingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseId}-${suffix}`;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function blockedReadiness(label: PacketDocumentReadiness["label"], message: string): PacketDocumentReadiness {
  return { label, status: "blocked", message };
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
