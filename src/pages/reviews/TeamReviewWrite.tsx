import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { History, BookOpen } from 'lucide-react';
import {
  MsLockIcon, MsWarningIcon, MsArticleIcon,
  MsCheckIcon, MsCheckCircleIcon, MsStarIcon, MsDownloadIcon, MsSearchIcon,
  MsChevronDownLineIcon, MsChevronRightLineIcon, MsChevronLeftLineIcon, MsCalendarIcon,
  MsShieldCheckIcon,
  MsLinkIcon, MsOutlinkIcon, MsCancelIcon, MsPlusIcon, MsPaperclipIcon,
} from '../../components/ui/MsIcons';
import { useAuthStore } from '../../stores/authStore';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { getSmallestOrg } from '../../utils/userUtils';

const RATING_LABELS: Record<number, string> = { 1: '매우 미흡', 2: '미흡', 3: '보통', 4: '우수', 5: '매우 우수' };
import { exportSubmissionToCSV } from '../../utils/exportUtils';
import { getEffectiveTemplate } from '../../utils/effectiveTemplate';
import { ReviewerReferenceRail } from '../../components/review/ReviewerReferenceRail';
import { DistributionProgress, validateDistribution } from '../../components/review/DistributionProgress';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDate } from '../../utils/dateUtils';
import type { Answer, ReviewCycle, ReviewSubmission, User, ReviewTemplate, OrgUnit, RefLink } from '../../types';
import { MsButton } from '../../components/ui/MsButton';
import { MsInput, MsTextarea, MsSelect } from '../../components/ui/MsControl';
import { EmptyState } from '../../components/ui/EmptyState';

// ─── 조직 트리 노드 타입 ──────────────────────────────────────────────────────
interface OrgTreeNode {
  id: string;
  name: string;
  type: OrgUnit['type'] | 'fallback';
  children: OrgTreeNode[];
  members: User[];
}

