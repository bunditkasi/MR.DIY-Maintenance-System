import type { ImportHistoryEntry, MaintenanceCase } from "../domain/types";

const STORAGE_KEY = "mrdiy-maintenance-state-v1";

type BrowserState = {
  cases: MaintenanceCase[];
  importHistory: ImportHistoryEntry[];
};

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export function saveBrowserState(storage: StorageLike, state: BrowserState): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadBrowserState(storage: StorageLike): BrowserState | null {
  const value = storage.getItem(STORAGE_KEY);
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as BrowserState;
    if (!Array.isArray(parsed.cases) || !Array.isArray(parsed.importHistory)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
