import { randomUUID } from 'node:crypto';

const DEFAULT_GRAPH_API_VERSION = 'v26.0';
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_OEMBED_RESPONSE_BYTES = 512_000;
const MAX_EMBED_HTML_LENGTH = 120_000;
const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com']);
const RESERVED_PROFILE_PATHS = new Set([
  'about',
  'accounts',
  'direct',
  'explore',
  'legal',
  'p',
  'reel',
  'reels',
  'stories',
  'tv',
  'web',
]);

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

export interface ParsedInstagramUrl {
  originalUrl: string;
  normalizedUrl: string;
  shortcode?: string;
  publicationType: InstagramPublicationType;
  username?: string;
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

export type InstagramUrlErrorCode =
  | 'missing_url'
  | 'invalid_url'
  | 'invalid_domain'
  | 'unsupported_path';

export class InstagramUrlError extends Error {
  constructor(
    message: string,
    readonly code: InstagramUrlErrorCode,
  ) {
    super(message);
    this.name = 'InstagramUrlError';
  }
}

interface InstagramServiceOptions {
  fetchImpl?: typeof fetch;
  graphApiVersion?: string;
  accessToken?: string;
  businessDiscoveryAccessToken?: string;
  businessAccountId?: string;
  publicOEmbedEnabled?: boolean;
  timeoutMs?: number;
  now?: () => string;
  createId?: () => string;
  debug?: (event: string, details: Record<string, unknown>) => void;
}

interface MetaOEmbedPayload {
  version?: unknown;
  provider_name?: unknown;
  provider_url?: unknown;
  type?: unknown;
  width?: unknown;
  html?: unknown;
  author_name?: unknown;
  author_url?: unknown;
  thumbnail_url?: unknown;
  title?: unknown;
  media_id?: unknown;
  error?: {
    message?: unknown;
    code?: unknown;
    error_subcode?: unknown;
    error_user_title?: unknown;
    error_user_msg?: unknown;
  };
}

interface OEmbedResolution {
  embedStatus: InstagramEmbedStatus;
  message: string;
  embedHtml?: string;
  authorName?: string;
  authorUrl?: string;
}

interface PublicOEmbedMetadata {
  status: 'available' | 'unavailable' | 'rate_limited' | 'network_error' | 'skipped';
  authorName?: string;
  authorUrl?: string;
  authorUsername?: string;
  caption?: string;
  embedHtml?: string;
  mentionedUsernames: string[];
}

interface AccountMetadataEvidence {
  authorUsername?: string;
  mentionedUsernames?: string[];
}

interface MetaBusinessDiscoveryPayload extends MetaOEmbedPayload {
  business_discovery?: {
    id?: unknown;
    username?: unknown;
    name?: unknown;
    biography?: unknown;
    website?: unknown;
    followers_count?: unknown;
    media_count?: unknown;
  };
}

export function extractFirstInstagramUrl(input: string): ParsedInstagramUrl {
  if (typeof input !== 'string' || !input.trim()) {
    throw new InstagramUrlError(
      'Pega una URL de Instagram para continuar.',
      'missing_url',
    );
  }

  let firstAllowedHostError: InstagramUrlError | undefined;
  let suspiciousInstagramDomain = false;

  for (const candidate of extractUrlCandidates(input)) {
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      continue;
    }

    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!INSTAGRAM_HOSTS.has(host)) {
      if (host.includes('instagram') || host.includes('instagr.am')) {
        suspiciousInstagramDomain = true;
      }
      continue;
    }

    try {
      return parseInstagramUrl(candidate);
    } catch (error) {
      if (error instanceof InstagramUrlError && !firstAllowedHostError) {
        firstAllowedHostError = error;
      }
    }
  }

  if (firstAllowedHostError) throw firstAllowedHostError;
  if (suspiciousInstagramDomain) {
    throw new InstagramUrlError(
      'El enlace parece imitar a Instagram, pero no pertenece a instagram.com.',
      'invalid_domain',
    );
  }
  throw new InstagramUrlError(
    'No se ha encontrado una URL válida de Instagram.',
    'missing_url',
  );
}

