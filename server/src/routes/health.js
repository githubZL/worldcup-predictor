export async function registerHealthRoutes(app) {
  app.get("/api/health", async () => ({
    ok: true,
    service: "worldcup-predictor-api",
    timestamp: new Date().toISOString(),
  }));
}
