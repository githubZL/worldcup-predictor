import assert from "node:assert/strict";
import test from "node:test";

import { buildPrediction, buildPredictionFromSnapshot, buildPredictionReview, buildPredictionSnapshotRecord } from "./predictionService.js";

const baseMatch = {
  homeScore: null,
  awayScore: null,
  time: "2026-06-18T16:00:00.000Z",
};

const homeTeam = {
  name: "墨西哥",
  fifaRank: 15,
};

const awayTeam = {
  name: "南非",
  fifaRank: 58,
};

const venue = {
  altitude: 2240,
};

test("buildPrediction keeps legacy fields and exposes structured prediction breakdown", () => {
  const prediction = buildPrediction(baseMatch, homeTeam, awayTeam, venue, "晴 22°C");

  assert.equal(prediction.modelVersion, "poisson-v0.8");
  assert.equal(prediction.predictionBreakdown.modelVersion, "poisson-v0.8");
  assert.deepEqual(Object.keys(prediction.predictionBreakdown.markets), ["fullTime", "score", "halfFull", "handicap", "blowout"]);
  assert.deepEqual(Object.keys(prediction.predictionBreakdown.modelSignals), [
    "baseStrength",
    "form",
    "production",
    "fatigue",
    "environment",
    "tactical",
    "availability",
    "upsetRisk",
  ]);
  assert.equal(prediction.predictionBreakdown.markets.fullTime.pick, prediction.fullPick);
  assert.equal(prediction.predictionBreakdown.markets.score.label, prediction.score);
  assert.equal(prediction.predictionBreakdown.markets.halfFull.label, prediction.halfFull);
  assert.equal(prediction.predictionBreakdown.markets.handicap.pick, prediction.handicapPick);
  assert.equal(prediction.predictionBreakdown.xg.home, prediction.xg[0]);
  assert.equal(prediction.predictionBreakdown.factors[0].name, prediction.factors[0][0]);
});

test("buildPrediction derives score and winner markets from a Poisson score matrix", () => {
  const prediction = buildPrediction(baseMatch, homeTeam, awayTeam, venue, "晴 22°C");
  const scorelines = prediction.predictionBreakdown.scorelines;
  const fullTime = prediction.predictionBreakdown.markets.fullTime;
  const probabilityTotal = fullTime.probabilities.homeWin + fullTime.probabilities.draw + fullTime.probabilities.awayWin;

  assert.equal(prediction.modelVersion, "poisson-v0.8");
  assert.equal(prediction.predictionBreakdown.scoreMatrix.maxGoals, 6);
  assert.equal(scorelines.length, 5);
  assert.equal(prediction.score, scorelines[0].label.replace("-", " - "));
  assert.equal(prediction.predictionBreakdown.markets.score.probability, scorelines[0].probability);
  assert.ok(scorelines.every((line, index) => index === 0 || line.probability <= scorelines[index - 1].probability));
  assert.ok(Math.abs(probabilityTotal - 100) <= 1);
  assert.deepEqual(prediction.probs, [
    fullTime.probabilities.homeWin,
    fullTime.probabilities.draw,
    fullTime.probabilities.awayWin,
  ]);
});

test("buildPrediction lifts blowout probability only for clear strength mismatches", () => {
  const mismatchPrediction = buildPrediction(
    { ...baseMatch, stage: "小组赛" },
    { name: "Germany", countryCode: "GER", fifaRank: null },
    { name: "Curacao", countryCode: "CUW", fifaRank: null },
    { altitude: 0 },
    "晴 22°C",
  );
  const balancedPrediction = buildPrediction(
    { ...baseMatch, stage: "小组赛" },
    { name: "Spain", countryCode: "ESP", fifaRank: null },
    { name: "Germany", countryCode: "GER", fifaRank: null },
    { altitude: 0 },
    "晴 22°C",
  );

  assert.equal(mismatchPrediction.predictionBreakdown.xg.adjustments.mismatch.triggered, true);
  assert.ok(mismatchPrediction.xg[0] >= 2.45);
  assert.ok(mismatchPrediction.xg[1] <= 0.7);
  assert.equal(mismatchPrediction.predictionBreakdown.markets.blowout.side, "home");
  assert.ok(mismatchPrediction.predictionBreakdown.markets.blowout.probability >= 28);
  assert.ok(mismatchPrediction.predictionBreakdown.scorelines.some((line) => line.label === "3-0"));

  assert.equal(balancedPrediction.predictionBreakdown.xg.adjustments.mismatch.triggered, false);
  assert.equal(balancedPrediction.predictionBreakdown.markets.blowout.side, "none");
  assert.ok(balancedPrediction.predictionBreakdown.markets.blowout.probability < 12);
});

