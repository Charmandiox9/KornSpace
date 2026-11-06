import { useEffect, useState } from 'react';
import type { FileDropOptions, FileDropState } from '@/types';

export function useFileDrop({ folders, currentFolderId, enabled, onUpload }: FileDropOptions): FileDropState {
  const [state, setState] = useState<FileDropState>({ isDragging: false, targetFolderId: null });

  useEffect(() => {
    let depth = 0;
    const reset = () => {
      depth = 0;
      setState({ isDragging: false, targetFolderId: null });
    };
    const isFileDrag = (event: DragEvent) => event.dataTransfer?.types.includes('Files') === true;
    const getTargetFolderId = (event: DragEvent): string | null => {
      const element = event.target instanceof Element ? event.target : null;
      const id = element?.closest<HTMLElement>('[data-upload-folder-id]')?.dataset.uploadFolderId;
      return folders.some((folder) => folder.id === id) ? id ?? null : null;
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
      if (event.dataTransfer) event.dataTransfer.dropEffect = enabled ? 'copy' : 'none';
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
      const folderId = getTargetFolderId(event) ?? currentFolderId;
      const files = Array.from(event.dataTransfer?.files ?? []);
      reset();
      if (enabled && files.length > 0) onUpload(files, folderId);
    };
    window.addEventListener('dragenter', enter, true);
    window.addEventListener('dragover', over, true);
    window.addEventListener('dragleave', leave, true);
    window.addEventListener('drop', drop, true);
    window.addEventListener('dragend', reset);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('dragenter', enter, true);
      window.removeEventListener('dragover', over, true);
      window.removeEventListener('dragleave', leave, true);
      window.removeEventListener('drop', drop, true);
      window.removeEventListener('dragend', reset);
      window.removeEventListener('blur', reset);
    };
  }, [folders, currentFolderId, enabled, onUpload]);

  return state;
}
