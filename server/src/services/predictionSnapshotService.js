import { createPredictionSnapshot, readDatabaseMatches } from "./databaseRepository.js";
import { buildMatchPredictionEnrichment, getWeatherFetchMode, resolveWeatherDisplay } from "./dataGateway.js";
import { localizeCityName, localizeCountryName, localizeTeamName, localizeVenueName } from "./localization.js";
import { resolveMatchPlaceholders } from "./placeholderResolver.js";
import { MODEL_VERSION, buildPrediction, buildPredictionSnapshotRecord } from "./predictionService.js";
import { fetchOpenMeteoWeather } from "./weatherApi.js";

const DEFAULT_FREEZE_WINDOW_HOURS = 48;
const HOUR_MS = 60 * 60 * 1000;

function getSnapshotSkipReason(match, now = new Date(), freezeWindowHours = DEFAULT_FREEZE_WINDOW_HOURS) {
  const kickoffAt = new Date(match.time);
  const isFinished = match.status === "finished" || Number.isFinite(match.homeScore) || Number.isFinite(match.awayScore);

  if (match.predictionSnapshot) return "has_snapshot";
  if (isFinished) return "finished";
  if (!Number.isFinite(kickoffAt.getTime())) return "invalid_time";
  if (kickoffAt.getTime() <= now.getTime()) return "kicked_off";
  if (kickoffAt.getTime() > now.getTime() + freezeWindowHours * HOUR_MS) return "outside_window";
  return null;
}

async function fetchForecastWeatherSnapshot(match) {
  if (getWeatherFetchMode({ matchTime: match.time }) !== "forecast") return null;
  return fetchOpenMeteoWeather(match.venue, match.time);
}

function countSnapshotQuality(match, enrichment, prediction, weatherSnapshot, weatherText, freezeWindowHours, now) {
  const weatherSource = weatherSnapshot?.source
    ?? (weatherText === "待更新" ? "pending" : "missing");
  const strength = prediction.predictionBreakdown?.strength ?? {};

  return {
    capturedAt: now.toISOString(),
    freezeWindowHours,
    weather: {
      source: weatherSource,
      display: weatherText,
    },
    espn: {
      homePreMatchStats: enrichment.home.teamMatchStats.length,
      awayPreMatchStats: enrichment.away.teamMatchStats.length,
      homeRecentForm: enrichment.home.recentForm.length,
      awayRecentForm: enrichment.away.recentForm.length,
      lineups: (match.lineups ?? []).filter((row) => row.source === "espn").length,
      marketOdds: (match.markets ?? []).filter((row) => String(row.source ?? "").startsWith("espn:")).length,
    },
    strength: {
      home: strength.home?.source ?? "unknown",
      away: strength.away?.source ?? "unknown",
    },
  };
}

async function buildSnapshotPrediction(
  match,
  {
    now,
    freezeWindowHours,
    fetchWeatherSnapshot = fetchForecastWeatherSnapshot,
  },
) {
  const homeTeam = { ...match.homeTeam, name: localizeTeamName(match.homeTeam.name) };
  const awayTeam = { ...match.awayTeam, name: localizeTeamName(match.awayTeam.name) };
  const venue = {
    ...match.venue,
    city: localizeCityName(match.venue.city),
    country: localizeCountryName(match.venue.country),
    name: localizeVenueName(match.venue.name),
  };
  let weatherSnapshot = null;
  try {
    weatherSnapshot = await fetchWeatherSnapshot(match);
  } catch {
    weatherSnapshot = null;
  }
  const weather = resolveWeatherDisplay({
    matchTime: match.time,
    now,
    weatherSnapshot,
  });
  const enrichment = buildMatchPredictionEnrichment(match);
  const prediction = buildPrediction(match, homeTeam, awayTeam, venue, weather, enrichment);

  return {
    ...prediction,
    snapshotQuality: countSnapshotQuality(match, enrichment, prediction, weatherSnapshot, weather, freezeWindowHours, now),
  };
}

export async function createMissingPredictionSnapshots(
  { now = new Date(), freezeWindowHours = DEFAULT_FREEZE_WINDOW_HOURS } = {},
  {
    readDatabaseMatches: readMatches = readDatabaseMatches,
    createPredictionSnapshot: savePredictionSnapshot = createPredictionSnapshot,
    fetchWeatherSnapshot = fetchForecastWeatherSnapshot,
  } = {},
) {
  const matches = await readMatches({ modelVersion: MODEL_VERSION });
  if (!matches?.length) {
    return {
      created: 0,
      skipped: 0,
      total: 0,
      snapshots: [],
      skippedReasons: {},
    };
  }

  const snapshots = [];
  let skipped = 0;
  const skippedReasons = {};

  const resolvedMatches = resolveMatchPlaceholders(matches);

  for (const match of resolvedMatches) {
    const skipReason = getSnapshotSkipReason(match, now, freezeWindowHours);
    if (skipReason) {
      skipped += 1;
      skippedReasons[skipReason] = (skippedReasons[skipReason] ?? 0) + 1;
      continue;
    }

    const prediction = await buildSnapshotPrediction(match, { now, freezeWindowHours, fetchWeatherSnapshot });
    const record = buildPredictionSnapshotRecord(match.id, prediction);
    record.explanation = {
      ...record.explanation,
      snapshotQuality: prediction.snapshotQuality,
    };
    const snapshot = await savePredictionSnapshot(record);
    snapshots.push({
      id: snapshot.id,
      matchId: snapshot.matchId,
      modelVersion: snapshot.modelVersion,
      score: prediction.score,
    });
  }

  return {
    created: snapshots.length,
    skipped,
    total: matches.length,
    snapshots,
    skippedReasons,
  };
}
