import "dotenv/config";

import { runDailyMaintenance } from "../services/maintenanceService.js";
import { writeLatestMaintenanceStatus } from "../services/maintenanceStatusService.js";

function readArg(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

const args = new Set(process.argv.slice(2));

const result = await runDailyMaintenance({
  dateFrom: readArg("date-from"),
  dateTo: readArg("date-to"),
  dryRun: args.has("--dry-run"),
});

await writeLatestMaintenanceStatus(result);

console.log(JSON.stringify(result, null, 2));

if (result.status === "failed") {
  process.exitCode = 1;
}
