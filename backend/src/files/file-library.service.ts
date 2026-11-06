import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { fileAccess, nameConflict, validateFileName } from './file-policy';
import type { ShareRecipient } from './file.types';

export interface LibraryFilters {
  search?: string;
  kind?: string;
  ownerId?: string;
  modifiedAfter?: string;
  folderId?: string;
  recent?: boolean;
  shared?: boolean;
}

@Injectable()
export class FileLibraryService {
  constructor(private readonly prisma: PrismaService) {}

  async checkName(userId: string, value: string, folderId: string | null) {
    const name = validateFileName(value);
    if (folderId && !await this.prisma.folder.findFirst({ where: { id: folderId, ownerId: userId } })) throw new NotFoundException('No se encontró la carpeta.');
    const conflict = await this.prisma.storedFile.findFirst({ where: { ownerId: userId, folderId, name, deletedAt: null } });
    if (conflict) nameConflict(conflict);
    return { available: true };
  }

  async rename(id: string, userId: string, value: string, replaceId?: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { file } = await fileAccess(tx, id, userId, true);
        if (file.deletedAt || file.deletionPending) throw new NotFoundException('No se encontró el archivo.');
        const name = validateFileName(value);
        const conflict = await tx.storedFile.findFirst({ where: { ownerId: file.ownerId, folderId: file.folderId, name, deletedAt: null, id: { not: id } } });
        if (conflict) {
          await fileAccess(tx, conflict.id, userId, true);
          if (replaceId !== conflict.id) nameConflict(conflict);
          await tx.storedFile.update({ where: { id: conflict.id }, data: { deletedAt: new Date() } });
        }
        const result = await tx.storedFile.update({ where: { id }, data: { name } });
        return { id: result.id, name: result.name, updatedAt: result.updatedAt.toISOString() };
      });
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        const source = await fileAccess(this.prisma, id, userId, true);
        const current = await this.prisma.storedFile.findFirst({ where: { ownerId: source.file.ownerId, folderId: source.file.folderId, name: value.trim(), deletedAt: null, id: { not: id } } });
        if (current) await fileAccess(this.prisma, current.id, userId, true);
        nameConflict(current);
      }
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('No fue posible renombrar el archivo.');
    }
  }

  async recordAccess(id: string, userId: string): Promise<void> {
    const { file } = await fileAccess(this.prisma, id, userId);
    if (file.deletedAt || file.deletionPending || file.status !== 'AVAILABLE') throw new NotFoundException('No se encontró el archivo.');
    await this.prisma.fileVisit.upsert({ where: { fileId_userId: { fileId: id, userId } }, create: { fileId: id, userId }, update: { openedAt: new Date() } });
  }

  async resolveRecipient(id: string, userId: string, identifier: string): Promise<ShareRecipient> {
    const file = await this.prisma.storedFile.findFirst({ where: { id, ownerId: userId, deletedAt: null, deletionPending: false } });
    if (!file) throw new NotFoundException('No se encontró el archivo.');
    const value = identifier.trim();
    if (value.length < 3 || value.length > 255) throw new BadRequestException('Indica un correo o nombre de usuario válido.');
    const emailLookup = value.includes('@') && !value.startsWith('@');
    const recipients = await this.prisma.user.findMany({
      where: { id: { not: userId }, ...(emailLookup ? { email: { equals: value, mode: 'insensitive' } } : { username: { equals: value.replace(/^@/u, ''), mode: 'insensitive' } }) },
      select: { id: true, username: true, email: true, name: true }, take: 2,
    });
    if (recipients.length !== 1) throw new NotFoundException('No se encontró un destinatario válido.');
    const recipient = recipients[0];
    return { userId: recipient.id, username: recipient.username, email: recipient.email, name: recipient.name };
  }

  async grant(id: string, userId: string, identifier: string, role: 'READER' | 'EDITOR', expectedRecipientId?: string) {
    const recipient = await this.resolveRecipient(id, userId, identifier);
    if (expectedRecipientId && recipient.userId !== expectedRecipientId) throw new ConflictException('El destinatario cambió. Compruébalo antes de compartir.');
    return this.prisma.filePermission.upsert({ where: { fileId_userId: { fileId: id, userId: recipient.userId } }, create: { fileId: id, userId: recipient.userId, role }, update: { role }, select: { userId: true, role: true } });
  }

  async revoke(id: string, ownerId: string, userId: string): Promise<void> {
    if (!await this.prisma.storedFile.findFirst({ where: { id, ownerId, deletedAt: null } })) throw new NotFoundException('No se encontró el archivo.');
    await this.prisma.filePermission.deleteMany({ where: { fileId: id, userId } });
  }

  async browse(userId: string, filters: LibraryFilters = {}) {
    const recent = filters.recent ? await this.prisma.fileVisit.findMany({ where: { userId }, orderBy: { openedAt: 'desc' }, select: { fileId: true }, take: 200 }) : null;
    const files = await this.prisma.storedFile.findMany({
      where: {
        deletedAt: null, deletionPending: false,
        OR: [{ ownerId: userId }, { permissions: { some: { userId } } }],
        ...(filters.shared ? { ownerId: { not: userId } } : filters.ownerId ? { ownerId: filters.ownerId } : {}),
        ...(filters.search ? { name: { contains: filters.search, mode: 'insensitive' as const } } : {}),
        ...(filters.kind === 'document' ? { AND: [{ OR: ['application/pdf', 'application/json', 'application/xml', 'application/msword', 'application/rtf', 'application/vnd.openxmlformats-officedocument', 'application/vnd.ms-', 'application/vnd.oasis'].map((prefix) => ({ contentType: { startsWith: prefix, mode: 'insensitive' as const } })) }] } : filters.kind ? { contentType: { startsWith: `${filters.kind}/` } } : {}),
        ...(filters.modifiedAfter ? { updatedAt: { gte: new Date(filters.modifiedAfter) } } : {}),
        ...(filters.folderId ? { folderId: filters.folderId === 'root' ? null : filters.folderId } : {}),
        ...(recent ? { id: { in: recent.map((visit) => visit.fileId) } } : {}),
      },
      include: { owner: { select: { id: true, name: true, email: true } }, folder: { select: { id: true, name: true } }, permissions: { where: { userId }, select: { role: true } }, visits: { where: { userId }, select: { openedAt: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return files.map((file) => ({
      id: file.id, name: file.name, contentType: file.contentType, sizeBytes: Number(file.sizeBytes), status: file.status,
      checksum: file.checksum, createdAt: file.createdAt.toISOString(), updatedAt: file.updatedAt.toISOString(), deletedAt: null,
      ownerId: file.ownerId, ownerName: file.owner?.name ?? file.owner?.email ?? '', folderId: file.folderId, folderName: file.folder?.name ?? null,
      permission: file.ownerId === userId ? 'OWNER' : file.permissions[0]?.role ?? 'READER',
      openedAt: file.visits[0]?.openedAt.toISOString() ?? null,
    })).sort((a, b) => (b.openedAt ?? b.updatedAt).localeCompare(a.openedAt ?? a.updatedAt));
  }
}
