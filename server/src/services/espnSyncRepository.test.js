import assert from "node:assert/strict";
import test from "node:test";

import { persistEspnSyncPlan } from "./espnSyncRepository.js";

function createFakePrisma() {
  const calls = [];
  const tx = {
    externalId: {
      upsert: async (args) => calls.push(["externalId.upsert", args]),
    },
    teamMatchStat: {
      upsert: async (args) => calls.push(["teamMatchStat.upsert", args]),
    },
    matchLineup: {
      upsert: async (args) => calls.push(["matchLineup.upsert", args]),
    },
    teamRecentForm: {
      upsert: async (args) => calls.push(["teamRecentForm.upsert", args]),
    },
    match: {
      update: async (args) => calls.push(["match.update", args]),
    },
    marketOdd: {
      deleteMany: async (args) => calls.push(["marketOdd.deleteMany", args]),
      createMany: async (args) => calls.push(["marketOdd.createMany", args]),
    },
  };

  return {
    calls,
    client: {
      $transaction: async (callback) => callback(tx),
    },
  };
}

test("persistEspnSyncPlan upserts ESPN enrichment rows and refreshes ESPN odds", async () => {
  const { calls, client } = createFakePrisma();

  const result = await persistEspnSyncPlan(client, {
    externalIds: [
      { entityType: "match", localId: "match-1", source: "espn", externalId: "760438" },
    ],
    matchUpdate: {
      matchId: "match-1",
      status: "finished",
      homeScore: 2,
      awayScore: 1,
    },
    teamMatchStats: [
      { matchId: "match-1", teamId: "team-1", source: "espn", stats: { totalGoals: 1 } },
    ],
    lineups: [
      { matchId: "match-1", teamId: "team-1", source: "espn", athletes: [] },
    ],
    teamRecentForm: [
      {
        teamId: "team-1",
        source: "espn",
        externalEventId: "past-1",
        eventDate: new Date("2026-03-26T19:45Z"),
        homeScore: 2,
        awayScore: 2,
      },
    ],
    marketOdds: [
      {
        matchId: "match-1",
        marketType: "spread",
        optionName: "CZE -0.5",
        source: "espn:DraftKings",
        currentOdds: null,
        impliedProbability: null,
      },
    ],
  });

  assert.deepEqual(result, {
    externalIds: 1,
    matchUpdate: 1,
    teamMatchStats: 1,
    lineups: 1,
    teamRecentForm: 1,
    marketOdds: 1,
  });
  assert.equal(calls[0][0], "externalId.upsert");
  assert.deepEqual(calls[0][1].where, {
    source_entityType_externalId: {
      source: "espn",
      entityType: "match",
      externalId: "760438",
    },
  });
  assert.equal(calls[1][0], "match.update");
  assert.deepEqual(calls[1][1], {
    where: { id: "match-1" },
    data: {
      status: "finished",
      homeScore: 2,
      awayScore: 1,
    },
  });
  assert.equal(calls[2][0], "teamMatchStat.upsert");
  assert.deepEqual(calls[2][1].where, {
    matchId_teamId_source: {
      matchId: "match-1",
      teamId: "team-1",
      source: "espn",
    },
  });
  assert.equal(calls[5][0], "marketOdd.deleteMany");
  assert.deepEqual(calls[5][1], {
    where: {
      OR: [
        {
          matchId: "match-1",
          source: "espn:DraftKings",
        },
      ],
    },
  });
  assert.equal(calls[6][0], "marketOdd.createMany");
  assert.equal(calls[6][1].data.length, 1);
});

test("persistEspnSyncPlan skips empty market refresh safely", async () => {
  const { calls, client } = createFakePrisma();

  const result = await persistEspnSyncPlan(client, {});

  assert.deepEqual(result, {
    externalIds: 0,
    matchUpdate: 0,
    teamMatchStats: 0,
    lineups: 0,
    teamRecentForm: 0,
    marketOdds: 0,
  });
  assert.deepEqual(calls, []);
});
