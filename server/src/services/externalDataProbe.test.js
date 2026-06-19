import assert from "node:assert/strict";
import test from "node:test";

import { buildExternalDataProbeReport } from "./externalDataProbe.js";

test("buildExternalDataProbeReport summarizes ESPN scoreboard coverage and fields", () => {
  const report = buildExternalDataProbeReport({
    espnScoreboard: {
      status: "fulfilled",
      value: {
        events: [
          {
            id: "401756001",
            date: "2026-06-18T19:00Z",
            status: { type: { state: "pre", description: "Scheduled" } },
            competitions: [
              {
                venue: { fullName: "Estadio Azteca" },
                competitors: [
                  { homeAway: "home", team: { displayName: "Mexico" }, score: "0" },
                  { homeAway: "away", team: { displayName: "South Africa" }, score: "0" },
                ],
              },
            ],
          },
        ],
      },
    },
  });

  assert.equal(report.sources.espnScoreboard.ok, true);
  assert.equal(report.sources.espnScoreboard.recordCount, 1);
  assert.deepEqual(report.sources.espnScoreboard.capabilities, [
    "matches",
    "scores",
    "status",
    "venues",
    "teams",
    "events",
  ]);
  assert.equal(report.sources.espnScoreboard.samples[0].home, "Mexico");
});

test("buildExternalDataProbeReport summarizes worldcup26 games and teams", () => {
  const report = buildExternalDataProbeReport({
    worldcup26Games: {
      status: "fulfilled",
      value: [
        {
          id: 1,
          homeTeam: "Mexico",
          awayTeam: "South Africa",
          homeScore: 2,
          awayScore: 1,
          group: "A",
          stadium: "Azteca",
        },
      ],
    },
    worldcup26Teams: {
      status: "fulfilled",
      value: [
        {
          id: 1,
          name: "Mexico",
          flag: "https://flagcdn.com/mx.svg",
          group: "A",
        },
      ],
    },
  });

  assert.equal(report.sources.worldcup26Games.recordCount, 1);
  assert.ok(report.sources.worldcup26Games.capabilities.includes("matches"));
  assert.ok(report.sources.worldcup26Games.capabilities.includes("scores"));
  assert.equal(report.sources.worldcup26Teams.recordCount, 1);
  assert.ok(report.sources.worldcup26Teams.capabilities.includes("flags"));
});

test("buildExternalDataProbeReport keeps failed source errors isolated", () => {
  const report = buildExternalDataProbeReport({
    espnSummary: {
      status: "rejected",
      reason: new Error("404 Not Found"),
    },
  });

  assert.equal(report.sources.espnSummary.ok, false);
  assert.equal(report.sources.espnSummary.error, "404 Not Found");
  assert.equal(report.recommendations[0].priority, "probe-first");
});

test("buildExternalDataProbeReport detects ESPN summary top-level capabilities", () => {
  const report = buildExternalDataProbeReport({
    espnSummary: {
      status: "fulfilled",
      value: {
        boxscore: {},
        odds: [],
        rosters: [],
        standings: {},
        header: {},
      },
    },
  });

  assert.deepEqual(report.sources.espnSummary.capabilities, [
    "scores",
    "status",
    "teams",
    "players",
    "lineups",
    "standings",
    "odds",
  ]);
});

test("buildExternalDataProbeReport summarizes ESPN summary detail sections", () => {
  const report = buildExternalDataProbeReport({
    espnSummary: {
      status: "fulfilled",
      value: {
        boxscore: {
          teams: [
            {
              team: { displayName: "Mexico" },
              statistics: [
                { name: "shotsOnTarget", displayName: "Shots on Target" },
                { name: "possessionPct", displayName: "Possession" },
              ],
            },
          ],
        },
        rosters: [
          {
            team: { displayName: "Mexico" },
            roster: [
              { athlete: { displayName: "Player A" }, starter: true, position: { abbreviation: "FW" } },
              { athlete: { displayName: "Player B" }, starter: false, position: { abbreviation: "MF" } },
            ],
          },
        ],
        standings: {
          groups: [
            {
              name: "Group A",
              standings: {
                entries: [
                  { team: { displayName: "Mexico" }, stats: [{ name: "points", value: 3 }] },
                ],
              },
            },
          ],
        },
        odds: [
          { provider: { name: "ESPN BET" }, details: "MEX -120" },
        ],
        lastFiveGames: [
          { team: { displayName: "Mexico" }, events: [{ id: "1" }, { id: "2" }] },
        ],
      },
    },
  });

  assert.deepEqual(report.sources.espnSummary.details, {
    boxscore: {
      teamCount: 1,
      statisticNames: ["Shots on Target", "Possession"],
    },
    rosters: {
      teamCount: 1,
      athleteCount: 2,
      starterCount: 1,
      positions: ["FW", "MF"],
    },
    standings: {
      groupCount: 1,
      entryCount: 1,
    },
    odds: {
      marketCount: 1,
      providers: ["ESPN BET"],
    },
    lastFiveGames: {
      teamCount: 1,
      eventCount: 2,
    },
  });
});
