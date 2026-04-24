import { useState } from 'react';
import { cn } from '../../utils/cn';
import { useFolderStore } from '../../stores/folderStore';
import { useShowToast } from '../ui/Toast';
import { MsPlusIcon, MsDeleteIcon, MsEditIcon, MsWarningIcon, MsCalendarIcon } from '../ui/MsIcons';
import type { FolderSelection } from '../../utils/cycleFilter';
import type { ReviewCycle } from '../../types';

export const CYCLE_DRAG_MIME = 'application/x-review-cycle-id';

interface Props {
  selected: FolderSelection;
  onSelect: (sel: FolderSelection) => void;
  cycles: ReviewCycle[];
  onMoveCycleToFolder: (cycleId: string, folderId: string | null) => void;
}

function countFor(cycles: ReviewCycle[], sel: FolderSelection): number {
  const today = new Date().toISOString().slice(0, 10);
  return cycles.filter(c => {
    if (c.archivedAt) return false;
    switch (sel.kind) {
      case 'all': return true;
      case 'none': return !c.folderId;
      case 'overdue':
        if (c.status === 'closed') return false;
        if ((c.completionRate ?? 0) >= 100) return false;
        return c.selfReviewDeadline.slice(0, 10) < today || c.managerReviewDeadline.slice(0, 10) < today;
      case 'this_quarter': {
        const d = new Date();
        const q = Math.floor(d.getMonth() / 3);
        const qFrom = new Date(d.getFullYear(), q * 3, 1).toISOString().slice(0, 10);
        const qTo = new Date(d.getFullYear(), q * 3 + 3, 0).toISOString().slice(0, 10);
        const created = c.createdAt.slice(0, 10);
        return created >= qFrom && created <= qTo;
      }
      case 'folder': return c.folderId === sel.id;
    }
  }).length;
}

function isSame(a: FolderSelection, b: FolderSelection): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'folder' && b.kind === 'folder') return a.id === b.id;
  return true;
}

