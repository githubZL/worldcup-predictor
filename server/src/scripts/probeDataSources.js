import "dotenv/config";

import { fetchEspnScoreboard, fetchEspnSummary } from "../services/espnApi.js";
import { buildExternalDataProbeReport } from "../services/externalDataProbe.js";
import { fetchWorldcup26Games, fetchWorldcup26Teams } from "../services/worldcup26Api.js";

async function withTimeout(task, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function probe() {
  const espnScoreboardResult = await Promise.allSettled([
    withTimeout((signal) => fetchEspnScoreboard({ signal })),
  ]).then(([result]) => result);

  const firstEspnEventId = espnScoreboardResult.status === "fulfilled"
    ? espnScoreboardResult.value?.events?.[0]?.id
    : null;

  const [espnSummary, worldcup26Games, worldcup26Teams] = await Promise.allSettled([
    firstEspnEventId
      ? withTimeout((signal) => fetchEspnSummary(firstEspnEventId, { signal }))
      : Promise.reject(new Error("ESPN scoreboard did not return an event id for summary probing")),
    withTimeout((signal) => fetchWorldcup26Games({ signal }), 20000),
    withTimeout((signal) => fetchWorldcup26Teams({ signal }), 20000),
  ]);

  return buildExternalDataProbeReport({
    espnScoreboard: espnScoreboardResult,
    espnSummary,
    worldcup26Games,
    worldcup26Teams,
  });
}

const report = await probe();
console.log(JSON.stringify(report, null, 2));
