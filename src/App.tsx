import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Database,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  History,
  Search,
  Upload,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getCasePacket } from "./domain/casePacket";
import { getCaseDetail } from "./domain/caseDetail";
import { addCaseNote, addPriceMasterItemToCasePacket, attachDocumentFile, updateAmountCheck, updateCasePacketItemQuantity, updateDocumentStatus, type AmountCheckStatus, type DocumentKey } from "./domain/caseWorkflow";
import { parseCsv, syncLarkRows } from "./domain/csvImport";
import { createImportHistoryEntry } from "./domain/importHistory";
import type { PriceMasterItem } from "./domain/priceMaster";
import { validatePoSummary } from "./domain/poExcel";
import { validateQuotationSummary } from "./domain/quotationExcel";
import { sampleCases } from "./domain/sampleData";
import type { AppWorkData, CasePacket, DocumentStatus, ImportHistoryEntry, ImportResult, MaintenanceCase } from "./domain/types";
import { loadBrowserState, saveBrowserState } from "./lib/browserPersistence";
import { readPoFileSummary } from "./lib/poFileReader";
import { readPriceMasterFile } from "./lib/priceMasterFileReader";
import { readQuotationFileSummary } from "./lib/quotationFileReader";
import { ensureSupabaseSession, getSupabaseClient } from "./lib/supabaseClient";
import { loadPersistedCases, saveImportResult } from "./lib/supabaseRepository";

type PersistenceStatus = "idle" | "not_configured" | "saving" | "saved" | "error";

const documentLabels: Array<{ key: DocumentKey; label: string }> = [
  { key: "jobDetail", label: "Job Detail" },
  { key: "quotation", label: "Quotation" },
  { key: "po", label: "PO" },
  { key: "invoice", label: "Invoice" },
  { key: "archive", label: "Archive" }
];

const documentStatusOptions: DocumentStatus[] = ["missing", "uploaded", "validated", "approved"];
const amountCheckOptions: AmountCheckStatus[] = ["not_started", "passed", "warning", "blocked"];

