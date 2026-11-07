import type { ReactNode } from 'react';
import type { StoredFile } from './files';
export interface ActionMenuProps { label: string; children: ReactNode; onSelect: () => void; onDismiss: () => void; }
export interface MenuPlacement { left: number; top: number; maxHeight: number; direction: 'up' | 'down'; }
export interface MenuAnchor { left: number; right: number; top: number; bottom: number; }
export interface CollapsibleSectionProps { id: string; label: string; collapsible?: boolean; children: ReactNode; }
export interface StorageUsage { totalBytes: number; trashBytes: number; files: StoredFile[]; }
export interface WorkspaceNavItem { href: string; label: string; icon: ReactNode; }
