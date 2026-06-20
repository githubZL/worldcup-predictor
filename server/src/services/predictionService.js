import { resolveTeamStrength } from "./teamStrength.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export const MODEL_VERSION = "poisson-v0.8";
const SCORE_MATRIX_MAX_GOALS = 6;

function resultFromScore(home, away) {
  if (home > away) return "主胜";
  if (home < away) return "客胜";
  return "平局";
}

function parseScoreLabel(label) {
  const [home, away] = String(label).split("-").map((part) => Number.parseInt(part.trim(), 10));
  return {
    home: Number.isFinite(home) ? home : 0,
    away: Number.isFinite(away) ? away : 0,
  };
}

function poissonProbability(lambda, goals) {
  let factorial = 1;
  for (let value = 2; value <= goals; value += 1) {
    factorial *= value;
  }

  return (Math.exp(-lambda) * lambda ** goals) / factorial;
}

function buildScoreMatrix(homeGoals, awayGoals, maxGoals = SCORE_MATRIX_MAX_GOALS) {
  const rawRows = [];
  let rawTotal = 0;

  for (let home = 0; home <= maxGoals; home += 1) {
    for (let away = 0; away <= maxGoals; away += 1) {
      const rawProbability = poissonProbability(homeGoals, home) * poissonProbability(awayGoals, away);
      rawTotal += rawProbability;
      rawRows.push({
        home,
        away,
        label: `${home}-${away}`,
        rawProbability,
      });
    }
  }

  const rows = rawRows.map((row) => ({
    home: row.home,
    away: row.away,
    label: row.label,
    probability: Number(((row.rawProbability / rawTotal) * 100).toFixed(1)),
  }));

  return {
    maxGoals,
    rows,
    coveredProbability: Number((rawTotal * 100).toFixed(2)),
  };
}

function roundMarketProbabilities(values) {
  const rounded = values.map((value) => Math.floor(value));
  let remainder = 100 - rounded.reduce((sum, value) => sum + value, 0);
  const order = values
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (const item of order) {
    if (remainder <= 0) break;
    rounded[item.index] += 1;
    remainder -= 1;
  }

  return rounded;
}

function summarizeScoreMatrix(scoreMatrix) {
  const marketRaw = scoreMatrix.rows.reduce(
    (summary, row) => {
      if (row.home > row.away) summary.homeWin += row.probability;
      else if (row.home === row.away) summary.draw += row.probability;
      else summary.awayWin += row.probability;
      return summary;
    },
    { homeWin: 0, draw: 0, awayWin: 0 },
  );
  const marketTotal = marketRaw.homeWin + marketRaw.draw + marketRaw.awayWin;
  const probs = roundMarketProbabilities([
    (marketRaw.homeWin / marketTotal) * 100,
    (marketRaw.draw / marketTotal) * 100,
    (marketRaw.awayWin / marketTotal) * 100,
  ]);
  const scorelines = [...scoreMatrix.rows]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);

  return {
    probs,
    scorelines,
  };
}

function summarizeBlowoutMarket(scoreMatrix, rankDiff, mismatchAdjustment) {
  const homeBlowout = scoreMatrix.rows
    .filter((row) => row.home - row.away >= 3)
    .reduce((sum, row) => sum + row.probability, 0);
  const awayBlowout = scoreMatrix.rows
    .filter((row) => row.away - row.home >= 3)
    .reduce((sum, row) => sum + row.probability, 0);
  const side = !mismatchAdjustment.triggered ? "none" : rankDiff > 0 ? "home" : "away";
  const probability = side === "home" ? homeBlowout : side === "away" ? awayBlowout : Math.max(homeBlowout, awayBlowout);

  return {
    side,
    line: side === "none" ? null : "favorite -2.5",
    probability: Number(probability.toFixed(1)),
  };
}

function isKnockoutStage(stage) {
  return /淘汰|16强|八分|四分|半决|决赛|final|round of 16|quarter|semi/i.test(String(stage ?? ""));
}

function getWeatherAdjustment(weatherText) {
  const text = String(weatherText ?? "");
  if (/待接入|待更新|缺失|unavailable|pending/i.test(text)) {
    return { factor: 1, label: "天气数据缺失，未参与节奏修正" };
  }

  if (/雷|暴雨|大雨|雪|强风|大风/.test(text)) {
    return { factor: 0.88, label: "恶劣天气压低节奏" };
  }

  if (/雨|阵雨|小雨|风/.test(text)) {
    return { factor: 0.92, label: "雨风天气压低节奏" };
  }

  const tempMatch = text.match(/(-?\d+(?:\.\d+)?)\s*°?C/i);
  const temperature = tempMatch ? Number(tempMatch[1]) : null;
  if (Number.isFinite(temperature) && temperature >= 30) {
    return { factor: 0.95, label: "高温轻微压低节奏" };
  }

  return { factor: 1, label: "常规天气" };
}

