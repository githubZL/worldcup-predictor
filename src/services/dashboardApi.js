function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL ?? "";
  if (!configured) return "";

  try {
    const url = new URL(configured);
    const isLoopback = ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
    const isLocalPage = ["127.0.0.1", "localhost", "::1"].includes(window.location.hostname);
    return isLoopback && !isLocalPage ? "" : configured.replace(/\/$/, "");
  } catch {
    return configured.replace(/\/$/, "");
  }
}

const API_BASE_URL = resolveApiBaseUrl();

export async function fetchDashboard({ signal } = {}) {
  const response = await fetch(`${API_BASE_URL}/api/dashboard`, { signal });

  if (!response.ok) {
    throw new Error(`Dashboard API failed: ${response.status}`);
  }

  return response.json();
}
