import { useState } from 'react';
import { sileo } from 'sileo';
import type { ItemColor, ItemOrganizeMenuProps, ItemOrganizationPatch } from '@/types';
import { itemColors } from './item-organization';
import { ActionIcon } from './ActionIcon';
export function ItemOrganizeMenu({ preference, copy, onUpdate }: ItemOrganizeMenuProps) {
  const [busy, setBusy] = useState(false);
  async function update(patch: ItemOrganizationPatch) {
    if (busy) return;
    setBusy(true);
    try { await onUpdate(patch); } catch { sileo.error({ title: copy.organizationError }); } finally { setBusy(false); }
  }
  return <details className="group/organize border-y border-line py-1" onClick={(event) => event.stopPropagation()}>
    <summary className="flex min-h-10 cursor-pointer list-none items-center gap-3 rounded-lg px-3 hover:bg-raised"><ActionIcon name="organize" /><span className="flex-1">{copy.organize}</span><span aria-hidden="true" className="text-muted">›</span></summary>
    <div className="grid gap-1 pl-3">
      <button type="button" disabled={busy} aria-pressed={preference?.starred ?? false} onClick={() => void update({ starred: !preference?.starred })} className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-left hover:bg-raised"><ActionIcon name="star" />{preference?.starred ? copy.unstarItem : copy.starItem}</button>
      <button type="button" disabled={busy} aria-pressed={preference?.shortcut ?? false} onClick={() => void update({ shortcut: !preference?.shortcut })} className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-left hover:bg-raised"><ActionIcon name="shortcut" />{preference?.shortcut ? copy.unpinItem : copy.pinItem}</button>
      <fieldset className="grid grid-cols-5 gap-2 px-3 py-2"><legend className="py-2 text-xs text-muted">{copy.itemColor}</legend>{(Object.keys(itemColors) as ItemColor[]).map((color) => <button key={color} type="button" disabled={busy} aria-label={`${copy.itemColor}: ${color === 'DEFAULT' ? copy.defaultColor : copy.colorNames[color]}`} aria-pressed={(preference?.color ?? 'DEFAULT') === color} onClick={() => void update({ color })} className="grid size-8 place-items-center rounded-full border border-line aria-pressed:ring-2 aria-pressed:ring-accent aria-pressed:ring-offset-2 aria-pressed:ring-offset-surface" style={{ backgroundColor: itemColors[color] }}><span className="sr-only">{color === 'DEFAULT' ? copy.defaultColor : copy.colorNames[color]}</span></button>)}</fieldset>
    </div>
  </details>;
}