export function parseInstagramUrl(rawUrl: string): ParsedInstagramUrl {
  let url: URL;
  const cleanedUrl = cleanUrlCandidate(rawUrl);

  try {
    url = new URL(cleanedUrl);
  } catch {
    throw new InstagramUrlError('La URL de Instagram no es válida.', 'invalid_url');
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) {
    throw new InstagramUrlError(
      'La URL de Instagram utiliza un formato no admitido.',
      'invalid_url',
    );
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!INSTAGRAM_HOSTS.has(host)) {
    throw new InstagramUrlError(
      'La URL debe pertenecer exactamente a instagram.com.',
      'invalid_domain',
    );
  }

  const parts = url.pathname
    .split('/')
    .filter(Boolean)
    .map((part) => safeDecode(part));

  if (parts.length === 2 && ['p', 'reel', 'tv'].includes(parts[0].toLowerCase())) {
    const pathType = parts[0].toLowerCase();
    const shortcode = parts[1];
    if (!/^[A-Za-z0-9_-]{3,80}$/.test(shortcode)) {
      throw new InstagramUrlError(
        'El identificador de la publicación de Instagram no es válido.',
        'unsupported_path',
      );
    }

    const normalizedPathType = pathType === 'reel' ? 'reel' : pathType;
    return {
      originalUrl: cleanedUrl,
      normalizedUrl: `https://www.instagram.com/${normalizedPathType}/${shortcode}/`,
      shortcode,
      publicationType:
        pathType === 'reel' ? 'reel' : pathType === 'p' ? 'post' : 'unknown',
    };
  }

  if (parts.length === 1) {
    const username = parts[0];
    if (
      RESERVED_PROFILE_PATHS.has(username.toLowerCase()) ||
      !/^(?!.*\.\.)[A-Za-z0-9._]{1,30}$/.test(username)
    ) {
      throw new InstagramUrlError(
        'El enlace de Instagram no corresponde a una publicación, Reel o perfil compatible.',
        'unsupported_path',
      );
    }

    return {
      originalUrl: cleanedUrl,
      normalizedUrl: `https://www.instagram.com/${username}/`,
      publicationType: 'unknown',
      username,
    };
  }

  throw new InstagramUrlError(
    'Solo se admiten enlaces de publicaciones, Reels, vídeos o perfiles públicos de Instagram.',
    'unsupported_path',
  );
}

export function buildInstagramSearchQuery(
  input: string,
  parsed: ParsedInstagramUrl,
): {
  query?: string;
  source: ResolvedInstagramPublication['querySource'];
} {
  const withoutUrls = extractUrlCandidates(input).reduce(
    (text, candidate) => text.replace(candidate, ' '),
    input,
  );
  const withoutAccountMentions = withoutUrls.replace(
    /(?:^|[^\p{L}\p{N}._%+-])@[A-Za-z0-9._]{1,30}(?![A-Za-z0-9._])/gu,
    ' ',
  );
  const sharedText = cleanSearchText(withoutAccountMentions);

  if (sharedText.length >= 2) {
    return { query: sharedText, source: 'shared_text' };
  }

  if (parsed.username) {
    const usernameQuery = instagramUsernameToPlaceQuery(parsed.username);
    if (usernameQuery) return { query: usernameQuery, source: 'profile_username' };
  }

  return { source: 'none' };
}

export function extractInstagramAccountCandidates(
  input: string,
  parsed: ParsedInstagramUrl,
  metadata: AccountMetadataEvidence = {},
): InstagramAccountCandidate[] {
  const candidates = new Map<
    string,
    Omit<InstagramAccountCandidate, 'relevance' | 'discoveryStatus'>
  >();

  const add = (username: string | undefined, source: InstagramAccountSource) => {
    const normalizedUsername = normalizeInstagramUsername(username);
    if (!normalizedUsername) return;
    const key = normalizedUsername.toLocaleLowerCase('en');
    const current = candidates.get(key);
    if (current) {
      if (!current.sources.includes(source)) current.sources.push(source);
      return;
    }
    candidates.set(key, {
      username: normalizedUsername,
      profileUrl: `https://www.instagram.com/${normalizedUsername}/`,
      sources: [source],
    });
  };

  add(parsed.username, 'profile_url');
  add(metadata.authorUsername, 'public_oembed_author');

  for (const username of metadata.mentionedUsernames ?? []) {
    add(username, 'public_oembed_caption');
  }

  for (const candidate of extractUrlCandidates(input)) {
    try {
      const profile = parseInstagramUrl(candidate);
      if (profile.username) add(profile.username, 'profile_url');
    } catch {
      // Otros enlaces y publicaciones no contienen un username verificable.
    }
  }

  for (const match of input.matchAll(
    /(?:^|[^\p{L}\p{N}._%+-])@([A-Za-z0-9._]{1,30})(?![A-Za-z0-9._])/gu,
  )) {
    add(match[1], 'shared_text');
  }

  return Array.from(candidates.values())
    .map((candidate) => ({
      ...candidate,
      relevance: detectAccountRelevance(candidate),
      discoveryStatus: 'not_configured' as const,
    }))
    .sort(compareAccountCandidates)
    .slice(0, 8);
}

