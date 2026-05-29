import type { AppWorkData, DocumentStatus, MaintenanceCase } from "./types";

export type DocumentKey = Extract<keyof AppWorkData, "jobDetail" | "quotation" | "po" | "invoice" | "archive">;

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
