import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { Folder, StoredFile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { StoredFileResponse } from './file.types';
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
        folder = await this.prisma.folder.findFirst({ where: { id: parentId, ownerId } });
      } catch {
        throw new ServiceUnavailableException('No fue posible validar la carpeta solicitada.');
      }
      if (!folder) throw new NotFoundException('No se encontró la carpeta solicitada.');
    }

    try {
      const [children, storedFiles] = await Promise.all([
        this.prisma.folder.findMany({ where: { ownerId, parentId }, orderBy: { name: 'asc' } }),
        this.prisma.storedFile.findMany({ where: { ownerId, folderId: parentId, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      ]);

      return {
        folder: folder ? toFolderResponse(folder) : null,
        breadcrumbs: await this.getBreadcrumbs(ownerId, folder),
        folders: children.map(toFolderResponse),
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
