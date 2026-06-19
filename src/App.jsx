import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  CircleHelp,
  CloudSun,
  Home,
  Info,
  LineChart,
  MapPin,
  Mountain,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";
import { fetchDashboard } from "./services/dashboardApi.js";

const navItems = [
  { label: "总览", icon: Home, target: "overview" },
  { label: "赛程", icon: CalendarDays, target: "schedule" },
  { label: "单场预测", icon: LineChart, target: "featured" },
  { label: "竞彩校准", icon: SlidersHorizontal, target: "market" },
  { label: "球队", icon: UsersRound, action: "teams" },
  { label: "模型说明", icon: CircleHelp, action: "model" },
];

const fallbackFactorWeights = [
  ["战术习惯", 25],
  ["平均年龄/体能", 20],
  ["伤病情况", 18],
  ["联赛数据", 12],
  ["队友羁绊", 10],
  ["天气情况", 6],
  ["比赛时段", 4],
  ["海拔适应", 3],
  ["球速节奏", 2],
];

const fallbackMatches = [
  {
    id: 1,
    time: "06-05 18:00",
    stage: "小组赛 第2轮",
    group: "A组",
    home: "巴西",
    away: "法国",
    homeFlag: "🇧🇷",
    awayFlag: "🇫🇷",
    rank: ["世界排名 2", "世界排名 3"],
    venue: "卢赛尔体育场",
    weather: "多云 27°C",
    score: "2 - 1",
    halfFull: "1-0 / 2-1",
    fullPick: "主胜",
    handicapPick: "法国 +0.5 受负",
    status: "未赛",
    probs: [54, 26, 20],
    xg: [2.05, 0.92],
    risk: "低",
    factors: [
      ["战术", 8],
      ["伤病", -6],
      ["体能", 5],
    ],
  },
  {
    id: 2,
    time: "06-05 21:00",
    stage: "小组赛 第2轮",
    group: "A组",
    home: "墨西哥",
    away: "波兰",
    homeFlag: "🇲🇽",
    awayFlag: "🇵🇱",
    rank: ["世界排名 13", "世界排名 28"],
    venue: "墨西哥城球场",
    weather: "晴 23°C",
    score: "1 - 0",
    halfFull: "0-0 / 1-0",
    fullPick: "主胜",
    handicapPick: "墨西哥 -0.25 受胜",
    status: "未赛",
    probs: [45, 28, 27],
    xg: [1.38, 1.05],
    risk: "中",
    factors: [
      ["海拔", 7],
      ["战术", 3],
      ["伤病", -2],
    ],
  },
  {
    id: 3,
    time: "06-06 00:00",
    stage: "小组赛 第2轮",
    group: "B组",
    home: "西班牙",
    away: "德国",
    homeFlag: "🇪🇸",
    awayFlag: "🇩🇪",
    rank: ["世界排名 5", "世界排名 9"],
    venue: "玫瑰碗球场",
    weather: "晴 31°C",
    score: "1 - 1",
    halfFull: "1-0 / 1-1",
    fullPick: "平局",
    handicapPick: "德国 +0.25 受平",
    status: "未赛",
    probs: [38, 29, 33],
    xg: [1.25, 1.21],
    risk: "中",
    factors: [
      ["战术", 6],
      ["体能", -1],
      ["伤病", -3],
    ],
  },
  {
    id: 4,
    time: "06-06 03:00",
    stage: "小组赛 第2轮",
    group: "B组",
    home: "荷兰",
    away: "日本",
    homeFlag: "🇳🇱",
    awayFlag: "🇯🇵",
    rank: ["世界排名 7", "世界排名 18"],
    venue: "纽约新泽西球场",
    weather: "小雨 22°C",
    score: "2 - 0",
    halfFull: "1-0 / 2-0",
    fullPick: "主胜",
    handicapPick: "荷兰 -0.5 让胜",
    status: "未赛",
    probs: [58, 23, 19],
    xg: [1.82, 0.74],
    risk: "低",
    factors: [
      ["战术", 9],
      ["体能", 6],
      ["伤病", -1],
    ],
  },
  {
    id: 5,
    time: "06-06 18:00",
    stage: "小组赛 第2轮",
    group: "C组",
    home: "阿根廷",
    away: "沙特",
    homeFlag: "🇦🇷",
    awayFlag: "🇸🇦",
    rank: ["世界排名 4", "世界排名 48"],
    venue: "迈阿密硬石球场",
    weather: "晴 29°C",
    score: "3 - 0",
    halfFull: "2-0 / 3-0",
    fullPick: "主胜",
    handicapPick: "阿根廷 -1.25 让胜",
    status: "未赛",
    probs: [72, 17, 11],
    xg: [2.34, 0.61],
    risk: "低",
    factors: [
      ["战术", 10],
      ["体能", 6],
      ["伤病", -1],
    ],
  },
  {
    id: 6,
    time: "06-06 21:00",
    stage: "小组赛 第2轮",
    group: "C组",
    home: "丹麦",
    away: "突尼斯",
    homeFlag: "🇩🇰",
    awayFlag: "🇹🇳",
    rank: ["世界排名 16", "世界排名 42"],
    venue: "堪萨斯球场",
    weather: "多云 25°C",
    score: "1 - 1",
    halfFull: "0-1 / 1-1",
    fullPick: "平局",
    handicapPick: "丹麦 -0.25 受平",
    status: "未赛",
    probs: [30, 30, 40],
    xg: [1.02, 1.08],
    risk: "中",
    factors: [
      ["战术", 2],
      ["天气", 1],
      ["伤病", 1],
    ],
  },
  {
    id: 7,
    time: "06-07 00:00",
    stage: "小组赛 第2轮",
    group: "D组",
    home: "葡萄牙",
    away: "加纳",
    homeFlag: "🇵🇹",
    awayFlag: "🇬🇭",
    rank: ["世界排名 8", "世界排名 61"],
    venue: "洛杉矶球场",
    weather: "晴 26°C",
    score: "2 - 1",
    halfFull: "1-0 / 2-1",
    fullPick: "主胜",
    handicapPick: "葡萄牙 -0.5 让胜",
    status: "未赛",
    probs: [60, 23, 17],
    xg: [1.78, 0.91],
    risk: "低",
    factors: [
      ["体能", 2],
      ["战术", 4],
      ["天气", 1],
    ],
  },
  {
    id: 8,
    time: "06-07 03:00",
    stage: "小组赛 第2轮",
    group: "D组",
    home: "美国",
    away: "捷克",
    homeFlag: "🇺🇸",
    awayFlag: "🇨🇿",
    rank: ["世界排名 15", "世界排名 29"],
    venue: "西雅图流明球场",
    weather: "阴 18°C",
    score: "1 - 0",
    halfFull: "0-0 / 1-0",
    fullPick: "主胜",
    handicapPick: "美国 -0.25 让胜",
    status: "未赛",
    probs: [44, 26, 30],
    xg: [1.16, 0.93],
    risk: "中",
    factors: [
      ["时段", 2],
      ["体能", 2],
      ["天气", 1],
    ],
  },
];

