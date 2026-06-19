import assert from "node:assert/strict";
import test from "node:test";

import { buildEspnMatchDiagnostics, buildTeamIdMapForEspnDraft, findDatabaseMatchForEspnEvent } from "./espnMatchResolver.js";

const databaseMatches = [
  {
    id: "fifa-match-400021446",
    kickoffAt: new Date("2026-06-18T19:00:00Z"),
    homeTeamId: "team-switzerland",
    awayTeamId: "team-bosnia",
    homeTeam: { id: "team-switzerland", name: "Switzerland", nameEn: "Switzerland" },
    awayTeam: { id: "team-bosnia", name: "Bosnia and Herzegovina", nameEn: "Bosnia and Herzegovina" },
  },
];

test("findDatabaseMatchForEspnEvent matches by kickoff time and normalized team names", () => {
  const match = findDatabaseMatchForEspnEvent({
    id: "760439",
    date: "2026-06-18T19:00Z",
    competitions: [
      {
        competitors: [
          { homeAway: "home", team: { displayName: "Switzerland" } },
          { homeAway: "away", team: { displayName: "Bosnia-Herzegovina" } },
        ],
      },
    ],
  }, databaseMatches);

  assert.equal(match.id, "fifa-match-400021446");
});

test("findDatabaseMatchForEspnEvent rejects wrong team at same time", () => {
  const match = findDatabaseMatchForEspnEvent({
    date: "2026-06-18T19:00Z",
    competitions: [
      {
        competitors: [
          { homeAway: "home", team: { displayName: "Switzerland" } },
          { homeAway: "away", team: { displayName: "Qatar" } },
        ],
      },
    ],
  }, databaseMatches);

  assert.equal(match, null);
});

test("findDatabaseMatchForEspnEvent handles South Korea alias", () => {
  const match = findDatabaseMatchForEspnEvent({
    date: "2026-06-19T01:00Z",
    competitions: [
      {
        competitors: [
          { homeAway: "home", team: { displayName: "Mexico" } },
          { homeAway: "away", team: { displayName: "South Korea" } },
        ],
      },
    ],
  }, [
    {
      id: "fifa-match-400021442",
      kickoffAt: new Date("2026-06-19T01:00:00Z"),
      homeTeam: { name: "Mexico", nameEn: "Mexico" },
      awayTeam: { name: "Korea Republic", nameEn: "Korea Republic" },
    },
  ]);

  assert.equal(match.id, "fifa-match-400021442");
});

test("findDatabaseMatchForEspnEvent handles FIFA country naming aliases", () => {
  const matches = [
    {
      id: "fifa-match-400021467",
      kickoffAt: new Date("2026-06-14T23:00:00Z"),
      homeTeam: { name: "Côte d'Ivoire", nameEn: "Côte d'Ivoire" },
      awayTeam: { name: "Ecuador", nameEn: "Ecuador" },
    },
    {
      id: "fifa-match-400021482",
      kickoffAt: new Date("2026-06-15T16:00:00Z"),
      homeTeam: { name: "Spain", nameEn: "Spain" },
      awayTeam: { name: "Cabo Verde", nameEn: "Cabo Verde" },
    },
    {
      id: "fifa-match-400021476",
      kickoffAt: new Date("2026-06-16T01:00:00Z"),
      homeTeam: { name: "IR Iran", nameEn: "IR Iran" },
      awayTeam: { name: "New Zealand", nameEn: "New Zealand" },
    },
  ];

  const ivoryCoastMatch = findDatabaseMatchForEspnEvent({
    date: "2026-06-14T23:00Z",
    competitions: [{ competitors: [
      { homeAway: "home", team: { displayName: "Ivory Coast" } },
      { homeAway: "away", team: { displayName: "Ecuador" } },
    ] }],
  }, matches);
  const capeVerdeMatch = findDatabaseMatchForEspnEvent({
    date: "2026-06-15T16:00Z",
    competitions: [{ competitors: [
      { homeAway: "home", team: { displayName: "Spain" } },
      { homeAway: "away", team: { displayName: "Cape Verde" } },
    ] }],
  }, matches);
  const iranMatch = findDatabaseMatchForEspnEvent({
    date: "2026-06-16T01:00Z",
    competitions: [{ competitors: [
      { homeAway: "home", team: { displayName: "Iran" } },
      { homeAway: "away", team: { displayName: "New Zealand" } },
    ] }],
  }, matches);

  assert.equal(ivoryCoastMatch.id, "fifa-match-400021467");
  assert.equal(capeVerdeMatch.id, "fifa-match-400021482");
  assert.equal(iranMatch.id, "fifa-match-400021476");
});

test("buildTeamIdMapForEspnDraft maps ESPN team ids to matched home and away teams", () => {
  const map = buildTeamIdMapForEspnDraft({
    teams: [
      { externalTeamId: "475", name: "Switzerland", side: "home" },
      { externalTeamId: "497", name: "Bosnia-Herzegovina", side: "away" },
    ],
  }, databaseMatches[0]);

  assert.equal(map.get("475"), "team-switzerland");
  assert.equal(map.get("497"), "team-bosnia");
});

test("buildEspnMatchDiagnostics explains the nearest local candidates for unmatched events", () => {
  const diagnostics = buildEspnMatchDiagnostics({
    id: "760999",
    date: "2026-06-18T19:20Z",
    competitions: [
      {
        competitors: [
          { homeAway: "home", team: { displayName: "Switzerland" } },
          { homeAway: "away", team: { displayName: "Qatar" } },
        ],
      },
    ],
  }, databaseMatches);

  assert.deepEqual(diagnostics.event, {
    id: "760999",
    kickoffAt: "2026-06-18T19:20Z",
    home: "Switzerland",
    away: "Qatar",
    normalizedHome: "switzerland",
    normalizedAway: "qatar",
  });
  assert.equal(diagnostics.reason, "TEAM_MISMATCH");
  assert.equal(diagnostics.candidates[0].matchId, "fifa-match-400021446");
  assert.equal(diagnostics.candidates[0].timeDiffMinutes, 20);
  assert.equal(diagnostics.candidates[0].homeMatches, true);
  assert.equal(diagnostics.candidates[0].awayMatches, false);
});
