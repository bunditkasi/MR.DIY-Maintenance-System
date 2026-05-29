import type {
  AppWorkData,
  ImportChange,
  ImportConflict,
  ImportInvalidRow,
  ImportResult,
  LarkTicketSnapshot,
  MaintenanceCase
} from "./types";

export type ParseCsvResult = {
  rows: LarkTicketSnapshot[];
  invalidRows: ImportInvalidRow[];
};

const FIELD_ALIASES = {
  ticketNo: ["Ticket No.", "Ticket", "Ticket No", "Ticket number"],
  recordId: ["Record ID", "record_id", "Lark Record ID"],
  store: ["Store Code-name", "Store", "Department of Creator", "Store Code"],
  status: ["Ticket Status", "Status"],
  senior: ["L1 Senior", "Senior", "Assigned Senior"],
  supplier: ["L2 Sup", "Supplier", "Suplier", "L2 Supplier"],
  createdDate: ["Create date", "Created Date", "Submitted Date"],
  category: ["หมวดหมู่งานซ่อม", "Category", "First Tier"],
  quotationNo: ["Quotation number", "Quotation No.", "QT No."],
  poNo: ["PO", "PO No.", "PO Number"]
} as const;

type ComparableSnapshotField = Exclude<keyof LarkTicketSnapshot, "raw">;

const SNAPSHOT_FIELDS: ComparableSnapshotField[] = [
  "recordId",
  "storeCode",
  "storeName",
  "category",
  "status",
  "senior",
  "supplier",
  "createdDate",
  "quotationNo",
  "poNo"
];

export function parseCsv(csvText: string): ParseCsvResult {
  const records = parseCsvRecords(csvText);
  const [headers, ...dataRows] = records;
  const rows: LarkTicketSnapshot[] = [];
  const invalidRows: ImportInvalidRow[] = [];

  if (!headers || headers.length === 0) {
    return {
      rows,
      invalidRows: [{ rowNumber: 1, reason: "Missing CSV header" }]
    };
  }

  dataRows.forEach((values, index) => {
    const raw = toRawRow(headers, values);
    const ticketNo = pick(raw, FIELD_ALIASES.ticketNo);

    if (!ticketNo) {
      invalidRows.push({ rowNumber: index + 2, reason: "Missing Ticket No." });
      return;
    }

    const storeValue = pick(raw, FIELD_ALIASES.store);
    const { storeCode, storeName } = parseStore(storeValue);

    rows.push({
      ticketNo,
      recordId: pick(raw, FIELD_ALIASES.recordId),
      storeCode,
      storeName,
      category: pick(raw, FIELD_ALIASES.category),
      status: pick(raw, FIELD_ALIASES.status),
      senior: pick(raw, FIELD_ALIASES.senior),
      supplier: pick(raw, FIELD_ALIASES.supplier),
      createdDate: pick(raw, FIELD_ALIASES.createdDate),
      quotationNo: pick(raw, FIELD_ALIASES.quotationNo),
      poNo: pick(raw, FIELD_ALIASES.poNo),
      raw
    });
  });

  return { rows, invalidRows };
}

export function syncLarkRows(
  existingCases: MaintenanceCase[],
  incomingRows: LarkTicketSnapshot[],
  invalidRows: ImportInvalidRow[] = []
): ImportResult {
  const now = new Date().toISOString();
  const caseByTicket = new Map(existingCases.map((item) => [item.ticketNo, item]));
  const nextCases = new Map(existingCases.map((item) => [item.ticketNo, item]));
  const newCases: MaintenanceCase[] = [];
  const updatedCases: MaintenanceCase[] = [];
  const unchangedCases: MaintenanceCase[] = [];
  const changes: ImportChange[] = [];
  const conflicts: ImportConflict[] = [];

  incomingRows.forEach((row) => {
    const current = caseByTicket.get(row.ticketNo);

    if (!current) {
      const created = createCase(row, now);
      nextCases.set(row.ticketNo, created);
      newCases.push(created);
      return;
    }

    const rowChanges = detectChanges(current.larkSnapshot, row);

    if (rowChanges.length === 0) {
      unchangedCases.push(current);
      return;
    }

    const rowConflicts = detectConflicts(current, row);
    conflicts.push(...rowConflicts);

    const updated: MaintenanceCase = {
      ...current,
      larkSnapshot: row,
      appWork: current.appWork,
      updatedAt: now
    };

    nextCases.set(row.ticketNo, updated);
    updatedCases.push(updated);
    changes.push(...rowChanges);
  });

  return {
    cases: Array.from(nextCases.values()),
    newCases,
    updatedCases,
    unchangedCases,
    changes,
    conflicts,
    invalidRows
  };
}

export function createDefaultWorkData(): AppWorkData {
  return {
    jobDetail: "missing",
    quotation: "missing",
    po: "missing",
    invoice: "missing",
    archive: "missing",
    notes: [],
    amountCheck: "not_started"
  };
}

function createCase(snapshot: LarkTicketSnapshot, now: string): MaintenanceCase {
  return {
    id: `case-${snapshot.ticketNo}`,
    ticketNo: snapshot.ticketNo,
    larkSnapshot: snapshot,
    appWork: createDefaultWorkData(),
    updatedAt: now
  };
}

function detectChanges(before: LarkTicketSnapshot, after: LarkTicketSnapshot): ImportChange[] {
  return SNAPSHOT_FIELDS.flatMap((field) => {
    const beforeValue = before[field] ?? "";
    const afterValue = after[field] ?? "";

    if (beforeValue === afterValue) {
      return [];
    }

    return [{
      ticketNo: before.ticketNo,
      field,
      before: beforeValue,
      after: afterValue
    }];
  });
}

function detectConflicts(
  current: MaintenanceCase,
  incoming: LarkTicketSnapshot
): ImportConflict[] {
  const conflicts: ImportConflict[] = [];
  const quotationStarted = current.appWork.quotation !== "missing";
  const poStarted = current.appWork.po !== "missing";

  if (quotationStarted && (current.larkSnapshot.supplier ?? "") !== (incoming.supplier ?? "")) {
    conflicts.push({
      ticketNo: current.ticketNo,
      reason: "Supplier changed after quotation work started"
    });
  }

  if (poStarted && (current.larkSnapshot.storeCode ?? "") !== (incoming.storeCode ?? "")) {
    conflicts.push({
      ticketNo: current.ticketNo,
      reason: "Store changed after PO work started"
    });
  }

  return conflicts;
}

function toRawRow(headers: string[], values: string[]): Record<string, string> {
  return headers.reduce<Record<string, string>>((row, header, index) => {
    row[header.trim()] = (values[index] ?? "").trim();
    return row;
  }, {});
}

function pick(row: Record<string, string>, aliases: readonly string[]): string | undefined {
  for (const alias of aliases) {
    const value = row[alias]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

function parseStore(value: string | undefined): { storeCode: string; storeName?: string } {
  if (!value) {
    return { storeCode: "" };
  }

  const [storeCode, ...nameParts] = value.trim().split(/\s+/);
  const storeName = nameParts.join(" ").trim();
  return {
    storeCode,
    storeName: storeName || undefined
  };
}

function parseCsvRecords(input: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) {
        records.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) {
    records.push(row);
  }

  return records;
}
