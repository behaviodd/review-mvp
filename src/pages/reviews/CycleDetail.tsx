import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { Pill } from '../../components/ui/Pill';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useTeamStore } from '../../stores/teamStore';
import { createCycleSubmissions } from '../../utils/createCycleSubmissions';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { formatDate, daysUntil } from '../../utils/dateUtils';
import { Eye } from 'lucide-react';
import {
  MsCalendarIcon, MsCancelIcon, MsEditIcon,
  MsDownloadIcon, MsRefreshIcon, MsWarningIcon, MsStarIcon, MsDeleteIcon,
  MsSettingIcon, MsUsersIcon, MsBarChart2Icon,
} from '../../components/ui/MsIcons';
import { useShowToast } from '../../components/ui/Toast';
import { exportCycleToCSV } from '../../utils/exportUtils';
import { syncCycle } from '../../utils/sheetsSync';
import { useSheetsSyncStore } from '../../stores/sheetsSyncStore';
import type { ReviewCycle, ReviewStatus, ReviewSubmission, ReviewTemplate, User } from '../../types';
import { MsButton } from '../../components/ui/MsButton';
import { MsInput } from '../../components/ui/MsControl';
import { getSmallestOrg } from '../../utils/userUtils';
import { OpsCenter } from '../../components/review/OpsCenter';
import { SubmissionActionRail } from '../../components/review/SubmissionActionRail';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuthStore } from '../../stores/authStore';
import { PreflightModal } from '../../components/review/modals/PreflightModal';
import { DryRunModal } from '../../components/review/modals/DryRunModal';
import { CycleSettingsDrawer } from '../../components/review/CycleSettingsDrawer';
import { runPreflight, type PreflightResult } from '../../utils/cyclePreflight';
import { resolveEffectiveOrgData } from '../../utils/snapshotResolver';
import { getEffectiveTemplate } from '../../utils/effectiveTemplate';
import { resolveTargetMembers } from '../../utils/resolveTargets';

// 상태 전환 정의
const STATUS_TRANSITIONS: Partial<Record<ReviewStatus, {
  next: ReviewStatus;
  label: string;
  isDanger: boolean;
  msg: string;
}>> = {
  draft: {
    next: 'self_review',
    label: '사전 점검 후 발행',
    isDanger: false,
    msg: '사전 점검을 통과하면 대상 구성원들이 자기평가를 시작할 수 있습니다.',
  },
  self_review: {
    next: 'manager_review',
    label: '조직장 리뷰 시작',
    isDanger: false,
    msg: '자기평가 단계를 마감하고 조직장 리뷰 단계로 전환합니다.',
  },
  manager_review: {
    next: 'closed',
    label: '리뷰 종료',
    isDanger: true,
    msg: '모든 리뷰를 종료합니다. 종료 후에는 되돌릴 수 없습니다.',
  },
  active: {
    next: 'closed',
    label: '리뷰 종료',
    isDanger: true,
    msg: '모든 리뷰를 종료합니다. 종료 후에는 되돌릴 수 없습니다.',
  },
};

// ─── 제출 리뷰 사이드 패널 (자기평가 ↔ 조직장 리뷰 병렬 비교) ─────────────────
const RATING_LABELS = ['', '매우 미흡', '미흡', '보통', '우수', '매우 우수'];

