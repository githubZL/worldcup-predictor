import { getPrisma } from "./databaseRepository.js";
import { fetchEspnScoreboard, fetchEspnSummary } from "./espnApi.js";
import { mapEspnSummaryToCanonicalDraft } from "./espnCanonicalMapper.js";
import { buildEspnMatchDiagnostics, buildTeamIdMapForEspnDraft, findDatabaseMatchForEspnEvent } from "./espnMatchResolver.js";
import { persistEspnSyncPlan } from "./espnSyncRepository.js";
import { buildEspnSyncPlan } from "./espnSyncPlanner.js";

async function withTimeout(task, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function readMatches(prisma) {
  return prisma.match.findMany({
    include: {
      awayTeam: true,
      homeTeam: true,
    },
    orderBy: {
      kickoffAt: "asc",
    },
  });
}

function formatEspnDate(value) {
  return String(value ?? "").replaceAll("-", "").slice(0, 8);
}

function buildDateList({ dates, dateFrom, dateTo } = {}) {
  if (dates) {
    return String(dates)
      .split(",")
      .map((date) => formatEspnDate(date.trim()))
      .filter(Boolean);
  }

  if (!dateFrom || !dateTo) return [undefined];

  const start = new Date(`${dateFrom}T00:00:00.000Z`);
  const end = new Date(`${dateTo}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) {
    return [undefined];
  }

  const result = [];
  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)) {
    result.push(cursor.toISOString().slice(0, 10).replaceAll("-", ""));
  }
  return result;
}

function uniqueEvents(events = []) {
  const seen = new Set();
  return events.filter((event) => {
    const key = event.id ?? `${event.date}:${event.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchScoreboardEvents(fetchScoreboard, dateList) {
  const requests = [];
  const allEvents = [];

  for (const date of dateList) {
    const scoreboard = await fetchScoreboard({ dates: date });
    const events = scoreboard.events ?? [];
    requests.push({ dates: date, events: events.length });
    allEvents.push(...events);
  }

  return {
    events: uniqueEvents(allEvents),
    requests,
  };
}

export async function syncEspnEnrichment({
  dates,
  dateFrom,
  dateTo,
  dryRun = false,
  fetchScoreboard = (options) => withTimeout((signal) => fetchEspnScoreboard({ ...options, signal })),
  fetchSummary = (eventId) => withTimeout((signal) => fetchEspnSummary(eventId, { signal })),
  persistPlan = persistEspnSyncPlan,
  prisma,
} = {}) {
  const client = prisma ?? await getPrisma();
  if (!client) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const dateList = buildDateList({ dates, dateFrom, dateTo });
  const [matches, scoreboardResult] = await Promise.all([
    readMatches(client),
    fetchScoreboardEvents(fetchScoreboard, dateList),
  ]);

  const events = scoreboardResult.events;
  const summary = {
    dryRun,
    events: events.length,
    scoreboardRequests: scoreboardResult.requests,
    matched: 0,
    unmatched: 0,
    persisted: 0,
    failed: 0,
    rows: {
      externalIds: 0,
      matchUpdate: 0,
      teamMatchStats: 0,
      lineups: 0,
      teamRecentForm: 0,
      marketOdds: 0,
    },
    details: [],
  };

  for (const event of events) {
    const match = findDatabaseMatchForEspnEvent(event, matches);
    if (!match) {
      summary.unmatched += 1;
      summary.details.push({
        eventId: event.id,
        status: "unmatched",
        diagnostics: buildEspnMatchDiagnostics(event, matches),
      });
      continue;
    }

    summary.matched += 1;

    try {
      const espnSummary = await fetchSummary(event.id);
      const draft = mapEspnSummaryToCanonicalDraft(espnSummary, { sourceEventId: event.id });
      const teamIdByExternalId = buildTeamIdMapForEspnDraft(draft, match);
      const plan = buildEspnSyncPlan(draft, {
        matchId: match.id,
        teamIdByExternalId,
      });
      const persisted = dryRun
        ? {
          externalIds: plan.externalIds.length,
          teamMatchStats: plan.teamMatchStats.length,
          lineups: plan.lineups.length,
          teamRecentForm: plan.teamRecentForm.length,
          marketOdds: plan.marketOdds.length,
        }
        : await persistPlan(client, plan);

      if (!dryRun) summary.persisted += 1;
      for (const key of Object.keys(summary.rows)) {
        summary.rows[key] += persisted[key] ?? 0;
      }
      summary.details.push({
        eventId: event.id,
        matchId: match.id,
        status: dryRun ? "planned" : "persisted",
        rows: persisted,
        unmapped: plan.unmapped,
      });
    } catch (error) {
      summary.failed += 1;
      summary.details.push({
        eventId: event.id,
        matchId: match.id,
        status: "failed",
        error: error.message,
      });
    }
  }

  return summary;
}
