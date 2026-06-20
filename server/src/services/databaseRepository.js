let prisma;

export function hasDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  return Boolean(value && !value.includes("USER:PASSWORD@HOST"));
}

export async function getPrisma() {
  if (!hasDatabaseUrl()) return null;
  if (prisma) return prisma;

  const { PrismaClient } = await import("@prisma/client");
  prisma = new PrismaClient();
  return prisma;
}

export async function readDatabaseMatches({ modelVersion } = {}) {
  const client = await getPrisma();
  if (!client) return null;

  const rows = await client.match.findMany({
    include: {
      awayTeam: {
        include: {
          matchStats: {
            where: { source: "espn" },
            include: { match: true },
          },
          recentForm: {
            where: { source: "espn" },
            orderBy: { eventDate: "desc" },
            take: 5,
          },
        },
      },
      homeTeam: {
        include: {
          matchStats: {
            where: { source: "espn" },
            include: { match: true },
          },
          recentForm: {
            where: { source: "espn" },
            orderBy: { eventDate: "desc" },
            take: 5,
          },
        },
      },
      predictions: {
        where: modelVersion ? { modelVersion } : undefined,
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
      lineups: {
        where: { source: "espn" },
      },
      markets: {
        where: {
          source: {
            startsWith: "espn:",
          },
        },
      },
      venue: true,
    },
    orderBy: {
      kickoffAt: "asc",
    },
  });

  if (rows.length === 0) return null;

  return rows.map((row) => ({
    id: row.id,
    time: row.kickoffAt.toISOString(),
    stage: row.stage,
    group: row.group,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    status: row.status,
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
    venue: row.venue,
    lineups: row.lineups,
    markets: row.markets,
    predictionSnapshot: row.predictions[0] ?? null,
  }));
}

export async function createPredictionSnapshot(data) {
  const client = await getPrisma();
  if (!client) return null;

  const existing = await client.prediction.findFirst({
    where: {
      matchId: data.matchId,
      modelVersion: data.modelVersion,
    },
  });
  if (existing) return existing;

  try {
    return await client.prediction.create({ data });
  } catch (error) {
    if (error?.code === "P2002") {
      return client.prediction.findFirst({
        where: {
          matchId: data.matchId,
          modelVersion: data.modelVersion,
        },
      });
    }
    throw error;
  }
}
