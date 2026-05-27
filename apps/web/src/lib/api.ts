const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export interface ApiOptions extends RequestInit {
  token?: string | null;
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}) {
  const { token, headers, ...init } = options;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    }
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message ?? `API request failed: ${response.status}`);
  }

  return payload as T;
}
