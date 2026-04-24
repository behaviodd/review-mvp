import { useMemo, useState } from 'react';
import { MsInput, MsCheckbox } from '../../ui/MsControl';
import { MsButton } from '../../ui/MsButton';
import { UserAvatar } from '../../ui/UserAvatar';
import { getSmallestOrg } from '../../../utils/userUtils';
import type { User } from '../../../types';

interface Props {
  candidates: User[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function CustomTargetPicker({ candidates, selectedIds, onChange }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.department ?? '').toLowerCase().includes(q)
    );
  }, [candidates, query]);

  const selectedSet = new Set(selectedIds);
  const toggle = (id: string) => {
    if (selectedSet.has(id)) onChange(selectedIds.filter(x => x !== id));
    else onChange([...selectedIds, id]);
  };
  const selectAll = () => onChange(Array.from(new Set([...selectedIds, ...filtered.map(u => u.id)])));
  const clearAll = () => onChange(selectedIds.filter(id => !filtered.some(u => u.id === id)));

  return (
    <div className="rounded-xl border border-gray-010 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MsInput
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="이름·이메일·부서 검색"
          className="flex-1"
        />
        <MsButton variant="ghost" size="sm" onClick={selectAll}>보이는 전체</MsButton>
        <MsButton variant="ghost" size="sm" onClick={clearAll}>보이는 해제</MsButton>
      </div>
      <p className="text-xs text-gray-040">
        선택된 <strong className="text-gray-080">{selectedIds.length}명</strong> · 후보 {filtered.length}명
      </p>
      <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-005 divide-y divide-gray-005">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-gray-040">검색 결과가 없습니다.</p>
        ) : (
          filtered.map(u => {
            const checked = selectedSet.has(u.id);
            return (
              <label
                key={u.id}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                  checked ? 'bg-pink-005/50' : 'hover:bg-gray-001'
                }`}
              >
                <MsCheckbox checked={checked} onChange={() => toggle(u.id)} />
                <UserAvatar user={u} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-080 truncate">{u.name}</p>
                  <p className="text-[11px] text-gray-040 truncate">{u.position} · {getSmallestOrg(u)}</p>
                </div>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
