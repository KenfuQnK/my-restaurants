import type {
  InstagramPublication,
  InstagramPublicationType,
  SavedRestaurant,
} from '../types/restaurant';

const STORAGE_KEY = 'mis-restaurantes:v1';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadRestaurants(storage: StorageLike = localStorage): SavedRestaurant[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeSavedRestaurant)
      .filter((item): item is SavedRestaurant => Boolean(item));
  } catch {
    return [];
  }
}

export function saveRestaurants(
  restaurants: SavedRestaurant[],
  storage: StorageLike = localStorage,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(restaurants));
}

export function parseStoredRestaurants(raw: string): SavedRestaurant[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeSavedRestaurant)
      .filter((item): item is SavedRestaurant => Boolean(item));
  } catch {
    return [];
  }
}

function normalizeSavedRestaurant(value: unknown): SavedRestaurant | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<SavedRestaurant>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.placeId !== 'string' ||
    !candidate.external ||
    typeof candidate.external.name !== 'string' ||
    !candidate.personal ||
    !Array.isArray(candidate.sources)
  ) {
    return undefined;
  }

  return {
    ...(candidate as SavedRestaurant),
    instagramPublications: Array.isArray(candidate.instagramPublications)
      ? candidate.instagramPublications
          .map(normalizeInstagramPublication)
          .filter((item): item is InstagramPublication => Boolean(item))
      : [],
  };
}

function normalizeInstagramPublication(
  value: unknown,
): InstagramPublication | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<InstagramPublication>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.originalUrl !== 'string' ||
    typeof candidate.normalizedUrl !== 'string' ||
    typeof candidate.createdAt !== 'string'
  ) {
    return undefined;
  }

  const originalUrl = validateStoredInstagramUrl(candidate.originalUrl, false);
  const normalizedUrl = validateStoredInstagramUrl(candidate.normalizedUrl, true);
  if (!originalUrl || !normalizedUrl) return undefined;

  const publicationType: InstagramPublicationType | undefined = [
    'reel',
    'post',
    'unknown',
  ].includes(candidate.publicationType ?? '')
    ? candidate.publicationType
    : undefined;

  return {
    id: candidate.id,
    originalUrl,
    normalizedUrl,
    shortcode:
      typeof candidate.shortcode === 'string' ? candidate.shortcode : undefined,
    publicationType,
    authorName:
      typeof candidate.authorName === 'string' ? candidate.authorName : undefined,
    authorUrl:
      typeof candidate.authorUrl === 'string'
        ? validateStoredInstagramUrl(candidate.authorUrl, true)
        : undefined,
    embedHtml:
      typeof candidate.embedHtml === 'string' &&
      candidate.embedHtml.length <= 120_000
        ? candidate.embedHtml
        : undefined,
    caption: typeof candidate.caption === 'string' ? candidate.caption : undefined,
    createdAt: candidate.createdAt,
  };
}

function validateStoredInstagramUrl(
  value: string,
  normalize: boolean,
): string | undefined {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (
      !['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(host) ||
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port
    ) {
      return undefined;
    }

    const parts = url.pathname.split('/').filter(Boolean);
    const media =
      parts.length === 2 &&
      ['p', 'reel', 'tv'].includes(parts[0].toLowerCase()) &&
      /^[A-Za-z0-9_-]{3,80}$/.test(parts[1]);
    const profile =
      parts.length === 1 &&
      /^(?!.*\.\.)[A-Za-z0-9._]{1,30}$/.test(parts[0]);
    if (!media && !profile) return undefined;

    if (!normalize) return value;
    const path = media
      ? `${parts[0].toLowerCase()}/${parts[1]}`
      : parts[0];
    return `https://www.instagram.com/${path}/`;
  } catch {
    return undefined;
  }
}
