import { getDashboard, getMatches, getSportsDbTeams } from "../services/dataGateway.js";

export async function registerDashboardRoutes(app) {
  app.get("/api/dashboard", async () => getDashboard());

  app.get("/api/matches", async () => getMatches());

  app.get("/api/matches/:id", async (request, reply) => {
    const { matches } = await getMatches();
    const match = matches.find((item) => item.id === request.params.id);

    if (!match) {
      return reply.code(404).send({ error: "MATCH_NOT_FOUND" });
    }

    return { match };
  });

  app.get("/api/teams", async () => getSportsDbTeams());
}
