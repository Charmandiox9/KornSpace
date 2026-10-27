import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getInitialLanguage,
  getInitialTheme,
  getNextLanguage,
  getNextTheme,
  translations,
} from '../.test-dist/i18n.js';

describe('language preference', () => {
  it('uses a saved supported language before the browser language', () => {
    assert.equal(getInitialLanguage('es', 'en-US'), 'es');
    assert.equal(getInitialLanguage('en', 'es-CL'), 'en');
  });

  it('uses English for English browsers and Spanish as the fallback', () => {
    assert.equal(getInitialLanguage(null, 'en-US'), 'en');
    assert.equal(getInitialLanguage(null, 'es-CL'), 'es');
    assert.equal(getInitialLanguage('fr', 'fr-FR'), 'es');
  });

  it('switches between the supported languages', () => {
    assert.equal(getNextLanguage('es'), 'en');
    assert.equal(getNextLanguage('en'), 'es');
  });
});

describe('theme preference', () => {
  it('uses a saved supported theme before the operating system preference', () => {
    assert.equal(getInitialTheme('light', true), 'light');
    assert.equal(getInitialTheme('dark', false), 'dark');
  });

  it('follows the operating system when no supported theme is saved', () => {
    assert.equal(getInitialTheme(null, true), 'dark');
    assert.equal(getInitialTheme(null, false), 'light');
    assert.equal(getInitialTheme('system', true), 'dark');
  });

  it('switches between light and dark themes', () => {
    assert.equal(getNextTheme('light'), 'dark');
    assert.equal(getNextTheme('dark'), 'light');
  });
});

describe('translation catalogs', () => {
  it('defines the same translation keys in Spanish and English', () => {
    assert.deepEqual(
      Object.keys(translations.es).sort(),
      Object.keys(translations.en).sort(),
    );
  });
});
