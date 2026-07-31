import type {
  ApiStatus,
  ExternalPlace,
  ResolvedImport,
  ResolvedInstagramPublication,
  SearchLocation,
} from '../types/restaurant';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

interface ApiErrorPayload {
  error?: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const payload = (await response.json()) as ApiErrorPayload;
      if (payload.error) message = payload.error;
    } catch {
      // La respuesta puede no ser JSON.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export const api = {
  getStatus(): Promise<ApiStatus> {
    return request<ApiStatus>('/status');
  },

  async searchPlaces(query: string, location?: SearchLocation): Promise<ExternalPlace[]> {
    const payload = await request<{ places: ExternalPlace[] }>('/places/search', {
      method: 'POST',
      body: JSON.stringify({ query, location }),
    });
    return payload.places;
  },

  getPlaceDetails(placeId: string): Promise<ExternalPlace> {
    return request<ExternalPlace>(`/places/${encodeURIComponent(placeId)}`);
  },

  resolveImport(input: string): Promise<ResolvedImport> {
    return request<ResolvedImport>('/import/resolve', {
      method: 'POST',
      body: JSON.stringify({ input }),
    });
  },

  resolveInstagram(input: string): Promise<ResolvedInstagramPublication> {
    return request<ResolvedInstagramPublication>('/instagram/resolve', {
      method: 'POST',
      body: JSON.stringify({ input }),
    });
  },

  photoUrl(photoName: string, width = 900): string {
    if (photoName.startsWith('demo/')) {
      return `/${photoName}.svg`;
    }
    return `${API_BASE_URL}/places/photo?name=${encodeURIComponent(photoName)}&maxWidthPx=${width}`;
  },
};
