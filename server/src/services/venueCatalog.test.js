import assert from "node:assert/strict";
import test from "node:test";

import { enrichFifaVenue } from "./venueCatalog.js";

test("enrichFifaVenue fills missing coordinates and timezone for FIFA venue ids", () => {
  const venue = enrichFifaVenue({
    id: "fifa-venue-400222084",
    name: "Mexico City Stadium",
    city: "Mexico City",
    country: "MEX",
    latitude: 0,
    longitude: 0,
    altitude: null,
    timezone: "UTC",
    fallbackWeather: "天气待确认",
  });

  assert.equal(venue.latitude, 19.3029);
  assert.equal(venue.longitude, -99.1505);
  assert.equal(venue.timezone, "America/Mexico_City");
  assert.equal(venue.altitude, 2240);
  assert.equal(venue.fallbackWeather, "晴 22°C");
});

test("enrichFifaVenue keeps provider coordinates when they are already valid", () => {
  const venue = enrichFifaVenue({
    id: "custom-venue",
    name: "Custom Stadium",
    city: "Custom",
    country: "USA",
    latitude: 40.1,
    longitude: -74.2,
    altitude: 12,
    timezone: "America/New_York",
    fallbackWeather: "多云 20°C",
  });

  assert.equal(venue.latitude, 40.1);
  assert.equal(venue.longitude, -74.2);
  assert.equal(venue.timezone, "America/New_York");
  assert.equal(venue.fallbackWeather, "多云 20°C");
});
