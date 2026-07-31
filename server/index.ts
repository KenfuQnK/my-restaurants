import cors, { type CorsOptions } from 'cors';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSharedInput } from './importResolver.js';
import {
  InstagramUrlError,
  resolveInstagramPublication,
} from './instagramService.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 8787);
const googleApiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
const metaOEmbedAccessToken = process.env.META_OEMBED_ACCESS_TOKEN?.trim();
const metaInstagramUserAccessToken = process.env.META_INSTAGRAM_USER_ACCESS_TOKEN?.trim();
const metaInstagramBusinessAccountId = process.env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim();
const metaGraphApiVersion = process.env.META_GRAPH_API_VERSION?.trim();
const instagramPublicOEmbedEnabled = parseBoolean(
  process.env.INSTAGRAM_PUBLIC_OEMBED_ENRICHMENT,
  true,
);
const instagramDebugLogs = parseBoolean(
  process.env.INSTAGRAM_DEBUG_LOGS,
  process.env.NODE_ENV !== 'production',
);
const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8787,http://127.0.0.1:8787')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origen no permitido por CORS.'));
  },
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

interface Location {
  latitude: number;
  longitude: number;
}

interface PhotoAttribution {
  displayName?: string;
  uri?: string;
  photoUri?: string;
}

interface PlacePhoto {
  name: string;
  widthPx?: number;
  heightPx?: number;
  authorAttributions?: PhotoAttribution[];
}

interface ExternalPlace {
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
}

interface GoogleTextValue {
  text?: string;
  languageCode?: string;
}

interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface GooglePlace {
  id?: string;
  displayName?: GoogleTextValue;
  formattedAddress?: string;
  shortFormattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  location?: Location;
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
  primaryTypeDisplayName?: GoogleTextValue;
  types?: string[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  photos?: PlacePhoto[];
  regularOpeningHours?: {
    weekdayDescriptions?: string[];
  };
  priceLevel?: string;
  businessStatus?: string;
}

const demoPlaces: ExternalPlace[] = [
  {
    placeId: 'demo-brasa-born',
    name: 'Demo · Brasa del Born',
    address: 'Carrer de la Demo, 12, Barcelona',
    shortAddress: 'El Born, Barcelona',
    city: 'Barcelona',
    country: 'España',
    latitude: 41.3852,
    longitude: 2.1821,
    rating: 4.6,
    reviewCount: 842,
    primaryType: 'mediterranean_restaurant',
    primaryTypeLabel: 'Restaurante mediterráneo',
    types: ['restaurant', 'mediterranean_restaurant'],
    phone: '+34 930 000 001',
    website: 'https://example.com/demo-brasa-born',
    googleMapsUrl: 'https://www.google.com/maps',
    photos: [{ name: 'demo/born', widthPx: 1200, heightPx: 800 }],
    openingHours: ['lunes–domingo: 13:00–23:30'],
    priceLevel: 'PRICE_LEVEL_MODERATE',
    businessStatus: 'OPERATIONAL',
  },
  {
    placeId: 'demo-sake-lab',
    name: 'Demo · Sake Lab',
    address: 'Avinguda de la Demo, 48, Barcelona',
    shortAddress: 'Eixample, Barcelona',
    city: 'Barcelona',
    country: 'España',
    latitude: 41.3935,
    longitude: 2.1634,
    rating: 4.8,
    reviewCount: 319,
    primaryType: 'japanese_restaurant',
    primaryTypeLabel: 'Restaurante japonés',
    types: ['restaurant', 'japanese_restaurant', 'sushi_restaurant'],
    phone: '+34 930 000 002',
    website: 'https://example.com/demo-sake-lab',
    googleMapsUrl: 'https://www.google.com/maps',
    photos: [{ name: 'demo/sake', widthPx: 1200, heightPx: 800 }],
    openingHours: ['martes–domingo: 13:00–16:00, 20:00–23:30'],
    priceLevel: 'PRICE_LEVEL_EXPENSIVE',
    businessStatus: 'OPERATIONAL',
  },
  {
    placeId: 'demo-casa-lima',
    name: 'Demo · Casa Lima',
    address: 'Plaça de la Demo, 7, Badalona',
    shortAddress: 'Centre, Badalona',
    city: 'Badalona',
    country: 'España',
    latitude: 41.4501,
    longitude: 2.2474,
    rating: 4.5,
    reviewCount: 567,
    primaryType: 'peruvian_restaurant',
    primaryTypeLabel: 'Restaurante peruano',
    types: ['restaurant', 'peruvian_restaurant'],
    phone: '+34 930 000 003',
    website: 'https://example.com/demo-casa-lima',
    googleMapsUrl: 'https://www.google.com/maps',
    photos: [{ name: 'demo/lima', widthPx: 1200, heightPx: 800 }],
    openingHours: ['miércoles–lunes: 12:30–23:00'],
    priceLevel: 'PRICE_LEVEL_MODERATE',
    businessStatus: 'OPERATIONAL',
  },
];

app.get('/api/status', (_request: Request, response: Response) => {
  response.json({
    configured: Boolean(googleApiKey),
    mode: googleApiKey ? 'google' : 'demo',
    instagramOEmbed: {
      graphApiVersion: metaGraphApiVersion || 'v26.0',
      authenticated: Boolean(metaOEmbedAccessToken),
      businessDiscoveryConfigured: Boolean(
        metaInstagramUserAccessToken && metaInstagramBusinessAccountId,
      ),
      publicMetadataEnrichment: instagramPublicOEmbedEnabled,
    },
    message: googleApiKey
      ? 'Google Places está configurado.'
      : 'Modo demo activo. Configura GOOGLE_PLACES_API_KEY para obtener establecimientos reales.',
  });
});

app.post('/api/places/search', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const query = typeof request.body?.query === 'string' ? request.body.query.trim() : '';
    const location = parseLocation(request.body?.location);

    if (query.length < 2) {
      response.status(400).json({ error: 'Escribe al menos dos caracteres para buscar.' });
      return;
    }

    if (!googleApiKey) {
      const places = searchDemoPlaces(query);
      logInstagramDebug('places_search', {
        query,
        mode: 'demo',
        resultCount: places.length,
        results: places.map((place) => ({ placeId: place.placeId, name: place.name })),
      });
      response.json({ places });
      return;
    }

    const body: Record<string, unknown> = {
      textQuery: query,
      languageCode: 'es',
      regionCode: 'ES',
      pageSize: 10,
    };

    if (location) {
      body.locationBias = {
        circle: {
          center: location,
          radius: 25_000,
        },
      };
    }

    const googleResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.shortFormattedAddress',
          'places.location',
          'places.rating',
          'places.userRatingCount',
          'places.primaryType',
          'places.primaryTypeDisplayName',
          'places.types',
          'places.googleMapsUri',
          'places.photos',
          'places.priceLevel',
          'places.businessStatus',
        ].join(','),
      },
      body: JSON.stringify(body),
    });

    const payload = (await readGoogleResponse(googleResponse)) as { places?: GooglePlace[] };
    const places = (payload.places ?? [])
      .map(normalizePlace)
      .filter((place): place is ExternalPlace => Boolean(place));
    logInstagramDebug('places_search', {
      query,
      mode: 'google',
      resultCount: places.length,
      results: places.map((place) => ({
        placeId: place.placeId,
        name: place.name,
        city: place.city,
        rating: place.rating,
      })),
    });
    response.json({ places });
  } catch (error) {
    next(error);
  }
});

