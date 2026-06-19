function isFinished(match) {
  return match.status === "finished" || (Number.isFinite(match.homeScore) && Number.isFinite(match.awayScore));
}

function getMatchResult(match) {
  if (!isFinished(match)) return null;
  if (match.homeScore > match.awayScore) {
    return {
      winner: match.homeTeam,
      loser: match.awayTeam,
    };
  }
  if (match.awayScore > match.homeScore) {
    return {
      winner: match.awayTeam,
      loser: match.homeTeam,
    };
  }
  return null;
}

function normalizeCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function isGroupStage(match) {
  return Boolean(match.group) && /first stage|group|小组/i.test(String(match.stage ?? ""));
}

function parsePlaceholder(team = {}) {
  const code = normalizeCode(team.countryCode);
  const name = String(team.name ?? team.nameEn ?? "").trim();

  const codeGroupRank = code.match(/^([12])([A-L])$/);
  if (codeGroupRank) {
    return {
      code: code || name,
      group: codeGroupRank[2],
      rank: Number(codeGroupRank[1]),
      type: "group-slot",
    };
  }

  const nameGroupRank = name.match(/^([A-L])组第([12])$/);
  if (nameGroupRank) {
    return {
      code: code || name,
      group: nameGroupRank[1],
      rank: Number(nameGroupRank[2]),
      type: "group-slot",
    };
  }

  const thirdPool = code.match(/^3([A-L]+)$/) ?? name.match(/^([A-L](?:\/[A-L])+)组第3$/);
  if (thirdPool) {
    return {
      code: code || name,
      groups: thirdPool[1].replaceAll("/", "").split(""),
      type: "third-place-pool",
    };
  }

  const winner = code.match(/^W(\d+)$/) ?? name.match(/^第(\d+)场胜者$/);
  if (winner) {
    return {
      code: code || name,
      matchNumber: Number(winner[1]),
      type: "match-winner",
    };
  }

  const loser = code.match(/^RU(\d+)$/) ?? name.match(/^第(\d+)场负者$/);
  if (loser) {
    return {
      code: code || name,
      matchNumber: Number(loser[1]),
      type: "match-loser",
    };
  }

  return null;
}

function cloneTeamWithResolution(team, resolution) {
  return {
    ...team,
    placeholderResolvedFrom: resolution,
  };
}

function keepUnresolvedPlaceholder(team, reason) {
  return {
    ...team,
    placeholderResolution: {
      reason,
      status: "unresolved",
    },
  };
}

function buildMatchNumberMap(matches) {
  const sorted = [...matches].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  return new Map(sorted.map((match, index) => [index + 1, match]));
}

function createStandingEntry(team) {
  return {
    team,
    played: 0,
    points: 0,
    goalDiff: 0,
    goalsFor: 0,
  };
}

function addStandingResult(table, team, goalsFor, goalsAgainst, points) {
  const current = table.get(team.id) ?? createStandingEntry(team);
  current.played += 1;
  current.points += points;
  current.goalDiff += goalsFor - goalsAgainst;
  current.goalsFor += goalsFor;
  table.set(team.id, current);
}

function buildGroupStandings(matches) {
  const standings = new Map();

  for (const match of matches) {
    if (!isGroupStage(match) || !isFinished(match)) continue;
    const group = String(match.group).replace("Group ", "");
    const table = standings.get(group) ?? new Map();
    const homePoints = match.homeScore > match.awayScore ? 3 : match.homeScore === match.awayScore ? 1 : 0;
    const awayPoints = match.awayScore > match.homeScore ? 3 : match.homeScore === match.awayScore ? 1 : 0;

    addStandingResult(table, match.homeTeam, match.homeScore, match.awayScore, homePoints);
    addStandingResult(table, match.awayTeam, match.awayScore, match.homeScore, awayPoints);
    standings.set(group, table);
  }

  return new Map([...standings.entries()].map(([group, table]) => [
    group,
    [...table.values()].sort((a, b) => (
      b.points - a.points
      || b.goalDiff - a.goalDiff
      || b.goalsFor - a.goalsFor
      || a.team.name.localeCompare(b.team.name)
    )),
  ]));
}

function resolveTeam(team, context) {
  const placeholder = parsePlaceholder(team);
  if (!placeholder) return team;

  if (placeholder.type === "group-slot") {
    const row = context.groupStandings.get(placeholder.group)?.[placeholder.rank - 1];
    return row
      ? cloneTeamWithResolution(row.team, placeholder)
      : keepUnresolvedPlaceholder(team, "group-standing-unavailable");
  }

  if (placeholder.type === "match-winner" || placeholder.type === "match-loser") {
    const sourceMatch = context.matchNumberMap.get(placeholder.matchNumber);
    const result = sourceMatch ? getMatchResult(sourceMatch) : null;
    const teamToInherit = placeholder.type === "match-winner" ? result?.winner : result?.loser;

    return teamToInherit
      ? cloneTeamWithResolution(teamToInherit, placeholder)
      : keepUnresolvedPlaceholder(team, "source-match-unresolved");
  }

  return keepUnresolvedPlaceholder(team, "third-place-pool-unresolved");
}

export function resolveMatchPlaceholders(matches = []) {
  const context = {
    groupStandings: buildGroupStandings(matches),
    matchNumberMap: buildMatchNumberMap(matches),
  };

  return matches.map((match) => ({
    ...match,
    homeTeam: resolveTeam(match.homeTeam, context),
    awayTeam: resolveTeam(match.awayTeam, context),
  }));
}