export function buildInstagramSearchSuggestions(
  input: string,
  parsed: ParsedInstagramUrl,
  accounts: InstagramAccountCandidate[],
): InstagramSearchSuggestion[] {
  const suggestions: InstagramSearchSuggestion[] = [];
  const seen = new Set<string>();
  const add = (suggestion: InstagramSearchSuggestion) => {
    const query = cleanSearchText(suggestion.query).slice(0, 180).trim();
    const key = query.toLocaleLowerCase('es');
    if (query.length < 2 || seen.has(key)) return;
    seen.add(key);
    suggestions.push({ ...suggestion, query });
  };

  const baseSearch = buildInstagramSearchQuery(input, parsed);
  if (baseSearch.query && baseSearch.source === 'shared_text') {
    add({
      query: baseSearch.query,
      source: 'shared_text',
      reason: 'Texto incluido por el usuario al compartir o pegar el enlace.',
      confidence: 'high',
    });
  }

  for (const account of accounts) {
    const isProfileUrl = account.sources.includes('profile_url');
    const displayName = account.displayName
      ? cleanSearchText(account.displayName)
      : undefined;
    const query = displayName || instagramUsernameToPlaceQuery(account.username);
    const source = displayName ? 'business_profile' : 'profile_username';
    const confidence =
      account.relevance === 'likely_restaurant'
        ? 'high'
        : account.relevance === 'likely_creator'
          ? 'low'
          : isProfileUrl
            ? 'medium'
            : 'low';

    add({
      query,
      source,
      username: account.username,
      confidence,
      reason:
        account.relevance === 'likely_restaurant'
          ? `La información pública profesional de @${account.username} contiene señales de restauración.`
          : account.relevance === 'likely_creator'
            ? `@${account.username} parece una cuenta de creador o recomendaciones; revisa los resultados con cautela.`
            : displayName
              ? `Nombre público profesional de @${account.username}.`
              : `Usuario @${account.username} detectado en el texto o en una URL de perfil.`,
    });
  }

  if (baseSearch.query && baseSearch.source === 'profile_username') {
    add({
      query: baseSearch.query,
      source: 'profile_username',
      reason: 'Nombre derivado únicamente de la URL de perfil proporcionada.',
      confidence: 'medium',
      username: parsed.username,
    });
  }

  return suggestions.sort(compareSearchSuggestions).slice(0, 8);
}

export function instagramUsernameToPlaceQuery(username: string): string {
  let query = safeDecode(username)
    .replace(/^@+/, '')
    .replace(/[._-]+/g, ' ')
    .replace(/([a-záéíóúüñ])([A-ZÁÉÍÓÚÜÑ])/g, '$1 $2')
    .trim();

  if (!query.includes(' ')) {
    const prefix = [
      'restaurante',
      'restaurant',
      'cafeteria',
      'cafe',
      'bodega',
      'taberna',
      'pizzeria',
      'braseria',
      'bar',
    ].find((candidate) => query.toLocaleLowerCase('es').startsWith(candidate));

    if (prefix && query.length > prefix.length + 2) {
      query = `${query.slice(0, prefix.length)} ${query.slice(prefix.length)}`;
    }
  }

  const parts = query.split(/\s+/).filter(Boolean);
  if (parts.length === 2 && /^(restaurante|restaurant|cafeteria|cafe|bar)$/i.test(parts[0])) {
    const articleMatch = parts[1].match(/^(la|el|los|las|del)([a-záéíóúüñ]{3,})$/i);
    if (articleMatch) {
      parts.splice(1, 1, articleMatch[1], articleMatch[2]);
      query = parts.join(' ');
    }
  }

  if (!query.includes(' ')) {
    const locality = [
      'barcelona',
      'granollers',
      'badalona',
      'tarragona',
      'valencia',
      'madrid',
      'sevilla',
      'malaga',
      'bilbao',
      'zaragoza',
      'alicante',
      'girona',
    ].find(
      (candidate) =>
        query.toLocaleLowerCase('es').endsWith(candidate) &&
        query.length > candidate.length + 2,
    );

    if (locality) {
      query = `${query.slice(0, -locality.length)} ${query.slice(-locality.length)}`;
    }
  }

  if (!query.includes(' ')) {
    for (const token of [
      'restaurant',
      'restaurante',
      'cafeteria',
      'pizzeria',
      'braseria',
      'gaming',
      'kitchen',
      'lounge',
      'bistro',
      'diner',
      'grill',
      'foodie',
      'gastro',
    ]) {
      query = query.replace(new RegExp(token, 'giu'), ` ${token} `);
    }
  }

  return cleanSearchText(query);
}

