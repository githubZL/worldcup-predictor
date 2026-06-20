import assert from "node:assert/strict";
import test from "node:test";

import { createMissingPredictionSnapshots } from "./predictionSnapshotService.js";

function makeTeam(id, name = id) {
  return {
    id,
    name,
    fifaRank: 20,
    matchStats: [],
    recentForm: [],
  };
}

function makeVenue() {
  return {
    id: "venue-1",
    name: "Test Stadium",
    city: "Test City",
    country: "USA",
    latitude: 40,
    longitude: -74,
    altitude: 0,
    fallbackWeather: "晴 22°C",
  };
}

function makeMatch(overrides = {}) {
  const homeTeam = makeTeam("home-team", "Brazil");
  const awayTeam = makeTeam("away-team", "France");
  return {
    id: overrides.id ?? "match-1",
    time: overrides.time ?? "2026-06-20T10:00:00.000Z",
    status: overrides.status ?? "scheduled",
    homeScore: overrides.homeScore ?? null,
    awayScore: overrides.awayScore ?? null,
    homeTeam,
    awayTeam,
    venue: makeVenue(),
    lineups: [],
    markets: [],
    predictionSnapshot: overrides.predictionSnapshot ?? null,
    ...overrides,
  };
}

test("createMissingPredictionSnapshots freezes only unsnapped matches inside the pre-match window", async () => {
  const created = [];
  const now = new Date("2026-06-20T00:00:00.000Z");
  const matches = [
    makeMatch({ id: "inside-window", time: "2026-06-21T00:00:00.000Z" }),
    makeMatch({ id: "too-far", time: "2026-06-23T01:00:00.000Z" }),
    makeMatch({ id: "finished", time: "2026-06-19T20:00:00.000Z", status: "finished", homeScore: 1, awayScore: 0 }),
    makeMatch({ id: "already-snapped", time: "2026-06-21T05:00:00.000Z", predictionSnapshot: { id: "snap-1" } }),
  ];

  const result = await createMissingPredictionSnapshots(
    { now, freezeWindowHours: 48 },
    {
      readDatabaseMatches: async () => matches,
      createPredictionSnapshot: async (record) => {
        created.push(record);
        return { id: `snapshot-${record.matchId}`, ...record };
      },
      fetchWeatherSnapshot: async () => ({
        temperatureC: 21,
        weatherCode: 0,
        source: "open-meteo-forecast",
      }),
    },
  );

  assert.equal(result.created, 1);
  assert.equal(result.skipped, 3);
  assert.equal(result.total, 4);
  assert.deepEqual(created.map((record) => record.matchId), ["inside-window"]);
  assert.equal(created[0].explanation.snapshotQuality.weather.source, "open-meteo-forecast");
  assert.equal(created[0].explanation.snapshotQuality.freezeWindowHours, 48);
  assert.deepEqual(result.skippedReasons, {
    has_snapshot: 1,
    finished: 1,
    outside_window: 1,
  });
});

test("createMissingPredictionSnapshots records observable pre-match data quality", async () => {
  const now = new Date("2026-06-20T00:00:00.000Z");
  const match = makeMatch({
    id: "quality-match",
    time: "2026-06-20T10:00:00.000Z",
    homeTeam: {
      ...makeTeam("home-team", "Brazil"),
      matchStats: [{ source: "espn", stats: {}, match: { kickoffAt: new Date("2026-06-18T10:00:00.000Z") } }],
      recentForm: [{ source: "espn", externalEventId: "form-1" }],
    },
    awayTeam: {
      ...makeTeam("away-team", "France"),
      matchStats: [{ source: "espn", stats: {}, match: { kickoffAt: new Date("2026-06-17T10:00:00.000Z") } }],
      recentForm: [{ source: "espn", externalEventId: "form-2" }],
    },
    lineups: [
      { source: "espn", teamId: "home-team", athletes: [] },
      { source: "espn", teamId: "away-team", athletes: [] },
    ],
    markets: [{ source: "espn:DraftKings", marketType: "spread" }],
  });

  let savedRecord;
  await createMissingPredictionSnapshots(
    { now },
    {
      readDatabaseMatches: async () => [match],
      createPredictionSnapshot: async (record) => {
        savedRecord = record;
        return { id: "snapshot-quality", ...record };
      },
      fetchWeatherSnapshot: async () => null,
    },
  );

  assert.deepEqual(savedRecord.explanation.snapshotQuality.espn, {
    homePreMatchStats: 1,
    awayPreMatchStats: 1,
    homeRecentForm: 1,
    awayRecentForm: 1,
    lineups: 2,
    marketOdds: 1,
  });
  assert.equal(savedRecord.explanation.snapshotQuality.weather.source, "fallback");
});
