import assert from "node:assert/strict";
import test from "node:test";

import { resolveTeamStrength } from "./teamStrength.js";

test("resolveTeamStrength matches localized Chinese team names to baseline profiles", () => {
  const strength = resolveTeamStrength({ name: "乌兹别克斯坦" });

  assert.equal(strength.source, "baseline");
  assert.equal(strength.code, "UZB");
  assert.equal(strength.rank, 55);
  assert.equal(strength.confederation, "AFC");
});

test("resolveTeamStrength derives attack and defense from a database FIFA rank without a baseline profile", () => {
  const strength = resolveTeamStrength({ name: "Testland", countryCode: "TST", fifaRank: 12 });

  assert.equal(strength.source, "database");
  assert.equal(strength.rank, 12);
  assert.equal(strength.code, "TST");
  assert.ok(strength.attack > 1);
  assert.ok(strength.defense > 1);
  assert.ok(strength.confidence >= 0.65);
});

test("resolveTeamStrength tags 2026 host teams for model adjustments", () => {
  const strength = resolveTeamStrength({ name: "墨西哥", countryCode: "MEX" });

  assert.equal(strength.source, "baseline");
  assert.equal(strength.host, true);
  assert.equal(strength.confederation, "CONCACAF");
});

test("resolveTeamStrength identifies unresolved knockout and group placeholders", () => {
  const groupPlaceholder = resolveTeamStrength({ name: "A组第2", countryCode: "2A" });
  const winnerPlaceholder = resolveTeamStrength({ name: "第73场胜者", countryCode: "W73" });

  assert.equal(groupPlaceholder.source, "placeholder");
  assert.equal(groupPlaceholder.placeholderType, "group-slot");
  assert.equal(groupPlaceholder.confidence, 0.1);
  assert.equal(winnerPlaceholder.source, "placeholder");
  assert.equal(winnerPlaceholder.placeholderType, "match-winner");
  assert.equal(winnerPlaceholder.confidence, 0.1);
});
