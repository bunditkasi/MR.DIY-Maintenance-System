import readXlsxFile from "read-excel-file/browser";
import { parsePriceMasterSheets, type PriceMasterItem } from "../domain/priceMaster";

type CellValue = string | number | boolean | Date | null;

export async function readPriceMasterFile(file: File): Promise<PriceMasterItem[]> {
  const sheets = await readXlsxFile(file);
  return parsePriceMasterSheets(sheets.map(({ sheet, data }) => ({
    sheetName: sheet,
    rows: data as CellValue[][]
  })));
}