test("buildPrediction exposes xG inputs and applies weather plus knockout dampening", () => {
  const balancedHome = { name: "Spain", countryCode: "ESP", fifaRank: null };
  const balancedAway = { name: "Germany", countryCode: "GER", fifaRank: null };
  const lowAltitudeVenue = { altitude: 100 };
  const groupPrediction = buildPrediction(
    { ...baseMatch, stage: "小组赛" },
    balancedHome,
    balancedAway,
    lowAltitudeVenue,
    "晴 22°C",
  );
  const knockoutPrediction = buildPrediction(
    { ...baseMatch, stage: "淘汰赛" },
    balancedHome,
    balancedAway,
    lowAltitudeVenue,
    "小雨 18°C",
  );

  assert.equal(groupPrediction.predictionBreakdown.xg.home, groupPrediction.xg[0]);
  assert.equal(groupPrediction.predictionBreakdown.xg.inputs.home.attack, 1.24);
  assert.equal(groupPrediction.predictionBreakdown.xg.inputs.away.defense, 1.07);
  assert.equal(knockoutPrediction.predictionBreakdown.xg.adjustments.stage.factor < 1, true);
  assert.equal(knockoutPrediction.predictionBreakdown.xg.adjustments.weather.factor < 1, true);
  assert.ok(knockoutPrediction.xg[0] + knockoutPrediction.xg[1] < groupPrediction.xg[0] + groupPrediction.xg[1]);
  assert.ok(knockoutPrediction.probs[1] >= groupPrediction.probs[1]);
});

test("buildPrediction includes confederation and host strength signals in xG inputs", () => {
  const prediction = buildPrediction(
    { ...baseMatch, stage: "小组赛" },
    { name: "墨西哥", countryCode: "MEX", fifaRank: null },
    { name: "南非", countryCode: "RSA", fifaRank: null },
    { altitude: 2240, country: "墨西哥" },
    "晴 22°C",
  );
  const xg = prediction.predictionBreakdown.xg;

  assert.equal(xg.inputs.home.confederation, "CONCACAF");
  assert.equal(xg.inputs.away.confederation, "CAF");
  assert.equal(xg.inputs.home.host, true);
  assert.equal(xg.adjustments.host.homeEdge > 0, true);
});

test("buildPrediction marks placeholder matches as low confidence and avoids overconfident markets", () => {
  const prediction = buildPrediction(
    { ...baseMatch, stage: "32强赛" },
    { name: "A组第2", countryCode: "2A", fifaRank: null },
    { name: "B组第2", countryCode: "2B", fifaRank: null },
    { altitude: 100, country: "美国" },
    "晴 22°C",
  );
  const fullTime = prediction.predictionBreakdown.markets.fullTime.probabilities;

  assert.equal(prediction.modelVersion, "poisson-v0.8");
  assert.equal(prediction.predictionBreakdown.strength.home.source, "placeholder");
  assert.equal(prediction.predictionBreakdown.strength.away.source, "placeholder");
  assert.equal(prediction.predictionBreakdown.xg.inputs.home.confidence, 0.1);
  assert.equal(prediction.predictionBreakdown.xg.adjustments.placeholder.factor < 1, true);
  assert.equal(prediction.risk, "高");
  assert.ok(Math.max(fullTime.homeWin, fullTime.draw, fullTime.awayWin) <= 40);
});

