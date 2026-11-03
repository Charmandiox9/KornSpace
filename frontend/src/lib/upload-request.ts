import type { ProgressListener } from '../types';

export function createUploadTransport(onProgress: ProgressListener, createRequest: () => XMLHttpRequest = () => new XMLHttpRequest()) {
  return (url: string, options: RequestInit): Promise<Response> => new Promise((resolve, reject) => {
    const body = options.body;
    if (!(body instanceof Blob)) {
      reject(new TypeError('Upload body must be a Blob'));
      return;
    }
    if (options.signal?.aborted) {
      reject(new DOMException('Upload aborted', 'AbortError'));
      return;
    }
    const request = createRequest();
    let settled = false;
    function finish(action: () => void): void {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener('abort', abort);
      action();
    }
    function abort(): void {
      request.abort();
      finish(() => reject(new DOMException('Upload aborted', 'AbortError')));
    }
    request.open(options.method ?? 'POST', url, true);
    request.withCredentials = true;
    new Headers(options.headers).forEach((value, name) => request.setRequestHeader(name, value));
    request.upload.addEventListener('progress', (event) => {
      if (!settled && event.lengthComputable) {
        onProgress({ loadedBytes: Math.min(event.loaded, body.size), totalBytes: body.size });
      }
    });
    request.upload.addEventListener('load', () => {
      if (!settled) onProgress({ loadedBytes: body.size, totalBytes: body.size });
    });
    request.addEventListener('load', () => finish(() => {
      if (request.status === 0) {
        reject(new TypeError('Upload connection closed'));
        return;
      }
      try {
        resolve(new Response([204, 205, 304].includes(request.status) ? null : request.responseText, {
          status: request.status,
          headers: { 'Content-Type': request.getResponseHeader('Content-Type') ?? 'application/json' },
        }));
      } catch (error: unknown) { reject(error); }
    }));
    request.addEventListener('error', () => finish(() => reject(new TypeError('Upload connection failed'))));
    request.addEventListener('timeout', () => finish(() => reject(new TypeError('Upload timed out'))));
    request.addEventListener('abort', () => finish(() => reject(new DOMException('Upload aborted', 'AbortError'))));
    options.signal?.addEventListener('abort', abort, { once: true });
    try {
      onProgress({ loadedBytes: 0, totalBytes: body.size });
      if (!settled) request.send(body);
    } catch (error: unknown) {
      finish(() => reject(error));
    }
  });
}
