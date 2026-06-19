function asArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.games)) return payload.games;
  if (Array.isArray(payload?.teams)) return payload.teams;
  if (Array.isArray(payload?.events)) return payload.events;
  return [];
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function summarizeFields(records) {
  const fields = new Set();
  for (const record of records.slice(0, 10)) {
    if (!record || typeof record !== "object") continue;
    Object.keys(record).forEach((field) => fields.add(field));
  }
  return [...fields].sort();
}

function summarizeEspnEvent(event) {
  const competition = event?.competitions?.[0];
  const home = competition?.competitors?.find((team) => team.homeAway === "home");
  const away = competition?.competitors?.find((team) => team.homeAway === "away");

  return compactObject({
    id: event?.id,
    date: event?.date,
    status: event?.status?.type?.description ?? event?.status?.type?.state,
    home: home?.team?.displayName ?? home?.team?.shortDisplayName,
    away: away?.team?.displayName ?? away?.team?.shortDisplayName,
    score: home && away ? `${home.score ?? "-"} - ${away.score ?? "-"}` : undefined,
    venue: competition?.venue?.fullName,
  });
}

function summarizeWorldcup26Game(game) {
  return compactObject({
    id: game?.id ?? game?.gameId ?? game?.matchId,
    date: game?.date ?? game?.time ?? game?.datetime,
    group: game?.group ?? game?.groupName,
    home: game?.homeTeam ?? game?.home_team ?? game?.team1 ?? game?.home,
    away: game?.awayTeam ?? game?.away_team ?? game?.team2 ?? game?.away,
    score: Number.isFinite(game?.homeScore) || Number.isFinite(game?.awayScore)
      ? `${game.homeScore ?? "-"} - ${game.awayScore ?? "-"}`
      : game?.score,
    stadium: game?.stadium ?? game?.venue,
  });
}

function summarizeWorldcup26Team(team) {
  return compactObject({
    id: team?.id ?? team?.teamId,
    name: team?.name ?? team?.teamName,
    group: team?.group ?? team?.groupName,
    flag: team?.flag ?? team?.flagUrl,
    fifaRank: team?.fifaRank ?? team?.rank,
  });
}

function summarizeEspnSummaryDetails(payload) {
  if (!payload || typeof payload !== "object") return undefined;

  const boxscoreTeams = Array.isArray(payload.boxscore?.teams) ? payload.boxscore.teams : [];
  const rosters = Array.isArray(payload.rosters) ? payload.rosters : [];
  const odds = Array.isArray(payload.odds) ? payload.odds : [];
  const lastFiveGames = Array.isArray(payload.lastFiveGames) ? payload.lastFiveGames : [];
  const standingGroups = Array.isArray(payload.standings?.groups) ? payload.standings.groups : [];
  const directStandingEntries = Array.isArray(payload.standings?.entries) ? payload.standings.entries : [];

  const rosterEntries = rosters.flatMap((roster) => (
    roster.roster ?? roster.athletes ?? roster.entries ?? []
  ));
  const standingEntries = standingGroups.flatMap((group) => (
    group.standings?.entries ?? group.entries ?? []
  )).concat(directStandingEntries);

  return compactObject({
    boxscore: payload.boxscore ? {
      teamCount: boxscoreTeams.length,
      statisticNames: unique(boxscoreTeams.flatMap((team) => (
        team.statistics?.map((stat) => stat.displayName ?? stat.name) ?? []
      ))).slice(0, 12),
    } : undefined,
    rosters: rosters.length ? {
      teamCount: rosters.length,
      athleteCount: rosterEntries.length,
      starterCount: rosterEntries.filter((entry) => entry.starter === true).length,
      positions: unique(rosterEntries.map((entry) => (
        entry.position?.abbreviation ?? entry.position?.displayName ?? entry.position
      ))).slice(0, 12),
    } : undefined,
    standings: payload.standings ? {
      groupCount: standingGroups.length,
      entryCount: standingEntries.length,
    } : undefined,
    odds: odds.length ? {
      marketCount: odds.length,
      providers: unique(odds.map((market) => market.provider?.name ?? market.provider?.displayName ?? market.provider)).slice(0, 8),
    } : undefined,
    lastFiveGames: lastFiveGames.length ? {
      teamCount: lastFiveGames.length,
      eventCount: lastFiveGames.reduce((sum, team) => sum + (team.events?.length ?? team.games?.length ?? 0), 0),
    } : undefined,
  });
}