export async function resolveInstagramPublication(
  input: string,
  options: InstagramServiceOptions = {},
): Promise<ResolvedInstagramPublication> {
  const parsed = extractFirstInstagramUrl(input);
  options.debug?.('url_parsed', {
    normalizedUrl: parsed.normalizedUrl,
    publicationType: parsed.publicationType,
    shortcode: parsed.shortcode,
    profileUsername: parsed.username,
  });
  const publication: InstagramPublication = {
    id: options.createId?.() ?? randomUUID(),
    originalUrl: parsed.originalUrl,
    normalizedUrl: parsed.normalizedUrl,
    shortcode: parsed.shortcode,
    publicationType: parsed.publicationType,
    createdAt: options.now?.() ?? new Date().toISOString(),
  };

  const [graphOEmbed, publicOEmbed] = await Promise.all([
    requestInstagramOEmbed(parsed, options),
    requestInstagramPublicOEmbed(parsed, options),
  ]);
  const detectedAccounts = extractInstagramAccountCandidates(input, parsed, {
    authorUsername: publicOEmbed.authorUsername,
    mentionedUsernames: publicOEmbed.mentionedUsernames,
  });
  const accounts = await enrichInstagramAccounts(detectedAccounts, options);
  const searchSuggestions = buildInstagramSearchSuggestions(input, parsed, accounts);
  const preferredSuggestion = searchSuggestions[0];
  const embedHtml = graphOEmbed.embedHtml ?? publicOEmbed.embedHtml;
  const embedStatus = embedHtml ? 'available' : graphOEmbed.embedStatus;
  const message = embedHtml
    ? 'Publicación pública preparada con el embed oficial de Instagram.'
    : graphOEmbed.message;

  options.debug?.('resolution_complete', {
    embedStatus,
    embedHtmlAvailable: Boolean(embedHtml),
    publicOEmbedStatus: publicOEmbed.status,
    publicMetadataFields: compactPresentFields({
      authorName: publicOEmbed.authorName,
      authorUrl: publicOEmbed.authorUrl,
      caption: publicOEmbed.caption,
    }),
    accounts: accounts.map((account) => ({
      username: account.username,
      sources: account.sources,
      discoveryStatus: account.discoveryStatus,
      relevance: account.relevance,
      fields: compactPresentFields({
        displayName: account.displayName,
        biography: account.biography,
        website: account.website,
        followersCount: account.followersCount,
        mediaCount: account.mediaCount,
      }),
    })),
    searchSuggestions: searchSuggestions.map((suggestion) => ({
      query: suggestion.query,
      source: suggestion.source,
      confidence: suggestion.confidence,
      username: suggestion.username,
    })),
  });

  return {
    publication: {
      ...publication,
      authorName: publicOEmbed.authorName ?? graphOEmbed.authorName,
      authorUrl: publicOEmbed.authorUrl ?? graphOEmbed.authorUrl,
      caption: publicOEmbed.caption,
      embedHtml,
    },
    suggestedQuery: preferredSuggestion?.query,
    querySource: preferredSuggestion?.source ?? 'none',
    searchSuggestions,
    accounts,
    embedStatus,
    message,
    metadataMessage: buildMetadataMessage(accounts, options, publicOEmbed.status),
  };
}

