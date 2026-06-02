import {
  CalendarDays,
  Database,
  FileSpreadsheet,
  FileText,
  Printer,
  Search,
  Upload
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getCasePacket, searchPriceMasterItems } from "./domain/casePacket";
import { getCaseDetail } from "./domain/caseDetail";
import { updateCasePacketItemQuantity } from "./domain/caseWorkflow";
import { parseCsv, syncLarkRows } from "./domain/csvImport";
import { createImportHistoryEntry } from "./domain/importHistory";
import type { CasePacket, CasePacketItem, ImportHistoryEntry, MaintenanceCase, PriceMasterItem } from "./domain/types";
import { loadBrowserState, saveBrowserState } from "./lib/browserPersistence";
import { readPriceMasterFile } from "./lib/priceMasterFileReader";
import { sampleCases } from "./domain/sampleData";
import cnqcLogo from "./assets/cnqc-logo.png";
import mrDiyLogo from "./assets/mr-diy-always-low-prices-logo.png";

type ActiveDocument = "jobDetail" | "quotation" | "po";

const documentTabs: Array<{ key: ActiveDocument; label: string }> = [
  { key: "jobDetail", label: "Job Detail" },
  { key: "quotation", label: "Quotation" },
  { key: "po", label: "PO" }
];

export default function App() {
  const initialBrowserState = getInitialBrowserState();
  const initialCases = initialBrowserState?.cases.length ? initialBrowserState.cases : sampleCases;
  const [cases, setCases] = useState<MaintenanceCase[]>(initialCases);
  const [selectedTicket, setSelectedTicket] = useState(initialCases[0]?.ticketNo ?? "");
  const [jobDetailTicketNos, setJobDetailTicketNos] = useState<string[]>(initialCases[0]?.ticketNo ? [initialCases[0].ticketNo] : []);
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>(initialBrowserState?.importHistory ?? []);
  const [priceMaster, setPriceMaster] = useState<PriceMasterItem[]>(initialBrowserState?.priceMaster ?? []);
  const [priceMasterFileName, setPriceMasterFileName] = useState(initialBrowserState?.priceMasterFileName ?? "");
  const [ticketQuery, setTicketQuery] = useState(initialCases[0]?.ticketNo ?? "");
  const [priceQuery, setPriceQuery] = useState("");
  const [activeDocument, setActiveDocument] = useState<ActiveDocument>("jobDetail");
  const [quotationNo, setQuotationNo] = useState("");
  const [poNo, setPoNo] = useState("");
  const [documentDate, setDocumentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualItems, setManualItems] = useState<PrintableItem[]>([]);
  const [removedJobDetailRowIds, setRemovedJobDetailRowIds] = useState<string[]>([]);
  const [priceTargetTicketNo, setPriceTargetTicketNo] = useState(initialCases[0]?.ticketNo ?? "");

  const selectedCase = cases.find((item) => item.ticketNo === selectedTicket) ?? cases[0];
  const jobDetailCases = useMemo(() => {
    const orderedTicketNos = [selectedTicket, ...jobDetailTicketNos.filter((ticketNo) => ticketNo !== selectedTicket)];
    return orderedTicketNos
      .map((ticketNo) => cases.find((item) => item.ticketNo === ticketNo))
      .filter((item): item is MaintenanceCase => Boolean(item));
  }, [cases, jobDetailTicketNos, selectedTicket]);
  const selectedDetail = selectedCase ? getCaseDetail(selectedCase) : null;
  const packet = selectedCase ? getCasePacket(selectedCase.appWork) : null;
  const printableItems = useMemo(() => [
    ...buildPrintableItems(selectedCase, packet?.items ?? []),
    ...manualItems
  ], [manualItems, packet, selectedCase]);
  const subtotal = printableItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const vat = roundMoney(subtotal * 0.07);
  const grandTotal = roundMoney(subtotal + vat);

  const matchingTickets = useMemo(() => {
    const needle = ticketQuery.trim().toLowerCase();
    if (!needle) {
      return cases.slice(0, 8);
    }
    return cases.filter((item) => {
      const haystack = [
        item.ticketNo,
        item.larkSnapshot.storeCode,
        item.larkSnapshot.storeName,
        item.larkSnapshot.category,
        item.larkSnapshot.supplier,
        item.larkSnapshot.quotationNo,
        item.larkSnapshot.poNo
      ].join(" ").toLowerCase();
      return haystack.includes(needle);
    }).slice(0, 8);
  }, [cases, ticketQuery]);

  const priceMatches = useMemo(() => searchPriceMasterItems(priceMaster, priceQuery, 8), [priceMaster, priceQuery]);

  useEffect(() => {
    if (!selectedCase) {
      return;
    }
    setQuotationNo(selectedCase.larkSnapshot.quotationNo || "CNQC-2026-QT-DRAFT");
    setPoNo(selectedCase.larkSnapshot.poNo || "POM-DRAFT");
  }, [selectedCase?.ticketNo]);

  async function handleCsvUpload(file: File) {
    const csvText = await file.text();
    const parsed = parseCsv(csvText);
    const result = syncLarkRows(cases, parsed.rows, parsed.invalidRows);
    const historyEntry = createImportHistoryEntry(file.name, result);
    const nextHistory = [historyEntry, ...importHistory].slice(0, 20);
    setCases(result.cases);
    setImportHistory(nextHistory);
    saveLocalState(result.cases, nextHistory, priceMaster, priceMasterFileName);
    const nextTicket = result.newCases[0]?.ticketNo ?? result.updatedCases[0]?.ticketNo ?? result.cases[0]?.ticketNo ?? "";
    setSelectedTicket(nextTicket);
    setJobDetailTicketNos(nextTicket ? [nextTicket] : []);
    setTicketQuery(nextTicket);
  }

  async function handlePriceMasterUpload(file: File) {
    const items = await readPriceMasterFile(file);
    setPriceMaster(items);
    setPriceMasterFileName(file.name);
    saveLocalState(cases, importHistory, items, file.name);
  }

  function handleSelectTicket(ticketNo: string) {
    setSelectedTicket(ticketNo);
    setJobDetailTicketNos([ticketNo]);
    setTicketQuery(ticketNo);
    setManualItems([]);
    setRemovedJobDetailRowIds([]);
    setPriceTargetTicketNo(ticketNo);
  }

  function handleAddJobDetailTicket(ticketNo: string) {
    setJobDetailTicketNos((current) => current.includes(ticketNo) ? current : [...current, ticketNo]);
    setPriceTargetTicketNo(ticketNo);
  }

  function handleRemoveJobDetailTicket(ticketNo: string) {
    if (ticketNo === selectedTicket) {
      return;
    }
    setJobDetailTicketNos((current) => current.filter((item) => item !== ticketNo));
    setRemovedJobDetailRowIds((current) => current.filter((rowId) => !rowId.startsWith(`${ticketNo}::`)));
    if (priceTargetTicketNo === ticketNo) {
      setPriceTargetTicketNo(selectedTicket);
    }
  }

  function handleAddPriceItem(item: PriceMasterItem) {
    const targetTicketNo = priceTargetTicketNo || selectedTicket;
    setManualItems((current) => [
      ...current,
      {
        id: `price-${targetTicketNo}-${Date.now()}-${current.length + 1}`,
        ticketNo: targetTicketNo,
        description: item.description,
        quantity: item.quantity || 1,
        unit: item.unit || "job",
        unitPrice: item.totalPrice,
        lineTotal: roundMoney((item.quantity || 1) * item.totalPrice),
        isPacketItem: true,
        source: "price"
      }
    ]);
    setPriceQuery("");
  }

  function handleQuantityChange(itemId: string, quantity: number) {
    if (!selectedCase) {
      return;
    }
    if (manualItems.some((item) => item.id === itemId)) {
      setManualItems((current) => current.map((item) => item.id === itemId
        ? { ...item, quantity, lineTotal: roundMoney(quantity * item.unitPrice) }
        : item));
      return;
    }
    const nextCases = updateCasePacketItemQuantity(cases, selectedCase.ticketNo, itemId, quantity);
    setCases(nextCases);
    saveLocalState(nextCases, importHistory, priceMaster, priceMasterFileName);
  }

  function handleRemoveItem(itemId: string) {
    if (itemId === "draft-ticket-line" || !selectedCase) {
      return;
    }
    if (manualItems.some((item) => item.id === itemId)) {
      setManualItems((current) => current.filter((item) => item.id !== itemId));
      setRemovedJobDetailRowIds((current) => current.filter((rowId) => !rowId.endsWith(`::${itemId}`)));
      return;
    }

    const nextCases = cases.map((item) => {
      if (item.ticketNo !== selectedCase.ticketNo) {
        return item;
      }
      const currentPacket = getCasePacket(item.appWork);
      return {
        ...item,
        updatedAt: new Date().toISOString(),
        appWork: {
          ...item.appWork,
          casePacket: recalculateCasePacket({
            ...currentPacket,
            items: currentPacket.items.filter((packetItem) => packetItem.id !== itemId)
          })
        }
      };
    });
    setCases(nextCases);
    setRemovedJobDetailRowIds((current) => current.filter((rowId) => !rowId.endsWith(`::${itemId}`)));
    saveLocalState(nextCases, importHistory, priceMaster, priceMasterFileName);
  }

  function handleRemoveJobDetailRow(rowId: string) {
    setRemovedJobDetailRowIds((current) => current.includes(rowId) ? current : [...current, rowId]);
  }

  function handleAddManualItem(item: ManualItemDraft) {
    const safeQuantity = Math.max(0, item.quantity);
    const safeUnitPrice = Math.max(0, item.unitPrice);
    setManualItems((current) => [
      ...current,
      {
        id: `manual-${Date.now()}-${current.length + 1}`,
        description: item.description,
        quantity: safeQuantity,
        unit: item.unit || "job",
        unitPrice: safeUnitPrice,
        lineTotal: roundMoney(safeQuantity * safeUnitPrice),
        isPacketItem: true,
        source: "manual"
      }
    ]);
  }

  if (!selectedCase || !selectedDetail || !packet) {
    return <main className="empty-state">Import Lark CSV to start the workbook.</main>;
  }

  return (
    <main className="workbook-app">
      <aside className="workbook-tools" aria-label="Workbook controls">
        <div className="brand-block">
          <strong>MR.D.I.Y.</strong>
          <span>Maintenance Workbook</span>
        </div>

        <section className="tool-section">
          <label className="upload-button">
            <Upload size={17} />
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
          <label className="secondary-button">
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
          <span className="tool-note">{cases.length.toLocaleString()} tickets loaded</span>
        </section>

        <section className="tool-section">
          <div className="field-label">Ticket</div>
          <div className="search-input">
            <Search size={16} />
            <input value={ticketQuery} onChange={(event) => setTicketQuery(event.target.value)} placeholder="Type ticket no." />
          </div>
          <div className="ticket-picks">
            {matchingTickets.map((item) => (
              <div
                className={item.ticketNo === selectedCase.ticketNo ? "is-selected" : ""}
                key={item.ticketNo}
              >
                <button className="ticket-open" type="button" onClick={() => handleSelectTicket(item.ticketNo)}>
                  <strong>{item.ticketNo}</strong>
                  <span>{item.larkSnapshot.storeCode} {item.larkSnapshot.storeName || ""}</span>
                </button>
                <button
                  className="ticket-add"
                  disabled={jobDetailTicketNos.includes(item.ticketNo)}
                  type="button"
                  onClick={() => handleAddJobDetailTicket(item.ticketNo)}
                >
                  {jobDetailTicketNos.includes(item.ticketNo) ? "Added" : "Add"}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="tool-section">
          <div className="field-label">Job Detail Tickets</div>
          <div className="ticket-chips">
            {jobDetailCases.map((item) => (
              <button
                className={item.ticketNo === selectedTicket ? "is-locked" : ""}
                key={item.ticketNo}
                type="button"
                onClick={() => handleRemoveJobDetailTicket(item.ticketNo)}
                title={item.ticketNo === selectedTicket ? "Main ticket" : "Remove from Job Detail"}
              >
                {item.ticketNo}
              </button>
            ))}
          </div>
          <div className="ticket-picks compact">
            {matchingTickets
              .filter((item) => !jobDetailTicketNos.includes(item.ticketNo))
              .slice(0, 4)
              .map((item) => (
                <button key={`job-detail-${item.ticketNo}`} type="button" onClick={() => handleAddJobDetailTicket(item.ticketNo)}>
                  <strong>Add {item.ticketNo}</strong>
                  <span>{item.larkSnapshot.storeCode} {item.larkSnapshot.storeName || ""}</span>
                </button>
              ))}
          </div>
        </section>

        <section className="tool-section">
          <div className="field-label">Document Header</div>
          <label className="plain-field">
            <span>Quotation No.</span>
            <input value={quotationNo} onChange={(event) => setQuotationNo(event.target.value)} />
          </label>
          <label className="plain-field">
            <span>PO No.</span>
            <input value={poNo} onChange={(event) => setPoNo(event.target.value)} />
          </label>
          <label className="plain-field">
            <span>Date</span>
            <input type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
          </label>
        </section>

        <section className="tool-section price-tool">
          <div className="field-label">Price Master</div>
          <label className="plain-field">
            <span>Add to Ticket</span>
            <select value={priceTargetTicketNo || selectedTicket} onChange={(event) => setPriceTargetTicketNo(event.target.value)}>
              {jobDetailCases.map((item) => (
                <option key={item.ticketNo} value={item.ticketNo}>
                  {item.ticketNo} - {item.larkSnapshot.storeCode} {item.larkSnapshot.storeName || ""}
                </option>
              ))}
            </select>
          </label>
          <div className="search-input">
            <Search size={16} />
            <input
              disabled={priceMaster.length === 0}
              value={priceQuery}
              onChange={(event) => setPriceQuery(event.target.value)}
              placeholder={priceMaster.length ? "Search work item" : "Import price file first"}
            />
          </div>
          <div className="price-picks">
            {priceMatches.map((item) => (
              <button key={`${item.sourceSheet}-${item.diyCode}-${item.description}`} type="button" onClick={() => handleAddPriceItem(item)}>
                <strong>{item.diyCode}</strong>
                <span>{item.description}</span>
                <em>{formatMoney(item.totalPrice)}</em>
              </button>
            ))}
          </div>
          <span className="tool-note">{priceMaster.length.toLocaleString()} rows {priceMasterFileName ? `from ${priceMasterFileName}` : ""}</span>
        </section>
      </aside>

      <section className="workbook-stage">
        <header className="workbook-header">
          <div>
            <h1>Full Workbook</h1>
            <p>Ticket data, quotation lines and PO totals stay linked from the same workbook items.</p>
          </div>
          <button className="print-button" type="button" onClick={() => window.print()}>
            <Printer size={18} />
            Print
          </button>
        </header>

        <nav className="document-tabs" aria-label="Workbook documents">
          {documentTabs.map((tab) => (
            <button
              className={tab.key === activeDocument ? "is-active" : ""}
              key={tab.key}
              type="button"
              onClick={() => setActiveDocument(tab.key)}
            >
              <FileText size={16} />
              {tab.label}
            </button>
          ))}
        </nav>

        <section className="live-strip">
          <div><span>Ticket</span><strong>{jobDetailCases.length > 1 ? `${jobDetailCases.length} tickets` : selectedCase.ticketNo}</strong></div>
          <div><span>Store</span><strong>{selectedCase.larkSnapshot.storeCode} {selectedCase.larkSnapshot.storeName}</strong></div>
          <div><span>Supplier</span><strong>{selectedCase.larkSnapshot.supplier || "CNQC"}</strong></div>
          <div><span>QT Total</span><strong>{formatMoney(grandTotal)}</strong></div>
        </section>

        <section className="print-scroll">
          {activeDocument === "jobDetail" ? (
            <JobDetailSheet
              jobDetailCases={jobDetailCases}
              items={printableItems}
              removedRowIds={removedJobDetailRowIds}
              quotationNo={quotationNo}
              documentDate={documentDate}
              onQuantityChange={handleQuantityChange}
              onRemoveItem={handleRemoveItem}
              onRemoveRow={handleRemoveJobDetailRow}
              onAddManualItem={handleAddManualItem}
            />
          ) : null}
          {activeDocument === "quotation" ? (
            <QuotationSheet
              caseItem={selectedCase}
              jobDetailCases={jobDetailCases}
              items={printableItems}
              removedRowIds={removedJobDetailRowIds}
              quotationNo={quotationNo}
              poNo={poNo}
              documentDate={documentDate}
              subtotal={subtotal}
              vat={vat}
              grandTotal={grandTotal}
              onQuantityChange={handleQuantityChange}
              onRemoveItem={handleRemoveItem}
            />
          ) : null}
          {activeDocument === "po" ? (
            <PoSheet
              caseItem={selectedCase}
              detail={selectedDetail}
              items={printableItems}
              quotationNo={quotationNo}
              poNo={poNo}
              documentDate={documentDate}
              subtotal={subtotal}
              vat={vat}
              grandTotal={grandTotal}
              onQuantityChange={handleQuantityChange}
              onRemoveItem={handleRemoveItem}
            />
          ) : null}
        </section>
      </section>
    </main>
  );
}

function JobDetailSheet({
  jobDetailCases,
  items,
  removedRowIds,
  quotationNo,
  documentDate,
  onQuantityChange,
  onRemoveItem,
  onRemoveRow,
  onAddManualItem
}: {
  jobDetailCases: MaintenanceCase[];
  items: PrintableItem[];
  removedRowIds: string[];
  quotationNo: string;
  documentDate: string;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onRemoveRow: (rowId: string) => void;
  onAddManualItem: (item: ManualItemDraft) => void;
}) {
  const rows = jobDetailCases.flatMap((caseItem) => {
    const detail = getCaseDetail(caseItem);
    return items.filter((item) => !item.ticketNo || item.ticketNo === caseItem.ticketNo).map((item) => ({
      id: getDocumentRowId(caseItem.ticketNo, item.id),
      itemId: item.id,
      ticketNo: caseItem.ticketNo,
      code: `${caseItem.larkSnapshot.storeCode} ${caseItem.larkSnapshot.storeName || ""}`.trim(),
      openedAt: formatShortDate(caseItem.larkSnapshot.createdDate),
      request: item.source === "manual" ? item.description : detail.branchRequest || caseItem.larkSnapshot.category || "-",
      solution: item.source === "manual" ? "" : item.description,
      amount: item.lineTotal
    }));
  }).filter((row) => !removedRowIds.includes(row.id));

  return (
    <article className="sheet sheet-job">
      <div className="sheet-meta">MTD-2023-004 Rev.02 <span>วันที่ {formatThaiDate(documentDate)}</span></div>
      <h2>JOB DETAIL</h2>
      <div className="reference-line">เลขที่เอกสารอ้างอิง <strong>{quotationNo}</strong></div>
      <table className="print-table job-table">
        <thead>
          <tr>
            <th>ลำดับ</th>
            <th>Ticket</th>
            <th>CODE</th>
            <th>วันที่เปิด</th>
            <th>รายละเอียด</th>
            <th>แนวทางการแก้ไข</th>
            <th>ราคา</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id}>
              <td>{index + 1}</td>
              <td>{row.ticketNo}</td>
              <td>{row.code}</td>
              <td>{row.openedAt}</td>
              <td>{row.request}</td>
              <td>{row.solution}</td>
              <td className="money">{formatMoney(row.amount)}</td>
              <td className="no-print row-action-cell">
                <button type="button" onClick={() => onRemoveRow(row.id)}>RE</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ManualLineForm onAddManualItem={onAddManualItem} />
      <EditableLineItems items={items} onQuantityChange={onQuantityChange} onRemoveItem={onRemoveItem} />
      <SignatureRow labels={["Prepared by", "Checked by"]} />
    </article>
  );
}

function QuotationSheet({
  caseItem,
  jobDetailCases,
  items,
  removedRowIds,
  quotationNo,
  poNo,
  documentDate,
  subtotal,
  vat,
  grandTotal,
  onQuantityChange,
  onRemoveItem
}: {
  caseItem: MaintenanceCase;
  jobDetailCases: MaintenanceCase[];
  items: PrintableItem[];
  removedRowIds: string[];
  quotationNo: string;
  poNo: string;
  documentDate: string;
  subtotal: number;
  vat: number;
  grandTotal: number;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
}) {
  const rows = jobDetailCases.flatMap((jobCase) => items.filter((item) => !item.ticketNo || item.ticketNo === jobCase.ticketNo).map((item) => ({
    id: getDocumentRowId(jobCase.ticketNo, item.id),
    ticketNo: jobCase.ticketNo,
    store: `${jobCase.larkSnapshot.storeCode} ${jobCase.larkSnapshot.storeName || ""}`.trim(),
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal
  }))).filter((item) => !removedRowIds.includes(item.id));
  const quotationSubtotal = roundMoney(rows.reduce((sum, item) => sum + item.lineTotal, 0));
  const quotationVat = roundMoney(quotationSubtotal * 0.07);
  const quotationGrandTotal = roundMoney(quotationSubtotal + quotationVat);

  return (
    <article className="sheet sheet-quotation">
      <header className="supplier-head">
        <img src={cnqcLogo} alt="CNQC Qingjian" />
        <div>
          <strong>Qingjian International (Thailand) Co.,Ltd.</strong>
          <span>288/36 The Best Kingkeaw 19 Moo 12 Rachatewa Bangpri Samutprakan 10540</span>
          <span>Tel: +66 803620407 &nbsp; Tax ID: 0105559166757</span>
        </div>
      </header>
      <div className="quote-title">Quotation</div>
      <div className="quote-grid">
        <div><strong>ATTENTION:</strong> MR.D.I.Y. Maintenance Team</div>
        <div><strong>NO.:</strong> {quotationNo}</div>
        <div><strong>CUSTOMER NAME:</strong> MR.D.I.Y.(BANGKOK) COMPANY LIMITED. (Head office)</div>
        <div><strong>DATE:</strong> {formatSlashDate(documentDate)}</div>
        <div><strong>ADD.:</strong> 889,889/1 Moo 3, Phraeksa Mai, Samut Prakan 10280</div>
        <div><strong>PO NO.:</strong> {poNo}</div>
        <div><strong>TICKET:</strong> {jobDetailCases.map((item) => item.ticketNo).join(", ") || caseItem.ticketNo}</div>
      </div>
      <table className="print-table quotation-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>Ticket</th>
            <th>Branch</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Unit Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => (
            <tr key={item.id}>
              <td>{index + 1}</td>
              <td>{item.ticketNo}</td>
              <td>{item.store}</td>
              <td>{item.description}</td>
              <td>{item.quantity}</td>
              <td>{item.unit}</td>
              <td className="money">{formatMoney(item.unitPrice)}</td>
              <td className="money">{formatMoney(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <TotalsBox subtotal={quotationSubtotal || subtotal} vat={quotationSubtotal ? quotationVat : vat} grandTotal={quotationSubtotal ? quotationGrandTotal : grandTotal} />
      <EditableLineItems items={items} onQuantityChange={onQuantityChange} onRemoveItem={onRemoveItem} />
      <SignatureRow labels={["ผู้เสนอราคา", "Checked by", "Authorized signature"]} />
    </article>
  );
}

function PoSheet({
  caseItem,
  detail,
  items,
  quotationNo,
  poNo,
  documentDate,
  subtotal,
  vat,
  grandTotal,
  onQuantityChange,
  onRemoveItem
}: {
  caseItem: MaintenanceCase;
  detail: ReturnType<typeof getCaseDetail>;
  items: PrintableItem[];
  quotationNo: string;
  poNo: string;
  documentDate: string;
  subtotal: number;
  vat: number;
  grandTotal: number;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
}) {
  return (
    <article className="sheet sheet-po">
      <header className="po-head po-head-bank">
        <div className="logo-box logo-image-box">
          <img src={mrDiyLogo} alt="MR.D.I.Y. Always Low Prices" />
        </div>
        <div className="po-company">
          <strong>MR. D.I.Y. TRADING (THAILAND) CO., LTD.</strong>
          <span>889, 889/1 Moo 3, Praksamai, Muang Samutprakarn, Samutprakarn 10280</span>
          <span>Head Office (Co.No.: 0105558162511)</span>
        </div>
        <div className="po-title-box">
          <h2>ใบสั่งซื้อ</h2>
          <span>PURCHASE ORDER</span>
        </div>
      </header>
      <section className="po-bank-grid">
        <div className="po-field po-supplier"><strong>ผู้ขายสินค้า / Suppliers</strong><span>:</span><em>{caseItem.larkSnapshot.supplier || "CNQC"}</em></div>
        <div className="po-field"><strong>เลขที่/No.</strong><span>:</span><em>{poNo}</em></div>
        <div className="po-field po-supplier"><strong>สถานที่ส่งของ</strong><span>:</span><em>{caseItem.larkSnapshot.storeCode} {caseItem.larkSnapshot.storeName}</em></div>
        <div className="po-field"><strong>วันที่/Date</strong><span>:</span><em>{formatThaiDate(documentDate)}</em></div>
        <div className="po-field po-supplier"><strong>ที่อยู่</strong><span>:</span><em>{detail.mapUrl || "-"}</em></div>
        <div className="po-field"><strong>S/O</strong><span>:</span><em>Credit 30 days</em></div>
        <div className="po-field po-supplier"><strong>เบอร์โทร</strong><span>:</span><em>{detail.phoneNumber || "Maintenance Team"}</em></div>
        <div className="po-field"><strong>Budget</strong><span>:</span><em>Non Budget</em></div>
        <div className="po-field po-full"><strong>อ้างอิง QT / รายละเอียดงาน</strong><span>:</span><em>{quotationNo} / Ticket {caseItem.ticketNo} / {detail.branchRequest || caseItem.larkSnapshot.category || "-"}</em></div>
      </section>
      <table className="print-table po-table">
        <thead>
          <tr>
            <th>ลำดับ</th>
            <th>รายการ</th>
            <th>จำนวน</th>
            <th>หน่วย</th>
            <th>ราคาต่อหน่วย</th>
            <th>จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id}>
              <td>{index + 1}</td>
              <td>{item.description}</td>
              <td>{item.quantity}</td>
              <td>{item.unit}</td>
              <td className="money">{formatMoney(item.unitPrice)}</td>
              <td className="money">{formatMoney(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <TotalsBox subtotal={subtotal} vat={vat} grandTotal={grandTotal} />
      <EditableLineItems items={items} onQuantityChange={onQuantityChange} onRemoveItem={onRemoveItem} />
      <SignatureRow labels={["Create", "Check", "Approve"]} />
    </article>
  );
}

function EditableLineItems({
  items,
  onQuantityChange,
  onRemoveItem
}: {
  items: PrintableItem[];
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
}) {
  const editableItems = items.filter((item) => item.isPacketItem);
  if (editableItems.length === 0) {
    return <p className="sheet-hint">Add a price master item to make quantity editable across all three documents.</p>;
  }

  return (
    <div className="line-editor no-print">
      {editableItems.map((item) => (
        <label key={item.id}>
          <span>{item.description}</span>
          <input min="0" step="0.01" type="number" value={item.quantity} onChange={(event) => onQuantityChange(item.id, Number(event.target.value))} />
          <button type="button" onClick={() => onRemoveItem(item.id)}>Remove</button>
        </label>
      ))}
    </div>
  );
}

function TotalsBox({ subtotal, vat, grandTotal }: { subtotal: number; vat: number; grandTotal: number }) {
  return (
    <div className="totals-box">
      <div><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></div>
      <div><span>VAT 7%</span><strong>{formatMoney(vat)}</strong></div>
      <div><span>Grand Total</span><strong>{formatMoney(grandTotal)}</strong></div>
    </div>
  );
}

type ManualItemDraft = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

function ManualLineForm({ onAddManualItem }: { onAddManualItem: (item: ManualItemDraft) => void }) {
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("job");
  const [unitPrice, setUnitPrice] = useState(0);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextDescription = description.trim();
    if (!nextDescription) {
      return;
    }
    onAddManualItem({ description: nextDescription, quantity, unit, unitPrice });
    setDescription("");
    setQuantity(1);
    setUnit("job");
    setUnitPrice(0);
  }

  return (
    <form className="manual-line-form no-print" onSubmit={handleSubmit}>
      <strong>Add manual Job Detail item</strong>
      <input
        aria-label="Manual item description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="รายละเอียดงาน"
      />
      <input
        aria-label="Manual item quantity"
        min="0"
        step="0.01"
        type="number"
        value={quantity}
        onChange={(event) => setQuantity(Number(event.target.value))}
      />
      <input
        aria-label="Manual item unit"
        value={unit}
        onChange={(event) => setUnit(event.target.value)}
        placeholder="Unit"
      />
      <input
        aria-label="Manual item unit price"
        min="0"
        step="0.01"
        type="number"
        value={unitPrice}
        onChange={(event) => setUnitPrice(Number(event.target.value))}
      />
      <button type="submit">Add</button>
    </form>
  );
}

function SignatureRow({ labels }: { labels: string[] }) {
  return (
    <div className="signature-row" style={{ gridTemplateColumns: `repeat(${labels.length}, 1fr)` }}>
      {labels.map((label) => (
        <div key={label}>
          <span />
          <strong>{label}</strong>
        </div>
      ))}
    </div>
  );
}

type PrintableItem = {
  id: string;
  ticketNo?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  isPacketItem: boolean;
  source: "draft" | "packet" | "manual" | "price";
};

function buildPrintableItems(caseItem: MaintenanceCase | undefined, packetItems: CasePacketItem[]): PrintableItem[] {
  if (packetItems.length > 0) {
    return packetItems.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit || "job",
      unitPrice: item.materialUnitPrice + item.laborUnitPrice,
      lineTotal: item.lineTotal,
      isPacketItem: true,
      source: "packet"
    }));
  }

  const amount = caseItem ? parseMoney(getCaseDetail(caseItem).beforeVatAmount) : 0;
  return [{
    id: "draft-ticket-line",
    description: caseItem?.larkSnapshot.category || getCaseDetail(caseItem as MaintenanceCase).maintenanceScope || "Maintenance work from Lark ticket",
    quantity: 1,
    unit: "job",
    unitPrice: amount || 0,
    lineTotal: amount || 0,
    isPacketItem: false,
    source: "draft"
  }];
}

function recalculateCasePacket(packet: CasePacket): CasePacket {
  const items = packet.items.map((item) => ({
    ...item,
    lineTotal: roundMoney(item.quantity * (item.materialUnitPrice + item.laborUnitPrice))
  }));
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const vat = roundMoney(subtotal * 0.07);
  return {
    ...packet,
    items,
    subtotal,
    vat,
    grandTotal: roundMoney(subtotal + vat)
  };
}

function getDocumentRowId(ticketNo: string, itemId: string): string {
  return `${ticketNo}::${itemId}`;
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

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseMoney(value: string): number {
  const amount = Number(value.replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

function formatShortDate(value?: string): string {
  if (!value) {
    return "-";
  }
  return value.slice(0, 10);
}

function formatThaiDate(value: string): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(value));
}

function formatSlashDate(value: string): string {
  if (!value) {
    return "-";
  }
  return value.replaceAll("-", "/");
}
