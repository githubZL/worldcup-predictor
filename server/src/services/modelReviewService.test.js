import assert from "node:assert/strict";
import test from "node:test";

import { buildModelBacktestReport, buildModelReview } from "./modelReviewService.js";

test("buildModelReview aggregates reviewed matches into real hit rates", () => {
  const review = buildModelReview([
    {
      predictionSource: "snapshot",
      predictionReview: {
        isFinished: true,
        fullTimeHit: true,
        scoreHit: false,
        goalDiffError: 1,
        totalGoalsError: 2,
      },
    },
    {
      predictionSource: "snapshot",
      predictionReview: {
        isFinished: true,
        fullTimeHit: false,
        scoreHit: true,
        goalDiffError: 0,
        totalGoalsError: 0,
      },
    },
    {
      predictionReview: {
        isFinished: false,
        status: "pending",
      },
    },
  ]);

  assert.equal(review.sampleSize, 2);
  assert.equal(review.overallHitRate, 50);
  assert.equal(review.scoreHitRate, 50);
  assert.equal(review.goalDiffWithinOneRate, 100);
  assert.equal(review.averageGoalDiffError, 0.5);
  assert.equal(review.averageTotalGoalsError, 1);
  assert.deepEqual(review.markets.map((item) => item.label), ["胜平负", "比分命中", "净胜球误差≤1", "总进球平均误差"]);
});

test("buildModelReview returns empty real-review state when no finished matches exist", () => {
  const review = buildModelReview([
    {
      predictionReview: {
        isFinished: false,
        status: "pending",
      },
    },
  ]);

  assert.equal(review.sampleSize, 0);
  assert.equal(review.overallHitRate, 0);
  assert.equal(review.scoreHitRate, 0);
  assert.equal(review.averageGoalDiffError, null);
  assert.equal(review.markets[0].hitRate, 0);
});

test("buildModelReview excludes finished matches without pre-match snapshots from official stats", () => {
  const review = buildModelReview([
    {
      predictionSource: "snapshot",
      predictionReview: {
        isFinished: true,
        fullTimeHit: true,
        scoreHit: true,
        goalDiffError: 0,
        totalGoalsError: 0,
      },
    },
    {
      predictionSource: "computed",
      predictionReview: {
        isFinished: true,
        fullTimeHit: false,
        scoreHit: false,
        goalDiffError: 3,
        totalGoalsError: 3,
      },
    },
  ]);

  assert.equal(review.sampleSize, 1);
  assert.equal(review.excludedSampleSize, 1);
  assert.equal(review.totalFinishedSize, 2);
  assert.equal(review.reviewPolicy, "official_snapshot_only");
  assert.equal(review.overallHitRate, 100);
  assert.equal(review.scoreHitRate, 100);
});

test("buildModelReview exposes official snapshot review and current-model backtest separately", () => {
  const review = buildModelReview([
    {
      predictionSource: "snapshot",
      predictionReview: {
        isFinished: true,
        fullTimeHit: true,
        scoreHit: true,
        goalDiffError: 0,
        totalGoalsError: 0,
      },
      backtestReview: {
        isFinished: true,
        fullTimeHit: false,
        scoreHit: false,
        goalDiffError: 2,
        totalGoalsError: 2,
      },
    },
    {
      predictionSource: "computed",
      predictionReview: {
        isFinished: true,
        fullTimeHit: false,
        scoreHit: false,
        goalDiffError: 3,
        totalGoalsError: 3,
      },
      backtestReview: {
        isFinished: true,
        fullTimeHit: true,
        scoreHit: false,
        goalDiffError: 1,
        totalGoalsError: 1,
      },
    },
  ]);

  assert.equal(review.official.sampleSize, 1);
  assert.equal(review.official.overallHitRate, 100);
  assert.equal(review.official.excludedSampleSize, 1);
  assert.equal(review.backtest.sampleSize, 2);
  assert.equal(review.backtest.overallHitRate, 50);
  assert.equal(review.backtest.scoreHitRate, 0);
  assert.equal(review.backtest.reviewPolicy, "current_model_backtest");
});

