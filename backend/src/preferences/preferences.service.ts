import { HttpException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { fileAccess } from '../files/file-policy';
import { folderAccess } from '../folders/folder-policy';
import type { ItemPreferenceInput, ItemPreferenceResponse } from './preference.types';

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}
  async update(userId: string, kind: 'files' | 'folders', id: string, data: ItemPreferenceInput): Promise<void> {
    const patch: ItemPreferenceInput = { ...(data.starred !== undefined ? { starred: data.starred } : {}), ...(data.shortcut !== undefined ? { shortcut: data.shortcut } : {}), ...(data.color !== undefined ? { color: data.color } : {}) };
    try {
      await this.prisma.$transaction(async (tx) => {
        if (kind === 'files') {
          const { file } = await fileAccess(tx, id, userId);
          if (file.deletedAt || file.deletionPending) throw new NotFoundException('No se encontró el archivo.');
          await tx.filePreference.upsert({ where: { userId_fileId: { userId, fileId: id } }, create: { userId, fileId: id, ...patch }, update: patch });
        } else {
          await folderAccess(tx, id, userId);
          await tx.folderPreference.upsert({ where: { userId_folderId: { userId, folderId: id } }, create: { userId, folderId: id, ...patch }, update: patch });
        }
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('No fue posible guardar la organización personal.');
    }
  }
  async list(userId: string): Promise<ItemPreferenceResponse[]> {
    try {
      const [files, folders] = await Promise.all([
        this.prisma.filePreference.findMany({ where: { userId } }),
        this.prisma.folderPreference.findMany({ where: { userId } }),
      ]);
      const result: ItemPreferenceResponse[] = [];
      for (const preference of files) {
        try {
          const { file, role } = await fileAccess(this.prisma, preference.fileId, userId);
          if (file.deletedAt || file.deletionPending) continue;
          result.push({ id: file.id, kind: 'files', starred: preference.starred, shortcut: preference.shortcut, color: preference.color, file: { id: file.id, name: file.name, ownerId: file.ownerId, permission: role, contentType: file.contentType, sizeBytes: Number(file.sizeBytes), checksum: file.checksum, status: file.status, createdAt: file.createdAt.toISOString(), deletedAt: null } });
        } catch (error: unknown) { if (!(error instanceof NotFoundException)) throw error; }
      }
      for (const preference of folders) {
        try {
          const { folder, role } = await folderAccess(this.prisma, preference.folderId, userId);
          result.push({ id: folder.id, kind: 'folders', starred: preference.starred, shortcut: preference.shortcut, color: preference.color, folder: { ...folder, permission: role, createdAt: folder.createdAt.toISOString(), updatedAt: folder.updatedAt.toISOString() } });
        } catch (error: unknown) { if (!(error instanceof NotFoundException)) throw error; }
      }
      return result;
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('No fue posible consultar la organización personal.');
    }
  }
}
