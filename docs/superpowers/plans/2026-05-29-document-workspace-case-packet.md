# Document Workspace Case Packet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable Case Packet workflow so one Lark ticket can hold shared work items for Job Detail, Quotation, and PO instead of relying on per-document file uploads.

**Architecture:** Add a small domain module for packet defaults, item creation, quantity updates, and totals. Persist packet data inside `MaintenanceCase.appWork` so CSV imports keep document work separate from Lark snapshots. Update the React document panel to show the new workspace first and move existing file attachment controls into a secondary legacy section.

**Tech Stack:** React + Vite + TypeScript + Vitest, existing browser local persistence, existing `PriceMasterItem` parser.

---

### Task 1: Case Packet Domain

**Files:**
- Modify: `src/domain/types.ts`
- Create: `src/domain/casePacket.test.ts`
- Create: `src/domain/casePacket.ts`

- [ ] **Step 1: Write the failing test**

Add tests that prove a packet can be defaulted, receive a price master item, update quantity, calculate totals, and flag manual items.

```ts
import { describe, expect, it } from "vitest";
import { addPacketItemFromPriceMaster, createEmptyCasePacket, getCasePacket, updatePacketItemQuantity } from "./casePacket";
import type { AppWorkData, PriceMasterItem } from "./types";

describe("case packet", () => {
  it("defaults old app work to an empty packet", () => {
    const appWork = makeAppWork();

    expect(getCasePacket(appWork)).toEqual(createEmptyCasePacket());
  });

  it("adds a price master item and calculates totals", () => {
    const item = makePriceMasterItem();
    const packet = addPacketItemFromPriceMaster(createEmptyCasePacket(), item);

    expect(packet.items).toHaveLength(1);
    expect(packet.items[0]).toMatchObject({
      priceMasterCode: "DIY 1.1",
      description: "Replace LP panel",
      quantity: 1,
      unit: "set",
      materialUnitPrice: 14414.4,
      laborUnitPrice: 3696,
      matchStatus: "matched"
    });
    expect(packet.subtotal).toBe(18110.4);
    expect(packet.vat).toBe(1267.73);
    expect(packet.grandTotal).toBe(19378.13);
  });

  it("updates quantity and recalculates line and packet totals", () => {
    const packet = addPacketItemFromPriceMaster(createEmptyCasePacket(), makePriceMasterItem());
    const updated = updatePacketItemQuantity(packet, packet.items[0].id, 2);

    expect(updated.items[0].quantity).toBe(2);
    expect(updated.items[0].lineTotal).toBe(36220.8);
    expect(updated.subtotal).toBe(36220.8);
    expect(updated.vat).toBe(2535.46);
    expect(updated.grandTotal).toBe(38756.26);
  });
});

function makeAppWork(): AppWorkData {
  return {
    jobDetail: "missing",
    quotation: "missing",
    po: "missing",
    invoice: "missing",
    archive: "missing",
    notes: [],
    documents: {},
    amountCheck: "not_started"
  };
}

function makePriceMasterItem(): PriceMasterItem {
  return {
    sourceSheet: "Maintin Price (2026)",
    itemCode: "1001",
    diyCode: "DIY 1.1",
    description: "Replace LP panel",
    quantity: 1,
    materialPrice: 14414.4,
    laborPrice: 3696,
    unit: "set",
    totalPrice: 18110.4
  };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/domain/casePacket.test.ts`

Expected: fail because `src/domain/casePacket.ts` does not exist.

- [ ] **Step 3: Add packet types**

Add these types to `src/domain/types.ts`.

```ts
export type PacketMatchStatus = "matched" | "manual" | "price_changed";

export type CasePacketItem = {
  id: string;
  priceMasterCode?: string;
  priceMasterSheet?: string;
  itemCode?: string;
  description: string;
  supplierDescription?: string;
  quantity: number;
  unit: string;
  materialUnitPrice: number;
  laborUnitPrice: number;
  lineTotal: number;
  matchStatus: PacketMatchStatus;
};

export type CasePacket = {
  supplier?: string;
  items: CasePacketItem[];
  subtotal: number;
  vat: number;
  grandTotal: number;
};
```

Add `casePacket?: CasePacket;` to `AppWorkData`.

- [ ] **Step 4: Implement minimal domain logic**

Create `src/domain/casePacket.ts`.

