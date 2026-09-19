import { useProfileStore } from '../store/profile.store';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const profileId = useProfileStore.getState().activeProfile?.id;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(profileId ? { 'X-Profile-Id': profileId } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}
