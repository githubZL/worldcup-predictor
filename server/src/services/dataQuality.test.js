import assert from "node:assert/strict";
import test from "node:test";

import { buildDashboardMeta } from "./dataQuality.js";

test("buildDashboardMeta labels real, fallback, computed, and simulated dashboard sources", () => {
  const meta = buildDashboardMeta({
    generatedAt: "2026-06-18T10:00:00.000Z",
    scheduleSource: "database-postgresql",
    weatherSource: "open-meteo-with-fallback",
    sportsSource: "thesportsdb-optional",
  });

  assert.equal(meta.generatedAt, "2026-06-18T10:00:00.000Z");
  assert.equal(meta.dataSources.schedule, "database-postgresql");
  assert.equal(meta.dataQuality.schedule.status, "real");
  assert.equal(meta.dataQuality.weather.status, "real_with_fallback");
  assert.equal(meta.dataQuality.prediction.status, "computed");
  assert.equal(meta.dataQuality.market.status, "simulated");
  assert.equal(meta.modelStatus.prediction.engine, "poisson-v0.8");
  assert.equal(meta.modelStatus.market.notice, "竞彩赔率暂未接入真实数据");
});

test("buildDashboardMeta marks local schedule data as fallback", () => {
  const meta = buildDashboardMeta({
    generatedAt: "2026-06-18T10:00:00.000Z",
    scheduleSource: "local-fixture-fallback",
    weatherSource: "local-weather-fallback",
    sportsSource: "disabled",
  });

  assert.equal(meta.dataQuality.schedule.status, "fallback");
  assert.equal(meta.dataQuality.teams.status, "fallback");
  assert.equal(meta.dataQuality.venues.status, "fallback");
  assert.equal(meta.dataQuality.weather.status, "fallback");
  assert.equal(meta.dataQuality.sports.status, "disabled");
});
