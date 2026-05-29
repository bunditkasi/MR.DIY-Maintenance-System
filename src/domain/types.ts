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

export type AppWorkData = {
  jobDetail: DocumentStatus;
  quotation: DocumentStatus;
  po: DocumentStatus;
  invoice: DocumentStatus;
  archive: DocumentStatus;
  notes: string[];
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
