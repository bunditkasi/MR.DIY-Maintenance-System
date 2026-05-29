import readXlsxFile from "read-excel-file/browser";
import { summarizePoWorksheet, type PoSummary } from "../domain/poExcel";

type CellValue = string | number | boolean | Date | null;

export async function readPoFileSummary(file: File): Promise<PoSummary> {
  const sheets = await readXlsxFile(file);
  const poSheet = sheets.find(({ sheet }) => !["Sup", "Zone", "Adress", "ค่าใช้จ่าย", "ค่าใช้จ่าย "].includes(sheet))
    ?? sheets[0];
  return summarizePoWorksheet(poSheet.data as CellValue[][]);
}
