import type { ItemColor } from '@prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { ItemPreferenceInput } from '../src/preferences/preference.types';
import { PreferencesService } from '../src/preferences/preferences.service';
import { inheritanceHarness } from './permission-inheritance.harness';
interface PreferenceRecord { userId: string; fileId?: string; folderId?: string; starred: boolean; shortcut: boolean; color: ItemColor; }
export function preferencesHarness() {
  const h = inheritanceHarness();
  const rows = { files: new Map<string, PreferenceRecord>(), folders: new Map<string, PreferenceRecord>() };
  let fail = false;
  function delegate(kind: 'files' | 'folders') {
    return {
      findMany: async ({ where }: { where: { userId: string } }) => Array.from(rows[kind].values()).filter((row) => row.userId === where.userId),
      upsert: async ({ create, update }: { create: ItemPreferenceInput & { userId: string; fileId?: string; folderId?: string }; update: ItemPreferenceInput }) => {
        if (fail) throw new Error('Database unavailable');
        const key = create.userId + ':' + (create.fileId ?? create.folderId);
        const existing = rows[kind].get(key);
        const record: PreferenceRecord = existing ? { ...existing, ...update } : { starred: false, shortcut: false, color: 'DEFAULT', ...create };
        rows[kind].set(key, record); return record;
      },
    };
  }
  Object.assign(h.prisma, { filePreference: delegate('files'), folderPreference: delegate('folders'), $transaction: async <T>(callback: (tx: PrismaService) => Promise<T>) => callback(h.prisma) });
  return { ...h, rows, preferences: new PreferencesService(h.prisma), fail: (value: boolean) => { fail = value; } };
}
