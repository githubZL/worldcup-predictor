import "dotenv/config";

import { syncEspnEnrichment } from "../services/espnEnrichmentSyncService.js";

const args = new Set(process.argv.slice(2));
const datesArg = process.argv.find((arg) => arg.startsWith("--dates="));
const dateFromArg = process.argv.find((arg) => arg.startsWith("--date-from="));
const dateToArg = process.argv.find((arg) => arg.startsWith("--date-to="));

const result = await syncEspnEnrichment({
  dates: datesArg?.split("=")[1] ?? process.env.ESPN_SYNC_DATES,
  dateFrom: dateFromArg?.split("=")[1] ?? process.env.ESPN_SYNC_DATE_FROM,
  dateTo: dateToArg?.split("=")[1] ?? process.env.ESPN_SYNC_DATE_TO,
  dryRun: args.has("--dry-run"),
});

console.log(JSON.stringify(result, null, 2));
