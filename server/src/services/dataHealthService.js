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

function percentage(part, total) {
  if (!total) return 100;
  return Math.round((part / total) * 1000) / 10;
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

  return {
    generatedAt: now.toISOString(),
    status,
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
