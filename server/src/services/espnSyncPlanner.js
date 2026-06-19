function uniqueRows(rows, keyBuilder) {
  const seen = new Set();
  const result = [];

  for (const row of rows) {
    const key = keyBuilder(row);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }

  return result;
}

function resolveTeamId(externalTeamId, teamIdByExternalId) {
  return teamIdByExternalId?.get(String(externalTeamId));
}

function providerLabel(provider) {
  return provider ? `espn:${provider}` : "espn";
}

function buildMarketOdds(draft, matchId) {
  return (draft.odds ?? []).flatMap((market) => {
    const source = providerLabel(market.provider);
    const rows = [];
    if (market.details) {
      rows.push({
        matchId,
        marketType: "spread",
        optionName: market.details,
        source,
        currentOdds: null,
        impliedProbability: null,
      });
    }
    if (market.overUnder != null) {
      rows.push({
        matchId,
        marketType: "total",
        optionName: `Over/Under ${market.overUnder}`,
        source,
        currentOdds: null,
        impliedProbability: null,
      });
    }
    return rows;
  });
}

export function buildEspnSyncPlan(draft = {}, { matchId, teamIdByExternalId = new Map() } = {}) {
  const source = draft.source ?? "espn";
  const unmapped = [];
  const externalIds = [];
  const matchResult = draft.matchResult ?? {};
  const matchUpdate = matchId && (Number.isFinite(matchResult.homeScore) || Number.isFinite(matchResult.awayScore) || matchResult.status)
    ? {
      matchId,
      status: matchResult.status ?? "scheduled",
      homeScore: Number.isFinite(matchResult.homeScore) ? matchResult.homeScore : null,
      awayScore: Number.isFinite(matchResult.awayScore) ? matchResult.awayScore : null,
    }
    : null;

  if (matchId && draft.externalMatchId) {
    externalIds.push({
      entityType: "match",
      localId: matchId,
      source,
      externalId: String(draft.externalMatchId),
    });
  }

  for (const team of draft.teams ?? []) {
    const teamId = resolveTeamId(team.externalTeamId, teamIdByExternalId);
    if (!teamId) {
      unmapped.push({
        entityType: "team",
        source,
        externalId: String(team.externalTeamId),
        name: team.name,
      });
      continue;
    }

    externalIds.push({
      entityType: "team",
      localId: teamId,
      source,
      externalId: String(team.externalTeamId),
    });
  }

  const teamMatchStats = (draft.teamMatchStats ?? []).flatMap((entry) => {
    const teamId = resolveTeamId(entry.externalTeamId, teamIdByExternalId);
    if (!teamId) {
      unmapped.push({
        entityType: "team",
        source,
        externalId: String(entry.externalTeamId),
      });
      return [];
    }

    return [{
      matchId,
      teamId,
      source,
      stats: entry.stats ?? {},
    }];
  });

  const lineups = (draft.lineups ?? []).flatMap((entry) => {
    const teamId = resolveTeamId(entry.externalTeamId, teamIdByExternalId);
    if (!teamId) return [];

    return [{
      matchId,
      teamId,
      source,
      athletes: entry.athletes ?? [],
    }];
  });

  const teamRecentForm = (draft.recentForm ?? []).flatMap((entry) => {
    const teamId = resolveTeamId(entry.externalTeamId, teamIdByExternalId);
    if (!teamId) return [];

    return (entry.events ?? []).map((event) => ({
      teamId,
      source,
      externalEventId: String(event.externalEventId),
      eventDate: event.date ? new Date(event.date) : null,
      homeScore: event.homeScore ?? null,
      awayScore: event.awayScore ?? null,
      teamScore: event.teamScore ?? null,
      opponentScore: event.opponentScore ?? null,
      result: event.result ?? null,
      isHome: event.isHome ?? null,
    }));
  });

  return {
    externalIds: uniqueRows(externalIds, (row) => `${row.source}:${row.entityType}:${row.externalId}`),
    matchUpdate,
    teamMatchStats,
    lineups,
    marketOdds: buildMarketOdds(draft, matchId),
    teamRecentForm,
    unmapped,
  };
}