export default function App() {
  const initialBrowserState = getInitialBrowserState();
  const initialCases = initialBrowserState?.cases.length ? initialBrowserState.cases : sampleCases;
  const [cases, setCases] = useState<MaintenanceCase[]>(initialCases);
  const [selectedTicket, setSelectedTicket] = useState(initialCases[0]?.ticketNo ?? "");
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>(initialBrowserState?.importHistory ?? []);
  const [priceMaster, setPriceMaster] = useState<PriceMasterItem[]>(initialBrowserState?.priceMaster ?? []);
  const [priceMasterFileName, setPriceMasterFileName] = useState(initialBrowserState?.priceMasterFileName ?? "");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [lastImportName, setLastImportName] = useState("");
  const [persistence, setPersistence] = useState<{ status: PersistenceStatus; message: string }>({
    status: "idle",
    message: "Supabase save will run after CSV import when environment variables are configured."
  });
  const [query, setQuery] = useState("");

  const selectedCase = cases.find((item) => item.ticketNo === selectedTicket) ?? cases[0];
  const filteredCases = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return cases;
    }
    return cases.filter((item) => {
      const haystack = [
        item.ticketNo,
        item.larkSnapshot.storeCode,
        item.larkSnapshot.storeName,
        item.larkSnapshot.category,
        item.larkSnapshot.senior,
        item.larkSnapshot.supplier,
        item.larkSnapshot.status
      ].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [cases, query]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      return;
    }
    const activeClient = client;

    let cancelled = false;

    async function loadFromSupabase() {
      try {
        await ensureSupabaseSession(activeClient);
        const persistedCases = await loadPersistedCases(activeClient);
        if (cancelled || persistedCases.length === 0) {
          return;
        }

        setCases(persistedCases);
        setSelectedTicket(persistedCases[0].ticketNo);
        setPersistence({
          status: "saved",
          message: `Loaded ${persistedCases.length.toLocaleString()} cases from Supabase.`
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        setPersistence({
          status: "error",
          message: error instanceof Error ? error.message : "Could not load persisted cases from Supabase."
        });
      }
    }

    void loadFromSupabase();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCsvUpload(file: File) {
    const csvText = await file.text();
    const parsed = parseCsv(csvText);
    const result = syncLarkRows(cases, parsed.rows, parsed.invalidRows);
    const historyEntry = createImportHistoryEntry(file.name, result);
    const nextHistory = [historyEntry, ...importHistory].slice(0, 20);
    setCases(result.cases);
    setImportHistory(nextHistory);
    setImportResult(result);
    setLastImportName(file.name);
    saveLocalState(result.cases, nextHistory, priceMaster, priceMasterFileName);
    void persistImport(file.name, result, historyEntry.id, nextHistory);
    if (result.newCases[0]) {
      setSelectedTicket(result.newCases[0].ticketNo);
    } else if (result.updatedCases[0]) {
      setSelectedTicket(result.updatedCases[0].ticketNo);
    }
  }

  async function handlePriceMasterUpload(file: File) {
    try {
      const items = await readPriceMasterFile(file);
      setPriceMaster(items);
      setPriceMasterFileName(file.name);
      saveLocalState(cases, importHistory, items, file.name);
      setPersistence({
        status: "not_configured",
        message: `Imported ${items.length.toLocaleString()} price master rows locally.`
      });
    } catch (error) {
      setPersistence({
        status: "error",
        message: error instanceof Error ? `Could not import price master: ${error.message}` : "Could not import price master."
      });
    }
  }

  async function persistImport(
    fileName: string,
    result: ImportResult,
    historyEntryId: string,
    currentHistory: ImportHistoryEntry[]
  ) {
    const client = getSupabaseClient();
    if (!client) {
      setPersistence({
        status: "not_configured",
        message: "Local preview only. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to save import history."
      });
      return;
    }

    setPersistence({ status: "saving", message: "Saving ticket snapshots and import history to Supabase..." });

    try {
      await ensureSupabaseSession(client);
      const batchId = await saveImportResult(client, fileName, result);
      const syncedHistory = currentHistory.map((entry) => entry.id === historyEntryId
        ? { ...entry, id: batchId, storageStatus: "supabase" as const }
        : entry);
      setImportHistory(syncedHistory);
      saveLocalState(result.cases, syncedHistory, priceMaster, priceMasterFileName);
      setPersistence({ status: "saved", message: `Saved to Supabase import batch ${batchId}.` });
    } catch (error) {
      const failedHistory = currentHistory.map((entry) => entry.id === historyEntryId
        ? { ...entry, storageStatus: "error" as const }
        : entry);
      setImportHistory(failedHistory);
      saveLocalState(result.cases, failedHistory, priceMaster, priceMasterFileName);
      setPersistence({
        status: "error",
        message: error instanceof Error ? error.message : "Could not save import history to Supabase."
      });
    }
  }

  function handleDocumentStatusChange(documentKey: DocumentKey, status: DocumentStatus) {
    if (!selectedCase) {
      return;
    }

    const nextCases = updateDocumentStatus(cases, selectedCase.ticketNo, documentKey, status);
    setCases(nextCases);
    saveLocalState(nextCases, importHistory, priceMaster, priceMasterFileName);
    setPersistence({
      status: "not_configured",
      message: `Saved ${selectedCase.ticketNo} ${documentKey} status locally.`
    });
  }

  function handleAmountCheckChange(status: AmountCheckStatus) {
    if (!selectedCase) {
      return;
    }

    const nextCases = updateAmountCheck(cases, selectedCase.ticketNo, status);
    setCases(nextCases);
    saveLocalState(nextCases, importHistory, priceMaster, priceMasterFileName);
    setPersistence({
      status: "not_configured",
      message: `Saved ${selectedCase.ticketNo} amount validation status locally.`
    });
  }

  function handleAddCaseNote(note: string) {
    if (!selectedCase) {
      return;
    }

    const nextCases = addCaseNote(cases, selectedCase.ticketNo, note);
    if (nextCases === cases) {
      return;
    }

    setCases(nextCases);
    saveLocalState(nextCases, importHistory, priceMaster, priceMasterFileName);
    setPersistence({
      status: "not_configured",
      message: `Saved note for ${selectedCase.ticketNo} locally.`
    });
  }

  function handleAddPriceMasterItem(item: PriceMasterItem) {
    if (!selectedCase) {
      return;
    }

    const nextCases = addPriceMasterItemToCasePacket(cases, selectedCase.ticketNo, item);
    setCases(nextCases);
    saveLocalState(nextCases, importHistory, priceMaster, priceMasterFileName);
    setPersistence({
      status: "not_configured",
      message: `Added ${item.diyCode} to ${selectedCase.ticketNo} workspace locally.`
    });
  }

  function handlePacketQuantityChange(itemId: string, quantity: number) {
    if (!selectedCase) {
      return;
    }

    const nextCases = updateCasePacketItemQuantity(cases, selectedCase.ticketNo, itemId, quantity);
    setCases(nextCases);
    saveLocalState(nextCases, importHistory, priceMaster, priceMasterFileName);
    setPersistence({
      status: "not_configured",
      message: `Updated ${selectedCase.ticketNo} workspace quantity locally.`
    });
  }

  async function handleDocumentFileAttach(documentKey: DocumentKey, file: File) {
    if (!selectedCase) {
      return;
    }

    let nextCases = attachDocumentFile(cases, selectedCase.ticketNo, documentKey, {
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream"
    });

    let message = `Attached ${file.name} to ${selectedCase.ticketNo} locally.`;

    if (documentKey === "po") {
      try {
        const summary = await readPoFileSummary(file);
        const validation = validatePoSummary(getCaseDetail(selectedCase).beforeVatAmount, summary);
        nextCases = updateAmountCheck(nextCases, selectedCase.ticketNo, validation.status);
        nextCases = addCaseNote(nextCases, selectedCase.ticketNo, `PO validation: ${validation.message}`);
        message = `Attached PO and ${validation.status === "passed" ? "validated" : "flagged"}: ${validation.message}`;
      } catch (error) {
        nextCases = updateAmountCheck(nextCases, selectedCase.ticketNo, "warning");
        nextCases = addCaseNote(nextCases, selectedCase.ticketNo, "PO validation: Could not read PO Excel file.");
        message = error instanceof Error ? `Attached PO, but Excel validation failed: ${error.message}` : "Attached PO, but Excel validation failed.";
      }
    }

    if (documentKey === "quotation") {
      try {
        const summary = await readQuotationFileSummary(file);
        const validation = validateQuotationSummary(
          selectedCase.larkSnapshot.quotationNo,
          getCaseDetail(selectedCase).beforeVatAmount,
          summary
        );
        nextCases = updateAmountCheck(nextCases, selectedCase.ticketNo, validation.status);
        nextCases = addCaseNote(nextCases, selectedCase.ticketNo, `Quotation validation: ${validation.message}`);
        message = `Attached quotation and ${validation.status === "passed" ? "validated" : "flagged"}: ${validation.message}`;
      } catch (error) {
        nextCases = updateAmountCheck(nextCases, selectedCase.ticketNo, "warning");
        nextCases = addCaseNote(nextCases, selectedCase.ticketNo, "Quotation validation: Could not read quotation Excel file.");
        message = error instanceof Error ? `Attached quotation, but Excel validation failed: ${error.message}` : "Attached quotation, but Excel validation failed.";
      }
    }

    setCases(nextCases);
    saveLocalState(nextCases, importHistory, priceMaster, priceMasterFileName);
    setPersistence({
      status: "not_configured",
      message
    });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">M</div>
          <div>
            <strong>Maintenance Control</strong>
            <span>MR.D.I.Y. Thailand</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary">
          <a className="nav-item active" href="#cases"><ClipboardCheck size={18} /> Cases</a>
          <a className="nav-item" href="#documents"><FileText size={18} /> Documents</a>
          <a className="nav-item" href="#prices"><Database size={18} /> Price Master</a>
          <a className="nav-item" href="#archive"><Archive size={18} /> Archive</a>
          <a className="nav-item" href="#history"><History size={18} /> Import History</a>
        </nav>

        <div className="source-box">
          <span>Lark source</span>
          <strong>MTD Table CSV</strong>
          <small>Snapshot update only. App document work is preserved.</small>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <h1>Maintenance Case Workbench</h1>
            <p>Lark Ticket to Job Detail, Quotation, PO, Invoice and archive control.</p>
          </div>
          <label className="upload-button">
            <Upload size={18} />
            Import Lark CSV
            <input
              accept=".csv,text/csv"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleCsvUpload(file);
                }
                event.target.value = "";
              }}
            />
          </label>
        </header>

        <section className="import-strip" aria-label="Import status">
          <Metric label="New" value={importResult?.newCases.length ?? 0} tone="green" />
          <Metric label="Updated" value={importResult?.updatedCases.length ?? 0} tone="blue" />
          <Metric label="Unchanged" value={importResult?.unchangedCases.length ?? cases.length} tone="gray" />
          <Metric label="Conflicts" value={importResult?.conflicts.length ?? 0} tone="amber" />
          <Metric label="Invalid rows" value={importResult?.invalidRows.length ?? 0} tone="red" />
        </section>

        <section className="import-summary" aria-label="Lark CSV compatibility">
          <div>
            <strong>{importResult ? "Lark CSV imported" : "Ready for Lark MTD Table CSV"}</strong>
            <span>
              {importResult
                ? `${lastImportName} read ${getImportedRowCount(importResult).toLocaleString()} ticket rows.`
                : "Supports exported headers: Ticket No., Store Code-Name, Store Code, Store Full Name, Quotation number and PO."}
            </span>
          </div>
          <FileSpreadsheet size={22} />
        </section>

        <section className={`persistence-banner persistence-${persistence.status}`} aria-label="Database save status">
          <Database size={18} />
          <span>{persistence.message}</span>
        </section>

        <section className="price-master-panel" id="prices">
          <div className="section-head">
            <div>
              <h2>Price Master</h2>
              <span>{priceMaster.length.toLocaleString()} standard price rows loaded{priceMasterFileName ? ` from ${priceMasterFileName}` : ""}</span>
            </div>
            <label className="secondary-upload">
              <FileSpreadsheet size={16} />
              Import Price Master
              <input
                accept=".xlsx,.xls"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handlePriceMasterUpload(file);
                  }
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="price-preview">
            {priceMaster.length > 0 ? priceMaster.slice(0, 5).map((item) => (
              <div className="price-row" key={`${item.sourceSheet}-${item.diyCode}-${item.description}`}>
                <strong>{item.diyCode}</strong>
                <span>{item.description}</span>
                <em>{item.totalPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</em>
              </div>
            )) : (
              <p className="muted history-empty">Import the 2026 standard price file to prepare quotation price matching.</p>
            )}
          </div>
        </section>

        <div className="content-grid">
          <section className="case-list" id="cases">
            <div className="section-head">
              <div>
                <h2>Case Queue</h2>
                <span>{filteredCases.length} active cases</span>
              </div>
              <div className="search-box">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search ticket, store, supplier"
                />
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Store</th>
                    <th>Category</th>
                    <th>Senior</th>
                    <th>Supplier</th>
                    <th>Documents</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.map((item) => (
                    <tr
                      key={item.ticketNo}
                      className={item.ticketNo === selectedCase.ticketNo ? "selected-row" : ""}
                      onClick={() => setSelectedTicket(item.ticketNo)}
                    >
                      <td><strong>{item.ticketNo}</strong></td>
                      <td>{item.larkSnapshot.storeCode} <span>{item.larkSnapshot.storeName}</span></td>
                      <td>{item.larkSnapshot.category || "-"}</td>
                      <td>{item.larkSnapshot.senior || "-"}</td>
                      <td>{item.larkSnapshot.supplier || "Unassigned"}</td>
                      <td><DocumentProgress item={item} /></td>
                      <td><AmountBadge value={item.appWork.amountCheck} /></td>
                      <td><StatusPill value={item.larkSnapshot.status || "Open"} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {selectedCase ? (
            <CasePanel
              item={selectedCase}
              importResult={importResult}
              onDocumentStatusChange={handleDocumentStatusChange}
              onAmountCheckChange={handleAmountCheckChange}
              onAddCaseNote={handleAddCaseNote}
              onDocumentFileAttach={handleDocumentFileAttach}
              priceMaster={priceMaster}
              onAddPriceMasterItem={handleAddPriceMasterItem}
              onPacketQuantityChange={handlePacketQuantityChange}
            />
          ) : null}
        </div>

        <section className="history-panel" id="history">
          <div className="section-head">
            <div>
              <h2>Import History</h2>
              <span>{importHistory.length} recent imports saved in this browser</span>
            </div>
          </div>
          <div className="history-list">
            {importHistory.length > 0 ? importHistory.map((entry) => (
              <div className="history-row" key={`${entry.id}-${entry.importedAt}`}>
                <div>
                  <strong>{entry.fileName}</strong>
                  <span>{formatDateTime(entry.importedAt)}</span>
                </div>
                <HistoryMetric label="Rows" value={entry.totalRows} />
                <HistoryMetric label="New" value={entry.newCount} />
                <HistoryMetric label="Updated" value={entry.updatedCount} />
                <HistoryMetric label="Conflicts" value={entry.conflictCount} />
                <HistoryMetric label="Invalid" value={entry.invalidCount} />
                <span className={`storage-pill storage-${entry.storageStatus}`}>{entry.storageStatus}</span>
              </div>
            )) : (
              <p className="muted history-empty">No CSV import has been saved yet.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function getInitialBrowserState() {
  if (typeof window === "undefined") {
    return null;
  }
  return loadBrowserState(window.localStorage);
}

function saveLocalState(
  cases: MaintenanceCase[],
  importHistory: ImportHistoryEntry[],
  priceMaster: PriceMasterItem[] = [],
  priceMasterFileName = ""
): void {
  if (typeof window === "undefined") {
    return;
  }
  saveBrowserState(window.localStorage, { cases, importHistory, priceMaster, priceMasterFileName });
}

function getImportedRowCount(result: ImportResult): number {
  return result.newCases.length
    + result.updatedCases.length
    + result.unchangedCases.length
    + result.invalidRows.length;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "green" | "blue" | "gray" | "amber" | "red" }) {
  return (
    <div className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HistoryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="history-metric">
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </div>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function CasePanel({
  item,
  importResult,
  onDocumentStatusChange,
  onAmountCheckChange,
  onAddCaseNote,
  onDocumentFileAttach,
  priceMaster,
  onAddPriceMasterItem,
  onPacketQuantityChange
}: {
  item: MaintenanceCase;
  importResult: ImportResult | null;
  onDocumentStatusChange: (documentKey: DocumentKey, status: DocumentStatus) => void;
  onAmountCheckChange: (status: AmountCheckStatus) => void;
  onAddCaseNote: (note: string) => void;
  onDocumentFileAttach: (documentKey: DocumentKey, file: File) => void;
  priceMaster: PriceMasterItem[];
  onAddPriceMasterItem: (item: PriceMasterItem) => void;
  onPacketQuantityChange: (itemId: string, quantity: number) => void;
}) {
  const conflicts = importResult?.conflicts.filter((conflict) => conflict.ticketNo === item.ticketNo) ?? [];
  const changes = importResult?.changes.filter((change) => change.ticketNo === item.ticketNo) ?? [];
  const detail = getCaseDetail(item);
  const packet = getCasePacket(item.appWork);

  return (
    <aside className="case-panel">
      <div className="panel-title">
        <div>
          <span>Selected Case</span>
          <h2>{item.ticketNo}</h2>
        </div>
        <ChevronRight size={20} />
      </div>

      <dl className="case-facts">
        <div><dt>Store</dt><dd>{item.larkSnapshot.storeCode} {item.larkSnapshot.storeName}</dd></div>
        <div><dt>Supplier</dt><dd>{item.larkSnapshot.supplier || "Unassigned"}</dd></div>
        <div><dt>Quotation</dt><dd>{item.larkSnapshot.quotationNo || "Waiting"}</dd></div>
        <div><dt>PO</dt><dd>{item.larkSnapshot.poNo || "Not created"}</dd></div>
      </dl>

      <section className="panel-section">
        <h3>Lark Ticket Detail</h3>
        <div className="detail-stack">
          <DetailBlock label="Branch request" value={detail.branchRequest} large />
          <DetailBlock label="Maintenance scope" value={detail.maintenanceScope} large />
          <div className="detail-grid">
            <DetailBlock label="Sup category" value={detail.supplierCategory} />
            <DetailBlock label="Rank" value={detail.rank} />
            <DetailBlock label="Job done by" value={detail.jobDoneBy} />
            <DetailBlock label="Contractor status" value={detail.contractorStatus} />
            <DetailBlock label="SLA days" value={detail.slaDays} />
            <DetailBlock label="Plan date" value={detail.plannedAt} />
            <DetailBlock label="Due date" value={detail.dueAt} />
            <DetailBlock label="Finish date" value={detail.finishedAt} />
            <DetailBlock label="Phone" value={detail.phoneNumber} />
            <DetailBlock label="PO status" value={detail.poStatus} />
            <DetailBlock label="Before VAT" value={formatAmount(detail.beforeVatAmount)} />
            <DetailBlock label="Map" value={detail.mapUrl} href={detail.mapUrl} />
          </div>
        </div>
      </section>

      <section className="panel-section" id="documents">
        <h3>Document Workspace</h3>
        <DocumentWorkspace
          packet={packet}
          priceMaster={priceMaster}
          onAddPriceMasterItem={onAddPriceMasterItem}
          onQuantityChange={onPacketQuantityChange}
        />
      </section>

      <section className="panel-section">
        <h3>Legacy File Check</h3>
        <div className="checklist">
          {documentLabels.map(({ key, label }) => (
            <ChecklistRow
              key={key}
              documentKey={key}
              label={label}
              status={item.appWork[key]}
              files={item.appWork.documents?.[key] ?? []}
              onChange={onDocumentStatusChange}
              onFileAttach={onDocumentFileAttach}
            />
          ))}
        </div>
      </section>

      <section className="panel-section">
        <h3>Validation</h3>
        <label className="validation-control">
          <span>Amount validation</span>
          <select
            aria-label="Amount validation status"
            value={item.appWork.amountCheck}
            onChange={(event) => onAmountCheckChange(event.target.value as AmountCheckStatus)}
          >
            {amountCheckOptions.map((option) => (
              <option key={option} value={option}>{option.replace("_", " ")}</option>
            ))}
          </select>
        </label>
        <div className="validation-stack">
          <ValidationItem label="Quotation total" status={item.appWork.amountCheck === "blocked" ? "blocked" : item.appWork.amountCheck === "passed" ? "passed" : "review"} />
          <ValidationItem label="VAT 7%" status={item.appWork.amountCheck === "blocked" ? "blocked" : "passed"} />
          <ValidationItem label="Price master match" status={item.appWork.amountCheck === "blocked" ? "blocked" : item.appWork.amountCheck === "warning" ? "review" : "passed"} />
        </div>
      </section>

      <CaseNotes notes={item.appWork.notes} onAddCaseNote={onAddCaseNote} />

      <section className="panel-section">
        <h3>Latest CSV Changes</h3>
        {conflicts.length > 0 ? (
          <div className="alert-list">
            {conflicts.map((conflict) => (
              <div className="alert-row" key={conflict.reason}><AlertTriangle size={16} /> {conflict.reason}</div>
            ))}
          </div>
        ) : changes.length > 0 ? (
          <div className="change-list">
            {changes.slice(0, 4).map((change) => (
              <div key={`${change.field}-${change.after}`}>
                <strong>{change.field}</strong>
                <span>{change.before || "-"} to {change.after || "-"}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No changes from the latest import.</p>
        )}
      </section>
    </aside>
  );
}

function DocumentWorkspace({
  packet,
  priceMaster,
  onAddPriceMasterItem,
  onQuantityChange
}: {
  packet: CasePacket;
  priceMaster: PriceMasterItem[];
  onAddPriceMasterItem: (item: PriceMasterItem) => void;
  onQuantityChange: (itemId: string, quantity: number) => void;
}) {
  const selectableItems = priceMaster.slice(0, 80);

  return (
    <div className="workspace-panel">
      <div className="workspace-actions">
        <select
          aria-label="Add price master item"
          defaultValue=""
          disabled={priceMaster.length === 0}
          onChange={(event) => {
            const selected = priceMaster.find((item) => getPriceMasterOptionValue(item) === event.target.value);
            if (selected) {
              onAddPriceMasterItem(selected);
              event.target.value = "";
            }
          }}
        >
          <option value="">{priceMaster.length > 0 ? "Add work item from Price Master" : "Import Price Master first"}</option>
          {selectableItems.map((item) => (
            <option key={getPriceMasterOptionValue(item)} value={getPriceMasterOptionValue(item)}>
              {item.diyCode} - {item.description}
            </option>
          ))}
        </select>
      </div>

      <div className="packet-table">
        {packet.items.length > 0 ? packet.items.map((item) => (
          <div className="packet-row" key={item.id}>
            <strong>{item.priceMasterCode ?? "Manual"}</strong>
            <span>{item.description}</span>
            <input
              aria-label={`Quantity for ${item.description}`}
              min="0"
              step="0.01"
              type="number"
              value={item.quantity}
              onChange={(event) => onQuantityChange(item.id, Number(event.target.value))}
            />
            <em>{item.lineTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</em>
          </div>
        )) : (
          <p className="muted history-empty">Add work items from Price Master to build Job Detail, Quotation and PO from the same data.</p>
        )}
      </div>

      <div className="packet-total">
        <span>Subtotal {packet.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        <span>VAT {packet.vat.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        <strong>Total {packet.grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
      </div>
    </div>
  );
}

function getPriceMasterOptionValue(item: PriceMasterItem): string {
  return `${item.sourceSheet}-${item.diyCode}-${item.description}`;
}

function DetailBlock({
  label,
  value,
  href,
  large = false
}: {
  label: string;
  value: string;
  href?: string;
  large?: boolean;
}) {
  const displayValue = value || "-";
  return (
    <div className={large ? "detail-block detail-block-large" : "detail-block"}>
      <span>{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">{displayValue}</a>
      ) : (
        <strong>{displayValue}</strong>
      )}
    </div>
  );
}

function formatAmount(value: string): string {
  const amount = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(amount) || !value) {
    return value;
  }
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ChecklistRow({
  documentKey,
  label,
  status,
  files,
  onChange,
  onFileAttach
}: {
  documentKey: DocumentKey;
  label: string;
  status: DocumentStatus;
  files: NonNullable<MaintenanceCase["appWork"]["documents"][DocumentKey]>;
  onChange: (documentKey: DocumentKey, status: DocumentStatus) => void;
  onFileAttach: (documentKey: DocumentKey, file: File) => void;
}) {
  const done = status === "validated" || status === "approved";
  return (
    <div className="check-row">
      <div className="check-main">
        {done ? <CheckCircle2 size={18} /> : status === "missing" ? <XCircle size={18} /> : <FileCheck2 size={18} />}
        <span>{label}</span>
        <select
          aria-label={`${label} status`}
          value={status}
          onChange={(event) => onChange(documentKey, event.target.value as DocumentStatus)}
        >
          {documentStatusOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
      <div className="file-row">
        <label className="file-attach">
          Attach
          <input
            aria-label={`Attach ${label} file`}
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onFileAttach(documentKey, file);
              }
              event.target.value = "";
            }}
          />
        </label>
        <span>{files[0] ? `${files[0].name} (${formatFileSize(files[0].size)})` : "No file attached"}</span>
      </div>
    </div>
  );
}

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function ValidationItem({ label, status }: { label: string; status: "passed" | "review" | "blocked" }) {
  const Icon = status === "passed" ? CheckCircle2 : status === "blocked" ? XCircle : AlertTriangle;
  return (
    <div className={`validation-item validation-${status}`}>
      <Icon size={18} />
      <span>{label}</span>
      <strong>{status}</strong>
    </div>
  );
}

function CaseNotes({
  notes,
  onAddCaseNote
}: {
  notes: string[];
  onAddCaseNote: (note: string) => void;
}) {
  const [draft, setDraft] = useState("");

  function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextNote = draft.trim();
    if (!nextNote) {
      return;
    }
    onAddCaseNote(nextNote);
    setDraft("");
  }

  return (
    <section className="panel-section">
      <h3>Case Notes</h3>
      <form className="note-form" onSubmit={submitNote}>
        <input
          aria-label="New case note"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add follow-up note"
        />
        <button type="submit">Add</button>
      </form>
      <div className="note-list">
        {notes.length > 0 ? notes.map((note, index) => (
          <div className="note-row" key={`${note}-${index}`}>{note}</div>
        )) : (
          <p className="muted">No notes yet.</p>
        )}
      </div>
    </section>
  );
}

function DocumentProgress({ item }: { item: MaintenanceCase }) {
  const values = documentLabels.map(({ key }) => item.appWork[key]);
  const complete = values.filter((status) => status === "validated" || status === "approved").length;
  return (
    <div className="progress-cell">
      <div className="progress-track"><span style={{ width: `${(complete / values.length) * 100}%` }} /></div>
      <small>{complete}/{values.length}</small>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  return <span className="status-pill">{value}</span>;
}

function AmountBadge({ value }: { value: MaintenanceCase["appWork"]["amountCheck"] }) {
  const label = value.replace("_", " ");
  return <span className={`amount-badge amount-${value}`}>{label}</span>;
}
