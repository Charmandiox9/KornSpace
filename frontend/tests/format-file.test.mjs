import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatFileSize } from '../.test-dist/lib/format-file-size.js';
import { formatFileDate } from '../.test-dist/lib/format-file-date.js';
import { toUserMessage, UserFacingError } from '../.test-dist/lib/user-facing-error.js';

describe('formatFileSize', () => {
  it('scales through GB with locale separators', () => {
    assert.equal(formatFileSize(0, 'en-US'), '0 B');
    assert.equal(formatFileSize(1536, 'en-US'), '1.5 KB');
    assert.equal(formatFileSize(5 * 1024 ** 3, 'en-US'), '5 GB');
    assert.equal(formatFileSize(1536, 'es-CL'), '1,5 KB');
  });
  it('does not render invalid sizes', () => {
    assert.equal(formatFileSize(-1), '—');
    assert.equal(formatFileSize(Number.NaN), '—');
  });
});

describe('formatFileDate', () => {
  it('formats valid dates and survives invalid ones', () => {
    assert.match(formatFileDate('2026-01-15T12:00:00Z', 'en_US'), /2026/);
    assert.equal(formatFileDate('not-a-date', 'es_CL'), '—');
    assert.equal(formatFileDate(undefined, 'es_CL'), '—');
  });
});

describe('toUserMessage', () => {
  it('never leaks technical error text', () => {
    assert.equal(toUserMessage(new UserFacingError('Nombre en uso'), 'fallback', 'red'), 'Nombre en uso');
    assert.equal(toUserMessage(new TypeError('Failed to fetch'), 'fallback', 'red'), 'red');
    assert.equal(toUserMessage(new SyntaxError('Unexpected token <'), 'fallback', 'red'), 'fallback');
  });
});
