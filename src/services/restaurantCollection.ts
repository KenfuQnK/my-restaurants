import type {
  ExternalPlace,
  ImportSource,
  InstagramPublication,
  MainCategoryId,
  SavedRestaurant,
} from '../types/restaurant';
import { detectCategory } from '../domain/categories';

interface UpsertOptions {
  now?: string;
  createId?: () => string;
  categoryId?: MainCategoryId;
  categoryIds?: MainCategoryId[];
  labelIds?: string[];
}

export interface UpsertRestaurantResult {
  restaurants: SavedRestaurant[];
  restaurant: SavedRestaurant;
  created: boolean;
  publicationAdded: boolean;
}

export function upsertRestaurant(
  restaurants: SavedRestaurant[],
  place: ExternalPlace,
  source: ImportSource,
  publication?: InstagramPublication,
  options: UpsertOptions = {},
): UpsertRestaurantResult {
  const now = options.now ?? new Date().toISOString();
  const existing = restaurants.find((item) => item.placeId === place.placeId);

  if (existing) {
    const publicationAlreadyExists = publication
      ? existing.instagramPublications.some(
          (item) => item.normalizedUrl === publication.normalizedUrl,
        )
      : false;
    const updated: SavedRestaurant = {
      ...existing,
      external: place,
      categoryIds: existing.categoryIds?.length
        ? existing.categoryIds
        : [existing.categoryId ?? detectCategory({ place }).categoryId],
      categoryId: undefined,
      personal: existing.personal,
      sources: appendSource(existing.sources, source),
      instagramPublications: mergePublications(
        existing.instagramPublications,
        publication,
      ),
      updatedAt: now,
    };

    return {
      restaurants: restaurants.map((item) =>
        item.placeId === place.placeId ? updated : item,
      ),
      restaurant: updated,
      created: false,
      publicationAdded: Boolean(publication && !publicationAlreadyExists),
    };
  }

  const saved: SavedRestaurant = {
    id: options.createId?.() ?? createId(),
    placeId: place.placeId,
    external: place,
    categoryIds: options.categoryIds?.length
      ? options.categoryIds
      : [options.categoryId ?? detectCategory({ place }).categoryId],
    personal: {
      notes: '',
      tags: [],
      labelIds: options.labelIds ?? [],
      favorite: false,
    },
    sources: [source],
    instagramPublications: publication ? [publication] : [],
    createdAt: now,
    updatedAt: now,
  };

  return {
    restaurants: [saved, ...restaurants],
    restaurant: saved,
    created: true,
    publicationAdded: Boolean(publication),
  };
}

function appendSource(sources: ImportSource[], source: ImportSource): ImportSource[] {
  const duplicated = source.url
    ? sources.some((item) => item.kind === source.kind && item.url === source.url)
    : false;
  return duplicated ? sources : [...sources, source];
}

function mergePublications(
  publications: InstagramPublication[],
  publication?: InstagramPublication,
): InstagramPublication[] {
  if (!publication) return publications;

  const existing = publications.find(
    (item) => item.normalizedUrl === publication.normalizedUrl,
  );
  if (!existing) return [...publications, publication];

  const refreshed: InstagramPublication = {
    ...existing,
    shortcode: publication.shortcode ?? existing.shortcode,
    publicationType: publication.publicationType ?? existing.publicationType,
    authorName: publication.authorName ?? existing.authorName,
    authorUrl: publication.authorUrl ?? existing.authorUrl,
    thumbnailUrl: publication.thumbnailUrl ?? existing.thumbnailUrl,
    embedHtml: publication.embedHtml ?? existing.embedHtml,
    caption: publication.caption ?? existing.caption,
  };

  return publications.map((item) =>
    item.normalizedUrl === publication.normalizedUrl ? refreshed : item,
  );
}

function createId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
