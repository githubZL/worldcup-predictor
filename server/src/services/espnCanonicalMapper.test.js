import assert from "node:assert/strict";
import test from "node:test";

import { mapEspnSummaryToCanonicalDraft } from "./espnCanonicalMapper.js";

test("mapEspnSummaryToCanonicalDraft maps standings, last five, odds, boxscore, and roster drafts", () => {
  const draft = mapEspnSummaryToCanonicalDraft({
    header: {
      id: "760438",
      competitions: [
        {
          status: { type: { state: "post", completed: true, description: "Final" } },
          competitors: [
            { homeAway: "home", id: "203", team: { id: "203", displayName: "Mexico" }, score: "2" },
            { homeAway: "away", id: "257", team: { id: "257", displayName: "South Africa" }, score: "1" },
          ],
        },
      ],
    },
    boxscore: {
      teams: [
        {
          team: { id: "203", displayName: "Mexico" },
          statistics: [
            { name: "totalGoals", displayValue: "2" },
            { name: "goalAssists", displayValue: "1" },
          ],
        },
      ],
    },
    rosters: [
      {
        team: { id: "203", displayName: "Mexico" },
        roster: [
          { athlete: { id: "9", displayName: "Player A" }, starter: true, position: { abbreviation: "FW" } },
        ],
      },
    ],
    standings: {
      groups: [
        {
          name: "Group A",
          standings: {
            entries: [
              {
                team: { id: "203", displayName: "Mexico" },
                stats: [
                  { name: "points", value: 3 },
                  { name: "pointDifferential", value: 1 },
                ],
              },
            ],
          },
        },
      ],
    },
    odds: [
      {
        provider: { name: "DraftKings" },
        details: "MEX -120",
        overUnder: 2.5,
      },
    ],
    lastFiveGames: [
      {
        team: { id: "203", displayName: "Mexico" },
        events: [
          {
            id: "past-1",
            gameDate: "2026-06-01T00:00Z",
            homeTeamId: "203",
            awayTeamId: "257",
            homeTeamScore: "1",
            awayTeamScore: "0",
          },
          {
            id: "past-2",
            gameDate: "2026-06-05T00:00Z",
            homeTeamId: "999",
            awayTeamId: "203",
            homeTeamScore: "0",
            awayTeamScore: "0",
          },
        ],
      },
    ],
  }, { sourceEventId: "760438" });

  assert.equal(draft.source, "espn");
  assert.equal(draft.externalMatchId, "760438");
  assert.deepEqual(draft.matchResult, {
    status: "finished",
    homeScore: 2,
    awayScore: 1,
  });
  assert.deepEqual(draft.teams, [
    { externalTeamId: "203", name: "Mexico", side: "home", score: 2 },
    { externalTeamId: "257", name: "South Africa", side: "away", score: 1 },
  ]);
  assert.deepEqual(draft.teamMatchStats[0], {
    externalTeamId: "203",
    teamName: "Mexico",
    stats: {
      totalGoals: 2,
      goalAssists: 1,
    },
  });
  assert.deepEqual(draft.lineups[0], {
    externalTeamId: "203",
    teamName: "Mexico",
    athletes: [
      {
        externalAthleteId: "9",
        name: "Player A",
        position: "FW",
        starter: true,
      },
    ],
  });
  assert.deepEqual(draft.standings[0], {
    group: "Group A",
    externalTeamId: "203",
    teamName: "Mexico",
    stats: {
      points: 3,
      pointDifferential: 1,
    },
  });
  assert.deepEqual(draft.odds[0], {
    provider: "DraftKings",
    details: "MEX -120",
    overUnder: 2.5,
  });
  assert.deepEqual(draft.recentForm[0].events, [
    {
      externalEventId: "past-1",
      date: "2026-06-01T00:00Z",
      homeTeamId: "203",
      awayTeamId: "257",
      homeScore: 1,
      awayScore: 0,
      teamScore: 1,
      opponentScore: 0,
      result: "W",
      isHome: true,
    },
    {
      externalEventId: "past-2",
      date: "2026-06-05T00:00Z",
      homeTeamId: "999",
      awayTeamId: "203",
      homeScore: 0,
      awayScore: 0,
      teamScore: 0,
      opponentScore: 0,
      result: "D",
      isHome: false,
    },
  ]);
});

test("mapEspnSummaryToCanonicalDraft handles missing optional sections", () => {
  const draft = mapEspnSummaryToCanonicalDraft({}, { sourceEventId: "missing" });

  assert.equal(draft.externalMatchId, "missing");
  assert.deepEqual(draft.teams, []);
  assert.deepEqual(draft.teamMatchStats, []);
  assert.deepEqual(draft.lineups, []);
  assert.deepEqual(draft.standings, []);
  assert.deepEqual(draft.odds, []);
  assert.deepEqual(draft.recentForm, []);
});
