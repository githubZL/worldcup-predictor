import "dotenv/config";

import { runLiveMaintenance } from "../services/maintenanceService.js";
import { writeLatestMaintenanceStatus } from "../services/maintenanceStatusService.js";

function readArg(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function readNumberArg(name) {
  const value = readArg(name);
  if (value == null) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

const args = new Set(process.argv.slice(2));

const result = await runLiveMaintenance({
  dateFrom: readArg("date-from"),
  dateTo: readArg("date-to"),
  lookbackHours: readNumberArg("lookback-hours"),
  lookaheadHours: readNumberArg("lookahead-hours"),
  dryRun: args.has("--dry-run"),
});

await writeLatestMaintenanceStatus(result);

console.log(JSON.stringify(result, null, 2));

if (result.status === "failed") {
  process.exitCode = 1;
}
