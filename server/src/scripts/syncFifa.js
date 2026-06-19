import "dotenv/config";
import { syncFifaSchedule } from "../services/fifaSyncService.js";

const result = await syncFifaSchedule();
console.log(JSON.stringify(result, null, 2));
