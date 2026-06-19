import assert from "node:assert/strict";
import test from "node:test";

import { syncEspnEnrichment } from "./espnEnrichmentSyncService.js";

test("syncEspnEnrichment matches ESPN events and persists enrichment plans", async () => {
  const persisted = [];
  const result = await syncEspnEnrichment({
    prisma: {
      match: {
        findMany: async () => [
          {
            id: "fifa-match-400021440",
            kickoffAt: new Date("2026-06-18T16:00:00Z"),
            homeTeamId: "team-czechia",
            awayTeamId: "team-south-africa",
            homeTeam: { id: "team-czechia", name: "Czechia", nameEn: "Czechia" },
            awayTeam: { id: "team-south-africa", name: "South Africa", nameEn: "South Africa" },
          },
        ],
      },
    },
    fetchScoreboard: async () => ({
      events: [
        {
          id: "760438",
          date: "2026-06-18T16:00Z",
          competitions: [
            {
              competitors: [
                { homeAway: "home", team: { displayName: "Czechia" } },
                { homeAway: "away", team: { displayName: "South Africa" } },
              ],
            },
          ],
        },
      ],
    }),
    fetchSummary: async () => ({
      header: {
        id: "760438",
        competitions: [
          {
            competitors: [
              { homeAway: "home", team: { id: "450", displayName: "Czechia" } },
              { homeAway: "away", team: { id: "467", displayName: "South Africa" } },
            ],
          },
        ],
      },
      boxscore: {
        teams: [
          { team: { id: "450", displayName: "Czechia" }, statistics: [{ name: "totalGoals", value: 1 }] },
        ],
      },
      lastFiveGames: [
        { team: { id: "450", displayName: "Czechia" }, events: [{ id: "past-1", gameDate: "2026-03-26T19:45Z" }] },
      ],
      odds: [{ provider: { name: "DraftKings" }, details: "CZE -0.5", overUnder: 2.5 }],
    }),
    persistPlan: async (_client, plan) => {
      persisted.push(plan);
      return {
        externalIds: plan.externalIds.length,
        teamMatchStats: plan.teamMatchStats.length,
        lineups: plan.lineups.length,
        teamRecentForm: plan.teamRecentForm.length,
        marketOdds: plan.marketOdds.length,
      };
    },
  });

  assert.equal(result.events, 1);
  assert.equal(result.matched, 1);
  assert.equal(result.persisted, 1);
  assert.equal(result.unmatched, 0);
  assert.equal(persisted[0].externalIds.length, 3);
  assert.equal(persisted[0].teamMatchStats.length, 1);
  assert.equal(persisted[0].marketOdds.length, 2);
});

test("syncEspnEnrichment dry run builds plans without persisting", async () => {
  let persisted = false;
  const result = await syncEspnEnrichment({
    dryRun: true,
    prisma: {
      match: {
        findMany: async () => [],
      },
    },
    fetchScoreboard: async () => ({ events: [] }),
    fetchSummary: async () => ({}),
    persistPlan: async () => {
      persisted = true;
    },
  });

  assert.equal(persisted, false);
  assert.equal(result.dryRun, true);
  assert.equal(result.events, 0);
});

test("syncEspnEnrichment expands date ranges and deduplicates ESPN events", async () => {
  const requestedDates = [];
  const result = await syncEspnEnrichment({
    dryRun: true,
    dateFrom: "2026-06-18",
    dateTo: "2026-06-19",
    prisma: {
      match: {
        findMany: async () => [],
      },
    },
    fetchScoreboard: async ({ dates }) => {
      requestedDates.push(dates);
      return {
        events: [
          { id: "event-shared", date: "2026-06-18T16:00Z" },
          { id: `event-${dates}`, date: "2026-06-18T16:00Z" },
        ],
      };
    },
    fetchSummary: async () => ({}),
  });

  assert.deepEqual(requestedDates, ["20260618", "20260619"]);
  assert.equal(result.events, 3);
  assert.equal(result.scoreboardRequests.length, 2);
  assert.deepEqual(result.scoreboardRequests.map((request) => request.dates), ["20260618", "20260619"]);
});
