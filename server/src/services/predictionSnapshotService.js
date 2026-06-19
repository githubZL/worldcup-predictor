import { createPredictionSnapshot, readDatabaseMatches } from "./databaseRepository.js";
import { localizeCityName, localizeCountryName, localizeTeamName, localizeVenueName } from "./localization.js";
import { resolveMatchPlaceholders } from "./placeholderResolver.js";
import { MODEL_VERSION, buildPrediction, buildPredictionSnapshotRecord } from "./predictionService.js";
import { formatWeatherSnapshot } from "./weatherApi.js";

function isSnapshotEligible(match, now = new Date()) {
  const kickoffAt = new Date(match.time);
  const isFinished = match.status === "finished" || Number.isFinite(match.homeScore) || Number.isFinite(match.awayScore);

  return !match.predictionSnapshot && !isFinished && kickoffAt.getTime() > now.getTime();
}

function buildSnapshotPrediction(match) {
  const homeTeam = { ...match.homeTeam, name: localizeTeamName(match.homeTeam.name) };
  const awayTeam = { ...match.awayTeam, name: localizeTeamName(match.awayTeam.name) };
  const venue = {
    ...match.venue,
    city: localizeCityName(match.venue.city),
    country: localizeCountryName(match.venue.country),
    name: localizeVenueName(match.venue.name),
  };
  const weather = formatWeatherSnapshot(null, venue.fallbackWeather);

  return buildPrediction(match, homeTeam, awayTeam, venue, weather);
}

export async function createMissingPredictionSnapshots({ now = new Date() } = {}) {
  const matches = await readDatabaseMatches({ modelVersion: MODEL_VERSION });
  if (!matches?.length) {
    return {
      created: 0,
      skipped: 0,
      total: 0,
      snapshots: [],
    };
  }

  const snapshots = [];
  let skipped = 0;

  const resolvedMatches = resolveMatchPlaceholders(matches);

  for (const match of resolvedMatches) {
    if (!isSnapshotEligible(match, now)) {
      skipped += 1;
      continue;
    }

    const prediction = buildSnapshotPrediction(match);
    const snapshot = await createPredictionSnapshot(buildPredictionSnapshotRecord(match.id, prediction));
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
  };
}
