import assert from "node:assert/strict";
import test from "node:test";

import { buildDataHealth } from "./dataHealthService.js";

test("buildDataHealth reports future snapshot coverage", () => {
  const health = buildDataHealth([
    {
      id: "future-snapshot",
      time: "2026-06-21T10:00:00.000Z",
      home: "巴西",
      away: "法国",
      predictionSource: "snapshot",
      status: "scheduled",
    },
    {
      id: "future-missing",
      time: "2026-06-21T13:00:00.000Z",
      home: "英格兰",
      away: "西班牙",
      predictionSource: "computed",
      status: "scheduled",
    },
  ], {
    now: new Date("2026-06-20T10:00:00.000Z"),
  });

  assert.equal(health.status, "warning");
  assert.equal(health.snapshot.upcoming, 2);
  assert.equal(health.snapshot.withSnapshot, 1);
  assert.equal(health.snapshot.missing, 1);
  assert.equal(health.snapshot.coveragePct, 50);
  assert.deepEqual(health.snapshot.missingMatches.map((match) => match.id), ["future-missing"]);
});

test("buildDataHealth flags matches that should have synced results", () => {
  const health = buildDataHealth([
    {
      id: "overdue",
      time: "2026-06-20T04:00:00.000Z",
      home: "墨西哥",
      away: "韩国",
      predictionSource: "snapshot",
      status: "scheduled",
    },
    {
      id: "finished",
      time: "2026-06-20T05:00:00.000Z",
      home: "日本",
      away: "德国",
      homeScore: 1,
      awayScore: 2,
      predictionSource: "snapshot",
      status: "finished",
    },
  ], {
    now: new Date("2026-06-20T10:30:00.000Z"),
  });

  assert.equal(health.status, "action_needed");
  assert.equal(health.resultSync.overdueWithoutResult, 1);
  assert.deepEqual(health.resultSync.matches.map((match) => match.id), ["overdue"]);
});

test("buildDataHealth returns ok when snapshots and results are healthy", () => {
  const health = buildDataHealth([
    {
      id: "future-snapshot",
      time: "2026-06-21T10:00:00.000Z",
      home: "巴西",
      away: "法国",
      predictionSource: "snapshot",
      status: "scheduled",
    },
    {
      id: "finished",
      time: "2026-06-20T05:00:00.000Z",
      home: "日本",
      away: "德国",
      homeScore: 1,
      awayScore: 2,
      predictionSource: "snapshot",
      status: "finished",
    },
  ], {
    now: new Date("2026-06-20T10:30:00.000Z"),
  });

  assert.equal(health.status, "ok");
  assert.equal(health.snapshot.coveragePct, 100);
  assert.equal(health.resultSync.overdueWithoutResult, 0);
});
