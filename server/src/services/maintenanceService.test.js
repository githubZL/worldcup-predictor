import test from "node:test";
import assert from "node:assert/strict";

import { resolveMaintenanceWindow, runDailyMaintenance } from "./maintenanceService.js";

test("resolveMaintenanceWindow defaults to yesterday through tomorrow in Beijing time", () => {
  const window = resolveMaintenanceWindow({
    now: new Date("2026-06-19T01:30:00.000Z"),
  });

  assert.deepEqual(window, {
    dateFrom: "2026-06-18",
    dateTo: "2026-06-20",
    timezone: "Asia/Shanghai",
  });
});

test("resolveMaintenanceWindow lets explicit dates override defaults", () => {
  const window = resolveMaintenanceWindow({
    now: new Date("2026-06-19T01:30:00.000Z"),
    dateFrom: "2026-06-10",
    dateTo: "2026-06-12",
  });

  assert.deepEqual(window, {
    dateFrom: "2026-06-10",
    dateTo: "2026-06-12",
    timezone: "Asia/Shanghai",
  });
});

test("runDailyMaintenance syncs ESPN data then creates snapshots", async () => {
  const calls = [];
  const result = await runDailyMaintenance(
    {
      now: new Date("2026-06-19T01:30:00.000Z"),
    },
    {
      syncEspnEnrichment: async (options) => {
        calls.push(["sync", options]);
        return { matched: 3, persisted: 3 };
      },
      createMissingPredictionSnapshots: async () => {
        calls.push(["snapshot"]);
        return { created: 2, skipped: 5, total: 7 };
      },
    },
  );

  assert.equal(result.status, "ok");
  assert.deepEqual(result.window, {
    dateFrom: "2026-06-18",
    dateTo: "2026-06-20",
    timezone: "Asia/Shanghai",
  });
  assert.deepEqual(calls, [
    [
      "sync",
      {
        dateFrom: "2026-06-18",
        dateTo: "2026-06-20",
        dryRun: false,
      },
    ],
    ["snapshot"],
  ]);
  assert.deepEqual(result.snapshot, { created: 2, skipped: 5, total: 7 });
});

test("runDailyMaintenance skips snapshot writes during dry run", async () => {
  const calls = [];
  const result = await runDailyMaintenance(
    {
      now: new Date("2026-06-19T01:30:00.000Z"),
      dryRun: true,
    },
    {
      syncEspnEnrichment: async () => ({ dryRun: true, matched: 3, persisted: 0 }),
      createMissingPredictionSnapshots: async () => {
        calls.push("snapshot");
        return { created: 2, skipped: 5, total: 7 };
      },
    },
  );

  assert.equal(result.status, "ok");
  assert.deepEqual(calls, []);
  assert.deepEqual(result.snapshot, {
    dryRun: true,
    created: 0,
    skipped: 0,
    total: 0,
    snapshots: [],
    message: "Prediction snapshot creation skipped during dry run.",
  });
});

test("runDailyMaintenance forwards explicit maintenance dates to ESPN sync", async () => {
  let syncOptions;
  const result = await runDailyMaintenance(
    {
      now: new Date("2026-06-19T01:30:00.000Z"),
      dateFrom: "2026-06-10",
      dateTo: "2026-06-12",
    },
    {
      syncEspnEnrichment: async (options) => {
        syncOptions = options;
        return { matched: 1, persisted: 1 };
      },
      createMissingPredictionSnapshots: async () => ({ created: 0, skipped: 1, total: 1 }),
    },
  );

  assert.equal(result.status, "ok");
  assert.deepEqual(syncOptions, {
    dateFrom: "2026-06-10",
    dateTo: "2026-06-12",
    dryRun: false,
  });
});

test("runDailyMaintenance returns partial when ESPN sync fails but snapshots succeed", async () => {
  const result = await runDailyMaintenance(
    { now: new Date("2026-06-19T01:30:00.000Z") },
    {
      syncEspnEnrichment: async () => {
        throw new Error("espn unavailable");
      },
      createMissingPredictionSnapshots: async () => ({ created: 1, skipped: 0, total: 1 }),
    },
  );

  assert.equal(result.status, "partial");
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].step, "espn-sync");
  assert.equal(result.errors[0].message, "espn unavailable");
  assert.deepEqual(result.snapshot, { created: 1, skipped: 0, total: 1 });
});

test("runDailyMaintenance returns failed when both sync and snapshots fail", async () => {
  const result = await runDailyMaintenance(
    { now: new Date("2026-06-19T01:30:00.000Z") },
    {
      syncEspnEnrichment: async () => {
        throw new Error("espn unavailable");
      },
      createMissingPredictionSnapshots: async () => {
        throw new Error("database unavailable");
      },
    },
  );

  assert.equal(result.status, "failed");
  assert.deepEqual(
    result.errors.map((error) => [error.step, error.message]),
    [
      ["espn-sync", "espn unavailable"],
      ["prediction-snapshot", "database unavailable"],
    ],
  );
});
