import { championRanking, factorWeights, matches, teams, venues } from "../data/mockData.js";
import { readDatabaseMatches } from "./databaseRepository.js";
import { buildDataHealth } from "./dataHealthService.js";
import { buildDashboardMeta } from "./dataQuality.js";
import { readLatestMaintenanceStatus } from "./maintenanceStatusService.js";
import { buildModelReview } from "./modelReviewService.js";
import { resolveMatchPlaceholders } from "./placeholderResolver.js";
import { MODEL_VERSION, buildPrediction, buildPredictionFromSnapshot, buildPredictionReview } from "./predictionService.js";
import { fetchOpenMeteoHistoricalWeather, fetchOpenMeteoWeather, formatWeatherSnapshot } from "./weatherApi.js";
import { fetchSportsDbWorldCupTeams } from "./sportsApi.js";
import {
  localizeCityName,
  localizeCountryName,
  localizeFlag,
  localizeGroupName,
  localizeStageName,
  localizeStatus,
  localizeTeamName,
  localizeVenueName,
} from "./localization.js";

const teamById = new Map(teams.map((team) => [team.id, team]));
const venueById = new Map(venues.map((venue) => [venue.id, venue]));
const FORECAST_HORIZON_DAYS = 16;
const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeLocalMatch(match) {
  return {
    id: match.id,
    time: match.time,
    stage: match.stage,
    group: match.group,
    homeScore: null,
    awayScore: null,
    status: match.status,
    homeTeam: teamById.get(match.homeTeamId),
    awayTeam: teamById.get(match.awayTeamId),
    venue: venueById.get(match.venueId),
  };
}