const marketTabs = [
  ["spf", "胜平负"],
  ["handicap", "受让球胜平负"],
  ["halfFull", "半全场"],
];

const fallbackChampions = [
  ["巴西", "🇧🇷", 18.6],
  ["法国", "🇫🇷", 15.4],
  ["英格兰", "🏴", 11.2],
  ["西班牙", "🇪🇸", 9.7],
  ["阿根廷", "🇦🇷", 8.1],
  ["德国", "🇩🇪", 6.5],
  ["葡萄牙", "🇵🇹", 4.3],
  ["荷兰", "🇳🇱", 3.2],
  ["比利时", "🇧🇪", 2.5],
  ["意大利", "🇮🇹", 2.1],
];

const fallbackModelReview = {
  window: "近30天",
  overallHitRate: 63.8,
  profitRate: 12.6,
  averageReturn: 8.3,
  markets: [
    { label: "胜平负", hitRate: 63.8, roi: 9.1 },
    { label: "受让球胜平负", hitRate: 61.2, roi: 8.4 },
    { label: "半全场", hitRate: 59.3, roi: 7.2 },
    { label: "比分误差（±1球）", hitRate: 68.9, roi: null },
  ],
};

const fallbackDashboard = {
  meta: {
    generatedAt: "2025-05-24T15:30:00+08:00",
    dataSources: {
      schedule: "local-fallback",
      teams: "local-fallback",
      venues: "local-fallback",
      weather: "local-fallback",
      prediction: "poisson-score-matrix",
      market: "simulated-market-lines",
    },
    dataQuality: {
      schedule: { label: "赛程", status: "fallback", detail: "使用本地兜底赛程" },
      weather: { label: "天气", status: "fallback", detail: "使用场馆兜底天气" },
      prediction: { label: "预测", status: "computed", detail: "由泊松比分矩阵计算" },
      market: { label: "竞彩", status: "simulated", detail: "真实竞彩赔率暂未接入" },
    },
  },
  matches: fallbackMatches,
  championRanking: fallbackChampions,
  factorWeights: fallbackFactorWeights,
  modelReview: fallbackModelReview,
};

const SCHEDULE_PAGE_SIZE = 8;

function formatDelta(value) {
  return value > 0 ? `+${value}%` : `${value}%`;
}

function getQualityText(status) {
  const textByStatus = {
    real: "真实",
    real_with_fallback: "真实+兜底",
    fallback: "兜底",
    computed: "计算",
    simulated: "模拟",
    optional: "可选",
    disabled: "关闭",
  };

  return textByStatus[status] ?? "未知";
}

function getQualityClass(status) {
  if (status === "real" || status === "real_with_fallback" || status === "computed") return "good";
  if (status === "fallback" || status === "optional") return "warn";
  if (status === "simulated") return "danger";
  return "muted";
}

function formatTimeInZone(value, timeZone = "Asia/Shanghai") {
  if (!value || !String(value).includes("T")) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date).replace("/", "-");
}

function formatDisplayTime(value, match, timeMode = "beijing") {
  const timeZone = timeMode === "local" ? match?.venueMeta?.timezone : "Asia/Shanghai";
  return formatTimeInZone(value, timeZone || "Asia/Shanghai");
}

function getTimeModeLabel(timeMode) {
  return timeMode === "local" ? "当地时间" : "北京时间";
}

function formatUpdatedAt(value) {
  if (!value) return "暂无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextMatchDateKey(matchList) {
  const todayKey = getDateKey(new Date());
  const sortedKeys = [...new Set(matchList.map((match) => getDateKey(match.time)).filter(Boolean))].sort();
  return sortedKeys.find((key) => key >= todayKey) ?? sortedKeys[0] ?? "";
}

function getTomorrowKey() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getDateKey(tomorrow);
}

function normalizeSearchText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function displayGroup(group) {
  if (!group) return "";
  return String(group).endsWith("组") ? group : `${group}组`;
}

function getPredictionSourceLabel(source) {
  const labels = {
    snapshot: "赛前快照",
    computed: "实时计算",
  };

  return labels[source] ?? "预测计算";
}

function getPredictionSourceClass(source) {
  if (source === "snapshot") return "source-snapshot";
  if (source === "computed") return "source-computed";
  return "source-muted";
}

function getStrengthSourceLabel(source) {
  const labels = {
    database: "真实排名",
    baseline: "基线实力",
    default: "中性占位",
  };

  return labels[source] ?? "实力待定";
}

function formatStrengthLabel(strength) {
  if (!strength) return "实力待定";
  return `${getStrengthSourceLabel(strength.source)} ${strength.rank ?? "--"} · 攻${strength.attack ?? "--"} 防${strength.defense ?? "--"}`;
}

