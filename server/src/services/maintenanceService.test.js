import test from "node:test";
import assert from "node:assert/strict";

import { resolveMaintenanceWindow } from "./maintenanceService.js";

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
