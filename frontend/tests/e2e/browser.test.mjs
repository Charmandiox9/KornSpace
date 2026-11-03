import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { createServer } from 'node:http';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(check, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if (await check()) return; } catch { /* Navigation can replace the execution context. */ }
    await delay(50);
  }
  throw new Error(`Timed out: ${label}`);
}

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function connectDebugger(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const handlers = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request?.reject(new Error(message.error.message));
      else request?.resolve(message.result);
    } else {
      handlers.get(message.method)?.(message.params);
    }
  });
  socket.addEventListener('close', () => {
    pending.forEach(({ reject }) => reject(new Error('Browser debugger closed')));
    pending.clear();
  });
  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const requestId = ++id;
        pending.set(requestId, { resolve, reject });
        socket.send(JSON.stringify({ id: requestId, method, params }));
      });
    },
    on(method, handler) { handlers.set(method, handler); },
    close() { socket.close(); },
  };
}

test('session navigation and multiple uploads in a real browser with a simulated API', { timeout: 120000 }, async (t) => {
  const executable = process.env.BROWSER_EXECUTABLE ?? [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/chromium', '/usr/bin/google-chrome',
  ].find(existsSync);
  assert.ok(executable, 'Set BROWSER_EXECUTABLE to an installed Chromium browser');
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'kornspace-browser-e2e-'));
  const port = await unusedPort();
  const origin = `http://127.0.0.1:${port}`;
  const require = createRequire(import.meta.url);
  const app = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: path.resolve(import.meta.dirname, '../..'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let appOutput = '';
  const capture = (chunk) => { appOutput = (appOutput + chunk.toString()).slice(-4000); };
  app.stdout.on('data', capture);
  app.stderr.on('data', capture);
  let browser;
  let debuggerClient;
  let uploadServer;
  try {
    await until(async () => (await fetch(`${origin}/login`)).ok, 'Next server readiness').catch((error) => { throw new Error(`${error.message}\n${appOutput}`); });
    browser = spawn(executable, [
      '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
      '--disable-extensions', '--remote-debugging-port=0', `--user-data-dir=${temporaryDirectory}`, 'about:blank',
    ], { windowsHide: true, stdio: 'ignore' });
    let debugPort;
    await until(async () => {
      debugPort = (await readFile(path.join(temporaryDirectory, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
      return Boolean(debugPort);
    }, 'browser debugger readiness');
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    debuggerClient = await connectDebugger(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
    const cdp = debuggerClient;
    const evaluate = async (expression) => {
      const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    };
    const user = { id: 'test-user', email: 'test@example.test', name: 'Test', username: 'test', pictureUrl: null };
    const records = [];
    const uploads = [];
    const operations = new Map();
    const interceptionErrors = [];
    let sessionChecks = 0;
    let refreshes = 0;
    let listChecks = 0;
    let expired = false;
    uploadServer = createServer((request, response) => {
      const url = new URL(request.url, origin);
      const name = url.searchParams.get('name');
      const operationId = request.headers['x-upload-id'];
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader('Content-Type', 'application/json');
      request.on('aborted', () => operations.set(operationId, { phase: 'cancelled', file: null, asynchronous: false }));
      request.resume();
      request.on('end', () => {
        if (operations.get(operationId)?.phase === 'cancelled') return;
        const file = { id: String(records.length + 1), name, contentType: 'text/plain', sizeBytes: Number(request.headers['content-length']), status: 'AVAILABLE', checksum: null, createdAt: '2026-01-01T00:00:00.000Z' };
        operations.set(operationId, { phase: 'confirming', file: null, asynchronous: false });
        setTimeout(() => {
          records.push(file);
          operations.set(operationId, { phase: 'completed', file, asynchronous: false });
          response.writeHead(201).end(JSON.stringify({ file, asynchronous: false }));
        }, 1000);
      });
    });
    await new Promise((resolve) => uploadServer.listen(0, '127.0.0.1', resolve));
    const uploadOrigin = `http://127.0.0.1:${uploadServer.address().port}`;
    cdp.on('Fetch.requestPaused', (event) => {
      void (async () => {
        const url = new URL(event.request.url);
        let status = 200;
        let body = {};
        if (url.pathname === '/api/auth/me') { sessionChecks += 1; body = user; }
        else if (url.pathname === '/api/auth/refresh') { refreshes += 1; status = 401; }
        else if (expired) status = 401;
        else if (url.pathname.startsWith('/api/files/uploads/')) {
          const id = url.pathname.split('/').at(-1);
          const current = operations.get(id);
          if (event.request.method === 'DELETE' && (!current || current.phase === 'uploading')) {
            operations.set(id, { phase: 'cancelled', file: null, asynchronous: false });
          }
          body = operations.get(id) ?? { phase: 'failed', file: null, asynchronous: false };
        }
        else if (event.request.method === 'POST') {
          const name = url.searchParams.get('name');
          const operationId = Object.entries(event.request.headers).find(([key]) => key.toLowerCase() === 'x-upload-id')?.[1];
          uploads.push(name);
          if (['progress.txt', 'cancel-me.txt'].includes(name) || name.startsWith('toast-')) {
            operations.set(operationId, { phase: 'uploading', file: null, asynchronous: false });
            await cdp.send('Fetch.continueRequest', { requestId: event.requestId, url: `${uploadOrigin}${url.pathname}${url.search}` });
            return;
          }
          if (name === 'failed.txt') {
            status = 503;
            operations.set(operationId, { phase: 'failed', file: null, asynchronous: false });
          }
          else {
            const file = { id: String(records.length + 1), name, contentType: 'text/plain', sizeBytes: 7, status: 'AVAILABLE', checksum: null, createdAt: '2026-01-01T00:00:00.000Z' };
            records.push(file);
            status = 201;
            body = { file, asynchronous: false };
            operations.set(operationId, { phase: 'completed', file, asynchronous: false });
          }
        } else { listChecks += 1; body = records; }
        await cdp.send('Fetch.fulfillRequest', {
          requestId: event.requestId, responseCode: status,
          responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
          body: Buffer.from(JSON.stringify(body)).toString('base64'),
        });
      })().catch((error) => interceptionErrors.push(error));
    });
    await cdp.send('Page.enable', { enableFileChooserOpenedEvent: true });
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('kornspace-language', 'es'); localStorage.setItem('kornspace-theme', 'dark');" });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: `${origin}/api/*` }] });

    await t.test('keeps one session check across 404, home, login redirect and files; reload checks again', async () => {
      await cdp.send('Page.navigate', { url: `${origin}/unknown-page` });
      await until(() => evaluate("Boolean(document.querySelector('section a[href=\"/\"]'))"), '404 hydration');
      await until(() => sessionChecks === 1, 'initial session check');
      // Allow the shared session to settle before checking client navigation.
      await evaluate("new Promise(resolve => setTimeout(resolve, 100))");
      await evaluate("document.querySelector('section a[href=\"/\"]').click()");
      await until(() => evaluate("location.pathname === '/files' && Boolean(document.querySelector('input[multiple]'))"), 'authenticated workspace');
      assert.equal(sessionChecks, 1);
      assert.equal(await evaluate("document.body.innerText.includes('Verificando tu sesión')"), false);
      await cdp.send('Page.reload');
      await until(() => sessionChecks === 2, 'session check after reload');
      await until(() => evaluate("Boolean(document.querySelector('input[multiple]'))"), 'workspace after reload');
    });

    const selectFiles = async (filenames) => {
      const { root } = await cdp.send('DOM.getDocument');
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' });
      await cdp.send('DOM.setFileInputFiles', { nodeId, files: filenames });
    };

    await t.test('supports keyboard selection, multiple files, independent validation and partial failures', async () => {
      await cdp.send('Page.setInterceptFileChooserDialog', { enabled: true });
      await evaluate("window.testChooserRequested = false; document.querySelector('input[type=file]').addEventListener('click', () => { window.testChooserRequested = true; }); document.querySelector('button[aria-describedby=\"upload-hint\"]').focus()");
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13 });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await until(() => evaluate('window.testChooserRequested'), 'keyboard file input activation');
      const paths = ['one.txt', 'empty.txt', 'failed.txt', 'two.txt'].map((name) => path.join(temporaryDirectory, name));
      await Promise.all(paths.map((filename) => writeFile(filename, filename.endsWith('empty.txt') ? '' : 'content')));
      await selectFiles(paths);
      await until(() => records.length === 2 && uploads.length === 3, 'partial uploads');
      await until(() => evaluate("document.querySelector('[data-upload-toaster]').innerText.includes('No se pudo subir el archivo.')"), 'per-file failure');
      await until(() => evaluate("document.querySelector('[data-upload-toaster]').innerText.includes('El archivo está vacío')"), 'expanded validation notification');
      assert.equal(uploads.includes('empty.txt'), false);
      await until(() => evaluate("document.querySelector('[aria-labelledby=\"files-heading\"]').innerText.includes('two.txt')"), 'list refresh');
      assert.ok(listChecks >= 3);
      assert.equal(await evaluate("document.querySelector('button[aria-describedby=\"upload-hint\"]').disabled"), false);
    });

    await t.test('highlights drag-and-drop and processes each dropped file independently', async () => {
      await evaluate(`(() => {
        const transfer = new DataTransfer();
        transfer.items.add(new File(['content'], 'dropped.txt', { type: 'text/plain' }));
        transfer.items.add(new File([], 'dropped-empty.txt'));
        window.testTransfer = transfer;
        document.querySelector('[role=region]').dispatchEvent(new DragEvent('dragenter', { dataTransfer: transfer, bubbles: true, cancelable: true }));
      })()`);
      await until(() => evaluate("document.querySelector('[role=region]').classList.contains('border-accent')"), 'drag highlight');
      await evaluate("document.querySelector('[role=region]').dispatchEvent(new DragEvent('drop', { dataTransfer: window.testTransfer, bubbles: true, cancelable: true }))");
      await until(() => records.length === 3, 'dropped upload');
      await until(() => evaluate("document.querySelector('[aria-labelledby=\"files-heading\"]').innerText.includes('dropped.txt')"), 'dropped list update');
      assert.equal(uploads.includes('dropped-empty.txt'), false);
      assert.equal(await evaluate("document.querySelector('[role=region]').classList.contains('border-accent')"), false);
    });

    const itemText = (name) => `Array.from(document.querySelectorAll('[data-upload-notification]')).find(item => item.dataset.uploadName === ${JSON.stringify(name)})`;

    await t.test('shows genuine intermediate byte progress over a throttled HTTP upload', async () => {
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: 512 * 1024 });
      const filename = path.join(temporaryDirectory, 'progress.txt');
      await writeFile(filename, Buffer.alloc(2 * 1024 * 1024, 'x'));
      await selectFiles([filename]);
      await until(() => evaluate(`(() => { const item = ${itemText('progress.txt')}; const value = Number(item?.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')); return value > 0 && value < 100; })()`), 'intermediate progress');
      await until(() => evaluate(`(${itemText('progress.txt')})?.dataset.uploadState === 'confirming'`), 'server confirmation phase');
      assert.equal(await evaluate(`(${itemText('progress.txt')}).querySelector('[role=progressbar]').getAttribute('aria-valuenow')`), '100');
      await until(() => evaluate(`(${itemText('progress.txt')})?.innerText.includes('El archivo está disponible')`), 'upload completion');
      assert.equal(await evaluate(`(${itemText('progress.txt')}).querySelector('[role=progressbar]') === null`), true);
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    });

    await t.test('cancels one active upload while keeping the other file and enables a confirmed retry', async () => {
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: 512 * 1024 });
      const cancelled = path.join(temporaryDirectory, 'cancel-me.txt');
      const other = path.join(temporaryDirectory, 'keep-me.txt');
      await writeFile(cancelled, Buffer.alloc(8 * 1024 * 1024, 'x'));
      await writeFile(other, 'content');
      await selectFiles([cancelled, other]);
      await until(() => evaluate(`(${itemText('cancel-me.txt')})?.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') > 0`), 'active cancellable upload');
      assert.equal(await evaluate(`(${itemText('cancel-me.txt')}).querySelector('button[aria-labelledby*=cancel]')?.getBoundingClientRect().right > (${itemText('cancel-me.txt')}).querySelector('[role=progressbar]').getBoundingClientRect().right`), true);
      assert.equal(await evaluate(`(${itemText('cancel-me.txt')}).querySelector('button[aria-labelledby*=cancel]')?.getAttribute('title')`), 'Cancelar carga');
      await evaluate(`(${itemText('cancel-me.txt')}).querySelector('button').click()`);
      await until(() => evaluate(`(${itemText('cancel-me.txt')})?.innerText.includes('Carga cancelada')`), 'confirmed cancellation');
      await until(() => records.some((record) => record.name === 'keep-me.txt'), 'unaffected upload');
      assert.equal(records.some((record) => record.name === 'cancel-me.txt'), false);
      assert.equal(await evaluate(`(${itemText('cancel-me.txt')}).querySelector('button[aria-labelledby*=action]').innerText`), 'Reintentar carga');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    });

    await t.test('groups simultaneous and newly added uploads in one resizing toast with independent results', async () => {
      await evaluate("document.querySelectorAll('[data-upload-toaster] button[aria-labelledby*=dismiss]').forEach(button => button.click())");
      await until(() => evaluate("document.querySelectorAll('[data-sileo-toast]:not([data-exiting=true])').length === 0"), 'previous notification dismissal');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: 512 * 1024 });
      const names = ['toast-first.txt', 'toast-second.txt', 'toast-third.txt'];
      const paths = names.map((name) => path.join(temporaryDirectory, name));
      await Promise.all(paths.map((filename) => writeFile(filename, Buffer.alloc(1024 * 1024, 'x'))));
      await selectFiles(paths.slice(0, 2));
      await until(() => evaluate("document.querySelectorAll('[data-upload-group] [role=progressbar]').length === 2"), 'first two grouped uploads');
      await delay(350);
      const initialHeight = await evaluate("document.querySelector('[data-upload-group]').getBoundingClientRect().height");
      await evaluate("void (window.testUploadGroup = document.querySelector('[data-sileo-toast]'))");
      await selectFiles(paths.slice(2));
      await until(() => evaluate("document.querySelectorAll('[data-upload-group] [role=progressbar]').length === 3"), 'new upload joins the existing group');
      assert.equal(await evaluate("document.querySelectorAll('[data-sileo-toast]:not([data-exiting=true])').length"), 1);
      assert.equal(await evaluate("window.testUploadGroup === document.querySelector('[data-sileo-toast]')"), true);
      assert.ok(await evaluate("document.querySelector('[data-upload-group]').getBoundingClientRect().height") > initialHeight);
      await evaluate(`void (window.testProgressToast = (${itemText(names[0])}).closest('[data-sileo-toast]'))`);
      assert.equal(await evaluate("Boolean(document.querySelector('[aria-labelledby=uploads-heading]'))"), false);
      assert.equal(await evaluate("Boolean(document.querySelector('button[data-sileo-toast] button, [data-sileo-toast] button button'))"), false);
      await until(() => evaluate(`(${itemText(names[0])})?.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') > 0`), 'concurrent progress');
      if (process.env.UPLOAD_SCREENSHOT_PATH) {
        await delay(700);
        const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
        await writeFile(process.env.UPLOAD_SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64'));
      }
      await until(() => evaluate("Array.from(document.querySelectorAll('[data-upload-notification]')).filter(item => item.dataset.uploadName.startsWith('toast-') && item.dataset.uploadState === 'uploaded').length === 3"), 'three completed notifications');
      await until(() => evaluate("Array.from(document.querySelectorAll('[data-upload-notification]')).filter(item => item.querySelector('[data-upload-check]') && item.textContent.includes('Subida completada')).length === 3"), 'success title and tick per grouped file');
      assert.equal(await evaluate(`window.testProgressToast === (${itemText(names[0])}).closest('[data-sileo-toast]')`), true);
      if (process.env.UPLOAD_SCREENSHOT_PATH) {
        await delay(700);
        const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
        await writeFile(process.env.UPLOAD_SCREENSHOT_PATH.replace(/\.png$/u, '-completed.png'), Buffer.from(screenshot.data, 'base64'));
      }
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    });

    await t.test('keeps notifications readable in both themes and within a mobile viewport with reduced motion', async () => {
      await evaluate("document.querySelector('details').open = true; document.querySelector('button[aria-label=\"Activar tema claro\"]').click()");
      await until(() => evaluate("document.querySelector('[data-sileo-viewport]')?.dataset.theme === 'light'"), 'light notification theme');
      await evaluate("document.querySelector('button[aria-label=\"Activar tema oscuro\"]').click()");
      await until(() => evaluate("document.querySelector('[data-sileo-viewport]')?.dataset.theme === 'dark'"), 'dark notification theme');
      await evaluate("document.querySelector('details').open = false");
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      await delay(200);
      const mobileBounds = await evaluate("Array.from(document.querySelectorAll('[data-sileo-toast]:not([data-exiting=true])')).map(toast => { const rect = toast.getBoundingClientRect(); return { left: rect.left, right: rect.right, viewport: innerWidth }; })");
      assert.ok(mobileBounds.every((bounds) => bounds.left >= 0 && bounds.right <= bounds.viewport), JSON.stringify(mobileBounds));
      assert.equal(await evaluate("Array.from(document.querySelectorAll('[data-sileo-toast]')).every(toast => getComputedStyle(toast).transitionDuration.split(',').every(value => parseFloat(value) === 0))"), true);
      if (process.env.UPLOAD_SCREENSHOT_PATH) {
        const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
        await writeFile(process.env.UPLOAD_SCREENSHOT_PATH.replace(/\.png$/u, '-mobile.png'), Buffer.from(screenshot.data, 'base64'));
      }
      await until(() => evaluate("document.querySelectorAll('[data-sileo-toast]:not([data-exiting=true])').length === 0"), 'success notifications auto-dismiss', 12000);
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      await cdp.send('Emulation.setEmulatedMedia', { features: [] });
    });

    await t.test('clears an expired session and returns to login without checking me again', async () => {
      expired = true;
      const filename = path.join(temporaryDirectory, 'expired.txt');
      await writeFile(filename, 'content');
      await selectFiles([filename]);
      await until(() => evaluate("location.pathname === '/login' && Boolean(document.querySelector('a[href=\"/api/auth/google\"]'))"), 'login after failed renewal');
      assert.equal(refreshes, 1);
      assert.equal(sessionChecks, 2);
      assert.equal(await evaluate("Boolean(document.querySelector('aside[aria-label=\"Cuenta\"]'))"), false);
    });
    assert.deepEqual(interceptionErrors, []);
  } finally {
    if (debuggerClient) await debuggerClient.send('Browser.close').catch(() => undefined);
    debuggerClient?.close();
    browser?.kill();
    app.kill();
    if (uploadServer) {
      uploadServer.closeAllConnections();
      await new Promise((resolve) => uploadServer.close(resolve));
    }
    const target = path.resolve(temporaryDirectory);
    assert.equal(path.dirname(target), path.resolve(tmpdir()));
    assert.ok(path.basename(target).startsWith('kornspace-browser-e2e-'));
    await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
