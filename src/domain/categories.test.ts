import assert from 'node:assert/strict';
import test from 'node:test';
import { detectCategory } from './categories';

test('detecta hostelería y estancias a partir de tipos de Google Places', () => {
  assert.equal(
    detectCategory({
      place: {
        placeId: 'restaurant-1',
        name: 'Casa Retiva',
        types: ['mediterranean_restaurant', 'restaurant'],
        photos: [],
        openingHours: [],
      },
    }).categoryId,
    'hospitality',
  );

  assert.equal(
    detectCategory({
      place: {
        placeId: 'hotel-1',
        name: 'Hotel Retiva',
        types: ['hotel', 'lodging'],
        photos: [],
        openingHours: [],
      },
    }).categoryId,
    'stays',
  );
});

test('detecta lugares y contenido sin ubicación por su texto', () => {
  assert.equal(detectCategory({ text: 'Una playa secreta con un mirador precioso' }).categoryId, 'places');
  assert.equal(detectCategory({ text: 'Receta fácil con todos los ingredientes' }).categoryId, 'other');
});

test('reconoce perfiles de restauración en español e inglés', () => {
  for (const text of [
    'MINT · Restaurant',
    'Mediterranean restaurants in Granollers',
    'Cocina de mercado · reservas abiertas',
    'American diner & burgers',
  ]) {
    assert.equal(detectCategory({ text }).categoryId, 'hospitality');
  }
});

test('no confunde comercios ni tiendas de alimentación con hostelería', () => {
  for (const place of [
    {
      placeId: 'shop-1',
      name: 'Taller de cerámica',
      primaryTypeLabel: 'Comercio',
      types: ['store', 'point_of_interest'],
      photos: [],
      openingHours: [],
      latitude: 41.4,
      longitude: 2.1,
    },
    {
      placeId: 'market-1',
      name: 'Supermercado',
      types: ['supermarket', 'food_store', 'food'],
      photos: [],
      openingHours: [],
      latitude: 41.4,
      longitude: 2.1,
    },
  ]) {
    assert.equal(detectCategory({ place }).categoryId, 'places');
  }
});
