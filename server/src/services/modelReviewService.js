function pct(count, total) {
  if (!total) return 0;
  return Number(((count / total) * 100).toFixed(1));
}

function avg(values) {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

export function buildModelReview(matches) {
  const finished = matches.filter((match) => match.predictionReview?.isFinished);
  const officialMatches = finished.filter((match) => match.predictionSource === "snapshot");
  const totalFinishedSize = finished.length;
  const officialRows = sortRowsByTime(officialMatches.map((match) => buildReviewMatchRow(match, match.predictionReview)));
  const backtestRows = sortRowsByTime(matches
    .filter((match) => getBacktestReview(match)?.isFinished)
    .map((match) => buildReviewMatchRow(match, getBacktestReview(match))));
  const official = buildReviewSummary({
    reviewed: officialRows.map(rowToReview),
    reviewPolicy: "official_snapshot_only",
    totalFinishedSize,
    excludedSampleSize: totalFinishedSize - officialMatches.length,
    rows: officialRows,
  });
  const backtest = buildReviewSummary({
    reviewed: backtestRows.map(rowToReview),
    reviewPolicy: "current_model_backtest",
    totalFinishedSize,
    excludedSampleSize: 0,
    rows: backtestRows,
  });

  return {
    ...official,
    official,
    backtest,
  };
}

function getBacktestReview(match) {
  return match.backtestReview ?? match.predictionReview;
}

function getSignals(match) {
  return match.predictionBreakdown?.xg?.adjustments?.espnWhitelist?.appliedSignals ?? [];
}

function buildBacktestMatchRow(match) {
  const review = getBacktestReview(match);
  return {
    id: match.id,
    time: match.time ?? null,
    home: match.home,
    away: match.away,
    modelVersion: match.modelVersion ?? null,
    actualScore: review.actualScore,
    predictedScore: review.predictedScore ?? match.predictedScore ?? match.score,
    fullTimeHit: review.fullTimeHit,
    scoreHit: review.scoreHit,
    goalDiffError: review.goalDiffError,
    totalGoalsError: review.totalGoalsError,
    signals: getSignals(match),
  };
}

function buildReviewMatchRow(match, review) {
  return {
    id: match.id,
    time: match.time ?? null,
    home: match.home,
    away: match.away,
    modelVersion: match.modelVersion ?? null,
    predictionSource: match.predictionSource ?? null,
    actualScore: review.actualScore,
    predictedScore: review.predictedScore ?? match.predictedScore ?? match.score,
    fullTimeHit: review.fullTimeHit,
    scoreHit: review.scoreHit,
    goalDiffError: review.goalDiffError,
    totalGoalsError: review.totalGoalsError,
  };
}

function rowToReview(row) {
  return {
    isFinished: true,
    fullTimeHit: row.fullTimeHit,
    scoreHit: row.scoreHit,
    goalDiffError: row.goalDiffError,
    totalGoalsError: row.totalGoalsError,
  };
}

function sortRowsByTime(rows) {
  return [...rows].sort((a, b) => {
    const aTime = new Date(a.time ?? 0).getTime();
    const bTime = new Date(b.time ?? 0).getTime();
    return aTime - bTime || String(a.id).localeCompare(String(b.id));
  });
}

function selectBiggestMisses(rows, limit = 5) {
  return [...rows]
    .sort((a, b) => {
      const goalDiffDelta = b.goalDiffError - a.goalDiffError;
      if (goalDiffDelta !== 0) return goalDiffDelta;
      const totalGoalsDelta = b.totalGoalsError - a.totalGoalsError;
      if (totalGoalsDelta !== 0) return totalGoalsDelta;
      const aTime = new Date(a.time ?? 0).getTime();
      const bTime = new Date(b.time ?? 0).getTime();
      return aTime - bTime || String(a.id).localeCompare(String(b.id));
    })
    .slice(0, limit);
}

function buildSignalBreakdown(rows) {
  const signals = [...new Set(rows.flatMap((row) => row.signals))].sort();
  return Object.fromEntries(signals.map((signal) => {
    const signalRows = rows.filter((row) => row.signals.includes(signal));
    const summary = buildReviewSummary({
      reviewed: signalRows.map((row) => ({
        isFinished: true,
        fullTimeHit: row.fullTimeHit,
        scoreHit: row.scoreHit,
        goalDiffError: row.goalDiffError,
        totalGoalsError: row.totalGoalsError,
      })),
      reviewPolicy: `signal:${signal}`,
      totalFinishedSize: rows.length,
      excludedSampleSize: rows.length - signalRows.length,
    });
    return [signal, summary];
  }));
}

export function buildModelBacktestReport(matches, { modelVersion } = {}) {
  const rows = matches
    .filter((match) => getBacktestReview(match)?.isFinished)
    .map(buildBacktestMatchRow);
  const reviewed = rows.map((row) => ({
    isFinished: true,
    fullTimeHit: row.fullTimeHit,
    scoreHit: row.scoreHit,
    goalDiffError: row.goalDiffError,
    totalGoalsError: row.totalGoalsError,
  }));
  const summary = buildReviewSummary({
    reviewed,
    reviewPolicy: "current_model_backtest",
    totalFinishedSize: rows.length,
    excludedSampleSize: 0,
  });

  return {
    modelVersion: modelVersion ?? rows[0]?.modelVersion ?? null,
    generatedAt: new Date().toISOString(),
    summary,
    matches: rows,
    biggestMisses: [...rows]
      .sort((a, b) => b.goalDiffError - a.goalDiffError || b.totalGoalsError - a.totalGoalsError)
      .slice(0, 5),
    signalBreakdown: buildSignalBreakdown(rows),
  };
}

function buildReviewSummary({ reviewed, reviewPolicy, totalFinishedSize, excludedSampleSize, rows = [] }) {
  const sampleSize = reviewed.length;
  const fullTimeHits = reviewed.filter((review) => review.fullTimeHit).length;
  const scoreHits = reviewed.filter((review) => review.scoreHit).length;
  const withinOneGoalDiff = reviewed.filter((review) => review.goalDiffError <= 1).length;
  const goalDiffErrors = reviewed.map((review) => review.goalDiffError);
  const totalGoalErrors = reviewed.map((review) => review.totalGoalsError);
  const overallHitRate = pct(fullTimeHits, sampleSize);
  const scoreHitRate = pct(scoreHits, sampleSize);
  const goalDiffWithinOneRate = pct(withinOneGoalDiff, sampleSize);
  const averageGoalDiffError = avg(goalDiffErrors);
  const averageTotalGoalsError = avg(totalGoalErrors);

  return {
    window: "全部已赛",
    reviewPolicy,
    sampleSize,
    totalFinishedSize,
    excludedSampleSize,
    overallHitRate,
    scoreHitRate,
    goalDiffWithinOneRate,
    averageGoalDiffError,
    averageTotalGoalsError,
    profitRate: null,
    averageReturn: averageGoalDiffError,
    matches: rows,
    biggestMisses: selectBiggestMisses(rows),
    markets: [
      { label: "胜平负", hitRate: overallHitRate, roi: null },
      { label: "比分命中", hitRate: scoreHitRate, roi: null },
      { label: "净胜球误差≤1", hitRate: goalDiffWithinOneRate, roi: averageGoalDiffError },
      { label: "总进球平均误差", hitRate: averageTotalGoalsError ?? 0, roi: null, unit: "球" },
    ],
  };
}