app.get('/api/places/photo', async (request: Request, response: Response, next: NextFunction) => {
  try {
    if (!googleApiKey) {
      response.status(404).send('Las fotos reales requieren configurar Google Places.');
      return;
    }

    const name = typeof request.query.name === 'string' ? request.query.name : '';
    const width = clampNumber(request.query.maxWidthPx, 128, 1600, 900);

    if (!/^places\/[^/]+\/photos\/[^/]+$/.test(name)) {
      response.status(400).send('Referencia de foto no válida.');
      return;
    }

    const url = new URL(`https://places.googleapis.com/v1/${name}/media`);
    url.searchParams.set('maxWidthPx', String(width));
    url.searchParams.set('skipHttpRedirect', 'true');
    url.searchParams.set('key', googleApiKey);

    const googleResponse = await fetch(url);
    const payload = (await readGoogleResponse(googleResponse)) as { photoUri?: string };

    if (!payload.photoUri) {
      response.status(404).send('Google no devolvió una URL para esta fotografía.');
      return;
    }

    response.setHeader('Cache-Control', 'private, max-age=1800');
    response.redirect(302, payload.photoUri);
  } catch (error) {
    next(error);
  }
});

app.get('/api/places/:placeId', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const rawPlaceId = request.params.placeId;
    const placeId = typeof rawPlaceId === 'string' ? rawPlaceId.trim() : '';
    if (!placeId) {
      response.status(400).json({ error: 'Falta el identificador del establecimiento.' });
      return;
    }

    if (!googleApiKey) {
      const place = demoPlaces.find((item) => item.placeId === placeId);
      if (!place) {
        response.status(404).json({ error: 'Establecimiento de demostración no encontrado.' });
        return;
      }
      response.json(place);
      return;
    }

    const fields = [
      'id',
      'displayName',
      'formattedAddress',
      'shortFormattedAddress',
      'addressComponents',
      'location',
      'rating',
      'userRatingCount',
      'primaryType',
      'primaryTypeDisplayName',
      'types',
      'nationalPhoneNumber',
      'internationalPhoneNumber',
      'websiteUri',
      'googleMapsUri',
      'photos',
      'regularOpeningHours',
      'priceLevel',
      'businessStatus',
    ].join(',');

    const googleResponse = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          'X-Goog-Api-Key': googleApiKey,
          'X-Goog-FieldMask': fields,
          'Accept-Language': 'es',
        },
      },
    );

    const payload = (await readGoogleResponse(googleResponse)) as GooglePlace;
    const normalized = normalizePlace(payload);
    if (!normalized) {
      response.status(502).json({ error: 'La respuesta de Google no contiene un establecimiento válido.' });
      return;
    }
    response.json(normalized);
  } catch (error) {
    next(error);
  }
});

app.post('/api/import/resolve', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const input = typeof request.body?.input === 'string' ? request.body.input.trim() : '';
    if (!input) {
      response.status(400).json({ error: 'Pega un enlace o un texto para analizarlo.' });
      return;
    }

    const result = await resolveSharedInput(input);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/instagram/resolve', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const input =
      typeof request.body?.input === 'string'
        ? request.body.input.trim()
        : typeof request.body?.url === 'string'
          ? request.body.url.trim()
          : '';

    if (!input) {
      response.status(400).json({ error: 'Pega una URL de Instagram para continuar.' });
      return;
    }

    const result = await resolveInstagramPublication(input, {
      accessToken: metaOEmbedAccessToken,
      businessDiscoveryAccessToken: metaInstagramUserAccessToken,
      businessAccountId: metaInstagramBusinessAccountId,
      graphApiVersion: metaGraphApiVersion,
      publicOEmbedEnabled: instagramPublicOEmbedEnabled,
      debug: logInstagramDebug,
    });
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/share-target', (request: Request, response: Response) => {
  const sharedInput = [request.body?.url, request.body?.text]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)
    .join('\n');

  const destination = new URL('/', `${request.protocol}://${request.get('host')}`);
  if (sharedInput) destination.searchParams.set('share_url', sharedInput);
  response.redirect(303, `${destination.pathname}${destination.search}`);
});

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const frontendDirectory = path.resolve(currentDirectory, '../dist');

