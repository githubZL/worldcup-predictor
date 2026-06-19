import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_STATUS_PATH = "logs/maintenance-latest.json";

function numberOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

export function compactMaintenanceStatus(result, { generatedAt = new Date().toISOString() } = {}) {
  const errors = Array.isArray(result?.errors) ? result.errors : [];

  return {
    generatedAt,
    status: result?.status ?? "unknown",
    window: result?.window ?? null,
    dryRun: Boolean(result?.options?.dryRun),
    espn: {
      events: numberOrZero(result?.espnSync?.events),
      matched: numberOrZero(result?.espnSync?.matched),
      persisted: numberOrZero(result?.espnSync?.persisted),
      failed: numberOrZero(result?.espnSync?.failed),
    },
    snapshot: {
      created: numberOrZero(result?.snapshot?.created),
      skipped: numberOrZero(result?.snapshot?.skipped),
      total: numberOrZero(result?.snapshot?.total),
    },
    errorCount: errors.length,
    errors,
  };
}

export async function writeLatestMaintenanceStatus(
  result,
  { filePath = DEFAULT_STATUS_PATH, generatedAt = new Date().toISOString() } = {},
) {
  const status = compactMaintenanceStatus(result, { generatedAt });
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(status, null, 2)}\n`, "utf8");
  return status;
}

export async function readLatestMaintenanceStatus({ filePath = DEFAULT_STATUS_PATH } = {}) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        status: "unknown",
        message: "尚无维护任务状态",
      };
    }

    return {
      status: "unknown",
      message: "维护任务状态文件不可读",
    };
  }
}