function average(values) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (!finiteValues.length) return null;
  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

function readNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function confidenceFromSample(sampleSize, high = 5, medium = 2) {
  if (sampleSize >= high) return "high";
  if (sampleSize >= medium) return "medium";
  return "low";
}

function roundImpact(value) {
  return Number(value.toFixed(3));
}

function summarizeTeamStats(rows = []) {
  const statsRows = rows
    .map((row) => row.stats ?? row)
    .filter(Boolean);

  const avgGoalDifference = average(statsRows.map((stats) => readNumber(stats.goalDifference)));
  const avgTotalGoals = average(statsRows.map((stats) => readNumber(stats.totalGoals)));
  const avgGoalsConceded = average(statsRows.map((stats) => readNumber(stats.goalsConceded)));
  const avgTotalShots = average(statsRows.map((stats) => readNumber(stats.totalShots)));
  const avgShotsOnTarget = average(statsRows.map((stats) => readNumber(stats.shotsOnTarget)));
  const avgPossessionPct = average(statsRows.map((stats) => readNumber(stats.possessionPct)));

  return {
    sampleSize: statsRows.length,
    avgGoalDifference,
    avgTotalGoals,
    avgGoalsConceded,
    avgTotalShots,
    avgShotsOnTarget,
    avgPossessionPct,
  };
}

function summarizeRecentFormTempo(rows = []) {
  const totals = rows
    .map((row) => {
      const homeScore = readNumber(row.homeScore);
      const awayScore = readNumber(row.awayScore);
      return homeScore == null || awayScore == null ? null : homeScore + awayScore;
    })
    .filter((value) => Number.isFinite(value));

  return {
    sampleSize: totals.length,
    avgTotalGoals: average(totals),
  };
}

function resultPoints(result) {
  if (result === "W") return 3;
  if (result === "D") return 1;
  if (result === "L") return 0;
  return null;
}

function summarizeRecentFormRecord(rows = []) {
  const records = rows
    .map((row) => {
      const teamScore = readNumber(row.teamScore);
      const opponentScore = readNumber(row.opponentScore);
      const points = resultPoints(row.result);
      if (teamScore == null || opponentScore == null || points == null) return null;

      return {
        points,
        goalDifference: teamScore - opponentScore,
      };
    })
    .filter(Boolean);

  return {
    sampleSize: records.length,
    pointsPerMatch: records.length ? Number(average(records.map((row) => row.points)).toFixed(2)) : null,
    avgGoalDifference: records.length ? Number(average(records.map((row) => row.goalDifference)).toFixed(2)) : null,
  };
}

function buildTeamStatsEdge(summary) {
  if (!summary.sampleSize) return 0;

  const goalDiffEdge = (summary.avgGoalDifference ?? 0) * 0.035;
  const attackEdge = ((summary.avgTotalGoals ?? 1.1) - 1.1) * 0.025;
  const defenseEdge = (1.1 - (summary.avgGoalsConceded ?? 1.1)) * 0.025;
  const shotVolumeEdge = ((summary.avgTotalShots ?? 10) - 10) * 0.006;
  const shotQualityEdge = ((summary.avgShotsOnTarget ?? 3) - 3) * 0.018;
  const possessionEdge = ((summary.avgPossessionPct ?? 50) - 50) * 0.0012;
  return clamp(goalDiffEdge + attackEdge + defenseEdge + shotVolumeEdge + shotQualityEdge + possessionEdge, -0.14, 0.14);
}

function buildRecentFormEdge(summary) {
  if (!summary.sampleSize) return 0;

  const pointsEdge = ((summary.pointsPerMatch ?? 1) - 1) * 0.045;
  const goalDiffEdge = (summary.avgGoalDifference ?? 0) * 0.025;
  return clamp(pointsEdge + goalDiffEdge, -0.12, 0.12);
}

