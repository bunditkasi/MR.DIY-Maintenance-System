import { addPacketItemFromPriceMaster, getCasePacket, updatePacketItemQuantity } from "./casePacket";
import type { AppWorkData, DocumentStatus, MaintenanceCase, PriceMasterItem } from "./types";

export type DocumentKey = Extract<keyof AppWorkData, "jobDetail" | "quotation" | "po" | "invoice" | "archive">;
export type AmountCheckStatus = AppWorkData["amountCheck"];

export function updateDocumentStatus(
  cases: MaintenanceCase[],
  ticketNo: string,
  documentKey: DocumentKey,
  status: DocumentStatus,
  updatedAt: string = new Date().toISOString()
): MaintenanceCase[] {
  let changed = false;
  const nextCases = cases.map((item) => {
    if (item.ticketNo !== ticketNo) {
      return item;
    }

    changed = true;
    return {
      ...item,
      updatedAt,
      appWork: {
        ...item.appWork,
        [documentKey]: status
      }
    };
  });

  return changed ? nextCases : cases;
}

export function updateAmountCheck(
  cases: MaintenanceCase[],
  ticketNo: string,
  status: AmountCheckStatus,
  updatedAt: string = new Date().toISOString()
): MaintenanceCase[] {
  let changed = false;
  const nextCases = cases.map((item) => {
    if (item.ticketNo !== ticketNo) {
      return item;
    }

    changed = true;
    return {
      ...item,
      updatedAt,
      appWork: {
        ...item.appWork,
        amountCheck: status
      }
    };
  });

  return changed ? nextCases : cases;
}

export function addCaseNote(
  cases: MaintenanceCase[],
  ticketNo: string,
  note: string,
  updatedAt: string = new Date().toISOString()
): MaintenanceCase[] {
  const trimmedNote = note.trim();
  if (!trimmedNote) {
    return cases;
  }

  let changed = false;
  const nextCases = cases.map((item) => {
    if (item.ticketNo !== ticketNo) {
      return item;
    }

    changed = true;
    return {
      ...item,
      updatedAt,
      appWork: {
        ...item.appWork,
        notes: [trimmedNote, ...item.appWork.notes]
      }
    };
  });

  return changed ? nextCases : cases;
}

export function attachDocumentFile(
  cases: MaintenanceCase[],
  ticketNo: string,
  documentKey: DocumentKey,
  file: { name: string; size: number; type: string },
  uploadedAt: string = new Date().toISOString()
): MaintenanceCase[] {
  let changed = false;
  const fileMeta = {
    id: `${documentKey}-${uploadedAt}-${file.name}`,
    name: file.name,
    size: file.size,
    type: file.type,
    uploadedAt
  };

  const nextCases = cases.map((item) => {
    if (item.ticketNo !== ticketNo) {
      return item;
    }

    changed = true;
    const currentDocuments = item.appWork.documents ?? {};
    return {
      ...item,
      updatedAt: uploadedAt,
      appWork: {
        ...item.appWork,
        [documentKey]: "uploaded" as DocumentStatus,
        documents: {
          ...currentDocuments,
          [documentKey]: [fileMeta, ...(currentDocuments[documentKey] ?? [])]
        }
      }
    };
  });

  return changed ? nextCases : cases;
}

export function addPriceMasterItemToCasePacket(
  cases: MaintenanceCase[],
  ticketNo: string,
  priceItem: PriceMasterItem,
  updatedAt: string = new Date().toISOString()
): MaintenanceCase[] {
  let changed = false;
  const nextCases = cases.map((item) => {
    if (item.ticketNo !== ticketNo) {
      return item;
    }

    changed = true;
    return {
      ...item,
      updatedAt,
      appWork: {
        ...item.appWork,
        casePacket: addPacketItemFromPriceMaster(getCasePacket(item.appWork), priceItem)
      }
    };
  });

  return changed ? nextCases : cases;
}

export function updateCasePacketItemQuantity(
  cases: MaintenanceCase[],
  ticketNo: string,
  itemId: string,
  quantity: number,
  updatedAt: string = new Date().toISOString()
): MaintenanceCase[] {
  let changed = false;
  const nextCases = cases.map((item) => {
    if (item.ticketNo !== ticketNo) {
      return item;
    }

    changed = true;
    return {
      ...item,
      updatedAt,
      appWork: {
        ...item.appWork,
        casePacket: updatePacketItemQuantity(getCasePacket(item.appWork), itemId, quantity)
      }
    };
  });

  return changed ? nextCases : cases;
}