async function requestInstagramPublicOEmbed(
  parsed: ParsedInstagramUrl,
  options: InstagramServiceOptions,
): Promise<PublicOEmbedMetadata> {
  if (
    options.publicOEmbedEnabled === false ||
    !parsed.shortcode ||
    !['reel', 'post', 'unknown'].includes(parsed.publicationType)
  ) {
    return { status: 'skipped', mentionedUsernames: [] };
  }

  const endpoint = new URL('https://www.instagram.com/api/v1/oembed/');
  endpoint.searchParams.set('url', parsed.normalizedUrl);
  endpoint.searchParams.set('omitscript', 'true');
  endpoint.searchParams.set('maxwidth', '658');
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    clampTimeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  );

  try {
    const response = await (options.fetchImpl ?? fetch)(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'restaurant-viewer/1.0',
      },
      signal: controller.signal,
    });
    const payload = await readMetaResponse(response);
    const caption = normalizeOptionalCaption(payload.title);
    const authorUrl =
      typeof payload.author_url === 'string'
        ? normalizeOptionalInstagramProfileUrl(payload.author_url)
        : undefined;
    const authorUsername = authorUrl
      ? parseInstagramUrl(authorUrl).username
      : normalizeInstagramUsername(
          typeof payload.author_name === 'string' ? payload.author_name : undefined,
        );
    const authorName =
      normalizeInstagramUsername(
        typeof payload.author_name === 'string' ? payload.author_name : undefined,
      ) ?? authorUsername;
    const mentionedUsernames = extractInstagramMentions(caption);
    const normalizedEmbed = normalizeOEmbedPayload(payload, parsed.normalizedUrl);
    const providerIsInstagram =
      typeof payload.provider_name !== 'string' ||
      payload.provider_name.toLocaleLowerCase('en') === 'instagram';

    options.debug?.('public_oembed_response', {
      status: response.status,
      providerIsInstagram,
      authorName,
      captionLength: caption?.length ?? 0,
      mentionedUsernames,
      responseFields: compactPresentFields({
        title: payload.title,
        authorName: payload.author_name,
        authorUrl: payload.author_url,
        html: payload.html,
        mediaId: payload.media_id,
      }),
    });

    if (!response.ok || !providerIsInstagram) {
      return {
        status: response.status === 429 ? 'rate_limited' : 'unavailable',
        mentionedUsernames: [],
      };
    }

    return {
      status: 'available',
      authorName,
      authorUrl,
      authorUsername,
      caption,
      embedHtml: normalizedEmbed.embedHtml,
      mentionedUsernames,
    };
  } catch (error) {
    options.debug?.('public_oembed_response', {
      status: 'network_error',
      reason: error instanceof Error && error.name === 'AbortError'
        ? 'timeout'
        : 'network_failure',
    });
    return { status: 'network_error', mentionedUsernames: [] };
  } finally {
    clearTimeout(timeout);
  }
}

async function requestInstagramOEmbed(
  parsed: ParsedInstagramUrl,
  options: InstagramServiceOptions,
): Promise<OEmbedResolution> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const graphApiVersion = normalizeGraphApiVersion(options.graphApiVersion);
  const endpoint = new URL(
    `https://graph.facebook.com/${graphApiVersion}/instagram_oembed`,
  );
  endpoint.searchParams.set('url', parsed.normalizedUrl);
  endpoint.searchParams.set('omitscript', 'true');
  endpoint.searchParams.set('maxwidth', '658');

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    clampTimeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  );

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    const accessToken = options.accessToken?.trim();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const response = await fetchImpl(endpoint, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    const payload = await readMetaResponse(response);
    options.debug?.('oembed_response', {
      status: response.status,
      responseFields: compactPresentFields({
        html: payload.html,
        providerName: payload.provider_name,
        type: payload.type,
        authorName: payload.author_name,
        authorUrl: payload.author_url,
      }),
      errorCode: toFiniteNumber(payload.error?.code),
      errorSubcode: toFiniteNumber(payload.error?.error_subcode),
    });

    if (!response.ok) {
      return mapMetaError(response.status, payload);
    }

    return normalizeOEmbedPayload(payload, parsed.normalizedUrl);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        embedStatus: 'network_error',
        message:
          'Instagram ha tardado demasiado en responder. Puedes continuar con el enlace y buscar el restaurante manualmente.',
      };
    }
    return {
      embedStatus: 'network_error',
      message:
        'No se ha podido contactar con Instagram. Puedes continuar con el enlace y buscar el restaurante manualmente.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function enrichInstagramAccounts(
  accounts: InstagramAccountCandidate[],
  options: InstagramServiceOptions,
): Promise<InstagramAccountCandidate[]> {
  if (accounts.length === 0) return [];

  const accessToken = options.businessDiscoveryAccessToken?.trim();
  const businessAccountId = options.businessAccountId?.trim();
  if (!accessToken || !businessAccountId) {
    options.debug?.('business_discovery_skipped', {
      reason: 'missing_configuration',
      detectedUsernames: accounts.map((account) => account.username),
      accessTokenConfigured: Boolean(accessToken),
      businessAccountIdConfigured: Boolean(businessAccountId),
    });
    return accounts;
  }

  if (!/^\d{5,30}$/u.test(businessAccountId)) {
    options.debug?.('business_discovery_skipped', {
      reason: 'invalid_business_account_id',
      detectedUsernames: accounts.map((account) => account.username),
    });
    return accounts.map((account) => ({
      ...account,
      discoveryStatus: 'configuration_error',
    }));
  }

  return Promise.all(
    accounts.map(async (account) => {
      const discovery = await requestBusinessDiscovery(
        account.username,
        businessAccountId,
        accessToken,
        options,
      );
      const enriched = {
        ...account,
        ...discovery.profile,
        discoveryStatus: discovery.status,
      };
      return {
        ...enriched,
        relevance: detectAccountRelevance(enriched),
      };
    }),
  );
}

