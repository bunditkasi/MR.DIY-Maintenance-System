import type { AppWorkData, DocumentStatus, MaintenanceCase } from "./types";

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
