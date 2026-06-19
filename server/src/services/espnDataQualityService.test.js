import assert from "node:assert/strict";
import test from "node:test";

import { buildEspnDataQualityReport } from "./espnDataQualityService.js";

test("buildEspnDataQualityReport summarizes ESPN enrichment coverage and risks", () => {
  const report = buildEspnDataQualityReport({
    totalMatches: 104,
    externalIds: [
      { entityType: "match", localId: "match-1", source: "espn", externalId: "760438" },
      { entityType: "match", localId: "match-2", source: "espn", externalId: "760439" },
      { entityType: "team", localId: "team-1", source: "espn", externalId: "450" },
      { entityType: "team", localId: "team-2", source: "espn", externalId: "467" },
    ],
    teamMatchStats: [
      { matchId: "match-1", teamId: "team-1" },
      { matchId: "match-1", teamId: "team-2" },
      { matchId: "match-2", teamId: "team-1" },
    ],
    teamRecentForm: [
      { teamId: "team-1", externalEventId: "past-1" },
      { teamId: "team-1", externalEventId: "past-2" },
      { teamId: "team-2", externalEventId: "past-3" },
    ],
    lineups: [
      { matchId: "match-1", teamId: "team-1", athletes: [] },
      { matchId: "match-1", teamId: "team-2", athletes: [{ name: "Player A" }] },
    ],
    marketOdds: [
      { matchId: "match-1", marketType: "spread", source: "espn:DraftKings" },
      { matchId: "match-1", marketType: "total", source: "espn:DraftKings" },
    ],
  });

  assert.equal(report.source, "espn");
  assert.equal(report.coverage.matches.synced, 2);
  assert.equal(report.coverage.matches.total, 104);
  assert.equal(report.coverage.matches.percent, 1.9);
  assert.equal(report.coverage.teams.externalIds, 2);
  assert.equal(report.coverage.teamMatchStats.matches, 2);
  assert.equal(report.coverage.teamMatchStats.rows, 3);
  assert.equal(report.coverage.recentForm.teams, 2);
  assert.equal(report.coverage.recentForm.events, 3);
  assert.equal(report.coverage.marketOdds.matches, 1);
  assert.equal(report.coverage.marketOdds.rows, 2);
  assert.equal(report.coverage.lineups.matches, 1);
  assert.equal(report.coverage.lineups.rows, 2);
  assert.equal(report.coverage.lineups.withAthletes, 1);
  assert.equal(report.risks.some((risk) => risk.code === "LINEUP_ATHLETES_LOW"), true);
});

test("buildEspnDataQualityReport handles empty ESPN data", () => {
  const report = buildEspnDataQualityReport({ totalMatches: 104 });

  assert.equal(report.coverage.matches.synced, 0);
  assert.equal(report.coverage.matches.percent, 0);
  assert.equal(report.risks.some((risk) => risk.code === "NO_ESPN_MATCHES"), true);
});
