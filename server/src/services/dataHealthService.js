const DEFAULT_RESULT_GRACE_HOURS = 3;
const HOUR_MS = 60 * 60 * 1000;
const LIST_LIMIT = 6;

function parseTime(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function hasResult(match) {
  return Number.isFinite(match?.homeScore)
    && Number.isFinite(match?.awayScore);
}

function isInactiveStatus(match) {
  const status = String(match?.status ?? "").toLowerCase();
  return status.includes("cancel")
    || status.includes("postpon")
    || status.includes("取消")
    || status.includes("延期");
}

function hasSnapshot(match) {
  return match?.predictionSource === "snapshot"
    || Boolean(match?.predictionSnapshotId)
    || Boolean(match?.predictionSnapshot);
}

function compactMatch(match) {
  return {
    id: match.id,
    time: match.time,
    home: match.home ?? match.homeTeam?.name ?? "",
    away: match.away ?? match.awayTeam?.name ?? "",
    status: match.status ?? "",
  };
}

function buildIssue({ type, severity, action, reason, match }) {
  return {
    type,
    severity,
    action,
    reason,
    match: compactMatch(match),
  };
}

function summarizeIssues(issues) {
  return issues.reduce((summary, issue) => {
    summary.total += 1;
    summary[issue.severity] = (summary[issue.severity] ?? 0) + 1;
    return summary;
  }, {
    total: 0,
    high: 0,
    medium: 0,
    low: 0,
  });
}

function percentage(part, total) {
  if (!total) return 100;
  return Math.round((part / total) * 1000) / 10;
}

function metricStatus(coveragePct) {
  if (coveragePct >= 80) return "good";
  if (coveragePct > 50) return "partial";
  return "poor";
}

function buildCoverageMetric(key, label, covered, total) {
  const coveragePct = percentage(covered, total);
  return {
    key,
    label,
    covered,
    total,
    coveragePct,
    status: metricStatus(coveragePct),
  };
}

function sampleSize(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function hasFiniteNumber(value) {
  if (value == null || value === "") return false;
  return Number.isFinite(Number(value));
}

function strengthSlots(match) {
  const strength = match?.predictionBreakdown?.strength ?? {};
  return [strength.home, strength.away];
}

function signalDetails(match, signal) {
  return match?.predictionBreakdown?.modelSignals?.[signal]?.details ?? {};
}

function teamSlotCoverage(matches, predicate) {
  const total = matches.length * 2;
  const covered = matches.reduce((sum, match) => (
    sum + (predicate(match, "home") ? 1 : 0) + (predicate(match, "away") ? 1 : 0)
  ), 0);
  return { covered, total };
}

function buildInputCoverage(matches) {
  const activeMatches = matches.filter((match) => !isInactiveStatus(match));
  const strengthCoverage = teamSlotCoverage(activeMatches, (match, side) => {
    const strength = side === "home" ? strengthSlots(match)[0] : strengthSlots(match)[1];
    return strength?.source === "database";
  });
  const formCoverage = teamSlotCoverage(activeMatches, (match, side) => (
    sampleSize(signalDetails(match, "form")?.[side]?.sampleSize) > 0
  ));
  const productionCoverage = teamSlotCoverage(activeMatches, (match, side) => (
    sampleSize(signalDetails(match, "production")?.[side]?.sampleSize) > 0
  ));
  const lineupCoverage = teamSlotCoverage(activeMatches, (match, side) => {
    const details = signalDetails(match, "availability");
    return sampleSize(side === "home" ? details.homeLineups : details.awayLineups) > 0;
  });
  const metrics = [
    buildCoverageMetric("teamStrength", "球队实力", strengthCoverage.covered, strengthCoverage.total),
    buildCoverageMetric("espnRecentForm", "ESPN 近期状态", formCoverage.covered, formCoverage.total),
    buildCoverageMetric("espnTeamStats", "ESPN 球队统计", productionCoverage.covered, productionCoverage.total),
    buildCoverageMetric("lineups", "阵容数据", lineupCoverage.covered, lineupCoverage.total),
    buildCoverageMetric("weather", "实时天气", activeMatches.filter((match) => Boolean(match.weatherSnapshot)).length, activeMatches.length),
    buildCoverageMetric("venueCoordinates", "场馆坐标", activeMatches.filter((match) => (
      hasFiniteNumber(match.venueMeta?.latitude) && hasFiniteNumber(match.venueMeta?.longitude)
    )).length, activeMatches.length),
    buildCoverageMetric("altitude", "海拔数据", activeMatches.filter((match) => (
      hasFiniteNumber(match.venueMeta?.altitude)
    )).length, activeMatches.length),
  ];
  const poorCount = metrics.filter((metric) => metric.status === "poor").length;
  const partialCount = metrics.filter((metric) => metric.status === "partial").length;

  return {
    status: poorCount > 0 ? "poor" : partialCount > 0 ? "partial" : "good",
    metrics,
  };
}

export function buildDataHealth(matches = [], {
  now = new Date(),
  resultGraceHours = DEFAULT_RESULT_GRACE_HOURS,
} = {}) {
  const nowMs = now.getTime();
  const graceMs = resultGraceHours * HOUR_MS;
  const activeMatches = matches.filter((match) => !isInactiveStatus(match));
  const futureMatches = activeMatches.filter((match) => {
    const kickoffMs = parseTime(match.time);
    return kickoffMs != null && kickoffMs > nowMs && !hasResult(match);
  });
  const snapshotMatches = futureMatches.filter(hasSnapshot);
  const missingSnapshotMatches = futureMatches.filter((match) => !hasSnapshot(match));
  const overdueResultMatches = activeMatches.filter((match) => {
    const kickoffMs = parseTime(match.time);
    return kickoffMs != null
      && kickoffMs + graceMs < nowMs
      && !hasResult(match);
  });

  const status = overdueResultMatches.length > 0
    ? "action_needed"
    : missingSnapshotMatches.length > 0
      ? "warning"
      : "ok";
  const issues = [
    ...overdueResultMatches.map((match) => buildIssue({
      type: "result_not_synced",
      severity: "high",
      action: "同步 ESPN 赛果",
      reason: `比赛已开赛超过 ${resultGraceHours} 小时，但数据库仍无真实比分。`,
      match,
    })),
    ...missingSnapshotMatches.map((match) => buildIssue({
      type: "missing_snapshot",
      severity: "medium",
      action: "补赛前预测快照",
      reason: "未来比赛尚无当前模型版本的赛前快照，正式复盘会缺样本。",
      match,
    })),
  ];

  return {
    generatedAt: now.toISOString(),
    status,
    issueSummary: summarizeIssues(issues),
    issues: issues.slice(0, LIST_LIMIT),
    inputCoverage: buildInputCoverage(activeMatches),
    snapshot: {
      upcoming: futureMatches.length,
      withSnapshot: snapshotMatches.length,
      missing: missingSnapshotMatches.length,
      coveragePct: percentage(snapshotMatches.length, futureMatches.length),
      missingMatches: missingSnapshotMatches.slice(0, LIST_LIMIT).map(compactMatch),
    },
    resultSync: {
      graceHours: resultGraceHours,
      overdueWithoutResult: overdueResultMatches.length,
      matches: overdueResultMatches.slice(0, LIST_LIMIT).map(compactMatch),
    },
  };
}
