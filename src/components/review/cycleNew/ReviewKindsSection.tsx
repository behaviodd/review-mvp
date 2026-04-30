import type { Dispatch, SetStateAction } from 'react';
import { MsCheckbox, MsInput, MsSelect } from '../../ui/MsControl';
import { cn } from '../../../utils/cn';
import type { PeerSelectionPolicy, ReviewKind } from '../../../types';

interface KindsFormSlice {
  reviewKinds?: ReviewKind[];
  peerSelection?: PeerSelectionPolicy;
  // R3
  downwardReviewerRanks?: number[];
}

// R3: UI 노출 차수 범위 (1~5). 데이터 모델은 무제한이지만 UX 단순화 위해 5차로 제한.
const RANK_OPTIONS: { rank: number; label: string }[] = [
  { rank: 1, label: '1차 (직속)' },
  { rank: 2, label: '2차' },
  { rank: 3, label: '3차' },
  { rank: 4, label: '4차' },
  { rank: 5, label: '5차' },
];

interface Props<F extends KindsFormSlice> {
  form: F;
  setForm: Dispatch<SetStateAction<F>>;
}

const KIND_META: { value: ReviewKind; label: string; desc: string }[] = [
  { value: 'self',     label: '자기평가', desc: '본인이 자신을 평가' },
  { value: 'downward', label: '조직장 리뷰', desc: '조직장이 팀원을 평가' },
  { value: 'upward',   label: '상향 리뷰', desc: '팀원이 조직장을 평가' },
  { value: 'peer',     label: '동료 리뷰', desc: '동료 N명이 상호 평가' },
];

export function ReviewKindsSection<F extends KindsFormSlice>({ form, setForm }: Props<F>) {
  const current = form.reviewKinds ?? ['self', 'downward'];

  const toggle = (k: ReviewKind) => {
    const has = current.includes(k);
    const next = has ? current.filter(x => x !== k) : [...current, k];
    setForm(f => ({ ...f, reviewKinds: next }));
    // peer 빠지면 peerSelection 클리어
    if (has && k === 'peer') setForm(f => ({ ...f, peerSelection: undefined }));
    // peer 들어오면 기본 peerSelection 세팅
    if (!has && k === 'peer' && !form.peerSelection) {
      setForm(f => ({
        ...f,
        peerSelection: { method: 'admin_assigns', minPeers: 3, maxPeers: 5 },
      }));
    }
  };

  const includesPeer = current.includes('peer');
  const includesDownward = current.includes('downward');
  const ranks = form.downwardReviewerRanks ?? [1];

  const toggleRank = (rank: number) => {
    const has = ranks.includes(rank);
    let next = has ? ranks.filter(r => r !== rank) : [...ranks, rank];
    next = next.sort((a, b) => a - b);
    if (next.length === 0) next = [1]; // 최소 1차는 유지
    setForm(f => ({ ...f, downwardReviewerRanks: next }));
  };

  const updatePeer = (patch: Partial<PeerSelectionPolicy>) => {
    setForm(f => ({
      ...f,
      peerSelection: { method: 'admin_assigns', minPeers: 3, maxPeers: 5, ...(f.peerSelection ?? {}), ...patch },
    }));
  };

  return (
    <div className="rounded-xl border border-gray-010 bg-white p-4 space-y-3">
      <header>
        <h3 className="text-sm font-semibold text-gray-080">리뷰 유형</h3>
        <p className="text-[11px] text-fg-subtlest">이 사이클에서 생성할 리뷰 종류를 선택합니다. 기본은 자기평가 + 조직장 리뷰.</p>
      </header>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {KIND_META.map(opt => {
          const active = current.includes(opt.value);
          return (
            <label
              key={opt.value}
              className={cn(
                'flex flex-col gap-1 rounded-lg border px-3 py-2 cursor-pointer transition-colors',
                active ? 'border-pink-040 bg-pink-005' : 'border-gray-010 bg-white hover:bg-gray-005',
              )}
            >
              <div className="flex items-center gap-2">
                <MsCheckbox checked={active} onChange={() => toggle(opt.value)} />
                <span className={cn('text-sm font-semibold', active ? 'text-pink-060' : 'text-gray-080')}>
                  {opt.label}
                </span>
              </div>
              <p className="text-[11px] text-fg-subtle">{opt.desc}</p>
            </label>
          );
        })}
      </div>

      {includesDownward && (
        <div className="rounded-lg border border-blue-010 bg-blue-005/40 p-3 space-y-2">
          <p className="text-xs font-semibold text-blue-070">평가권자 차수</p>
          <div className="flex flex-wrap gap-2">
            {RANK_OPTIONS.map(opt => {
              const active = ranks.includes(opt.rank);
              return (
                <label
                  key={opt.rank}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 cursor-pointer transition-colors',
                    active ? 'border-blue-040 bg-white' : 'border-gray-010 bg-white hover:bg-gray-005',
                  )}
                >
                  <MsCheckbox checked={active} onChange={() => toggleRank(opt.rank)} />
                  <span className={cn('text-xs font-semibold', active ? 'text-blue-070' : 'text-gray-070')}>
                    {opt.label}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-[11px] text-fg-subtle">
            선택한 차수의 평가권자가 각각 1건씩 조직장 리뷰를 작성합니다.
            {' '}1차는 직속 매니저(평가권 또는 조직장 자동 매핑), 2차 이상은 명시적으로 배정된 평가권자만 인정됩니다.
            {' '}1차/2차가 동일인이면 1건만 생성됩니다.
          </p>
        </div>
      )}

      {includesPeer && (
        <div className="rounded-lg border border-pink-010 bg-pink-005/40 p-3 space-y-2">
          <p className="text-xs font-semibold text-pink-060">동료 선택 방식</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <MsSelect
              value={form.peerSelection?.method ?? 'admin_assigns'}
              onChange={e => updatePeer({ method: e.target.value as PeerSelectionPolicy['method'] })}
            >
              <option value="admin_assigns">관리자가 배정</option>
              <option value="reviewee_picks">대상자가 선택</option>
              <option value="leader_approves">대상자 제안 → 리더 승인</option>
            </MsSelect>
            <MsInput
              type="number"
              min={1}
              max={20}
              value={String(form.peerSelection?.minPeers ?? 3)}
              onChange={e => updatePeer({ minPeers: Math.max(1, Number(e.target.value) || 1) })}
              label="최소 동료 수"
            />
            <MsInput
              type="number"
              min={1}
              max={20}
              value={String(form.peerSelection?.maxPeers ?? 5)}
              onChange={e => updatePeer({ maxPeers: Math.max(1, Number(e.target.value) || 1) })}
              label="최대 동료 수"
            />
          </div>
          <p className="text-[11px] text-fg-subtle">
            <strong>관리자가 배정</strong>: 운영 센터에서 관리자가 직접 선택.
            {' · '}
            <strong>대상자가 선택</strong>: 피평가자 본인이 동료를 고릅니다.
            {' · '}
            <strong>리더 승인</strong>: 대상자가 제안한 동료를 매니저가 승인·반려합니다.
          </p>
        </div>
      )}
    </div>
  );
}