if (fs.existsSync(frontendDirectory)) {
  app.use(express.static(frontendDirectory));
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.method !== 'GET' || request.path.startsWith('/api/')) {
      next();
      return;
    }
    response.sendFile(path.join(frontendDirectory, 'index.html'));
  });
}

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  const message = error instanceof Error ? error.message : 'Se ha producido un error inesperado.';
  if (error instanceof InstagramUrlError) {
    response.status(400).json({ error: message, code: error.code });
    return;
  }
  console.error(error);
  response.status(500).json({ error: message });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`API disponible en http://127.0.0.1:${port}`);
  console.log(googleApiKey ? 'Google Places: configurado' : 'Google Places: modo demo');
  console.log(
    metaOEmbedAccessToken
      ? 'Instagram oEmbed: token del backend configurado'
      : 'Instagram oEmbed: sin token; se usará la degradación oficial disponible',
  );
  console.log(
    instagramPublicOEmbedEnabled
      ? 'Instagram JSON oEmbed: enriquecimiento automático activado'
      : 'Instagram JSON oEmbed: enriquecimiento automático desactivado',
  );
  console.log(
    metaInstagramUserAccessToken && metaInstagramBusinessAccountId
      ? 'Instagram Business Discovery: configurado'
      : 'Instagram Business Discovery: sin configurar; se usarán las cuentas detectadas sin enriquecimiento profesional',
  );
  console.log(
    instagramDebugLogs
      ? 'Logs de importación Instagram: activados (sin tokens ni HTML)'
      : 'Logs de importación Instagram: desactivados',
  );
});

function logInstagramDebug(event: string, details: Record<string, unknown>): void {
  if (!instagramDebugLogs) return;
  console.log(`[Instagram] ${event} ${JSON.stringify(details)}`);
}

function parseLocation(value: unknown): Location | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<Location>;
  if (
    typeof candidate.latitude !== 'number' ||
    typeof candidate.longitude !== 'number' ||
    !Number.isFinite(candidate.latitude) ||
    !Number.isFinite(candidate.longitude) ||
    Math.abs(candidate.latitude) > 90 ||
    Math.abs(candidate.longitude) > 180
  ) {
    return undefined;
  }
  return { latitude: candidate.latitude, longitude: candidate.longitude };
}

function normalizePlace(place: GooglePlace): ExternalPlace | null {
  if (!place.id || !place.displayName?.text) return null;
  const components = place.addressComponents ?? [];

  return {
    placeId: place.id,
    name: place.displayName.text,
    address: place.formattedAddress,
    shortAddress: place.shortFormattedAddress,
    city: getAddressPart(components, [
      'locality',
      'postal_town',
      'administrative_area_level_2',
      'administrative_area_level_1',
    ]),
    country: getAddressPart(components, ['country']),
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    primaryType: place.primaryType,
    primaryTypeLabel: place.primaryTypeDisplayName?.text,
    types: place.types ?? [],
    phone: place.internationalPhoneNumber ?? place.nationalPhoneNumber,
    website: place.websiteUri,
    googleMapsUrl: place.googleMapsUri,
    photos: place.photos ?? [],
    openingHours: place.regularOpeningHours?.weekdayDescriptions ?? [],
    priceLevel: place.priceLevel,
    businessStatus: place.businessStatus,
  };
}

function getAddressPart(components: GoogleAddressComponent[], wantedTypes: string[]): string | undefined {
  for (const type of wantedTypes) {
    const component = components.find((item) => item.types?.includes(type));
    if (component?.longText) return component.longText;
  }
  return undefined;
}

function searchDemoPlaces(query: string): ExternalPlace[] {
  const normalized = normalizeText(query);
  const words = normalized.split(/\s+/).filter(Boolean);
  const results = demoPlaces.filter((place) => {
    const haystack = normalizeText(
      [place.name, place.address, place.city, place.primaryTypeLabel, ...place.types].join(' '),
    );
    return words.every((word) => haystack.includes(word));
  });
  return results.length > 0 ? results : demoPlaces;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

async function readGoogleResponse(response: globalThis.Response): Promise<unknown> {
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const errorPayload = payload as { error?: { message?: string } };
    throw new Error(errorPayload.error?.message ?? `Google Places respondió con ${response.status}.`);
  }
  return payload;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return !['0', 'false', 'no', 'off'].includes(value.trim().toLocaleLowerCase('en'));
}
