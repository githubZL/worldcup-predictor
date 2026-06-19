import { syncEspnEnrichment as defaultSyncEspnEnrichment } from "./espnEnrichmentSyncService.js";
import { createMissingPredictionSnapshots as defaultCreateMissingPredictionSnapshots } from "./predictionSnapshotService.js";

const BEIJING_TIMEZONE = "Asia/Shanghai";
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function formatDateInBeijing(date) {
  return new Date(date.getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

function summarizeError(step, error) {
  return {
    step,
    message: error instanceof Error ? error.message : String(error),
  };
}

export function resolveMaintenanceWindow({ now = new Date(), dateFrom, dateTo } = {}) {
  const todayStartUtc = new Date(`${formatDateInBeijing(now)}T00:00:00.000Z`);
  return {
    dateFrom: dateFrom ?? formatDateInBeijing(new Date(todayStartUtc.getTime() - DAY_MS)),
    dateTo: dateTo ?? formatDateInBeijing(new Date(todayStartUtc.getTime() + DAY_MS)),
    timezone: BEIJING_TIMEZONE,
  };
}

export async function runDailyMaintenance(
  { now = new Date(), dateFrom, dateTo, dryRun = false } = {},
  {
    syncEspnEnrichment = defaultSyncEspnEnrichment,
    createMissingPredictionSnapshots = defaultCreateMissingPredictionSnapshots,
  } = {},
) {
  const window = resolveMaintenanceWindow({ now, dateFrom, dateTo });
  const errors = [];
  let espnSync = null;
  let snapshot = null;

  try {
    espnSync = await syncEspnEnrichment({
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      dryRun,
    });
  } catch (error) {
    errors.push(summarizeError("espn-sync", error));
  }

  try {
    snapshot = await createMissingPredictionSnapshots({ now });
  } catch (error) {
    errors.push(summarizeError("prediction-snapshot", error));
  }

  const status = errors.length === 0 ? "ok" : snapshot ? "partial" : "failed";

  return {
    status,
    options: { dryRun },
    window,
    espnSync,
    snapshot,
    errors,
  };
}