function AnswerView({ q, ans }: { q: ReviewTemplate['questions'][0]; ans: ReviewSubmission['answers'][0] | undefined }) {
  if (q.type === 'rating' || q.type === 'competency') {
    if (ans?.ratingValue == null) return <p className="text-xs text-gray-030 italic">미응답</p>;
    const rv = ans.ratingValue;
    return (
      <div className="space-y-1.5">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-colors ${
              n === rv ? 'bg-pink-050 text-white shadow-sm' : n < rv ? 'bg-pink-010 text-pink-040' : 'bg-gray-010 text-gray-030'
            }`}>{n}</div>
          ))}
        </div>
        <span className="text-xs font-semibold text-pink-060">{RATING_LABELS[rv]}</span>
      </div>
    );
  }
  if (q.type === 'multiple_choice') {
    const opts = ans?.selectedOptions ?? [];
    if (!opts.length) return <p className="text-xs text-gray-030 italic">미응답</p>;
    return (
      <div className="flex flex-wrap gap-1">
        {opts.map(v => (
          <span key={v} className="px-2 py-0.5 text-xs font-medium bg-pink-005 text-pink-060 rounded-full border border-pink-010">{v}</span>
        ))}
      </div>
    );
  }
  if (!ans?.textValue?.trim()) return <p className="text-xs text-gray-030 italic">미응답</p>;
  return <p className="text-xs text-gray-070 whitespace-pre-wrap leading-relaxed">{ans.textValue}</p>;
}

function SubmissionViewPanel({
  member,
  selfSub,
  managerSub,
  reviewer,
  template,
  cycle,
  currentUser,
  onClose,
}: {
  member: User;
  selfSub: ReviewSubmission | undefined;
  managerSub: ReviewSubmission | undefined;
  reviewer: User | undefined;
  template: ReviewTemplate | undefined;
  cycle: ReviewCycle;
  currentUser: User | null;
  onClose: () => void;
}) {
  const allQuestions = template?.questions ?? [];

  const ColHeader = ({
    label,
    sub,
    extra,
    accent,
  }: {
    label: string;
    sub: ReviewSubmission | undefined;
    extra?: React.ReactNode;
    accent: string;
  }) => (
    <div className={`px-5 py-3 ${accent}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-080">{label}</span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
          sub?.status === 'submitted'
            ? 'bg-green-010 text-green-060'
            : sub?.status === 'in_progress'
            ? 'bg-yellow-005 text-yellow-060'
            : 'bg-gray-010 text-gray-040'
        }`}>
          {sub?.status === 'submitted' ? '제출 완료' : sub?.status === 'in_progress' ? '작성 중' : '미시작'}
        </span>
      </div>
      {sub?.submittedAt && (
        <p className="text-[11px] text-gray-040 mt-0.5">{formatDate(sub.submittedAt)} 제출</p>
      )}
      {extra}
    </div>
  );

  /* 종합 평점 행 — 양쪽 중 하나라도 있을 때만 표시 */
  const showOverall = selfSub?.overallRating != null || managerSub?.overallRating != null;

  return createPortal(
    <>
      {/* 배경 오버레이 */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* 사이드 패널 — 넓게 */}
      <div className="fixed top-0 right-0 h-screen w-full max-w-5xl bg-white shadow-2xl z-50 flex flex-col">

        {/* 패널 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-010 flex-shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <UserAvatar user={member} size="md" />
            <div>
              <p className="text-base font-semibold text-gray-099">{member.name}</p>
              <p className="text-xs text-gray-040 mt-0.5">{member.position} · {getSmallestOrg(member)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-010 rounded-lg transition-colors">
            <MsCancelIcon size={20} className="text-gray-050" />
          </button>
        </div>

        <SubmissionActionRail
          cycle={cycle}
          currentUser={currentUser}
          selfSub={selfSub}
          managerSub={managerSub}
          revieweeId={member.id}
          revieweeName={member.name}
          reviewerName={reviewer?.name}
        />

        {/* 컬럼 헤더 */}
        <div className="grid grid-cols-2 border-b border-gray-010 flex-shrink-0 divide-x divide-gray-010">
          <ColHeader
            label="자기평가"
            sub={selfSub}
            accent="bg-blue-005/60"
          />
          <ColHeader
            label="조직장 리뷰"
            sub={managerSub}
            accent="bg-green-005/60"
            extra={reviewer && (
              <p className="text-[11px] text-gray-040 mt-0.5">
                작성자: <strong className="text-gray-060">{reviewer.name}</strong>
              </p>
            )}
          />
        </div>

        {/* 종합 평점 비교 행 */}
        {showOverall && (
          <div className="grid grid-cols-2 divide-x divide-gray-010 border-b border-gray-010 flex-shrink-0">
            {[selfSub, managerSub].map((s, i) => (
              <div key={i} className={`flex items-center gap-3 px-5 py-3 ${i === 0 ? 'bg-blue-005/40' : 'bg-green-005/40'}`}>
                {s?.overallRating != null ? (
                  <>
                    <MsStarIcon size={12} className="text-pink-040 flex-shrink-0" />
                    <div>
                      <span className="text-[10px] text-gray-040 font-medium">종합 평점</span>
                      <p className="text-base font-bold text-pink-060 leading-none mt-0.5">
                        {s.overallRating.toFixed(1)}
                        <span className="text-xs font-medium ml-1">{RATING_LABELS[Math.round(s.overallRating)] ?? ''}</span>
                      </p>
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-gray-030 italic">종합 평점 없음</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 질문별 답변 — 병렬 비교 */}
        <div className="flex-1 overflow-y-auto">
          {allQuestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-030">
              <Eye className="w-8 h-8" />
              <p className="text-sm">템플릿 정보가 없습니다.</p>
            </div>
          ) : (
            allQuestions.map((q, idx) => {
              const selfAns  = selfSub?.answers.find(a => a.questionId === q.id);
              const mgrAns   = managerSub?.answers.find(a => a.questionId === q.id);
              const hasSelf  = q.target !== 'leader';
              const hasMgr   = q.target !== 'self';
              const typeLabel =
                q.type === 'rating' ? '평점' :
                q.type === 'competency' ? '역량' :
                q.type === 'multiple_choice' ? '객관식' : '주관식';

              return (
                <div key={q.id} className={`${idx < allQuestions.length - 1 ? 'border-b border-gray-010' : ''}`}>
                  {/* 질문 텍스트 — 전체 너비 */}
                  <div className="flex items-start gap-2.5 px-5 pt-4 pb-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-010 text-[10px] font-bold text-gray-050 flex items-center justify-center mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-040 bg-gray-010 px-1.5 py-0.5 rounded">
                          {typeLabel}
                        </span>
                        {q.isPrivate && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-yellow-060 bg-yellow-005 px-1.5 py-0.5 rounded">비공개</span>
                        )}
                        {q.target !== 'both' && (
                          <span className="text-[10px] font-semibold text-gray-030 bg-gray-005 px-1.5 py-0.5 rounded border border-gray-010">
                            {q.target === 'self' ? '본인 작성' : '조직장 작성'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-080 leading-snug">{q.text}</p>
                    </div>
                  </div>

                  {/* 답변 2컬럼 */}
                  <div className="grid grid-cols-2 divide-x divide-gray-010 pb-4">
                    <div className={`px-5 ${hasSelf ? '' : 'bg-gray-005/50'}`}>
                      {hasSelf
                        ? (selfSub?.status === 'submitted'
                          ? <AnswerView q={q} ans={selfAns} />
                          : <p className="text-xs text-gray-030 italic">
                              {selfSub?.status === 'in_progress' ? '작성 중' : '미제출'}
                            </p>)
                        : <p className="text-xs text-gray-020 italic">해당 없음</p>
                      }
                    </div>
                    <div className={`px-5 ${hasMgr ? '' : 'bg-gray-005/50'}`}>
                      {hasMgr
                        ? (managerSub?.status === 'submitted'
                          ? <AnswerView q={q} ans={mgrAns} />
                          : <p className="text-xs text-gray-030 italic">
                              {managerSub?.status === 'in_progress' ? '작성 중' : '미제출'}
                            </p>)
                        : <p className="text-xs text-gray-020 italic">해당 없음</p>
                      }
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

export function CycleDetail() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const { cycles, submissions, updateCycle, deleteCycle, upsertSubmission, templates, publishCycle } = useReviewStore();
  const { users, orgUnits } = useTeamStore();
  const reviewerAssignments = useTeamStore(s => s.reviewerAssignments);
  const orgSnapshots = useTeamStore(s => s.orgSnapshots);
  const { addNotification } = useNotificationStore();
  const currentUser = useAuthStore(s => s.currentUser);
  const navigate = useNavigate();
  const showToast = useShowToast();
  const [viewingMemberId, setViewingMemberId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [syncing, setSyncing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [preflightResult, setPreflightResult] = useState<PreflightResult | null>(null);
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [dryRunOpen, setDryRunOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { scriptUrl, enabled, markSynced, lastSyncAt } = useSheetsSyncStore();

  const cycle = cycles.find(c => c.id === cycleId);

  useEffect(() => {
    if (searchParams.get('edit') === '1' && cycle) {
      setSearchParams({}, { replace: true });
      navigate(`/cycles/${cycle.id}/edit`, { replace: true });
    }
  }, [cycle, navigate, searchParams, setSearchParams]);

  const headerSubtitle = useMemo(() => {
    if (!cycle) return null;
    // 진행 중 마감 임박 계산
    const activeDeadline = cycle.status === 'self_review'
      ? cycle.selfReviewDeadline
      : cycle.status === 'manager_review'
      ? cycle.managerReviewDeadline
      : null;
    const dDay = activeDeadline ? daysUntil(activeDeadline) : null;
    // 이 사이클의 승인 대기 수
    const pendingApprovals = submissions.filter(s =>
      s.cycleId === cycle.id && s.type === 'peer' && s.peerProposal?.status === 'pending'
    ).length;
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span>{cycle.type === 'scheduled' ? '정기 리뷰' : '수시 리뷰'} · 생성 {formatDate(cycle.createdAt)}</span>
        {dDay !== null && dDay >= 0 && (
          <Pill tone={dDay <= 3 ? 'warning' : 'neutral'} size="xs">
            마감 D-{dDay}
          </Pill>
        )}
        {pendingApprovals > 0 && (
          <Pill tone="purple" size="xs">승인 대기 {pendingApprovals}</Pill>
        )}
        {cycle.scheduledPublishAt && cycle.status === 'draft' && (
          <Pill tone="info" size="xs">⏰ 예약 발행 · {new Date(cycle.scheduledPublishAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</Pill>
        )}
        {cycle.autoAdvance && <Pill tone="purple" size="xs">⚙ 자동 전환</Pill>}
        {cycle.reminderPolicy && cycle.reminderPolicy.length > 0 && (
          <Pill tone="warning" size="xs">🔔 자동 리마인드 {cycle.reminderPolicy.length}</Pill>
        )}
        {cycle.downwardReviewerRanks && cycle.downwardReviewerRanks.length > 1 && (
          <Pill tone="info" size="xs">평가권자 {cycle.downwardReviewerRanks.join('·')}차</Pill>
        )}
        {cycle.hrSnapshotMode === 'snapshot' && cycle.hrSnapshotId && (() => {
          const snap = orgSnapshots.find(s => s.id === cycle.hrSnapshotId);
          const date = snap?.createdAt ? formatDate(snap.createdAt) : '';
          return (
            <Pill tone="info" size="xs" title={`스냅샷: ${snap?.description ?? ''}\n생성: ${snap?.createdAt ?? '-'}\n구성원 ${snap?.users.length ?? 0}명 · 조직 ${snap?.orgUnits.length ?? 0}개 · 평가권 ${snap?.assignments.length ?? 0}건`}>
              📷 스냅샷 {date}
            </Pill>
          );
        })()}
        {cycle.hrSnapshotMode === 'live' && (
          <Pill tone="neutral" size="xs" title="실시간 인사정보 적용 모드">⚡ 실시간</Pill>
        )}
        {cycle.editLockedAt && <Pill tone="neutral" size="xs">🔒 편집 잠김</Pill>}
        {cycle.autoArchived && <Pill tone="neutral" size="xs">자동 보관됨</Pill>}
      </div>
    );
  }, [cycle, submissions, orgSnapshots]);

  const headerActions = useMemo(() => {
    if (!cycle) return null;
    const transition = STATUS_TRANSITIONS[cycle.status];
    return (
      <>
        <StatusBadge type="review" value={cycle.status} />
        {cycle.editLockedAt && currentUser?.role === 'admin' && (
          <MsButton size="sm" variant="outline-default" onClick={() => setUnlockOpen(true)}>잠금 해제</MsButton>
        )}
        {transition && !cycle.editLockedAt && (
          <MsButton size="sm" variant={transition.isDanger ? 'outline-red' : 'outline-brand1'} onClick={() => handleTransitionClick()}>
            {transition.label}
          </MsButton>
        )}
        {enabled && (
          <MsButton
            size="sm"
            variant="outline-default"
            onClick={() => handleSheetSync()}
            disabled={syncing}
            title={lastSyncAt[cycle.id] ? `마지막 동기화: ${new Date(lastSyncAt[cycle.id]).toLocaleString('ko-KR')}` : '시트 동기화'}
            leftIcon={<MsRefreshIcon className={syncing ? 'animate-spin' : ''} />}
          >
            {syncing ? '동기화 중…' : '시트 동기화'}
          </MsButton>
        )}
        <MsButton size="sm" variant="outline-default" onClick={() => handleExport()} leftIcon={<MsDownloadIcon />}>내보내기</MsButton>
        <MsButton size="sm" variant="outline-default" onClick={() => setDryRunOpen(true)} leftIcon={<Eye />}>드라이런</MsButton>
        <MsButton size="sm" variant="outline-default" onClick={() => navigate(`/cycles/new?from=${cycle.id}`)} leftIcon={<MsEditIcon />}>복제</MsButton>
        <MsButton size="sm" variant="outline-default" onClick={() => setSettingsOpen(true)} leftIcon={<MsSettingIcon />}>리뷰 설정</MsButton>
        <MsButton size="sm" variant="outline-default" onClick={() => navigate(`/cycles/${cycle.id}/edit`)} leftIcon={<MsEditIcon />} disabled={!!cycle.editLockedAt}>편집</MsButton>
        {cycle.status === 'closed' && !cycle.archivedAt && (
          <MsButton
            size="sm"
            variant="outline-default"
            onClick={() => {
              const res = useReviewStore.getState().archiveCycle(cycle.id, currentUser?.id ?? 'system');
              if (res.ok) { showToast('success', '보관함으로 이동했습니다.'); navigate('/cycles'); }
              else { showToast('error', res.error ?? '보관에 실패했습니다.'); }
            }}
          >
            보관
          </MsButton>
        )}
        <MsButton size="sm" variant="outline-red" onClick={() => setShowDeleteConfirm(true)} leftIcon={<MsDeleteIcon />} disabled={!!cycle.editLockedAt}>삭제</MsButton>
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle, currentUser, enabled, syncing, lastSyncAt]);

  // onBack 은 useCallback 으로 안정화 — useSetPageHeader 의 deps 가 매 렌더 변경되지 않도록.
  const handleBack = useCallback(() => navigate(-1), [navigate]);
  useSetPageHeader(cycle?.title ?? '사이클', headerActions, {
    subtitle: headerSubtitle,
    onBack: handleBack,
  });

  if (!cycle) {
    return (
      <EmptyState
        illustration="empty-cycle"
        title="리뷰를 찾을 수 없어요"
        description={
          <>
            삭제되었거나 접근 권한이 없는 사이클입니다.
            <br />
            목록 또는 보관함에서 다시 찾아보세요.
          </>
        }
        action={{ label: '리뷰 목록으로', onClick: () => navigate('/cycles') }}
      />
    );
  }

  const targetMembers = resolveTargetMembers(cycle, users);

  const getMemberStatus = (userId: string) => {
    const selfSub = submissions.find(s => s.cycleId === cycle.id && s.revieweeId === userId && s.type === 'self');
    const managerSub = submissions.find(s => s.cycleId === cycle.id && s.revieweeId === userId && s.type === 'downward');
    return { self: selfSub?.status ?? 'not_started', manager: managerSub?.status ?? 'not_started' };
  };

  const selfSubmitted = targetMembers.filter(m => getMemberStatus(m.id).self === 'submitted').length;
  const managerSubmitted = targetMembers.filter(m => getMemberStatus(m.id).manager === 'submitted').length;

  // Google Sheets 전체 동기화
  const handleSheetSync = async () => {
    if (!scriptUrl) {
      showToast('info', '설정 > Google Sheets 연동에서 URL을 먼저 등록해주세요.');
      return;
    }
    const template = getEffectiveTemplate(cycle, templates);
    if (!template) return;
    setSyncing(true);
    try {
      await syncCycle(cycle, submissions, template, users, scriptUrl);
      markSynced(cycle.id);
      showToast('success', 'Google Sheets 동기화가 완료되었습니다.');
    } catch {
      showToast('error', '동기화 중 오류가 발생했습니다.');
    } finally {
      setSyncing(false);
    }
  };

  // CSV 내보내기
  const handleExport = () => {
    const template = getEffectiveTemplate(cycle, templates);
    if (!template) { showToast('error', '템플릿 정보를 찾을 수 없습니다.'); return; }
    exportCycleToCSV(cycle, template, submissions, users);
    showToast('success', '스프레드시트로 내보내기를 시작합니다.');
  };

  // 사이클 상태 전환
  const transition = STATUS_TRANSITIONS[cycle.status];

  const runAndOpenPreflight = () => {
    const template = getEffectiveTemplate(cycle, templates);
    // R4: snapshot 모드면 스냅샷 데이터 사용
    const eff = resolveEffectiveOrgData(
      cycle,
      { users, orgUnits, assignments: reviewerAssignments },
      orgSnapshots,
    );
    const result = runPreflight({
      cycle,
      allCycles: cycles,
      users: eff.users,
      orgUnits: eff.orgUnits,
      template,
      assignments: eff.assignments,
    });
    setPreflightResult(result);
    setPreflightOpen(true);
  };

  const handleTransitionClick = () => {
    if (cycle.status === 'draft') {
      runAndOpenPreflight();
      return;
    }
    setShowConfirm(true);
  };

  const handleTransition = async () => {
    if (!transition || transitioning) return;
    setTransitioning(true);
    try {
      await new Promise(r => setTimeout(r, 300));
      // draft 발행 시 publishCycle 액션으로 snapshot 저장 + submissions 생성
      if (cycle.status === 'draft') {
        const res = publishCycle(cycle.id, currentUser?.id ?? 'system');
        if (!res.ok) {
          showToast('error', res.error ?? '발행에 실패했습니다.');
          return;
        }
        const _eff = resolveEffectiveOrgData(cycle, { users, orgUnits, assignments: reviewerAssignments }, orgSnapshots);
    const subs = createCycleSubmissions(cycle.id, targetMembers, _eff.users, _eff.orgUnits, cycle, _eff.assignments);
        subs.forEach(sub => upsertSubmission(sub));
        showToast('success', `발행 완료 · 템플릿 스냅샷이 저장되었습니다.`);
        setShowConfirm(false);
        setPreflightOpen(false);
        return;
      }
      // self_review → manager_review: 조직장에게 알림 발송
      if (cycle.status === 'self_review') {
        const leaderIds = new Set<string>();
        for (const m of targetMembers) {
          const mgr = users.find(u => u.id === m.managerId && u.role !== 'admin');
          if (mgr) { leaderIds.add(mgr.id); continue; }
          const org = orgUnits.find(o =>
            o.headId && o.headId !== m.id &&
            (o.name === m.department || o.name === m.subOrg || o.name === m.team || o.name === m.squad)
          );
          if (org?.headId) leaderIds.add(org.headId);
        }
        leaderIds.forEach((leaderId, i) => {
          addNotification({
            id: `mgr_review_${Date.now()}_${i}_${leaderId}`,
            userId: leaderId,
            title: '조직장 리뷰 시작',
            message: `${cycle.title} 리뷰가 조직장 리뷰 단계로 전환되었습니다. 팀원 평가를 작성해주세요.`,
            type: 'system',
            isRead: false,
            createdAt: new Date().toISOString(),
            actionUrl: '/reviews/team',
          });
        });
      }
      if (transition.next === 'closed') {
        // closedAt 기록을 위해 closeCycle 액션 사용
        useReviewStore.getState().closeCycle(cycle.id, currentUser?.id ?? 'system');
      } else {
        updateCycle(cycle.id, { status: transition.next });
      }
      showToast('success', `${transition.label} 완료`);
      setShowConfirm(false);
    } finally {
      setTransitioning(false);
    }
  };

  // 제출 누락 구성원에게 재생성
  const handleRegenerateSubmissions = async () => {
    if (!cycle || regenerating) return;
    setRegenerating(true);
    await new Promise(r => setTimeout(r, 300));
    const _eff = resolveEffectiveOrgData(cycle, { users, orgUnits, assignments: reviewerAssignments }, orgSnapshots);
    const subs = createCycleSubmissions(cycle.id, targetMembers, _eff.users, _eff.orgUnits, cycle, _eff.assignments);
    let added = 0;
    subs.forEach(sub => {
      const exists = submissions.some(s => s.id === sub.id);
      if (!exists) { upsertSubmission(sub); added++; }
    });
    setRegenerating(false);
    showToast('success', added > 0 ? `${added}건의 제출이 추가되었습니다.` : '누락된 제출이 없습니다.');
  };

  /* Phase D-3.D-1: 컴팩트화 — 카드 컨테이너 제거, 큰 섹션 사이 border-t 만 (mt/pt 없음).
     Dashboard fix4 패턴 재사용. 강조 배너 (상태/삭제) 는 의도 유지. */
  return (
    <div>

      {/* 상태 전환 확인 배너 */}
      {showConfirm && transition && (
        <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${
          transition.isDanger
            ? 'bg-red-005 border-red-020'
            : 'bg-yellow-005 border-yellow-060/20'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <MsWarningIcon size={16} className={`shrink-0 ${transition.isDanger ? 'text-red-040' : 'text-yellow-060'}`} />
            <p className={`text-sm ${transition.isDanger ? 'text-red-060' : 'text-yellow-070'}`}>
              {transition.msg}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <MsButton variant="ghost" size="sm" onClick={() => setShowConfirm(false)}>취소</MsButton>
            <MsButton
              loading={transitioning}
              onClick={handleTransition}
              size="sm"
              className={transition.isDanger ? 'bg-red-050 hover:bg-red-060' : ''}
            >
              {transition.label}
            </MsButton>
          </div>
        </div>
      )}

      {/* 삭제 확인 배너 */}
      {showDeleteConfirm && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border bg-red-005 border-red-020">
          <div className="flex items-center gap-2 min-w-0">
            <MsDeleteIcon size={16} className="shrink-0 text-red-040" />
            <p className="text-sm text-red-060">
              <strong>"{cycle.title}"</strong> 리뷰와 모든 제출 데이터({submissions.filter(s => s.cycleId === cycle.id).length}건)가 영구 삭제됩니다. 되돌릴 수 없습니다.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <MsButton variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>취소</MsButton>
            <MsButton
              variant="red"
              size="sm"
              onClick={() => {
                deleteCycle(cycle.id);
                showToast('success', '리뷰가 삭제되었습니다.');
                navigate('/cycles');
              }}
            >
              삭제 확정
            </MsButton>
          </div>
        </div>
      )}

      {/* 리뷰 조회 모달 */}
      {viewingMemberId && (() => {
        const member = users.find(u => u.id === viewingMemberId);
        if (!member) return null;
        const template = getEffectiveTemplate(cycle, templates);
        const selfSub = submissions.find(s => s.cycleId === cycle.id && s.revieweeId === viewingMemberId && s.type === 'self');
        const managerSub = submissions.find(s => s.cycleId === cycle.id && s.revieweeId === viewingMemberId && s.type === 'downward');
        const reviewer = managerSub ? users.find(u => u.id === managerSub.reviewerId) : undefined;
        return (
          <SubmissionViewPanel
            member={member}
            selfSub={selfSub}
            managerSub={managerSub}
            reviewer={reviewer}
            template={template}
            cycle={cycle}
            currentUser={currentUser}
            onClose={() => setViewingMemberId(null)}
          />
        );
      })()}

      {/* Phase D-3.D-3: Stats + Timeline 한 덩어리 (사용자 명시) — wrapper 위 border-t 한 번만 */}
      <div className="border-t border-bd-default">
        {/* Stats — grid 3 cols + divide-x */}
        <div className="grid grid-cols-3 md:divide-x md:divide-bd-default">
          {[
            { icon: MsUsersIcon, label: '총 대상', value: `${targetMembers.length}명`, sub: `${cycle.targetDepartments.join(', ')}` },
            { icon: MsBarChart2Icon, label: '자기평가 완료', value: `${selfSubmitted}/${targetMembers.length}`, sub: `${Math.round((selfSubmitted / (targetMembers.length || 1)) * 100)}%` },
            { icon: MsBarChart2Icon, label: '조직장 리뷰 완료', value: `${managerSubmitted}/${targetMembers.length}`, sub: `${Math.round((managerSubmitted / (targetMembers.length || 1)) * 100)}%` },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-fg-subtlest" />
                <span className="text-xs text-fg-subtle">{label}</span>
              </div>
              <p className="text-xl font-semibold text-fg-default">{value}</p>
              <p className="text-xs text-fg-subtlest mt-0.5 truncate">{sub}</p>
            </div>
          ))}
        </div>

        {/* Timeline — Stats 다음 평면 (사이 border 없음, 한 덩어리) */}
        <div className="px-4 pb-5">
          <h2 className="text-sm font-semibold text-fg-default mb-3 flex items-center gap-2"><MsCalendarIcon size={16} /> 일정</h2>
          <div>
            {[
              { label: '자기평가 마감', date: cycle.selfReviewDeadline, highlight: cycle.status === 'self_review' },
              { label: '조직장 리뷰 마감', date: cycle.managerReviewDeadline, highlight: cycle.status === 'manager_review' },
            ].map(({ label, date, highlight }) => (
              <div
                key={label}
                className={`flex items-center justify-between py-2 px-2 ${highlight ? 'bg-bg-token-brand1-subtlest -mx-2 px-4 rounded-md' : ''}`}
              >
                <span className={`text-sm ${highlight ? 'font-semibold text-fg-brand1' : 'text-fg-default'}`}>{label}</span>
                <span className={`text-sm font-medium ${highlight ? 'text-fg-brand1' : 'text-fg-subtle'}`}>{formatDate(date)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <PreflightModal
        open={preflightOpen}
        onClose={() => setPreflightOpen(false)}
        onConfirm={handleTransition}
        result={preflightResult}
        cycleTitle={cycle.title}
        loading={transitioning}
      />

      <DryRunModal
        open={dryRunOpen}
        onClose={() => setDryRunOpen(false)}
        cycle={cycle}
        title={cycle.title}
      />

      <CycleSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        cycle={cycle}
      />

      {unlockOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-overlay-048" onClick={() => setUnlockOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-modal space-y-4">
            <h3 className="text-base font-bold text-gray-080">편집 잠금 해제</h3>
            <p className="text-xs text-gray-050">사유는 감사 로그에 기록됩니다.</p>
            <MsInput
              value={unlockReason}
              onChange={e => setUnlockReason(e.target.value)}
              placeholder="예) 결과 보고서 마감일 변경 요청"
            />
            <div className="flex items-center justify-end gap-2">
              <MsButton variant="ghost" size="sm" onClick={() => { setUnlockOpen(false); setUnlockReason(''); }}>취소</MsButton>
              <MsButton
                size="sm"
                onClick={() => {
                  const res = useReviewStore.getState().unlockEdit(cycle.id, currentUser?.id ?? 'system', unlockReason.trim() || undefined);
                  if (res.ok) {
                    showToast('success', '편집 잠금이 해제되었습니다.');
                    setUnlockOpen(false);
                    setUnlockReason('');
                  } else {
                    showToast('error', res.error ?? '해제 실패');
                  }
                }}
              >
                해제
              </MsButton>
            </div>
          </div>
        </div>
      )}

      {/* Ops Center — Phase D-3.D-1: 위에 border-t 추가로 영역 분리 */}
      <div className="border-t border-bd-default pt-4">
        <OpsCenter
          cycleId={cycle.id}
          onOpenMember={setViewingMemberId}
          headerActions={
            <MsButton
              variant="outline-default"
              size="sm"
              onClick={handleRegenerateSubmissions}
              disabled={regenerating}
              title="구성원 제출 누락 시 재생성"
              leftIcon={<MsRefreshIcon className={regenerating ? 'animate-spin' : ''} />}
            >
              제출 재생성
            </MsButton>
          }
        />
      </div>
    </div>
  );
}
