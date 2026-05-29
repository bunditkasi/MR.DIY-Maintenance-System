import type { MaintenanceCase } from "./types";

export type CaseDetail = {
  branchRequest: string;
  maintenanceScope: string;
  supplierCategory: string;
  rank: string;
  jobDoneBy: string;
  contractorStatus: string;
  slaDays: string;
  assignedToSupplierAt: string;
  dueAt: string;
  plannedAt: string;
  finishedAt: string;
  mapUrl: string;
  phoneNumber: string;
  poStatus: string;
  beforeVatAmount: string;
};

const DETAIL_FIELDS = {
  branchRequest: ["รายละเอียดงาน (สาขา)", "Branch Request"],
  maintenanceScope: ["รายละเอียดงานแจ้งแก้ไข (Maintenance team)", "Maintenance Scope"],
  supplierCategory: ["Sup-Category", "Supplier Category"],
  rank: ["Rank"],
  jobDoneBy: ["Job Done by"],
  contractorStatus: ["สถานะผู้รับเหมา", "Contractor Status"],
  slaDays: ["SLA (Day)", "SLA"],
  assignedToSupplierAt: ["L2 วันที่จ่ายงาน Sup"],
  dueAt: ["L2 ต้องเสร็จสิ้นภายใน"],
  plannedAt: ["แผนเข้าทำงานวันที่"],
  finishedAt: ["L2 วันที่จบงาน"],
  mapUrl: ["MAP", "Map"],
  phoneNumber: ["Phone Number", "Phone"],
  poStatus: ["PO Status"],
  beforeVatAmount: ["ยอด Before VAT 7%", "Before VAT"]
} as const;

export function getCaseDetail(item: MaintenanceCase): CaseDetail {
  const raw = item.larkSnapshot.raw;
  return {
    branchRequest: pick(raw, DETAIL_FIELDS.branchRequest),
    maintenanceScope: pick(raw, DETAIL_FIELDS.maintenanceScope),
    supplierCategory: pick(raw, DETAIL_FIELDS.supplierCategory),
    rank: pick(raw, DETAIL_FIELDS.rank),
    jobDoneBy: pick(raw, DETAIL_FIELDS.jobDoneBy),
    contractorStatus: pick(raw, DETAIL_FIELDS.contractorStatus),
    slaDays: pick(raw, DETAIL_FIELDS.slaDays),
    assignedToSupplierAt: pick(raw, DETAIL_FIELDS.assignedToSupplierAt),
    dueAt: pick(raw, DETAIL_FIELDS.dueAt),
    plannedAt: pick(raw, DETAIL_FIELDS.plannedAt),
    finishedAt: pick(raw, DETAIL_FIELDS.finishedAt),
    mapUrl: pick(raw, DETAIL_FIELDS.mapUrl),
    phoneNumber: pick(raw, DETAIL_FIELDS.phoneNumber),
    poStatus: pick(raw, DETAIL_FIELDS.poStatus),
    beforeVatAmount: pick(raw, DETAIL_FIELDS.beforeVatAmount)
  };
}

function pick(row: Record<string, string>, aliases: readonly string[]): string {
  for (const alias of aliases) {
    const value = row[alias]?.trim();
    if (value) {
      return value;
    }
  }
  return "";
}
