import type { ImportHistoryEntry, ImportResult } from "./types";

export function createImportHistoryEntry(
  fileName: string,
  result: ImportResult,
  importedAt: string = new Date().toISOString()
): ImportHistoryEntry {
  return {
    id: `local-${importedAt}`,
    fileName,
    importedAt,
    totalRows: result.newCases.length
      + result.updatedCases.length
      + result.unchangedCases.length
      + result.invalidRows.length,
    newCount: result.newCases.length,
    updatedCount: result.updatedCases.length,
    unchangedCount: result.unchangedCases.length,
    conflictCount: result.conflicts.length,
    invalidCount: result.invalidRows.length,
    storageStatus: "local"
  };
}