export function FolderSidebar({ selected, onSelect, cycles, onMoveCycleToFolder }: Props) {
  const folders = useFolderStore(s => s.folders);
  const addFolder = useFolderStore(s => s.addFolder);
  const updateFolder = useFolderStore(s => s.updateFolder);
  const deleteFolder = useFolderStore(s => s.deleteFolder);
  const showToast = useShowToast();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const handleAdd = () => {
    const name = draft.trim();
    if (!name) { setAdding(false); return; }
    addFolder({ name, createdBy: 'local' });
    setDraft('');
    setAdding(false);
  };

  const handleRename = (id: string) => {
    const name = editDraft.trim();
    if (name) updateFolder(id, { name });
    setEditingId(null);
  };

  const handleDrop = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    setDragOverKey(null);
    const cycleId = e.dataTransfer.getData(CYCLE_DRAG_MIME) || e.dataTransfer.getData('text/plain');
    if (!cycleId) return;
    onMoveCycleToFolder(cycleId, folderId);
    showToast('success', folderId ? '폴더로 이동했습니다.' : '폴더에서 꺼냈습니다.');
  };

  const dropHandlers = (folderId: string | null, key: string) => ({
    onDragOver: (e: React.DragEvent) => {
      const hasType = e.dataTransfer.types.includes(CYCLE_DRAG_MIME) || e.dataTransfer.types.includes('text/plain');
      if (!hasType) return;
      e.preventDefault();
      setDragOverKey(key);
    },
    onDragLeave: () => {
      if (dragOverKey === key) setDragOverKey(null);
    },
    onDrop: (e: React.DragEvent) => handleDrop(e, folderId),
  });

  const Item = ({
    sel, key: k, label, count, dropId, iconBullet, accessory,
  }: {
    sel: FolderSelection;
    key?: string;
    label: string;
    count: number;
    dropId: string | null;
    iconBullet?: React.ReactNode;
    accessory?: React.ReactNode;
  }) => {
    const active = isSame(selected, sel);
    const dragKey = `k:${k ?? label}`;
    const over = dragOverKey === dragKey;
    return (
      <button
        type="button"
        onClick={() => onSelect(sel)}
        {...(dropId !== undefined ? dropHandlers(dropId, dragKey) : {})}
        className={cn(
          'w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors text-left',
          active
            ? 'bg-pink-005 text-pink-060 font-semibold'
            : 'text-gray-070 hover:bg-gray-005',
          over && 'ring-2 ring-pink-040 bg-pink-005',
        )}
      >
        {iconBullet}
        <span className="flex-1 truncate">{label}</span>
        {accessory}
        <span className="text-[11px] text-gray-040 tabular-nums">{count}</span>
      </button>
    );
  };

  return (
    <aside className="flex flex-col gap-4 w-48 shrink-0" aria-label="폴더 사이드">
      <div className="space-y-1">
        <Item sel={{ kind: 'all' }} label="전체" count={cycles.filter(c => !c.archivedAt).length} dropId={null}
              iconBullet={<span className="w-1.5 h-1.5 rounded-full bg-gray-030" />} />
        <Item sel={{ kind: 'overdue' }} label="지연" count={countFor(cycles, { kind: 'overdue' })} dropId={null}
              iconBullet={<MsWarningIcon size={12} className="text-red-050" />} />
        <Item sel={{ kind: 'this_quarter' }} label="이번 분기" count={countFor(cycles, { kind: 'this_quarter' })} dropId={null}
              iconBullet={<MsCalendarIcon size={12} className="text-blue-060" />} />
        <Item sel={{ kind: 'none' }} label="폴더 미지정" count={countFor(cycles, { kind: 'none' })} dropId={null}
              iconBullet={<span className="w-1.5 h-1.5 rounded-full bg-gray-020" />} />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between px-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-040">폴더</span>
          <button
            type="button"
            onClick={() => { setAdding(true); setDraft(''); }}
            className="rounded p-0.5 text-gray-040 hover:text-gray-080 hover:bg-gray-005"
            title="새 폴더"
          >
            <MsPlusIcon size={12} />
          </button>
        </div>
        {folders.length === 0 && !adding && (
          <p className="px-2 py-1 text-[11px] text-gray-040">폴더 없음</p>
        )}
        {[...folders].sort((a, b) => a.order - b.order).map(f => {
          const dragKey = `folder:${f.id}`;
          const over = dragOverKey === dragKey;
          const count = countFor(cycles, { kind: 'folder', id: f.id });
          const active = isSame(selected, { kind: 'folder', id: f.id });
          if (editingId === f.id) {
            return (
              <div key={f.id} className="flex items-center gap-1 px-2 py-1">
                <input
                  autoFocus
                  value={editDraft}
                  onChange={e => setEditDraft(e.target.value)}
                  onBlur={() => handleRename(f.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRename(f.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="flex-1 rounded border border-pink-040 px-2 py-0.5 text-sm outline-none"
                />
              </div>
            );
          }
          return (
            <div
              key={f.id}
              className="group flex items-center gap-1"
              {...dropHandlers(f.id, dragKey)}
            >
              <button
                type="button"
                onClick={() => onSelect({ kind: 'folder', id: f.id })}
                className={cn(
                  'flex-1 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors text-left',
                  active
                    ? 'bg-pink-005 text-pink-060 font-semibold'
                    : 'text-gray-070 hover:bg-gray-005',
                  over && 'ring-2 ring-pink-040 bg-pink-005',
                )}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: f.color }} />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-[11px] text-gray-040 tabular-nums">{count}</span>
              </button>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                <button
                  type="button"
                  title="이름 변경"
                  onClick={() => { setEditingId(f.id); setEditDraft(f.name); }}
                  className="p-1 text-gray-040 hover:text-gray-080"
                >
                  <MsEditIcon size={10} />
                </button>
                <button
                  type="button"
                  title="폴더 삭제"
                  onClick={() => {
                    if (count > 0 && !confirm(`폴더 "${f.name}"에 ${count}개 사이클이 있습니다. 삭제 시 사이클은 '폴더 미지정'으로 이동합니다. 계속?`)) return;
                    deleteFolder(f.id);
                    if (active) onSelect({ kind: 'all' });
                  }}
                  className="p-1 text-gray-040 hover:text-red-050"
                >
                  <MsDeleteIcon size={10} />
                </button>
              </div>
            </div>
          );
        })}
        {adding && (
          <div className="flex items-center gap-1 px-2 py-1">
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={handleAdd}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') setAdding(false);
              }}
              placeholder="폴더 이름"
              className="flex-1 rounded border border-pink-040 px-2 py-0.5 text-sm outline-none"
            />
          </div>
        )}
      </div>
    </aside>
  );
}
