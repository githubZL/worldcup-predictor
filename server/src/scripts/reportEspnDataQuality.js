import "dotenv/config";

import { getEspnDataQualityReport } from "../services/espnDataQualityService.js";

const report = await getEspnDataQualityReport();
console.log(JSON.stringify(report, null, 2));
