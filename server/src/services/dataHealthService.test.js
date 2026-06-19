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

test("buildDataHealth exposes diagnostic issues with suggested actions", () => {
  const health = buildDataHealth([
    {
      id: "missing-snapshot",
      time: "2026-06-21T10:00:00.000Z",
      home: "巴西",
      away: "法国",
      predictionSource: "computed",
      status: "scheduled",
    },
    {
      id: "overdue-result",
      time: "2026-06-20T04:00:00.000Z",
      home: "墨西哥",
      away: "韩国",
      predictionSource: "snapshot",
      status: "scheduled",
    },
  ], {
    now: new Date("2026-06-20T10:30:00.000Z"),
  });

  assert.deepEqual(health.issues.map((issue) => [issue.type, issue.severity, issue.match.id, issue.action]), [
    ["result_not_synced", "high", "overdue-result", "同步 ESPN 赛果"],
    ["missing_snapshot", "medium", "missing-snapshot", "补赛前预测快照"],
  ]);
  assert.equal(health.issueSummary.high, 1);
  assert.equal(health.issueSummary.medium, 1);
});

test("buildDataHealth reports model input coverage for real data fields", () => {
  const health = buildDataHealth([
    {
      id: "rich-inputs",
      time: "2026-06-21T10:00:00.000Z",
      home: "巴西",
      away: "法国",
      predictionSource: "snapshot",
      weatherSnapshot: { temperatureC: 24 },
      venueMeta: { latitude: 25.7, longitude: -80.2, altitude: 2 },
      predictionBreakdown: {
        strength: {
          home: { source: "database" },
          away: { source: "database" },
        },
        modelSignals: {
          form: {
            details: {
              home: { sampleSize: 5 },
              away: { sampleSize: 4 },
            },
          },
          production: {
            details: {
              home: { sampleSize: 2 },
              away: { sampleSize: 1 },
            },
          },
          availability: {
            details: {
              homeLineups: 1,
              awayLineups: 1,
              athleteRows: 22,
            },
          },
        },
      },
    },
    {
      id: "fallback-inputs",
      time: "2026-06-22T10:00:00.000Z",
      home: "德国",
      away: "日本",
      predictionSource: "snapshot",
      weatherSnapshot: null,
      venueMeta: { latitude: null, longitude: null, altitude: null },
      predictionBreakdown: {
        strength: {
          home: { source: "baseline" },
          away: { source: "placeholder" },
        },
        modelSignals: {
          form: { details: { home: { sampleSize: 0 }, away: { sampleSize: 0 } } },
          production: { details: { home: { sampleSize: 0 }, away: { sampleSize: 0 } } },
          availability: { details: { homeLineups: 0, awayLineups: 0, athleteRows: 0 } },
        },
      },
    },
  ], {
    now: new Date("2026-06-20T10:30:00.000Z"),
  });

  const metricByKey = new Map(health.inputCoverage.metrics.map((metric) => [metric.key, metric]));

  assert.deepEqual(metricByKey.get("teamStrength"), {
    key: "teamStrength",
    label: "球队实力",
    covered: 2,
    total: 4,
    coveragePct: 50,
    status: "poor",
  });
  assert.equal(metricByKey.get("espnRecentForm").coveragePct, 50);
  assert.equal(metricByKey.get("espnTeamStats").coveragePct, 50);
  assert.equal(metricByKey.get("lineups").coveragePct, 50);
  assert.equal(metricByKey.get("weather").coveragePct, 50);
  assert.equal(metricByKey.get("venueCoordinates").coveragePct, 50);
  assert.equal(metricByKey.get("altitude").coveragePct, 50);
  assert.equal(health.inputCoverage.status, "poor");
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