function rowDate(row) {
  const value = row?.eventDate ?? row?.date ?? row?.match?.kickoffAt ?? row?.match?.time;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function summarizeRecentMatchDates(rows = [], kickoffTime) {
  const dates = rows
    .map(rowDate)
    .filter((time) => Number.isFinite(time) && time < kickoffTime)
    .sort((a, b) => b - a);
  const latest = dates[0] ?? null;
  const restDays = latest == null ? null : Math.max(0, Math.floor((kickoffTime - latest) / (24 * 60 * 60 * 1000)));

  return {
    sampleSize: dates.length,
    latestMatchAt: latest == null ? null : new Date(latest).toISOString(),
    restDays,
  };
}

function summarizeAvailability(lineups = []) {
  const athletes = lineups.reduce((sum, lineup) => (
    sum + (Array.isArray(lineup.athletes) ? lineup.athletes.length : 0)
  ), 0);

  return {
    lineups: lineups.length,
    athletes,
  };
}

function buildFatigueAdjustment(match, enrichment = {}) {
  const kickoffTime = new Date(match.time).getTime();
  if (!Number.isFinite(kickoffTime)) {
    return {
      homeEdge: 0,
      awayEdge: 0,
      details: {
        home: { sampleSize: 0, latestMatchAt: null, restDays: null },
        away: { sampleSize: 0, latestMatchAt: null, restDays: null },
        restDaysDiff: null,
      },
    };
  }

  const home = summarizeRecentMatchDates(enrichment.home?.recentForm, kickoffTime);
  const away = summarizeRecentMatchDates(enrichment.away?.recentForm, kickoffTime);
  const restDaysDiff = home.restDays == null || away.restDays == null ? null : home.restDays - away.restDays;
  const edge = restDaysDiff == null || Math.abs(restDaysDiff) <= 2 ? 0 : clamp(restDaysDiff * 0.02, -0.08, 0.08);

  return {
    homeEdge: edge,
    awayEdge: -edge,
    details: {
      home,
      away,
      restDaysDiff,
    },
  };
}

function buildEspnWhitelistAdjustment(enrichment = {}) {
  const home = enrichment.home ?? {};
  const away = enrichment.away ?? {};
  const homeStats = summarizeTeamStats(home.teamMatchStats);
  const awayStats = summarizeTeamStats(away.teamMatchStats);
  const homeFormTempo = summarizeRecentFormTempo(home.recentForm);
  const awayFormTempo = summarizeRecentFormTempo(away.recentForm);
  const homeFormRecord = summarizeRecentFormRecord(home.recentForm);
  const awayFormRecord = summarizeRecentFormRecord(away.recentForm);
  const appliedSignals = [];
  const ignoredSignals = [];

  const homeEdge = buildTeamStatsEdge(homeStats);
  const awayEdge = buildTeamStatsEdge(awayStats);
  if (homeStats.sampleSize || awayStats.sampleSize) {
    appliedSignals.push("teamMatchStats");
  }

  const hasFormRecord = homeFormRecord.sampleSize || awayFormRecord.sampleSize;
  const homeFormEdge = buildRecentFormEdge(homeFormRecord);
  const awayFormEdge = buildRecentFormEdge(awayFormRecord);
  const formTempoAvg = hasFormRecord ? null : average([homeFormTempo.avgTotalGoals, awayFormTempo.avgTotalGoals]);
  const tempoFactor = formTempoAvg == null ? 1 : clamp(1 + (formTempoAvg - 2.2) * 0.012, 0.96, 1.04);
  if (hasFormRecord) {
    appliedSignals.push("recentFormRecord");
  } else if (homeFormTempo.sampleSize || awayFormTempo.sampleSize) {
    appliedSignals.push("recentFormTempo");
  }

  if (home.marketOdds?.length || away.marketOdds?.length) ignoredSignals.push("marketOdds");
  if (home.lineups?.length || away.lineups?.length) ignoredSignals.push("lineups");

  return {
    homeEdge: homeEdge + homeFormEdge,
    awayEdge: awayEdge + awayFormEdge,
    homeFormEdge,
    awayFormEdge,
    tempoFactor,
    details: {
      source: enrichment.source ?? "none",
      appliedSignals,
      ignoredSignals,
      weight: "low",
      home: {
        teamMatchStats: homeStats,
        recentFormTempo: homeFormTempo,
        recentFormRecord: homeFormRecord,
      },
      away: {
        teamMatchStats: awayStats,
        recentFormTempo: awayFormTempo,
        recentFormRecord: awayFormRecord,
      },
      tempoFactor: Number(tempoFactor.toFixed(3)),
    },
  };
}

function isHostVenueForTeam(strength, venue) {
  const country = String(venue?.country ?? "").toLowerCase();
  if (strength.code === "MEX") return /mex|墨西哥/.test(country);
  if (strength.code === "USA") return /usa|united states|美国/.test(country);
  if (strength.code === "CAN") return /can|加拿大/.test(country);
  return false;
}

function getMismatchAdjustment(homeStrength, awayStrength, rankDiff, hasPlaceholder) {
  if (hasPlaceholder) {
    return {
      triggered: false,
      homeEdge: 0,
      awayEdge: 0,
      favorite: "none",
      gapScore: 0,
      label: "占位球队不做强弱悬殊放大",
    };
  }

  const rankGap = Math.abs(rankDiff);
  const qualityGap = Math.abs((homeStrength.attack + homeStrength.defense) - (awayStrength.attack + awayStrength.defense));
  const gapScore = rankGap + qualityGap * 80;
  if (gapScore < 52) {
    return {
      triggered: false,
      homeEdge: 0,
      awayEdge: 0,
      favorite: "none",
      gapScore: Number(gapScore.toFixed(1)),
      label: "强弱差未达到大胜修正阈值",
    };
  }

  const favoriteEdge = clamp((gapScore - 52) / 90, 0.12, 0.32);
  const underdogSuppression = clamp((gapScore - 52) / 220, 0.04, 0.12);
  const homeFavorite = rankDiff > 0;

  return {
    triggered: true,
    homeEdge: homeFavorite ? favoriteEdge : -underdogSuppression,
    awayEdge: homeFavorite ? -underdogSuppression : favoriteEdge,
    favorite: homeFavorite ? "home" : "away",
    gapScore: Number(gapScore.toFixed(1)),
    label: "强弱悬殊场景提高大胜尾部概率",
  };
}

function buildExpectedGoals(match, homeStrength, awayStrength, venue, weatherText, enrichment) {
  const hasPlaceholder = homeStrength.source === "placeholder" || awayStrength.source === "placeholder";
  const rankDiff = awayStrength.rank - homeStrength.rank;
  const confidenceWeight = hasPlaceholder
    ? clamp(Math.min(homeStrength.confidence, awayStrength.confidence) / 0.78, 0.08, 1)
    : 1;
  const rankEdge = clamp(rankDiff / 70, -0.55, 0.55) * confidenceWeight;
  const homeAttackEdge = (homeStrength.attack - awayStrength.defense) * 1.55 * confidenceWeight;
  const awayAttackEdge = (awayStrength.attack - homeStrength.defense) * 1.45 * confidenceWeight;
  const altitudeHomeEdge = venue.altitude > 1500 ? 0.16 : 0;
  const altitudeAwayEdge = venue.altitude > 1500 ? -0.08 : 0;
  const hostHomeEdge = isHostVenueForTeam(homeStrength, venue) ? 0.12 : 0;
  const hostAwayEdge = isHostVenueForTeam(awayStrength, venue) ? 0.12 : 0;
  const stageAdjustment = isKnockoutStage(match.stage) ? { factor: 0.9, label: "淘汰赛节奏保守" } : { factor: 1, label: "小组/常规赛节奏" };
  const weatherAdjustment = getWeatherAdjustment(weatherText);
  const placeholderAdjustment = hasPlaceholder ? { factor: 0.86, label: "占位球队低可信，压低强结论" } : { factor: 1, label: "球队已确定" };
  const espnAdjustment = buildEspnWhitelistAdjustment(enrichment);
  const mismatchAdjustment = getMismatchAdjustment(homeStrength, awayStrength, rankDiff, hasPlaceholder);
  const fatigueAdjustment = buildFatigueAdjustment(match, enrichment);
  const stageWeatherFactor = stageAdjustment.factor * weatherAdjustment.factor * placeholderAdjustment.factor * espnAdjustment.tempoFactor;
  const homeRaw = 1.18 + rankEdge + homeAttackEdge + altitudeHomeEdge + hostHomeEdge + espnAdjustment.homeEdge + mismatchAdjustment.homeEdge + fatigueAdjustment.homeEdge;
  const awayRaw = 1.03 - rankEdge + awayAttackEdge + altitudeAwayEdge + hostAwayEdge + espnAdjustment.awayEdge + mismatchAdjustment.awayEdge + fatigueAdjustment.awayEdge;
  const home = clamp(homeRaw * stageWeatherFactor, 0.35, 3.15);
  const away = clamp(awayRaw * stageWeatherFactor, 0.25, 2.75);

  return {
    home,
    away,
    details: {
      inputs: {
        home: {
          code: homeStrength.code,
          rank: homeStrength.rank,
          attack: homeStrength.attack,
          defense: homeStrength.defense,
          confederation: homeStrength.confederation,
          confidence: homeStrength.confidence,
          host: homeStrength.host,
          placeholderType: homeStrength.placeholderType ?? null,
          source: homeStrength.source,
        },
        away: {
          code: awayStrength.code,
          rank: awayStrength.rank,
          attack: awayStrength.attack,
          defense: awayStrength.defense,
          confederation: awayStrength.confederation,
          confidence: awayStrength.confidence,
          host: awayStrength.host,
          placeholderType: awayStrength.placeholderType ?? null,
          source: awayStrength.source,
        },
        venue: {
          altitude: venue.altitude ?? 0,
        },
        weather: weatherText,
        stage: match.stage ?? null,
      },
      components: {
        baseHome: 1.18,
        baseAway: 1.03,
        rankEdge: Number(rankEdge.toFixed(3)),
        homeAttackEdge: Number(homeAttackEdge.toFixed(3)),
        awayAttackEdge: Number(awayAttackEdge.toFixed(3)),
        confidenceWeight: Number(confidenceWeight.toFixed(3)),
        altitudeHomeEdge,
        altitudeAwayEdge,
        hostHomeEdge,
        hostAwayEdge,
        espnHomeEdge: Number(espnAdjustment.homeEdge.toFixed(3)),
        espnAwayEdge: Number(espnAdjustment.awayEdge.toFixed(3)),
        espnHomeFormEdge: Number(espnAdjustment.homeFormEdge.toFixed(3)),
        espnAwayFormEdge: Number(espnAdjustment.awayFormEdge.toFixed(3)),
        mismatchHomeEdge: Number(mismatchAdjustment.homeEdge.toFixed(3)),
        mismatchAwayEdge: Number(mismatchAdjustment.awayEdge.toFixed(3)),
        fatigueHomeEdge: Number(fatigueAdjustment.homeEdge.toFixed(3)),
        fatigueAwayEdge: Number(fatigueAdjustment.awayEdge.toFixed(3)),
      },
      adjustments: {
        stage: stageAdjustment,
        weather: weatherAdjustment,
        placeholder: placeholderAdjustment,
        espnWhitelist: espnAdjustment.details,
        mismatch: mismatchAdjustment,
        fatigue: {
          ...fatigueAdjustment.details,
          homeEdge: Number(fatigueAdjustment.homeEdge.toFixed(3)),
          awayEdge: Number(fatigueAdjustment.awayEdge.toFixed(3)),
          label: "赛程体能低权重修正",
        },
        host: {
          homeEdge: hostHomeEdge,
          awayEdge: hostAwayEdge,
        },
        combinedFactor: Number(stageWeatherFactor.toFixed(3)),
      },
    },
  };
}

function signalLabel(impact, neutral, homeLabel, awayLabel) {
  if (impact > 0.015) return homeLabel;
  if (impact < -0.015) return awayLabel;
  return neutral;
}

function buildUpsetRisk({ probs, hasPlaceholder, expectedGoals, modelSignals }) {
  const [homeWin, draw, awayWin] = probs;
  const topProbability = Math.max(homeWin, draw, awayWin);
  const winGap = Math.abs(homeWin - awayWin);
  let score = 12;

  if (topProbability < 45) score += 24;
  if (winGap < 12) score += 18;
  if (draw >= 28) score += 8;
  if (hasPlaceholder) score += 35;
  if (expectedGoals.details.adjustments.weather.factor < 0.93) score += 12;
  if (expectedGoals.details.adjustments.stage.factor < 1) score += 7;
  if (Math.abs(modelSignals.form.impact) > 0.08 && Math.sign(modelSignals.form.impact) !== Math.sign(modelSignals.baseStrength.impact)) score += 8;
  if (Math.abs(modelSignals.production.impact) > 0.08 && Math.sign(modelSignals.production.impact) !== Math.sign(modelSignals.baseStrength.impact)) score += 8;
  if (expectedGoals.details.adjustments.mismatch.triggered) score -= 12;
  if (topProbability >= 65) score -= 10;

  const bounded = clamp(Math.round(score), 0, 100);
  const level = bounded >= 62 ? "高" : bounded >= 34 ? "中" : "低";

  return {
    level,
    score: bounded,
    label: level === "高" ? "冷门风险高" : level === "中" ? "存在冷门波动" : "冷门风险低",
    details: {
      topProbability,
      winGap,
      draw,
      hasPlaceholder,
      weatherFactor: expectedGoals.details.adjustments.weather.factor,
      mismatchTriggered: expectedGoals.details.adjustments.mismatch.triggered,
    },
  };
}

function buildModelSignals({ homeStrength, awayStrength, rankDiff, expectedGoals, enrichment, venue, weatherText, probs, blowout, hasPlaceholder }) {
  const components = expectedGoals.details.components;
  const adjustments = expectedGoals.details.adjustments;
  const espn = adjustments.espnWhitelist;
  const homeAvailability = summarizeAvailability(enrichment?.home?.lineups ?? []);
  const awayAvailability = summarizeAvailability(enrichment?.away?.lineups ?? []);
  const baseImpact = components.rankEdge + components.homeAttackEdge - components.awayAttackEdge;
  const formImpact = components.espnHomeFormEdge - components.espnAwayFormEdge;
  const productionImpact = (components.espnHomeEdge - components.espnHomeFormEdge) - (components.espnAwayEdge - components.espnAwayFormEdge);
  const fatigueImpact = components.fatigueHomeEdge - components.fatigueAwayEdge;
  const environmentImpact = components.altitudeHomeEdge - Math.abs(components.altitudeAwayEdge) + components.hostHomeEdge - components.hostAwayEdge;
  const tacticalImpact = components.mismatchHomeEdge - components.mismatchAwayEdge;
  const lineupAthletes = homeAvailability.athletes + awayAvailability.athletes;

  const signals = {
    baseStrength: {
      impact: roundImpact(baseImpact),
      confidence: hasPlaceholder ? "low" : "high",
      label: signalLabel(baseImpact, "基础实力接近", "基础实力偏主队", "基础实力偏客队"),
      details: {
        rankDiff,
        homeRank: homeStrength.rank,
        awayRank: awayStrength.rank,
        homeAttack: homeStrength.attack,
        awayAttack: awayStrength.attack,
        homeDefense: homeStrength.defense,
        awayDefense: awayStrength.defense,
      },
    },
    form: {
      impact: roundImpact(formImpact),
      confidence: confidenceFromSample((espn.home.recentFormRecord.sampleSize ?? 0) + (espn.away.recentFormRecord.sampleSize ?? 0), 8, 3),
      label: signalLabel(formImpact, "近期状态中性", "近期状态偏主队", "近期状态偏客队"),
      details: {
        home: espn.home.recentFormRecord,
        away: espn.away.recentFormRecord,
        pointsPerMatchDiff: Number(((espn.home.recentFormRecord.pointsPerMatch ?? 0) - (espn.away.recentFormRecord.pointsPerMatch ?? 0)).toFixed(2)),
        goalDifferenceDiff: Number(((espn.home.recentFormRecord.avgGoalDifference ?? 0) - (espn.away.recentFormRecord.avgGoalDifference ?? 0)).toFixed(2)),
      },
    },
    production: {
      impact: roundImpact(productionImpact),
      confidence: confidenceFromSample((espn.home.teamMatchStats.sampleSize ?? 0) + (espn.away.teamMatchStats.sampleSize ?? 0), 6, 2),
      label: signalLabel(productionImpact, "进攻产出中性", "进攻产出偏主队", "进攻产出偏客队"),
      details: {
        home: espn.home.teamMatchStats,
        away: espn.away.teamMatchStats,
      },
    },
    fatigue: {
      impact: roundImpact(fatigueImpact),
      confidence: adjustments.fatigue.restDaysDiff == null ? "low" : "medium",
      label: signalLabel(fatigueImpact, "赛程体能中性", "休息天数偏主队", "休息天数偏客队"),
      details: {
        homeRestDays: adjustments.fatigue.home.restDays,
        awayRestDays: adjustments.fatigue.away.restDays,
        restDaysDiff: adjustments.fatigue.restDaysDiff,
        homeLatestMatchAt: adjustments.fatigue.home.latestMatchAt,
        awayLatestMatchAt: adjustments.fatigue.away.latestMatchAt,
      },
    },
    environment: {
      impact: roundImpact(environmentImpact),
      confidence: "medium",
      label: signalLabel(environmentImpact, "环境因素中性", "环境因素偏主队", "环境因素偏客队"),
      details: {
        altitude: venue.altitude ?? 0,
        altitudeHigh: (venue.altitude ?? 0) > 1500,
        weather: weatherText,
        weatherFactor: adjustments.weather.factor,
        stageFactor: adjustments.stage.factor,
        host: adjustments.host,
      },
    },
    tactical: {
      impact: roundImpact(tacticalImpact),
      confidence: "medium",
      label: adjustments.mismatch.triggered ? adjustments.mismatch.label : "未触发强弱悬殊修正",
      details: {
        mismatch: adjustments.mismatch,
        blowout,
      },
    },
    availability: {
      impact: 0,
      confidence: lineupAthletes > 0 ? "medium" : homeAvailability.lineups + awayAvailability.lineups > 0 ? "low" : "low",
      label: lineupAthletes > 0 ? "阵容数据已观测" : "阵容球员明细不足",
      details: {
        homeLineups: homeAvailability.lineups,
        awayLineups: awayAvailability.lineups,
        homeAthletes: homeAvailability.athletes,
        awayAthletes: awayAvailability.athletes,
      },
    },
  };

  return {
    ...signals,
    upsetRisk: buildUpsetRisk({ probs, hasPlaceholder, expectedGoals, modelSignals: signals }),
  };
}

export function buildPrediction(match, homeTeam, awayTeam, venue, weatherText, enrichment) {
  const homeStrength = resolveTeamStrength(homeTeam);
  const awayStrength = resolveTeamStrength(awayTeam);
  const rankDiff = awayStrength.rank - homeStrength.rank;
  const expectedGoals = buildExpectedGoals(match, homeStrength, awayStrength, venue, weatherText, enrichment);
  const homeGoals = expectedGoals.home;
  const awayGoals = expectedGoals.away;
  const scoreMatrix = buildScoreMatrix(homeGoals, awayGoals);
  const { probs, scorelines } = summarizeScoreMatrix(scoreMatrix);
  const blowout = summarizeBlowoutMarket(scoreMatrix, rankDiff, expectedGoals.details.adjustments.mismatch);
  const topScoreline = scorelines[0];
  const predictedHome = topScoreline.home;
  const predictedAway = topScoreline.away;
  const hasPlaceholder = homeStrength.source === "placeholder" || awayStrength.source === "placeholder";
  const modelSignals = buildModelSignals({
    homeStrength,
    awayStrength,
    rankDiff,
    expectedGoals,
    enrichment,
    venue,
    weatherText,
    probs,
    blowout,
    hasPlaceholder,
  });
  const risk = modelSignals.upsetRisk.level;
  const score = `${predictedHome} - ${predictedAway}`;
  const halfHome = Math.max(0, Math.floor(homeGoals * 0.45));
  const halfAway = Math.max(0, Math.floor(awayGoals * 0.45));
  const halfFull = `${halfHome}-${halfAway} / ${predictedHome}-${predictedAway}`;
  const fullPick = probs[0] >= probs[2] && probs[0] >= probs[1] ? "主胜" : probs[1] >= probs[2] ? "平局" : "客胜";
  const handicapPick = `${homeTeam.name} -0.25 让胜`;
  const xg = [Number(homeGoals.toFixed(2)), Number(awayGoals.toFixed(2))];
  const factors = [
    ["战术", clamp(Math.round(rankDiff / 2), -6, 10)],
    ["天气", weatherText.includes("雨") ? -2 : 1],
    ["海拔", venue.altitude > 1500 ? 7 : 1],
    ["赛制", isKnockoutStage(match.stage) ? -3 : 1],
    ["占位", hasPlaceholder ? -8 : 0],
    ["强弱差", Math.round((expectedGoals.details.components.mismatchHomeEdge - expectedGoals.details.components.mismatchAwayEdge) * 35)],
    ["ESPN数据", Math.round((expectedGoals.details.components.espnHomeEdge - expectedGoals.details.components.espnAwayEdge) * 50)],
  ];

  return {
    modelVersion: MODEL_VERSION,
    score,
    halfFull,
    fullPick,
    handicapPick,
    probs,
    xg,
    risk,
    factors,
    predictionBreakdown: {
      modelVersion: MODEL_VERSION,
      modelSignals,
      markets: {
        fullTime: {
          pick: fullPick,
          probabilities: {
            homeWin: probs[0],
            draw: probs[1],
            awayWin: probs[2],
          },
        },
        score: {
          home: predictedHome,
          away: predictedAway,
          label: score,
          probability: topScoreline.probability,
        },
        halfFull: {
          half: {
            home: halfHome,
            away: halfAway,
            label: `${halfHome}-${halfAway}`,
          },
          full: {
            home: predictedHome,
            away: predictedAway,
            label: `${predictedHome}-${predictedAway}`,
          },
          label: halfFull,
        },
        handicap: {
          line: -0.25,
          side: "home",
          pick: handicapPick,
        },
        blowout,
      },
      xg: {
        home: xg[0],
        away: xg[1],
        ...expectedGoals.details,
      },
      scoreMatrix: {
        maxGoals: scoreMatrix.maxGoals,
        coveredProbability: scoreMatrix.coveredProbability,
      },
      scorelines,
      factors: factors.map(([name, impact]) => ({
        name,
        impact,
        target: impact >= 0 ? "home" : "away",
      })),
      strength: {
        home: homeStrength,
        away: awayStrength,
        rankDiff,
      },
    },
  };
}

function parseHalfFull(label, fallbackScore) {
  const [halfLabel = "", fullLabel = ""] = String(label ?? "").split("/");
  const half = parseScoreLabel(halfLabel);
  const full = parseScoreLabel(fullLabel || fallbackScore);

  return { half, full };
}

export function buildPredictionSnapshotRecord(matchId, prediction) {
  const { half } = parseHalfFull(prediction.halfFull, prediction.score);

  return {
    matchId,
    modelVersion: prediction.modelVersion ?? MODEL_VERSION,
    predictedHome: prediction.predictionBreakdown?.markets?.score?.home ?? parseScoreLabel(prediction.score).home,
    predictedAway: prediction.predictionBreakdown?.markets?.score?.away ?? parseScoreLabel(prediction.score).away,
    predictedHalfHome: prediction.predictionBreakdown?.markets?.halfFull?.half?.home ?? half.home,
    predictedHalfAway: prediction.predictionBreakdown?.markets?.halfFull?.half?.away ?? half.away,
    homeWinProb: prediction.probs?.[0] ?? prediction.predictionBreakdown?.markets?.fullTime?.probabilities?.homeWin ?? 0,
    drawProb: prediction.probs?.[1] ?? prediction.predictionBreakdown?.markets?.fullTime?.probabilities?.draw ?? 0,
    awayWinProb: prediction.probs?.[2] ?? prediction.predictionBreakdown?.markets?.fullTime?.probabilities?.awayWin ?? 0,
    xgHome: prediction.xg?.[0] ?? prediction.predictionBreakdown?.xg?.home ?? null,
    xgAway: prediction.xg?.[1] ?? prediction.predictionBreakdown?.xg?.away ?? null,
    risk: prediction.risk ?? "中",
    explanation: {
      score: prediction.score,
      halfFull: prediction.halfFull,
      fullPick: prediction.fullPick,
      handicapPick: prediction.handicapPick,
      factors: prediction.factors ?? [],
      predictionBreakdown: prediction.predictionBreakdown,
    },
  };
}

export function buildPredictionFromSnapshot(snapshot, fallbackPrediction) {
  const score = `${snapshot.predictedHome} - ${snapshot.predictedAway}`;
  const halfFull = `${snapshot.predictedHalfHome ?? 0}-${snapshot.predictedHalfAway ?? 0} / ${snapshot.predictedHome}-${snapshot.predictedAway}`;
  const explanation = snapshot.explanation ?? {};
  const probs = [
    Math.round(snapshot.homeWinProb),
    Math.round(snapshot.drawProb),
    Math.round(snapshot.awayWinProb),
  ];
  const xg = [
    snapshot.xgHome == null ? fallbackPrediction.xg[0] : Number(snapshot.xgHome),
    snapshot.xgAway == null ? fallbackPrediction.xg[1] : Number(snapshot.xgAway),
  ];

  return {
    ...fallbackPrediction,
    modelVersion: snapshot.modelVersion ?? fallbackPrediction.modelVersion,
    score: explanation.score ?? score,
    halfFull: explanation.halfFull ?? halfFull,
    fullPick: explanation.fullPick ?? fallbackPrediction.fullPick,
    handicapPick: explanation.handicapPick ?? fallbackPrediction.handicapPick,
    probs,
    xg,
    risk: snapshot.risk ?? fallbackPrediction.risk,
    factors: explanation.factors ?? fallbackPrediction.factors,
    predictionBreakdown: explanation.predictionBreakdown ?? {
      ...fallbackPrediction.predictionBreakdown,
      modelVersion: snapshot.modelVersion ?? fallbackPrediction.modelVersion,
    },
    predictionSource: "snapshot",
    predictionSnapshotId: snapshot.id ?? null,
    predictionCapturedAt: snapshot.createdAt ?? null,
  };
}

export function buildPredictionReview(prediction, match) {
  const hasResult = Number.isFinite(match.homeScore) && Number.isFinite(match.awayScore);
  if (!hasResult) {
    return {
      isFinished: false,
      status: "pending",
    };
  }

  const predictedScore = parseScoreLabel(prediction.score);
  const actualResult = resultFromScore(match.homeScore, match.awayScore);
  const predictedResult = resultFromScore(predictedScore.home, predictedScore.away);

  return {
    isFinished: true,
    status: "reviewed",
    actualScore: `${match.homeScore} - ${match.awayScore}`,
    predictedScore: prediction.score,
    actualResult,
    predictedResult,
    fullTimeHit: actualResult === predictedResult,
    scoreHit: match.homeScore === predictedScore.home && match.awayScore === predictedScore.away,
    goalDiffError: Math.abs((match.homeScore - match.awayScore) - (predictedScore.home - predictedScore.away)),
    totalGoalsError: Math.abs((match.homeScore + match.awayScore) - (predictedScore.home + predictedScore.away)),
  };
}
