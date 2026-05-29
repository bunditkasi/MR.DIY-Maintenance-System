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
import { useMemo, useState } from "react";
import { parseCsv, syncLarkRows } from "./domain/csvImport";
import { sampleCases } from "./domain/sampleData";
import type { AppWorkData, DocumentStatus, ImportResult, MaintenanceCase } from "./domain/types";

type DocumentKey = Extract<keyof AppWorkData, "jobDetail" | "quotation" | "po" | "invoice" | "archive">;

const documentLabels: Array<{ key: DocumentKey; label: string }> = [
  { key: "jobDetail", label: "Job Detail" },
  { key: "quotation", label: "Quotation" },
  { key: "po", label: "PO" },
  { key: "invoice", label: "Invoice" },
  { key: "archive", label: "Archive" }
];

export default function App() {
  const [cases, setCases] = useState<MaintenanceCase[]>(sampleCases);
  const [selectedTicket, setSelectedTicket] = useState(sampleCases[0]?.ticketNo ?? "");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [lastImportName, setLastImportName] = useState("");
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

  async function handleCsvUpload(file: File) {
    const csvText = await file.text();
    const parsed = parseCsv(csvText);
    const result = syncLarkRows(cases, parsed.rows, parsed.invalidRows);
    setCases(result.cases);
    setImportResult(result);
    setLastImportName(file.name);
    if (result.newCases[0]) {
      setSelectedTicket(result.newCases[0].ticketNo);
    } else if (result.updatedCases[0]) {
      setSelectedTicket(result.updatedCases[0].ticketNo);
    }
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

          {selectedCase ? <CasePanel item={selectedCase} importResult={importResult} /> : null}
        </div>
      </main>
    </div>
  );
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

function CasePanel({ item, importResult }: { item: MaintenanceCase; importResult: ImportResult | null }) {
  const conflicts = importResult?.conflicts.filter((conflict) => conflict.ticketNo === item.ticketNo) ?? [];
  const changes = importResult?.changes.filter((change) => change.ticketNo === item.ticketNo) ?? [];

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

      <section className="panel-section" id="documents">
        <h3>Document Checklist</h3>
        <div className="checklist">
          {documentLabels.map(({ key, label }) => (
            <ChecklistRow key={key} label={label} status={item.appWork[key]} />
          ))}
        </div>
      </section>

      <section className="panel-section">
        <h3>Validation</h3>
        <div className="validation-stack">
          <ValidationItem label="Quotation total" status={item.appWork.amountCheck === "passed" ? "passed" : "review"} />
          <ValidationItem label="VAT 7%" status={item.appWork.amountCheck === "blocked" ? "blocked" : "passed"} />
          <ValidationItem label="Price master match" status={item.appWork.amountCheck === "warning" ? "review" : "passed"} />
        </div>
      </section>

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

function ChecklistRow({ label, status }: { label: string; status: DocumentStatus }) {
  const done = status === "validated" || status === "approved";
  return (
    <div className="check-row">
      {done ? <CheckCircle2 size={18} /> : status === "missing" ? <XCircle size={18} /> : <FileCheck2 size={18} />}
      <span>{label}</span>
      <strong>{status}</strong>
    </div>
  );
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
