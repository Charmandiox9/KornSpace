import { useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import type { FileViewerProps } from '@/types';

export function FileViewer({ file, copy, apiUrl, onClose, onDelete }: FileViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [source, setSource] = useState('');
  const [text, setText] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'unsupported'>('loading');
  const recorded = useRef(false);
  useEffect(() => {
    if (state !== 'ready' || recorded.current) return;
    recorded.current = true;
    void authenticatedFetch(`/api/files/${encodeURIComponent(file.id)}/access`, { method: 'POST' }).catch(() => undefined);
  }, [state, file.id]);
  const mediaType = file.contentType.split(';')[0].trim().toLowerCase();
  const image = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp'].includes(mediaType);
  const video = ['video/mp4', 'video/webm', 'video/ogg'].includes(mediaType);
  const audio = mediaType.startsWith('audio/');
  const pdf = mediaType === 'application/pdf';
  const plainText = mediaType.startsWith('text/') || ['application/json', 'application/xml'].includes(mediaType);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setState('loading');
    setText(null);
    setSource('');
    if (image || video) {
      setSource(apiUrl(`/api/files/${encodeURIComponent(file.id)}/preview`));
      return () => controller.abort();
    }
    // Large text and unknown formats stay downloadable without loading them into the reader.
    if ((!audio && !pdf && !plainText) || (plainText && file.sizeBytes > 2 * 1024 * 1024)) {
      setState('unsupported');
      return () => controller.abort();
    }
    void (async () => {
      try {
        const response = await authenticatedFetch(`/api/files/${encodeURIComponent(file.id)}`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        if (plainText) setText(await blob.text());
        else {
          objectUrl = URL.createObjectURL(new Blob([blob], { type: mediaType }));
          setSource(objectUrl);
        }
        setState('ready');
      } catch {
        if (!controller.signal.aborted) setState('error');
      }
    })();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, file.sizeBytes, mediaType, image, video, audio, pdf, plainText, apiUrl]);

  return (
    <dialog ref={dialogRef} aria-labelledby="viewer-title" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 m-auto h-[94svh] max-h-none w-[96vw] max-w-none overflow-hidden rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm">
      <div className="flex h-full flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <h2 id="viewer-title" className="min-w-0 flex-1 truncate text-sm font-semibold">{file.name}</h2>
          <a className="rounded-lg bg-accent-soft px-4 py-2 text-xs font-semibold text-accent" href={apiUrl(`/api/files/${encodeURIComponent(file.id)}`)}>{copy.download}</a>
          {file.permission !== 'READER' && <button type="button" className="rounded-lg px-3 py-2 text-xs text-status hover:bg-raised" onClick={onDelete}>{copy.deleteFile}</button>}
          <button type="button" aria-label={copy.closePanel} className="grid size-10 place-items-center rounded-full text-xl hover:bg-raised" onClick={onClose}>×</button>
        </header>
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-page p-4 sm:p-8">
          {state === 'loading' && <p role="status" className="absolute inset-0 z-10 grid animate-pulse place-items-center bg-page text-sm text-muted motion-reduce:animate-none">{copy.previewLoading}</p>}
          {(state === 'error' || state === 'unsupported') && <p role="status" className="max-w-md text-center text-sm leading-6 text-muted">{state === 'error' ? copy.previewError : copy.previewUnavailable}</p>}
          {source && image && <img src={source} alt={file.name} className="max-h-full max-w-full object-contain" onLoad={() => setState('ready')} onError={() => setState('error')} />}
          {source && video && <video src={source} controls playsInline aria-label={file.name} className="max-h-full max-w-full" onLoadedMetadata={() => setState('ready')} onError={() => setState('error')} />}
          {source && audio && <audio src={source} controls aria-label={file.name} className="w-full max-w-xl" onError={() => setState('error')} />}
          {source && pdf && <iframe src={source} title={file.name} className="h-full w-full rounded-lg border border-line bg-white" />}
          {text !== null && <pre className="h-full w-full overflow-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-surface p-5 font-mono text-sm leading-7 text-ink">{text}</pre>}
        </div>
      </div>
    </dialog>
  );
}
