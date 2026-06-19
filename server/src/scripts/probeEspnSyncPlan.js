import "dotenv/config";

import { fetchEspnScoreboard, fetchEspnSummary } from "../services/espnApi.js";
import { mapEspnSummaryToCanonicalDraft } from "../services/espnCanonicalMapper.js";
import { buildEspnSyncPlan } from "../services/espnSyncPlanner.js";

async function withTimeout(task, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

const scoreboard = await withTimeout((signal) => fetchEspnScoreboard({ signal }));
const event = scoreboard.events?.[0];
const eventId = event?.id;

if (!eventId) {
  throw new Error("ESPN scoreboard did not return an event id");
}

const competitors = event.competitions?.[0]?.competitors ?? [];
const teamIdByExternalId = new Map(competitors.flatMap((competitor) => {
  const externalTeamId = competitor.team?.id ?? competitor.id;
  return externalTeamId ? [[String(externalTeamId), `local-team-placeholder:${externalTeamId}`]] : [];
}));

const summary = await withTimeout((signal) => fetchEspnSummary(eventId, { signal }));
const draft = mapEspnSummaryToCanonicalDraft(summary, { sourceEventId: eventId });
const plan = buildEspnSyncPlan(draft, {
  matchId: `local-match-placeholder:${eventId}`,
  teamIdByExternalId,
});

console.log(JSON.stringify({
  sourceEventId: eventId,
  counts: {
    externalIds: plan.externalIds.length,
    teamMatchStats: plan.teamMatchStats.length,
    lineups: plan.lineups.length,
    marketOdds: plan.marketOdds.length,
    teamRecentForm: plan.teamRecentForm.length,
    unmapped: plan.unmapped.length,
  },
  samples: {
    externalIds: plan.externalIds.slice(0, 4),
    teamMatchStats: plan.teamMatchStats.slice(0, 2),
    lineups: plan.lineups.slice(0, 2),
    marketOdds: plan.marketOdds.slice(0, 4),
    teamRecentForm: plan.teamRecentForm.slice(0, 4),
    unmapped: plan.unmapped.slice(0, 4),
  },
}, null, 2));
