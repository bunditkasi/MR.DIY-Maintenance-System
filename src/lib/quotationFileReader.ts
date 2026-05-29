import readXlsxFile from "read-excel-file/browser";
import { summarizeQuotationWorksheet, type QuotationSummary } from "../domain/quotationExcel";

type CellValue = string | number | boolean | Date | null;

export async function readQuotationFileSummary(file: File): Promise<QuotationSummary> {
  const sheets = await readXlsxFile(file);
  const quotationSheet = sheets.find(({ sheet }) => sheet.toLowerCase().includes("qt"))
    ?? sheets[0];
  return summarizeQuotationWorksheet(quotationSheet.data as CellValue[][]);
}
