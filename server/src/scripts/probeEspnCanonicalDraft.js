import "dotenv/config";

import { fetchEspnScoreboard, fetchEspnSummary } from "../services/espnApi.js";
import { mapEspnSummaryToCanonicalDraft } from "../services/espnCanonicalMapper.js";

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
const eventId = scoreboard.events?.[0]?.id;

if (!eventId) {
  throw new Error("ESPN scoreboard did not return an event id");
}

const summary = await withTimeout((signal) => fetchEspnSummary(eventId, { signal }));
const draft = mapEspnSummaryToCanonicalDraft(summary, { sourceEventId: eventId });

console.log(JSON.stringify({
  sourceEventId: eventId,
  counts: {
    teams: draft.teams.length,
    teamMatchStats: draft.teamMatchStats.length,
    lineups: draft.lineups.length,
    lineupAthletes: draft.lineups.reduce((sum, lineup) => sum + lineup.athletes.length, 0),
    standings: draft.standings.length,
    odds: draft.odds.length,
    recentForm: draft.recentForm.length,
    recentFormEvents: draft.recentForm.reduce((sum, form) => sum + form.events.length, 0),
  },
  samples: {
    teams: draft.teams.slice(0, 2),
    teamMatchStats: draft.teamMatchStats.slice(0, 2),
    lineups: draft.lineups.slice(0, 2),
    standings: draft.standings.slice(0, 4),
    odds: draft.odds.slice(0, 3),
    recentForm: draft.recentForm.slice(0, 2),
  },
}, null, 2));
