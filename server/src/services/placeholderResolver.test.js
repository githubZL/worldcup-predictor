import assert from "node:assert/strict";
import test from "node:test";

import { resolveMatchPlaceholders } from "./placeholderResolver.js";

const venue = { id: "venue-1" };
const mexico = { id: "mex", name: "Mexico", countryCode: "MEX" };
const southAfrica = { id: "rsa", name: "South Africa", countryCode: "RSA" };
const czechia = { id: "cze", name: "Czechia", countryCode: "CZE" };

function match(overrides) {
  return {
    id: overrides.id,
    time: overrides.time ?? "2026-06-18T16:00:00.000Z",
    stage: overrides.stage ?? "First Stage",
    group: overrides.group ?? "A",
    status: overrides.status ?? "finished",
    homeTeam: overrides.homeTeam,
    awayTeam: overrides.awayTeam,
    homeScore: overrides.homeScore ?? 0,
    awayScore: overrides.awayScore ?? 0,
    venue,
  };
}

test("resolveMatchPlaceholders inherits group rank slots from finished group standings", () => {
  const matches = resolveMatchPlaceholders([
    match({
      id: "match-1",
      homeTeam: mexico,
      awayTeam: southAfrica,
      homeScore: 2,
      awayScore: 0,
    }),
    match({
      id: "match-2",
      homeTeam: czechia,
      awayTeam: southAfrica,
      homeScore: 1,
      awayScore: 0,
    }),
    match({
      id: "match-3",
      status: "scheduled",
      homeScore: null,
      awayScore: null,
      homeTeam: { id: "placeholder-1A", name: "1A", countryCode: "1A" },
      awayTeam: { id: "placeholder-2A", name: "2A", countryCode: "2A" },
    }),
  ]);
  const knockout = matches[2];

  assert.equal(knockout.homeTeam.id, "mex");
  assert.equal(knockout.homeTeam.placeholderResolvedFrom.code, "1A");
  assert.equal(knockout.awayTeam.id, "cze");
  assert.equal(knockout.awayTeam.placeholderResolvedFrom.code, "2A");
});

test("resolveMatchPlaceholders inherits match winner and loser slots from prior finished match", () => {
  const matches = resolveMatchPlaceholders([
    match({
      id: "match-1",
      homeTeam: mexico,
      awayTeam: southAfrica,
      homeScore: 1,
      awayScore: 2,
    }),
    match({
      id: "match-2",
      status: "scheduled",
      stage: "Round of 16",
      group: null,
      homeScore: null,
      awayScore: null,
      homeTeam: { id: "placeholder-W1", name: "W1", countryCode: "W1" },
      awayTeam: { id: "placeholder-RU1", name: "RU1", countryCode: "RU1" },
    }),
  ]);
  const nextMatch = matches[1];

  assert.equal(nextMatch.homeTeam.id, "rsa");
  assert.equal(nextMatch.homeTeam.placeholderResolvedFrom.type, "match-winner");
  assert.equal(nextMatch.awayTeam.id, "mex");
  assert.equal(nextMatch.awayTeam.placeholderResolvedFrom.type, "match-loser");
});

test("resolveMatchPlaceholders keeps unresolved third-place pools as placeholders", () => {
  const matches = resolveMatchPlaceholders([
    match({
      id: "match-1",
      status: "scheduled",
      homeScore: null,
      awayScore: null,
      homeTeam: { id: "placeholder-3ABCDF", name: "3ABCDF", countryCode: "3ABCDF" },
      awayTeam: southAfrica,
    }),
  ]);

  assert.equal(matches[0].homeTeam.id, "placeholder-3ABCDF");
  assert.equal(matches[0].homeTeam.placeholderResolution?.status, "unresolved");
});
