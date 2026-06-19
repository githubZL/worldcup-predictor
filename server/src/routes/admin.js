import { syncFifaSchedule } from "../services/fifaSyncService.js";
import { getEspnDataQualityReport } from "../services/espnDataQualityService.js";

export async function registerAdminRoutes(app) {
  app.post("/api/admin/sync-fifa", async () => syncFifaSchedule());

  app.get("/api/admin/espn-data-quality", async () => getEspnDataQualityReport());
}