// ─── 별점 입력 ────────────────────────────────────────────────────────────────
// P1-A4 라운드 14: 점수 선택 후 해제 가능
function RatingInput({ value, onChange, disabled }: {
  value?: number; onChange: (v: number | undefined) => void; disabled?: boolean;
}) {
  const LABELS = ['', '매우 미흡', '미흡', '보통', '우수', '매우 우수'];
  return (
    <div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={`flex-1 py-2 rounded border-2 text-base font-bold transition-all ${
              value === n
                ? 'border-pink-040 bg-pink-050 text-white'
                : disabled
                  ? 'border-gray-010 bg-gray-005 text-gray-030 cursor-not-allowed'
                  : 'border-gray-020 hover:border-pink-030 text-gray-060'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-1.5 min-h-[18px]">
        {value && <p className="text-xs text-pink-050 font-medium">{LABELS[value]}</p>}
        {!disabled && value && (
          <button type="button" onClick={() => onChange(undefined)}
            className="text-xs text-fg-subtle hover:text-fg-default underline underline-offset-2">
            지우기
          </button>
        )}
      </div>
    </div>
  );
}

// ─── 병렬 보기 공통 상수 ─────────────────────────────────────────────────────
const FLAT_RATING_LABELS = ['', '매우 미흡', '미흡', '보통', '우수', '매우 우수'];

// ─── 우측 패널: 셀프리뷰 정보 + 참고자료 ─────────────────────────────────────
function RightPanel({
  reviewee,
  cycle,
  template,
  selfSubmission,
  mySubmission,
  actualManager,
  isAdmin,
  pastSubmissions,
  cycles,
  isReadOnly,
  myRefs,
  onMyRefsChange,
}: {
  reviewee: User;
  cycle: ReviewCycle;
  template: ReviewTemplate | undefined;
  selfSubmission: ReviewSubmission | undefined;
  mySubmission: ReviewSubmission | undefined;
  actualManager: User | undefined;
  isAdmin: boolean;
  pastSubmissions: ReviewSubmission[];
  cycles: ReviewCycle[];
  isReadOnly: boolean;
  myRefs: RefLink[];
  onMyRefsChange: (next: RefLink[]) => void;
}) {
  const [histOpen, setHistOpen] = useState(true);
  // 라운드 11: 내 참고자료 — MyReviewWrite 와 동일 패턴 (링크 only, 즉시 영속)
  const [myRefsOpen, setMyRefsOpen] = useState(true);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const addMyLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    const safe = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    onMyRefsChange([...myRefs, { id: crypto.randomUUID(), kind: 'link', title: linkTitle.trim() || safe, url: safe }]);
    setLinkUrl(''); setLinkTitle('');
  };
  const removeMyRef = (id: string) => onMyRefsChange(myRefs.filter(r => r.id !== id));

  const privateCount = template?.questions.filter(q => q.isPrivate).length ?? 0;
  const selfSubmitted = selfSubmission?.status === 'submitted';

  return (
    <div className="hidden lg:flex w-72 bg-white border-l border-gray-010 flex-col flex-shrink-0 overflow-y-auto">

      {/* ── 셀프리뷰 정보 ── */}
      <div className="p-4 border-b border-gray-010 space-y-4">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded bg-pink-005 flex items-center justify-center flex-shrink-0">
            <MsArticleIcon size={12} className="text-pink-050" />
          </div>
          <p className="text-xs font-semibold text-fg-default">셀프리뷰 정보</p>
        </div>

        {/* 대상자 */}
        <div className="flex items-center gap-2.5">
          <UserAvatar user={reviewee} size="sm" />
          <div className="min-w-0">
            <p className="text-base font-semibold text-fg-default truncate">{reviewee.name}</p>
            <p className="text-xs text-fg-subtlest truncate">{reviewee.position} · {getSmallestOrg(reviewee)}</p>
          </div>
        </div>

        {/* 리뷰 주기 */}
        <div className="space-y-2.5">
          <div>
            <p className="text-xs font-medium text-fg-subtlest uppercase tracking-wider mb-0.5">리뷰 주기</p>
            <p className="text-xs font-medium text-gray-070 leading-snug">{cycle.title}</p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-start gap-2 p-2.5 bg-gray-005 rounded-lg">
              <MsCalendarIcon size={12} className="text-fg-subtlest mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-fg-subtlest">자기평가 마감</p>
                <p className="text-xs font-medium text-gray-070">{formatDate(cycle.selfReviewDeadline)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2.5 bg-gray-005 rounded-lg">
              <MsCalendarIcon size={12} className="text-fg-subtlest mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-fg-subtlest">매니저 평가 마감</p>
                <p className="text-xs font-medium text-gray-070">{formatDate(cycle.managerReviewDeadline)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 자기평가 상태 */}
        <div>
          <p className="text-xs font-medium text-fg-subtlest uppercase tracking-wider mb-1.5">자기평가 상태</p>
          <div className="flex items-center gap-2">
            <StatusBadge type="submission" value={selfSubmission?.status || 'not_started'} />
            {selfSubmitted && (
              <span className="text-xs text-green-060 font-medium">
                {selfSubmission?.submittedAt ? formatDate(selfSubmission.submittedAt) : ''} 제출
              </span>
            )}
          </div>
        </div>

        {/* 열람 권한 */}
        <div className="p-3 bg-gray-005 rounded-lg border border-gray-010">
          <div className="flex items-center gap-1.5 mb-2">
            <MsShieldCheckIcon size={14} className="text-fg-subtle" />
            <p className="text-xs font-semibold text-gray-060">열람 권한</p>
          </div>
          <ul className="space-y-1">
            <li className="text-xs text-fg-subtle flex items-center gap-1.5">
              <span className="size-1 rounded-full bg-gray-040 flex-shrink-0" />
              매니저 · 관리자만 결과 열람 가능
            </li>
            {privateCount > 0 && (
              <li className="text-xs text-fg-subtle flex items-center gap-1.5">
                <MsLockIcon size={12} className="text-fg-subtlest flex-shrink-0" />
                비공개 문항 {privateCount}개 포함
              </li>
            )}
          </ul>
        </div>

        {/* CSV 다운로드 (관리자만) */}
        {isAdmin && mySubmission && template && (
          <MsButton
            variant="outline-default"
            size="sm"
            className="w-full"
            leftIcon={<MsDownloadIcon size={12} />}
            onClick={() => exportSubmissionToCSV(
              mySubmission, template, cycle,
              reviewee, actualManager ?? reviewee,
              selfSubmission,
            )}
          >
            CSV 내보내기
          </MsButton>
        )}
      </div>

      {/* ── 참고자료 ── */}
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-010 flex items-center gap-2">
          <BookOpen className="size-3.5 text-fg-subtlest" />
          <p className="text-xs font-semibold text-fg-default">참고자료</p>
        </div>

        {/* 라운드 11: 내 참고자료 accordion — 작성자가 첨부한 링크 (영속). MyReviewWrite 와 동일 패턴 */}
        <div className="border-b border-gray-010">
          <button
            onClick={() => setMyRefsOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-005 transition-colors"
          >
            <div className="flex items-center gap-2">
              <MsPaperclipIcon size={12} className="text-fg-subtlest" />
              <span className="text-xs font-medium text-gray-070">내 참고자료</span>
              {myRefs.length > 0 && (
                <span className="text-xs font-bold bg-pink-010 text-pink-050 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center leading-none">
                  {myRefs.length}
                </span>
              )}
            </div>
            {myRefsOpen
              ? <MsChevronDownLineIcon size={12} className="text-fg-subtlest" />
              : <MsChevronRightLineIcon size={12} className="text-fg-subtlest" />
            }
          </button>
          {myRefsOpen && (
            <div className="px-4 pb-3 space-y-3">
              {myRefs.length > 0 && (
                <ul className="space-y-1.5">
                  {myRefs.map(item => (
                    <li key={item.id} className="flex items-center gap-2 group">
                      <MsLinkIcon size={12} className="text-pink-040 flex-shrink-0" />
                      <span className="flex-1 min-w-0 text-xs text-gray-060 truncate">
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-pink-050 hover:underline inline-flex items-center gap-0.5">
                          {item.title}<MsOutlinkIcon size={12} className="ml-0.5" />
                        </a>
                      </span>
                      {!isReadOnly && (
                        <button onClick={() => removeMyRef(item.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-fg-subtlest hover:text-red-050 transition-all flex-shrink-0">
                          <MsCancelIcon size={12} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!isReadOnly && (
                <div className="space-y-1.5">
                  <MsInput size="sm" type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && addMyLink()} placeholder="https://..." />
                  <MsInput size="sm" type="text" value={linkTitle} onChange={e => setLinkTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addMyLink()} placeholder="제목 (선택)" />
                  <MsButton onClick={addMyLink} disabled={!linkUrl.trim()} size="sm" className="w-full h-auto py-1.5" leftIcon={<MsPlusIcon size={12} />}>링크 추가</MsButton>
                </div>
              )}
              {myRefs.length === 0 && isReadOnly && <p className="text-xs text-fg-subtlest text-center py-1">참고자료가 없습니다.</p>}
            </div>
          )}
        </div>

        {/* 이전 리뷰 accordion */}
        <div>
          <button
            onClick={() => setHistOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-005 transition-colors"
          >
            <div className="flex items-center gap-2">
              <History className="size-3.5 text-fg-subtlest" />
              <span className="text-xs font-medium text-gray-070">이전 리뷰</span>
              {pastSubmissions.length > 0 && (
                <span className="text-xs font-bold bg-gray-010 text-fg-subtle px-1.5 py-0.5 rounded-full">
                  {pastSubmissions.length}
                </span>
              )}
            </div>
            {histOpen
              ? <MsChevronDownLineIcon size={12} className="text-fg-subtlest" />
              : <MsChevronRightLineIcon size={12} className="text-fg-subtlest" />
            }
          </button>

          {histOpen && (
            <div className="px-3 pb-3">
              {pastSubmissions.length === 0 ? (
                <div className="text-center py-6">
                  <History className="size-6 text-gray-020 mx-auto mb-1.5" />
                  <p className="text-xs text-fg-subtlest">이전 리뷰 이력이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {pastSubmissions.map(s => {
                    const c = cycles.find(cy => cy.id === s.cycleId);
                    return (
                      <div key={s.id} className="p-2.5 bg-white rounded-lg border border-gray-010">
                        <p className="text-xs font-semibold text-gray-080">{c?.title}</p>
                        <p className="text-xs text-fg-subtlest mt-0.5">{s.submittedAt ? formatDate(s.submittedAt) : ''}</p>
                        {s.overallRating && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <MsStarIcon size={12} className="text-pink-040" />
                            <span className="text-xs font-bold text-gray-070">{s.overallRating.toFixed(1)}</span>
                            <span className="text-xs text-fg-subtlest">{RATING_LABELS[Math.round(s.overallRating)]}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
import { useShowToast } from '../../components/ui/Toast';

export function TeamReviewWrite() {
  const { cycleId, userId } = useParams<{ cycleId: string; userId: string }>();
  const { currentUser } = useAuthStore();
  const showToast = useShowToast();
  const navigate = useNavigate();
  const { cycles, submissions, saveAnswer, flushAnswerSync, saveReferences, submitSubmission, upsertSubmission, templates } = useReviewStore();
  const { users, orgUnits } = useTeamStore();

  const cycle = cycles.find(c => c.id === cycleId);
  const template = getEffectiveTemplate(cycle, templates);

  const isAdmin = currentUser?.role === 'admin';

  const teamMembers = useMemo(() => {
    if (isAdmin) return users.filter(u => u.id !== currentUser?.id);

    const byManagerId = new Set(
      users.filter(u => u.managerId === currentUser?.id).map(u => u.id)
    );
    const headOrgNames = new Set(
      orgUnits.filter(o => o.headId === currentUser?.id).map(o => o.name)
    );

    return users.filter(u =>
      u.id !== currentUser?.id &&
      (
        byManagerId.has(u.id) ||
        headOrgNames.has(u.department) ||
        headOrgNames.has(u.subOrg  ?? '__') ||
        headOrgNames.has(u.team    ?? '__') ||
        headOrgNames.has(u.squad   ?? '__')
      )
    );
  }, [isAdmin, users, orgUnits, currentUser?.id]);

  const [selectedMemberId, setSelectedMemberId] = useState(userId || teamMembers[0]?.id || '');
  const [showConfirm, setShowConfirm] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (key: string) =>
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  // 제출 상태 빠른 조회용 맵 (revieweeId → 가장 앞선 status)
  const submissionStatusMap = useMemo(() => {
    const STATUS_RANK: Record<string, number> = { submitted: 2, in_progress: 1, not_started: 0 };
    const map = new Map<string, string>();
    for (const s of submissions) {
      if (s.type === 'downward' && s.cycleId === cycleId) {
        const existing = map.get(s.revieweeId);
        if (!existing || (STATUS_RANK[s.status] ?? 0) > (STATUS_RANK[existing] ?? 0)) {
          map.set(s.revieweeId, s.status);
        }
      }
    }
    return map;
  }, [submissions, cycleId]);

  // 조직 위계 트리 구성
  const orgTree = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = teamMembers.filter(m =>
      !q ||
      m.name.toLowerCase().includes(q) ||
      (m.department ?? '').toLowerCase().includes(q) ||
      (m.team ?? '').toLowerCase().includes(q)
    );

    // 구성원을 가장 하위 조직 단위 ID에 매핑
    const getMemberOrgId = (m: User): string | undefined => {
      const checks: Array<[keyof User, OrgUnit['type']]> = [
        ['squad', 'squad'],
        ['team', 'team'],
        ['subOrg', 'subOrg'],
        ['department', 'mainOrg'],
      ];
      for (const [field, type] of checks) {
        const name = m[field] as string | undefined;
        if (!name) continue;
        const ou = orgUnits.find(o => o.type === type && o.name === name);
        if (ou) return ou.id;
      }
      return undefined;
    };

    const membersByOrgId = new Map<string, User[]>();
    const unassigned: User[] = [];
    for (const m of filtered) {
      const id = getMemberOrgId(m);
      if (id !== undefined) {
        const bucket = membersByOrgId.get(id);
        if (bucket) bucket.push(m);
        else membersByOrgId.set(id, [m]);
      } else {
        unassigned.push(m);
      }
    }

    const countAll = (node: OrgTreeNode): number =>
      node.members.length + node.children.reduce((s, c) => s + countAll(c), 0);

    const buildNode = (unit: OrgUnit): OrgTreeNode => {
      const children = orgUnits
        .filter(o => o.parentId === unit.id)
        .sort((a, b) => a.order - b.order)
        .map(buildNode)
        .filter(n => countAll(n) > 0);
      return {
        id: unit.id,
        name: unit.name,
        type: unit.type,
        children,
        members: membersByOrgId.get(unit.id) ?? [],
      };
    };

    const roots = orgUnits
      .filter(o => !o.parentId)
      .sort((a, b) => a.order - b.order)
      .map(buildNode)
      .filter(n => countAll(n) > 0);

    // orgUnits 데이터가 없을 때 department 기준 폴백
    if (roots.length === 0 && filtered.length > 0) {
      const deptMap = new Map<string, User[]>();
      for (const m of filtered) {
        const dept = m.department || '미배정';
        const bucket = deptMap.get(dept);
        if (bucket) bucket.push(m);
        else deptMap.set(dept, [m]);
      }
      return {
        roots: Array.from(deptMap.entries()).map(([dept, mems]) => ({
          id: dept, name: dept, type: 'fallback' as const, children: [], members: mems,
        })),
        unassigned: [],
      };
    }

    return { roots, unassigned };
  }, [teamMembers, orgUnits, searchQuery]);
  const [submitted, setSubmitted] = useState(false);

  const reviewee = users.find(u => u.id === selectedMemberId);
  const actualManager = isAdmin
    ? users.find(u => u.id === reviewee?.managerId)
    : currentUser;
  const reviewerId = actualManager?.id ?? currentUser?.id ?? '';

  const mySubmission = submissions.find(
    s => s.reviewerId === reviewerId && s.revieweeId === selectedMemberId
      && s.type === 'downward' && s.cycleId === cycleId
  );
  const selfSubmission = submissions.find(
    s => s.reviewerId === selectedMemberId && s.revieweeId === selectedMemberId
      && s.type === 'self' && s.cycleId === cycleId
  );
  const selfSubmitted = selfSubmission?.status === 'submitted';

  const pastSubmissions = submissions.filter(
    s => s.reviewerId === reviewerId && s.revieweeId === selectedMemberId
      && s.type === 'downward' && s.status === 'submitted'
  );

  const managerQuestions = template?.questions.filter(q => q.target !== 'self') || [];

  // 어드민이라도 해당 팀원의 직속 매니저(reviewerId === currentUser.id)인 경우 작성 허용
  const isAdminObserver = isAdmin && reviewerId !== currentUser?.id;
  // 빙의 상태에서도 리뷰 작성 허용 (사용자 결정) — admin 라우트만 차단 유지.
  // 리뷰 작성/제출은 빙의 대상 명의로 가능.
  const isReadOnly = isAdminObserver || mySubmission?.status === 'submitted';

  // 조직장 리뷰 단계(manager_review, active)에서만 제출 가능
  const isManagerReviewPhase = cycle?.status === 'manager_review' || cycle?.status === 'active';
  const isPhaseBeforeManagerReview = cycle?.status === 'self_review' || cycle?.status === 'draft';
  const canSubmit = isAdmin || isManagerReviewPhase;

  useEffect(() => {
    if (isAdminObserver || !currentUser || !selectedMemberId || !cycleId) return;
    const existing = submissions.find(
      s => s.reviewerId === currentUser.id && s.revieweeId === selectedMemberId
        && s.type === 'downward' && s.cycleId === cycleId
    );
    if (!existing) {
      upsertSubmission({
        id: `sub_mgr_${currentUser.id}_${selectedMemberId}_${cycleId}`,
        cycleId,
        reviewerId: currentUser.id,
        revieweeId: selectedMemberId,
        type: 'downward',
        status: 'not_started',
        answers: [],
        lastSavedAt: new Date().toISOString(),
      });
    }
  }, [selectedMemberId, cycleId, isAdminObserver]); // eslint-disable-line react-hooks/exhaustive-deps

  const getAnswer = (qId: string) => mySubmission?.answers.find(a => a.questionId === qId);
  const getSelfAnswer = (qId: string) => selfSubmission?.answers.find(a => a.questionId === qId);

  const mySubmissionId = mySubmission?.id;
  const handleAnswerChange = useCallback((answer: Answer) => {
    if (!mySubmissionId || isReadOnly) return;
    saveAnswer(mySubmissionId, answer);
  }, [mySubmissionId, isReadOnly, saveAnswer]);

  const detectMismatch = () => {
    if (!selfSubmitted) return false;
    const myRatings = managerQuestions
      .filter(q => q.type === 'rating' || q.type === 'competency')
      .map(q => getAnswer(q.id)?.ratingValue)
      .filter(Boolean) as number[];
    const selfRatings = selfSubmission?.answers
      .filter(a => a.ratingValue)
      .map(a => a.ratingValue!) ?? [];
    if (!myRatings.length || !selfRatings.length) return false;
    const myAvg = myRatings.reduce((s, v) => s + v, 0) / myRatings.length;
    const selfAvg = selfRatings.reduce((s, v) => s + v, 0) / selfRatings.length;
    return Math.abs(myAvg - selfAvg) >= 2;
  };

  const handleSubmit = () => {
    if (!mySubmission) return;
    const ratings = mySubmission.answers.filter(a => a.ratingValue).map(a => a.ratingValue!);
    const avg = ratings.length ? ratings.reduce((s, v) => s + v, 0) / ratings.length : undefined;
    // 분포 정책 검증 (hard 모드에서 초과 시 제출 차단)
    if (cycle?.distribution && avg != null) {
      // 가상 제출로 usage 계산
      const hypothetical: ReviewSubmission[] = submissions.map(s =>
        s.id === mySubmission.id ? { ...s, overallRating: avg } : s
      );
      const violations = validateDistribution(cycle.distribution, cycle.id, reviewerId, hypothetical);
      if (cycle.distribution.method === 'hard' && violations.length > 0) {
        showToast('error', `등급 분포 초과 · ${violations.join(' / ')}`);
        return;
      }
    }
    submitSubmission(mySubmission.id, avg);
    setShowConfirm(false);
    setSubmitted(true);
  };

  const resetMember = (memberId: string) => {
    setSelectedMemberId(memberId);
    setSubmitted(false);
  };

  const handleBack = useCallback(() => navigate(-1), [navigate]);
  useSetPageHeader(cycle?.title ? `${cycle.title} · 팀원 평가` : '팀원 평가', undefined, {
    onBack: handleBack,
  });

  if (!reviewee || !cycle) {
    return (
      <EmptyState
        illustration="empty-inbox"
        title="데이터를 불러올 수 없어요"
        description={<>사이클이나 팀원 정보가 변경되었을 수 있습니다.<br />팀 리뷰 목록에서 다시 시도해 주세요.</>}
        action={{ label: '팀 리뷰 목록으로', onClick: () => navigate('/reviews/team') }}
      />
    );
  }

  const hasMismatch = detectMismatch();

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── 좌측: 팀원 목록 ── */}
      <div className="hidden md:flex w-56 bg-white border-r border-gray-010 flex-col flex-shrink-0">
        {/* 헤더 */}
        <div className="px-4 pt-3 pb-2.5 border-b border-gray-010 space-y-2">
          <button
            onClick={() => navigate('/reviews/team')}
            className="flex items-center gap-1.5 text-xs text-fg-subtlest hover:text-gray-070 transition-colors"
          >
            <MsChevronLeftLineIcon size={12} /> 하향 평가 목록
          </button>
          <MsInput
            size="sm"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="이름 검색"
            leftSlot={<MsSearchIcon size={12} />}
          />
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto">
          {(() => {
            const countSubmitted = (node: OrgTreeNode): number =>
              node.members.filter(m => submissionStatusMap.get(m.id) === 'submitted').length
              + node.children.reduce((s, c) => s + countSubmitted(c), 0);

            const countTotal = (node: OrgTreeNode): number =>
              node.members.length + node.children.reduce((s, c) => s + countTotal(c), 0);

            const renderMember = (m: User, depth: number) => {
              const status = submissionStatusMap.get(m.id);
              const isSel = selectedMemberId === m.id;
              const isDone = status === 'submitted';
              const isProgress = status === 'in_progress';
              return (
                <button
                  key={m.id}
                  onClick={() => resetMember(m.id)}
                  style={{ paddingLeft: `${8 + depth * 12}px` }}
                  className={`w-full flex items-center gap-2 pr-3 py-2 transition-colors ${
                    isSel ? 'bg-pink-005 border-r-2 border-pink-040' : 'hover:bg-gray-005'
                  }`}
                >
                  <UserAvatar user={m} size="sm" />
                  <div className="flex-1 min-w-0 text-left">
                    <p className={`text-xs font-medium truncate ${isSel ? 'text-pink-060' : 'text-gray-080'}`}>
                      {m.name}
                    </p>
                    <p className="text-xs text-fg-subtlest truncate">{getSmallestOrg(m)}</p>
                  </div>
                  {isDone
                    ? <MsCheckCircleIcon size={14} className="flex-shrink-0 text-green-050" />
                    : isProgress
                      ? <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-pink-040" />
                      : null
                  }
                </button>
              );
            };

            const renderNode = (node: OrgTreeNode, depth: number): React.ReactNode => {
              const isOpen = collapsedGroups[node.id] !== true;
              const submitted = countSubmitted(node);
              const total = countTotal(node);
              return (
                <div key={node.id}>
                  <button
                    onClick={() => toggleGroup(node.id)}
                    style={{ paddingLeft: `${8 + depth * 12}px` }}
                    className="w-full flex items-center justify-between pr-3 py-2 hover:bg-gray-005 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isOpen
                        ? <MsChevronDownLineIcon size={12} className="text-gray-030 flex-shrink-0" />
                        : <MsChevronRightLineIcon size={12} className="text-gray-030 flex-shrink-0" />
                      }
                      <span className="text-xs font-semibold text-gray-060 truncate">{node.name}</span>
                    </div>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1 ${
                      submitted === total && total > 0
                        ? 'bg-green-005 text-green-060'
                        : 'bg-gray-010 text-fg-subtlest'
                    }`}>
                      {submitted}/{total}
                    </span>
                  </button>
                  {isOpen && (
                    <>
                      {node.children.map(child => renderNode(child, depth + 1))}
                      {node.members.map(m => renderMember(m, depth + 1))}
                    </>
                  )}
                </div>
              );
            };

            return (
              <>
                {orgTree.roots.map(node => renderNode(node, 0))}
                {orgTree.unassigned.map(m => renderMember(m, 0))}
              </>
            );
          })()}
        </div>
      </div>

      {/* ── 중앙: 리뷰 내용 ── */}
      <div className="flex-1 overflow-y-auto">

        {/* 모바일 팀원 선택바 */}
        <div className="md:hidden bg-white border-b border-gray-010 px-4 py-2.5 sticky top-0 z-10">
          <MsSelect
            value={selectedMemberId}
            onChange={e => resetMember(e.target.value)}
          >
            {teamMembers.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </MsSelect>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* ── 관리자 관찰 모드 배너 ── */}
          {isAdminObserver && (
            <div className="flex items-start gap-3 p-4 bg-yellow-005 border border-yellow-060/20 rounded-xl">
              <MsShieldCheckIcon size={16} className="text-yellow-060 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-base font-semibold text-yellow-070">관리자 열람 모드</p>
                <p className="text-xs text-yellow-060 mt-0.5">
                  {actualManager?.name}님이 작성 중인 평가를 열람하고 있습니다. 수정할 수 없습니다.
                </p>
              </div>
            </div>
          )}

          {/* ── 조직장 리뷰 단계 전 안내 배너 ── */}
          {!isAdmin && isPhaseBeforeManagerReview && !isAdminObserver && (
            <div className="flex items-start gap-3 p-4 bg-gray-005 border border-gray-020 rounded-xl">
              <MsCalendarIcon size={16} className="text-fg-subtle mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-base font-semibold text-gray-070">아직 조직장 리뷰 단계가 아닙니다</p>
                <p className="text-xs text-fg-subtle mt-0.5">
                  현재는 자기평가 단계입니다. 관리자가 조직장 리뷰를 시작하면 제출할 수 있습니다. 지금은 임시 저장만 가능합니다.
                </p>
              </div>
            </div>
          )}

          {/* ── 자기평가 미제출 잠금 배너 (QA 라운드 12 B6/QA#21) ──
              사이클 단계 전 배너와 동시 노출 시 1차 원인 해석 어려움 → 단계 통과 후에만 노출 */}
          {!isPhaseBeforeManagerReview && !selfSubmitted && !isAdminObserver && (
            <div className="flex items-start gap-3 p-4 bg-gray-005 border border-gray-020 rounded-xl">
              <MsLockIcon size={16} className="text-fg-subtle mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-base font-semibold text-gray-070">{reviewee.name}님의 자기평가 대기 중</p>
                <p className="text-xs text-fg-subtle mt-0.5">
                  팀원이 자기평가를 제출하면 평가를 작성하고 제출할 수 있습니다. 지금은 임시 저장만 가능합니다.
                </p>
              </div>
            </div>
          )}

          {/* ── 점수 불일치 경고 ── */}
          {hasMismatch && (
            <div className="flex items-start gap-3 p-4 bg-pink-005 border border-pink-020 rounded-xl">
              <MsWarningIcon size={16} className="text-pink-050 mt-0.5 flex-shrink-0" />
              <p className="text-base text-pink-060">
                <strong>{reviewee.name}님의 자기평가</strong>와 현재 평가 간 점수 차이가 큽니다. 1:1 면담에서 논의해 보세요.
              </p>
            </div>
          )}

          {/* 상태 */}
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-2">
              <StatusBadge type="submission" value={mySubmission?.status || 'not_started'} />
              {selfSubmitted
                ? <span className="text-xs text-green-060 bg-green-005 border border-green-010 px-2 py-0.5 rounded font-medium">셀프 완료</span>
                : <span className="text-xs text-fg-subtlest bg-gray-010 px-2 py-0.5 rounded">셀프 대기</span>
              }
            </div>
          </div>

          {reviewee && cycle && (
            <ReviewerReferenceRail
              cycle={cycle}
              revieweeId={reviewee.id}
              variant="downward"
            />
          )}

          {cycle?.distribution && !isAdminObserver && (
            <DistributionProgress
              policy={cycle.distribution}
              cycleId={cycle.id}
              reviewerId={reviewerId}
              submissions={submissions}
            />
          )}

          {/* 병렬 컬럼 헤더 + 질문 */}
          <div className="rounded-lg overflow-hidden border border-bd-default">
            {/* 컬럼 헤더 (데스크톱) */}
            <div className="hidden md:grid md:grid-cols-2">
              <div className="flex items-center gap-2.5 px-5 py-3 bg-gray-005 border-b border-r border-gray-010">
                <UserAvatar user={reviewee} size="sm" />
                <div>
                  <p className="text-xs font-semibold text-gray-070">{reviewee.name}님의 자기평가</p>
                  <p className="text-xs text-fg-subtlest">읽기 전용</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 px-5 py-3 bg-pink-005/60 border-b border-gray-010">
                {actualManager && <UserAvatar user={actualManager} size="sm" />}
                <div>
                  <p className="text-xs font-semibold text-pink-060">
                    {isAdmin ? `${actualManager?.name}님의 평가` : '내 평가'}
                  </p>
                  <p className="text-xs text-pink-040/70">
                    {isAdmin ? '관리자 열람' : (isReadOnly || submitted ? '제출 완료' : '작성 중')}
                  </p>
                </div>
              </div>
            </div>

            {/* 질문별 병렬 행 */}
            {managerQuestions.map((q, idx) => {
              const answer = getAnswer(q.id);
              const selfAnswer = q.target !== 'leader' ? getSelfAnswer(q.id) : undefined;
              const isLastRow = idx === managerQuestions.length - 1;

              return (
                <div key={q.id} className="contents">
                  {/* 질문 타이틀 */}
                  <div className={`md:col-span-2 px-5 py-3 bg-white flex items-start gap-2 border-t border-gray-010 ${isLastRow ? '' : 'border-b-0'}`}>
                    {q.isPrivate && (
                      <span className="flex items-center gap-1 text-xs text-fg-subtlest bg-gray-010 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">
                        <MsLockIcon size={12} /> 비공개
                      </span>
                    )}
                    <p className="text-base font-semibold text-gray-080">
                      <span className="text-fg-subtlest mr-1.5">{idx + 1}.</span>
                      {q.text}
                      {q.isRequired && <span className="text-red-040 ml-1">*</span>}
                    </p>
                  </div>

                  {/* 셀프 / 매니저 셀 */}
                  <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* 셀프 리뷰 셀 */}
                    <div className={`px-5 py-4 bg-gray-005/40 md:bg-white md:border-r border-gray-010 ${!isLastRow ? 'border-b border-gray-010' : ''}`}>
                      <p className="text-xs font-semibold text-fg-subtlest uppercase tracking-wide mb-2 md:hidden">
                        {reviewee.name}님 자기평가
                      </p>
                      {q.isPrivate ? (
                        <div className="flex items-center gap-2 text-gray-030">
                          <MsLockIcon size={16} className="flex-shrink-0" />
                          <p className="text-xs">팀원에게 공유되지 않는 매니저 전용 질문입니다.</p>
                        </div>
                      ) : !selfSubmitted ? (
                        <p className="text-xs text-gray-030 italic">아직 자기평가를 제출하지 않았습니다.</p>
                      ) : !selfAnswer?.ratingValue && !selfAnswer?.textValue && !selfAnswer?.selectedOptions?.length ? (
                        <p className="text-xs text-gray-030 italic">이 질문에 답변하지 않았습니다.</p>
                      ) : (
                        <div className="space-y-2">
                          {selfAnswer?.ratingValue && (() => { const rv = selfAnswer.ratingValue; return (
                            <div className="flex items-center gap-3">
                              <div className="flex gap-1">
                                {[1,2,3,4,5].map(n => (
                                  <span key={n} className={`inline-flex w-5 h-5 rounded-full text-xs font-bold items-center justify-center ${
                                    n === rv ? 'bg-gray-070 text-white'
                                    : n < rv  ? 'bg-gray-020 text-fg-subtle'
                                    : 'bg-gray-010 text-gray-030'
                                  }`}>{n}</span>
                                ))}
                              </div>
                              <span className="text-base font-semibold text-gray-070">{rv}점</span>
                              <span className="text-xs text-fg-subtle font-medium">{FLAT_RATING_LABELS[rv]}</span>
                            </div>
                          ); })()}
                          {(selfAnswer?.selectedOptions?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {(selfAnswer?.selectedOptions ?? []).map(o => (
                                <span key={o} className="text-xs px-2 py-1 bg-gray-010 text-gray-070 rounded-full">{o}</span>
                              ))}
                            </div>
                          )}
                          {selfAnswer?.textValue && (
                            <p className="text-base text-fg-default leading-relaxed whitespace-pre-wrap">
                              {selfAnswer.textValue}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 매니저 입력 셀 */}
                    <div className={`px-5 py-4 bg-white ${!isLastRow ? 'border-b border-gray-010' : ''}`}>
                      <p className="text-xs font-semibold text-pink-040 uppercase tracking-wide mb-2 md:hidden">
                        {isAdmin ? `${actualManager?.name}님 평가` : '내 평가'}
                      </p>
                      {(q.type === 'rating' || q.type === 'competency') && (
                        (isReadOnly || submitted) ? (
                          answer?.ratingValue ? (() => { const rv = answer.ratingValue!; return (
                            <div className="flex items-center gap-3">
                              <div className="flex gap-1">
                                {[1,2,3,4,5].map(n => (
                                  <span key={n} className={`inline-flex w-5 h-5 rounded-full text-xs font-bold items-center justify-center ${
                                    n === rv ? 'bg-pink-050 text-white'
                                    : n < rv  ? 'bg-pink-010 text-pink-040'
                                    : 'bg-gray-010 text-gray-030'
                                  }`}>{n}</span>
                                ))}
                              </div>
                              <span className="text-base font-semibold text-gray-070">{rv}점</span>
                              <span className="text-xs text-pink-050 font-medium">{FLAT_RATING_LABELS[rv]}</span>
                            </div>
                          ); })() : <p className="text-base text-fg-subtlest italic">미응답</p>
                        ) : (
                          <RatingInput
                            value={answer?.ratingValue}
                            onChange={v => handleAnswerChange({ questionId: q.id, ratingValue: v })}
                          />
                        )
                      )}
                      {q.type === 'multiple_choice' && (
                        (isReadOnly || submitted) ? (
                          (answer?.selectedOptions?.length ?? 0) > 0
                            ? <div className="flex flex-wrap gap-1.5">{(answer?.selectedOptions ?? []).map(o => <span key={o} className="text-xs px-2 py-1 bg-gray-010 text-gray-070 rounded-full">{o}</span>)}</div>
                            : <p className="text-base text-fg-subtlest italic">미응답</p>
                        ) : (() => {
                          // QA 라운드 12 B3 — maxItems 검증 + 카운트 + 토스트
                          const sel = answer?.selectedOptions ?? [];
                          const max = (q.allowMultiple && q.maxItems && q.maxItems > 0) ? q.maxItems : undefined;
                          const atLimit = !!max && sel.length >= max;
                          return (
                            <div className="space-y-2">
                              {max && (
                                <p className={`text-xs ${atLimit ? 'text-orange-070 font-medium' : 'text-fg-subtle'}`}>
                                  {sel.length}/{max} 선택{atLimit ? ' · 최대까지 선택했습니다' : ''}
                                </p>
                              )}
                              {(q.options ?? []).filter(o => o.trim()).map(opt => {
                                const checked = sel.includes(opt);
                                const blocked = !!max && !checked && atLimit;
                                const toggle = () => {
                                  if (blocked) { showToast('error', `최대 ${max}개까지 선택할 수 있어요.`); return; }
                                  const next = q.allowMultiple
                                    ? (checked ? sel.filter(s => s !== opt) : [...sel, opt])
                                    : [opt];
                                  handleAnswerChange({ questionId: q.id, selectedOptions: next });
                                };
                                return (
                                  <button key={opt} type="button" onClick={toggle}
                                    aria-disabled={blocked}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-base text-left transition-all ${
                                      checked ? 'border-pink-040 bg-pink-005 text-pink-060 font-medium'
                                      : blocked ? 'border-gray-010 bg-gray-005 text-gray-030 cursor-not-allowed'
                                      : 'border-gray-020 hover:border-pink-030 text-gray-070'
                                    }`}>
                                    <span className={`w-4 h-4 flex-shrink-0 border-2 flex items-center justify-center transition-colors ${q.allowMultiple ? 'rounded' : 'rounded-full'} ${checked ? 'border-pink-040 bg-pink-040' : 'border-gray-030'}`}>
                                      {checked && <span className="w-2 h-2 bg-white rounded-sm" />}
                                    </span>
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()
                      )}
                      {q.type === 'text' && (
                        (isReadOnly || submitted) ? (
                          answer?.textValue?.trim()
                            ? <p className="text-base text-fg-default leading-relaxed whitespace-pre-wrap">{answer.textValue}</p>
                            : <p className="text-base text-fg-subtlest italic">미응답</p>
                        ) : (
                          <div>
                            <MsTextarea
                              value={answer?.textValue || ''}
                              onChange={e => handleAnswerChange({ questionId: q.id, textValue: e.target.value })}
                              rows={selfAnswer?.textValue ? Math.max(4, Math.ceil(selfAnswer.textValue.length / 60)) : 4}
                              maxLength={1000}
                              placeholder="구체적인 사례와 근거를 포함해 작성하세요."
                            />
                            <p className="text-xs text-gray-030 text-right mt-1">{(answer?.textValue || '').length}/1000</p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 제출 완료 배너 */}
          {(isReadOnly || submitted) && (
            <div className="flex items-center gap-2.5 p-4 bg-green-005 border border-green-010 rounded-xl">
              <MsCheckIcon size={20} className="text-green-060 flex-shrink-0" />
              <p className="text-base font-medium text-green-060">{reviewee.name}님의 평가가 제출되었습니다.</p>
            </div>
          )}

          {/* 하단 제출 바 — QA 라운드 12: 임시 저장 버튼 / 라운드 14 P1-A5: 차단 사유 inline */}
          {!isAdmin && !isReadOnly && !submitted && (() => {
            // P1-A5 — tooltip 만으론 차단 사유 인지가 약함. 버튼 옆 inline 텍스트로 직접 노출
            const blockReason = !selfSubmitted
              ? `${reviewee.name}님의 자기평가 제출 후 가능`
              : !canSubmit
                ? '조직장 리뷰 단계 시작 후 가능'
                : null;
            return (
            <div className="flex items-center justify-end gap-3 bg-white rounded-xl border border-gray-010 px-4 py-3 md:px-5 md:py-3.5 sticky bottom-4 shadow-raised flex-wrap">
              {blockReason && (
                <p className="text-xs text-fg-subtle flex-1 min-w-0">
                  <span className="font-medium text-orange-070">제출 차단:</span> {blockReason}
                </p>
              )}
              {mySubmissionId && (
                <MsButton
                  variant="outline-default"
                  onClick={() => {
                    flushAnswerSync(mySubmissionId);
                    showToast('success', '임시 저장되었습니다.');
                  }}
                >
                  임시 저장
                </MsButton>
              )}
              <MsButton
                onClick={() => { if (selfSubmitted && canSubmit) setShowConfirm(true); }}
                disabled={!selfSubmitted || !canSubmit}
                title={blockReason ?? undefined}
              >
                평가 제출하기
              </MsButton>
            </div>
            );
          })()}
        </div>
      </div>

      {/* ── 우측: 셀프리뷰 정보 + 참고자료 ── */}
      {reviewee && cycle && (
        <RightPanel
          reviewee={reviewee}
          cycle={cycle}
          template={template}
          selfSubmission={selfSubmission}
          mySubmission={mySubmission}
          actualManager={actualManager ?? undefined}
          isAdmin={isAdmin}
          pastSubmissions={pastSubmissions}
          cycles={cycles}
          isReadOnly={isReadOnly}
          myRefs={mySubmission?.references ?? []}
          onMyRefsChange={(next) => mySubmission && saveReferences(mySubmission.id, next)}
        />
      )}

      {/* ── 제출 확인 모달 ── */}
      {!isAdmin && showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-modal max-w-sm w-full p-6">
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-pink-005 rounded-full flex items-center justify-center mx-auto mb-3">
                <MsCheckIcon size={24} className="text-pink-050" />
              </div>
              <h3 className="text-lg font-semibold text-fg-default mb-1">{reviewee.name}님의 평가를 제출할까요?</h3>
              <p className="text-base text-fg-subtle">제출 후에는 수정할 수 없습니다.</p>
            </div>
            <div className="flex gap-3">
              <MsButton variant="default" onClick={() => setShowConfirm(false)} className="flex-1 h-auto py-2.5">취소</MsButton>
              <MsButton onClick={handleSubmit} className="flex-1 h-auto py-2.5">제출</MsButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
