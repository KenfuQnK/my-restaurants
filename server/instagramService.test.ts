import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildInstagramSearchQuery,
  buildInstagramSearchSuggestions,
  extractInstagramAccountCandidates,
  extractFirstInstagramUrl,
  InstagramUrlError,
  instagramUsernameToPlaceQuery,
  normalizeOEmbedPayload,
  parseInstagramUrl,
  resolveInstagramPublication,
} from './instagramService.js';

test('extrae la primera URL válida de Instagram aunque haya otro enlace antes', () => {
  const parsed = extractFirstInstagramUrl(
    'Más info https://example.com y el Reel https://instagram.com/reel/AbC_123/?igsh=abc',
  );
  assert.equal(parsed.originalUrl, 'https://instagram.com/reel/AbC_123/?igsh=abc');
  assert.equal(parsed.normalizedUrl, 'https://www.instagram.com/reel/AbC_123/');
});

test('normaliza publicaciones y elimina parámetros igsh', () => {
  const parsed = parseInstagramUrl(
    'https://www.instagram.com/p/Codigo-123/?igsh=MXFvbGEx#fragmento',
  );
  assert.equal(parsed.normalizedUrl, 'https://www.instagram.com/p/Codigo-123/');
  assert.equal(parsed.shortcode, 'Codigo-123');
  assert.equal(parsed.publicationType, 'post');
});

test('detecta y normaliza Reels', () => {
  const parsed = parseInstagramUrl('https://instagram.com/reel/XXXXXXXX/');
  assert.equal(parsed.normalizedUrl, 'https://www.instagram.com/reel/XXXXXXXX/');
  assert.equal(parsed.publicationType, 'reel');
});

test('rechaza dominios falsos que contienen la palabra Instagram', () => {
  assert.throws(
    () => extractFirstInstagramUrl('https://instagram.com.ejemplo.com/reel/ABC123/'),
    (error: unknown) =>
      error instanceof InstagramUrlError && error.code === 'invalid_domain',
  );
});

test('rechaza rutas no compatibles como Stories', () => {
  assert.throws(
    () => parseInstagramUrl('https://www.instagram.com/stories/alguien/123/'),
    (error: unknown) =>
      error instanceof InstagramUrlError && error.code === 'unsupported_path',
  );
});

test('convierte un usuario de Instagram en una consulta conservadora', () => {
  assert.equal(
    instagramUsernameToPlaceQuery('restaurantelapepa'),
    'restaurante la pepa',
  );
  assert.equal(instagramUsernameToPlaceQuery('@casa_paco'), 'casa paco');
  assert.equal(instagramUsernameToPlaceQuery('@hugosgaminglounge'), 'hugos gaming lounge');
});

test('detecta varias cuentas reales en texto compartido y URLs de perfil', () => {
  const input = [
    '@placesandfoodie recomienda @hugosgaminglounge',
    'https://www.instagram.com/reel/DWeXll5DIsy/',
    'https://instagram.com/hugosgaminglounge/?igsh=abc',
  ].join(' ');
  const parsed = extractFirstInstagramUrl(input);
  const accounts = extractInstagramAccountCandidates(input, parsed);

  assert.deepEqual(
    accounts.map((account) => account.username),
    ['hugosgaminglounge', 'placesandfoodie'],
  );
  assert.deepEqual(accounts[0].sources, ['profile_url', 'shared_text']);
  assert.equal(buildInstagramSearchQuery(input, parsed).query, undefined);
});

test('conserva todas las cuentas mencionadas aunque sean más de ocho', () => {
  const mentions = Array.from(
    { length: 12 },
    (_, index) => `@cuenta_${index + 1}`,
  ).join(' ');
  const parsed = parseInstagramUrl('https://www.instagram.com/reel/ABC123/');
  const accounts = extractInstagramAccountCandidates(mentions, parsed);

  assert.equal(accounts.length, 12);
  assert.ok(accounts.some((account) => account.username === 'cuenta_12'));
});

test('genera sugerencias separadas y rebaja cuentas con señales de creador', () => {
  const parsed = parseInstagramUrl('https://www.instagram.com/reel/DWeXll5DIsy/');
  const suggestions = buildInstagramSearchSuggestions('', parsed, [
    {
      username: 'placesandfoodie',
      profileUrl: 'https://www.instagram.com/placesandfoodie/',
      sources: ['shared_text'],
      displayName: 'Places and Foodie',
      biography: 'Creator de planes y recomendaciones',
      relevance: 'likely_creator',
      discoveryStatus: 'available',
    },
    {
      username: 'hugosgaminglounge',
      profileUrl: 'https://www.instagram.com/hugosgaminglounge/',
      sources: ['shared_text'],
      displayName: "Hugo's Gaming Lounge",
      biography: 'Diner y burgers en Barcelona',
      relevance: 'likely_restaurant',
      discoveryStatus: 'available',
    },
  ]);

  assert.equal(suggestions[0].query, "Hugo's Gaming Lounge");
  assert.equal(suggestions[0].confidence, 'high');
  assert.equal(suggestions.at(-1)?.username, 'placesandfoodie');
  assert.equal(suggestions.at(-1)?.confidence, 'low');
});

