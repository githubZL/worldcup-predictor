import assert from "node:assert/strict";
import test from "node:test";

import { buildMatchPredictionEnrichment, resolveWeatherDisplay } from "./dataGateway.js";

test("buildMatchPredictionEnrichment passes only pre-match ESPN stats and keeps odds plus lineups observable", () => {
  const enrichment = buildMatchPredictionEnrichment({
    id: "match-2",
    time: "2026-06-18T16:00:00.000Z",
    homeTeam: {
      id: "team-home",
      matchStats: [
        {
          source: "espn",
          stats: { totalGoals: 2, goalsConceded: 0, goalDifference: 2 },
          match: { kickoffAt: new Date("2026-06-10T16:00:00.000Z") },
        },
        {
          source: "espn",
          stats: { totalGoals: 5, goalsConceded: 0, goalDifference: 5 },
          match: { kickoffAt: new Date("2026-06-20T16:00:00.000Z") },
        },
      ],
      recentForm: [{ source: "espn", homeScore: 1, awayScore: 0 }],
    },
    awayTeam: {
      id: "team-away",
      matchStats: [
        {
          source: "espn",
          stats: { totalGoals: 0, goalsConceded: 1, goalDifference: -1 },
          match: { kickoffAt: new Date("2026-06-11T16:00:00.000Z") },
        },
      ],
      recentForm: [{ source: "espn", homeScore: 0, awayScore: 0 }],
    },
    markets: [{ source: "espn:DraftKings", marketType: "spread" }],
    lineups: [
      { source: "espn", teamId: "team-home", athletes: [] },
      { source: "espn", teamId: "team-away", athletes: [] },
    ],
  });

  assert.equal(enrichment.source, "espn");
  assert.equal(enrichment.home.teamMatchStats.length, 1);
  assert.equal(enrichment.home.teamMatchStats[0].stats.goalDifference, 2);
  assert.equal(enrichment.away.teamMatchStats.length, 1);
  assert.equal(enrichment.home.recentForm.length, 1);
  assert.equal(enrichment.away.recentForm.length, 1);
  assert.equal(enrichment.home.marketOdds.length, 1);
  assert.equal(enrichment.home.lineups.length, 1);
});

test("resolveWeatherDisplay shows pending for future matches outside forecast horizon", () => {
  const weather = resolveWeatherDisplay({
    matchTime: "2026-07-10T10:00:00.000Z",
    now: new Date("2026-06-20T10:00:00.000Z"),
    weatherSnapshot: null,
    fallbackWeather: "晴 25°C",
  });

  assert.equal(weather, "待更新");
});
