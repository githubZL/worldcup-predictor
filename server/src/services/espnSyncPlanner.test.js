import assert from "node:assert/strict";
import test from "node:test";

import { buildEspnSyncPlan } from "./espnSyncPlanner.js";

test("buildEspnSyncPlan prepares stable database rows from ESPN canonical draft", () => {
  const plan = buildEspnSyncPlan({
    source: "espn",
    externalMatchId: "760438",
    matchResult: {
      status: "finished",
      homeScore: 1,
      awayScore: 2,
    },
    teams: [
      { externalTeamId: "450", name: "Czechia", side: "home" },
      { externalTeamId: "467", name: "South Africa", side: "away" },
    ],
    teamMatchStats: [
      { externalTeamId: "450", teamName: "Czechia", stats: { totalGoals: 1, goalsConceded: 2 } },
    ],
    lineups: [
      { externalTeamId: "450", teamName: "Czechia", athletes: [] },
    ],
    odds: [
      { provider: "DraftKings", details: "CZE -0.5", overUnder: 2.5 },
    ],
    recentForm: [
      {
        externalTeamId: "450",
        teamName: "Czechia",
        events: [
          { externalEventId: "761378", date: "2026-03-26T19:45Z", homeScore: 2, awayScore: 2 },
          {
            externalEventId: "761379",
            date: "2026-03-30T19:45Z",
            homeScore: 1,
            awayScore: 3,
            teamScore: 3,
            opponentScore: 1,
            result: "W",
            isHome: false,
          },
        ],
      },
    ],
  }, {
    matchId: "fifa-match-400021440",
    teamIdByExternalId: new Map([
      ["450", "team-czechia"],
      ["467", "team-south-africa"],
    ]),
  });

  assert.deepEqual(plan.externalIds, [
    { entityType: "match", localId: "fifa-match-400021440", source: "espn", externalId: "760438" },
    { entityType: "team", localId: "team-czechia", source: "espn", externalId: "450" },
    { entityType: "team", localId: "team-south-africa", source: "espn", externalId: "467" },
  ]);
  assert.deepEqual(plan.matchUpdate, {
    matchId: "fifa-match-400021440",
    status: "finished",
    homeScore: 1,
    awayScore: 2,
  });
  assert.deepEqual(plan.teamMatchStats, [
    {
      matchId: "fifa-match-400021440",
      teamId: "team-czechia",
      source: "espn",
      stats: { totalGoals: 1, goalsConceded: 2 },
    },
  ]);
  assert.deepEqual(plan.lineups, [
    {
      matchId: "fifa-match-400021440",
      teamId: "team-czechia",
      source: "espn",
      athletes: [],
    },
  ]);
  assert.deepEqual(plan.marketOdds, [
    {
      matchId: "fifa-match-400021440",
      marketType: "spread",
      optionName: "CZE -0.5",
      source: "espn:DraftKings",
      currentOdds: null,
      impliedProbability: null,
    },
    {
      matchId: "fifa-match-400021440",
      marketType: "total",
      optionName: "Over/Under 2.5",
      source: "espn:DraftKings",
      currentOdds: null,
      impliedProbability: null,
    },
  ]);
  assert.deepEqual(plan.teamRecentForm, [
    {
      teamId: "team-czechia",
      source: "espn",
      externalEventId: "761378",
      eventDate: new Date("2026-03-26T19:45Z"),
      homeScore: 2,
      awayScore: 2,
      teamScore: null,
      opponentScore: null,
      result: null,
      isHome: null,
    },
    {
      teamId: "team-czechia",
      source: "espn",
      externalEventId: "761379",
      eventDate: new Date("2026-03-30T19:45Z"),
      homeScore: 1,
      awayScore: 3,
      teamScore: 3,
      opponentScore: 1,
      result: "W",
      isHome: false,
    },
  ]);
  assert.deepEqual(plan.unmapped, []);
});

test("buildEspnSyncPlan records unmapped external teams without throwing", () => {
  const plan = buildEspnSyncPlan({
    externalMatchId: "760438",
    teams: [{ externalTeamId: "999", name: "Unknown", side: "home" }],
    teamMatchStats: [{ externalTeamId: "999", stats: { totalGoals: 1 } }],
  }, {
    matchId: "match-1",
    teamIdByExternalId: new Map(),
  });

  assert.deepEqual(plan.externalIds, [
    { entityType: "match", localId: "match-1", source: "espn", externalId: "760438" },
  ]);
  assert.deepEqual(plan.teamMatchStats, []);
  assert.deepEqual(plan.unmapped, [
    { entityType: "team", source: "espn", externalId: "999", name: "Unknown" },
    { entityType: "team", source: "espn", externalId: "999" },
  ]);
});
