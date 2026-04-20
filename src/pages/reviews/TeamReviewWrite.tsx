import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Lock, AlertTriangle, FileText, History,
  Check, Star, Download, Search,
  ChevronDown, ChevronRight, ChevronLeft, Users, Calendar, ShieldCheck, BookOpen,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useReviewStore } from '../../stores/reviewStore';
import { useSheetsSyncStore } from '../../stores/sheetsSyncStore';
import { submissionWriter } from '../../utils/reviewSheetWriter';
import { useTeamStore } from '../../stores/teamStore';

const RATING_LABELS: Record<number, string> = { 1: '매우 미흡', 2: '미흡', 3: '보통', 4: '우수', 5: '매우 우수' };
import { exportSubmissionToCSV } from '../../utils/exportUtils';
import { DEFAULT_TEMPLATE } from '../../data/defaultTemplate';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AutoSaveIndicator } from '../../components/ui/AutoSaveIndicator';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useShowToast } from '../../components/ui/Toast';
import { formatDate } from '../../utils/dateUtils';
import type { Answer, ReviewCycle, ReviewSubmission, User, ReviewTemplate, OrgUnit } from '../../types';

// ─── 조직 트리 노드 타입 ──────────────────────────────────────────────────────
interface OrgTreeNode {
  id: string;
  name: string;
  type: OrgUnit['type'] | 'fallback';
  children: OrgTreeNode[];
  members: User[];
}

