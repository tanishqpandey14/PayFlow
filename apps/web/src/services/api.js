
const API_BASE = "/api/v1";

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("payflow_token");

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      result.error?.message ||
      result.message ||
      "Something went wrong.";

    throw new Error(message);
  }

  return result.data ?? result;
}