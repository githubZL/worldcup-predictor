function countRows(rows) {
  return Array.isArray(rows) ? rows.length : 0;
}

function countOne(row) {
  return row ? 1 : 0;
}

function uniqueMarketSources(marketOdds = []) {
  const seen = new Set();
  return marketOdds.flatMap((row) => {
    const key = `${row.matchId}:${row.source}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ matchId: row.matchId, source: row.source }];
  });
}

async function upsertExternalIds(tx, rows = []) {
  for (const row of rows) {
    await tx.externalId.upsert({
      where: {
        source_entityType_externalId: {
          source: row.source,
          entityType: row.entityType,
          externalId: row.externalId,
        },
      },
      update: {
        localId: row.localId,
      },
      create: row,
    });
  }
}

async function upsertTeamMatchStats(tx, rows = []) {
  for (const row of rows) {
    await tx.teamMatchStat.upsert({
      where: {
        matchId_teamId_source: {
          matchId: row.matchId,
          teamId: row.teamId,
          source: row.source,
        },
      },
      update: {
        stats: row.stats,
      },
      create: row,
    });
  }
}

async function upsertLineups(tx, rows = []) {
  for (const row of rows) {
    await tx.matchLineup.upsert({
      where: {
        matchId_teamId_source: {
          matchId: row.matchId,
          teamId: row.teamId,
          source: row.source,
        },
      },
      update: {
        athletes: row.athletes,
      },
      create: row,
    });
  }
}

async function upsertRecentForm(tx, rows = []) {
  for (const row of rows) {
    await tx.teamRecentForm.upsert({
      where: {
        teamId_source_externalEventId: {
          teamId: row.teamId,
          source: row.source,
          externalEventId: row.externalEventId,
        },
      },
      update: {
        awayScore: row.awayScore,
        eventDate: row.eventDate,
        homeScore: row.homeScore,
        isHome: row.isHome,
        opponentScore: row.opponentScore,
        result: row.result,
        teamScore: row.teamScore,
      },
      create: row,
    });
  }
}

async function refreshMarketOdds(tx, rows = []) {
  const sources = uniqueMarketSources(rows);
  if (!sources.length) return;

  await tx.marketOdd.deleteMany({
    where: {
      OR: sources,
    },
  });
  await tx.marketOdd.createMany({
    data: rows,
  });
}

async function updateMatchResult(tx, row) {
  if (!row) return;

  await tx.match.update({
    where: { id: row.matchId },
    data: {
      status: row.status,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
    },
  });
}

export async function persistEspnSyncPlan(client, plan = {}) {
  const summary = {
    externalIds: countRows(plan.externalIds),
    matchUpdate: countOne(plan.matchUpdate),
    teamMatchStats: countRows(plan.teamMatchStats),
    lineups: countRows(plan.lineups),
    teamRecentForm: countRows(plan.teamRecentForm),
    marketOdds: countRows(plan.marketOdds),
  };

  if (!Object.values(summary).some(Boolean)) return summary;

  await client.$transaction(async (tx) => {
    await upsertExternalIds(tx, plan.externalIds);
    await updateMatchResult(tx, plan.matchUpdate);
    await upsertTeamMatchStats(tx, plan.teamMatchStats);
    await upsertLineups(tx, plan.lineups);
    await upsertRecentForm(tx, plan.teamRecentForm);
    await refreshMarketOdds(tx, plan.marketOdds);
  });

  return summary;
}
