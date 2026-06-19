import { getPrisma } from "./databaseRepository.js";

function uniqueCount(rows = [], field) {
  return new Set(rows.map((row) => row[field]).filter(Boolean)).size;
}

function percent(part, total) {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

function lineupAthleteCount(lineup) {
  return Array.isArray(lineup.athletes) ? lineup.athletes.length : 0;
}

function buildRisks({ matchExternalIds, totalMatches, lineups, marketOdds }) {
  const risks = [];

  if (matchExternalIds.length === 0) {
    risks.push({
      code: "NO_ESPN_MATCHES",
      level: "high",
      message: "尚未同步 ESPN 比赛外部 ID，模型不能使用 ESPN 增强数据。",
    });
  }

  if (totalMatches && percent(matchExternalIds.length, totalMatches) < 10) {
    risks.push({
      code: "LOW_MATCH_COVERAGE",
      level: "medium",
      message: "ESPN 当前只覆盖少量比赛，适合按比赛日增量使用，不适合作为全量主源。",
    });
  }

  if (lineups.length && lineups.some((lineup) => lineupAthleteCount(lineup) === 0)) {
    risks.push({
      code: "LINEUP_ATHLETES_LOW",
      level: "medium",
      message: "已同步阵容壳子，但 ESPN 暂未返回球员，阵容因子暂不应进入模型。",
    });
  }

  if (marketOdds.length === 0) {
    risks.push({
      code: "NO_MARKET_ODDS",
      level: "low",
      message: "尚无 ESPN 盘口数据，盘口只能作为后续观察项。",
    });
  }

  return risks;
}

export function buildEspnDataQualityReport({
  totalMatches = 0,
  externalIds = [],
  teamMatchStats = [],
  teamRecentForm = [],
  lineups = [],
  marketOdds = [],
} = {}) {
  const matchExternalIds = externalIds.filter((row) => row.entityType === "match");
  const teamExternalIds = externalIds.filter((row) => row.entityType === "team");
  const lineupsWithAthletes = lineups.filter((lineup) => lineupAthleteCount(lineup) > 0);

  return {
    source: "espn",
    generatedAt: new Date().toISOString(),
    coverage: {
      matches: {
        synced: matchExternalIds.length,
        total: totalMatches,
        percent: percent(matchExternalIds.length, totalMatches),
      },
      teams: {
        externalIds: teamExternalIds.length,
      },
      teamMatchStats: {
        matches: uniqueCount(teamMatchStats, "matchId"),
        rows: teamMatchStats.length,
      },
      recentForm: {
        teams: uniqueCount(teamRecentForm, "teamId"),
        events: teamRecentForm.length,
      },
      marketOdds: {
        matches: uniqueCount(marketOdds, "matchId"),
        rows: marketOdds.length,
        sources: [...new Set(marketOdds.map((row) => row.source).filter(Boolean))],
      },
      lineups: {
        matches: uniqueCount(lineups, "matchId"),
        rows: lineups.length,
        withAthletes: lineupsWithAthletes.length,
        athleteRows: lineups.reduce((sum, lineup) => sum + lineupAthleteCount(lineup), 0),
      },
    },
    risks: buildRisks({ matchExternalIds, totalMatches, lineups, marketOdds }),
  };
}

export async function getEspnDataQualityReport({ prisma } = {}) {
  const client = prisma ?? await getPrisma();
  if (!client) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const [
    totalMatches,
    externalIds,
    teamMatchStats,
    teamRecentForm,
    lineups,
    marketOdds,
  ] = await Promise.all([
    client.match.count(),
    client.externalId.findMany({ where: { source: "espn" } }),
    client.teamMatchStat.findMany({ where: { source: "espn" } }),
    client.teamRecentForm.findMany({ where: { source: "espn" } }),
    client.matchLineup.findMany({ where: { source: "espn" } }),
    client.marketOdd.findMany({ where: { source: { startsWith: "espn:" } } }),
  ]);

  return buildEspnDataQualityReport({
    totalMatches,
    externalIds,
    teamMatchStats,
    teamRecentForm,
    lineups,
    marketOdds,
  });
}
