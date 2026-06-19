import "dotenv/config";
import { createMissingPredictionSnapshots } from "../services/predictionSnapshotService.js";

const result = await createMissingPredictionSnapshots();
console.log(JSON.stringify(result, null, 2));
