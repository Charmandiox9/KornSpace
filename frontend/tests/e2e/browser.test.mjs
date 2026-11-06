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

async function until(check, label, timeout = 30000) {
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
  let fetchRequestPausedHandler;
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request?.reject(new Error(message.error.message));
      else request?.resolve(message.result);
    } else {
      if (message.method === 'Fetch.requestPaused') fetchRequestPausedHandler?.(message.params);
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
    onFetchRequestPaused(handler) { fetchRequestPausedHandler = handler; },
    close() { socket.close(); },
  };
}

test('session navigation and multiple uploads in a real browser with a simulated API', { timeout: 300000 }, async (t) => {
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
    const evaluateFunction = async (functionDeclaration, ...args) => {
      const { result: globalObject } = await cdp.send('Runtime.evaluate', { expression: 'globalThis' });
      const response = await cdp.send('Runtime.callFunctionOn', {
        objectId: globalObject.objectId,
        functionDeclaration,
        arguments: args.map((value) => ({ value })),
        returnByValue: true,
        awaitPromise: true,
      });
      if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
      return response.result.value;
    };
    const user = { id: 'test-user', email: 'test@example.test', name: 'Test', username: 'test', pictureUrl: null };
    const records = [];
    let nextFileId = 0;
    const uploadDestinations = [];
    const dropFolder = { id: 'drop-target', name: 'Drop destination', ownerId: user.id, parentId: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
    const uploads = [];
    const trashedRecords = [];
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
        const file = { id: String(++nextFileId), name, ownerId: user.id, ownerName: 'Test', folderId: null, folderName: null, permission: 'OWNER', updatedAt: '2026-01-01T00:00:00.000Z', openedAt: null, contentType: 'text/plain', sizeBytes: Number(request.headers['content-length']), status: 'AVAILABLE', checksum: null, createdAt: '2026-01-01T00:00:00.000Z' };
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
    cdp.onFetchRequestPaused((event) => {
      void (async () => {
        const url = new URL(event.request.url);
        let status = 200;
        let body = {};
        let rawBody;
        if (url.pathname === '/api/auth/me') { sessionChecks += 1; body = user; }
        else if (url.pathname === '/api/auth/refresh') { refreshes += 1; status = 401; }
        else if (expired) status = 401;
        else if (url.pathname === '/graphql') { body = { data: { all: records, recent: records.filter(file => file.openedAt) } }; }
        else if (url.pathname === '/api/files/name-conflict') {
          const requestBody = JSON.parse(event.request.postData ?? '{}');
          const existing = records.find(file => file.name === requestBody.name && (file.folderId ?? null) === (requestBody.folderId ?? null));
          body = existing ? { code: 'FILE_NAME_CONFLICT', conflictId: existing.id, name: existing.name } : { available: true };
          status = existing ? 409 : 200;
        }
        else if (event.request.method === 'POST' && url.pathname.endsWith('/access')) {
          const id = url.pathname.split('/').at(-2); const file = records.find(file => file.id === id); if (file) file.openedAt = new Date().toISOString(); body = {};
        }
        else if (event.request.method === 'PATCH') {
          const id = url.pathname.split('/').at(-1); const requestBody = JSON.parse(event.request.postData ?? '{}'); const file = records.find(file => file.id === id);
          const collision = records.find(other => other.id !== id && other.name === requestBody.name && other.folderId === file?.folderId);
          if (collision && requestBody.replaceFileId !== collision.id) { status = 409; body = { conflictId: collision.id, name: collision.name }; }
          else if (file) { if (collision) { records.splice(records.indexOf(collision), 1); trashedRecords.push(collision); } file.name = requestBody.name; file.updatedAt = new Date().toISOString(); body = file; }
          else status = 404;
        }
        else if (url.pathname === '/api/files/trash' && event.request.method === 'GET') { body = trashedRecords; }
        else if (url.pathname === '/api/folders') { listChecks += 1; const folderId = url.searchParams.get('parentId'); body = { folder: folderId ? dropFolder : null, breadcrumbs: [], folders: folderId ? [] : [dropFolder], files: records.filter(record => (record.folderId ?? null) === folderId) }; }
        else if (event.request.method === 'GET' && /^\/api\/files\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith('/trash')) { rawBody = '<script>window.previewExecuted = true</script> KornSpace text preview'; }
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
          const replacementId = Object.entries(event.request.headers).find(([key]) => key.toLowerCase() === 'x-replace-file-id')?.[1];
          const target = records.find(file => file.id === replacementId);
          if (target) { records.splice(records.indexOf(target), 1); trashedRecords.push(target); }
          uploads.push(name);
          uploadDestinations.push({ name, folderId: url.searchParams.get('folderId') });
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
            const file = { id: String(++nextFileId), name, ownerId: user.id, ownerName: 'Test', folderId: url.searchParams.get('folderId'), folderName: null, permission: 'OWNER', updatedAt: '2026-01-01T00:00:00.000Z', openedAt: null, contentType: 'text/plain', sizeBytes: 7, status: 'AVAILABLE', checksum: null, createdAt: '2026-01-01T00:00:00.000Z' };
            records.push(file);
            status = 201;
            body = { file, asynchronous: false };
            operations.set(operationId, { phase: 'completed', file, asynchronous: false });
          }
        } else { listChecks += 1; body = records; }
        await cdp.send('Fetch.fulfillRequest', {
          requestId: event.requestId, responseCode: status,
          responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
          body: Buffer.from(rawBody ?? JSON.stringify(body)).toString('base64'),
        });
      })().catch((error) => interceptionErrors.push(error));
    });
    await cdp.send('Page.enable', { enableFileChooserOpenedEvent: true });
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('kornspace-language', 'es'); localStorage.setItem('kornspace-theme', 'dark');" });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: `${origin}/api/*` }, { urlPattern: `${origin}/graphql` }] });

    await t.test('keeps one session check across 404, home, login redirect and files; reload checks again', async () => {
      await cdp.send('Page.navigate', { url: `${origin}/unknown-page` });
      await until(() => evaluate("Boolean(document.querySelector('section a[href=\"/\"]'))"), '404 hydration');
      await until(() => sessionChecks === 1, 'initial session check');
      // Allow the shared session to settle before checking client navigation.
      await evaluate("new Promise(resolve => setTimeout(resolve, 100))");
      await evaluate("document.querySelector('section a[href=\"/\"]').click()");
      await until(() => evaluate("location.pathname === '/files' && Boolean(document.querySelector('input[multiple]'))"), 'authenticated home');
      assert.equal(sessionChecks, 1);
      assert.equal(await evaluate("document.body.innerText.includes('Verificando tu sesión')"), false);
      await cdp.send('Page.reload');
      await until(() => sessionChecks === 2, 'session check after reload');
      await until(() => evaluate("Boolean(document.querySelector('input[multiple]'))"), 'workspace after reload');
      await evaluate("document.querySelector('a[href=\"/files\"]').click()");
      await until(() => evaluate("location.pathname === '/files'"), 'drive navigation');
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

    await t.test('uses the sidebar action menu, selects file details and safely opens text with viewer actions', async () => {
      await until(() => evaluate("Boolean(document.querySelector('article button[aria-pressed]'))"), 'file cards ready');
      assert.equal(await evaluate("Boolean(document.querySelector('#workspace-create-actions summary'))"), true);
      assert.equal(await evaluate("document.querySelector('main > section').getBoundingClientRect().width > 950"), true);
      await evaluate("document.querySelector('article button[aria-pressed]').click()");
      await until(() => evaluate("Boolean(document.querySelector('aside[aria-label=\"Detalles del archivo\"]'))"), 'file information sidebar');
      await evaluate("Array.from(document.querySelectorAll('aside[aria-label=\"Detalles del archivo\"] button')).find(button => button.textContent === 'Abrir').click()");
      await until(() => evaluate("Boolean(document.querySelector('dialog[open] pre'))"), 'text reader');
      assert.equal(await evaluate("document.querySelector('dialog pre').textContent.includes('<script>')"), true);
      assert.equal(await evaluate("window.previewExecuted === true"), false);
      assert.equal(await evaluate("Boolean(document.querySelector('dialog a[href^=\"/api/files/\"]'))"), true);
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await until(() => evaluate("!document.querySelector('dialog[open]')"), 'viewer closes with Escape');
      await evaluate("document.querySelector('aside[aria-label=\"Detalles del archivo\"] button[aria-label=\"Cerrar\"]').click()");
    });

    await t.test('highlights drag-and-drop and processes each dropped file independently', async () => {
      await evaluate(`(() => {
        const transfer = new DataTransfer();
        transfer.items.add(new File(['content'], 'dropped.txt', { type: 'text/plain' }));
        transfer.items.add(new File([], 'dropped-empty.txt'));
        window.testTransfer = transfer;
        document.querySelector('[role=region]').dispatchEvent(new DragEvent('dragenter', { dataTransfer: transfer, bubbles: true, cancelable: true }));
      })()`);
      await until(() => evaluate("Boolean(document.querySelector('[data-file-drop-overlay]'))"), 'drag highlight');
      await evaluate("document.querySelector('[role=region]').dispatchEvent(new DragEvent('drop', { dataTransfer: window.testTransfer, bubbles: true, cancelable: true }))");
      await until(() => records.length === 3, 'dropped upload');
      await until(() => evaluate("document.querySelector('[aria-labelledby=\"files-heading\"]').innerText.includes('dropped.txt')"), 'dropped list update');
      assert.equal(uploads.includes('dropped-empty.txt'), false);
      assert.equal(await evaluate("Boolean(document.querySelector('[data-file-drop-overlay]'))"), false);
    });

    await t.test('accepts files across the page and targets a hovered folder without duplicate uploads', async () => {
      await evaluate(`(() => {
        const transfer = new DataTransfer();
        transfer.items.add(new File(['root'], 'global-drop.txt', { type: 'text/plain' }));
        const sidebar = document.querySelector('aside[aria-label="Barra lateral"]');
        sidebar.dispatchEvent(new DragEvent('dragenter', { dataTransfer: transfer, bubbles: true, cancelable: true }));
      })()`);
      await until(() => evaluate('Boolean(document.querySelector("[data-file-drop-overlay]"))'), 'global drop indicator');
      await evaluate(`(() => {
        const transfer = new DataTransfer();
        transfer.items.add(new File(['root'], 'global-drop.txt', { type: 'text/plain' }));
        document.body.dispatchEvent(new DragEvent('dragleave', { dataTransfer: transfer, bubbles: true, relatedTarget: null }));
      })()`);
      await until(() => evaluate('!document.querySelector("[data-file-drop-overlay]")'), 'leaving the window clears the indicator');
      assert.equal(await evaluate(`(() => {
        const transfer = new DataTransfer();
        transfer.setData('text/plain', 'ordinary text');
        const event = new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true });
        document.body.dispatchEvent(event);
        return event.defaultPrevented;
      })()`), false);
      await evaluate(`(() => {
        const transfer = new DataTransfer();
        transfer.items.add(new File(['root'], 'global-drop.txt', { type: 'text/plain' }));
        document.querySelector('aside[aria-label="Barra lateral"]').dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
      })()`);
      await until(() => records.some(record => record.name === 'global-drop.txt'), 'sidebar drop upload');
      assert.deepEqual(uploadDestinations.filter(item => item.name === 'global-drop.txt'), [{ name: 'global-drop.txt', folderId: null }]);
      await until(() => evaluate('Boolean(document.querySelector("[data-upload-folder-id]"))'), 'folder card after refresh');
      await evaluate(`(() => {
        const transfer = new DataTransfer();
        transfer.items.add(new File(['nested'], 'folder-drop.txt', { type: 'text/plain' }));
        const icon = document.querySelector('[data-upload-folder-id] svg path');
        window.folderDropTransfer = transfer;
        icon.dispatchEvent(new DragEvent('dragover', { dataTransfer: transfer, bubbles: true, cancelable: true }));
      })()`);
      await until(() => evaluate('document.querySelector("[data-upload-folder-id]").classList.contains("ring-2")'), 'folder target highlight');
      assert.equal(await evaluate('document.querySelector("[data-file-drop-overlay]").textContent.includes("Drop destination")'), true);
      await evaluate(`document.querySelector('[data-upload-folder-id] svg path').dispatchEvent(new DragEvent('drop', { dataTransfer: window.folderDropTransfer, bubbles: true, cancelable: true }))`);
      await until(() => records.some(record => record.name === 'folder-drop.txt'), 'folder drop upload');
      assert.deepEqual(uploadDestinations.filter(item => item.name === 'folder-drop.txt'), [{ name: 'folder-drop.txt', folderId: dropFolder.id }]);
      await until(() => evaluate('!document.querySelector("[data-file-drop-overlay]")'), 'drop indicator cleared');
      await until(() => evaluate('Boolean(document.querySelector("[data-upload-folder-id]"))'), 'folder card available');
      await evaluate('document.querySelector("[data-upload-folder-id]").click()');
      await until(() => evaluate('document.querySelector("#workspace-title").textContent === "Drop destination"'), 'navigate to drop destination');
      await until(() => evaluate('document.querySelector("[aria-labelledby=files-heading]").textContent.includes("folder-drop.txt")'), 'file stored in target folder');
      await evaluate('document.querySelector("nav[aria-label=Ubicación] button").click()');
      await until(() => evaluate('document.querySelector("#workspace-title").textContent === "Mi Unidad"'), 'return to root');
    });

    await t.test('renames a file through an accessible dialog', async () => {
      await until(() => evaluate("Boolean(document.querySelector('article'))"), 'cards before rename');
      await evaluate("Array.from(document.querySelector('article').querySelectorAll('button')).find(button => button.textContent === 'Renombrar').click()");
      await until(() => evaluate("Boolean(document.querySelector('dialog[open] input'))"), 'rename dialog');
      await evaluate("(() => { const input = document.querySelector('dialog input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'renamed.txt'); input.dispatchEvent(new Event('input', { bubbles: true })); })()");
      await evaluate("document.querySelector('dialog form').requestSubmit()");
      await until(() => records.some(file => file.name === 'renamed.txt'), 'renamed metadata');
      await until(() => evaluate("!document.querySelector('dialog[open]')"), 'rename completion');
      await until(() => evaluate("Boolean(document.querySelector('article'))"), 'cards after rename');
    });

    await t.test('a duplicate upload can be cancelled or explicitly replaced', async () => {
      const filename = path.join(temporaryDirectory, 'renamed.txt'); await writeFile(filename, 'replacement');
      const before = uploads.filter(name => name === 'renamed.txt').length;
      await selectFiles([filename]);
      await until(() => evaluate("Boolean(document.querySelector('dialog[open] #conflict-title'))"), 'upload conflict dialog');
      await evaluate("Array.from(document.querySelector('dialog').querySelectorAll('button')).find(button => button.textContent === 'Cancelar').click()");
      await until(() => evaluate("!document.querySelector('dialog[open]')"), 'cancelled replacement');
      assert.equal(uploads.filter(name => name === 'renamed.txt').length, before);
      await selectFiles([filename]);
      await until(() => evaluate("Boolean(document.querySelector('dialog[open] #conflict-title'))"), 'replacement confirmation');
      await evaluate("Array.from(document.querySelector('dialog').querySelectorAll('button')).find(button => button.textContent === 'Reemplazar').click()");
      await until(() => uploads.filter(name => name === 'renamed.txt').length === before + 1, 'replacement upload');
      await until(() => records.filter(file => file.name === 'renamed.txt').length === 1, 'unique replacement name');
      assert.equal(trashedRecords.some(file => file.name === 'renamed.txt'), true);
    });

    const uploadSnapshot = (name) => evaluateFunction(`function (name) {
      const item = Array.from(document.querySelectorAll('[data-upload-notification]')).find((entry) => entry.dataset.uploadName === name);
      const progress = item?.querySelector('[role=progressbar]');
      const cancel = item?.querySelector('button[aria-labelledby*=cancel]');
      const action = item?.querySelector('button[aria-labelledby*=action]');
      return {
        exists: Boolean(item),
        state: item?.dataset.uploadState ?? null,
        text: item?.innerText ?? '',
        progress: progress?.getAttribute('aria-valuenow') ?? null,
        progressRight: progress?.getBoundingClientRect().right ?? null,
        hasProgress: Boolean(progress),
        cancelRight: cancel?.getBoundingClientRect().right ?? null,
        cancelTitle: cancel?.getAttribute('title') ?? null,
        actionText: action?.innerText ?? null,
      };
    }`, name);
    const clickUploadButton = (name) => evaluateFunction(`function (name) {
      const item = Array.from(document.querySelectorAll('[data-upload-notification]')).find((entry) => entry.dataset.uploadName === name);
      item?.querySelector('button')?.click();
    }`, name);
    const rememberUploadToast = (name) => evaluateFunction(`function (name) {
      const item = Array.from(document.querySelectorAll('[data-upload-notification]')).find((entry) => entry.dataset.uploadName === name);
      window.testProgressToast = item?.closest('[data-sileo-toast]');
    }`, name);
    const isSameUploadToast = (name) => evaluateFunction(`function (name) {
      const item = Array.from(document.querySelectorAll('[data-upload-notification]')).find((entry) => entry.dataset.uploadName === name);
      return window.testProgressToast === item?.closest('[data-sileo-toast]');
    }`, name);

    await t.test('shows genuine intermediate byte progress over a throttled HTTP upload', async () => {
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: 512 * 1024 });
      const filename = path.join(temporaryDirectory, 'progress.txt');
      await writeFile(filename, Buffer.alloc(2 * 1024 * 1024, 'x'));
      await selectFiles([filename]);
      await until(async () => { const item = await uploadSnapshot('progress.txt'); const value = Number(item.progress); return value > 0 && value < 100; }, 'intermediate progress');
      await until(async () => (await uploadSnapshot('progress.txt')).state === 'confirming', 'server confirmation phase');
      assert.equal((await uploadSnapshot('progress.txt')).progress, '100');
      await until(async () => (await uploadSnapshot('progress.txt')).text.includes('El archivo está disponible'), 'upload completion');
      assert.equal((await uploadSnapshot('progress.txt')).hasProgress, false);
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    });

    await t.test('cancels one active upload while keeping the other file and enables a confirmed retry', async () => {
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: 512 * 1024 });
      const cancelled = path.join(temporaryDirectory, 'cancel-me.txt');
      const other = path.join(temporaryDirectory, 'keep-me.txt');
      await writeFile(cancelled, Buffer.alloc(8 * 1024 * 1024, 'x'));
      await writeFile(other, 'content');
      await selectFiles([cancelled, other]);
      await until(async () => Number((await uploadSnapshot('cancel-me.txt')).progress) > 0, 'active cancellable upload');
      const cancellingUpload = await uploadSnapshot('cancel-me.txt');
      assert.equal(cancellingUpload.cancelRight > cancellingUpload.progressRight, true);
      assert.equal(cancellingUpload.cancelTitle, 'Cancelar carga');
      await clickUploadButton('cancel-me.txt');
      await until(async () => (await uploadSnapshot('cancel-me.txt')).text.includes('Carga cancelada'), 'confirmed cancellation');
      await until(() => records.some((record) => record.name === 'keep-me.txt'), 'unaffected upload');
      assert.equal(records.some((record) => record.name === 'cancel-me.txt'), false);
      assert.equal((await uploadSnapshot('cancel-me.txt')).actionText, 'Reintentar carga');
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
      await rememberUploadToast(names[0]);
      assert.equal(await evaluate("Boolean(document.querySelector('[aria-labelledby=uploads-heading]'))"), false);
      assert.equal(await evaluate("Boolean(document.querySelector('button[data-sileo-toast] button, [data-sileo-toast] button button'))"), false);
      await until(async () => Number((await uploadSnapshot(names[0])).progress) > 0, 'concurrent progress');
      if (process.env.UPLOAD_SCREENSHOT_PATH) {
        await delay(700);
        const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
        await writeFile(process.env.UPLOAD_SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64'));
      }
      await until(() => evaluate("Array.from(document.querySelectorAll('[data-upload-notification]')).filter(item => item.dataset.uploadName.startsWith('toast-') && item.dataset.uploadState === 'uploaded').length === 3"), 'three completed notifications');
      await until(() => evaluate("Array.from(document.querySelectorAll('[data-upload-notification]')).filter(item => item.querySelector('[data-upload-check]') && item.textContent.includes('Subida completada')).length === 3"), 'success title and tick per grouped file');
      assert.equal(await isSameUploadToast(names[0]), true);
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