async function requestBusinessDiscovery(
  username: string,
  businessAccountId: string,
  accessToken: string,
  options: InstagramServiceOptions,
): Promise<{
  status: InstagramBusinessDiscoveryStatus;
  profile?: Partial<InstagramAccountCandidate>;
}> {
  const endpoint = new URL(
    `https://graph.facebook.com/${normalizeGraphApiVersion(options.graphApiVersion)}/${businessAccountId}`,
  );
  endpoint.searchParams.set(
    'fields',
    `business_discovery.username(${username}){id,username,name,biography,website,followers_count,media_count}`,
  );

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    clampTimeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  );

  try {
    const response = await (options.fetchImpl ?? fetch)(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });
    const payload = (await readMetaResponse(response)) as MetaBusinessDiscoveryPayload;
    const code = toFiniteNumber(payload.error?.code);
    const status: InstagramBusinessDiscoveryStatus = response.ok
      ? 'available'
      : code === 190 || code === 200
        ? 'configuration_error'
        : code === 100 || response.status === 404
          ? 'not_found'
          : response.status >= 500 || response.status === 429
            ? 'network_error'
            : 'not_found';

    if (!response.ok || !payload.business_discovery) {
      options.debug?.('business_discovery_result', {
        username,
        status,
        httpStatus: response.status,
        errorCode: code,
        errorSubcode: toFiniteNumber(payload.error?.error_subcode),
      });
      return { status: response.ok ? 'not_found' : status };
    }

    const profile = normalizeBusinessProfile(payload.business_discovery, username);
    options.debug?.('business_discovery_result', {
      username,
      status: 'available',
      httpStatus: response.status,
      displayName: profile.displayName,
      biography: profile.biography,
      website: profile.website,
      followersCount: profile.followersCount,
      mediaCount: profile.mediaCount,
    });
    return { status: 'available', profile };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    options.debug?.('business_discovery_result', {
      username,
      status: 'network_error',
      reason: timedOut ? 'timeout' : 'network_failure',
    });
    return { status: 'network_error' };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeBusinessProfile(
  payload: NonNullable<MetaBusinessDiscoveryPayload['business_discovery']>,
  requestedUsername: string,
): Partial<InstagramAccountCandidate> {
  const returnedUsername = normalizeInstagramUsername(
    typeof payload.username === 'string' ? payload.username : requestedUsername,
  );
  return {
    username: returnedUsername ?? requestedUsername,
    profileUrl: `https://www.instagram.com/${returnedUsername ?? requestedUsername}/`,
    displayName: normalizeOptionalText(payload.name, 160),
    biography: normalizeOptionalText(payload.biography, 1_500),
    website: normalizeOptionalHttpUrl(payload.website),
    followersCount: toNonNegativeInteger(payload.followers_count),
    mediaCount: toNonNegativeInteger(payload.media_count),
  };
}

export function normalizeOEmbedPayload(
  payload: MetaOEmbedPayload,
  normalizedUrl: string,
): OEmbedResolution {
  const html = typeof payload.html === 'string' ? payload.html.trim() : '';
  const embedHtml = isSafeOfficialEmbedHtml(html, normalizedUrl) ? html : undefined;
  const authorName =
    typeof payload.author_name === 'string' && payload.author_name.trim()
      ? payload.author_name.trim().slice(0, 120)
      : undefined;
  const authorUrl =
    typeof payload.author_url === 'string'
      ? normalizeOptionalInstagramProfileUrl(payload.author_url)
      : undefined;

  if (!embedHtml) {
    return {
      embedStatus: 'unavailable',
      message:
        'Instagram no ha devuelto un embed utilizable. El enlace se conserva y puedes buscar el restaurante manualmente.',
      authorName,
      authorUrl,
    };
  }

  return {
    embedStatus: 'available',
    message: authorName
      ? 'Publicación pública preparada con el embed oficial de Instagram.'
      : 'Publicación pública preparada. Meta no ha devuelto datos de autor o descripción.',
    embedHtml,
    authorName,
    authorUrl,
  };
}

