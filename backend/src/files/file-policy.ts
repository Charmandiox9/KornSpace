import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { inheritedFolderRole, strongestRole } from '../folders/folder-policy';
import type { PrismaService } from '../prisma/prisma.service';

export function validateFileName(value: string): string {
  const name = value.trim();
  if (!name || name.length > 255 || /[\\/\u0000-\u001f\u007f]/u.test(name)) {
    throw new BadRequestException('El nombre del archivo no es válido.');
  }
  return name;
}

export async function fileAccess(prisma: Pick<PrismaService, 'storedFile' | 'folder' | 'folderPermission'>, id: string, userId: string, write = false) {
  const own = await prisma.storedFile.findFirst({ where: { id, ownerId: userId } });
  if (own) return { file: own, role: 'OWNER' as const };
  const shared = await prisma.storedFile.findFirst({
    where: { id, deletedAt: null, permissions: { some: { userId } } },
    include: { permissions: { where: { userId } } },
  });
  const file = shared ?? await prisma.storedFile.findFirst({ where: { id, deletedAt: null } });
  if (!file) throw new NotFoundException('No se encontró el archivo solicitado.');
  const directRole = shared?.permissions[0]?.role ?? null;
  const inherited = file.folderId ? await inheritedFolderRole(prisma, file.folderId, userId) : null;
  const role = strongestRole(directRole, inherited);
  if (!role) throw new NotFoundException('No se encontró el archivo solicitado.');
  if (write && role !== 'EDITOR') throw new ForbiddenException('No tienes permiso para modificar este archivo.');
  return { file, role };
}

export function nameConflict(file: { id: string; name: string } | null): never {
  throw new ConflictException({ statusCode: 409, code: 'FILE_NAME_CONFLICT', message: 'Ya existe un archivo con este nombre en la ubicación.', conflictId: file?.id ?? null, name: file?.name ?? null });
}
