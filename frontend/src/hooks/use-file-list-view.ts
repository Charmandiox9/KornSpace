import { useEffect, useState } from 'react';

const storageKey = 'kornspace.fileListView';

export function useFileListView() {
  const [listView, setListView] = useState(false);

  useEffect(() => {
    function restore() {
      try { setListView(localStorage.getItem(storageKey) === 'list'); } catch { /* Keep the current view when storage is unavailable. */ }
    }
    restore();
    window.addEventListener('storage', restore);
    return () => window.removeEventListener('storage', restore);
  }, []);

  function changeView(next: boolean) {
    setListView(next);
    try { localStorage.setItem(storageKey, next ? 'list' : 'grid'); } catch { /* The view remains usable without persistence. */ }
  }

  return { listView, changeView };
}