```ts
import type { AppWorkData, CasePacket, CasePacketItem, PriceMasterItem } from "./types";

const VAT_RATE = 0.07;

export function createEmptyCasePacket(): CasePacket {
  return { items: [], subtotal: 0, vat: 0, grandTotal: 0 };
}

export function getCasePacket(appWork: AppWorkData): CasePacket {
  return recalculatePacket(appWork.casePacket ?? createEmptyCasePacket());
}

export function addPacketItemFromPriceMaster(packet: CasePacket, priceItem: PriceMasterItem): CasePacket {
  return recalculatePacket({
    ...packet,
    items: [
      ...packet.items,
      {
        id: createPacketItemId(priceItem),
        priceMasterCode: priceItem.diyCode,
        priceMasterSheet: priceItem.sourceSheet,
        itemCode: priceItem.itemCode,
        description: priceItem.description,
        quantity: priceItem.quantity || 1,
        unit: priceItem.unit,
        materialUnitPrice: priceItem.materialPrice,
        laborUnitPrice: priceItem.laborPrice,
        lineTotal: 0,
        matchStatus: "matched"
      }
    ]
  });
}

export function updatePacketItemQuantity(packet: CasePacket, itemId: string, quantity: number): CasePacket {
  const safeQuantity = Math.max(0, quantity);
  return recalculatePacket({
    ...packet,
    items: packet.items.map((item) => item.id === itemId ? { ...item, quantity: safeQuantity } : item)
  });
}

function recalculatePacket(packet: CasePacket): CasePacket {
  const items = packet.items.map(recalculateItem);
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const vat = roundMoney(subtotal * VAT_RATE);
  return {
    ...packet,
    items,
    subtotal,
    vat,
    grandTotal: roundMoney(subtotal + vat)
  };
}

function recalculateItem(item: CasePacketItem): CasePacketItem {
  return {
    ...item,
    lineTotal: roundMoney(item.quantity * (item.materialUnitPrice + item.laborUnitPrice))
  };
}

function createPacketItemId(priceItem: PriceMasterItem): string {
  const key = `${priceItem.sourceSheet}-${priceItem.diyCode}-${priceItem.description}`;
  return `packet-${key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
```

- [ ] **Step 5: Run targeted test**

Run: `npm test -- --run src/domain/casePacket.test.ts`

Expected: pass.

### Task 2: Case Packet Workflow Updates

**Files:**
- Create: `src/domain/casePacketWorkflow.test.ts`
- Modify: `src/domain/caseWorkflow.ts`

- [ ] **Step 1: Write the failing test**

Add a test that updates one case packet without changing other cases.

```ts
import { describe, expect, it } from "vitest";
import { addPriceMasterItemToCasePacket, updateCasePacketItemQuantity } from "./caseWorkflow";
import type { MaintenanceCase, PriceMasterItem } from "./types";

describe("case packet workflow", () => {
  it("adds and edits packet items for the selected ticket only", () => {
    const cases = [makeCase("L0001"), makeCase("L0002")];
    const withItem = addPriceMasterItemToCasePacket(cases, "L0001", makePriceMasterItem());
    const itemId = withItem[0].appWork.casePacket?.items[0].id ?? "";
    const updated = updateCasePacketItemQuantity(withItem, "L0001", itemId, 3);

    expect(updated[0].appWork.casePacket?.items[0].quantity).toBe(3);
    expect(updated[0].appWork.casePacket?.subtotal).toBe(54331.2);
    expect(updated[1].appWork.casePacket).toBeUndefined();
  });
});

function makeCase(ticketNo: string): MaintenanceCase {
  return {
    id: `case-${ticketNo}`,
    ticketNo,
    updatedAt: "2026-05-29T12:00:00.000Z",
    larkSnapshot: { ticketNo, storeCode: "PTNC", raw: { "Ticket No.": ticketNo } },
    appWork: {
      jobDetail: "missing",
      quotation: "missing",
      po: "missing",
      invoice: "missing",
      archive: "missing",
      notes: [],
      documents: {},
      amountCheck: "not_started"
    }
  };
}

function makePriceMasterItem(): PriceMasterItem {
  return {
    sourceSheet: "Maintin Price (2026)",
    itemCode: "1001",
    diyCode: "DIY 1.1",
    description: "Replace LP panel",
    quantity: 1,
    materialPrice: 14414.4,
    laborPrice: 3696,
    unit: "set",
    totalPrice: 18110.4
  };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/domain/casePacketWorkflow.test.ts`

Expected: fail because workflow functions are missing.

- [ ] **Step 3: Implement workflow functions**

Add exports to `src/domain/caseWorkflow.ts`.

```ts
import { addPacketItemFromPriceMaster, getCasePacket, updatePacketItemQuantity } from "./casePacket";
import type { PriceMasterItem } from "./types";

export function addPriceMasterItemToCasePacket(
  cases: MaintenanceCase[],
  ticketNo: string,
  priceItem: PriceMasterItem
): MaintenanceCase[] {
  return cases.map((item) => item.ticketNo === ticketNo
    ? {
        ...item,
        appWork: {
          ...item.appWork,
          casePacket: addPacketItemFromPriceMaster(getCasePacket(item.appWork), priceItem)
        },
        updatedAt: new Date().toISOString()
      }
    : item);
}

export function updateCasePacketItemQuantity(
  cases: MaintenanceCase[],
  ticketNo: string,
  itemId: string,
  quantity: number
): MaintenanceCase[] {
  return cases.map((item) => item.ticketNo === ticketNo
    ? {
        ...item,
        appWork: {
          ...item.appWork,
          casePacket: updatePacketItemQuantity(getCasePacket(item.appWork), itemId, quantity)
        },
        updatedAt: new Date().toISOString()
      }
    : item);
}
```

- [ ] **Step 4: Run targeted workflow test**

Run: `npm test -- --run src/domain/casePacketWorkflow.test.ts`

Expected: pass.

### Task 3: Document Workspace UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add app handlers**

Import packet helpers and add handlers in `src/App.tsx`.

```ts
import { addPriceMasterItemToCasePacket, updateCasePacketItemQuantity } from "./domain/caseWorkflow";
import { getCasePacket } from "./domain/casePacket";
import type { CasePacketItem } from "./domain/types";

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
}
```

- [ ] **Step 2: Replace primary Documents content**

In the selected case panel, render `DocumentWorkspace` before the legacy document checklist.

```tsx
<DocumentWorkspace
  packet={getCasePacket(item.appWork)}
  priceMaster={priceMaster}
  onAddPriceMasterItem={onAddPriceMasterItem}
  onQuantityChange={onPacketQuantityChange}
/>
```

- [ ] **Step 3: Add the `DocumentWorkspace` component**

Create a component in `src/App.tsx` near the existing detail components.

```tsx
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
  const selectableItems = priceMaster.slice(0, 20);

  return (
    <div className="workspace-panel">
      <div className="workspace-actions">
        <select
          aria-label="Add price master item"
          defaultValue=""
          onChange={(event) => {
            const selected = priceMaster.find((item) => `${item.sourceSheet}-${item.diyCode}-${item.description}` === event.target.value);
            if (selected) {
              onAddPriceMasterItem(selected);
              event.target.value = "";
            }
          }}
        >
          <option value="">Add work item from Price Master</option>
          {selectableItems.map((item) => (
            <option key={`${item.sourceSheet}-${item.diyCode}-${item.description}`} value={`${item.sourceSheet}-${item.diyCode}-${item.description}`}>
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
```

- [ ] **Step 4: Make legacy upload secondary**

Change the existing document checklist heading to `Legacy File Check` and place it below the workspace. Keep existing attach controls intact.

- [ ] **Step 5: Add CSS**

Add styles in `src/styles.css` for `.workspace-panel`, `.workspace-actions`, `.packet-table`, `.packet-row`, and `.packet-total` using compact dashboard styling that matches the existing app.

### Task 4: Verification and Commit

**Files:**
- No new production files expected.

- [ ] **Step 1: Run tests**

Run: `npm test -- --run`

Expected: all tests pass.

- [ ] **Step 2: Build**

Run: `npm run build`

Expected: TypeScript and Vite build succeed.

- [ ] **Step 3: Run audit**

Run: `npm audit --omit=dev`

Expected: `found 0 vulnerabilities`.

- [ ] **Step 4: Commit**

```bash
git add src docs
git commit -m "feat: add case packet document workspace"
```

Expected: one commit containing tests, domain logic, UI, styles, and docs.

## Self-Review

Spec coverage: the plan covers packet data, document workspace UI, legacy file check separation, local persistence through existing case save paths, and verification.

Placeholder scan: no deferred implementation markers are present.

Type consistency: `CasePacket`, `CasePacketItem`, `PriceMasterItem`, and workflow function names are defined before use.
