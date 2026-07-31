import assert from 'node:assert/strict';
import test from 'node:test';
import { isSharedLinkInput } from './SearchPanel.js';

test('distingue una búsqueda escrita de un enlace compartido', () => {
  assert.equal(isSharedLinkInput('pizza en Barcelona'), false);
  assert.equal(isSharedLinkInput('https://www.instagram.com/reel/DWeXll5DIsy/'), true);
  assert.equal(isSharedLinkInput('http://maps.google.com/?q=restaurante'), true);
  assert.equal(isSharedLinkInput('www.instagram.com/p/ABC123/'), true);
});
