import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "outputs";
const outputPath = `${outputDir}/OpenAI_ChatGPT_Plus_Expense_QAJTFFHZ-0001.xlsx`;

await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Expense Claim");
sheet.showGridLines = false;

sheet.getRange("A1:F1").merge();
sheet.getRange("A1").values = [["OpenAI ChatGPT Plus Expense Claim"]];
sheet.getRange("A1").format = {
  fill: "#1F2937",
  font: { bold: true, color: "#FFFFFF", size: 16 },
};
sheet.getRange("A1").format.rowHeightPx = 34;

sheet.getRange("A3:B14").values = [
  ["Field", "Value"],
  ["Vendor", "OpenAI OpCo, LLC"],
  ["Invoice number", "QAJTFFHZ-0001"],
  ["Invoice issue date", new Date("2026-06-07")],
  ["Expense date", new Date("2026-06-07")],
  ["Service period", "2026-06-07 to 2026-07-07"],
  ["Expense type", "Software / SaaS Subscription"],
  ["Description", "ChatGPT Plus subscription for work productivity"],
  ["Currency", "KRW"],
  ["Subtotal excluding tax", 26364],
  ["VAT", 2636],
  ["Total amount", 29000],
];

sheet.getRange("A3:B3").format = {
  fill: "#0F766E",
  font: { bold: true, color: "#FFFFFF" },
};
sheet.getRange("A4:A14").format = {
  fill: "#E5E7EB",
  font: { bold: true, color: "#111827" },
};
sheet.getRange("B6:B7").setNumberFormat("yyyy-mm-dd");
sheet.getRange("B12:B14").format.numberFormat = '₩#,##0';
sheet.getRange("A3:B14").format.borders = {
  preset: "all",
  style: "thin",
  color: "#D1D5DB",
};

sheet.getRange("D3:F8").values = [
  ["Amount breakdown", "", ""],
  ["Line item", "Tax rate", "Amount"],
  ["ChatGPT Plus Subscription", "10%", 26364],
  ["VAT - South Korea", "10%", 2636],
  ["Total", "", 29000],
  ["Invoice status note", "", "PDF says Amount due, verify Paid status if required"],
];
sheet.getRange("D3:F3").merge();
sheet.getRange("D3").format = {
  fill: "#374151",
  font: { bold: true, color: "#FFFFFF" },
};
sheet.getRange("D4:F4").format = {
  fill: "#0F766E",
  font: { bold: true, color: "#FFFFFF" },
};
sheet.getRange("F5:F7").format.numberFormat = '₩#,##0';
sheet.getRange("D3:F8").format.borders = {
  preset: "all",
  style: "thin",
  color: "#D1D5DB",
};

sheet.getRange("A17:F22").values = [
  ["Submission checklist", "", "", "", "", ""],
  ["1", "Attach invoice PDF", "C:\\Users\\User\\Downloads\\Invoice-QAJTFFHZ-0001.pdf", "", "", ""],
  ["2", "Use expense type", "Software / SaaS Subscription", "", "", ""],
  ["3", "Enter total amount", "KRW 29,000", "", "", ""],
  ["4", "If the system asks for proof of payment", "Confirm Stripe invoice shows Paid or attach receipt", "", "", ""],
  ["5", "Submit only after reviewing tax and policy requirements", "", "", "", ""],
];
sheet.getRange("A17:F17").merge();
sheet.getRange("A17").format = {
  fill: "#1F2937",
  font: { bold: true, color: "#FFFFFF" },
};
sheet.getRange("A18:A22").format = {
  fill: "#E5E7EB",
  font: { bold: true, color: "#111827" },
};
sheet.getRange("A17:F22").format.borders = {
  preset: "all",
  style: "thin",
  color: "#D1D5DB",
};

sheet.getRange("A24:F26").values = [
  ["Source", "", "", "", "", ""],
  ["Invoice PDF", "C:\\Users\\User\\Downloads\\Invoice-QAJTFFHZ-0001.pdf", "", "", "", ""],
  ["Extracted by", "Codex", "", "", "", ""],
];
sheet.getRange("A24:F24").merge();
sheet.getRange("A24").format = {
  fill: "#6B7280",
  font: { bold: true, color: "#FFFFFF" },
};
sheet.getRange("A25:A26").format = {
  fill: "#F3F4F6",
  font: { bold: true },
};

sheet.getRange("A:A").format.columnWidthPx = 170;
sheet.getRange("B:B").format.columnWidthPx = 300;
sheet.getRange("C:C").format.columnWidthPx = 280;
sheet.getRange("D:D").format.columnWidthPx = 210;
sheet.getRange("E:E").format.columnWidthPx = 100;
sheet.getRange("F:F").format.columnWidthPx = 290;
sheet.getRange("A1:F26").format.wrapText = true;
sheet.freezePanes.freezeRows(3);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 20 },
});
if (errors.ndjson && errors.ndjson.includes("#")) {
  throw new Error(`Formula error found: ${errors.ndjson}`);
}

const preview = await workbook.render({
  sheetName: "Expense Claim",
  autoCrop: "all",
  scale: 1,
  format: "png",
});
await fs.writeFile(`${outputDir}/OpenAI_ChatGPT_Plus_Expense_QAJTFFHZ-0001_preview.png`, new Uint8Array(await preview.arrayBuffer()));

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);

console.log(outputPath);
