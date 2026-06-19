import { getPrisma } from "./databaseRepository.js";
import { fetchFifaMatches } from "./fifaApi.js";

export async function syncFifaSchedule() {
  const prisma = await getPrisma();
  if (!prisma) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const matches = await fetchFifaMatches();
  const teams = new Map();
  const venues = new Map();

  for (const match of matches) {
    teams.set(match.homeTeam.id, match.homeTeam);
    teams.set(match.awayTeam.id, match.awayTeam);
    venues.set(match.venue.id, match.venue);
  }

  for (const team of teams.values()) {
    await prisma.team.upsert({
      where: { id: team.id },
      update: {
        countryCode: team.countryCode,
        fifaRank: team.fifaRank,
        flag: team.flag,
        name: team.name,
        nameEn: team.nameEn,
      },
      create: team,
    });
  }

  for (const venue of venues.values()) {
    await prisma.venue.upsert({
      where: { id: venue.id },
      update: {
        altitude: venue.altitude,
        city: venue.city,
        country: venue.country,
        fallbackWeather: venue.fallbackWeather,
        latitude: venue.latitude,
        longitude: venue.longitude,
        name: venue.name,
        timezone: venue.timezone,
      },
      create: venue,
    });
  }

  await prisma.match.deleteMany({
    where: {
      OR: [
        { id: { startsWith: "match-" } },
        { id: { startsWith: "fifa-match-", notIn: matches.map((match) => match.id) } },
      ],
    },
  });

  for (const match of matches) {
    await prisma.match.upsert({
      where: { id: match.id },
      update: {
        awayScore: match.awayScore,
        awayTeamId: match.awayTeam.id,
        group: match.group,
        homeScore: match.homeScore,
        homeTeamId: match.homeTeam.id,
        kickoffAt: match.kickoffAt,
        stage: match.stage,
        status: match.status,
        venueId: match.venue.id,
      },
      create: {
        id: match.id,
        awayScore: match.awayScore,
        awayTeamId: match.awayTeam.id,
        group: match.group,
        homeScore: match.homeScore,
        homeTeamId: match.homeTeam.id,
        kickoffAt: match.kickoffAt,
        stage: match.stage,
        status: match.status,
        venueId: match.venue.id,
      },
    });
  }

  return {
    matches: matches.length,
    teams: teams.size,
    venues: venues.size,
    source: "fifa-api",
    syncedAt: new Date().toISOString(),
  };
}
