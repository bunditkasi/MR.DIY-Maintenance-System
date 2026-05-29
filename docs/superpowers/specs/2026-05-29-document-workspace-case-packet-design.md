# Document Workspace and Case Packet Design

## Goal

Change the app from a file-checking helper into a document workspace that creates Job Detail, Quotation, and PO work from one shared maintenance case packet. File upload remains available only for legacy checking, not as the main workflow.

## Problem

The current app asks users to attach PO and Quotation files per case so the app can validate them. That is useful for old Excel/PDF documents, but it adds another manual step. The target workflow must reduce work: Lark remains the ticket source, then the app holds the commercial and document data needed to generate or validate documents from the same values.

## Design

Each `MaintenanceCase` gets a `casePacket` inside `appWork`. The packet stores repair line items selected from the imported Price Master, with quantity, unit price, labor price, total, supplier, and matching status. Job Detail, Quotation, and PO status should derive from the packet instead of relying on file attachment.

The Documents area becomes a Document Workspace. The main actions are:

- Add work item from Price Master
- Edit quantity and supplier-side description
- Review price match result
- Mark Job Detail, Quotation, or PO as drafted/ready/approved

The existing attach controls move into a Legacy File Check section. They continue to parse old PO and Quotation Excel files for comparison, but they are no longer presented as the normal path.

## Data Flow

1. User imports Lark CSV.
2. The app creates or updates `MaintenanceCase` snapshots while preserving `appWork`.
3. User imports the annual Price Master workbook.
4. In a selected case, user adds one or more packet items from Price Master.
5. The app calculates expected material, labor, line total, subtotal, VAT, and grand total.
6. Document status and validation warnings are shown from packet completeness and price match results.
7. Legacy files can be attached only when an old external document must be checked.

## Initial Scope

This phase builds the editable case packet and document workspace inside the current local app. It does not yet build a contractor portal, export final Excel/PDF templates, or write packet data to Supabase. Browser local persistence remains the storage layer for this phase, matching the current app behavior.

## Testing

Domain tests must cover:

- Creating an empty packet for existing cases without breaking older saved data
- Adding a Price Master item to a case packet
- Recalculating totals when quantity changes
- Flagging a packet item when no Price Master item is linked
- Keeping legacy file metadata separate from packet-generated document state

UI smoke verification should confirm:

- The Documents area presents Document Workspace first
- Legacy file attach controls are visually secondary
- A user can select a case, add an item, see calculated totals, refresh, and keep the data

## Migration Notes

Existing saved browser data may not include `casePacket`. All read paths must default it to an empty packet. Existing document statuses and attached file metadata must stay intact.
