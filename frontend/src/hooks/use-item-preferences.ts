import { useCallback, useEffect, useRef, useState } from 'react';
import { sileo } from 'sileo';
import { authenticatedFetch } from '@/lib/api-client';
import { isStoredFile } from '@/features/files/is-stored-file';
import { isStoredFolder } from '@/features/files/is-folder-contents';
import { itemColors } from '@/features/files/item-organization';
import type { ItemPreference, ItemOrganizationPatch, ItemPreferencesControls } from '@/types';
function isPreference(value: unknown): value is ItemPreference {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && (row.kind === 'files' || row.kind === 'folders') && typeof row.starred === 'boolean' && typeof row.shortcut === 'boolean' && typeof row.color === 'string' && Object.hasOwn(itemColors, row.color) && (row.kind === 'files' ? isStoredFile(row.file) : isStoredFolder(row.folder));
}
export function useItemPreferences(userId: string | undefined, failureMessage: string, refreshKey: number): ItemPreferencesControls {
  const [preferences, setPreferences] = useState<ItemPreference[]>([]);
  const session = useRef<AbortController | null>(null);
  const load = useCallback(async (controller: AbortController) => {
    const response = await authenticatedFetch('/api/preferences/items', { signal: controller.signal });
    const payload: unknown = await response.json();
    if (!response.ok || !Array.isArray(payload) || !payload.every(isPreference)) throw new Error(failureMessage);
    if (!controller.signal.aborted) setPreferences(payload);
  }, [failureMessage]);
  useEffect(() => {
    const controller = new AbortController(); session.current = controller; setPreferences([]);
    if (userId) void load(controller).catch(() => { if (!controller.signal.aborted) sileo.error({ title: failureMessage }); });
    return () => controller.abort();
  }, [userId, load, failureMessage]);
  useEffect(() => {
    const controller = session.current;
    if (refreshKey > 0 && userId && controller && !controller.signal.aborted) void load(controller).catch(() => { if (!controller.signal.aborted) sileo.error({ title: failureMessage }); });
  }, [refreshKey, userId, load, failureMessage]);
  const updatePreference = useCallback(async (kind: 'files' | 'folders', id: string, patch: ItemOrganizationPatch) => {
    const controller = session.current;
    if (!userId || !controller || controller.signal.aborted) return;
    const response = await authenticatedFetch(`/api/preferences/items/${kind}/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch), signal: controller.signal });
    if (!response.ok) throw new Error(failureMessage);
    await load(controller);
  }, [userId, failureMessage, load]);
  return { preferences, updatePreference };
}