test('usa el perfil real facilitado como pista sin inventar metadatos', () => {
  const parsed = extractFirstInstagramUrl(
    'https://www.instagram.com/mintgranollers?igsh=MXVhZWNoNWwzbjhrZg==',
  );
  const search = buildInstagramSearchQuery(parsed.originalUrl, parsed);
  assert.equal(parsed.normalizedUrl, 'https://www.instagram.com/mintgranollers/');
  assert.equal(parsed.publicationType, 'unknown');
  assert.equal(search.query, 'mint granollers');
  assert.equal(search.source, 'profile_username');
});

test('una respuesta oEmbed incompleta produce un fallback recuperable', () => {
  const result = normalizeOEmbedPayload(
    { version: '1.0', provider_name: 'Instagram' },
    'https://www.instagram.com/p/ABC123/',
  );
  assert.equal(result.embedStatus, 'unavailable');
  assert.equal(result.embedHtml, undefined);
  assert.equal(result.authorName, undefined);
});

test('acepta HTML oficial sin script y tolera ausencia de autor', () => {
  const result = normalizeOEmbedPayload(
    {
      version: '1.0',
      provider_name: 'Instagram',
      html: '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/ABC123/?utm_source=ig_embed"></blockquote>',
    },
    'https://www.instagram.com/p/ABC123/',
  );
  assert.equal(result.embedStatus, 'available');
  assert.ok(result.embedHtml);
  assert.equal(result.authorName, undefined);
});

test('rechaza HTML oEmbed que incluya scripts', () => {
  const result = normalizeOEmbedPayload(
    {
      html: '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/ABC123/"></blockquote><script>alert(1)</script>',
    },
    'https://www.instagram.com/p/ABC123/',
  );
  assert.equal(result.embedStatus, 'unavailable');
  assert.equal(result.embedHtml, undefined);
});

