export type LarkTicketSnapshot = {
  ticketNo: string;
  recordId?: string;
  storeCode: string;
  storeName?: string;
  category?: string;
  status?: string;
  senior?: string;
  supplier?: string;
  createdDate?: string;
  quotationNo?: string;
  poNo?: string;
  raw: Record<string, string>;
};

export type DocumentStatus = "missing" | "uploaded" | "validated" | "approved";

export type DocumentFileMeta = {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
};

export type DocumentFileMap = Partial<Record<"jobDetail" | "quotation" | "po" | "invoice" | "archive", DocumentFileMeta[]>>;

export type AppWorkData = {
  jobDetail: DocumentStatus;
  quotation: DocumentStatus;
  po: DocumentStatus;
  invoice: DocumentStatus;
  archive: DocumentStatus;
  notes: string[];
  documents: DocumentFileMap;
  amountCheck: "not_started" | "passed" | "warning" | "blocked";
};

export type MaintenanceCase = {
  id: string;
  ticketNo: string;
  larkSnapshot: LarkTicketSnapshot;
  appWork: AppWorkData;
  updatedAt: string;
};

export type ImportChange = {
  ticketNo: string;
  field: keyof LarkTicketSnapshot;
  before: string;
  after: string;
};

export type ImportConflict = {
  ticketNo: string;
  reason: string;
};

export type ImportInvalidRow = {
  rowNumber: number;
  reason: string;
};

export type ImportResult = {
  cases: MaintenanceCase[];
  newCases: MaintenanceCase[];
  updatedCases: MaintenanceCase[];
  unchangedCases: MaintenanceCase[];
  changes: ImportChange[];
  conflicts: ImportConflict[];
  invalidRows: ImportInvalidRow[];
};

export type ImportHistoryEntry = {
  id: string;
  fileName: string;
  importedAt: string;
  totalRows: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  conflictCount: number;
  invalidCount: number;
  storageStatus: "local" | "supabase" | "error";
};

export type { PriceMasterItem } from "./priceMaster";
