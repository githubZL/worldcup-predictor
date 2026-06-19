const SPORTSDB_BASE_URL = "https://www.thesportsdb.com/api/v1/json/3";

export async function fetchSportsDbWorldCupTeams({ signal } = {}) {
  const params = new URLSearchParams({ l: "FIFA World Cup" });
  const response = await fetch(`${SPORTSDB_BASE_URL}/search_all_teams.php?${params}`, { signal });
  if (!response.ok) {
    throw new Error(`TheSportsDB request failed: ${response.status}`);
  }

  const payload = await response.json();
  return payload.teams ?? [];
}