test("buildPrediction uses baseline team strength when fifa rank is missing", () => {
  const prediction = buildPrediction(
    baseMatch,
    { name: "Brazil", countryCode: "BRA", fifaRank: null },
    { name: "New Zealand", countryCode: "NZL", fifaRank: null },
    { altitude: 0 },
    "晴 22°C",
  );

  assert.notEqual(prediction.score, "1 - 1");
  assert.equal(prediction.fullPick, "主胜");
  assert.ok(prediction.probs[0] >= 60);
  assert.ok(prediction.xg[0] > prediction.xg[1]);
});

test("buildPrediction applies only whitelisted ESPN enrichment as a small model adjustment", () => {
  const plainPrediction = buildPrediction(baseMatch, homeTeam, awayTeam, { altitude: 0 }, "晴 22°C");
  const enrichedPrediction = buildPrediction(baseMatch, homeTeam, awayTeam, { altitude: 0 }, "晴 22°C", {
    source: "espn",
    home: {
      teamMatchStats: [
        { stats: { totalGoals: 3, goalsConceded: 0, goalDifference: 3 } },
        { stats: { totalGoals: 2, goalsConceded: 1, goalDifference: 1 } },
      ],
      recentForm: [
        { homeScore: 2, awayScore: 0 },
        { homeScore: 1, awayScore: 1 },
      ],
      marketOdds: [{ marketType: "spread" }],
      lineups: [{ athletes: [{ name: "Player A" }] }],
    },
    away: {
      teamMatchStats: [
        { stats: { totalGoals: 0, goalsConceded: 2, goalDifference: -2 } },
        { stats: { totalGoals: 1, goalsConceded: 2, goalDifference: -1 } },
      ],
      recentForm: [
        { homeScore: 0, awayScore: 1 },
        { homeScore: 1, awayScore: 2 },
      ],
      marketOdds: [{ marketType: "spread" }],
      lineups: [{ athletes: [] }],
    },
  });

  const whitelist = enrichedPrediction.predictionBreakdown.xg.adjustments.espnWhitelist;

  assert.ok(enrichedPrediction.xg[0] > plainPrediction.xg[0]);
  assert.ok(enrichedPrediction.xg[1] < plainPrediction.xg[1]);
  assert.equal(whitelist.source, "espn");
  assert.deepEqual(whitelist.appliedSignals, ["teamMatchStats", "recentFormTempo"]);
  assert.deepEqual(whitelist.ignoredSignals, ["marketOdds", "lineups"]);
  assert.equal(enrichedPrediction.predictionBreakdown.xg.components.espnHomeEdge > 0, true);
  assert.equal(enrichedPrediction.predictionBreakdown.xg.components.espnAwayEdge < 0, true);
});

test("buildPrediction upgrades ESPN recent form when team-oriented scores are available", () => {
  const plainPrediction = buildPrediction(baseMatch, homeTeam, awayTeam, { altitude: 0 }, "晴 22°C");
  const enrichedPrediction = buildPrediction(baseMatch, homeTeam, awayTeam, { altitude: 0 }, "晴 22°C", {
    source: "espn",
    home: {
      recentForm: [
        { teamScore: 2, opponentScore: 0, result: "W" },
        { teamScore: 1, opponentScore: 0, result: "W" },
        { teamScore: 1, opponentScore: 1, result: "D" },
      ],
    },
    away: {
      recentForm: [
        { teamScore: 0, opponentScore: 2, result: "L" },
        { teamScore: 1, opponentScore: 3, result: "L" },
        { teamScore: 1, opponentScore: 1, result: "D" },
      ],
    },
  });
  const whitelist = enrichedPrediction.predictionBreakdown.xg.adjustments.espnWhitelist;

  assert.ok(enrichedPrediction.xg[0] > plainPrediction.xg[0]);
  assert.ok(enrichedPrediction.xg[1] < plainPrediction.xg[1]);
  assert.deepEqual(whitelist.appliedSignals, ["recentFormRecord"]);
  assert.equal(whitelist.home.recentFormRecord.pointsPerMatch, 2.33);
  assert.equal(whitelist.away.recentFormRecord.pointsPerMatch, 0.33);
  assert.equal(enrichedPrediction.predictionBreakdown.xg.components.espnHomeFormEdge > 0, true);
  assert.equal(enrichedPrediction.predictionBreakdown.xg.components.espnAwayFormEdge < 0, true);
});

