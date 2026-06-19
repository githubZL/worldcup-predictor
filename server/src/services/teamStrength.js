const BASELINE_PROFILES = {
  ALG: { rank: 37, attack: 1.02, defense: 1.0 },
  ARG: { rank: 1, attack: 1.28, defense: 1.18 },
  AUS: { rank: 24, attack: 0.98, defense: 0.98 },
  AUT: { rank: 22, attack: 1.04, defense: 1.03 },
  BEL: { rank: 8, attack: 1.14, defense: 1.08 },
  BIH: { rank: 74, attack: 0.9, defense: 0.88 },
  BRA: { rank: 5, attack: 1.24, defense: 1.14 },
  CAN: { rank: 31, attack: 0.98, defense: 0.96 },
  CIV: { rank: 46, attack: 0.96, defense: 0.94 },
  COL: { rank: 12, attack: 1.1, defense: 1.06 },
  COD: { rank: 60, attack: 0.92, defense: 0.9 },
  CPV: { rank: 72, attack: 0.88, defense: 0.88 },
  CRO: { rank: 10, attack: 1.08, defense: 1.08 },
  CUW: { rank: 86, attack: 0.84, defense: 0.84 },
  CZE: { rank: 39, attack: 0.98, defense: 0.98 },
  ECU: { rank: 28, attack: 1.0, defense: 0.99 },
  EGY: { rank: 32, attack: 0.99, defense: 0.98 },
  ENG: { rank: 4, attack: 1.23, defense: 1.13 },
  FRA: { rank: 2, attack: 1.27, defense: 1.17 },
  GER: { rank: 9, attack: 1.15, defense: 1.07 },
  GHA: { rank: 68, attack: 0.9, defense: 0.88 },
  HAI: { rank: 83, attack: 0.84, defense: 0.84 },
  IRN: { rank: 20, attack: 1.01, defense: 1.0 },
  IRQ: { rank: 58, attack: 0.92, defense: 0.91 },
  JPN: { rank: 18, attack: 1.04, defense: 1.02 },
  JOR: { rank: 64, attack: 0.9, defense: 0.89 },
  KOR: { rank: 23, attack: 1.01, defense: 1.0 },
  KSA: { rank: 59, attack: 0.92, defense: 0.9 },
  MAR: { rank: 13, attack: 1.07, defense: 1.07 },
  MEX: { rank: 15, attack: 1.06, defense: 1.03 },
  NED: { rank: 7, attack: 1.17, defense: 1.1 },
  NOR: { rank: 34, attack: 1.02, defense: 0.96 },
  NZL: { rank: 88, attack: 0.82, defense: 0.82 },
  PAN: { rank: 41, attack: 0.96, defense: 0.94 },
  PAR: { rank: 48, attack: 0.94, defense: 0.94 },
  POR: { rank: 6, attack: 1.2, defense: 1.1 },
  QAT: { rank: 53, attack: 0.92, defense: 0.9 },
  RSA: { rank: 57, attack: 0.93, defense: 0.91 },
  SCO: { rank: 45, attack: 0.96, defense: 0.95 },
  SEN: { rank: 19, attack: 1.03, defense: 1.02 },
  ESP: { rank: 3, attack: 1.24, defense: 1.14 },
  SUI: { rank: 17, attack: 1.04, defense: 1.03 },
  SWE: { rank: 29, attack: 0.99, defense: 0.98 },
  TUN: { rank: 49, attack: 0.94, defense: 0.94 },
  TUR: { rank: 26, attack: 1.01, defense: 0.98 },
  URU: { rank: 11, attack: 1.09, defense: 1.07 },
  USA: { rank: 16, attack: 1.05, defense: 1.02 },
  UZB: { rank: 55, attack: 0.93, defense: 0.9 },
};

const CONFEDERATION_BY_CODE = {
  ALG: "CAF",
  ARG: "CONMEBOL",
  AUS: "AFC",
  AUT: "UEFA",
  BEL: "UEFA",
  BIH: "UEFA",
  BRA: "CONMEBOL",
  CAN: "CONCACAF",
  CIV: "CAF",
  COD: "CAF",
  COL: "CONMEBOL",
  CPV: "CAF",
  CRO: "UEFA",
  CUW: "CONCACAF",
  CZE: "UEFA",
  ECU: "CONMEBOL",
  EGY: "CAF",
  ENG: "UEFA",
  ESP: "UEFA",
  FRA: "UEFA",
  GER: "UEFA",
  GHA: "CAF",
  HAI: "CONCACAF",
  IRN: "AFC",
  IRQ: "AFC",
  JOR: "AFC",
  JPN: "AFC",
  KOR: "AFC",
  KSA: "AFC",
  MAR: "CAF",
  MEX: "CONCACAF",
  NED: "UEFA",
  NOR: "UEFA",
  NZL: "OFC",
  PAN: "CONCACAF",
  PAR: "CONMEBOL",
  POR: "UEFA",
  QAT: "AFC",
  RSA: "CAF",
  SCO: "UEFA",
  SEN: "CAF",
  SUI: "UEFA",
  SWE: "UEFA",
  TUN: "CAF",
  TUR: "UEFA",
  URU: "CONMEBOL",
  USA: "CONCACAF",
  UZB: "AFC",
};

const HOST_CODES = new Set(["CAN", "MEX", "USA"]);