// ─── 별점 입력 ────────────────────────────────────────────────────────────────
function RatingInput({ value, onChange, disabled }: {
  value?: number; onChange: (v: number) => void; disabled?: boolean;
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
            className={`flex-1 py-2 rounded border-2 text-sm font-bold transition-all ${
              value === n
                ? 'border-primary-500 bg-primary-600 text-white'
                : disabled
                  ? 'border-neutral-100 bg-neutral-50 text-neutral-300 cursor-not-allowed'
                  : 'border-neutral-200 hover:border-primary-300 text-neutral-600'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {value && <p className="text-xs text-primary-600 mt-1.5 font-medium">{LABELS[value]}</p>}
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
  currentUser,
  pastSubmissions,
  cycles,
}: {
  reviewee: User;
  cycle: ReviewCycle;
  template: ReviewTemplate | undefined;
  selfSubmission: ReviewSubmission | undefined;
  mySubmission: ReviewSubmission | undefined;
  actualManager: User | undefined;
  isAdmin: boolean;
  currentUser: User | undefined;
  pastSubmissions: ReviewSubmission[];
  cycles: ReviewCycle[];
}) {
  const [histOpen, setHistOpen] = useState(true);

  const privateCount = template?.questions.filter(q => q.isPrivate).length ?? 0;
  const selfSubmitted = selfSubmission?.status === 'submitted';

  return (
    <div className="hidden lg:flex w-72 bg-white border-l border-zinc-950/5 flex-col flex-shrink-0 overflow-y-auto">

      {/* ── 셀프리뷰 정보 ── */}
      <div className="p-4 border-b border-zinc-950/5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded bg-primary-50 flex items-center justify-center flex-shrink-0">
            <FileText className="size-3.5 text-primary-600" />
          </div>
          <p className="text-xs font-semibold text-zinc-950">셀프리뷰 정보</p>
        </div>

        {/* 대상자 */}
        <div className="flex items-center gap-2.5">
          <UserAvatar user={reviewee} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-950 truncate">{reviewee.name}</p>
            <p className="text-xs text-zinc-400 truncate">{reviewee.position} · {reviewee.department}</p>
          </div>
        </div>

        {/* 리뷰 주기 */}
        <div className="space-y-2.5">
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-0.5">리뷰 주기</p>
            <p className="text-xs font-medium text-zinc-700 leading-snug">{cycle.title}</p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-start gap-2 p-2.5 bg-zinc-50 rounded-lg">
              <Calendar className="size-3.5 text-zinc-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-zinc-400">자기평가 마감</p>
                <p className="text-xs font-medium text-zinc-700">{formatDate(cycle.selfReviewDeadline)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2.5 bg-zinc-50 rounded-lg">
              <Calendar className="size-3.5 text-zinc-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-zinc-400">매니저 평가 마감</p>
                <p className="text-xs font-medium text-zinc-700">{formatDate(cycle.managerReviewDeadline)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 자기평가 상태 */}
        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">자기평가 상태</p>
          <div className="flex items-center gap-2">
            <StatusBadge type="submission" value={selfSubmission?.status || 'not_started'} />
            {selfSubmitted && (
              <span className="text-xs text-emerald-600 font-medium">
                {selfSubmission?.submittedAt ? formatDate(selfSubmission.submittedAt) : ''} 제출
              </span>
            )}
          </div>
        </div>

        {/* 열람 권한 */}
        <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-950/5">
          <div className="flex items-center gap-1.5 mb-2">
            <ShieldCheck className="size-3.5 text-zinc-500" />
            <p className="text-xs font-semibold text-zinc-600">열람 권한</p>
          </div>
          <ul className="space-y-1">
            <li className="text-xs text-zinc-500 flex items-center gap-1.5">
              <span className="size-1 rounded-full bg-zinc-400 flex-shrink-0" />
              매니저 · 관리자만 결과 열람 가능
            </li>
            {privateCount > 0 && (
              <li className="text-xs text-zinc-500 flex items-center gap-1.5">
                <Lock className="size-3 text-zinc-400 flex-shrink-0" />
                비공개 문항 {privateCount}개 포함
              </li>
            )}
          </ul>
        </div>

        {/* CSV 다운로드 (관리자만) */}
        {isAdmin && mySubmission && template && (
          <button
            onClick={() => exportSubmissionToCSV(
              mySubmission, template, cycle,
              reviewee, actualManager ?? reviewee,
              selfSubmission,
            )}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            <Download className="size-3.5" /> CSV 내보내기
          </button>
        )}
      </div>

      {/* ── 참고자료 ── */}
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-3 border-b border-zinc-950/5 flex items-center gap-2">
          <BookOpen className="size-3.5 text-zinc-400" />
          <p className="text-xs font-semibold text-zinc-950">참고자료</p>
        </div>

        {/* 이전 리뷰 accordion */}
        <div>
          <button
            onClick={() => setHistOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <History className="size-3.5 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-700">이전 리뷰</span>
              {pastSubmissions.length > 0 && (
                <span className="text-xs font-bold bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full">
                  {pastSubmissions.length}
                </span>
              )}
            </div>
            {histOpen
              ? <ChevronDown className="size-3.5 text-zinc-400" />
              : <ChevronRight className="size-3.5 text-zinc-400" />
            }
          </button>

          {histOpen && (
            <div className="px-3 pb-3">
              {pastSubmissions.length === 0 ? (
                <div className="text-center py-6">
                  <History className="size-6 text-zinc-200 mx-auto mb-1.5" />
                  <p className="text-xs text-zinc-400">이전 리뷰 이력이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {pastSubmissions.map(s => {
                    const c = cycles.find(cy => cy.id === s.cycleId);
                    return (
                      <div key={s.id} className="p-2.5 bg-white rounded-lg border border-zinc-950/5">
                        <p className="text-xs font-semibold text-zinc-800">{c?.title}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">{s.submittedAt ? formatDate(s.submittedAt) : ''}</p>
                        {s.overallRating && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Star className="size-3 text-primary-500 fill-primary-500" />
                            <span className="text-xs font-bold text-zinc-700">{s.overallRating.toFixed(1)}</span>
                            <span className="text-xs text-zinc-400">{RATING_LABELS[Math.round(s.overallRating)]}</span>
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
export function TeamReviewWrite() {
  const { cycleId, userId } = useParams<{ cycleId: string; userId: string }>();
  const { currentUser } = useAuthStore();
  const navigate = useNavigate();
  const { cycles, submissions, saveAnswer, submitSubmission, upsertSubmission, templates } = useReviewStore();
  const { users, orgUnits } = useTeamStore();
  const { reviewSyncEnabled } = useSheetsSyncStore();

  const cycle = cycles.find(c => c.id === cycleId);
  const template = templates.find(t => t.id === cycle?.templateId) ?? DEFAULT_TEMPLATE;

  const isAdmin = currentUser?.role === 'admin';

  const teamMembers = useMemo(() => {
    if (isAdmin) return users.filter(u => u.role !== 'admin');

    const byManagerId = new Set(
      users.filter(u => u.managerId === currentUser?.id).map(u => u.id)
    );
    const headOrgNames = new Set(
      orgUnits.filter(o => o.headId === currentUser?.id).map(o => o.name)
    );

    return users.filter(u =>
      u.id !== currentUser?.id &&
      u.role !== 'admin' &&
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

  // 제출 상태 빠른 조회용 맵 (revieweeId → status)
  const submissionStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of submissions) {
      if (s.type === 'downward' && s.cycleId === cycleId) {
        map.set(s.revieweeId, s.status);
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
        if (!membersByOrgId.has(id)) membersByOrgId.set(id, []);
        membersByOrgId.get(id)!.push(m);
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
        if (!deptMap.has(dept)) deptMap.set(dept, []);
        deptMap.get(dept)!.push(m);
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
  const isReadOnly = isAdminObserver || mySubmission?.status === 'submitted';

  // 조직장 리뷰 단계(manager_review, active)에서만 제출 가능
  const isManagerReviewPhase = cycle.status === 'manager_review' || cycle.status === 'active';
  const isPhaseBeforeManagerReview = cycle.status === 'self_review' || cycle.status === 'draft';
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

  const onSave = useCallback(async () => {
    if (!mySubmission?.id || !reviewSyncEnabled) return;
    const latest = useReviewStore.getState().submissions.find(s => s.id === mySubmission.id);
    if (latest) submissionWriter.upsert(latest);
  }, [mySubmission?.id, reviewSyncEnabled]);
  const { saveState, savedTime, triggerSave } = useAutoSave(onSave);

  const mySubmissionId = mySubmission?.id;
  const handleAnswerChange = useCallback((answer: Answer) => {
    if (!mySubmissionId || isReadOnly) return;
    saveAnswer(mySubmissionId, answer);
    triggerSave();
  }, [mySubmissionId, isReadOnly, saveAnswer, triggerSave]);

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
    submitSubmission(mySubmission.id, avg);
    setShowConfirm(false);
    setSubmitted(true);
  };

  const resetMember = (memberId: string) => {
    setSelectedMemberId(memberId);
    setSubmitted(false);
  };

  if (!reviewee || !cycle) {
    return <div className="text-center py-20 text-neutral-400">데이터를 불러올 수 없습니다.</div>;
  }

  const hasMismatch = detectMismatch();

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── 좌측: 팀원 목록 ── */}
      <div className="hidden md:flex w-56 bg-white border-r border-zinc-950/5 flex-col flex-shrink-0">
        {/* 헤더 */}
        <div className="px-4 pt-3 pb-2.5 border-b border-zinc-950/5 space-y-2">
          <button
            onClick={() => navigate('/reviews/team')}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> 하향 평가 목록
          </button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-300 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="이름 검색"
              className="w-full pl-7 pr-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:border-primary-400 focus:bg-white placeholder:text-zinc-300"
            />
          </div>
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
              const dotCls = status === 'submitted'
                ? 'bg-emerald-400'
                : status === 'in_progress' ? 'bg-primary-400' : 'bg-zinc-300';
              return (
                <button
                  key={m.id}
                  onClick={() => resetMember(m.id)}
                  style={{ paddingLeft: `${8 + depth * 12}px` }}
                  className={`w-full flex items-center gap-2 pr-3 py-2 transition-colors ${
                    isSel ? 'bg-primary-50 border-r-2 border-primary-500' : 'hover:bg-zinc-50'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotCls}`} />
                  <UserAvatar user={m} size="sm" />
                  <div className="flex-1 min-w-0 text-left">
                    <p className={`text-xs font-medium truncate ${isSel ? 'text-primary-700' : 'text-zinc-800'}`}>
                      {m.name}
                    </p>
                    <p className="text-xs text-zinc-400 truncate">{m.team || m.position || ''}</p>
                  </div>
                </button>
              );
            };

            const renderNode = (node: OrgTreeNode, depth: number): React.ReactNode => {
              const isOpen = collapsedGroups[node.id] !== true;
              const submitted = countSubmitted(node);
              const total = countTotal(node);
              return (
                <div key={node.id} className="border-b border-zinc-950/5 last:border-0">
                  <button
                    onClick={() => toggleGroup(node.id)}
                    style={{ paddingLeft: `${8 + depth * 12}px` }}
                    className="w-full flex items-center justify-between pr-3 py-2 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isOpen
                        ? <ChevronDown className="w-3 h-3 text-zinc-300 flex-shrink-0" />
                        : <ChevronRight className="w-3 h-3 text-zinc-300 flex-shrink-0" />
                      }
                      <span className="text-xs font-semibold text-zinc-600 truncate">{node.name}</span>
                    </div>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1 ${
                      submitted === total && total > 0
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-zinc-100 text-zinc-400'
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
      <div className="flex-1 overflow-y-auto bg-neutral-50">

        {/* 모바일 팀원 선택바 */}
        <div className="md:hidden bg-white border-b border-zinc-950/5 px-4 py-2.5 flex items-center gap-3 sticky top-0 z-10">
          <Users className="w-4 h-4 text-zinc-400 flex-shrink-0" />
          <select
            value={selectedMemberId}
            onChange={e => resetMember(e.target.value)}
            className="flex-1 text-sm text-zinc-900 border border-zinc-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-primary-500 appearance-none"
          >
            {teamMembers.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* ── 관리자 관찰 모드 배너 ── */}
          {isAdminObserver && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">관리자 열람 모드</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {actualManager?.name}님이 작성 중인 평가를 열람하고 있습니다. 수정할 수 없습니다.
                </p>
              </div>
            </div>
          )}

          {/* ── 조직장 리뷰 단계 전 안내 배너 ── */}
          {!isAdmin && isPhaseBeforeManagerReview && !isAdminObserver && (
            <div className="flex items-start gap-3 p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
              <Calendar className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-zinc-700">아직 조직장 리뷰 단계가 아닙니다</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  현재는 자기평가 단계입니다. 관리자가 조직장 리뷰를 시작하면 제출할 수 있습니다. 지금은 임시 저장만 가능합니다.
                </p>
              </div>
            </div>
          )}

          {/* ── 자기평가 미제출 잠금 배너 ── */}
          {!selfSubmitted && !isAdminObserver && (
            <div className="flex items-start gap-3 p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
              <Lock className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-zinc-700">{reviewee.name}님의 자기평가 대기 중</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  팀원이 자기평가를 제출하면 평가를 작성하고 제출할 수 있습니다. 지금은 임시 저장만 가능합니다.
                </p>
              </div>
            </div>
          )}

          {/* ── 점수 불일치 경고 ── */}
          {hasMismatch && (
            <div className="flex items-start gap-3 p-4 bg-primary-50 border border-primary-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-primary-700">
                <strong>{reviewee.name}님의 자기평가</strong>와 현재 평가 간 점수 차이가 큽니다. 1:1 면담에서 논의해 보세요.
              </p>
            </div>
          )}

          {/* 자동저장 + 상태 */}
          <div className="flex items-center justify-between">
            <AutoSaveIndicator state={saveState} savedTime={savedTime} />
            <div className="flex items-center gap-2">
              <StatusBadge type="submission" value={mySubmission?.status || 'not_started'} />
              {selfSubmitted
                ? <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded font-medium">셀프 완료</span>
                : <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">셀프 대기</span>
              }
            </div>
          </div>

          {/* 병렬 컬럼 헤더 + 질문 */}
          <div className="rounded-xl overflow-hidden border border-zinc-950/5 shadow-card">
            {/* 컬럼 헤더 (데스크톱) */}
            <div className="hidden md:grid md:grid-cols-2">
              <div className="flex items-center gap-2.5 px-5 py-3 bg-zinc-50 border-b border-r border-zinc-950/5">
                <UserAvatar user={reviewee} size="sm" />
                <div>
                  <p className="text-xs font-semibold text-zinc-700">{reviewee.name}님의 자기평가</p>
                  <p className="text-xs text-zinc-400">읽기 전용</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 px-5 py-3 bg-primary-50/60 border-b border-zinc-950/5">
                {actualManager && <UserAvatar user={actualManager} size="sm" />}
                <div>
                  <p className="text-xs font-semibold text-primary-700">
                    {isAdmin ? `${actualManager?.name}님의 평가` : '내 평가'}
                  </p>
                  <p className="text-xs text-primary-500/70">
                    {isAdmin ? '관리자 열람' : (isReadOnly || submitted ? '제출 완료' : '작성 중')}
                  </p>
                </div>
              </div>
            </div>

            {/* 질문별 병렬 행 */}
            {managerQuestions.map((q, idx) => {
              const answer = getAnswer(q.id);
              const selfAnswer = q.target !== 'manager' ? getSelfAnswer(q.id) : undefined;
              const isLastRow = idx === managerQuestions.length - 1;

              return (
                <div key={q.id} className="contents">
                  {/* 질문 타이틀 */}
                  <div className={`md:col-span-2 px-5 py-3 bg-white flex items-start gap-2 border-t border-zinc-950/5 ${isLastRow ? '' : 'border-b-0'}`}>
                    {q.isPrivate && (
                      <span className="flex items-center gap-1 text-xs text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">
                        <Lock className="w-2.5 h-2.5" /> 비공개
                      </span>
                    )}
                    <p className="text-sm font-semibold text-zinc-800">
                      <span className="text-zinc-400 mr-1.5">{idx + 1}.</span>
                      {q.text}
                      {q.isRequired && <span className="text-rose-500 ml-1">*</span>}
                    </p>
                  </div>

                  {/* 셀프 / 매니저 셀 */}
                  <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* 셀프 리뷰 셀 */}
                    <div className={`px-5 py-4 bg-zinc-50/40 md:bg-white md:border-r border-zinc-950/5 ${!isLastRow ? 'border-b border-zinc-950/5' : ''}`}>
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2 md:hidden">
                        {reviewee.name}님 자기평가
                      </p>
                      {q.isPrivate ? (
                        <div className="flex items-center gap-2 text-zinc-300">
                          <Lock className="w-4 h-4 flex-shrink-0" />
                          <p className="text-xs">팀원에게 공유되지 않는 매니저 전용 질문입니다.</p>
                        </div>
                      ) : !selfSubmitted ? (
                        <p className="text-xs text-zinc-300 italic">아직 자기평가를 제출하지 않았습니다.</p>
                      ) : !selfAnswer?.ratingValue && !selfAnswer?.textValue ? (
                        <p className="text-xs text-zinc-300 italic">이 질문에 답변하지 않았습니다.</p>
                      ) : (
                        <div className="space-y-2">
                          {selfAnswer?.ratingValue && (() => { const rv = selfAnswer.ratingValue; return (
                            <div className="flex items-center gap-3">
                              <div className="flex gap-1">
                                {[1,2,3,4,5].map(n => (
                                  <span key={n} className={`inline-flex w-5 h-5 rounded-full text-xs font-bold items-center justify-center ${
                                    n === rv ? 'bg-zinc-700 text-white'
                                    : n < rv  ? 'bg-zinc-200 text-zinc-500'
                                    : 'bg-zinc-100 text-zinc-300'
                                  }`}>{n}</span>
                                ))}
                              </div>
                              <span className="text-sm font-semibold text-zinc-700">{rv}점</span>
                              <span className="text-xs text-zinc-500 font-medium">{FLAT_RATING_LABELS[rv]}</span>
                            </div>
                          ); })()}
                          {selfAnswer?.textValue && (
                            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                              {selfAnswer.textValue}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 매니저 입력 셀 */}
                    <div className={`px-5 py-4 bg-white ${!isLastRow ? 'border-b border-zinc-950/5' : ''}`}>
                      <p className="text-xs font-semibold text-primary-500 uppercase tracking-wide mb-2 md:hidden">
                        {isAdmin ? `${actualManager?.name}님 평가` : '내 평가'}
                      </p>
                      {(q.type === 'rating' || q.type === 'competency') && (
                        (isReadOnly || submitted) ? (
                          answer?.ratingValue ? (() => { const rv = answer.ratingValue!; return (
                            <div className="flex items-center gap-3">
                              <div className="flex gap-1">
                                {[1,2,3,4,5].map(n => (
                                  <span key={n} className={`inline-flex w-5 h-5 rounded-full text-xs font-bold items-center justify-center ${
                                    n === rv ? 'bg-primary-600 text-white'
                                    : n < rv  ? 'bg-primary-100 text-primary-400'
                                    : 'bg-zinc-100 text-zinc-300'
                                  }`}>{n}</span>
                                ))}
                              </div>
                              <span className="text-sm font-semibold text-zinc-700">{rv}점</span>
                              <span className="text-xs text-primary-600 font-medium">{FLAT_RATING_LABELS[rv]}</span>
                            </div>
                          ); })() : <p className="text-sm text-zinc-400 italic">미응답</p>
                        ) : (
                          <RatingInput
                            value={answer?.ratingValue}
                            onChange={v => handleAnswerChange({ questionId: q.id, ratingValue: v })}
                          />
                        )
                      )}
                      {q.type === 'text' && (
                        (isReadOnly || submitted) ? (
                          answer?.textValue?.trim()
                            ? <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{answer.textValue}</p>
                            : <p className="text-sm text-zinc-400 italic">미응답</p>
                        ) : (
                          <div>
                            <textarea
                              value={answer?.textValue || ''}
                              onChange={e => handleAnswerChange({ questionId: q.id, textValue: e.target.value })}
                              rows={selfAnswer?.textValue ? Math.max(4, Math.ceil(selfAnswer.textValue.length / 60)) : 4}
                              maxLength={1000}
                              placeholder="구체적인 사례와 근거를 포함해 작성하세요."
                              className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg bg-zinc-50 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:bg-white placeholder:text-zinc-300 resize-none"
                            />
                            <p className="text-xs text-zinc-300 text-right mt-1">{(answer?.textValue || '').length}/1000</p>
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
            <div className="flex items-center gap-2.5 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
              <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-medium text-emerald-700">{reviewee.name}님의 평가가 제출되었습니다.</p>
            </div>
          )}

          {/* 하단 제출 바 */}
          {!isAdmin && !isReadOnly && !submitted && (
            <div className="flex items-center justify-between bg-white rounded-xl border border-zinc-950/5 px-4 py-3 md:px-5 md:py-3.5 sticky bottom-4 shadow-raised">
              <AutoSaveIndicator state={saveState} savedTime={savedTime} />
              <button
                onClick={() => { if (selfSubmitted && canSubmit) setShowConfirm(true); }}
                disabled={!selfSubmitted || !canSubmit}
                title={
                  !selfSubmitted ? '팀원의 자기평가 제출 후 평가를 제출할 수 있습니다.' :
                  !canSubmit ? '조직장 리뷰 단계가 시작되면 제출할 수 있습니다.' : undefined
                }
                className="px-5 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                평가 제출하기
              </button>
            </div>
          )}
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
          currentUser={currentUser ?? undefined}
          pastSubmissions={pastSubmissions}
          cycles={cycles}
        />
      )}

      {/* ── 제출 확인 모달 ── */}
      {!isAdmin && showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-modal max-w-sm w-full p-6">
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-1">{reviewee.name}님의 평가를 제출할까요?</h3>
              <p className="text-sm text-zinc-500">제출 후에는 수정할 수 없습니다.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 border border-zinc-200 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700"
              >
                제출
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