test("buildPrediction derives ESPN team stat edge from shot and possession fields", () => {
  const plainPrediction = buildPrediction(baseMatch, homeTeam, awayTeam, { altitude: 0 }, "晴 22°C");
  const enrichedPrediction = buildPrediction(baseMatch, homeTeam, awayTeam, { altitude: 0 }, "晴 22°C", {
    source: "espn",
    home: {
      teamMatchStats: [
        { stats: { totalShots: 18, shotsOnTarget: 7, possessionPct: 62 } },
      ],
    },
    away: {
      teamMatchStats: [
        { stats: { totalShots: 6, shotsOnTarget: 1, possessionPct: 38 } },
      ],
    },
  });

  const whitelist = enrichedPrediction.predictionBreakdown.xg.adjustments.espnWhitelist;

  assert.ok(enrichedPrediction.xg[0] > plainPrediction.xg[0]);
  assert.ok(enrichedPrediction.xg[1] < plainPrediction.xg[1]);
  assert.equal(whitelist.home.teamMatchStats.avgShotsOnTarget, 7);
  assert.equal(whitelist.away.teamMatchStats.avgShotsOnTarget, 1);
  assert.equal(enrichedPrediction.predictionBreakdown.xg.components.espnHomeEdge > 0, true);
  assert.equal(enrichedPrediction.predictionBreakdown.xg.components.espnAwayEdge < 0, true);
});

test("buildPrediction exposes structured model signals from current data inputs", () => {
  const prediction = buildPrediction(baseMatch, homeTeam, awayTeam, { altitude: 2240, country: "墨西哥" }, "小雨 18°C", {
    source: "espn",
    home: {
      teamMatchStats: [
        { stats: { totalShots: 18, shotsOnTarget: 7, possessionPct: 62, goalDifference: 2, totalGoals: 3, goalsConceded: 1 } },
      ],
      recentForm: [
        { eventDate: "2026-06-15T16:00:00.000Z", teamScore: 2, opponentScore: 0, result: "W" },
        { eventDate: "2026-06-10T16:00:00.000Z", teamScore: 1, opponentScore: 1, result: "D" },
      ],
      lineups: [{ athletes: [{ name: "Player A" }, { name: "Player B" }] }],
    },
    away: {
      teamMatchStats: [
        { stats: { totalShots: 8, shotsOnTarget: 2, possessionPct: 42, goalDifference: -1, totalGoals: 1, goalsConceded: 2 } },
      ],
      recentForm: [
        { eventDate: "2026-06-11T16:00:00.000Z", teamScore: 0, opponentScore: 1, result: "L" },
        { eventDate: "2026-06-06T16:00:00.000Z", teamScore: 1, opponentScore: 1, result: "D" },
      ],
      lineups: [{ athletes: [] }],
    },
  });
  const signals = prediction.predictionBreakdown.modelSignals;

  assert.equal(signals.baseStrength.confidence, "high");
  assert.ok(signals.form.impact > 0);
  assert.ok(signals.production.impact > 0);
  assert.equal(signals.fatigue.details.homeRestDays, 3);
  assert.equal(signals.fatigue.details.awayRestDays, 7);
  assert.ok(signals.fatigue.impact < 0);
  assert.equal(signals.environment.details.altitudeHigh, true);
  assert.equal(signals.tactical.details.blowout.side, prediction.predictionBreakdown.markets.blowout.side);
  assert.equal(signals.availability.details.homeAthletes, 2);
  assert.equal(signals.availability.details.awayAthletes, 0);
  assert.equal(signals.availability.confidence, "medium");
  assert.equal(["低", "中", "高"].includes(signals.upsetRisk.level), true);
  assert.equal(prediction.risk, signals.upsetRisk.level);
});

