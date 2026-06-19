const MATCH_TIME_TOLERANCE_MS = 45 * 60 * 1000;

const TEAM_ALIASES = new Map([
  ["bosnia herzegovina", "bosnia and herzegovina"],
  ["bosnia", "bosnia and herzegovina"],
  ["cape verde", "cabo verde"],
  ["cote d ivoire", "ivory coast"],
  ["ir iran", "iran"],
  ["south korea", "korea republic"],
  ["usa", "united states"],
  ["us", "united states"],
]);

function normalizeName(value) {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  return TEAM_ALIASES.get(normalized) ?? normalized;
}

function getCompetitor(event, side) {
  return event?.competitions?.[0]?.competitors?.find((competitor) => competitor.homeAway === side);
}

function getEspnTeamName(event, side) {
  const team = getCompetitor(event, side)?.team;
  return team?.displayName ?? team?.shortDisplayName ?? team?.name ?? team?.abbreviation;
}

function getLocalTeamName(match, side) {
  const team = side === "home" ? match.homeTeam : match.awayTeam;
  return team?.nameEn ?? team?.name;
}

function getKickoffAt(match) {
  return match.kickoffAt instanceof Date ? match.kickoffAt : new Date(match.kickoffAt);
}

export function findDatabaseMatchForEspnEvent(event, matches = [], { toleranceMs = MATCH_TIME_TOLERANCE_MS } = {}) {
  const eventTime = new Date(event?.date).getTime();
  if (!Number.isFinite(eventTime)) return null;

  const eventHome = normalizeName(getEspnTeamName(event, "home"));
  const eventAway = normalizeName(getEspnTeamName(event, "away"));
  if (!eventHome || !eventAway) return null;

  return matches.find((match) => {
    const matchTime = getKickoffAt(match).getTime();
    if (Math.abs(matchTime - eventTime) > toleranceMs) return false;

    const homeName = normalizeName(getLocalTeamName(match, "home"));
    const awayName = normalizeName(getLocalTeamName(match, "away"));

    return homeName === eventHome && awayName === eventAway;
  }) ?? null;
}

function reasonFromCandidates(eventTime, eventHome, eventAway, candidates) {
  if (!Number.isFinite(eventTime)) return "INVALID_EVENT_TIME";
  if (!eventHome || !eventAway) return "MISSING_EVENT_TEAMS";
  if (!candidates.length) return "NO_LOCAL_TIME_CANDIDATE";
  if (candidates.some((candidate) => candidate.homeMatches || candidate.awayMatches)) return "TEAM_MISMATCH";
  return "NO_TEAM_MATCH";
}

export function buildEspnMatchDiagnostics(event, matches = [], { toleranceMs = MATCH_TIME_TOLERANCE_MS } = {}) {
  const eventTime = new Date(event?.date).getTime();
  const eventHomeRaw = getEspnTeamName(event, "home");
  const eventAwayRaw = getEspnTeamName(event, "away");
  const eventHome = normalizeName(eventHomeRaw);
  const eventAway = normalizeName(eventAwayRaw);
  const candidates = matches
    .map((match) => {
      const matchTime = getKickoffAt(match).getTime();
      const homeName = normalizeName(getLocalTeamName(match, "home"));
      const awayName = normalizeName(getLocalTeamName(match, "away"));

      return {
        matchId: match.id,
        kickoffAt: getKickoffAt(match).toISOString(),
        home: getLocalTeamName(match, "home"),
        away: getLocalTeamName(match, "away"),
        timeDiffMinutes: Number.isFinite(eventTime) ? Math.round(Math.abs(matchTime - eventTime) / 60000) : null,
        withinTolerance: Number.isFinite(eventTime) ? Math.abs(matchTime - eventTime) <= toleranceMs : false,
        homeMatches: homeName === eventHome,
        awayMatches: awayName === eventAway,
      };
    })
    .filter((candidate) => candidate.withinTolerance || candidate.homeMatches || candidate.awayMatches)
    .sort((a, b) => {
      const scoreA = Number(a.homeMatches) + Number(a.awayMatches);
      const scoreB = Number(b.homeMatches) + Number(b.awayMatches);
      return scoreB - scoreA || (a.timeDiffMinutes ?? 99999) - (b.timeDiffMinutes ?? 99999);
    })
    .slice(0, 3);

  return {
    event: {
      id: event?.id,
      kickoffAt: event?.date,
      home: eventHomeRaw,
      away: eventAwayRaw,
      normalizedHome: eventHome,
      normalizedAway: eventAway,
    },
    reason: reasonFromCandidates(eventTime, eventHome, eventAway, candidates),
    candidates,
  };
}

export function buildTeamIdMapForEspnDraft(draft = {}, match) {
  const map = new Map();
  if (!match) return map;

  for (const team of draft.teams ?? []) {
    if (team.side === "home" && team.externalTeamId && match.homeTeamId) {
      map.set(String(team.externalTeamId), match.homeTeamId);
    }
    if (team.side === "away" && team.externalTeamId && match.awayTeamId) {
      map.set(String(team.externalTeamId), match.awayTeamId);
    }
  }

  return map;
}
