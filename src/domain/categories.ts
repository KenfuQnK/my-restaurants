import type {
  CategoryDetection,
  ExternalPlace,
  MainCategoryId,
  SavedItem,
} from '../types/restaurant';

export interface MainCategoryDefinition {
  id: MainCategoryId;
  name: string;
  shortDescription: string;
  supportsMap: boolean;
}

export const MAIN_CATEGORIES: readonly MainCategoryDefinition[] = [
  {
    id: 'hospitality',
    name: 'Hostelería',
    shortDescription: 'Restaurantes, bares, cafés y mucho más',
    supportsMap: true,
  },
  {
    id: 'stays',
    name: 'Estancias',
    shortDescription: 'Hoteles, casas y alojamientos',
    supportsMap: true,
  },
  {
    id: 'places',
    name: 'Lugares',
    shortDescription: 'Sitios, planes y rincones por descubrir',
    supportsMap: true,
  },
  {
    id: 'other',
    name: 'Otros',
    shortDescription: 'Ideas, recetas e inspiración',
    supportsMap: false,
  },
] as const;

const CATEGORY_BY_ID = new Map(MAIN_CATEGORIES.map((category) => [category.id, category]));

const STAY_TYPES = [
  'lodging',
  'hotel',
  'resort_hotel',
  'hostel',
  'motel',
  'bed_and_breakfast',
  'guest_house',
  'campground',
  'rv_park',
  'cottage',
  'villa',
  'apartment',
];

const HOSPITALITY_TYPES = [
  'restaurant',
  'bar',
  'cafe',
  'coffee_shop',
  'bakery',
  'meal_delivery',
  'meal_takeaway',
  'night_club',
];

const STAY_WORDS = [
  'hotel', 'hostal', 'hostel', 'resort', 'villa', 'apartamento', 'alojamiento',
  'cabaña', 'camping', 'glamping', 'casa rural', 'dormir', 'escapada',
];

const HOSPITALITY_WORDS = [
  'restaurante', 'restaurantes', 'restaurant', 'restaurants', 'bar', 'café',
  'cafe', 'cafetería', 'brunch', 'pastelería', 'panadería', 'coctelería',
  'cocktail', 'tapas', 'comer', 'cenar', 'pizzería', 'sushi', 'bistro', 'bistró',
  'foodie', 'diner', 'eatery', 'grill', 'kitchen', 'cocina', 'gastronomía',
  'chef', 'menú', 'reservas', 'burger', 'hamburguesa', 'taberna', 'tavern',
  'cervecería', 'brewpub', 'marisquería', 'asador', 'steakhouse',
];

const OTHER_WORDS = [
  'receta', 'recipe', 'ingredientes', 'diseño', 'inspiración', 'inspiration',
  'idea', 'manualidad', 'tutorial', 'producto', 'outfit', 'maquillaje', 'animal',
];

const PLACE_WORDS = [
  'playa', 'museo', 'museum', 'mirador', 'monumento', 'parque', 'tienda',
  'gimnasio', 'actividad', 'excursión', 'ruta', 'mercado', 'galería', 'teatro',
  'cine', 'spa', 'templo', 'iglesia', 'castillo', 'jardín', 'zoo', 'acuario',
];

export function getCategory(categoryId: MainCategoryId): MainCategoryDefinition {
  return CATEGORY_BY_ID.get(categoryId) ?? MAIN_CATEGORIES[0];
}

export function getItemCategory(item: SavedItem): MainCategoryId {
  return getItemCategories(item)[0];
}

export function getItemCategories(item: SavedItem): MainCategoryId[] {
  const categories = Array.from(new Set(
    (item.categoryIds ?? []).filter((categoryId) => CATEGORY_BY_ID.has(categoryId)),
  ));
  if (categories.length > 0) return categories;
  if (item.categoryId && CATEGORY_BY_ID.has(item.categoryId)) return [item.categoryId];
  return [detectCategory({ place: item.external }).categoryId];
}

export function detectCategory(input: {
  place?: ExternalPlace;
  text?: string;
}): CategoryDetection {
  const types = input.place?.types ?? [];
  const primaryType = input.place?.primaryType;
  const allTypes = new Set(primaryType ? [primaryType, ...types] : types);

  if (matchesType(allTypes, STAY_TYPES)) {
    return { categoryId: 'stays', confidence: 'high' };
  }
  if (matchesType(allTypes, HOSPITALITY_TYPES)) {
    return { categoryId: 'hospitality', confidence: 'high' };
  }

  const text = normalizeText([
    input.text,
    input.place?.name,
    input.place?.primaryTypeLabel,
    input.place?.description,
    ...types,
  ].filter(Boolean).join(' '));

  if (includesAny(text, STAY_WORDS)) {
    return { categoryId: 'stays', confidence: input.place ? 'high' : 'medium' };
  }
  if (includesAny(text, HOSPITALITY_WORDS)) {
    return { categoryId: 'hospitality', confidence: input.place ? 'high' : 'medium' };
  }
  if (includesAny(text, OTHER_WORDS)) {
    return { categoryId: 'other', confidence: 'medium' };
  }
  if (includesAny(text, PLACE_WORDS)) {
    return { categoryId: 'places', confidence: input.place ? 'high' : 'medium' };
  }

  if (input.place && hasLocation(input.place)) {
    return { categoryId: 'places', confidence: 'medium' };
  }

  return { categoryId: 'other', confidence: 'low' };
}

function matchesType(types: Set<string>, wanted: string[]): boolean {
  return wanted.some((wantedType) =>
    [...types].some((type) => type === wantedType || type.endsWith(`_${wantedType}`)),
  );
}

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => includesWholeTerm(text, normalizeText(word)));
}

function includesWholeTerm(text: string, term: string): boolean {
  let start = text.indexOf(term);
  while (start >= 0) {
    const before = start === 0 ? '' : text[start - 1];
    const afterIndex = start + term.length;
    const after = afterIndex >= text.length ? '' : text[afterIndex];
    if (!isWordCharacter(before) && !isWordCharacter(after)) return true;
    start = text.indexOf(term, start + 1);
  }
  return false;
}

function isWordCharacter(value: string): boolean {
  return Boolean(value && /[\p{L}\p{N}]/u.test(value));
}

function hasLocation(place: ExternalPlace): boolean {
  return typeof place.latitude === 'number' && typeof place.longitude === 'number';
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('es');
}
