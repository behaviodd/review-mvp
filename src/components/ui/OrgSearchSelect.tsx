/**
 * 조직 검색+선택 드롭다운.
 * 조직명·상위경로로 실시간 필터링, 키보드 탐색 지원. 계층 순서(DFS)로 정렬.
 * 드롭다운은 Portal로 body에 마운트해 모달 overflow clip 우회.
 * (UserSearchSelect 와 동일한 UX 패턴)
 */
import { useState, useRef, useEffect, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { OrgUnit } from '../../types';
import { getOrgDepth, getOrgLevelLabel } from '../../utils/teamUtils';
import { MsSearchIcon, MsCancelIcon } from './MsIcons';

interface Props {
  label?: string;
  value: string;          // selected OrgUnit.id, '' = 미지정
  onChange: (orgId: string) => void;
  orgUnits: OrgUnit[];
  placeholder?: string;
  clearLabel?: string;
}

/** 계층 순서(루트→자식 DFS, 각 단계는 order 순)로 평탄화 */
function flattenOrgs(units: OrgUnit[]): OrgUnit[] {
  const byParent = new Map<string, OrgUnit[]>();
  const roots: OrgUnit[] = [];
  for (const u of units) {
    if (u.parentId) {
      const arr = byParent.get(u.parentId) ?? [];
      arr.push(u);
      byParent.set(u.parentId, arr);
    } else {
      roots.push(u);
    }
  }
  const sortFn = (a: OrgUnit, b: OrgUnit) => (a.order - b.order) || a.name.localeCompare(b.name);
  const out: OrgUnit[] = [];
  const visit = (u: OrgUnit) => {
    out.push(u);
    (byParent.get(u.id) ?? []).slice().sort(sortFn).forEach(visit);
  };
  roots.slice().sort(sortFn).forEach(visit);
  // 부모가 누락된 고아 노드는 끝에 보존
  const seen = new Set(out.map(u => u.id));
  for (const u of units) if (!seen.has(u.id)) out.push(u);
  return out;
}

export function OrgSearchSelect({
  label,
  value,
  onChange,
  orgUnits,
  placeholder = '조직 검색…',
  clearLabel = '선택 안 함',
}: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const byId = useMemo(() => new Map(orgUnits.map(u => [u.id, u])), [orgUnits]);
  const ordered = useMemo(() => flattenOrgs(orgUnits), [orgUnits]);

  const selectedOrg = byId.get(value) ?? null;

  // 상위 경로 (루트 → 부모, self 제외)
  const pathOf = (u: OrgUnit): string => {
    const names: string[] = [];
    let cur = u.parentId ? byId.get(u.parentId) : undefined;
    let guard = 0;
    while (cur && guard++ < 20) {
      names.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return names.join(' › ');
  };

  const levelOf = (u: OrgUnit): string => getOrgLevelLabel(getOrgDepth(u, orgUnits));

  // 필터링 — 조직명 또는 상위경로 매칭
  const filtered = query.trim()
    ? ordered.filter(u => {
        const q = query.toLowerCase();
        return u.name.toLowerCase().includes(q) || pathOf(u).toLowerCase().includes(q);
      })
    : ordered;

  const calcPosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropHeight = Math.min(300, spaceBelow - 8);
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: dropHeight,
      zIndex: 9999,
    });
  };

  const openDropdown = () => {
    calcPosition();
    setQuery('');
    setHighlightIdx(0);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const select = (orgId: string) => {
    onChange(orgId);
    setOpen(false);
    setQuery('');
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = containerRef.current?.contains(target);
      const inPortal = document.getElementById('oss-portal-root')?.contains(target);
      if (!inTrigger && !inPortal) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const update = () => calcPosition();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    const el = listRef.current?.children[highlightIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const total = filtered.length + 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(i => (i + 1) % total);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(i => (i - 1 + total) % total);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx === 0) select('');
      else select(filtered[highlightIdx - 1]?.id ?? '');
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const dropdown = open ? createPortal(
    <div
      id="oss-portal-root"
      style={dropdownStyle}
      className="rounded-xl border border-bd-default bg-bg-token-default shadow-lg overflow-hidden flex flex-col animate-[fadeSlideDown_0.15s_ease]"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-bd-default flex-shrink-0">
        <MsSearchIcon size={14} className="text-fg-subtlest flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setHighlightIdx(0); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 text-sm bg-transparent outline-none text-fg-default placeholder:text-fg-subtlest"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            className="text-fg-subtlest hover:text-fg-default"
          >
            <MsCancelIcon size={12} />
          </button>
        )}
      </div>

      <ul ref={listRef} className="overflow-y-auto py-1">
        <li>
          <button
            type="button"
            onClick={() => select('')}
            onMouseEnter={() => setHighlightIdx(0)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
              highlightIdx === 0 ? 'bg-interaction-hovered' : 'hover:bg-interaction-hovered'
            } ${!value ? 'text-fg-brand1 font-semibold' : 'text-fg-subtle'}`}
          >
            <span className="size-6 rounded-full bg-gray-010 flex items-center justify-center flex-shrink-0 text-[10px] text-fg-subtlest">—</span>
            {clearLabel}
          </button>
        </li>

        {filtered.length === 0 ? (
          <li className="px-3 py-4 text-sm text-fg-subtlest text-center">
            '{query}' 검색 결과 없음
          </li>
        ) : (
          filtered.map((u, i) => {
            const idx = i + 1;
            const path = pathOf(u);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => select(u.id)}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    highlightIdx === idx ? 'bg-interaction-hovered' : 'hover:bg-interaction-hovered'
                  } ${value === u.id ? 'text-fg-brand1' : 'text-fg-default'}`}
                >
                  <span className="flex-1 min-w-0 text-left">
                    <span className="flex items-center gap-1.5">
                      <span className="font-medium truncate">{u.name}</span>
                      <span className="px-1 py-0.5 text-[10px] font-medium bg-gray-010 text-fg-subtlest rounded flex-shrink-0">{levelOf(u)}</span>
                    </span>
                    {path && (
                      <span className="block text-[11px] text-fg-subtlest truncate">{path}</span>
                    )}
                  </span>
                  {value === u.id && (
                    <span className="text-xs text-fg-brand1 flex-shrink-0">현재</span>
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>,
    document.body,
  ) : null;

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-medium text-gray-060 mb-1 cursor-pointer"
          onClick={openDropdown}
        >
          {label}
        </label>
      )}

      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={openDropdown}
        className="w-full flex items-center gap-2 h-10 px-3 rounded-lg border border-bd-default bg-bg-token-default text-left hover:border-bd-focused focus:outline-none focus:ring-2 focus:ring-bd-focused transition-colors"
      >
        {selectedOrg ? (
          <span className="flex-1 flex items-center gap-1.5 min-w-0">
            <span className="text-sm text-fg-default truncate">{selectedOrg.name}</span>
            <span className="px-1 py-0.5 text-[10px] font-medium bg-gray-010 text-fg-subtlest rounded flex-shrink-0">{levelOf(selectedOrg)}</span>
          </span>
        ) : (
          <span className="flex-1 text-sm text-fg-subtlest">{clearLabel}</span>
        )}
        <MsSearchIcon size={14} className="text-fg-subtlest flex-shrink-0" />
      </button>

      {dropdown}
    </div>
  );
}
