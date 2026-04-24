import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../utils/cn';
import { MsArticleIcon, MsProfileIcon, MsRefreshIcon, MsCancelIcon } from '../ui/MsIcons';

type Result =
  | { kind: 'cycle'; id: string; title: string; subtitle: string }
  | { kind: 'template'; id: string; title: string; subtitle: string }
  | { kind: 'user'; id: string; title: string; subtitle: string };

const KIND_META: Record<Result['kind'], { label: string; icon: typeof MsArticleIcon; tone: string }> = {
  cycle:    { label: '사이클',   icon: MsRefreshIcon,  tone: 'text-pink-060 bg-pink-005' },
  template: { label: '템플릿',   icon: MsArticleIcon,  tone: 'text-blue-060 bg-blue-005' },
  user:     { label: '구성원',   icon: MsProfileIcon,  tone: 'text-green-060 bg-green-005' },
};

/**
 * 전역 검색. ⌘K / Ctrl+K 로 열기.
 * 간단한 in-memory 텍스트 매칭. 결과 클릭 시 해당 라우트로 이동.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const { currentUser } = useAuthStore();
  const cycles = useReviewStore(s => s.cycles);
  const templates = useReviewStore(s => s.templates);
  const users = useTeamStore(s => s.users);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (open && e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) { setQuery(''); setActive(0); }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: Result[] = [];
    const isAdmin = currentUser?.role === 'admin';
    for (const c of cycles) {
      if (hits.length >= 20) break;
      if (c.title.toLowerCase().includes(q) || (c.tags ?? []).some(t => t.toLowerCase().includes(q))) {
        hits.push({ kind: 'cycle', id: c.id, title: c.title, subtitle: `${c.type === 'scheduled' ? '정기' : '수시'} · ${c.status}` });
      }
    }
    if (isAdmin) {
      for (const t of templates) {
        if (hits.length >= 20) break;
        if (t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)) {
          hits.push({ kind: 'template', id: t.id, title: t.name, subtitle: t.description || '설명 없음' });
        }
      }
    }
    for (const u of users) {
      if (hits.length >= 20) break;
      const hay = `${u.name} ${u.email} ${u.department} ${u.position}`.toLowerCase();
      if (hay.includes(q)) {
        hits.push({ kind: 'user', id: u.id, title: u.name, subtitle: `${u.position} · ${u.department}` });
      }
    }
    return hits;
  }, [query, cycles, templates, users, currentUser]);

  useEffect(() => { setActive(0); }, [query]);

  const handleSelect = (r: Result) => {
    if (r.kind === 'cycle') navigate(`/cycles/${r.id}`);
    else if (r.kind === 'template') navigate(`/templates/${r.id}`);
    else if (r.kind === 'user') navigate(`/team`);
    setOpen(false);
  };

  const onInputKey: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && results[active]) handleSelect(results[active]);
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-24 p-4">
      <div className="absolute inset-0 bg-overlay-048" onClick={() => setOpen(false)} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="전역 검색"
        className="relative w-full max-w-xl rounded-2xl bg-white shadow-modal overflow-hidden"
      >
        <div className="flex items-center gap-2 border-b border-gray-010 px-4 py-2.5">
          <MsArticleIcon size={14} className="text-gray-040" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="사이클·템플릿·구성원 검색"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-040"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-gray-040 hover:bg-gray-005 hover:text-gray-080"
            aria-label="닫기"
          >
            <MsCancelIcon size={14} />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {!query.trim() ? (
            <p className="px-4 py-8 text-center text-xs text-gray-040">이름·제목·태그를 입력해 검색하세요.</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-gray-040">검색 결과가 없습니다.</p>
          ) : (
            <ul className="py-1">
              {results.map((r, idx) => {
                const meta = KIND_META[r.kind];
                const Icon = meta.icon;
                return (
                  <li key={`${r.kind}-${r.id}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => handleSelect(r)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                        active === idx ? 'bg-gray-005' : 'hover:bg-gray-001',
                      )}
                    >
                      <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', meta.tone)}>
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-080 truncate">{r.title}</p>
                        <p className="text-[11px] text-gray-040 truncate">{meta.label} · {r.subtitle}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-gray-010 bg-gray-001 px-4 py-2 text-[10px] text-gray-050 flex items-center justify-between">
          <span>⌘K · Ctrl+K 로 열기 · ↑↓ 이동 · Enter 선택 · Esc 닫기</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
