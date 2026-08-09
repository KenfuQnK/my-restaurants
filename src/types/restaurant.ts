export type ImportSourceKind = 'manual_search' | 'google_maps' | 'instagram' | 'plain_text';
export type MainCategoryId = 'hospitality' | 'stays' | 'places' | 'other';
export type CategoryConfidence = 'high' | 'medium' | 'low';
export type InstagramPublicationType = 'reel' | 'post' | 'unknown';
export type InstagramEmbedStatus =
  | 'available'
  | 'unavailable'
  | 'rate_limited'
  | 'configuration_error'
  | 'network_error';
export type InstagramAccountSource =
  | 'profile_url'
  | 'shared_text'
  | 'public_oembed_author'
  | 'public_oembed_caption';
export type InstagramAccountRelevance =
  | 'likely_restaurant'
  | 'ambiguous'
  | 'likely_creator';
export type InstagramBusinessDiscoveryStatus =
  | 'available'
  | 'not_configured'
  | 'not_found'
  | 'configuration_error'
  | 'network_error';
export type InstagramImportStage =
  | 'waiting'
  | 'validating'
  | 'resolving'
  | 'awaiting_search'
  | 'searching'
  | 'candidates'
  | 'selected'
  | 'saved'
  | 'error';

export interface InstagramPublication {
  id: string;
  originalUrl: string;
  normalizedUrl: string;
  shortcode?: string;
  publicationType?: InstagramPublicationType;
  authorName?: string;
  authorUrl?: string;
  thumbnailUrl?: string;
  embedHtml?: string;
  caption?: string;
  createdAt: string;
}

export interface InstagramAccountCandidate {
  username: string;
  profileUrl: string;
  sources: InstagramAccountSource[];
  displayName?: string;
  biography?: string;
  website?: string;
  followersCount?: number;
  mediaCount?: number;
  relevance: InstagramAccountRelevance;
  discoveryStatus: InstagramBusinessDiscoveryStatus;
}

export interface InstagramSearchSuggestion {
  query: string;
  source: 'shared_text' | 'profile_username' | 'business_profile';
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  username?: string;
}

export interface PhotoAttribution {
  displayName?: string;
  uri?: string;
  photoUri?: string;
}

export interface PlacePhoto {
  name: string;
  widthPx?: number;
  heightPx?: number;
  authorAttributions?: PhotoAttribution[];
}

export interface ExternalPlace {
  placeId: string;
  name: string;
  address?: string;
  shortAddress?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
  primaryType?: string;
  primaryTypeLabel?: string;
  types: string[];
  phone?: string;
  website?: string;
  googleMapsUrl?: string;
  photos: PlacePhoto[];
  openingHours: string[];
  priceLevel?: string;
  businessStatus?: string;
  description?: string;
  sourceUrl?: string;
}

export interface RestaurantPersonalData {
  notes: string;
  tags: string[];
  labelIds?: string[];
  favorite: boolean;
}

export type ItemPersonalData = RestaurantPersonalData;

export interface UserLabel {
  id: string;
  name: string;
  categoryId: MainCategoryId;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryDetection {
  categoryId: MainCategoryId;
  confidence: CategoryConfidence;
}

export interface ImportSource {
  kind: ImportSourceKind;
  originalInput?: string;
  url?: string;
  importedAt: string;
}

export interface SavedRestaurant {
  id: string;
  placeId: string;
  external: ExternalPlace;
  personal: RestaurantPersonalData;
  categoryIds?: MainCategoryId[];
  /** Campo legado conservado para importar copias anteriores. */
  categoryId?: MainCategoryId;
  sources: ImportSource[];
  instagramPublications: InstagramPublication[];
  createdAt: string;
  updatedAt: string;
}

export type SavedItem = SavedRestaurant;

export interface ManualContentInput {
  title: string;
  description?: string;
  url?: string;
  categoryIds: MainCategoryId[];
  labelIds: string[];
  notes?: string;
  publication?: InstagramPublication;
  source?: ImportSource;
}

export interface SearchLocation {
  latitude: number;
  longitude: number;
}

export interface ApiStatus {
  configured: boolean;
  mode: 'google' | 'demo';
  instagramOEmbed?: {
    graphApiVersion: string;
    authenticated: boolean;
    businessDiscoveryConfigured?: boolean;
  };
  message: string;
}

export interface ResolvedImport {
  source: ImportSourceKind;
  originalInput: string;
  url?: string;
  finalUrl?: string;
  query?: string;
  username?: string;
  coordinates?: SearchLocation;
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
}

export interface ResolvedInstagramPublication {
  publication: InstagramPublication;
  suggestedQuery?: string;
  querySource: 'shared_text' | 'profile_username' | 'business_profile' | 'none';
  searchSuggestions: InstagramSearchSuggestion[];
  accounts: InstagramAccountCandidate[];
  embedStatus: InstagramEmbedStatus;
  message: string;
  metadataMessage: string;
}
