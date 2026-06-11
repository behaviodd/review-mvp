/**
 * 구성원 영역의 뷰 전환 토글 — 리스트(/team) ↔ 조직도 표(/team/org-chart).
 *
 * 헤더 Tab strip 우측(tabActions)에 배치. 버튼 스타일은 Team.tsx 의
 * 재직상태 필터/정렬 버튼(h-6 px-2 text-xs font-bold)과 동일하게 맞춰 시각 일관.
 */
import { useNavigate } from 'react-router-dom';
import { List, Network } from 'lucide-react';

type View = 'list' | 'chart';

const OPTIONS: { key: View; label: string; icon: typeof List; to: string }[] = [
  { key: 'list',  label: '리스트', icon: List,    to: '/team' },
  { key: 'chart', label: '조직도', icon: Network, to: '/team/org-chart' },
];

export function TeamViewToggle({ current }: { current: View }) {
  const navigate = useNavigate();
  return (
    <div className="inline-flex items-center gap-1" role="tablist" aria-label="구성원 보기 전환">
      {OPTIONS.map(({ key, label, icon: Icon, to }) => {
        const active = current === key;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => { if (!active) navigate(to); }}
            className={`inline-flex items-center gap-1 h-6 px-2 text-xs font-bold rounded-md border transition-colors ${
              active
                ? 'bg-interaction-pressed border-bd-primary text-fg-default'
                : 'border-bd-primary text-fg-default hover:bg-interaction-hovered'
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        );
      })}
    </div>
  );
}
