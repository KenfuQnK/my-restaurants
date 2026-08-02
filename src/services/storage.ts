import type {
  InstagramPublication,
  InstagramPublicationType,
  SavedRestaurant,
} from '../types/restaurant';

const STORAGE_KEY = 'my-restaurants';
const LEGACY_STORAGE_KEY = 'mis-restaurantes:v1';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadRestaurants(storage: StorageLike = localStorage): SavedRestaurant[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) return parseStoredRestaurants(raw);

    const legacyRaw = storage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) return [];
    const restaurants = parseStoredRestaurants(legacyRaw);
    storage.setItem(STORAGE_KEY, JSON.stringify(restaurants));
    return restaurants;
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
    return normalizeRestaurantList(parsed);
  } catch {
    return [];
  }
}

export function parseRestaurantBackup(raw: string): SavedRestaurant[] {
  const parsed = JSON.parse(raw) as unknown;
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { restaurants?: unknown }).restaurants)
      ? (parsed as { restaurants: unknown[] }).restaurants
      : undefined;

  if (!list) throw new Error('El archivo no es una copia válida.');
  return normalizeRestaurantList(list);
}

export function mergeRestaurantCollections(
  current: SavedRestaurant[],
  imported: SavedRestaurant[],
): { restaurants: SavedRestaurant[]; added: number; updated: number } {
  const byPlaceId = new Map(current.map((restaurant) => [restaurant.placeId, restaurant]));
  let added = 0;
  let updated = 0;

  for (const restaurant of imported) {
    const existing = byPlaceId.get(restaurant.placeId);
    if (!existing) {
      byPlaceId.set(restaurant.placeId, restaurant);
      added += 1;
      continue;
    }

    if (Date.parse(restaurant.updatedAt) > Date.parse(existing.updatedAt)) {
      byPlaceId.set(restaurant.placeId, restaurant);
      updated += 1;
    }
  }

  return { restaurants: [...byPlaceId.values()], added, updated };
}

function normalizeRestaurantList(value: unknown): SavedRestaurant[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeSavedRestaurant)
    .filter((item): item is SavedRestaurant => Boolean(item));
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
