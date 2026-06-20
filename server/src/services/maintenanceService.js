import { syncEspnEnrichment as defaultSyncEspnEnrichment } from "./espnEnrichmentSyncService.js";
import { createMissingPredictionSnapshots as defaultCreateMissingPredictionSnapshots } from "./predictionSnapshotService.js";

const BEIJING_TIMEZONE = "Asia/Shanghai";
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function formatDateInBeijing(date) {
  return new Date(date.getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

function formatDateInUtc(date) {
  return date.toISOString().slice(0, 10);
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

export function resolveLiveMaintenanceWindow({
  now = new Date(),
  dateFrom,
  dateTo,
  lookbackHours = 8,
  lookaheadHours = 2,
} = {}) {
  return {
    dateFrom: dateFrom ?? formatDateInUtc(new Date(now.getTime() - lookbackHours * HOUR_MS)),
    dateTo: dateTo ?? formatDateInUtc(new Date(now.getTime() + lookaheadHours * HOUR_MS)),
    timezone: BEIJING_TIMEZONE,
    lookbackHours,
    lookaheadHours,
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

  if (dryRun) {
    snapshot = {
      dryRun: true,
      created: 0,
      skipped: 0,
      total: 0,
      snapshots: [],
      message: "Prediction snapshot creation skipped during dry run.",
    };
  } else {
    try {
      snapshot = await createMissingPredictionSnapshots({ now });
    } catch (error) {
      errors.push(summarizeError("prediction-snapshot", error));
    }
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

export async function runLiveMaintenance(
  { now = new Date(), dateFrom, dateTo, dryRun = false, lookbackHours = 8, lookaheadHours = 2 } = {},
  {
    syncEspnEnrichment = defaultSyncEspnEnrichment,
  } = {},
) {
  const window = resolveLiveMaintenanceWindow({ now, dateFrom, dateTo, lookbackHours, lookaheadHours });
  const errors = [];
  let espnSync = null;

  try {
    espnSync = await syncEspnEnrichment({
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      dryRun,
    });
  } catch (error) {
    errors.push(summarizeError("espn-sync", error));
  }

  return {
    status: errors.length === 0 ? "ok" : "failed",
    options: { dryRun, mode: "live" },
    window,
    espnSync,
    snapshot: {
      skipped: true,
      reason: "live maintenance only syncs near-time ESPN results",
    },
    errors,
  };
}
