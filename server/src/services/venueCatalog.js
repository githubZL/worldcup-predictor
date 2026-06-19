export const WORLD_CUP_2026_VENUES = [
  {
    id: "fifa-venue-400222084",
    name: "Mexico City Stadium",
    latitude: 19.3029,
    longitude: -99.1505,
    altitude: 2240,
    timezone: "America/Mexico_City",
    fallbackWeather: "晴 22°C",
  },
  {
    id: "fifa-venue-400252150",
    name: "Guadalajara Stadium",
    latitude: 20.6819,
    longitude: -103.4622,
    altitude: 1566,
    timezone: "America/Mexico_City",
    fallbackWeather: "晴 25°C",
  },
  {
    id: "fifa-venue-400242032",
    name: "Toronto Stadium",
    latitude: 43.6332,
    longitude: -79.4186,
    altitude: 76,
    timezone: "America/Toronto",
    fallbackWeather: "多云 21°C",
  },
  {
    id: "fifa-venue-400017978",
    name: "Los Angeles Stadium",
    latitude: 33.9535,
    longitude: -118.3392,
    altitude: 39,
    timezone: "America/Los_Angeles",
    fallbackWeather: "晴 24°C",
  },
  {
    id: "fifa-venue-400257521",
    name: "San Francisco Bay Area Stadium",
    latitude: 37.403,
    longitude: -121.97,
    altitude: 7,
    timezone: "America/Los_Angeles",
    fallbackWeather: "晴间多云 22°C",
  },
  {
    id: "fifa-venue-400257536",
    name: "New York/New Jersey Stadium",
    latitude: 40.8135,
    longitude: -74.0745,
    altitude: 2,
    timezone: "America/New_York",
    fallbackWeather: "多云 22°C",
  },
  {
    id: "fifa-venue-400248623",
    name: "Boston Stadium",
    latitude: 42.0909,
    longitude: -71.2643,
    altitude: 88,
    timezone: "America/New_York",
    fallbackWeather: "多云 20°C",
  },
  {
    id: "fifa-venue-400248370",
    name: "BC Place Vancouver",
    latitude: 49.2767,
    longitude: -123.1119,
    altitude: 15,
    timezone: "America/Vancouver",
    fallbackWeather: "小雨 18°C",
  },
  {
    id: "fifa-venue-400249385",
    name: "Houston Stadium",
    latitude: 29.6847,
    longitude: -95.4107,
    altitude: 15,
    timezone: "America/Chicago",
    fallbackWeather: "多云 30°C",
  },
  {
    id: "fifa-venue-400257526",
    name: "Dallas Stadium",
    latitude: 32.7473,
    longitude: -97.0945,
    altitude: 163,
    timezone: "America/Chicago",
    fallbackWeather: "晴 31°C",
  },
  {
    id: "fifa-venue-400248622",
    name: "Philadelphia Stadium",
    latitude: 39.9008,
    longitude: -75.1675,
    altitude: 12,
    timezone: "America/New_York",
    fallbackWeather: "多云 24°C",
  },
  {
    id: "fifa-venue-400238450",
    name: "Monterrey Stadium",
    latitude: 25.6683,
    longitude: -100.2446,
    altitude: 540,
    timezone: "America/Monterrey",
    fallbackWeather: "晴 29°C",
  },
  {
    id: "fifa-venue-400098290",
    name: "Atlanta Stadium",
    latitude: 33.7554,
    longitude: -84.4009,
    altitude: 320,
    timezone: "America/New_York",
    fallbackWeather: "多云 27°C",
  },
  {
    id: "fifa-venue-400216606",
    name: "Seattle Stadium",
    latitude: 47.5952,
    longitude: -122.3316,
    altitude: 4,
    timezone: "America/Los_Angeles",
    fallbackWeather: "小雨 17°C",
  },
  {
    id: "fifa-venue-400257525",
    name: "Miami Stadium",
    latitude: 25.958,
    longitude: -80.2389,
    altitude: 2,
    timezone: "America/New_York",
    fallbackWeather: "阵雨 29°C",
  },
  {
    id: "fifa-venue-400254717",
    name: "Kansas City Stadium",
    latitude: 39.0489,
    longitude: -94.4839,
    altitude: 265,
    timezone: "America/Chicago",
    fallbackWeather: "多云 26°C",
  },
];

const venueById = new Map(WORLD_CUP_2026_VENUES.map((venue) => [venue.id, venue]));
const venueByName = new Map(WORLD_CUP_2026_VENUES.map((venue) => [venue.name.toLowerCase(), venue]));

function hasValidCoordinates(venue) {
  return Number.isFinite(venue.latitude)
    && Number.isFinite(venue.longitude)
    && Math.abs(venue.latitude) > 0.001
    && Math.abs(venue.longitude) > 0.001;
}

export function enrichFifaVenue(venue) {
  const canonical = venueById.get(venue.id) ?? venueByName.get(String(venue.name ?? "").toLowerCase());
  if (!canonical) return venue;

  return {
    ...venue,
    latitude: hasValidCoordinates(venue) ? venue.latitude : canonical.latitude,
    longitude: hasValidCoordinates(venue) ? venue.longitude : canonical.longitude,
    altitude: Number.isFinite(venue.altitude) ? venue.altitude : canonical.altitude,
    timezone: venue.timezone && venue.timezone !== "UTC" ? venue.timezone : canonical.timezone,
    fallbackWeather: venue.fallbackWeather && venue.fallbackWeather !== "天气待确认" ? venue.fallbackWeather : canonical.fallbackWeather,
  };
}
