import { ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { Folder, FileRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export type PermissionClient = Pick<PrismaService, 'folder' | 'folderPermission'>;
export interface FolderAccess { folder: Folder; role: 'OWNER' | FileRole; }
export interface ResourcePermission {
  userId: string;
  email: string;
  username: string | null;
  role: FileRole;
  inherited: boolean;
  sourceId: string;
  sourceName: string;
}
export function strongestRole(a: FileRole | null, b: FileRole | null): FileRole | null {
  return a === 'EDITOR' || b === 'EDITOR' ? 'EDITOR' : a ?? b;
}
export async function folderChain(prisma: PermissionClient, id: string): Promise<Folder[]> {
  const chain: Folder[] = [];
  const visited = new Set<string>();
  let cursor: string | null = id;
  while (cursor) {
    if (visited.has(cursor)) throw new ServiceUnavailableException('La jerarquía contiene un ciclo.');
    visited.add(cursor);
    const folder: Folder | null = await prisma.folder.findUnique({ where: { id: cursor } });
    if (!folder || (chain.length > 0 && folder.ownerId !== chain[0].ownerId)) throw new NotFoundException('No se encontró la carpeta.');
    chain.push(folder); cursor = folder.parentId;
  }
  return chain;
}
export async function inheritedFolderRole(prisma: PermissionClient, id: string, userId: string): Promise<FileRole | null> {
  let role: FileRole | null = null;
  for (const folder of await folderChain(prisma, id)) {
    const grant = await prisma.folderPermission.findUnique({ where: { folderId_userId: { folderId: folder.id, userId } } });
    role = strongestRole(role, grant?.role ?? null);
  }
  return role;
}
export async function folderAccess(prisma: PermissionClient, id: string, userId: string, write = false, ownerOnly = false): Promise<FolderAccess> {
  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder) throw new NotFoundException('No se encontró la carpeta.');
  if (folder.ownerId === userId) return { folder, role: 'OWNER' };
  if (ownerOnly) throw new NotFoundException('No se encontró la carpeta.');
  const role = await inheritedFolderRole(prisma, id, userId);
  if (!role) throw new NotFoundException('No se encontró la carpeta.');
  if (write && role !== 'EDITOR') throw new ForbiddenException('No tienes permiso para modificar esta carpeta.');
  return { folder, role };
}
export async function folderPermissionRows(prisma: PermissionClient, id: string, includeCurrent = true): Promise<ResourcePermission[]> {
  const chain = await folderChain(prisma, id);
  const rows: ResourcePermission[] = [];
  for (const [index, folder] of chain.entries()) {
    if (!includeCurrent && index === 0) continue;
    const grants = await prisma.folderPermission.findMany({ where: { folderId: folder.id }, include: { user: { select: { email: true, username: true } } } });
    rows.push(...grants.map((grant) => ({ userId: grant.userId, email: grant.user.email, username: grant.user.username, role: grant.role, inherited: index !== 0 || !includeCurrent, sourceId: folder.id, sourceName: folder.name })));
  }
  return rows;
}
export async function accessibleFolderIds(prisma: PermissionClient, userId: string): Promise<string[]> {
  const grants = await prisma.folderPermission.findMany({ where: { userId }, select: { folderId: true } });
  const visited = new Set(grants.map((grant) => grant.folderId));
  let frontier = [...visited];
  while (frontier.length) {
    const children = await prisma.folder.findMany({ where: { parentId: { in: frontier } }, select: { id: true } });
    frontier = children.map((child) => child.id).filter((id) => !visited.has(id));
    frontier.forEach((id) => visited.add(id));
  }
  return [...visited];
}