test('publicaciones privadas o eliminadas conservan la URL y permiten continuar', async () => {
  const result = await resolveInstagramPublication(
    'https://www.instagram.com/reel/ABC123/',
    {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            error: {
              message: 'Invalid parameter',
              code: 100,
              error_subcode: 2_207_047,
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      createId: () => 'publication-id',
      now: () => '2026-07-31T10:00:00.000Z',
    },
  );

  assert.equal(result.embedStatus, 'unavailable');
  assert.equal(result.publication.id, 'publication-id');
  assert.equal(
    result.publication.normalizedUrl,
    'https://www.instagram.com/reel/ABC123/',
  );
  assert.equal(result.publication.embedHtml, undefined);
});

test('el token de Meta se envía solo en la cabecera de la llamada del backend', async () => {
  let receivedUrl = '';
  let receivedAuthorization = '';

  await resolveInstagramPublication('https://www.instagram.com/p/ABC123/', {
    accessToken: 'token-privado',
    publicOEmbedEnabled: false,
    fetchImpl: async (input, init) => {
      receivedUrl = String(input);
      receivedAuthorization = new Headers(init?.headers).get('Authorization') ?? '';
      return new Response(
        JSON.stringify({
          html: '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/ABC123/"></blockquote>',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    },
  });

  assert.equal(receivedAuthorization, 'Bearer token-privado');
  assert.equal(receivedUrl.includes('token-privado'), false);
});

test('Business Discovery enriquece varias cuentas sin exponer el token en la URL', async () => {
  const requestedUsernames: string[] = [];
  const authorizations: string[] = [];

  const result = await resolveInstagramPublication(
    '@placesandfoodie @hugosgaminglounge https://www.instagram.com/reel/DWeXll5DIsy/',
    {
      businessAccountId: '17841405309211844',
      businessDiscoveryAccessToken: 'token-business-privado',
      publicOEmbedEnabled: false,
      fetchImpl: async (input, init) => {
        const url = new URL(String(input));
        authorizations.push(new Headers(init?.headers).get('Authorization') ?? '');
        assert.equal(url.toString().includes('token-business-privado'), false);

        if (url.pathname.endsWith('/instagram_oembed')) {
          return new Response(
            JSON.stringify({
              html: '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/reel/DWeXll5DIsy/"></blockquote>',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        const fields = url.searchParams.get('fields') ?? '';
        const username = fields.includes('hugosgaminglounge')
          ? 'hugosgaminglounge'
          : 'placesandfoodie';
        requestedUsernames.push(username);
        return new Response(
          JSON.stringify({
            business_discovery: {
              username,
              name:
                username === 'hugosgaminglounge'
                  ? "Hugo's Gaming Lounge"
                  : 'Places and Foodie',
              biography:
                username === 'hugosgaminglounge'
                  ? 'Diner, burgers y reservas en Barcelona'
                  : 'Creator de planes y recomendaciones',
              followers_count: 1200,
              media_count: 80,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    },
  );

  assert.deepEqual(requestedUsernames.sort(), [
    'hugosgaminglounge',
    'placesandfoodie',
  ]);
  assert.equal(
    authorizations.filter((value) => value === 'Bearer token-business-privado').length,
    2,
  );
  assert.equal(result.accounts.length, 2);
  assert.equal(result.accounts[0].discoveryStatus, 'available');
  assert.equal(result.suggestedQuery, "Hugo's Gaming Lounge");
});

test('el Reel real detecta autor y restaurante colaborador desde JSON oEmbed', async () => {
  const result = await resolveInstagramPublication(
    'https://www.instagram.com/reel/DWeXll5DIsy/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==',
    {
      fetchImpl: async (input) => {
        const url = new URL(String(input));
        if (url.hostname === 'www.instagram.com') {
          return new Response(
            JSON.stringify({
              provider_name: 'Instagram',
              author_name: 'placesandfoodie',
              author_url: 'https://www.instagram.com/placesandfoodie',
              title:
                'En Hugo’s Diner podés venir y activar el modo gamer. Reservas y más información en @hugosgaminglounge',
              thumbnail_url: 'https://scontent.cdninstagram.com/temporal.jpg',
              html: '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/reel/DWeXll5DIsy/"></blockquote>',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            html: '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/reel/DWeXll5DIsy/"></blockquote>',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
      createId: () => 'real-reel',
      now: () => '2026-07-31T12:00:00.000Z',
    },
  );

  assert.equal(result.publication.normalizedUrl, 'https://www.instagram.com/reel/DWeXll5DIsy/');
  assert.equal(result.publication.authorName, 'placesandfoodie');
  assert.match(result.publication.caption ?? '', /Hugo’s Diner/u);
  assert.equal(result.publication.thumbnailUrl, undefined);
  assert.deepEqual(
    result.accounts.map((account) => account.username).sort(),
    ['hugosgaminglounge', 'placesandfoodie'],
  );
  assert.equal(
    result.accounts.find((account) => account.username === 'hugosgaminglounge')?.relevance,
    'likely_restaurant',
  );
  assert.equal(
    result.accounts.find((account) => account.username === 'placesandfoodie')?.relevance,
    'likely_creator',
  );
  assert.equal(result.suggestedQuery, 'hugos gaming lounge');
  assert.equal(result.embedStatus, 'available');
});

test('extrae autores y colaboradores múltiples de los campos estructurados de oEmbed', async () => {
  const result = await resolveInstagramPublication(
    'https://www.instagram.com/reel/COLLAB123/',
    {
      fetchImpl: async (input) => {
        const url = new URL(String(input));
        if (url.hostname === 'www.instagram.com') {
          return new Response(
            JSON.stringify({
              provider_name: 'Instagram',
              author_name: 'cuenta_autora, restaurante_colaborador',
              author_url: 'https://www.instagram.com/cuenta_autora',
              collaborators: [
                { username: 'restaurante_colaborador' },
                { user: { username: 'tercera_cuenta' } },
              ],
              coauthor_producers: [{ username: 'cuarta_cuenta' }],
              title: 'Con @quinta_cuenta',
              html: '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/reel/COLLAB123/"></blockquote>',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            html: '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/reel/COLLAB123/"></blockquote>',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    },
  );

  assert.deepEqual(
    result.accounts.map((account) => account.username).sort(),
    [
      'cuarta_cuenta',
      'cuenta_autora',
      'quinta_cuenta',
      'restaurante_colaborador',
      'tercera_cuenta',
    ],
  );
  assert.equal(result.searchSuggestions.length, 5);
});

test('un fallo del enriquecimiento JSON conserva el fallback de Graph oEmbed', async () => {
  const result = await resolveInstagramPublication(
    'https://www.instagram.com/reel/ABC123/',
    {
      fetchImpl: async (input) => {
        const url = new URL(String(input));
        if (url.hostname === 'www.instagram.com') {
          return new Response(JSON.stringify({ message: 'not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({
            html: '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/reel/ABC123/"></blockquote>',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    },
  );

  assert.equal(result.embedStatus, 'available');
  assert.ok(result.publication.embedHtml);
  assert.equal(result.accounts.length, 0);
  assert.equal(result.suggestedQuery, undefined);
});
