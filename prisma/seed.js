import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { matches, teams, venues } from "../server/src/data/mockData.js";

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("USER:PASSWORD@HOST")) {
  console.error("DATABASE_URL is not configured. Copy .env.example to .env and set your PostgreSQL URL first.");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  for (const team of teams) {
    await prisma.team.upsert({
      where: { id: team.id },
      update: {
        countryCode: team.countryCode,
        fifaRank: team.fifaRank,
        flag: team.flag,
        name: team.name,
        nameEn: team.nameEn,
      },
      create: {
        id: team.id,
        countryCode: team.countryCode,
        fifaRank: team.fifaRank,
        flag: team.flag,
        name: team.name,
        nameEn: team.nameEn,
      },
    });
  }

  for (const venue of venues) {
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
      create: {
        id: venue.id,
        altitude: venue.altitude,
        city: venue.city,
        country: venue.country,
        fallbackWeather: venue.fallbackWeather,
        latitude: venue.latitude,
        longitude: venue.longitude,
        name: venue.name,
        timezone: venue.timezone,
      },
    });
  }

  for (const match of matches) {
    await prisma.match.upsert({
      where: { id: match.id },
      update: {
        awayTeamId: match.awayTeamId,
        group: match.group,
        homeTeamId: match.homeTeamId,
        kickoffAt: new Date(match.time),
        stage: match.stage,
        status: match.status,
        venueId: match.venueId,
      },
      create: {
        id: match.id,
        awayTeamId: match.awayTeamId,
        group: match.group,
        homeTeamId: match.homeTeamId,
        kickoffAt: new Date(match.time),
        stage: match.stage,
        status: match.status,
        venueId: match.venueId,
      },
    });
  }

  console.log(`Seeded ${teams.length} teams, ${venues.length} venues, ${matches.length} matches.`);
} finally {
  await prisma.$disconnect();
}