const NAME_TO_CODE = {
  "阿尔及利亚": "ALG",
  "阿根廷": "ARG",
  "澳大利亚": "AUS",
  "奥地利": "AUT",
  "比利时": "BEL",
  "bosnia and herzegovina": "BIH",
  "波黑": "BIH",
  "巴西": "BRA",
  brazil: "BRA",
  "cabo verde": "CPV",
  "佛得角": "CPV",
  "加拿大": "CAN",
  "哥伦比亚": "COL",
  "congo dr": "COD",
  "刚果（金）": "COD",
  "刚果(金)": "COD",
  "cote d'ivoire": "CIV",
  "côte d'ivoire": "CIV",
  "科特迪瓦": "CIV",
  "克罗地亚": "CRO",
  curacao: "CUW",
  curaçao: "CUW",
  "库拉索": "CUW",
  czechia: "CZE",
  "捷克": "CZE",
  "厄瓜多尔": "ECU",
  "埃及": "EGY",
  england: "ENG",
  "英格兰": "ENG",
  france: "FRA",
  "法国": "FRA",
  germany: "GER",
  "德国": "GER",
  "加纳": "GHA",
  "海地": "HAI",
  "ir iran": "IRN",
  "伊朗": "IRN",
  "伊拉克": "IRQ",
  "日本": "JPN",
  "约旦": "JOR",
  "korea republic": "KOR",
  "韩国": "KOR",
  mexico: "MEX",
  "墨西哥": "MEX",
  "摩洛哥": "MAR",
  netherlands: "NED",
  "荷兰": "NED",
  "new zealand": "NZL",
  "新西兰": "NZL",
  "挪威": "NOR",
  "巴拿马": "PAN",
  "巴拉圭": "PAR",
  portugal: "POR",
  "葡萄牙": "POR",
  "卡塔尔": "QAT",
  "沙特": "KSA",
  "沙特阿拉伯": "KSA",
  scotland: "SCO",
  "苏格兰": "SCO",
  "塞内加尔": "SEN",
  "south africa": "RSA",
  "南非": "RSA",
  spain: "ESP",
  "西班牙": "ESP",
  "瑞典": "SWE",
  "瑞士": "SUI",
  "突尼斯": "TUN",
  türkiye: "TUR",
  turkiye: "TUR",
  "土耳其": "TUR",
  usa: "USA",
  "美国": "USA",
  "乌拉圭": "URU",
  uzbekistan: "UZB",
  "乌兹别克斯坦": "UZB",
};

const DEFAULT_PROFILE = {
  rank: 48,
  attack: 0.95,
  defense: 0.94,
  source: "default",
};

const PLACEHOLDER_PROFILE = {
  rank: 48,
  attack: 0.95,
  defense: 0.94,
};

function normalizeCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeName(value) {
  return String(value ?? "").trim().toLowerCase();
}

function profileFromRank(rank) {
  const rankScore = clamp((52 - rank) / 52, -0.85, 0.98);
  return {
    attack: Number(clamp(0.98 + rankScore * 0.18, 0.78, 1.22).toFixed(2)),
    defense: Number(clamp(0.97 + rankScore * 0.15, 0.78, 1.16).toFixed(2)),
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function withStrengthMeta(profile, { code, source, confidence }) {
  return {
    ...profile,
    code,
    confederation: CONFEDERATION_BY_CODE[code] ?? "unknown",
    host: HOST_CODES.has(code),
    confidence,
    source,
  };
}

function detectPlaceholder(team = {}) {
  const code = normalizeCode(team.countryCode);
  const name = String(team.name ?? team.nameEn ?? "").trim();

  if (/^[12][A-L]$/.test(code) || /^[A-L]组第[12]$/.test(name)) {
    return { placeholderType: "group-slot", code: code || null };
  }

  if (/^3[A-L]+$/.test(code) || /^[A-L](\/[A-L])+组第3$/.test(name)) {
    return { placeholderType: "third-place-pool", code: code || null };
  }

  if (/^W\d+$/.test(code) || /^第\d+场胜者$/.test(name)) {
    return { placeholderType: "match-winner", code: code || null };
  }

  if (/^RU\d+$/.test(code) || /^第\d+场负者$/.test(name)) {
    return { placeholderType: "match-loser", code: code || null };
  }

  return null;
}

export function resolveTeamStrength(team = {}) {
  const placeholder = detectPlaceholder(team);
  if (placeholder) {
    return {
      ...withStrengthMeta(PLACEHOLDER_PROFILE, {
        code: placeholder.code,
        confidence: 0.1,
        source: "placeholder",
      }),
      placeholderType: placeholder.placeholderType,
    };
  }

  const explicitRank = Number(team.fifaRank);
  const code = normalizeCode(team.countryCode);
  const nameCode = NAME_TO_CODE[normalizeName(team.name)] ?? NAME_TO_CODE[normalizeName(team.nameEn)];
  const resolvedCode = BASELINE_PROFILES[code] ? code : nameCode;
  const profile = BASELINE_PROFILES[resolvedCode];

  if (Number.isFinite(explicitRank) && explicitRank > 0) {
    const rankProfile = profile ?? profileFromRank(explicitRank);
    return withStrengthMeta({
      ...rankProfile,
      rank: explicitRank,
    }, {
      code: resolvedCode ?? code,
      confidence: profile ? 0.95 : 0.7,
      source: "database",
    });
  }

  if (profile) {
    return withStrengthMeta({
      ...profile,
    }, {
      code: resolvedCode,
      confidence: 0.78,
      source: "baseline",
    });
  }

  return withStrengthMeta(DEFAULT_PROFILE, {
    code: code || nameCode || null,
    confidence: 0.25,
    source: "default",
  });
}
