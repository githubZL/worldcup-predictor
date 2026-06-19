import cors from "@fastify/cors";
import Fastify from "fastify";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerHealthRoutes } from "./routes/health.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
  });

  await registerHealthRoutes(app);
  await registerDashboardRoutes(app);
  await registerAdminRoutes(app);

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: "NOT_FOUND", path: request.url });
  });

  return app;
}
