const TEAM_NAMES = {
  Algeria: "阿尔及利亚",
  Argentina: "阿根廷",
  Australia: "澳大利亚",
  Austria: "奥地利",
  Belgium: "比利时",
  "Bosnia and Herzegovina": "波黑",
  Brazil: "巴西",
  "Cabo Verde": "佛得角",
  Canada: "加拿大",
  Colombia: "哥伦比亚",
  "Congo DR": "刚果（金）",
  Croatia: "克罗地亚",
  Curaçao: "库拉索",
  Czechia: "捷克",
  "Côte d'Ivoire": "科特迪瓦",
  Ecuador: "厄瓜多尔",
  Egypt: "埃及",
  England: "英格兰",
  France: "法国",
  Germany: "德国",
  Ghana: "加纳",
  Haiti: "海地",
  "IR Iran": "伊朗",
  Iraq: "伊拉克",
  Japan: "日本",
  Jordan: "约旦",
  "Korea Republic": "韩国",
  Mexico: "墨西哥",
  Morocco: "摩洛哥",
  Netherlands: "荷兰",
  "New Zealand": "新西兰",
  Norway: "挪威",
  Panama: "巴拿马",
  Paraguay: "巴拉圭",
  Portugal: "葡萄牙",
  Qatar: "卡塔尔",
  "Saudi Arabia": "沙特",
  Scotland: "苏格兰",
  Senegal: "塞内加尔",
  "South Africa": "南非",
  Spain: "西班牙",
  Sweden: "瑞典",
  Switzerland: "瑞士",
  Tunisia: "突尼斯",
  Türkiye: "土耳其",
  USA: "美国",
  Uruguay: "乌拉圭",
  Uzbekistan: "乌兹别克斯坦",
};

const STAGE_NAMES = {
  "First Stage": "小组赛",
  "Round of 32": "32强赛",
  "Round of 16": "16强赛",
  "Quarter-final": "1/4决赛",
  "Semi-final": "半决赛",
  "Play-off for third place": "三四名决赛",
  Final: "决赛",
};

const VENUE_NAMES = {
  "Atlanta Stadium": "亚特兰大体育场",
  "BC Place Vancouver": "温哥华 BC Place",
  "Boston Stadium": "波士顿体育场",
  "Dallas Stadium": "达拉斯体育场",
  "Guadalajara Stadium": "瓜达拉哈拉体育场",
  "Houston Stadium": "休斯敦体育场",
  "Kansas City Stadium": "堪萨斯城体育场",
  "Los Angeles Stadium": "洛杉矶体育场",
  "Mexico City Stadium": "墨西哥城体育场",
  "Miami Stadium": "迈阿密体育场",
  "Monterrey Stadium": "蒙特雷体育场",
  "New York/New Jersey Stadium": "纽约/新泽西体育场",
  "Philadelphia Stadium": "费城体育场",
  "San Francisco Bay Area Stadium": "旧金山湾区体育场",
  "Seattle Stadium": "西雅图体育场",
  "Toronto Stadium": "多伦多体育场",
};

const CITY_NAMES = {
  Atlanta: "亚特兰大",
  Vancouver: "温哥华",
  Boston: "波士顿",
  Dallas: "达拉斯",
  Guadalajara: "瓜达拉哈拉",
  Houston: "休斯敦",
  "Kansas City": "堪萨斯城",
  "Los Angeles": "洛杉矶",
  "Mexico City": "墨西哥城",
  Miami: "迈阿密",
  Monterrey: "蒙特雷",
  "New Jersey": "新泽西",
  Philadelphia: "费城",
  "San Francisco Bay Area": "旧金山湾区",
  Seattle: "西雅图",
  Toronto: "多伦多",
};

const COUNTRY_NAMES = {
  CAN: "加拿大",
  MEX: "墨西哥",
  USA: "美国",
};

const COUNTRY_FLAGS = {
  ALG: "🇩🇿",
  ARG: "🇦🇷",
  AUS: "🇦🇺",
  AUT: "🇦🇹",
  BEL: "🇧🇪",
  BIH: "🇧🇦",
  BRA: "🇧🇷",
  CAN: "🇨🇦",
  CIV: "🇨🇮",
  CMR: "🇨🇲",
  COD: "🇨🇩",
  COL: "🇨🇴",
  CPV: "🇨🇻",
  CRC: "🇨🇷",
  CRO: "🇭🇷",
  CUW: "🇨🇼",
  CZE: "🇨🇿",
  ECU: "🇪🇨",
  EGY: "🇪🇬",
  ENG: "🏴",
  ESP: "🇪🇸",
  FRA: "🇫🇷",
  GER: "🇩🇪",
  GHA: "🇬🇭",
  HAI: "🇭🇹",
  IRN: "🇮🇷",
  IRQ: "🇮🇶",
  JOR: "🇯🇴",
  JPN: "🇯🇵",
  KOR: "🇰🇷",
  MAR: "🇲🇦",
  MEX: "🇲🇽",
  NED: "🇳🇱",
  NOR: "🇳🇴",
  NZL: "🇳🇿",
  PAN: "🇵🇦",
  PAR: "🇵🇾",
  POR: "🇵🇹",
  QAT: "🇶🇦",
  RSA: "🇿🇦",
  KSA: "🇸🇦",
  SCO: "🏴",
  SEN: "🇸🇳",
  SUI: "🇨🇭",
  SWE: "🇸🇪",
  TUN: "🇹🇳",
  TUR: "🇹🇷",
  URU: "🇺🇾",
  USA: "🇺🇸",
  UZB: "🇺🇿",
};

function translatePlaceholder(value) {
  if (/^[12][A-L]$/.test(value)) {
    return `${value[1]}组第${value[0]}`;
  }

  if (/^3[A-L]+$/.test(value)) {
    return `${value.slice(1).split("").join("/")}组第3`;
  }

  if (/^W\d+$/.test(value)) {
    return `第${value.slice(1)}场胜者`;
  }

  if (/^RU\d+$/.test(value)) {
    return `第${value.slice(2)}场负者`;
  }

  return value;
}

export function localizeTeamName(name) {
  if (!name) return name;
  return TEAM_NAMES[name] ?? translatePlaceholder(name);
}

export function localizeStageName(name) {
  return STAGE_NAMES[name] ?? name;
}

export function localizeGroupName(group) {
  if (!group) return group;
  return String(group).startsWith("Group ") ? String(group).replace("Group ", "") : group;
}

export function localizeVenueName(name) {
  return VENUE_NAMES[name] ?? name;
}

export function localizeCityName(name) {
  return CITY_NAMES[name] ?? name;
}

export function localizeCountryName(name) {
  return COUNTRY_NAMES[name] ?? name;
}

export function localizeFlag(value) {
  return COUNTRY_FLAGS[value] ?? value ?? "🏳️";
}

export function localizeStatus(status) {
  if (status === "scheduled") return "未赛";
  if (status === "finished") return "已赛";
  if (status === "live") return "进行中";
  return status;
}
