const WEATHER_LABELS = new Map([
  [0, "晴"],
  [1, "晴间多云"],
  [2, "多云"],
  [3, "阴"],
  [45, "雾"],
  [51, "小雨"],
  [61, "雨"],
  [80, "阵雨"],
  [95, "雷雨"],
]);

function nearestHourlyIndex(times, kickoffAt) {
  if (!Array.isArray(times) || times.length === 0) return -1;
  const target = new Date(kickoffAt).getTime();
  let bestIndex = 0;
  let bestDiff = Number.POSITIVE_INFINITY;

  times.forEach((time, index) => {
    const diff = Math.abs(new Date(time).getTime() - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = index;
    }
  });

  return bestIndex;
}

export function formatWeatherSnapshot(snapshot, fallback) {
  if (!snapshot) return fallback;
  const label = WEATHER_LABELS.get(snapshot.weatherCode) ?? "天气";
  const temp = Number.isFinite(snapshot.temperatureC) ? `${Math.round(snapshot.temperatureC)}°C` : "";
  return `${label} ${temp}`.trim() || fallback;
}

export async function fetchOpenMeteoWeather(venue, kickoffAt, { signal } = {}) {
  const params = new URLSearchParams({
    latitude: String(venue.latitude),
    longitude: String(venue.longitude),
    hourly: "temperature_2m,precipitation,weather_code,wind_speed_10m",
    timezone: venue.timezone || "auto",
    forecast_days: "16",
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed: ${response.status}`);
  }

  const payload = await response.json();
  const index = nearestHourlyIndex(payload.hourly?.time, kickoffAt);
  if (index < 0) return null;

  return {
    source: "open-meteo",
    forecastFor: payload.hourly.time[index],
    temperatureC: payload.hourly.temperature_2m?.[index] ?? null,
    precipitationMm: payload.hourly.precipitation?.[index] ?? null,
    windKph: payload.hourly.wind_speed_10m?.[index] ?? null,
    weatherCode: payload.hourly.weather_code?.[index] ?? null,
  };
}
