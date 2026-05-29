import type { MaintenanceCase } from "./types";

export const sampleCases: MaintenanceCase[] = [
  {
    id: "case-L05496",
    ticketNo: "L05496",
    updatedAt: "2026-05-29T02:30:00.000Z",
    larkSnapshot: {
      ticketNo: "L05496",
      storeCode: "S032",
      storeName: "PHIN",
      category: "Lighting",
      status: "Assigned L2",
      senior: "Apisit Neerawong",
      supplier: "CNQC",
      createdDate: "2025-08-08",
      quotationNo: "QT 2605125",
      poNo: "",
      raw: {
        "Ticket No.": "L05496",
        "Store Code-name": "S032 PHIN",
        "Ticket Status": "Assigned L2"
      }
    },
    appWork: {
      jobDetail: "validated",
      quotation: "uploaded",
      po: "missing",
      invoice: "missing",
      archive: "missing",
      notes: ["Job detail amount matches selected quotation lines."],
      amountCheck: "warning"
    }
  },
  {
    id: "case-L00055",
    ticketNo: "L00055",
    updatedAt: "2026-05-28T09:10:00.000Z",
    larkSnapshot: {
      ticketNo: "L00055",
      storeCode: "PTNC",
      storeName: "Tanapol Center",
      category: "AutoDoor",
      status: "Done",
      senior: "Waritphon Aekbunyrit",
      supplier: "CNQC",
      createdDate: "2025-11-12",
      quotationNo: "CNQC-2025-QT-283",
      poNo: "POM2505022",
      raw: {
        "Ticket No.": "L00055",
        "Store Code-name": "PTNC Tanapol Center",
        "Ticket Status": "Done"
      }
    },
    appWork: {
      jobDetail: "approved",
      quotation: "validated",
      po: "approved",
      invoice: "missing",
      archive: "uploaded",
      notes: ["Waiting invoice from supplier."],
      amountCheck: "passed"
    }
  },
  {
    id: "case-L06331",
    ticketNo: "L06331",
    updatedAt: "2026-05-27T05:20:00.000Z",
    larkSnapshot: {
      ticketNo: "L06331",
      storeCode: "BS61",
      storeName: "PHSN",
      category: "Ceiling",
      status: "Assigned L1",
      senior: "Chaiiwat Boonthong",
      supplier: "",
      createdDate: "2023-07-06",
      raw: {
        "Ticket No.": "L06331",
        "Store Code-name": "BS61 PHSN",
        "Ticket Status": "Assigned L1"
      }
    },
    appWork: {
      jobDetail: "missing",
      quotation: "missing",
      po: "missing",
      invoice: "missing",
      archive: "missing",
      notes: ["Needs scope confirmation before supplier assignment."],
      amountCheck: "not_started"
    }
  }
];
