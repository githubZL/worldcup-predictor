const WORLDCUP26_BASE_URL = "https://worldcup26.ir/get";

async function fetchJson(path, { signal } = {}) {
  const response = await fetch(`${WORLDCUP26_BASE_URL}/${path}`, {
    headers: {
      "user-agent": "worldcup-predictor-data-probe/0.1",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`worldcup26.ir request failed: ${response.status}`);
  }

  return response.json();
}

export async function fetchWorldcup26Games({ signal } = {}) {
  return fetchJson("games", { signal });
}

export async function fetchWorldcup26Teams({ signal } = {}) {
  return fetchJson("teams", { signal });
}