test("buildPrediction keeps lineup availability observable without directly changing xG", () => {
  const baseEnrichment = {
    source: "espn",
    home: { lineups: [] },
    away: { lineups: [] },
  };
  const lineupEnrichment = {
    source: "espn",
    home: { lineups: [{ athletes: [{ name: "Player A" }] }] },
    away: { lineups: [{ athletes: [{ name: "Player B" }] }] },
  };
  const withoutLineups = buildPrediction(baseMatch, homeTeam, awayTeam, { altitude: 0 }, "晴 22°C", baseEnrichment);
  const withLineups = buildPrediction(baseMatch, homeTeam, awayTeam, { altitude: 0 }, "晴 22°C", lineupEnrichment);

  assert.deepEqual(withLineups.xg, withoutLineups.xg);
  assert.equal(withLineups.predictionBreakdown.modelSignals.availability.confidence, "medium");
  assert.equal(withLineups.predictionBreakdown.modelSignals.availability.impact, 0);
});

test("buildPrediction raises upset risk for uncertain placeholder and weather conditions", () => {
  const riskyPrediction = buildPrediction(
    { ...baseMatch, stage: "32强赛" },
    { name: "A组第2", countryCode: "2A", fifaRank: null },
    { name: "B组第2", countryCode: "2B", fifaRank: null },
    { altitude: 100 },
    "暴雨 18°C",
  );
  const stablePrediction = buildPrediction(
    { ...baseMatch, stage: "小组赛" },
    { name: "Germany", countryCode: "GER", fifaRank: null },
    { name: "Curacao", countryCode: "CUW", fifaRank: null },
    { altitude: 0 },
    "晴 22°C",
  );

  assert.equal(riskyPrediction.predictionBreakdown.modelSignals.upsetRisk.level, "高");
  assert.ok(riskyPrediction.predictionBreakdown.modelSignals.upsetRisk.score > stablePrediction.predictionBreakdown.modelSignals.upsetRisk.score);
  assert.notEqual(stablePrediction.predictionBreakdown.modelSignals.upsetRisk.level, "高");
});

test("buildPredictionReview compares actual results with prediction output", () => {
  const prediction = buildPrediction(baseMatch, homeTeam, awayTeam, venue, "晴 22°C");
  const review = buildPredictionReview(prediction, {
    homeScore: 2,
    awayScore: 0,
  });

  assert.equal(review.isFinished, true);
  assert.equal(review.actualScore, "2 - 0");
  assert.equal(review.predictedScore, prediction.score);
  assert.equal(typeof review.fullTimeHit, "boolean");
  assert.equal(typeof review.scoreHit, "boolean");
  assert.equal(typeof review.goalDiffError, "number");
});

test("buildPredictionReview returns pending state when actual score is unavailable", () => {
  const prediction = buildPrediction(baseMatch, homeTeam, awayTeam, venue, "晴 22°C");
  const review = buildPredictionReview(prediction, {
    homeScore: null,
    awayScore: null,
  });

  assert.deepEqual(review, {
    isFinished: false,
    status: "pending",
  });
});

test("buildPredictionFromSnapshot restores a pre-match prediction for review", () => {
  const livePrediction = buildPrediction(baseMatch, homeTeam, awayTeam, venue, "晴 22°C");
  const snapshotRecord = buildPredictionSnapshotRecord("match-1", {
    ...livePrediction,
    score: "1 - 0",
    halfFull: "0-0 / 1-0",
    fullPick: "主胜",
    probs: [60, 25, 15],
    xg: [1.2, 0.7],
  });

  const restoredPrediction = buildPredictionFromSnapshot(snapshotRecord, livePrediction);
  const review = buildPredictionReview(restoredPrediction, {
    homeScore: 1,
    awayScore: 0,
  });

  assert.equal(restoredPrediction.score, "1 - 0");
  assert.deepEqual(restoredPrediction.probs, [60, 25, 15]);
  assert.equal(review.predictedScore, "1 - 0");
  assert.equal(review.scoreHit, true);
});
