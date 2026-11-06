import { BadRequestException, HttpException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { Folder, StoredFile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { StoredFileResponse } from '../files/file.types';
import type { FolderContentsResponse, FolderResponse } from './folder.types';

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function toFolderResponse(folder: Folder): FolderResponse {
  return {
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

  private async accessible(prisma: Pick<PrismaService, 'folder' | 'folderPermission'>, id: string, userId: string, ownerOnly = false): Promise<Folder> {
    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder) throw new NotFoundException('No se encontró la carpeta.');
    if (folder.ownerId !== userId && (ownerOnly || !await prisma.folderPermission.findUnique({ where: { folderId_userId: { folderId: id, userId } } }))) {
      throw new NotFoundException('No se encontró la carpeta.');
    }
    return folder;
  }

  private mutationError(error: unknown): never {
    if (error instanceof HttpException) throw error;
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
    if (code === 'P2002') throw new ConflictException('Ya existe una carpeta con ese nombre en esta ubicación.');
    if (code === 'P2003') throw new ConflictException('La carpeta contiene elementos. Vacíala antes de eliminarla.');
    if (code === 'P2025') throw new NotFoundException('No se encontró la carpeta.');
    throw new ServiceUnavailableException('No fue posible modificar la carpeta. Puedes reintentar.');
  }

  async rename(id: string, userId: string, value: string): Promise<FolderResponse> {
    const name = value.trim();
    if (!name || name.length > 255 || /[\\/\u0000-\u001f\u007f]/u.test(name)) throw new BadRequestException('El nombre de la carpeta no es válido.');
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.accessible(tx, id, userId);
        return toFolderResponse(await tx.folder.update({ where: { id }, data: { name } }));
      });
    } catch (error: unknown) { return this.mutationError(error); }
  }

  async remove(id: string, userId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.accessible(tx, id, userId);
        const child = await tx.folder.findFirst({ where: { parentId: id } });
        const file = await tx.storedFile.findFirst({ where: { folderId: id } });
        if (child || file) throw new ConflictException('La carpeta contiene elementos, incluidos archivos en papelera.');
        // Foreign keys also reject concurrent insertions; deletion and permission cleanup are atomic.
        await tx.folder.delete({ where: { id } });
      });
    } catch (error: unknown) { this.mutationError(error); }
  }

  async grantEditor(id: string, ownerId: string, identifier: string): Promise<{ userId: string }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.accessible(tx, id, ownerId, true);
        const value = identifier.trim().replace(/^@/u, '');
        const users = await tx.user.findMany({ where: { id: { not: ownerId }, ...(value.includes('@') ? { email: { equals: value, mode: 'insensitive' } } : { username: { equals: value, mode: 'insensitive' } }) }, select: { id: true }, take: 2 });
        if (users.length !== 1) throw new NotFoundException('No se encontró un destinatario único.');
        const userId = users[0].id;
        await tx.folderPermission.upsert({ where: { folderId_userId: { folderId: id, userId } }, create: { folderId: id, userId }, update: {} });
        return { userId };
      });
    } catch (error: unknown) { return this.mutationError(error); }
  }

  async listEditors(id: string, ownerId: string): Promise<Array<{ userId: string; email: string; username: string | null }>> {
    try {
      await this.accessible(this.prisma, id, ownerId, true);
      const grants = await this.prisma.folderPermission.findMany({ where: { folderId: id }, include: { user: { select: { email: true, username: true } } } });
      return grants.map((grant) => ({ userId: grant.userId, email: grant.user.email, username: grant.user.username }));
    } catch (error: unknown) { return this.mutationError(error); }
  }

  async revokeEditor(id: string, ownerId: string, userId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.accessible(tx, id, ownerId, true);
        await tx.folderPermission.deleteMany({ where: { folderId: id, userId } });
      });
    } catch (error: unknown) { this.mutationError(error); }
  }

  async create(ownerId: string, name: string, parentId: string | null): Promise<FolderResponse> {
    const normalizedName = name.trim();
    if (!normalizedName || normalizedName.length > 255 || /[\\/\u0000-\u001f\u007f]/u.test(normalizedName)) {
      throw new BadRequestException('El nombre de la carpeta no es válido.');
    }

    if (parentId) {
      let parent: { id: string } | null;
      try {
        parent = await this.prisma.folder.findFirst({ where: { id: parentId, ownerId }, select: { id: true } });
      } catch {
        throw new ServiceUnavailableException('No fue posible validar la carpeta padre.');
      }
      if (!parent) throw new NotFoundException('No se encontró la carpeta padre.');
    }

    try {
      const folder = await this.prisma.folder.create({ data: { name: normalizedName, ownerId, parentId } });
      return toFolderResponse(folder);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) throw new ConflictException('Ya existe una carpeta con ese nombre en esta ubicación.');
      throw new ServiceUnavailableException('No fue posible crear la carpeta.');
    }
  }

  async listContents(ownerId: string, parentId: string | null): Promise<FolderContentsResponse> {
    let folder: Folder | null = null;
    if (parentId) {
      try {
        folder = await this.accessible(this.prisma, parentId, ownerId);
      } catch (error: unknown) {
        if (error instanceof NotFoundException) throw error;
        throw new ServiceUnavailableException('No fue posible validar la carpeta solicitada.');
      }
      if (!folder) throw new NotFoundException('No se encontró la carpeta solicitada.');
    }

    if (folder && folder.ownerId !== ownerId) return { folder: toFolderResponse(folder), breadcrumbs: [], folders: [], files: [] };
    try {
      const [children, storedFiles] = await Promise.all([
        this.prisma.folder.findMany({ where: { ownerId, parentId }, orderBy: { name: 'asc' } }),
        this.prisma.storedFile.findMany({ where: { ownerId, folderId: parentId, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      ]);

      const shared = parentId === null ? await this.prisma.folderPermission.findMany({ where: { userId: ownerId }, include: { folder: true } }) : [];
      return {
        folder: folder ? toFolderResponse(folder) : null,
        breadcrumbs: await this.getBreadcrumbs(ownerId, folder),
        folders: [...children, ...shared.map((grant) => grant.folder)].map(toFolderResponse),
        files: storedFiles.map(toFileResponse),
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
      const parent = await this.prisma.folder.findFirst({ where: { id: cursor.parentId, ownerId } });
      if (!parent) throw new ServiceUnavailableException('La carpeta padre ya no está disponible.');
      ancestors.unshift(parent);
      cursor = parent;
    }
    if (cursor && visited.has(cursor.id)) throw new ServiceUnavailableException('La jerarquía de carpetas contiene un ciclo.');
    return ancestors.map(toFolderResponse);
  }
}
