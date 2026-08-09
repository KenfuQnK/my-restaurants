import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  ExternalPlace,
  ImportSource,
  InstagramPublication,
} from '../types/restaurant';
import { createManualContent, upsertRestaurant } from './restaurantCollection';

const place: ExternalPlace = {
  placeId: 'place-1',
  name: 'Casa de prueba',
  types: ['restaurant'],
  photos: [],
  openingHours: [],
};

const source: ImportSource = {
  kind: 'instagram',
  originalInput: 'contenido compartido',
  url: 'https://www.instagram.com/p/POSTUNO/',
  importedAt: '2026-07-31T10:00:00.000Z',
};

const firstPublication: InstagramPublication = {
  id: 'publication-1',
  originalUrl: 'https://www.instagram.com/p/POSTUNO/?igsh=abc',
  normalizedUrl: 'https://www.instagram.com/p/POSTUNO/',
  shortcode: 'POSTUNO',
  publicationType: 'post',
  createdAt: '2026-07-31T10:00:00.000Z',
};

const secondPublication: InstagramPublication = {
  id: 'publication-2',
  originalUrl: 'https://www.instagram.com/reel/REELDOS/',
  normalizedUrl: 'https://www.instagram.com/reel/REELDOS/',
  shortcode: 'REELDOS',
  publicationType: 'reel',
  createdAt: '2026-07-31T11:00:00.000Z',
};

test('asocia varias publicaciones al mismo restaurante sin duplicarlo', () => {
  const first = upsertRestaurant([], place, source, firstPublication, {
    now: '2026-07-31T10:00:00.000Z',
    createId: () => 'restaurant-1',
  });
  const second = upsertRestaurant(
    first.restaurants,
    place,
    {
      ...source,
      url: secondPublication.originalUrl,
      importedAt: secondPublication.createdAt,
    },
    secondPublication,
    { now: '2026-07-31T11:00:00.000Z' },
  );

  assert.equal(second.restaurants.length, 1);
  assert.equal(second.restaurant.instagramPublications.length, 2);
  assert.deepEqual(
    second.restaurant.instagramPublications.map((item) => item.normalizedUrl),
    [firstPublication.normalizedUrl, secondPublication.normalizedUrl],
  );
  assert.equal(second.publicationAdded, true);
});

test('no duplica una publicación ya asociada y refresca el embed', () => {
  const first = upsertRestaurant([], place, source, firstPublication, {
    createId: () => 'restaurant-1',
  });
  const duplicate = upsertRestaurant(
    first.restaurants,
    place,
    source,
    {
      ...firstPublication,
      id: 'otro-id',
      embedHtml:
        '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/POSTUNO/"></blockquote>',
    },
  );

  assert.equal(duplicate.restaurant.instagramPublications.length, 1);
  assert.equal(duplicate.publicationAdded, false);
  assert.ok(duplicate.restaurant.instagramPublications[0].embedHtml);
  assert.equal(duplicate.restaurant.instagramPublications[0].id, 'publication-1');
});

test('crea contenido manual sin exigir una ubicación', () => {
  const item = createManualContent(
    {
      title: 'Receta de focaccia',
      categoryIds: ['places', 'other'],
      labelIds: ['label-recetas'],
    },
    { createId: () => 'content-1', now: '2026-08-09T10:00:00.000Z' },
  );

  assert.deepEqual(item.categoryIds, ['places', 'other']);
  assert.equal(item.external.name, 'Receta de focaccia');
  assert.equal(item.external.latitude, undefined);
  assert.deepEqual(item.personal.labelIds, ['label-recetas']);
});

test('no sobreescribe la organización personal de un lugar existente', () => {
  const first = upsertRestaurant([], place, source, undefined, {
    categoryIds: ['hospitality', 'places'],
    labelIds: ['label-propio'],
    createId: () => 'restaurant-1',
  });
  first.restaurant.personal.notes = 'Pedir mesa de la ventana';
  first.restaurant.personal.tags = ['aniversario'];

  const repeated = upsertRestaurant(first.restaurants, place, source, firstPublication, {
    categoryIds: ['other'],
    labelIds: [],
  });

  assert.deepEqual(repeated.restaurant.categoryIds, ['hospitality', 'places']);
  assert.deepEqual(repeated.restaurant.personal.labelIds, ['label-propio']);
  assert.equal(repeated.restaurant.personal.notes, 'Pedir mesa de la ventana');
  assert.deepEqual(repeated.restaurant.personal.tags, ['aniversario']);
});
