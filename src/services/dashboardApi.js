const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4000";

export async function fetchDashboard({ signal } = {}) {
  const response = await fetch(`${API_BASE_URL}/api/dashboard`, { signal });

  if (!response.ok) {
    throw new Error(`Dashboard API failed: ${response.status}`);
  }

  return response.json();
}
