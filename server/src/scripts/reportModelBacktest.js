import "dotenv/config";

import { getDashboard } from "../services/dataGateway.js";
import { buildModelBacktestReport } from "../services/modelReviewService.js";
import { MODEL_VERSION } from "../services/predictionService.js";

const dashboard = await getDashboard();
const report = buildModelBacktestReport(dashboard.matches, { modelVersion: MODEL_VERSION });

console.log(JSON.stringify(report, null, 2));
