import type { ImportHistoryEntry, MaintenanceCase, PriceMasterItem } from "../domain/types";

const STORAGE_KEY = "mrdiy-maintenance-state-v1";

type BrowserState = {
  cases: MaintenanceCase[];
  importHistory: ImportHistoryEntry[];
  priceMaster?: PriceMasterItem[];
  priceMasterFileName?: string;
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
    return {
      ...parsed,
      priceMaster: Array.isArray(parsed.priceMaster) ? parsed.priceMaster : []
    };
  } catch {
    return null;
  }
}