function mapMetaError(status: number, payload: MetaOEmbedPayload): OEmbedResolution {
  const code = toFiniteNumber(payload.error?.code);
  const subcode = toFiniteNumber(payload.error?.error_subcode);

  if (status === 429 || code === 4 || code === 17 || code === 32 || code === 613) {
    return {
      embedStatus: 'rate_limited',
      message:
        'Instagram ha limitado temporalmente las consultas. El enlace sigue siendo válido y puedes continuar manualmente.',
    };
  }

  if (code === 190 || code === 200) {
    return {
      embedStatus: 'configuration_error',
      message:
        'Meta no ha autorizado la consulta oEmbed. Revisa Meta oEmbed Read y el token del backend; mientras tanto puedes continuar manualmente.',
    };
  }

  if (code === 100 || subcode === 2_207_047 || status === 400 || status === 404) {
    return {
      embedStatus: 'unavailable',
      message:
        'Instagram no permite incrustar este contenido. Puede ser privado, haberse eliminado, tener los embeds desactivados o ser un perfil no admitido.',
    };
  }

  return {
    embedStatus: status >= 500 ? 'network_error' : 'unavailable',
    message:
      'Instagram no ha devuelto información de esta publicación. El enlace se conserva y puedes continuar manualmente.',
  };
}

async function readMetaResponse(response: globalThis.Response): Promise<MetaOEmbedPayload> {
  const text = await response.text();
  if (text.length > MAX_OEMBED_RESPONSE_BYTES) {
    return {};
  }
  try {
    return text ? (JSON.parse(text) as MetaOEmbedPayload) : {};
  } catch {
    return {};
  }
}

function isSafeOfficialEmbedHtml(html: string, normalizedUrl: string): boolean {
  if (!html || html.length > MAX_EMBED_HTML_LENGTH) return false;
  if (
    /<(?:script|iframe|object|embed|form|input|button|link|meta|base|style)\b/i.test(html) ||
    /\son[a-z]+\s*=/i.test(html) ||
    /javascript\s*:/i.test(html) ||
    /data\s*:\s*text\/html/i.test(html) ||
    /https?:\/\/[^"' )]*(?:cdninstagram|fbcdn)\./i.test(html)
  ) {
    return false;
  }

  if (!/<blockquote\b[^>]*class=(?:"[^"]*\binstagram-media\b[^"]*"|'[^']*\binstagram-media\b[^']*')/i.test(html)) {
    return false;
  }

  const permalinkMatch = html.match(
    /data-instgrm-permalink=(?:"([^"]+)"|'([^']+)')/i,
  );
  if (!permalinkMatch) return false;

  const permalink = decodeHtmlAttribute(permalinkMatch[1] ?? permalinkMatch[2] ?? '');
  try {
    return parseInstagramUrl(permalink).normalizedUrl === normalizedUrl;
  } catch {
    return false;
  }
}

function normalizeOptionalInstagramProfileUrl(value: string): string | undefined {
  try {
    const parsed = parseInstagramUrl(value);
    return parsed.username ? parsed.normalizedUrl : undefined;
  } catch {
    return undefined;
  }
}

function extractUrlCandidates(input: string): string[] {
  return Array.from(input.matchAll(/https?:\/\/[^\s<>"']+/giu), (match) =>
    cleanUrlCandidate(match[0]),
  ).filter(Boolean);
}

function cleanUrlCandidate(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/[)\]}>.,;!?¡¿]+$/u, '')
    .trim();
}

