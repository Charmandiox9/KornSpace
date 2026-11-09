import { BadRequestException, ConflictException, ForbiddenException, HttpException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { fileAccess } from '../files/file-policy';
import { folderAccess, folderChain } from '../folders/folder-policy';

/** Moves metadata atomically; S3 keys and explicit grants stay attached to their resource. */
export async function moveResource(prisma: PrismaService, kind: 'files' | 'folders', id: string, userId: string, destinationId: string | null): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const resource = kind === 'files' ? (await fileAccess(tx, id, userId, true)).file : (await folderAccess(tx, id, userId, true)).folder;
      if ('deletedAt' in resource && (resource.deletedAt || resource.deletionPending)) throw new NotFoundException('No se encontró el archivo.');
      const sourceId = 'folderId' in resource ? resource.folderId : resource.parentId;
      if (destinationId === sourceId) return;
      if (kind === 'folders' && destinationId === id) throw new BadRequestException('Una carpeta no puede contenerse a sí misma.');
      if (sourceId) await folderAccess(tx, sourceId, userId, true);
      else if (resource.ownerId !== userId) throw new ForbiddenException('No puedes modificar la raíz de otro usuario.');
      const destination = destinationId ? (await folderAccess(tx, destinationId, userId, true)).folder : null;
      if ((destination?.ownerId ?? userId) !== resource.ownerId) throw new ForbiddenException('El movimiento debe conservar el propietario del elemento.');
      if (kind === 'folders' && destinationId && (await folderChain(tx, destinationId)).some((folder) => folder.id === id)) throw new BadRequestException('No puedes mover una carpeta dentro de sus descendientes.');
      const conflict = kind === 'files'
        ? await tx.storedFile.findFirst({ where: { ownerId: resource.ownerId, folderId: destinationId, name: resource.name, deletedAt: null, id: { not: id } } })
        : await tx.folder.findFirst({ where: { ownerId: resource.ownerId, parentId: destinationId, name: resource.name, id: { not: id } } });
      if (conflict) throw new ConflictException('Ya existe un elemento con ese nombre en el destino.');
      if (kind === 'files') await tx.storedFile.update({ where: { id }, data: { folderId: destinationId } });
      else await tx.folder.update({ where: { id }, data: { parentId: destinationId } });
      const actor = await tx.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
      await tx.resourceActivity.create({ data: { resourceType: kind === 'files' ? 'FILE' : 'FOLDER', resourceId: id, ...(kind === 'files' ? { fileId: id } : { folderId: id }), actorId: userId, actorName: actor?.name ?? actor?.email ?? '', action: 'MOVED', detail: destination?.name ?? 'ROOT' } });
    }, { isolationLevel: 'Serializable' });
  } catch (error: unknown) {
    if (error instanceof HttpException) throw error;
    if (typeof error === 'object' && error !== null && 'code' in error && (error.code === 'P2002' || error.code === 'P2034')) throw new ConflictException('El destino cambió durante el movimiento. Actualiza y reintenta.');
    throw new ServiceUnavailableException('No fue posible mover el elemento. Puedes reintentar.');
  }
}
