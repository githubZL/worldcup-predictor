import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  compactMaintenanceStatus,
  readLatestMaintenanceStatus,
  writeLatestMaintenanceStatus,
} from "./maintenanceStatusService.js";

const sampleResult = {
  status: "ok",
  options: { dryRun: false },
  window: { dateFrom: "2026-06-19", dateTo: "2026-06-21", timezone: "Asia/Shanghai" },
  espnSync: {
    events: 11,
    matched: 11,
    persisted: 11,
    failed: 0,
    details: [{ eventId: "large-detail" }],
  },
  snapshot: {
    created: 2,
    skipped: 102,
    total: 104,
    snapshots: [{ id: "snapshot-detail" }],
  },
  errors: [],
};

test("compactMaintenanceStatus keeps operational summary and removes large details", () => {
  const status = compactMaintenanceStatus(sampleResult, {
    generatedAt: "2026-06-20T01:00:00.000Z",
  });

  assert.deepEqual(status, {
    generatedAt: "2026-06-20T01:00:00.000Z",
    status: "ok",
    window: { dateFrom: "2026-06-19", dateTo: "2026-06-21", timezone: "Asia/Shanghai" },
    dryRun: false,
    espn: {
      events: 11,
      matched: 11,
      persisted: 11,
      failed: 0,
    },
    snapshot: {
      created: 2,
      skipped: 102,
      total: 104,
    },
    errorCount: 0,
    errors: [],
  });
});

test("writeLatestMaintenanceStatus writes compact JSON and readLatestMaintenanceStatus reads it", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "maintenance-status-"));
  const filePath = path.join(directory, "maintenance-latest.json");

  try {
    const written = await writeLatestMaintenanceStatus(sampleResult, {
      filePath,
      generatedAt: "2026-06-20T01:00:00.000Z",
    });
    const raw = JSON.parse(await readFile(filePath, "utf8"));
    const read = await readLatestMaintenanceStatus({ filePath });

    assert.equal(raw.espn.details, undefined);
    assert.deepEqual(read, written);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("readLatestMaintenanceStatus returns unknown when file is missing", async () => {
  const status = await readLatestMaintenanceStatus({
    filePath: path.join(tmpdir(), "missing-maintenance-latest.json"),
  });

  assert.deepEqual(status, {
    status: "unknown",
    message: "尚无维护任务状态",
  });
});

test("readLatestMaintenanceStatus returns unknown when file is malformed", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "maintenance-status-"));
  const filePath = path.join(directory, "maintenance-latest.json");

  try {
    await writeFile(filePath, "{not-json", "utf8");
    const status = await readLatestMaintenanceStatus({ filePath });

    assert.deepEqual(status, {
      status: "unknown",
      message: "维护任务状态文件不可读",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