function cleanSearchText(value: string): string {
  return value
    .replace(
      /\b(?:compartido desde|shared from|mira (?:esta publicación|este reel) de|see this post from|instagram|reels?)\b/giu,
      ' ',
    )
    .replace(
      /#(?:food|foodie|foodporn|instafood|reels?|viral|fyp|parati|restaurante?s?|restaurant)\b/giu,
      ' ',
    )
    .replace(
      /\b(?:recomienda|recomendado por|colaboraci[oó]n|publicidad|contenido patrocinado|link (?:de|en) (?:su )?bio)\b/giu,
      ' ',
    )
    .replace(/^["'“”‘’\s]*(?:probamos|visitamos|descubrimos|comimos en)\s+/iu, '')
    .replace(/[@#]/gu, ' ')
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    .replace(/[|•·]+/gu, ' ')
    .replace(/[^\p{L}\p{N}.'’& -]+/gu, ' ')
    .replace(/\s+en\s+/giu, ' ')
    .replace(/\s+/gu, ' ')
    .replace(/^[-:–—\s]+|[-:–—\s]+$/gu, '')
    .trim();
}

function normalizeInstagramUsername(value: string | undefined): string | undefined {
  const username = safeDecode(value ?? '').replace(/^@+/, '').trim();
  return /^(?!.*\.\.)[A-Za-z0-9._]{1,30}$/u.test(username)
    ? username
    : undefined;
}

function detectAccountRelevance(
  account: Pick<
    InstagramAccountCandidate,
    'username' | 'displayName' | 'biography'
  >,
): InstagramAccountRelevance {
  const text = normalizeForMatching(
    [
      instagramUsernameToPlaceQuery(account.username),
      account.displayName,
      account.biography,
    ]
      .filter(Boolean)
      .join(' '),
  );
  const restaurantSignals =
    /\b(restaurante?|restaurant|diner|bistro|braseria|pizzeria|cafeteria|cafe|bar|taberna|tapas|cocktail|burgers?|sushi|cocina|kitchen|lounge|reservas?)\b/u;
  const creatorSignals =
    /\b(influencer|creator|creador|blogger|foodie|recomendaciones|planes|experiencias|viajes|travel|reviews?|content)\b/u;

  if (restaurantSignals.test(text)) return 'likely_restaurant';
  if (creatorSignals.test(text)) return 'likely_creator';
  return 'ambiguous';
}

function compareAccountCandidates(
  left: InstagramAccountCandidate,
  right: InstagramAccountCandidate,
): number {
  const sourceScore = (account: InstagramAccountCandidate) =>
    account.sources.includes('profile_url')
      ? 0
      : 1;
  return sourceScore(left) - sourceScore(right) ||
    left.username.localeCompare(right.username, 'es');
}

function compareSearchSuggestions(
  left: InstagramSearchSuggestion,
  right: InstagramSearchSuggestion,
): number {
  const score = { high: 0, medium: 1, low: 2 } as const;
  return score[left.confidence] - score[right.confidence];
}

function buildMetadataMessage(
  accounts: InstagramAccountCandidate[],
  options: InstagramServiceOptions,
  publicOEmbedStatus: PublicOEmbedMetadata['status'],
): string {
  if (accounts.length === 0) {
    return publicOEmbedStatus === 'available'
      ? 'Instagram no ha incluido cuentas utilizables en los metadatos. Escribe el restaurante para buscarlo.'
      : 'Instagram no ha proporcionado un nombre fiable. Escribe el restaurante para buscarlo.';
  }

  const discoveryConfigured = Boolean(
    options.businessDiscoveryAccessToken?.trim() && options.businessAccountId?.trim(),
  );
  if (!discoveryConfigured) {
    return `Instagram ha permitido detectar ${accounts.length} cuenta${accounts.length === 1 ? '' : 's'} como pistas independientes. Business Discovery no está configurado para añadir datos profesionales.`;
  }

  const available = accounts.filter(
    (account) => account.discoveryStatus === 'available',
  ).length;
  if (available === 0) {
    return `Instagram ha permitido detectar ${accounts.length} cuenta${accounts.length === 1 ? '' : 's'}. Business Discovery no ha podido añadir perfiles profesionales, pero las pistas detectadas siguen disponibles.`;
  }
  return `Instagram ha permitido detectar ${accounts.length} cuenta${accounts.length === 1 ? '' : 's'} y Business Discovery ha enriquecido ${available} con datos profesionales.`;
}

function normalizeOptionalCaption(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\r\n?/gu, '\n').trim();
  return normalized ? normalized.slice(0, 5_000) : undefined;
}

function extractInstagramMentions(value: string | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const usernames: string[] = [];
  for (const match of value.matchAll(
    /(?:^|[^\p{L}\p{N}._%+-])@([A-Za-z0-9._]{1,30})(?![A-Za-z0-9._])/gu,
  )) {
    const username = normalizeInstagramUsername(match[1]);
    if (!username) continue;
    const key = username.toLocaleLowerCase('en');
    if (seen.has(key)) continue;
    seen.add(key);
    usernames.push(username);
    if (usernames.length >= 12) break;
  }
  return usernames;
}

function normalizeOptionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\s+/gu, ' ').trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function normalizeOptionalHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function toNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : undefined;
}

function normalizeForMatching(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('es');
}

function compactPresentFields(
  values: Record<string, unknown>,
): string[] {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key]) => key);
}

function normalizeGraphApiVersion(value?: string): string {
  const candidate = value?.trim() || DEFAULT_GRAPH_API_VERSION;
  return /^v\d{1,2}\.\d$/u.test(candidate) ? candidate : DEFAULT_GRAPH_API_VERSION;
}

function clampTimeout(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TIMEOUT_MS;
  return Math.min(20_000, Math.max(1_000, Math.round(value)));
}

function toFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'");
}
