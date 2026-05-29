import type { ImportResult } from "../domain/types";
import {
  toImportBatchInsert,
  toImportChangeRows,
  toImportConflictRows,
  toMaintenanceCaseUpserts,
  toTicketSnapshotUpserts
} from "../domain/supabaseMapper";

type SupabaseError = { message: string };
type SupabaseQueryResult = PromiseLike<{ error?: SupabaseError | null }> | { error?: SupabaseError | null };

type SupabaseLike = {
  from: (table: string) => any;
};

const UPSERT_CHUNK_SIZE = 500;

export async function saveImportResult(
  client: SupabaseLike,
  fileName: string,
  result: ImportResult
): Promise<string> {
  const batchResponse = await client
    .from("import_batches")
    .insert(toImportBatchInsert(fileName, result))
    .select("id")
    .single();

  throwIfError(batchResponse.error, "save import batch");

  const batchId = batchResponse.data?.id;
  if (!batchId) {
    throw new Error("Supabase did not return an import batch id.");
  }

  for (const chunk of chunkRows(toTicketSnapshotUpserts(result.cases), UPSERT_CHUNK_SIZE)) {
    await runMutation(
      client.from("lark_ticket_snapshots").upsert(chunk, { onConflict: "ticket_no" }),
      "upsert ticket snapshots"
    );
  }

  for (const chunk of chunkRows(toMaintenanceCaseUpserts(result.cases), UPSERT_CHUNK_SIZE)) {
    await runMutation(
      client.from("maintenance_cases").upsert(chunk, { onConflict: "ticket_no" }),
      "upsert maintenance cases"
    );
  }

  if (result.changes.length > 0) {
    await runMutation(
      client.from("import_changes").insert(toImportChangeRows(batchId, result.changes)),
      "save import changes"
    );
  }

  if (result.conflicts.length > 0) {
    await runMutation(
      client.from("import_conflicts").insert(toImportConflictRows(batchId, result.conflicts)),
      "save import conflicts"
    );
  }

  return batchId;
}

export async function loadPersistedCases(client: SupabaseLike) {
  const response = await client
    .from("maintenance_cases")
    .select(`
      id,
      ticket_no,
      job_detail_status,
      quotation_status,
      po_status,
      invoice_status,
      archive_status,
      amount_check,
      notes,
      updated_at,
      lark_ticket_snapshots (
        ticket_no,
        record_id,
        store_code,
        store_name,
        category,
        ticket_status,
        senior_name,
        supplier_name,
        created_date,
        quotation_no,
        po_no,
        raw_payload
      )
    `)
    .order("updated_at", { ascending: false });

  throwIfError(response.error ?? null, "load maintenance cases");

  return (response.data ?? []).map((row: any) => {
    const snapshot = Array.isArray(row.lark_ticket_snapshots)
      ? row.lark_ticket_snapshots[0]
      : row.lark_ticket_snapshots;

    return {
      id: row.id,
      ticketNo: row.ticket_no,
      updatedAt: row.updated_at,
      larkSnapshot: {
        ticketNo: snapshot.ticket_no,
        recordId: snapshot.record_id,
        storeCode: snapshot.store_code,
        storeName: snapshot.store_name,
        category: snapshot.category,
        status: snapshot.ticket_status,
        senior: snapshot.senior_name,
        supplier: snapshot.supplier_name,
        createdDate: snapshot.created_date,
        quotationNo: snapshot.quotation_no,
        poNo: snapshot.po_no,
        raw: snapshot.raw_payload ?? {}
      },
      appWork: {
        jobDetail: row.job_detail_status,
        quotation: row.quotation_status,
        po: row.po_status,
        invoice: row.invoice_status,
        archive: row.archive_status,
        notes: row.notes ?? [],
        amountCheck: row.amount_check
      }
    };
  });
}

async function runMutation(result: SupabaseQueryResult, action: string): Promise<void> {
  const response = await result;
  throwIfError(response.error ?? null, action);
}

function throwIfError(error: SupabaseError | null | undefined, action: string): void {
  if (error) {
    throw new Error(`Could not ${action}: ${error.message}`);
  }
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}
