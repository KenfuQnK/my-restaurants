import assert from 'node:assert/strict';
import test from 'node:test';
import type { SavedRestaurant } from '../types/restaurant';
import { loadRestaurants, parseStoredRestaurants, saveRestaurants } from './storage';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const restaurant: SavedRestaurant = {
  id: 'restaurant-1',
  placeId: 'place-1',
  external: {
    placeId: 'place-1',
    name: 'Casa de prueba',
    types: ['restaurant'],
    photos: [],
    openingHours: [],
  },
  personal: {
    notes: '',
    tags: [],
    favorite: false,
  },
  sources: [
    {
      kind: 'instagram',
      url: 'https://www.instagram.com/p/POSTUNO/',
      importedAt: '2026-07-31T10:00:00.000Z',
    },
  ],
  instagramPublications: [
    {
      id: 'publication-1',
      originalUrl: 'https://www.instagram.com/p/POSTUNO/?igsh=abc',
      normalizedUrl: 'https://www.instagram.com/p/POSTUNO/',
      publicationType: 'post',
      createdAt: '2026-07-31T10:00:00.000Z',
    },
    {
      id: 'publication-2',
      originalUrl: 'https://www.instagram.com/reel/REELDOS/',
      normalizedUrl: 'https://www.instagram.com/reel/REELDOS/',
      publicationType: 'reel',
      createdAt: '2026-07-31T11:00:00.000Z',
    },
  ],
  createdAt: '2026-07-31T10:00:00.000Z',
  updatedAt: '2026-07-31T11:00:00.000Z',
};

test('persiste y recupera varias publicaciones de Instagram', () => {
  const storage = new MemoryStorage();
  saveRestaurants([restaurant], storage);
  const recovered = loadRestaurants(storage);

  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].instagramPublications.length, 2);
  assert.equal(
    recovered[0].instagramPublications[1].normalizedUrl,
    'https://www.instagram.com/reel/REELDOS/',
  );
});

test('migra restaurantes existentes que aún no tienen publicaciones', () => {
  const legacy = { ...restaurant } as Partial<SavedRestaurant>;
  delete legacy.instagramPublications;
  const recovered = parseStoredRestaurants(JSON.stringify([legacy]));

  assert.equal(recovered.length, 1);
  assert.deepEqual(recovered[0].instagramPublications, []);
});

test('descarta URLs de publicaciones manipuladas al recuperar datos', () => {
  const manipulated = {
    ...restaurant,
    instagramPublications: [
      {
        ...restaurant.instagramPublications[0],
        normalizedUrl: 'https://instagram.com.ejemplo.test/p/POSTUNO/',
      },
    ],
  };
  const recovered = parseStoredRestaurants(JSON.stringify([manipulated]));

  assert.equal(recovered.length, 1);
  assert.deepEqual(recovered[0].instagramPublications, []);
});

test('no recupera miniaturas temporales de CDN', () => {
  const withThumbnail = {
    ...restaurant,
    instagramPublications: [
      {
        ...restaurant.instagramPublications[0],
        thumbnailUrl: 'https://scontent.cdninstagram.com/temporal.jpg',
      },
    ],
  };
  const recovered = parseStoredRestaurants(JSON.stringify([withThumbnail]));

  assert.equal(recovered[0].instagramPublications[0].thumbnailUrl, undefined);
});
