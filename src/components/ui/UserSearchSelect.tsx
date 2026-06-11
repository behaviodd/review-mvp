/**
 * 사용자 검색+선택 드롭다운.
 * 이름·직위·이메일로 실시간 필터링, 키보드 탐색 지원.
 * 드롭다운은 Portal로 body에 마운트해 모달 overflow clip 우회.
 */
import { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import type { User } from '../../types';
import { UserAvatar } from './UserAvatar';
import { MsSearchIcon, MsCancelIcon } from './MsIcons';

interface Props {
  label?: string;
  value: string;          // selected User.id, '' = 미지정
  onChange: (userId: string) => void;
  users: User[];
  placeholder?: string;
  clearLabel?: string;
}

export function UserSearchSelect({
  label,
  value,
  onChange,
  users,
  placeholder = '조직장 검색…',
  clearLabel = '미지정',
}: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const listRef      = useRef<HTMLUListElement>(null);

  const selectedUser = users.find(u => u.id === value) ?? null;

  // 필터링
  const filtered = query.trim()
    ? users.filter(u => {
        const q = query.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          (u.position ?? '').toLowerCase().includes(q) ||
          (u.email ?? '').toLowerCase().includes(q) ||
          (u.department ?? '').toLowerCase().includes(q)
        );
      })
    : users;

  // 트리거 위치 계산 → portal 드롭다운 좌표 설정
  const calcPosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropHeight = Math.min(260, spaceBelow - 8);
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: dropHeight,
      zIndex: 9999,
    });
  };

  // 드롭다운 열기
  const openDropdown = () => {
    calcPosition();
    setQuery('');
    setHighlightIdx(0);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // 선택
  const select = (userId: string) => {
    onChange(userId);
    setOpen(false);
    setQuery('');
  };

  // 바깥 클릭 → 닫기 (portal이 containerRef 밖이므로 document-level 처리)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = containerRef.current?.contains(target);
      const inPortal  = (document.getElementById('uss-portal-root'))?.contains(target);
      if (!inTrigger && !inPortal) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // 스크롤/리사이즈 시 위치 보정
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

  // 하이라이트 스크롤
  useEffect(() => {
    const el = listRef.current?.children[highlightIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx]);

  // 키보드 탐색
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
      id="uss-portal-root"
      style={dropdownStyle}
      className="rounded-xl border border-bd-default bg-bg-token-default shadow-lg overflow-hidden flex flex-col animate-[fadeSlideDown_0.15s_ease]"
    >
      {/* 검색 입력 */}
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

      {/* 목록 */}
      <ul ref={listRef} className="overflow-y-auto py-1">
        {/* 미지정 */}
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
                  <UserAvatar user={u} className="size-6 rounded-full flex-shrink-0" />
                  <span className="flex-1 min-w-0 text-left">
                    <span className="font-medium">{u.name}</span>
                    {u.position && (
                      <span className="text-fg-subtle ml-1">· {u.position}</span>
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

      {/* 트리거 */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={openDropdown}
        className="w-full flex items-center gap-2 h-10 px-3 rounded-lg border border-bd-default bg-bg-token-default text-left hover:border-fg-brand1 focus:outline-none focus:ring-2 focus:ring-fg-brand1/30 transition-colors"
      >
        {selectedUser ? (
          <>
            <UserAvatar user={selectedUser} className="size-6 rounded-full flex-shrink-0" />
            <span className="flex-1 text-sm text-fg-default truncate">
              {selectedUser.name}
              {selectedUser.position ? <span className="text-fg-subtle ml-1">· {selectedUser.position}</span> : null}
            </span>
          </>
        ) : (
          <span className="flex-1 text-sm text-fg-subtlest">{clearLabel}</span>
        )}
        <MsSearchIcon size={14} className="text-fg-subtlest flex-shrink-0" />
      </button>

      {dropdown}
    </div>
  );
}
