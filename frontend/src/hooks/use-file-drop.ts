import { useEffect, useRef, useState } from 'react';
import type { DraggedResource, FileDropOptions, FileDropState } from '@/types';

export function useFileDrop({ folders, currentFolderId, enabled, onUpload, onMove }: FileDropOptions): FileDropState {
  const source = useRef<DraggedResource | null>(null);
  const [state, setState] = useState<Omit<FileDropState, 'startDrag' | 'isInternalDrag'>>({ isDragging: false, targetFolderId: null });

  useEffect(() => {
    let depth = 0;
    const reset = () => {
      depth = 0;
      setState({ isDragging: false, targetFolderId: null });
    };
    const isFileDrag = (event: DragEvent) => source.current !== null || event.dataTransfer?.types.includes('Files') === true;
    const getTargetFolderId = (event: DragEvent): string | null => {
      const element = event.target instanceof Element ? event.target : null;
      const target = element?.closest<HTMLElement>('[data-upload-folder-id]');
      if (target) return target.dataset.uploadFolderId || null;
      return currentFolderId;
    };
    const highlight = (event: DragEvent) => {
      if (!enabled) return;
      const targetFolderId = getTargetFolderId(event);
      setState((previous) => previous.isDragging && previous.targetFolderId === targetFolderId
        ? previous : { isDragging: true, targetFolderId });
    };
    const enter = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      depth += 1;
      highlight(event);
    };
    const over = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      if (event.dataTransfer) {
        const destination = getTargetFolderId(event);
        const resource = source.current;
        const unchanged = resource && (resource.parentId === destination || resource.kind === 'folders' && resource.id === destination);
        event.dataTransfer.dropEffect = enabled && !unchanged && folders.find((folder) => folder.id === destination)?.permission !== 'READER' ? (resource ? 'move' : 'copy') : 'none';
      }
      highlight(event);
    };
    const leave = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0 || event.relatedTarget === null) reset();
    };
    const drop = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const folderId = getTargetFolderId(event);
      const files = Array.from(event.dataTransfer?.files ?? []);
      const resource = source.current;
      source.current = null;
      reset();
      if (enabled && resource) {
        if (resource.parentId !== folderId && !(resource.kind === 'folders' && resource.id === folderId) && folders.find((folder) => folder.id === folderId)?.permission !== 'READER') onMove(resource, folderId);
        return;
      }
      if (enabled && files.length > 0 && folders.find((folder) => folder.id === folderId)?.permission !== 'READER') onUpload(files, folderId);
    };
    const end = () => { source.current = null; reset(); };
    window.addEventListener('dragenter', enter, true);
    window.addEventListener('dragover', over, true);
    window.addEventListener('dragleave', leave, true);
    window.addEventListener('drop', drop, true);
    window.addEventListener('dragend', end);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('dragenter', enter, true);
      window.removeEventListener('dragover', over, true);
      window.removeEventListener('dragleave', leave, true);
      window.removeEventListener('drop', drop, true);
      window.removeEventListener('dragend', end);
      window.removeEventListener('blur', reset);
    };
  }, [folders, currentFolderId, enabled, onUpload, onMove]);

  return { ...state, isInternalDrag: source.current !== null, startDrag: (event, resource) => {
    if (!enabled) { event.preventDefault(); return; }
    source.current = resource;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-kornspace-resource', resource.id);
  } };
}