function detectCapabilities(sourceName, payload) {
  const records = asArray(payload);
  const topLevelText = payload && typeof payload === "object" ? Object.keys(payload).join(" ") : "";
  const fieldText = `${topLevelText} ${JSON.stringify(records.slice(0, 3))}`.toLowerCase();
  const capabilities = [];

  if (sourceName === "espnScoreboard") {
    return [
      "matches",
      "scores",
      "status",
      "venues",
      "teams",
      "events",
    ];
  }

  if (/scoreboard|games|events|home|away|competitions|team1|team2|match/.test(`${sourceName} ${fieldText}`)) {
    capabilities.push("matches");
  }
  if (/score|goals|homescore|awayscore|boxscore/i.test(fieldText)) capabilities.push("scores");
  if (/status|state|period|clock|minute|header/i.test(fieldText)) capabilities.push("status");
  if (/venue|stadium/i.test(fieldText)) capabilities.push("venues");
  if (/team|competitor|country|name|standings|rosters/i.test(fieldText)) capabilities.push("teams");
  if (/flag|logo|crest/i.test(fieldText)) capabilities.push("flags");
  if (/athlete|player|lineup|roster|squad/i.test(fieldText)) capabilities.push("players");
  if (/lineup|roster|squad/i.test(fieldText)) capabilities.push("lineups");
  if (/standing/i.test(fieldText)) capabilities.push("standings");
  if (/odds|pickcenter/i.test(fieldText)) capabilities.push("odds");
  if (/assist|card|substitution|timeline|event/i.test(fieldText)) capabilities.push("events");

  return unique(capabilities);
}

function summarizeFulfilledSource(sourceName, payload) {
  const records = asArray(payload);
  const sampleBuilders = {
    espnScoreboard: (record) => summarizeEspnEvent(record),
    worldcup26Games: (record) => summarizeWorldcup26Game(record),
    worldcup26Teams: (record) => summarizeWorldcup26Team(record),
  };
  const sampleBuilder = sampleBuilders[sourceName] ?? ((record) => record);

  return compactObject({
    ok: true,
    recordCount: records.length,
    capabilities: detectCapabilities(sourceName, payload),
    topLevelFields: payload && typeof payload === "object" ? Object.keys(payload).sort() : [],
    recordFields: summarizeFields(records),
    samples: records.slice(0, 3).map(sampleBuilder),
    details: sourceName === "espnSummary" ? summarizeEspnSummaryDetails(payload) : undefined,
  });
}

function summarizeRejectedSource(reason) {
  return {
    ok: false,
    error: reason?.message ?? String(reason),
  };
}

export function buildExternalDataProbeReport(results = {}) {
  const sources = {};

  for (const [sourceName, result] of Object.entries(results)) {
    sources[sourceName] = result?.status === "fulfilled"
      ? summarizeFulfilledSource(sourceName, result.value)
      : summarizeRejectedSource(result?.reason ?? "source-not-run");
  }

  return {
    generatedAt: new Date().toISOString(),
    sources,
    recommendations: [
      {
        priority: "probe-first",
        text: "先用字段覆盖率和稳定性决定主源，不直接替换现有 PostgreSQL/FIFA 数据链路。",
      },
      {
        priority: "canonical-schema",
        text: "如 ESPN/第三方源稳定，再映射到 match_events、lineups、team_match_stats 等标准表。",
      },
    ],
  };
}