test("buildModelReview exposes official snapshot rows and backtest rows separately", () => {
  const review = buildModelReview([
    {
      id: "snapshot-hit",
      time: "2026-06-18T16:00:00.000Z",
      home: "墨西哥",
      away: "韩国",
      modelVersion: "poisson-v0.8",
      predictionSource: "snapshot",
      predictionReview: {
        isFinished: true,
        actualScore: "1 - 0",
        predictedScore: "1 - 0",
        fullTimeHit: true,
        scoreHit: true,
        goalDiffError: 0,
        totalGoalsError: 0,
      },
      backtestReview: {
        isFinished: true,
        actualScore: "1 - 0",
        predictedScore: "1 - 1",
        fullTimeHit: false,
        scoreHit: false,
        goalDiffError: 1,
        totalGoalsError: 1,
      },
    },
    {
      id: "computed-miss",
      time: "2026-06-18T19:00:00.000Z",
      home: "瑞士",
      away: "波黑",
      modelVersion: "poisson-v0.8",
      predictionSource: "computed",
      predictionReview: {
        isFinished: true,
        actualScore: "4 - 1",
        predictedScore: "1 - 1",
        fullTimeHit: false,
        scoreHit: false,
        goalDiffError: 3,
        totalGoalsError: 3,
      },
      backtestReview: {
        isFinished: true,
        actualScore: "4 - 1",
        predictedScore: "1 - 1",
        fullTimeHit: false,
        scoreHit: false,
        goalDiffError: 3,
        totalGoalsError: 3,
      },
    },
  ]);

  assert.equal(review.official.sampleSize, 1);
  assert.equal(review.official.excludedSampleSize, 1);
  assert.deepEqual(review.official.matches.map((row) => row.id), ["snapshot-hit"]);
  assert.deepEqual(review.official.biggestMisses.map((row) => row.id), ["snapshot-hit"]);

  assert.equal(review.backtest.sampleSize, 2);
  assert.deepEqual(review.backtest.matches.map((row) => row.id), ["snapshot-hit", "computed-miss"]);
  assert.deepEqual(review.backtest.biggestMisses.map((row) => row.id), ["computed-miss", "snapshot-hit"]);
  assert.equal(review.backtest.biggestMisses[0].actualScore, "4 - 1");
});

test("buildModelBacktestReport exposes reviewed match details and biggest misses", () => {
  const report = buildModelBacktestReport([
    {
      id: "match-1",
      home: "A",
      away: "B",
      modelVersion: "poisson-v0.8",
      score: "2 - 0",
      predictedScore: "2 - 0",
      predictionBreakdown: {
        xg: {
          adjustments: {
            espnWhitelist: {
              appliedSignals: ["teamMatchStats", "recentFormRecord"],
            },
          },
        },
      },
      backtestReview: {
        isFinished: true,
        actualScore: "2 - 0",
        predictedScore: "2 - 0",
        fullTimeHit: true,
        scoreHit: true,
        goalDiffError: 0,
        totalGoalsError: 0,
      },
    },
    {
      id: "match-2",
      home: "C",
      away: "D",
      modelVersion: "poisson-v0.8",
      score: "0 - 3",
      predictedScore: "0 - 3",
      predictionBreakdown: {
        xg: {
          adjustments: {
            espnWhitelist: {
              appliedSignals: ["recentFormRecord"],
            },
          },
        },
      },
      backtestReview: {
        isFinished: true,
        actualScore: "1 - 1",
        predictedScore: "0 - 3",
        fullTimeHit: false,
        scoreHit: false,
        goalDiffError: 4,
        totalGoalsError: 1,
      },
    },
  ], { modelVersion: "poisson-v0.8" });

  assert.equal(report.modelVersion, "poisson-v0.8");
  assert.equal(report.summary.sampleSize, 2);
  assert.equal(report.summary.overallHitRate, 50);
  assert.equal(report.matches.length, 2);
  assert.deepEqual(report.matches[0].signals, ["teamMatchStats", "recentFormRecord"]);
  assert.equal(report.biggestMisses[0].id, "match-2");
  assert.equal(report.signalBreakdown.teamMatchStats.sampleSize, 1);
  assert.equal(report.signalBreakdown.teamMatchStats.overallHitRate, 100);
  assert.equal(report.signalBreakdown.recentFormRecord.sampleSize, 2);
});
