import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSharedInput } from './importResolver.js';

test('usa texto libre como consulta', async () => {
  const result = await resolveSharedInput('ramen en Barcelona');
  assert.equal(result.source, 'plain_text');
  assert.equal(result.query, 'ramen en Barcelona');
});

test('extrae el usuario de un perfil de Instagram', async () => {
  const result = await resolveSharedInput('https://www.instagram.com/oculto_restaurante/');
  assert.equal(result.source, 'instagram');
  assert.equal(result.username, 'oculto_restaurante');
  assert.equal(result.query, 'oculto restaurante');
  assert.equal(result.finalUrl, 'https://www.instagram.com/oculto_restaurante/');
});

test('no inventa un restaurante desde una URL de Reel aislada', async () => {
  const result = await resolveSharedInput('https://www.instagram.com/reel/ABC123/');
  assert.equal(result.source, 'instagram');
  assert.equal(result.query, undefined);
});

test('usa el texto compartido junto a un Reel', async () => {
  const result = await resolveSharedInput(
    'Oculto Restaurante Nerja https://www.instagram.com/reel/ABC123/',
  );
  assert.equal(result.query, 'Oculto Restaurante Nerja');
});

test('extrae Instagram aunque antes aparezca una URL ajena', async () => {
  const result = await resolveSharedInput(
    'https://example.com consulta https://www.instagram.com/p/ABC123/',
  );
  assert.equal(result.source, 'instagram');
  assert.equal(result.finalUrl, 'https://www.instagram.com/p/ABC123/');
});

test('rechaza dominios falsos que contienen Instagram', async () => {
  await assert.rejects(
    resolveSharedInput('https://instagram.com.ejemplo.test/reel/ABC123/'),
    /no pertenece a instagram\.com/i,
  );
});

test('extrae nombre y coordenadas de un enlace completo de Google Maps', async () => {
  const result = await resolveSharedInput(
    'https://www.google.com/maps/place/Oculto+Restaurante+Nerja/@36.752,-3.876,17z',
  );
  assert.equal(result.source, 'google_maps');
  assert.equal(result.query, 'Oculto Restaurante Nerja');
  assert.deepEqual(result.coordinates, { latitude: 36.752, longitude: -3.876 });
});

test('extrae el parámetro q de Google Maps', async () => {
  const result = await resolveSharedInput('https://www.google.com/maps?q=Casa+Pepa+Barcelona');
  assert.equal(result.query, 'Casa Pepa Barcelona');
});
