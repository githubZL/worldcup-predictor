import { MODEL_VERSION } from "./predictionService.js";

function statusForSchedule(source) {
  return source === "database-postgresql" ? "real" : "fallback";
}

function statusForWeather(source) {
  if (source === "open-meteo-with-gaps") return "partial";
  if (source === "weather-disabled") return "missing";
  return "missing";
}

function statusForSports(source) {
  return source === "disabled" ? "disabled" : "optional";
}

export function buildDashboardMeta({
  generatedAt = new Date().toISOString(),
  scheduleSource,
  weatherSource,
  sportsSource,
}) {
  const scheduleStatus = statusForSchedule(scheduleSource);
  const teamsSource = scheduleSource === "database-postgresql" ? "database-postgresql" : "local-team-fallback";
  const venuesSource = scheduleSource === "database-postgresql" ? "database-postgresql" : "local-venue-table";

  return {
    generatedAt,
    dataSources: {
      schedule: scheduleSource,
      teams: teamsSource,
      venues: venuesSource,
      weather: weatherSource,
      sports: sportsSource,
      prediction: "poisson-score-matrix",
      market: "simulated-market-lines",
    },
    dataQuality: {
      schedule: {
        label: "赛程",
        status: scheduleStatus,
        source: scheduleSource,
        detail: scheduleStatus === "real" ? "来自 PostgreSQL 同步数据" : "使用本地兜底赛程",
      },
      teams: {
        label: "球队",
        status: scheduleStatus,
        source: teamsSource,
        detail: scheduleStatus === "real" ? "来自 PostgreSQL 球队表" : "使用本地球队表",
      },
      venues: {
        label: "场馆",
        status: scheduleStatus,
        source: venuesSource,
        detail: scheduleStatus === "real" ? "来自 PostgreSQL 场馆表" : "使用本地场馆表",
      },
      weather: {
        label: "天气",
        status: statusForWeather(weatherSource),
        source: weatherSource,
        detail: weatherSource === "open-meteo-with-gaps" ? "来自 Open-Meteo；缺失时显示待接入，不再使用场馆兜底天气" : "天气接口已关闭或暂未接入",
      },
      sports: {
        label: "球队扩展",
        status: statusForSports(sportsSource),
        source: sportsSource,
        detail: sportsSource === "disabled" ? "外部球队扩展接口已关闭" : "可选接入 TheSportsDB",
      },
      prediction: {
        label: "预测",
        status: "computed",
        source: "poisson-score-matrix",
        detail: "由球队强度与 xG 估算生成泊松比分矩阵，再汇总胜平负与最可能比分",
      },
      market: {
        label: "竞彩",
        status: "simulated",
        source: "simulated-market-lines",
        detail: "真实竞彩赔率暂未接入，当前为页面演示与模型结构占位",
      },
    },
    modelStatus: {
      prediction: {
        engine: MODEL_VERSION,
        label: "泊松比分矩阵模型",
        notice: "当前模型已按比分矩阵汇总市场，参数仍需后续用真实历史数据校准",
      },
      market: {
        engine: "market-placeholder-v0.1",
        label: "竞彩校准占位",
        notice: "竞彩赔率暂未接入真实数据",
      },
      review: {
        engine: "sample-review-v0.1",
        label: "复盘样例",
        notice: "命中率与盈利率仍是样例指标，待历史赛果回填后自动计算",
      },
    },
  };
}
