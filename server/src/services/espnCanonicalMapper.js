function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""));
}

function numberOrOriginal(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && String(value).trim() !== "" ? numberValue : value;
}

function mapStats(stats = []) {
  return Object.fromEntries(
    stats
      .filter((stat) => stat?.name)
      .map((stat) => [stat.name, numberOrOriginal(stat.value ?? stat.displayValue)]),
  );
}

function teamName(team = {}) {
  return team.displayName ?? team.shortDisplayName ?? team.name ?? team.abbreviation;
}

function teamId(team = {}) {
  return team.id ? String(team.id) : undefined;
}

function mapTeams(summary = {}) {
  const competitors = summary.header?.competitions?.[0]?.competitors ?? [];
  return competitors.map((competitor) => compactObject({
    externalTeamId: String(competitor.team?.id ?? competitor.id ?? ""),
    name: teamName(competitor.team),
    side: competitor.homeAway,
    score: Number.isFinite(Number(competitor.score)) ? Number(competitor.score) : undefined,
  })).filter((team) => team.externalTeamId || team.name);
}

function mapMatchStatus(summary = {}) {
  const competition = summary.header?.competitions?.[0] ?? {};
  const statusType = competition.status?.type ?? summary.header?.status?.type ?? {};
  const state = String(statusType.state ?? statusType.name ?? statusType.description ?? "").toLowerCase();
  if (statusType.completed === true || state === "post" || state === "final" || /final|full time|completed/.test(state)) {
    return "finished";
  }
  if (state === "in" || state === "live" || /progress|half/.test(state)) {
    return "live";
  }
  return "scheduled";
}

function mapMatchResult(summary = {}) {
  const teams = mapTeams(summary);
  const home = teams.find((team) => team.side === "home");
  const away = teams.find((team) => team.side === "away");

  return compactObject({
    status: mapMatchStatus(summary),
    homeScore: Number.isFinite(home?.score) ? home.score : undefined,
    awayScore: Number.isFinite(away?.score) ? away.score : undefined,
  });
}

function mapTeamMatchStats(summary = {}) {
  const teams = summary.boxscore?.teams ?? [];
  return teams.map((entry) => compactObject({
    externalTeamId: teamId(entry.team),
    teamName: teamName(entry.team),
    stats: mapStats(entry.statistics ?? []),
  })).filter((entry) => entry.externalTeamId || entry.teamName);
}

function rosterEntries(roster = {}) {
  return roster.roster ?? roster.athletes ?? roster.entries ?? [];
}

function mapLineups(summary = {}) {
  const rosters = summary.rosters ?? [];
  return rosters.map((roster) => compactObject({
    externalTeamId: teamId(roster.team),
    teamName: teamName(roster.team),
    athletes: rosterEntries(roster).map((entry) => compactObject({
      externalAthleteId: entry.athlete?.id ? String(entry.athlete.id) : undefined,
      name: teamName(entry.athlete),
      position: entry.position?.abbreviation ?? entry.position?.displayName ?? entry.position,
      starter: entry.starter === true,
    })),
  })).filter((entry) => entry.externalTeamId || entry.teamName);
}

function standingGroups(summary = {}) {
  if (Array.isArray(summary.standings?.groups)) return summary.standings.groups;
  if (Array.isArray(summary.standings?.entries)) {
    return [{ name: summary.standings.name ?? "standings", entries: summary.standings.entries }];
  }
  return [];
}

function mapStandings(summary = {}) {
  return standingGroups(summary).flatMap((group) => {
    const entries = group.standings?.entries ?? group.entries ?? [];
    return entries.map((entry) => compactObject({
      group: group.name ?? group.group,
      externalTeamId: teamId(entry.team),
      teamName: teamName(entry.team),
      stats: mapStats(entry.stats ?? []),
    }));
  }).filter((entry) => entry.externalTeamId || entry.teamName);
}

function mapOdds(summary = {}) {
  return (summary.odds ?? []).map((market) => compactObject({
    provider: market.provider?.name ?? market.provider?.displayName ?? market.provider,
    details: market.details,
    overUnder: market.overUnder,
  }));
}

function eventTeamId(event = {}, side) {
  const directValue = side === "home"
    ? event.homeTeamId ?? event.homeTeam?.id ?? event.home?.id
    : event.awayTeamId ?? event.awayTeam?.id ?? event.away?.id;
  if (directValue) return String(directValue);

  const competitors = event.competitions?.[0]?.competitors ?? event.competitors ?? [];
  const competitor = competitors.find((item) => item.homeAway === side);
  return competitor?.team?.id || competitor?.id ? String(competitor.team?.id ?? competitor.id) : undefined;
}

function teamResult(teamScore, opponentScore) {
  if (!Number.isFinite(teamScore) || !Number.isFinite(opponentScore)) return undefined;
  if (teamScore > opponentScore) return "W";
  if (teamScore < opponentScore) return "L";
  return "D";
}

function mapRecentFormEvent(event = {}, externalTeamId) {
  const homeScore = Number.isFinite(Number(event.homeTeamScore)) ? Number(event.homeTeamScore) : undefined;
  const awayScore = Number.isFinite(Number(event.awayTeamScore)) ? Number(event.awayTeamScore) : undefined;
  const homeTeamId = eventTeamId(event, "home");
  const awayTeamId = eventTeamId(event, "away");
  const isHome = homeTeamId && externalTeamId ? homeTeamId === String(externalTeamId) : undefined;
  const teamScore = isHome === true ? homeScore : isHome === false ? awayScore : undefined;
  const opponentScore = isHome === true ? awayScore : isHome === false ? homeScore : undefined;

  return compactObject({
    externalEventId: event.id ? String(event.id) : undefined,
    date: event.gameDate ?? event.date,
    homeTeamId,
    awayTeamId,
    homeScore,
    awayScore,
    teamScore,
    opponentScore,
    result: teamResult(teamScore, opponentScore),
    isHome,
  });
}

function mapRecentForm(summary = {}) {
  return (summary.lastFiveGames ?? []).map((team) => compactObject({
    externalTeamId: teamId(team.team),
    teamName: teamName(team.team),
    events: (team.events ?? team.games ?? []).map((event) => mapRecentFormEvent(event, teamId(team.team))),
  })).filter((entry) => entry.externalTeamId || entry.teamName);
}

export function mapEspnSummaryToCanonicalDraft(summary = {}, { sourceEventId } = {}) {
  return {
    source: "espn",
    externalMatchId: String(summary.header?.id ?? sourceEventId ?? ""),
    matchResult: mapMatchResult(summary),
    teams: mapTeams(summary),
    teamMatchStats: mapTeamMatchStats(summary),
    lineups: mapLineups(summary),
    standings: mapStandings(summary),
    odds: mapOdds(summary),
    recentForm: mapRecentForm(summary),
  };
}
