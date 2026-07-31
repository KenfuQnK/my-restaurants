import {
  buildInstagramSearchQuery,
  extractFirstInstagramUrl,
  InstagramUrlError,
  type ParsedInstagramUrl,
} from './instagramService.js';

export interface Location {
  latitude: number;
  longitude: number;
}

export type ImportSourceKind = 'manual_search' | 'google_maps' | 'instagram' | 'plain_text';

export interface ResolvedImport {
  source: ImportSourceKind;
  originalInput: string;
  url?: string;
  finalUrl?: string;
  query?: string;
  username?: string;
  coordinates?: Location;
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
}

export async function resolveSharedInput(input: string): Promise<ResolvedImport> {
  let instagramUrl: ParsedInstagramUrl | undefined;
  try {
    instagramUrl = extractFirstInstagramUrl(input);
  } catch (error) {
    if (!(error instanceof InstagramUrlError) || error.code !== 'missing_url') {
      throw error;
    }
  }

  if (instagramUrl) {
    const search = buildInstagramSearchQuery(input, instagramUrl);
    return {
      source: 'instagram' as const,
      originalInput: input,
      url: instagramUrl.originalUrl,
      finalUrl: instagramUrl.normalizedUrl,
      query: search.query,
      username: instagramUrl.username,
      confidence: search.query ? ('medium' as const) : ('low' as const),
      explanation: search.query
        ? 'Se ha extraído una pista real del texto compartido o del perfil. Confirma siempre el restaurante en Google Places.'
        : 'La URL se ha validado, pero no contiene un nombre fiable. Escribe el restaurante para buscarlo en Google Places.',
    };
  }

  const extractedUrl = extractFirstUrl(input);
  const textWithoutUrl = cleanSharedText(extractedUrl ? input.replace(extractedUrl, ' ') : input);

  if (!extractedUrl) {
    return {
      source: 'plain_text' as const,
      originalInput: input,
      query: textWithoutUrl,
      confidence: 'medium' as const,
      explanation: 'Se utilizará el texto pegado como búsqueda en Google Places.',
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(extractedUrl);
  } catch {
    throw new Error('El enlace encontrado no es válido.');
  }

  if (isGoogleMapsHost(parsedUrl.hostname)) {
    let finalUrl = extractedUrl;
    let redirectWarning = '';

    if (shouldResolveRedirect(parsedUrl.hostname)) {
      try {
        finalUrl = await followAllowedRedirect(extractedUrl);
      } catch {
        redirectWarning = ' No se ha podido resolver el enlace corto automáticamente.';
      }
    }

    const finalParsed = new URL(finalUrl);
    const mapsData = extractGoogleMapsData(finalParsed, textWithoutUrl);

    return {
      source: 'google_maps' as const,
      originalInput: input,
      url: extractedUrl,
      finalUrl,
      query: mapsData.query,
      coordinates: mapsData.coordinates,
      confidence: mapsData.query ? ('high' as const) : ('low' as const),
      explanation: mapsData.query
        ? `Se ha extraído una búsqueda del enlace de Google Maps. Confirma el resultado antes de guardarlo.${redirectWarning}`
        : `El enlace se ha reconocido, pero no contiene un nombre legible. Pega también el nombre del local.${redirectWarning}`,
    };
  }

  return {
    source: 'plain_text' as const,
    originalInput: input,
    url: extractedUrl,
    query: textWithoutUrl || undefined,
    confidence: textWithoutUrl ? ('low' as const) : ('low' as const),
    explanation: 'El enlace no pertenece a Google Maps ni Instagram. Se usará el texto disponible como búsqueda.',
  };
}

function extractFirstUrl(input: string): string | undefined {
  const match = input.match(/https?:\/\/[^\s<>"']+/i)?.[0];
  return match?.replace(/[),.;!?]+$/, '');
}

function cleanSharedText(input: string): string {
  return input
    .replace(/\b(compartido desde|shared from|instagram|google maps|mira esta publicación de|mira este reel de|see this post from)\b/gi, ' ')
    .replace(/[@#]/g, ' ')
    .replace(/[|•]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGoogleMapsHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'maps.app.goo.gl' ||
    host === 'goo.gl' ||
    host === 'maps.google.com' ||
    /(^|\.)google\.[a-z.]+$/.test(host)
  );
}

function shouldResolveRedirect(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'maps.app.goo.gl' || host === 'goo.gl';
}

async function followAllowedRedirect(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 RestaurantImporter/1.0',
      },
    });
    await response.body?.cancel();

    const final = new URL(response.url);
    if (!isGoogleMapsHost(final.hostname)) {
      throw new Error('El enlace corto redirige a un dominio no permitido.');
    }
    return response.url;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Google Maps tardó demasiado en resolver el enlace corto.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractGoogleMapsData(url: URL, fallbackText: string): {
  query?: string;
  coordinates?: Location;
} {
  const decodedPath = safeDecode(url.pathname.replace(/\+/g, ' '));
  const pathMatch = decodedPath.match(/\/maps\/(?:place|search)\/([^/]+)/i);
  const queryParam = url.searchParams.get('query') ?? url.searchParams.get('q');
  const query = cleanSharedText(pathMatch?.[1] ?? queryParam ?? fallbackText);

  const atCoordinates = decodedPath.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const dataCoordinates = `${decodedPath}${url.search}`.match(
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  );
  const coordinatesMatch = atCoordinates ?? dataCoordinates;
  const coordinates = coordinatesMatch
    ? {
        latitude: Number(coordinatesMatch[1]),
        longitude: Number(coordinatesMatch[2]),
      }
    : undefined;

  return {
    query: query || undefined,
    coordinates: validateLocation(coordinates),
  };
}

function validateLocation(value: Location | undefined): Location | undefined {
  if (!value) return undefined;
  if (
    !Number.isFinite(value.latitude) ||
    !Number.isFinite(value.longitude) ||
    Math.abs(value.latitude) > 90 ||
    Math.abs(value.longitude) > 180
  ) {
    return undefined;
  }
  return value;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
