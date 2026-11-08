import { useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import type { FileViewerProps } from '@/types';

export function FileViewer({ file, copy, apiUrl, onClose, onDelete }: FileViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState('');
  const [text, setText] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'unsupported'>('loading');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mediaType = file.contentType.split(';')[0].trim().toLowerCase();
  const image = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp'].includes(mediaType);
  const video = ['video/mp4', 'video/webm', 'video/ogg'].includes(mediaType);
  const audio = mediaType.startsWith('audio/');
  const pdf = mediaType === 'application/pdf';
  const plainText = mediaType.startsWith('text/') || ['application/json', 'application/xml'].includes(mediaType);

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return '0:00';
    const wholeSeconds = Math.floor(seconds);
    const hours = Math.floor(wholeSeconds / 3600);
    const minutes = Math.floor((wholeSeconds % 3600) / 60);
    const remainder = wholeSeconds % 60;
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
      : `${minutes}:${String(remainder).padStart(2, '0')}`;
  };

  const togglePlayback = () => {
    const player = videoRef.current;
    if (!player) return;
    if (player.paused) void player.play().catch(() => setPlaying(false));
    else player.pause();
  };

  const seek = (offset: number) => {
    const player = videoRef.current;
    if (!player) return;
    player.currentTime = Math.max(0, Math.min(player.duration || 0, player.currentTime + offset));
  };

  const toggleFullscreen = () => {
    if (!playerRef.current) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void playerRef.current.requestFullscreen();
  };

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === playerRef.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

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
    <dialog ref={dialogRef} aria-labelledby="viewer-title" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className={`fixed ${video ? 'inset-x-0 top-1/2 bottom-auto m-auto h-auto max-h-[92svh] w-[min(94vw,64rem)] -translate-y-1/2' : 'inset-0 m-auto h-[94svh] max-h-none w-[96vw] max-w-none'} overflow-hidden rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm`}>
      <div className="flex h-full flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <h2 id="viewer-title" className="min-w-0 flex-1 truncate text-sm font-semibold">{file.name}</h2>
          <a aria-label={copy.download} title={copy.download} className="grid size-10 place-items-center rounded-xl border border-line bg-raised text-accent shadow-sm transition hover:border-accent/40 hover:bg-accent-soft hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" href={apiUrl(`/api/files/${encodeURIComponent(file.id)}`)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></a>
          <button type="button" aria-label={copy.deleteFile} disabled={file.permission === 'READER'} title={file.permission === 'READER' ? copy.readOnlyAction : copy.deleteFile} className="grid size-10 place-items-center rounded-xl border border-status/20 bg-status/5 text-status shadow-sm transition hover:border-status/40 hover:bg-status/10 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-status disabled:cursor-not-allowed disabled:opacity-50" onClick={onDelete}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5"><path d="M4 7h16m-10 4v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
          <button type="button" aria-label={copy.closePanel} className="grid size-10 place-items-center rounded-full text-xl text-muted transition hover:bg-raised hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" onClick={onClose}>×</button>
        </header>
        <div className={`relative flex min-h-0 ${video ? 'max-h-[calc(92svh-4.5rem)]' : 'flex-1'} items-center justify-center overflow-auto bg-page ${video ? 'p-2 sm:p-3' : 'p-4 sm:p-8'}`}>
          {state === 'loading' && <p role="status" className="absolute inset-0 z-10 grid animate-pulse place-items-center bg-page text-sm text-muted motion-reduce:animate-none">{copy.previewLoading}</p>}
          {(state === 'error' || state === 'unsupported') && <p role="status" className="max-w-md text-center text-sm leading-6 text-muted">{state === 'error' ? copy.previewError : copy.previewUnavailable}</p>}
          {source && image && <img src={source} alt={file.name} className="max-h-full max-w-full object-contain" onLoad={() => setState('ready')} onError={() => setState('error')} />}
          {source && video && <div ref={playerRef} className={`group/player relative w-full overflow-hidden bg-black focus-within:ring-2 focus-within:ring-accent ${isFullscreen ? 'flex h-svh w-screen max-w-none flex-col justify-center rounded-none shadow-none' : 'max-w-5xl rounded-xl shadow-xl'}`}>
            <video ref={videoRef} src={source} playsInline preload="metadata" aria-label={file.name} className={`block w-full bg-black object-contain ${isFullscreen ? 'h-[calc(100svh-5.5rem)] max-h-none flex-1' : 'max-h-[min(68svh,42rem)]'}`} onLoadedMetadata={(event) => { setDuration(event.currentTarget.duration); setState('ready'); }} onDurationChange={(event) => setDuration(event.currentTarget.duration)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setState('error')} onClick={togglePlayback} />
            <div className="grid gap-2 bg-gradient-to-b from-neutral-950 to-black px-3 pb-3 pt-2 text-white sm:px-4">
              <input aria-label={copy.videoPlaybackSpeed + ' — ' + formatTime(currentTime)} type="range" min={0} max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => { const nextTime = Number(event.currentTarget.value); if (videoRef.current) videoRef.current.currentTime = nextTime; setCurrentTime(nextTime); }} className="h-1.5 w-full cursor-pointer accent-violet-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300" />
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button type="button" aria-label={playing ? copy.videoPause : copy.videoPlay} onClick={togglePlayback} className="grid size-9 place-items-center rounded-full bg-violet-500 text-white shadow-md shadow-violet-950/40 transition hover:scale-105 hover:bg-violet-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">{playing ? 'Ⅱ' : '▶'}</button>
                <button type="button" aria-label={copy.videoRewind} title={copy.videoRewind} onClick={() => seek(-10)} className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/5 text-[0.65rem] font-bold text-white/90 transition hover:border-white/25 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">−10</button>
                <button type="button" aria-label={copy.videoForward} title={copy.videoForward} onClick={() => seek(10)} className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/5 text-[0.65rem] font-bold text-white/90 transition hover:border-white/25 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">+10</button>
                <span className="min-w-[5.5rem] text-xs font-medium tabular-nums text-white/75">{formatTime(currentTime)} <span className="text-white/40">/</span> {formatTime(duration)}</span>
                <span className="flex-1" />
                <label className="sr-only" htmlFor="video-playback-speed">{copy.videoPlaybackSpeed}</label>
                <select id="video-playback-speed" aria-label={copy.videoPlaybackSpeed} value={playbackRate} onChange={(event) => { const rate = Number(event.currentTarget.value); setPlaybackRate(rate); if (videoRef.current) videoRef.current.playbackRate = rate; }} className="rounded-full border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">{[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => <option className="bg-neutral-900 text-white" key={rate} value={rate}>{rate === 1 ? '1×' : `${rate}×`}</option>)}</select>
                <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-1">
                  <button type="button" aria-label={copy.videoVolume} title={copy.videoVolume} onClick={() => { const nextVolume = volume > 0 ? 0 : 1; setVolume(nextVolume); if (videoRef.current) videoRef.current.volume = nextVolume; }} className="grid size-7 place-items-center rounded-full text-white/90 transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4"><path d="M4 10v4h3l4 3V7l-4 3H4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />{volume > 0 && <path d="M15 9a4 4 0 0 1 0 6m2-9a7 7 0 0 1 0 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />}{volume === 0 && <path d="m15 9 5 6m0-6-5 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />}</svg></button>
                  <label className="sr-only" htmlFor="video-volume">{copy.videoVolume}</label>
                  <input id="video-volume" aria-label={copy.videoVolume} type="range" min={0} max={1} step="0.01" value={volume} onChange={(event) => { const nextVolume = Number(event.currentTarget.value); setVolume(nextVolume); if (videoRef.current) videoRef.current.volume = nextVolume; }} className="w-16 cursor-pointer accent-violet-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300 sm:w-20" />
                </div>
                <button type="button" aria-label={copy.videoFullscreen} title={copy.videoFullscreen} onClick={toggleFullscreen} className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/5 text-lg transition hover:border-white/25 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4"><path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
              </div>
            </div>
          </div>}
          {source && audio && <audio src={source} controls aria-label={file.name} className="w-full max-w-xl" onError={() => setState('error')} />}
          {source && pdf && <iframe src={source} title={file.name} className="h-full w-full rounded-lg border border-line bg-white" />}
          {text !== null && <pre className="h-full w-full overflow-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-surface p-5 font-mono text-sm leading-7 text-ink">{text}</pre>}
        </div>
      </div>
    </dialog>
  );
}