async function withTimeout(task, timeoutMs = 3500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function rowTime(row) {
  const value = row?.match?.kickoffAt ?? row?.match?.time ?? row?.eventDate;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function preMatchEspnStats(team, kickoffTime) {
  return (team?.matchStats ?? [])
    .filter((row) => row.source === "espn")
    .filter((row) => rowTime(row) > 0 && rowTime(row) < kickoffTime)
    .sort((a, b) => rowTime(b) - rowTime(a))
    .slice(0, 5);
}

function espnRecentForm(team) {
  return (team?.recentForm ?? [])
    .filter((row) => row.source === "espn")
    .sort((a, b) => rowTime(b) - rowTime(a))
    .slice(0, 5);
}

function espnLineupsForTeam(match, teamId) {
  return (match.lineups ?? [])
    .filter((row) => row.source === "espn" && row.teamId === teamId);
}

function espnMarketOdds(match) {
  return (match.markets ?? [])
    .filter((row) => String(row.source ?? "").startsWith("espn:"));
}

export function buildMatchPredictionEnrichment(match) {
  const kickoffTime = new Date(match.time).getTime();
  const markets = espnMarketOdds(match);

  return {
    source: "espn",
    home: {
      teamMatchStats: preMatchEspnStats(match.homeTeam, kickoffTime),
      recentForm: espnRecentForm(match.homeTeam),
      marketOdds: markets,
      lineups: espnLineupsForTeam(match, match.homeTeam?.id),
    },
    away: {
      teamMatchStats: preMatchEspnStats(match.awayTeam, kickoffTime),
      recentForm: espnRecentForm(match.awayTeam),
      marketOdds: markets,
      lineups: espnLineupsForTeam(match, match.awayTeam?.id),
    },
  };
}

export function getWeatherFetchMode({ matchTime, now = new Date() }) {
  const kickoffTime = new Date(matchTime).getTime();
  const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const forecastHorizonMs = FORECAST_HORIZON_DAYS * DAY_MS;

  if (!Number.isFinite(kickoffTime) || !Number.isFinite(nowTime)) return "fallback";
  if (kickoffTime < nowTime) return "historical";
  if (kickoffTime <= nowTime + forecastHorizonMs) return "forecast";
  return "pending";
}

export function resolveWeatherDisplay({
  matchTime,
  now = new Date(),
  weatherSnapshot,
  fallbackWeather,
}) {
  const weatherMode = getWeatherFetchMode({ matchTime, now });

  if (!weatherSnapshot && weatherMode === "pending") return "待更新";
  return formatWeatherSnapshot(weatherSnapshot, fallbackWeather);
}

async function enrichMatch(match) {
  const homeTeam = match.homeTeam;
  const awayTeam = match.awayTeam;
  const venue = match.venue;
  let weatherSnapshot = null;
  const now = Date.now();
  const weatherMode = getWeatherFetchMode({ matchTime: match.time, now: new Date(now) });

  if (process.env.ENABLE_LIVE_WEATHER !== "false" && weatherMode !== "pending") {
    try {
      weatherSnapshot = await withTimeout((signal) => {
        if (weatherMode === "historical") {
          return fetchOpenMeteoHistoricalWeather(venue, match.time, { signal });
        }
        return fetchOpenMeteoWeather(venue, match.time, { signal });
      });
    } catch {
      weatherSnapshot = null;
    }
  }

  const weather = resolveWeatherDisplay({
    matchTime: match.time,
    now: new Date(now),
    weatherSnapshot,
    fallbackWeather: venue.fallbackWeather,
  });
  const localizedHomeTeam = { ...homeTeam, name: localizeTeamName(homeTeam.name) };
  const localizedAwayTeam = { ...awayTeam, name: localizeTeamName(awayTeam.name) };
  const localizedVenue = {
    ...venue,
    city: localizeCityName(venue.city),
    country: localizeCountryName(venue.country),
    name: localizeVenueName(venue.name),
  };
  const predictionEnrichment = buildMatchPredictionEnrichment(match);
  const computedPrediction = buildPrediction(match, localizedHomeTeam, localizedAwayTeam, localizedVenue, weather, predictionEnrichment);
  const prediction = match.predictionSnapshot
    ? buildPredictionFromSnapshot(match.predictionSnapshot, computedPrediction)
    : { ...computedPrediction, predictionSource: "computed" };
  const hasResult = Number.isFinite(match.homeScore) && Number.isFinite(match.awayScore);
  const resultScore = hasResult ? `${match.homeScore} - ${match.awayScore}` : null;
  const predictedScore = prediction.score;
  const predictionReview = buildPredictionReview(prediction, match);
  const backtestReview = buildPredictionReview(computedPrediction, match);
  const homeStrength = prediction.predictionBreakdown?.strength?.home;
  const awayStrength = prediction.predictionBreakdown?.strength?.away;
  const formatRank = (team, strength) => {
    if (team.fifaRank) return `世界排名 ${team.fifaRank}`;
    if (strength?.rank && strength.source === "baseline") return `基线排名 ${strength.rank}`;
    return "排名待定";
  };

  return {
    id: match.id,
    time: match.time,
    stage: localizeStageName(match.stage),
    group: localizeGroupName(match.group),
    home: localizedHomeTeam.name,
    away: localizedAwayTeam.name,
    homeFlag: localizeFlag(homeTeam.flag ?? homeTeam.countryCode),
    awayFlag: localizeFlag(awayTeam.flag ?? awayTeam.countryCode),
    rank: [
      formatRank(homeTeam, homeStrength),
      formatRank(awayTeam, awayStrength),
    ],
    venue: localizedVenue.name,
    venueMeta: {
      city: localizedVenue.city,
      country: localizedVenue.country,
      altitude: venue.altitude,
      latitude: venue.latitude,
      longitude: venue.longitude,
      timezone: venue.timezone,
    },
    weather,
    weatherSnapshot,
    status: localizeStatus(match.status),
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    predictedScore,
    resultScore,
    predictionReview,
    backtestReview,
    ...prediction,
    score: resultScore ?? predictedScore,
  };
}

export async function getMatches() {
  let source = "local-fixture-fallback";
  let sourceMatches = matches.map(normalizeLocalMatch);

  try {
    const databaseMatches = await readDatabaseMatches({ modelVersion: MODEL_VERSION });
    if (databaseMatches?.length) {
      source = "database-postgresql";
      sourceMatches = databaseMatches;
    }
  } catch {
    source = "local-fixture-fallback";
  }

  const resolvedMatches = resolveMatchPlaceholders(sourceMatches);
  const enrichedMatches = await Promise.all(resolvedMatches.map(enrichMatch));
  return { matches: enrichedMatches, source };
}

export async function getDashboard() {
  const { matches: enrichedMatches, source } = await getMatches();
  const weatherSource = process.env.ENABLE_LIVE_WEATHER === "false" ? "local-weather-fallback" : "open-meteo-with-fallback";
  const sportsSource = process.env.ENABLE_SPORTSDB === "false" ? "disabled" : "thesportsdb-optional";
  const maintenance = await readLatestMaintenanceStatus();
  const meta = buildDashboardMeta({
    scheduleSource: source,
    weatherSource,
    sportsSource,
  });

  return {
    meta: {
      ...meta,
      maintenance,
      dataHealth: buildDataHealth(enrichedMatches),
    },
    matches: enrichedMatches,
    championRanking,
    factorWeights,
    modelReview: buildModelReview(enrichedMatches),
  };
}

export async function getSportsDbTeams() {
  if (process.env.ENABLE_SPORTSDB === "false") {
    return { source: "disabled", teams: [] };
  }

  try {
    const remoteTeams = await withTimeout((signal) => fetchSportsDbWorldCupTeams({ signal }));
    return { source: "thesportsdb", teams: remoteTeams };
  } catch {
    return { source: "local-fallback", teams };
  }
}