function formatScorelineLabel(label) {
  return String(label ?? "").replaceAll(" ", "").replace(" - ", "-");
}

function getTopScorelines(match) {
  const scorelines = match?.predictionBreakdown?.scorelines;
  if (Array.isArray(scorelines) && scorelines.length) {
    return scorelines.slice(0, 3).map((line) => ({
      label: formatScorelineLabel(line.label),
      probability: Number(line.probability ?? 0),
    }));
  }

  return [{
    label: formatScorelineLabel(match?.predictedScore ?? match?.score ?? "--"),
    probability: match?.predictionBreakdown?.markets?.score?.probability ?? null,
  }];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatPct(value) {
  return `${value.toFixed(1)}%`;
}

function riskFromDelta(delta) {
  const abs = Math.abs(delta);
  if (abs >= 12) return "高";
  if (abs >= 5) return "中";
  return "低";
}

function buildMarketRow(label, modelProbability, marketBias = 0, baseOdd = 2.2) {
  const implied = clamp(modelProbability + marketBias, 6, 78);
  const currentOdd = clamp(100 / implied, 1.18, 12);
  const openOdd = currentOdd + (marketBias >= 0 ? -0.12 : 0.12);
  const delta = modelProbability - implied;
  const trend = marketBias >= 0 ? "↗" : "↘";
  const oddMark = marketBias >= 0 ? "↑" : "↓";

  return [
    label,
    openOdd.toFixed(2),
    `${(currentOdd || baseOdd).toFixed(2)}${oddMark}`,
    formatPct(implied),
    formatPct(modelProbability),
    `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`,
    trend,
    riskFromDelta(delta),
  ];
}

function buildMatchAnalysis(match) {
  const [home, draw, away] = match.probs;
  const factorTotal = match.factors.reduce((sum, [, delta]) => sum + delta, 0);
  const handicapBase = match.handicapPick.includes("受") ? 4 : -4;
  const leadingHalf = match.halfFull.split("/")[0].trim();

  const markets = {
    spf: [
      buildMarketRow("主胜", home, factorTotal > 8 ? 5 : -2),
      buildMarketRow("平", draw, draw > 28 ? 3 : -1),
      buildMarketRow("客胜", away, match.risk === "中" ? 7 : 2),
    ],
    handicap: [
      buildMarketRow("让胜", clamp(home - 12, 8, 68), handicapBase),
      buildMarketRow("让平", clamp(draw, 12, 42), -2),
      buildMarketRow("让负", clamp(away + 15, 16, 70), -handicapBase),
    ],
    halfFull: [
      ["胜胜", formatPct(clamp(home - 24, 8, 48)), formatPct(clamp(home - 27, 7, 46)), "-1.6%", "中"],
      ["平胜", formatPct(clamp(home / 4, 6, 18)), formatPct(clamp(home / 4 - 1, 5, 16)), "-1.0%", "低"],
      ["平平", formatPct(clamp(draw / 3, 6, 16)), formatPct(clamp(draw / 3 - 1, 5, 14)), "-0.9%", "低"],
      ["负胜", formatPct(clamp(home / 5, 5, 18)), formatPct(clamp(home / 5 + (match.risk === "中" ? 2 : 0), 5, 20)), match.risk === "中" ? "+1.8%" : "+0.8%", "中"],
      ["胜负", formatPct(clamp(away / 3, 5, 18)), formatPct(clamp(away / 3 - 0.5, 4, 16)), "-0.5%", "低"],
      ["负负", formatPct(clamp(away + 8, 12, 50)), formatPct(clamp(away + 12, 15, 55)), "+3.2%", match.risk],
    ],
  };

  const hasAltitude = match.venue.includes("墨西哥");
  const hasLateKickoff = match.time.includes("00:00") || match.time.includes("03:00");
  const sceneNotes = [
    {
      title: hasLateKickoff ? "深夜开球 / 体能节奏" : "下午开球 / 转播时段",
      tone: hasLateKickoff ? "warn" : "good",
      value: hasLateKickoff ? "-1.2%" : "+2.8%",
      badge: hasLateKickoff ? "需观察" : "利主队",
      copy: `${match.time} 开球会影响球队进入比赛节奏；当前模型将比赛时段与过往同类比赛表现一起修正。`,
      icon: CloudSun,
    },
    {
      title: hasAltitude ? "墨西哥赛区海拔" : "场地与天气适应",
      tone: hasAltitude ? "warn" : "good",
      value: hasAltitude ? "-1.5%" : "+1.4%",
      badge: hasAltitude ? "中性" : "利稳定",
      copy: `${match.venue}，${match.weather}。场地、天气和旅行适应会影响跑动效率与下半场强度。`,
      icon: hasAltitude ? Mountain : CloudSun,
    },
    {
      title: "战术与体能权重",
      tone: factorTotal >= 0 ? "good" : "warn",
      value: `${factorTotal >= 0 ? "+" : ""}${(factorTotal / 4).toFixed(1)}%`,
      badge: factorTotal >= 0 ? "利主队" : "需谨慎",
      copy: `${match.home} vs ${match.away} 的关键因子为 ${match.factors.map(([name, delta]) => `${name}${formatDelta(delta)}`).join("、")}。`,
      icon: Activity,
    },
  ];

  const marketAwayHeat = clamp(away + (match.risk === "中" ? 36 : 24), 38, 72);
  const heatRows = [
    ["客胜", `${marketAwayHeat}%`, formatPct(away), `${(marketAwayHeat - away).toFixed(1)}%`, riskFromDelta(away - marketAwayHeat)],
    ["让负", `${clamp(away + 29, 42, 68)}%`, markets.handicap[2][4], markets.handicap[2][5], markets.handicap[2][7]],
    [leadingHalf.includes("1-0") ? "胜胜" : "半全场", `${clamp(home + 12, 44, 70)}%`, markets.halfFull[0][2], "+13.5%", match.risk],
  ];

  return { markets, sceneNotes, heatRows };
}

export function App() {
  const [dashboardData, setDashboardData] = useState(fallbackDashboard);
  const [dataStatus, setDataStatus] = useState("loading");
  const [selectedId, setSelectedId] = useState(fallbackMatches[0].id);
  const [activeMarket, setActiveMarket] = useState("spf");
  const [activeNav, setActiveNav] = useState("overview");
  const [drawer, setDrawer] = useState(null);
  const [notice, setNotice] = useState("");
  const [scheduleFilters, setScheduleFilters] = useState({
    dateMode: "next",
    group: "all",
    quality: "all",
    query: "",
    stage: "all",
    status: "all",
  });
  const [expandedMatchId, setExpandedMatchId] = useState(null);
  const [schedulePage, setSchedulePage] = useState(1);
  const [timeMode, setTimeMode] = useState("beijing");
  const [reviewMode, setReviewMode] = useState("auto");
  const currentMatches = dashboardData.matches?.length ? dashboardData.matches : fallbackMatches;
  const currentFactorWeights = dashboardData.factorWeights?.length ? dashboardData.factorWeights : fallbackFactorWeights;
  const modelReview = dashboardData.modelReview ?? fallbackModelReview;
  const officialReview = modelReview.official ?? modelReview;
  const backtestReview = modelReview.backtest ?? modelReview;
  const activeReviewMode = reviewMode === "auto"
    ? (!officialReview.sampleSize && backtestReview.sampleSize ? "backtest" : "official")
    : reviewMode;
  const activeReview = activeReviewMode === "backtest" ? backtestReview : officialReview;
  const activeReviewLabel = activeReviewMode === "backtest" ? "模型回测" : "正式复盘";
  const selected = useMemo(
    () => currentMatches.find((match) => match.id === selectedId) ?? currentMatches[0],
    [currentMatches, selectedId],
  );
  const modelReviewSummary = activeReviewMode === "backtest"
    ? `当前模型回测 ${activeReview.sampleSize ?? 0} 场已赛：胜平负命中 ${activeReview.overallHitRate}%，比分命中 ${activeReview.scoreHitRate ?? 0}%。`
    : activeReview.sampleSize
      ? `正式样本 ${activeReview.sampleSize} 场：胜平负命中 ${activeReview.overallHitRate}%，比分命中 ${activeReview.scoreHitRate ?? 0}%。${activeReview.excludedSampleSize ? `另有 ${activeReview.excludedSampleSize} 场无赛前快照未纳入。` : ""}`
      : activeReview.excludedSampleSize
        ? `暂无正式复盘样本；${activeReview.excludedSampleSize} 场已赛因无赛前快照未纳入统计，可查看模型回测。`
        : "暂无正式复盘样本，比赛结束且存在赛前快照后自动纳入。";
  const selectedAnalysis = useMemo(() => buildMatchAnalysis(selected), [selected]);
  const activeMarketLabel = marketTabs.find(([key]) => key === activeMarket)?.[1] ?? "胜平负";
  const predictedHalf = selected.halfFull.split("/")[0].trim();
  const selectedIsFinished = selected.status === "已赛";
  const scheduleSource = dashboardData.meta?.dataSources?.schedule;
  const weatherSource = dashboardData.meta?.dataSources?.weather;
  const dataQuality = dashboardData.meta?.dataQuality ?? fallbackDashboard.meta.dataQuality;
  const qualityItems = [
    dataQuality.schedule,
    dataQuality.weather,
    dataQuality.prediction,
    dataQuality.market,
  ].filter(Boolean);
  const dataSourceText = dataStatus === "loading"
    ? "加载中"
    : dataStatus === "error"
      ? "本地兜底"
      : scheduleSource === "database-postgresql"
        ? `PostgreSQL 数据库 + ${weatherSource === "open-meteo-with-fallback" ? "Open-Meteo" : "天气兜底"}`
        : "公开 API + 本地兜底";
  const lastUpdated = formatUpdatedAt(dashboardData.meta?.generatedAt);
  const nextMatchDateKey = useMemo(() => getNextMatchDateKey(currentMatches), [currentMatches]);
  const stageOptions = useMemo(() => ["all", ...new Set(currentMatches.map((match) => match.stage).filter(Boolean))], [currentMatches]);
  const groupOptions = useMemo(() => ["all", ...new Set(currentMatches.map((match) => match.group).filter(Boolean))], [currentMatches]);
  const filteredMatches = useMemo(() => {
    const todayKey = getDateKey(new Date());
    const tomorrowKey = getTomorrowKey();
    const query = normalizeSearchText(scheduleFilters.query);

    return currentMatches.filter((match) => {
      const matchDateKey = getDateKey(match.time);
      const dateMatched = scheduleFilters.dateMode === "all"
        || (scheduleFilters.dateMode === "today" && matchDateKey === todayKey)
        || (scheduleFilters.dateMode === "tomorrow" && matchDateKey === tomorrowKey)
        || (scheduleFilters.dateMode === "next" && matchDateKey === nextMatchDateKey);
      const stageMatched = scheduleFilters.stage === "all" || match.stage === scheduleFilters.stage;
      const groupMatched = scheduleFilters.group === "all" || match.group === scheduleFilters.group;
      const statusMatched = scheduleFilters.status === "all" || match.status === scheduleFilters.status;
      const hasPlaceholderStrength = [match.predictionBreakdown?.strength?.home?.source, match.predictionBreakdown?.strength?.away?.source].includes("default");
      const officialReviewMatched = match.predictionSource === "snapshot" && match.predictionReview?.isFinished;
      const qualityMatched = scheduleFilters.quality === "all"
        || (scheduleFilters.quality === "snapshot" && match.predictionSource === "snapshot")
        || (scheduleFilters.quality === "computed" && match.predictionSource === "computed")
        || (scheduleFilters.quality === "placeholder" && hasPlaceholderStrength)
        || (scheduleFilters.quality === "official_review" && officialReviewMatched);
      const searchMatched = !query || [match.home, match.away, match.homeFlag, match.awayFlag, match.venue]
        .some((value) => normalizeSearchText(value).includes(query));

      return dateMatched && stageMatched && groupMatched && statusMatched && qualityMatched && searchMatched;
    });
  }, [currentMatches, nextMatchDateKey, scheduleFilters]);
  const totalSchedulePages = Math.max(1, Math.ceil(filteredMatches.length / SCHEDULE_PAGE_SIZE));
  const safeSchedulePage = Math.min(schedulePage, totalSchedulePages);
  const pagedMatches = filteredMatches.slice((safeSchedulePage - 1) * SCHEDULE_PAGE_SIZE, safeSchedulePage * SCHEDULE_PAGE_SIZE);
  const pageStart = filteredMatches.length ? (safeSchedulePage - 1) * SCHEDULE_PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(safeSchedulePage * SCHEDULE_PAGE_SIZE, filteredMatches.length);
  const scheduleTitle = scheduleFilters.dateMode === "next"
    ? `下一比赛日 ${nextMatchDateKey || ""}`
    : scheduleFilters.dateMode === "today"
      ? "今日"
      : scheduleFilters.dateMode === "tomorrow"
        ? "明日"
        : "全部赛程";
  const selectedLocalTime = formatDisplayTime(selected.time, selected, "local");
  const selectedBeijingTime = formatDisplayTime(selected.time, selected, "beijing");
  const selectedScorelines = getTopScorelines(selected);

  async function loadDashboard() {
    setDataStatus("loading");
    try {
      const nextDashboard = await fetchDashboard();
      setDashboardData(nextDashboard);
      setDataStatus("live");
      setSelectedId((currentId) => {
        const exists = nextDashboard.matches?.some((match) => match.id === currentId);
        return exists ? currentId : nextDashboard.matches?.[0]?.id ?? fallbackMatches[0].id;
      });
    } catch {
      setDashboardData(fallbackDashboard);
      setDataStatus("error");
      setSelectedId((currentId) => fallbackMatches.some((match) => match.id === currentId) ? currentId : fallbackMatches[0].id);
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      setDataStatus("loading");
      try {
        const nextDashboard = await fetchDashboard({ signal: controller.signal });
        setDashboardData(nextDashboard);
        setDataStatus("live");
        setSelectedId((currentId) => {
          const exists = nextDashboard.matches?.some((match) => match.id === currentId);
          return exists ? currentId : nextDashboard.matches?.[0]?.id ?? fallbackMatches[0].id;
        });
      } catch (error) {
        if (error.name === "AbortError") return;
        setDashboardData(fallbackDashboard);
        setDataStatus("error");
      }
    }

    run();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const sections = ["overview", "featured", "market", "schedule"];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) {
          setActiveNav(visible.target.id);
        }
      },
      { rootMargin: "-18% 0px -62% 0px", threshold: [0.12, 0.35, 0.6] },
    );

    sections.forEach((id) => {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function scrollToSection(target) {
    const node = document.getElementById(target);
    if (!node) return;
    setActiveNav(target);
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleNav(item) {
    if (item.target) {
      scrollToSection(item.target);
      return;
    }

    if (item.action === "model") {
      setDrawer("model");
      setActiveNav("model");
      return;
    }

    setNotice("球队详情需要接入阵容与球员数据后开放");
  }

  function updateScheduleFilter(key, value) {
    setScheduleFilters((current) => ({ ...current, [key]: value }));
    setExpandedMatchId(null);
    setSchedulePage(1);
  }

  function handleMatchPick(matchId) {
    setSelectedId(matchId);
    setExpandedMatchId((current) => current === matchId ? null : matchId);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">🏆</div>
          <strong>世界杯预测控制台</strong>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => {
            const { label, icon: Icon, target, action } = item;
            const isActive = activeNav === target || activeNav === action;
            return (
            <button className={isActive ? "active" : ""} key={label} onClick={() => handleNav(item)}>
              <Icon size={17} />
              <span>{label}</span>
            </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => setDrawer("settings")}><Settings size={16} /> 设置</button>
          <span>v2.3.5</span>
        </div>
      </aside>

      <main className="dashboard" id="overview">
        <header className="topbar">
          <div className="titlebar">
            <h1>世界杯预测控制台</h1>
            <span>数据更新时间：{lastUpdated}</span>
            <b>数据来源：{dataSourceText}</b>
            <b>{dataStatus === "error" ? "兜底" : dataStatus === "loading" ? "同步中" : "正常"}</b>
          </div>
          <div className="toolbar">
            <button className="select-btn" onClick={() => setTimeMode((mode) => mode === "beijing" ? "local" : "beijing")} title="切换赛程显示时区">
              {getTimeModeLabel(timeMode)}
            </button>
            <button className="icon-btn" onClick={loadDashboard} title="刷新数据"><RefreshCw size={17} /></button>
          </div>
        </header>

        <div className="quality-strip" aria-label="数据透明度">
          <span>数据透明度</span>
          {qualityItems.map((item) => (
            <button className={`quality-chip ${getQualityClass(item.status)}`} key={item.label} title={item.detail}>
              <b>{item.label}</b>
              <em>{getQualityText(item.status)}</em>
            </button>
          ))}
        </div>

        <section className="layout-grid">
          <section className="featured panel" id="featured">
            <PanelTitle title="焦点战预测" />
            <div className="match-line">
              <span>{formatDisplayTime(selected.time, selected, timeMode)} {getTimeModeLabel(timeMode)}</span>
              <span>{selected.stage} · {selected.group}</span>
              <span><MapPin size={13} /> {selected.venue}，{selected.weather}</span>
            </div>
            <div className="time-compare">
              <span>北京时间 {selectedBeijingTime}</span>
              <span>当地时间 {selectedLocalTime}</span>
            </div>
            <div className="prediction-meta">
              <span className={`source-pill ${getPredictionSourceClass(selected.predictionSource)}`}>{getPredictionSourceLabel(selected.predictionSource)}</span>
              <span>模型 {selected.modelVersion ?? "rules"}</span>
              <span>{selected.predictionBreakdown?.strength?.home?.source === "baseline" || selected.predictionBreakdown?.strength?.away?.source === "baseline" ? "含基线实力" : "实力数据"}</span>
            </div>

            <div className="match-hero">
              <TeamBlock flag={selected.homeFlag} name={selected.home} rank={selected.rank[0]} />
              <div className="score-card">
                <span>{selectedIsFinished ? "赛果" : "预测比分"}</span>
                <strong>{selected.score}</strong>
                <small>{selectedIsFinished ? `预测比分 ${selected.predictedScore ?? selected.score}` : `预测半场 ${predictedHalf}`}</small>
                <em className={`risk risk-${selected.risk}`}>爆冷风险：{selected.risk}</em>
              </div>
              <TeamBlock flag={selected.awayFlag} name={selected.away} rank={selected.rank[1]} align="right" />
            </div>

            <ProbabilityBar probs={selected.probs} labels={["主胜", "平局", "客胜"]} />

            <div className="mini-stats">
              <div>
                <span>最可能比分 TOP3</span>
                <div className="scorelines">
                  {selectedScorelines.map((line) => (
                    <b key={`${selected.id}-${line.label}`}>
                      {line.label} <em>{line.probability == null ? "--" : `${line.probability}%`}</em>
                    </b>
                  ))}
                </div>
              </div>
              <div>
                <span>xG 预测进球</span>
                <strong>{selected.xg[0]} <small>-</small> {selected.xg[1]}</strong>
              </div>
            </div>
          </section>

          <section className="market panel" id="market">
            <div className="section-title">
              <div>
                <span>竞彩校准</span>
                <small>{selected.home} vs {selected.away} · 单场联动</small>
              </div>
              <div className="segmented">
                {marketTabs.map(([key, label]) => (
                  <button className={activeMarket === key ? "active" : ""} key={key} onClick={() => setActiveMarket(key)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="market-focus">
              <h3>{activeMarketLabel} <small>{activeMarket === "handicap" ? selected.handicapPick : "当前比赛市场"}</small></h3>
              {activeMarket === "halfFull"
                ? <HalfFullTable rows={selectedAnalysis.markets.halfFull} large />
                : <MarketTable rows={selectedAnalysis.markets[activeMarket]} compact />}
            </div>
            <div className="market-note">
              <span>点击赛程会同步更新本场赔率、模型概率和差值。</span>
              <b>{selected.risk}风险</b>
            </div>
          </section>

          <section className="scene panel">
            <PanelTitle title="场景修正" />
            <div className="scene-list">
              {selectedAnalysis.sceneNotes.map(({ title, tone, value, copy, icon: Icon, badge }) => (
                <article className="scene-note" key={title}>
                  <div className="scene-note-head">
                    <Icon size={19} />
                    <strong>{title}</strong>
                    <em className={tone}>{badge}</em>
                  </div>
                  <p>{copy}</p>
                  <span className={tone}>影响权重 {value}</span>
                </article>
              ))}
            </div>
            <div className="heat-risk-table">
              <h3>盘口热度风险 <small>与模型分歧较大需关注</small></h3>
              <div className="heat-head"><span>选项</span><span>市场热度</span><span>模型概率</span><span>差值</span><span>风险</span></div>
              {selectedAnalysis.heatRows.map((row) => (
                <div className="heat-row" key={row[0]}>
                  {row.map((cell, index) => <span className={index === 3 ? "negative" : ""} key={index}>{cell}</span>)}
                </div>
              ))}
            </div>
          </section>

          <section className="schedule panel" id="schedule">
            <PanelTitle title="赛程与预测" subtitle={`${scheduleTitle} · ${filteredMatches.length} 场`} />
            <div className="schedule-controls">
              <select value={scheduleFilters.dateMode} onChange={(event) => updateScheduleFilter("dateMode", event.target.value)}>
                <option value="next">下一比赛日</option>
                <option value="today">今日</option>
                <option value="tomorrow">明日</option>
                <option value="all">全部日期</option>
              </select>
              <select value={scheduleFilters.stage} onChange={(event) => updateScheduleFilter("stage", event.target.value)}>
                {stageOptions.map((stage) => <option key={stage} value={stage}>{stage === "all" ? "全部阶段" : stage}</option>)}
              </select>
              <select value={scheduleFilters.group} onChange={(event) => updateScheduleFilter("group", event.target.value)}>
                {groupOptions.map((group) => <option key={group} value={group}>{group === "all" ? "全部小组" : displayGroup(group)}</option>)}
              </select>
              <select value={scheduleFilters.status} onChange={(event) => updateScheduleFilter("status", event.target.value)}>
                <option value="all">全部状态</option>
                <option value="未赛">未赛</option>
                <option value="进行中">进行中</option>
                <option value="已赛">已赛</option>
              </select>
              <select value={scheduleFilters.quality} onChange={(event) => updateScheduleFilter("quality", event.target.value)}>
                <option value="all">全部标签</option>
                <option value="snapshot">有快照</option>
                <option value="computed">实时计算</option>
                <option value="placeholder">占位/中性</option>
                <option value="official_review">已纳入复盘</option>
              </select>
              <input
                aria-label="搜索球队"
                placeholder="搜索球队 / 场馆"
                value={scheduleFilters.query}
                onChange={(event) => updateScheduleFilter("query", event.target.value)}
              />
            </div>
            <div className="schedule-table">
              <div className="table-head">
                <span>时间</span><span>阶段/组别</span><span>对阵</span><span>比分/预测</span><span>胜平负倾向</span><span>关键因子</span><span>状态</span>
              </div>
              {filteredMatches.length ? pagedMatches.map((match) => {
                const primaryFactor = match.factors[0];
                const isExpanded = expandedMatchId === match.id;
                return (
                  <div className={match.id === selected.id ? "match-row-wrap selected" : "match-row-wrap"} key={match.id}>
                    <button className="match-row" onClick={() => handleMatchPick(match.id)}>
                      <span className="time-cell">{formatDisplayTime(match.time, match, timeMode)}</span>
                      <span>{match.stage}{match.group ? ` · ${displayGroup(match.group)}` : ""}</span>
                      <span className="teams-cell"><b>{match.homeFlag} {match.home}</b><em>vs</em><b>{match.awayFlag} {match.away}</b></span>
                      <span>{match.score}</span>
                      <span className="pick">{match.fullPick}（{match.probs[0]}%）</span>
                      <span className="factor-chips">
                        {primaryFactor ? <i className={primaryFactor[1] >= 0 ? "positive" : "negative"}>{primaryFactor[0]} {formatDelta(primaryFactor[1])}</i> : <i>待定</i>}
                      </span>
                      <span className="status-cell">
                        <b>{match.status}</b>
                        <i className={`source-pill ${getPredictionSourceClass(match.predictionSource)}`}>{getPredictionSourceLabel(match.predictionSource)}</i>
                      </span>
                    </button>
                    {isExpanded ? (
                      <div className="match-detail-row">
                        <span><b>半场/全场</b>{match.halfFull}</span>
                        {match.resultScore ? <span><b>预测比分</b>{match.predictedScore}</span> : null}
                        <span><b>预测来源</b>{getPredictionSourceLabel(match.predictionSource)}</span>
                        <span><b>模型版本</b>{match.modelVersion ?? "--"}</span>
                        <span><b>{match.home}实力</b>{formatStrengthLabel(match.predictionBreakdown?.strength?.home)}</span>
                        <span><b>{match.away}实力</b>{formatStrengthLabel(match.predictionBreakdown?.strength?.away)}</span>
                        <span><b>受让球</b>{match.handicapPick}</span>
                        <span><b>场馆</b>{match.venue}</span>
                        <span><b>时间</b>北京 {formatDisplayTime(match.time, match, "beijing")} / 当地 {formatDisplayTime(match.time, match, "local")}</span>
                        <span><b>天气</b>{match.weather}</span>
                        {match.predictionReview?.isFinished ? (
                          <span>
                            <b>复盘</b>
                            胜平负{match.predictionReview.fullTimeHit ? "命中" : "未中"} · 比分{match.predictionReview.scoreHit ? "命中" : "未中"} · 净胜球误差 {match.predictionReview.goalDiffError}
                          </span>
                        ) : null}
                        <span className="factor-chips detail">
                          {match.factors.map(([name, delta]) => (
                            <i className={delta >= 0 ? "positive" : "negative"} key={`${match.id}-${name}`}>{name} {formatDelta(delta)}</i>
                          ))}
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              }) : (
                <div className="empty-schedule">当前筛选条件下暂无比赛</div>
              )}
            </div>
            <div className="schedule-pagination">
              <span>显示 {pageStart}-{pageEnd} / 共 {filteredMatches.length} 场</span>
              <div>
                <button disabled={safeSchedulePage <= 1} onClick={() => setSchedulePage((page) => Math.max(1, page - 1))}>上一页</button>
                <b>{safeSchedulePage} / {totalSchedulePages}</b>
                <button disabled={safeSchedulePage >= totalSchedulePages} onClick={() => setSchedulePage((page) => Math.min(totalSchedulePages, page + 1))}>下一页</button>
              </div>
            </div>
            <div className="legend">
              <span>因子图例：</span><b>战术</b><b>平均年龄/体能</b><b>伤病</b><b>联赛数据</b><b>队友羁绊</b><b>天气情况</b><b>比赛时段</b><b>海拔适应</b><b>球速节奏</b>
            </div>
          </section>

          <section className="review panel bottom-panel">
            <div className="review-head">
              <PanelTitle title="模型复盘" subtitle={`${activeReviewLabel} · ${activeReview.sampleSize ?? 0} 场`} hideHelp />
              <div className="review-tabs">
                <button className={activeReviewMode === "official" ? "active" : ""} onClick={() => setReviewMode("official")}>正式复盘</button>
                <button className={activeReviewMode === "backtest" ? "active" : ""} onClick={() => setReviewMode("backtest")}>模型回测</button>
              </div>
              <CircleHelp className="review-help" size={15} />
            </div>
            <div className="review-grid">
              <div className="review-main">
                <div className="donut-row">
                  <Metric label={activeReviewMode === "backtest" ? "回测样本" : "正式样本"} value={`${activeReview.sampleSize ?? 0} 场`} />
                  <Metric label="胜平负命中" value={`${activeReview.overallHitRate}%`} />
                  <Metric label="比分命中" value={`${activeReview.scoreHitRate ?? 0}%`} />
                  <Metric label={activeReviewMode === "backtest" ? "总已赛" : "未纳入已赛"} value={`${activeReviewMode === "backtest" ? activeReview.totalFinishedSize ?? activeReview.sampleSize ?? 0 : activeReview.excludedSampleSize ?? 0} 场`} />
                </div>
                <div className="review-summary">
                  <b>当前结论</b>
                  <span>{modelReviewSummary}</span>
                </div>
              </div>
              <div className="hit-list">
                {activeReview.markets.map((item, index) => (
                  <HitRow
                    color={index === 1 ? "amber" : item.roi == null ? "muted" : "green"}
                    hit={item.unit ? `${item.hitRate}${item.unit}` : `${item.hitRate}%`}
                    key={item.label}
                    label={item.label}
                    roi={item.roi == null ? "--" : `${item.roi}球`}
                    width={item.unit ? 62 : item.hitRate}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="weights panel bottom-panel">
            <PanelTitle title="专家因子权重" subtitle="模型总权重分布" />
            <div className="weight-list">
              {currentFactorWeights.map(([name, weight]) => (
                <div className="weight-row" key={name}><span>{name}</span><div><i style={{ width: `${weight * 3.4}%` }} /></div><b>{weight}%</b></div>
              ))}
            </div>
          </section>
        </section>

        <footer className="footer">
          <span>数据仅供分析复盘，不构成任何投注建议。</span>
          <span>数据来源：{dataSourceText}</span>
          <span><Info size={14} /> 免责声明</span>
          <span>最后更新：{lastUpdated}</span>
          <span>系统{dataStatus === "error" ? "使用兜底数据" : "正常"}</span>
        </footer>
        {notice ? <div className="toast">{notice}</div> : null}
      </main>
      {drawer ? <InfoDrawer type={drawer} onClose={() => setDrawer(null)} /> : null}
    </div>
  );
}

function InfoDrawer({ type, onClose }) {
  const isModel = type === "model";

  return (
    <aside className="info-drawer" role="dialog" aria-modal="true">
      <div className="drawer-head">
        <div>
          <span>{isModel ? "模型说明" : "设置"}</span>
          <small>{isModel ? "预测逻辑与因子解释" : "当前为 MVP 配置预览"}</small>
        </div>
        <button onClick={onClose}>关闭</button>
      </div>

      {isModel ? (
        <div className="drawer-body">
          <section>
            <h3>Elo + 泊松</h3>
            <p>先用球队强度估算进攻、防守差异，再通过比分矩阵汇总胜平负和最可能比分。</p>
          </section>
          <section>
            <h3>竞彩校准</h3>
            <p>将当前赔率换算为隐含概率，与模型概率比较，差值越大越需要关注市场热度和风险。</p>
          </section>
          <section>
            <h3>专家因子</h3>
            <p>战术习惯、平均年龄/体能、伤病情况权重最高，其次考虑联赛数据、队友羁绊、天气、时段和海拔。</p>
          </section>
          <section>
            <h3>复盘原则</h3>
            <p>每场比赛结束后记录预测、真实比分、玩法命中和误差，用近 30 天表现校验模型稳定性。</p>
          </section>
        </div>
      ) : (
        <div className="drawer-body">
          <section>
            <h3>刷新策略</h3>
            <p>当前展示模拟更新时间。后续可配置自动刷新频率和竞彩数据更新时间提醒。</p>
          </section>
          <section>
            <h3>模型版本</h3>
            <p>MVP 使用默认权重。后续可切换模型版本，并保存每个版本的复盘结果。</p>
          </section>
          <section>
            <h3>专家权重</h3>
            <p>后续可开放拖拽调整战术、体能、伤病等权重，并即时重算单场预测。</p>
          </section>
        </div>
      )}
    </aside>
  );
}

function PanelTitle({ title, subtitle, hideHelp = false }) {
  return (
    <div className="section-title compact-title">
      <div>
        <span>{title}</span>
        {subtitle ? <small>{subtitle}</small> : null}
      </div>
      {hideHelp ? null : <CircleHelp size={15} />}
    </div>
  );
}

function TeamBlock({ flag, name, rank, align }) {
  return (
    <div className={`team-block ${align === "right" ? "right" : ""}`}>
      <span className="flag">{flag}</span>
      <div><strong>{name}</strong><small>{rank}</small></div>
    </div>
  );
}

function ProbabilityBar({ probs, labels }) {
  return (
    <div className="prob-wrap">
      <div className="prob-labels">{labels.map((label, index) => <span key={label}>{label} {probs[index]}%</span>)}</div>
      <div className="prob-bar"><i className="home" style={{ width: `${probs[0]}%` }} /><i className="draw" style={{ width: `${probs[1]}%` }} /><i className="away" style={{ width: `${probs[2]}%` }} /></div>
    </div>
  );
}

function MarketTable({ rows, compact }) {
  return (
    <div className={compact ? "market-table compact-market" : "market-table"}>
      <div className="market-head"><span>选项</span><span>开盘赔率</span><span>当前赔率</span><span>隐含概率</span><span>模型概率</span><span>差值</span><span>趋势</span><span>热度/风险</span></div>
      {rows.map((row) => (
        <div className="market-row" key={row[0]}>
          <b>{row[0]}</b><span>{row[1]}</span><span className={row[2].includes("↑") ? "odd-up" : "odd-down"}>{row[2]}</span><span>{row[3]}</span><span>{row[4]}</span><span className={row[5].startsWith("+") ? "negative" : "positive"}>{row[5]}</span><span className={row[6] === "↗" ? "negative" : "positive"}>{row[6]}</span><em className={`risk-badge risk-${row[7] ?? "中"}`}>{row[7] ?? "中"}</em>
        </div>
      ))}
    </div>
  );
}

function HalfFullTable({ rows }) {
  return (
    <div className="half-table">
      <div className="half-head"><span>选项</span><span>隐含概率</span><span>模型概率</span><span>差值</span><span>热度/风险</span></div>
      {rows.map((row) => (
        <div className="half-row" key={row[0]}>{row.map((cell, index) => <span className={index === 3 && String(cell).startsWith("+") ? "negative" : ""} key={index}>{cell}</span>)}</div>
      ))}
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function Sparkline({ label = "0%" }) {
  return (
    <svg viewBox="0 0 360 110" role="img" aria-label="模型准确率趋势">
      <path d="M0 84 C28 68 38 74 62 60 S105 76 126 52 S166 48 188 54 S230 42 250 51 S295 58 316 43 S342 37 360 30" />
      <polyline points="0,84 28,68 62,60 90,72 126,52 156,57 188,54 222,48 250,51 286,56 316,43 360,30" />
      <text x="314" y="25">{label}</text>
    </svg>
  );
}

function HitRow({ label, hit, roi, color, width = 60 }) {
  return (
    <div className="hit-row">
      <span>{label}</span><b>{hit}</b><em>{roi}</em><i className={color} style={{ "--bar-width": `${Math.max(8, Math.min(100, width))}%` }} />
    </div>
  );
}
