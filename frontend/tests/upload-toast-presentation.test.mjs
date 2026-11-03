import assert from 'node:assert/strict';
import { test } from 'node:test';
import { translations } from '../.test-dist/i18n/index.js';
import { getUploadToastPresentation } from '../.test-dist/features/files/upload-toast-presentation.js';

const base = { id: '1', name: 'file.txt', sizeBytes: 7, loadedBytes: 0, completionWon: false, error: null };

test('keeps active and unconfirmed notifications persistent with the correct action', () => {
  for (const [status, action] of [['queued', 'cancel'], ['uploading', 'cancel'], ['confirming', 'cancel'], ['cancelling', null], ['cancelFailed', 'check']]) {
    const presentation = getUploadToastPresentation({ ...base, status }, translations.es);
    assert.equal(presentation.duration, null);
    assert.equal(presentation.action, action);
    assert.notEqual(presentation.type, 'success');
  }
});

test('does not announce completion at 100% until storage is confirmed', () => {
  const presentation = getUploadToastPresentation({ ...base, status: 'confirming', loadedBytes: 7 }, translations.es);
  assert.equal(presentation.title, translations.es.uploadToastConfirming);
  assert.notEqual(presentation.title, translations.es.uploadToastCompleted);
});

test('announces upload completion while preserving the separate processing message', () => {
  for (const language of ['es', 'en']) {
    for (const status of ['uploaded', 'processing']) {
      const copy = translations[language];
      const presentation = getUploadToastPresentation({ ...base, status, loadedBytes: 7 }, copy);
      assert.equal(presentation.type, 'success');
      assert.equal(presentation.title, copy.uploadToastCompleted);
      assert.equal(presentation.message, status === 'processing' ? copy.uploadQueued : copy.uploadSuccess);
      assert.equal(presentation.duration, 7000);
      assert.equal(presentation.action, null);
      assert.equal(presentation.showProgress, false);
    }
  }
});

test('retains validation errors and cancellation outcomes without losing retry controls', () => {
  assert.equal(getUploadToastPresentation({ ...base, status: 'invalid', error: 'tooLarge' }, translations.es).message, translations.es.fileLimit);
  assert.equal(getUploadToastPresentation({ ...base, status: 'invalid', error: 'empty' }, translations.es).showProgress, false);
  for (const status of ['failed', 'cancelled']) {
    assert.equal(getUploadToastPresentation({ ...base, status }, translations.es).action, 'retry');
  }
  assert.equal(getUploadToastPresentation({ ...base, status: 'uploaded', completionWon: true }, translations.es).message, translations.es.uploadCompletionWon);
});
