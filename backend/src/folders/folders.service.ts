import { moveResource } from '../common/move-resource';
import { BadRequestException, HttpException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { Folder, StoredFile, FileRole } from '@prisma/client';
import { folderAccess, folderPermissionRows, inheritedFolderRole, strongestRole, type ResourcePermission } from './folder-policy';
import { PrismaService } from '../prisma/prisma.service';
import type { StoredFileResponse } from '../files/file.types';
import type { FolderContentsResponse, FolderResponse } from './folder.types';

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function toFolderResponse(folder: Folder): FolderResponse {
  return {
    description: folder.description,
    id: folder.id,
    name: folder.name,
    ownerId: folder.ownerId,
    parentId: folder.parentId,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  };
}

function toFileResponse(file: StoredFile): StoredFileResponse {
  return {
    description: file.description,
    updatedAt: file.updatedAt.toISOString(),
    id: file.id,
    name: file.name,
    contentType: file.contentType,
    sizeBytes: Number(file.sizeBytes),
    status: file.status,
    checksum: file.checksum,
    createdAt: file.createdAt.toISOString(),
    deletedAt: file.deletedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class FoldersService {
  constructor(private readonly prisma: PrismaService) {}

  move(id: string, userId: string, destinationId: string | null): Promise<void> {
    return moveResource(this.prisma, 'folders', id, userId, destinationId);
  }

  private async accessible(prisma: Pick<PrismaService, 'folder' | 'folderPermission'>, id: string, userId: string, ownerOnly = false): Promise<Folder> {
    return (await folderAccess(prisma, id, userId, !ownerOnly, ownerOnly)).folder;
  }

  private mutationError(error: unknown): never {
    if (error instanceof HttpException) throw error;
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
    if (code === 'P2002') throw new ConflictException('Ya existe una carpeta con ese nombre en esta ubicación.');
    if (code === 'P2003') throw new ConflictException('La carpeta contiene archivos o subcarpetas. Elimínalos o muévelos antes de borrar la carpeta.');
    if (code === 'P2025') throw new NotFoundException('No se encontró la carpeta.');
    throw new ServiceUnavailableException('No fue posible modificar la carpeta. Puedes reintentar.');
  }

  async rename(id: string, userId: string, value: string): Promise<FolderResponse> {
    const name = value.trim();
    if (!name || name.length > 255 || /[\\/\u0000-\u001f\u007f]/u.test(name)) throw new BadRequestException('El nombre de la carpeta no es válido.');
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.accessible(tx, id, userId);
        const folder = await tx.folder.update({ where: { id }, data: { name } });
        const actor = await tx.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
        await tx.resourceActivity.create({ data: { resourceType: 'FOLDER', resourceId: id, folderId: id, actorId: userId, actorName: actor?.name ?? actor?.email ?? '', action: 'RENAMED', detail: name } });
        return toFolderResponse(folder);
      });
    } catch (error: unknown) { return this.mutationError(error); }
  }

  async updateDescription(id: string, userId: string, value: string): Promise<FolderResponse> {
    try {
      await this.accessible(this.prisma, id, userId);
      const folder = await this.prisma.folder.update({ where: { id }, data: { description: value.trim() || null } });
      const actor = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
      await this.prisma.resourceActivity.create({ data: { resourceType: 'FOLDER', resourceId: id, folderId: id, actorId: userId, actorName: actor?.name ?? actor?.email ?? '', action: 'DESCRIPTION_UPDATED' } });
      return toFolderResponse(folder);
    } catch (error: unknown) { return this.mutationError(error); }
  }

  async activity(id: string, userId: string) {
    await folderAccess(this.prisma, id, userId);
    const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    await this.prisma.resourceActivity.deleteMany({ where: { OR: [{ createdAt: { lt: cutoff } }, { action: 'OPENED' }] } });
    return this.prisma.resourceActivity.findMany({ where: { resourceType: 'FOLDER', resourceId: id, action: { not: 'OPENED' }, createdAt: { gte: cutoff } }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async remove(id: string, userId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const { folder } = await folderAccess(tx, id, userId, true);
        const child = await tx.folder.findFirst({ where: { parentId: id } });
        const file = await tx.storedFile.findFirst({ where: { folderId: id } });
        if (child || file) throw new ConflictException('La carpeta contiene elementos, incluidos archivos en papelera.');
        // Foreign keys reject concurrent content insertion; cascades remove permissions and preferences atomically.
        await tx.resourceActivity.updateMany({ where: { folderId: id }, data: { folderId: null } });
        const actor = await tx.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
        await tx.resourceActivity.create({ data: { resourceType: 'FOLDER', resourceId: id, actorId: userId, actorName: actor?.name ?? actor?.email ?? '', action: 'FOLDER_DELETED', detail: folder.parentId ?? 'ROOT' } });
        await tx.folder.delete({ where: { id } });
      });
    } catch (error: unknown) { this.mutationError(error); }
  }

  async grantEditor(id: string, ownerId: string, identifier: string, role: FileRole = 'EDITOR'): Promise<{ userId: string }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.accessible(tx, id, ownerId, true);
        const value = identifier.trim().replace(/^@/u, '');
        const users = await tx.user.findMany({ where: { id: { not: ownerId }, ...(value.includes('@') ? { email: { equals: value, mode: 'insensitive' } } : { username: { equals: value, mode: 'insensitive' } }) }, select: { id: true }, take: 2 });
        if (users.length !== 1) throw new NotFoundException('No se encontró un destinatario único.');
        const userId = users[0].id;
        await tx.folderPermission.upsert({ where: { folderId_userId: { folderId: id, userId } }, create: { folderId: id, userId, role }, update: { role } });
        const actor = await tx.user.findUnique({ where: { id: ownerId }, select: { name: true, email: true } });
        await tx.resourceActivity.create({ data: { resourceType: 'FOLDER', resourceId: id, folderId: id, actorId: ownerId, actorName: actor?.name ?? actor?.email ?? '', action: 'ACCESS_GRANTED', detail: role } });
        return { userId };
      });
    } catch (error: unknown) { return this.mutationError(error); }
  }

  async listEditors(id: string, ownerId: string): Promise<ResourcePermission[]> {
    try {
      await this.accessible(this.prisma, id, ownerId, true);
      return await folderPermissionRows(this.prisma, id);
    } catch (error: unknown) { return this.mutationError(error); }
  }

  async updatePermission(id: string, ownerId: string, userId: string, role: FileRole): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.accessible(tx, id, ownerId, true);
        const result = await tx.folderPermission.updateMany({ where: { folderId: id, userId }, data: { role } });
        if (!result.count) throw new NotFoundException('No se encontró el permiso directo.');
        const actor = await tx.user.findUnique({ where: { id: ownerId }, select: { name: true, email: true } });
        await tx.resourceActivity.create({ data: { resourceType: 'FOLDER', resourceId: id, folderId: id, actorId: ownerId, actorName: actor?.name ?? actor?.email ?? '', action: 'ACCESS_UPDATED', detail: role } });
      });
    } catch (error: unknown) { this.mutationError(error); }
  }

  async revokeEditor(id: string, ownerId: string, userId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.accessible(tx, id, ownerId, true);
        await tx.folderPermission.deleteMany({ where: { folderId: id, userId } });
        const actor = await tx.user.findUnique({ where: { id: ownerId }, select: { name: true, email: true } });
        await tx.resourceActivity.create({ data: { resourceType: 'FOLDER', resourceId: id, folderId: id, actorId: ownerId, actorName: actor?.name ?? actor?.email ?? '', action: 'ACCESS_REVOKED' } });
      });
    } catch (error: unknown) { this.mutationError(error); }
  }

  async create(ownerId: string, name: string, parentId: string | null): Promise<FolderResponse> {
    const normalizedName = name.trim();
    if (!normalizedName || normalizedName.length > 255 || /[\\/\u0000-\u001f\u007f]/u.test(normalizedName)) {
      throw new BadRequestException('El nombre de la carpeta no es válido.');
    }

    if (parentId) {
      const access = await folderAccess(this.prisma, parentId, ownerId, true);
      ownerId = access.folder.ownerId;
    }

    try {
      const folder = await this.prisma.folder.create({ data: { name: normalizedName, ownerId, parentId } });
      const actor = await this.prisma.user.findUnique({ where: { id: ownerId }, select: { name: true, email: true } });
      await this.prisma.resourceActivity.create({ data: { resourceType: 'FOLDER', resourceId: folder.id, folderId: folder.id, actorId: ownerId, actorName: actor?.name ?? actor?.email ?? '', action: 'CREATED', detail: parentId ? (await this.prisma.folder.findUnique({ where: { id: parentId }, select: { name: true } }))?.name ?? null : 'ROOT' } }).catch(() => undefined);
      return toFolderResponse(folder);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) throw new ConflictException('Ya existe una carpeta con ese nombre en esta ubicación.');
      throw new ServiceUnavailableException('No fue posible crear la carpeta.');
    }
  }

  async listContents(ownerId: string, parentId: string | null, includeFiles = true): Promise<FolderContentsResponse> {
    let folder: Folder | null = null;
    if (parentId) {
      try {
        folder = (await folderAccess(this.prisma, parentId, ownerId)).folder;
      } catch (error: unknown) {
        if (error instanceof HttpException) throw error;
        throw new ServiceUnavailableException('No fue posible validar la carpeta solicitada.');
      }
      if (!folder) throw new NotFoundException('No se encontró la carpeta solicitada.');
    }

    const contentOwnerId = folder?.ownerId ?? ownerId;
    try {
      const [children, storedFiles] = await Promise.all([
        this.prisma.folder.findMany({ where: { ownerId: contentOwnerId, parentId }, orderBy: { name: 'asc' } }),
        includeFiles ? this.prisma.storedFile.findMany({ where: { ownerId: contentOwnerId, folderId: parentId, deletedAt: null }, include: { owner: { select: { name: true, email: true } }, permissions: { where: { userId: ownerId } }, visits: { where: { userId: ownerId }, select: { openedAt: true } } }, orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
      ]);

      const shared = parentId === null ? await this.prisma.folderPermission.findMany({ where: { userId: ownerId }, include: { folder: true } }) : [];
      const visibleChildren = [...new Map([...children, ...shared.map((grant) => grant.folder)].map((child) => [child.id, child])).values()];
      const storageBytes = await this.getStorageBytesByFolder(visibleChildren);
      const inheritedRole = contentOwnerId !== ownerId && parentId ? await inheritedFolderRole(this.prisma, parentId, ownerId) : null;
      return {
        folder: folder ? { ...toFolderResponse(folder), permission: (await folderAccess(this.prisma, folder.id, ownerId)).role } : null,
        breadcrumbs: await this.getBreadcrumbs(ownerId, folder),
        folders: await Promise.all(visibleChildren.map(async (child) => ({ ...toFolderResponse(child), storageBytes: storageBytes.get(child.id) ?? 0, permission: child.ownerId === ownerId ? 'OWNER' as const : (await folderAccess(this.prisma, child.id, ownerId)).role }))),
        files: await Promise.all(storedFiles.map(async (file) => ({ ...toFileResponse(file), ownerId: file.ownerId, ownerName: file.owner?.name ?? file.owner?.email ?? '', folderId: file.folderId, folderName: folder?.name ?? null, openedAt: file.visits[0]?.openedAt.toISOString() ?? null, permission: file.ownerId === ownerId ? 'OWNER' as const : strongestRole(file.permissions[0]?.role ?? null, inheritedRole) ?? 'READER' as const }))),
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('No fue posible consultar el contenido de la carpeta.');
    }
  }

  private async getBreadcrumbs(ownerId: string, current: Folder | null): Promise<FolderResponse[]> {
    const ancestors: Folder[] = [];
    const visited = new Set<string>();
    let cursor = current;
    while (cursor?.parentId) {
      if (visited.has(cursor.id)) throw new ServiceUnavailableException('La jerarquía de carpetas contiene un ciclo.');
      visited.add(cursor.id);
      let parent: Folder;
      try { parent = (await folderAccess(this.prisma, cursor.parentId, ownerId)).folder; }
      catch (error: unknown) { if (error instanceof NotFoundException) break; throw error; }
      if (!parent) throw new ServiceUnavailableException('La carpeta padre ya no está disponible.');
      ancestors.unshift(parent);
      cursor = parent;
    }
    if (cursor && visited.has(cursor.id)) throw new ServiceUnavailableException('La jerarquía de carpetas contiene un ciclo.');
    return ancestors.map(toFolderResponse);
  }

  private async getStorageBytesByFolder(roots: Folder[]): Promise<Map<string, number>> {
    if (roots.length === 0) return new Map();
    const ownerIds = [...new Set(roots.map((folder) => folder.ownerId))];
    const folders = roots.map(({ id, ownerId, parentId }) => ({ id, ownerId, parentId }));
    let frontier = roots.map(({ id, ownerId }) => ({ id, ownerId }));
    const discoveredIds = new Set<string>();
    while (frontier.length > 0) {
      const discovered = await this.prisma.folder.findMany({ where: { ownerId: { in: ownerIds }, parentId: { in: frontier.map((folder) => folder.id) } }, select: { id: true, ownerId: true, parentId: true } });
      const parents = new Map(frontier.map((folder) => [folder.id, folder.ownerId]));
      const descendants = discovered.filter((folder) => parents.get(folder.parentId ?? '') === folder.ownerId && !discoveredIds.has(folder.id));
      descendants.forEach((folder) => discoveredIds.add(folder.id));
      folders.push(...descendants);
      frontier = descendants.map(({ id, ownerId }) => ({ id, ownerId }));
    }
    const folderIds = folders.map((folder) => folder.id);
    const fileSizes = await this.prisma.storedFile.groupBy({ by: ['folderId'], where: { ownerId: { in: ownerIds }, deletedAt: null, folderId: { in: folderIds } }, _sum: { sizeBytes: true } });
    const childrenByParent = new Map<string, string[]>();
    const folderOwner = new Map<string, string>();
    for (const folder of folders) {
      folderOwner.set(folder.id, folder.ownerId);
      if (folder.parentId) childrenByParent.set(folder.parentId, [...(childrenByParent.get(folder.parentId) ?? []), folder.id]);
    }
    const bytesByFolder = new Map<string, number>();
    for (const row of fileSizes) if (row.folderId) bytesByFolder.set(row.folderId, Number(row._sum.sizeBytes ?? 0n));
    const totals = new Map<string, number>();
    const active = new Set<string>();
    const totalFor = (id: string, ownerId: string): number => {
      const cached = totals.get(id);
      if (cached !== undefined) return cached;
      if (active.has(id) || folderOwner.get(id) !== ownerId) return 0;
      active.add(id);
      const total = (bytesByFolder.get(id) ?? 0) + (childrenByParent.get(id) ?? []).reduce((sum, childId) => sum + totalFor(childId, ownerId), 0);
      active.delete(id);
      totals.set(id, total);
      return total;
    };
    return new Map(roots.map((folder) => [folder.id, totalFor(folder.id, folder.ownerId)]));
  }
}
