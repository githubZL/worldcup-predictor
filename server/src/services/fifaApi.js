import { enrichFifaVenue } from "./venueCatalog.js";

const FIFA_MATCHES_URL = "https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&count=200&language=en";

function pickLocalized(items, fallback = "") {
  if (!Array.isArray(items) || items.length === 0) return fallback;
  const english = items.find((item) => String(item.Locale ?? "").startsWith("en"));
  return (english?.Description ?? items[0]?.Description ?? fallback).trim();
}

function normalizeTeam(team, placeholder) {
  if (!team?.IdTeam) {
    return {
      id: `placeholder-${placeholder}`,
      name: placeholder ?? "TBD",
      nameEn: placeholder ?? "TBD",
      countryCode: placeholder ?? null,
      flag: "🏳️",
      fifaRank: null,
    };
  }

  return {
    id: `fifa-team-${team.IdTeam}`,
    name: pickLocalized(team.TeamName, team.ShortClubName ?? team.Abbreviation),
    nameEn: pickLocalized(team.TeamName, team.ShortClubName ?? team.Abbreviation),
    countryCode: team.IdCountry ?? team.Abbreviation ?? null,
    flag: team.Abbreviation ? team.Abbreviation : null,
    fifaRank: null,
  };
}

function normalizeVenue(stadium) {
  const id = stadium?.IdStadium ? `fifa-venue-${stadium.IdStadium}` : "fifa-venue-tbd";
  const name = pickLocalized(stadium?.Name, "TBD Stadium");
  const city = pickLocalized(stadium?.CityName, "TBD");

  return enrichFifaVenue({
    id,
    name,
    city,
    country: stadium?.IdCountry ?? "TBD",
    latitude: Number(stadium?.Latitude ?? 0),
    longitude: Number(stadium?.Longitude ?? 0),
    altitude: null,
    timezone: "UTC",
    fallbackWeather: "天气待确认",
  });
}

function normalizeMatch(match) {
  const homeTeam = normalizeTeam(match.Home, match.PlaceHolderA);
  const awayTeam = normalizeTeam(match.Away, match.PlaceHolderB);
  const venue = normalizeVenue(match.Stadium);
  const stage = pickLocalized(match.StageName, "World Cup");
  const groupName = pickLocalized(match.GroupName, "");
  const group = groupName.replace("Group ", "") || null;
  const kickoffAt = new Date(match.Date);
  const isFuture = kickoffAt.getTime() > Date.now();

  return {
    id: `fifa-match-${match.IdMatch}`,
    fifaMatchId: match.IdMatch,
    stage,
    group,
    kickoffAt,
    status: isFuture ? "scheduled" : match.MatchStatus === 0 ? "finished" : match.MatchStatus === 3 ? "live" : "scheduled",
    homeTeam,
    awayTeam,
    venue,
    homeScore: isFuture ? null : match.HomeTeamScore ?? null,
    awayScore: isFuture ? null : match.AwayTeamScore ?? null,
  };
}

export async function fetchFifaMatches({ signal } = {}) {
  const response = await fetch(FIFA_MATCHES_URL, {
    headers: {
      "accept": "application/json",
      "user-agent": "worldcup-predictor/0.1",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`FIFA API failed: ${response.status}`);
  }

  const payload = await response.json();
  return (payload.Results ?? []).map(normalizeMatch);
}
