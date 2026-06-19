const ESPN_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";

async function fetchJson(url, { signal } = {}) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "worldcup-predictor-data-probe/0.1",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`ESPN request failed: ${response.status}`);
  }

  return response.json();
}

export async function fetchEspnScoreboard({ dates, signal } = {}) {
  const params = new URLSearchParams();
  if (dates) params.set("dates", dates);
  const query = params.toString();
  return fetchJson(`${ESPN_BASE_URL}/scoreboard${query ? `?${query}` : ""}`, { signal });
}

export async function fetchEspnSummary(eventId, { signal } = {}) {
  const params = new URLSearchParams({ event: String(eventId) });
  return fetchJson(`${ESPN_BASE_URL}/summary?${params}`, { signal });
}
