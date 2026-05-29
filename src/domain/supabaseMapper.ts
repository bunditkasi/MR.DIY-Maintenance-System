import type { ImportChange, ImportConflict, ImportResult, MaintenanceCase } from "./types";

export type TicketSnapshotUpsert = {
  ticket_no: string;
  record_id?: string;
  store_code: string;
  store_name?: string;
  category?: string;
  ticket_status?: string;
  senior_name?: string;
  supplier_name?: string;
  created_date?: string;
  quotation_no?: string;
  po_no?: string;
  raw_payload: Record<string, string>;
};

export type ImportBatchInsert = {
  file_name: string;
  total_case_count: number;
  new_count: number;
  updated_count: number;
  unchanged_count: number;
  conflict_count: number;
  invalid_count: number;
};

export type ImportChangeInsert = {
  batch_id: string;
  ticket_no: string;
  field_name: string;
  before_value: string;
  after_value: string;
};

export type MaintenanceCaseUpsert = {
  ticket_no: string;
  job_detail_status: string;
  quotation_status: string;
  po_status: string;
  invoice_status: string;
  archive_status: string;
  amount_check: string;
  notes: string[];
};

export type ImportConflictInsert = {
  batch_id: string;
  ticket_no: string;
  reason: string;
};

export function toTicketSnapshotUpserts(cases: MaintenanceCase[]): TicketSnapshotUpsert[] {
  return cases.map(({ larkSnapshot }) => ({
    ticket_no: larkSnapshot.ticketNo,
    record_id: larkSnapshot.recordId,
    store_code: larkSnapshot.storeCode,
    store_name: larkSnapshot.storeName,
    category: larkSnapshot.category,
    ticket_status: larkSnapshot.status,
    senior_name: larkSnapshot.senior,
    supplier_name: larkSnapshot.supplier,
    created_date: larkSnapshot.createdDate,
    quotation_no: larkSnapshot.quotationNo,
    po_no: larkSnapshot.poNo,
    raw_payload: larkSnapshot.raw
  }));
}

export function toImportBatchInsert(
  fileName: string,
  result: ImportResult
): ImportBatchInsert {
  const importedRowCount = result.newCases.length
    + result.updatedCases.length
    + result.unchangedCases.length
    + result.invalidRows.length;

  return {
    file_name: fileName,
    total_case_count: importedRowCount,
    new_count: result.newCases.length,
    updated_count: result.updatedCases.length,
    unchanged_count: result.unchangedCases.length,
    conflict_count: result.conflicts.length,
    invalid_count: result.invalidRows.length
  };
}

export function toImportChangeRows(
  batchId: string,
  changes: ImportChange[]
): ImportChangeInsert[] {
  return changes.map((change) => ({
    batch_id: batchId,
    ticket_no: change.ticketNo,
    field_name: change.field,
    before_value: change.before,
    after_value: change.after
  }));
}

export function toMaintenanceCaseUpserts(cases: MaintenanceCase[]): MaintenanceCaseUpsert[] {
  return cases.map((item) => ({
    ticket_no: item.ticketNo,
    job_detail_status: item.appWork.jobDetail,
    quotation_status: item.appWork.quotation,
    po_status: item.appWork.po,
    invoice_status: item.appWork.invoice,
    archive_status: item.appWork.archive,
    amount_check: item.appWork.amountCheck,
    notes: item.appWork.notes
  }));
}

export function toImportConflictRows(
  batchId: string,
  conflicts: ImportConflict[]
): ImportConflictInsert[] {
  return conflicts.map((conflict) => ({
    batch_id: batchId,
    ticket_no: conflict.ticketNo,
    reason: conflict.reason
  }));
}
