import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '../utils/safeStorage';
import type { ReviewCycle, ReviewTemplate, ReviewSubmission, Answer, Notification, DeadlineExtension, ReviewerChange, ReviewKind } from '../types';
import { cycleWriter, templateWriter, submissionWriter } from '../utils/reviewSheetWriter';
import { useSheetsSyncStore } from './sheetsSyncStore';
import { useNotificationStore } from './notificationStore';
import { useTeamStore } from './teamStore';
import { DEFAULT_TEMPLATE } from '../data/defaultTemplate';
import { recordAudit } from '../utils/auditLog';
import { resolveTargetMembers } from '../utils/resolveTargets';
import { createCycleSubmissions } from '../utils/createCycleSubmissions';

/**
 * QA 라운드 12 — A3/B2 fix.
 * saveAnswer 가 store 만 갱신하고 시트 sync 를 안 하던 버그로 인해 폴링 refetch 시 local 답변이 손실되던 문제.
 * 해결: typing 마다 markWrite() 로 grace 즉시 활성화 + 디바운스 후 submissionWriter.upsert.
 *      디바운스로 시트 호출 빈도 제한 (typing 폭주 보호). 임시저장 버튼은 flushAnswerSync 로 디바운스 우회 즉시 sync.
 */
const ANSWER_SYNC_DEBOUNCE_MS = 800;
const answerSyncTimers: Record<string, ReturnType<typeof setTimeout>> = {};

type PersistedState = {
  cycles: ReviewCycle[];
  templates: ReviewTemplate[];
  submissions: ReviewSubmission[];
};

interface ReviewState {
  cycles: ReviewCycle[];
  templates: ReviewTemplate[];
  submissions: ReviewSubmission[];
  isLoading: boolean;
  reviewSyncError: string | null;

  // CRUD
  addCycle: (cycle: ReviewCycle) => void;
  updateCycle: (id: string, updates: Partial<ReviewCycle>) => void;
  deleteCycle: (id: string) => void;
  addTemplate: (template: ReviewTemplate) => void;
  updateTemplate: (id: string, updates: Partial<ReviewTemplate>) => void;
  deleteTemplate: (id: string) => void;
  upsertSubmission: (submission: ReviewSubmission) => void;
  saveAnswer: (submissionId: string, answer: Answer) => void;
  /** QA 라운드 12 — '임시 저장' 버튼 등에서 디바운스 우회하고 즉시 sync */
  flushAnswerSync: (submissionId: string) => void;
  saveReferences: (submissionId: string, references: import('../types').RefLink[]) => void;
  submitSubmission: (submissionId: string, overallRating?: number) => void;
  getSubmission: (cycleId: string, reviewerId: string, revieweeId: string, type: ReviewKind) => ReviewSubmission | undefined;
  publishCycle: (cycleId: string, actorId: string) => { ok: boolean; error?: string };
  addCycleParticipant: (cycleId: string, userId: string, actorId: string) =>
    { ok: boolean; error?: string; createdSubmissions?: number };
  removeCycleParticipant: (cycleId: string, userId: string, actorId: string, reason?: string) =>
    { ok: boolean; error?: string; markedSubmissions?: number };
  closeCycle: (cycleId: string, actorId: string) => { ok: boolean; error?: string };
  archiveCycle: (cycleId: string, actorId: string) => { ok: boolean; error?: string };
  unarchiveCycle: (cycleId: string, actorId: string) => { ok: boolean; error?: string };
  unlockEdit: (cycleId: string, actorId: string, reason?: string) => { ok: boolean; error?: string };
  bulkRemind: (submissionIds: string[], actorId: string, ruleId?: string) => { sent: number; skipped: number };
  assignPeerReviewers: (cycleId: string, revieweeId: string, peerIds: string[], actorId: string) => { created: number; skipped: number };
  pickPeerReviewers: (cycleId: string, revieweeId: string, peerIds: string[]) => { created: number; skipped: number; error?: string };
  proposePeerReviewers: (cycleId: string, revieweeId: string, peerIds: string[]) => { created: number; skipped: number; error?: string };
  decidePeerProposal: (submissionId: string, approve: boolean, actorId: string, reason?: string) => { ok: boolean; error?: string };
  extendDeadline: (submissionIds: string[], until: string, actorId: string, reason?: string) =>
    { applied: string[]; rejected: { id: string; reason: string }[] };
  reassignReviewer: (submissionId: string, toReviewerId: string, actorId: string, reason?: string) =>
    { ok: boolean; error?: string };
  submitAsProxy: (submissionId: string, actorId: string, overallRating?: number) =>
    { ok: boolean; error?: string };
  reopenSubmission: (submissionId: string, actorId: string) =>
    { ok: boolean; error?: string };

  // 시트 동기화
  syncFromSheet: (data: { cycles?: ReviewCycle[]; templates?: ReviewTemplate[]; submissions?: ReviewSubmission[] }) => void;
  setLoading: (v: boolean) => void;
}

function isReviewSyncEnabled() {
  return useSheetsSyncStore.getState().reviewSyncEnabled;
}

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      cycles:     [],
      templates:  [DEFAULT_TEMPLATE],
      submissions: [],
      isLoading:  false,
      reviewSyncError: null,

      /* ── 사이클 ───────────────────────────────────────────────── */
      addCycle: (cycle) => {
        set(s => ({ cycles: [...s.cycles, cycle] }));
        if (isReviewSyncEnabled()) cycleWriter.upsert(cycle);
      },

      updateCycle: (id, updates) => {
        set(s => ({ cycles: s.cycles.map(c => c.id === id ? { ...c, ...updates } : c) }));
        if (isReviewSyncEnabled()) {
          const updated = get().cycles.find(c => c.id === id);
          if (updated) cycleWriter.upsert(updated);
        }
      },

      deleteCycle: (id) => {
        if (isReviewSyncEnabled()) {
          // DB에서 관련 제출 먼저 삭제 후 사이클 삭제
          get().submissions
            .filter(sub => sub.cycleId === id)
            .forEach(sub => submissionWriter.delete(sub.id));
          cycleWriter.delete(id);
        }
        set(s => ({
          cycles: s.cycles.filter(c => c.id !== id),
          submissions: s.submissions.filter(sub => sub.cycleId !== id),
        }));
      },

      /* ── 템플릿 ───────────────────────────────────────────────── */
      addTemplate: (template) => {
        set(s => ({ templates: [...s.templates, template] }));
        if (isReviewSyncEnabled()) templateWriter.upsert(template);
      },

      updateTemplate: (id, updates) => {
        set(s => ({ templates: s.templates.map(t => t.id === id ? { ...t, ...updates } : t) }));
        if (isReviewSyncEnabled()) {
          const updated = get().templates.find(t => t.id === id);
          if (updated) templateWriter.upsert(updated);
        }
      },

      deleteTemplate: (id) => {
        set(s => ({ templates: s.templates.filter(t => t.id !== id) }));
        if (isReviewSyncEnabled()) templateWriter.delete(id);
      },

      /* ── 제출 ─────────────────────────────────────────────────── */
      upsertSubmission: (submission) => {
        set(s => {
          const exists = s.submissions.find(sub => sub.id === submission.id);
          if (exists) return { submissions: s.submissions.map(sub => sub.id === submission.id ? submission : sub) };
          return { submissions: [...s.submissions, submission] };
        });
        if (isReviewSyncEnabled()) submissionWriter.upsert(submission);
      },

      saveAnswer: (submissionId, answer) => {
        set(s => ({
          submissions: s.submissions.map(sub => {
            if (sub.id !== submissionId) return sub;
            const existing = sub.answers.findIndex(a => a.questionId === answer.questionId);
            const newAnswers = existing >= 0
              ? sub.answers.map((a, i) => i === existing ? answer : a)
              : [...sub.answers, answer];
            return { ...sub, answers: newAnswers, status: 'in_progress', lastSavedAt: new Date().toISOString() };
          }),
        }));
        // QA 라운드 12: typing 시점에 폴링 refetch 차단 (grace 활성화). 디바운스 후 실제 sync.
        // 미적용 시 폴링이 sheet 빈 row 로 local 답변을 덮어쓰는 버그 (QA A3/B2).
        if (isReviewSyncEnabled()) {
          useSheetsSyncStore.getState().markWrite();
          if (answerSyncTimers[submissionId]) clearTimeout(answerSyncTimers[submissionId]);
          answerSyncTimers[submissionId] = setTimeout(() => {
            const sub = get().submissions.find(x => x.id === submissionId);
            delete answerSyncTimers[submissionId];
            if (sub) submissionWriter.upsert(sub);
          }, ANSWER_SYNC_DEBOUNCE_MS);
        }
      },

      flushAnswerSync: (submissionId) => {
        const timer = answerSyncTimers[submissionId];
        if (timer) {
          clearTimeout(timer);
          delete answerSyncTimers[submissionId];
        }
        if (isReviewSyncEnabled()) {
          useSheetsSyncStore.getState().markWrite();
          const sub = get().submissions.find(x => x.id === submissionId);
          if (sub) submissionWriter.upsert(sub);
        }
      },

      /**
       * 라운드 11: 참고자료 (링크) 저장.
       * saveAnswer 와 달리 변경 빈도가 매우 낮아 (추가/삭제 시점 1회) 즉시 sync 한다.
       * 부분 저장이라 status='in_progress' 로 전이하지 않음 — 답변과 무관한 메타 입력.
       */
      saveReferences: (submissionId, references) => {
        set(s => ({
          submissions: s.submissions.map(sub =>
            sub.id === submissionId
              ? { ...sub, references, lastSavedAt: new Date().toISOString() }
              : sub,
          ),
        }));
        if (isReviewSyncEnabled()) {
          const sub = get().submissions.find(x => x.id === submissionId);
          if (sub) submissionWriter.upsert(sub);
        }
      },

      submitSubmission: (submissionId, overallRating) => {
        // QA 라운드 12: 미flush 디바운스 타이머가 제출 후 stale upsert 를 보내지 않도록 클리어
        const timer = answerSyncTimers[submissionId];
        if (timer) { clearTimeout(timer); delete answerSyncTimers[submissionId]; }
        // QA 라운드 12 B4: 제출 성공 화면 노출 중 SyncStatusBanner 가 '저장 대기 중' 으로 동시 노출되는 것을 차단 (3s)
        useSheetsSyncStore.getState().markSubmitSuppress(Date.now() + 3000);
        const submittedAt = new Date().toISOString();
        set(s => ({
          submissions: s.submissions.map(sub =>
            sub.id === submissionId
              ? { ...sub, status: 'submitted', submittedAt, overallRating }
              : sub
          ),
        }));
        if (isReviewSyncEnabled()) {
          useSheetsSyncStore.getState().markWrite();
          const sub = get().submissions.find(s => s.id === submissionId);
          if (sub) submissionWriter.upsert(sub);
        }
      },

      getSubmission: (cycleId, reviewerId, revieweeId, type) =>
        get().submissions.find(
          s => s.cycleId === cycleId && s.reviewerId === reviewerId &&
               s.revieweeId === revieweeId && s.type === type
        ),

      publishCycle: (cycleId, actorId) => {
        const state = get();
        const cycle = state.cycles.find(c => c.id === cycleId);
        if (!cycle) return { ok: false, error: '사이클을 찾을 수 없습니다.' };
        if (cycle.status !== 'draft') return { ok: false, error: '초안 상태에서만 발행할 수 있습니다.' };
        const template = state.templates.find(t => t.id === cycle.templateId);
        if (!template) return { ok: false, error: '템플릿을 찾을 수 없습니다.' };

        const at = new Date().toISOString();
        const updated: ReviewCycle = {
          ...cycle,
          status: 'self_review',
          templateSnapshot: template,
          templateSnapshotAt: at,
        };
        set(s => ({ cycles: s.cycles.map(c => c.id === cycleId ? updated : c) }));
        if (isReviewSyncEnabled()) cycleWriter.upsert(updated);
        recordAudit({
          cycleId,
          actorId,
          action: 'cycle.status_transition',
          targetIds: [cycleId],
          summary: `발행 (초안 → Self 리뷰). 템플릿 스냅샷 저장`,
          meta: { to: 'self_review', templateId: template.id },
        });
        return { ok: true };
      },

      closeCycle: (cycleId, actorId) => {
        const state = get();
        const cycle = state.cycles.find(c => c.id === cycleId);
        if (!cycle) return { ok: false, error: '사이클을 찾을 수 없습니다.' };
        if (cycle.status === 'closed') return { ok: true };
        const at = new Date().toISOString();
        const updated: ReviewCycle = { ...cycle, status: 'closed', closedAt: at };
        set(s => ({ cycles: s.cycles.map(c => c.id === cycleId ? updated : c) }));
        if (isReviewSyncEnabled()) cycleWriter.upsert(updated);
        recordAudit({
          cycleId,
          actorId,
          action: 'cycle.status_transition',
          targetIds: [cycleId],
          summary: `리뷰 종료`,
          meta: { to: 'closed', trigger: actorId === 'system' ? 'auto' : 'manual' },
        });
        return { ok: true };
      },

      /**
       * 사이클 진행 중에 참가자(피평가자)를 추가한다.
       * - 중도 입사·신규 합류 인원 대응
       * - "참가 중" 판정의 진실의 원천 = 해당 cycle 에 user 가 reviewee 인
       *   submission 이 존재하는지 (autoExcluded 제외). resolveTargetMembers
       *   결과를 쓰지 않는 이유: 발행 후 부서/매니저 변동이 발생하면 mode
       *   기반 재계산 결과가 실제 submission 분포와 불일치 가능
       * - targetMode 가 custom 이 아닐 때는 effective member 집합을 동결하여
       *   targetUserIds 에 넣고 targetMode='custom' 으로 전환 (이후 모드 의존 제거)
       * - 신규 submission 은 createCycleSubmissions 와 동일 로직으로 즉시 생성
       *   (self / downward / upward — cycle.reviewKinds 따름)
       * - 상태: closed 가 아니면 허용 (self_review·manager_review 단계 모두 가능)
       */
      addCycleParticipant: (cycleId, userId, actorId) => {
        const state = get();
        const cycle = state.cycles.find(c => c.id === cycleId);
        if (!cycle) return { ok: false, error: '사이클을 찾을 수 없습니다.' };
        if (cycle.status === 'draft') return { ok: false, error: '발행 전 사이클입니다. 편집 화면에서 대상자를 설정하세요.' };
        if (cycle.status === 'closed') return { ok: false, error: '종료된 사이클에는 참가자를 추가할 수 없습니다.' };

        const team = useTeamStore.getState();
        const users = team.users;
        const orgUnits = team.orgUnits;
        const assignments = team.reviewerAssignments;

        const targetUser = users.find(u => u.id === userId);
        if (!targetUser) return { ok: false, error: '대상 사용자를 찾을 수 없습니다.' };

        // 진실의 원천 = submission. autoExcluded 인 건 다시 활성화로 간주하지
        // 않고 현재는 그대로 두며, 추가 시 새 submission 한 벌을 생성
        const activeAsReviewee = state.submissions.some(s =>
          s.cycleId === cycleId && s.revieweeId === userId && !s.autoExcluded
        );
        if (activeAsReviewee) return { ok: false, error: '이미 참가 중인 사용자입니다.' };

        // targetMode 동결: custom 이 아니면 현재 effective members 를 targetUserIds 에 넣고 custom 전환
        // 동결용 effective members 만 mode 기반 계산 사용 (게이트는 위에서 submission 기반)
        const effectiveIds = new Set(resolveTargetMembers(cycle, users).map(u => u.id));
        const nextTargetUserIds = cycle.targetMode === 'custom'
          ? Array.from(new Set([...(cycle.targetUserIds ?? []), userId]))
          : Array.from(new Set([...Array.from(effectiveIds), userId]));
        const frozenFrom = cycle.targetMode !== 'custom' ? (cycle.targetMode ?? 'org') : undefined;

        const updated: ReviewCycle = {
          ...cycle,
          targetMode: 'custom',
          targetUserIds: nextTargetUserIds,
        };
        set(s => ({ cycles: s.cycles.map(c => c.id === cycleId ? updated : c) }));
        if (isReviewSyncEnabled()) cycleWriter.upsert(updated);

        const subs = createCycleSubmissions(cycleId, [targetUser], users, orgUnits, cycle, assignments);
        if (subs.length > 0) {
          set(s => ({ submissions: [...s.submissions, ...subs] }));
          if (isReviewSyncEnabled()) subs.forEach(sub => submissionWriter.upsert(sub));
        }

        recordAudit({
          cycleId,
          actorId,
          action: 'cycle.participant_added',
          targetIds: [userId],
          summary: `참가자 추가 — ${targetUser.name} (${subs.length}건 submission 생성)`,
          meta: { userId, createdSubmissions: subs.length, modeFrozenFrom: frozenFrom },
        });

        return { ok: true, createdSubmissions: subs.length };
      },

      /**
       * 사이클 진행 중 참가자를 제외한다 (중도 퇴사·이동 대응).
       * - "참가 중" 판정의 진실의 원천 = 해당 cycle 에 user 가 reviewee 인
       *   submission 이 1건 이상 존재. resolveTargetMembers 결과를 쓰지
       *   않는 이유: cycle.targetMode 가 'org'/'manager' 인 경우 발행 후
       *   부서/매니저 변동이 발생하면 mode 기반 재계산 결과에서 빠질 수
       *   있으나, submission 은 실제 존재 → 게이트는 submission 기반
       * - cycle.targetUserIds 갱신 (custom 모드로 전환 또는 유지)
       * - 해당 user 가 reviewee 인 모든 submission 에 autoExcluded 마크 부여
       *   (제출 완료 건 포함). autoExcluded = "운영 리스트에서 숨김" 마커이며
       *   submission 본체 / answers / 평점은 그대로 보존 → 평가 자체는 유효
       *   유지 (KPI / Reports 등은 마크 무관). 운영 리스트(OpsCenter) 에서는
       *   buildOpsRows 의 !autoExcluded 필터로 자연 숨김
       * - 데이터 손실 방지를 위해 submission 자체는 삭제하지 않음
       */
      removeCycleParticipant: (cycleId, userId, actorId, reason) => {
        const state = get();
        const cycle = state.cycles.find(c => c.id === cycleId);
        if (!cycle) return { ok: false, error: '사이클을 찾을 수 없습니다.' };
        if (cycle.status === 'draft') return { ok: false, error: '발행 전 사이클입니다. 편집 화면에서 대상자를 변경하세요.' };
        if (cycle.status === 'closed') return { ok: false, error: '종료된 사이클에서는 참가자를 제외할 수 없습니다.' };

        const team = useTeamStore.getState();
        const users = team.users;

        const targetUser = users.find(u => u.id === userId);
        if (!targetUser) return { ok: false, error: '대상 사용자를 찾을 수 없습니다.' };

        const hasActiveSubmission = state.submissions.some(s =>
          s.cycleId === cycleId && s.revieweeId === userId && !s.autoExcluded
        );
        if (!hasActiveSubmission) return { ok: false, error: '참가 중이 아닌 사용자입니다.' };

        const effectiveIds = new Set(resolveTargetMembers(cycle, users).map(u => u.id));
        const nextTargetUserIds = cycle.targetMode === 'custom'
          ? (cycle.targetUserIds ?? []).filter(id => id !== userId)
          : Array.from(effectiveIds).filter(id => id !== userId);
        const frozenFrom = cycle.targetMode !== 'custom' ? (cycle.targetMode ?? 'org') : undefined;

        const updated: ReviewCycle = {
          ...cycle,
          targetMode: 'custom',
          targetUserIds: nextTargetUserIds,
        };
        set(s => ({ cycles: s.cycles.map(c => c.id === cycleId ? updated : c) }));
        if (isReviewSyncEnabled()) cycleWriter.upsert(updated);

        const at = new Date().toISOString();
        const marked: ReviewSubmission[] = [];
        // autoExcluded = "운영 리스트에서 숨김" 마커. submission 본체 / answers /
        // 평점은 모두 보존되며 평가 자체의 유효성도 그대로. 제출 완료 건도
        // 마크 → 운영 리스트(OpsCenter)에서 자연 숨김. KPI / Reports 는 마크
        // 무관 (별도 후속 phase 에서 분모 보정 검토).
        set(s => ({
          submissions: s.submissions.map(sub => {
            if (sub.cycleId !== cycleId) return sub;
            if (sub.revieweeId !== userId) return sub;
            if (sub.autoExcluded) return sub;
            const next: ReviewSubmission = {
              ...sub,
              autoExcluded: { at, reason: 'removed' },
            };
            marked.push(next);
            return next;
          }),
        }));
        if (isReviewSyncEnabled()) marked.forEach(sub => submissionWriter.upsert(sub));

        recordAudit({
          cycleId,
          actorId,
          action: 'cycle.participant_removed',
          targetIds: [userId],
          summary: `참가자 제외 — ${targetUser.name} (${marked.length}건 자동제외)${reason ? ` · 사유: ${reason}` : ''}`,
          meta: { userId, reason, markedSubmissions: marked.length, modeFrozenFrom: frozenFrom },
        });

        return { ok: true, markedSubmissions: marked.length };
      },

      unlockEdit: (cycleId, actorId, reason) => {
        const state = get();
        const cycle = state.cycles.find(c => c.id === cycleId);
        if (!cycle) return { ok: false, error: '사이클을 찾을 수 없습니다.' };
        if (!cycle.editLockedAt) return { ok: false, error: '편집 잠금이 없습니다.' };
        const updated: ReviewCycle = { ...cycle, editLockedAt: undefined };
        set(s => ({ cycles: s.cycles.map(c => c.id === cycleId ? updated : c) }));
        if (isReviewSyncEnabled()) cycleWriter.upsert(updated);
        recordAudit({
          cycleId,
          actorId,
          action: 'cycle.status_transition',
          targetIds: [cycleId],
          summary: '편집 잠금 해제',
          meta: { reason },
        });
        return { ok: true };
      },

      archiveCycle: (cycleId, actorId) => {
        const state = get();
        const cycle = state.cycles.find(c => c.id === cycleId);
        if (!cycle) return { ok: false, error: '사이클을 찾을 수 없습니다.' };
        if (cycle.status !== 'closed') return { ok: false, error: '종료된 사이클만 보관할 수 있습니다.' };
        if (cycle.archivedAt) return { ok: false, error: '이미 보관 중입니다.' };
        const updated: ReviewCycle = { ...cycle, archivedAt: new Date().toISOString() };
        set(s => ({ cycles: s.cycles.map(c => c.id === cycleId ? updated : c) }));
        if (isReviewSyncEnabled()) cycleWriter.upsert(updated);
        recordAudit({
          cycleId,
          actorId,
          action: 'cycle.status_transition',
          targetIds: [cycleId],
          summary: '보관함으로 이동',
        });
        return { ok: true };
      },

      unarchiveCycle: (cycleId, actorId) => {
        const state = get();
        const cycle = state.cycles.find(c => c.id === cycleId);
        if (!cycle) return { ok: false, error: '사이클을 찾을 수 없습니다.' };
        if (!cycle.archivedAt) return { ok: false, error: '보관 중이 아닙니다.' };
        const updated: ReviewCycle = { ...cycle, archivedAt: undefined };
        set(s => ({ cycles: s.cycles.map(c => c.id === cycleId ? updated : c) }));
        if (isReviewSyncEnabled()) cycleWriter.upsert(updated);
        recordAudit({
          cycleId,
          actorId,
          action: 'cycle.status_transition',
          targetIds: [cycleId],
          summary: '보관 해제',
        });
        return { ok: true };
      },

      bulkRemind: (submissionIds, actorId, ruleId) => {
        const targetIds = new Set(submissionIds);
        const at = new Date().toISOString();
        const { addNotification } = useNotificationStore.getState();
        const syncEnabled = isReviewSyncEnabled();
        let sent = 0;
        let skipped = 0;
        const updated: ReviewSubmission[] = [];

        set(s => {
          const next = s.submissions.map(sub => {
            if (!targetIds.has(sub.id)) return sub;
            if (sub.status === 'submitted') {
              skipped += 1;
              return sub;
            }
            // 같은 ruleId로 이미 발송된 이력이 있으면 skip (규칙 기반 중복 방지)
            if (ruleId && sub.remindersSent?.some(r => r.ruleId === ruleId)) {
              skipped += 1;
              return sub;
            }
            sent += 1;
            const nextSub: ReviewSubmission = {
              ...sub,
              remindersSent: [
                ...(sub.remindersSent ?? []),
                { at, by: actorId, channel: 'inapp', ruleId },
              ],
            };
            updated.push(nextSub);
            return nextSub;
          });
          return { submissions: next };
        });

        const cycles = get().cycles;
        const byCycle = new Map<string, string[]>();
        for (const sub of updated) {
          const arr = byCycle.get(sub.cycleId) ?? [];
          arr.push(sub.id);
          byCycle.set(sub.cycleId, arr);
          const cycle = cycles.find(c => c.id === sub.cycleId);
          const note: Notification = {
            id: `ntf-${sub.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            userId: sub.reviewerId,
            title: '리뷰 작성 리마인드',
            message: cycle
              ? `"${cycle.title}" 리뷰 작성이 아직 완료되지 않았습니다.`
              : '리뷰 작성이 아직 완료되지 않았습니다.',
            type: 'deadline',
            isRead: false,
            createdAt: at,
            actionUrl: cycle ? `/reviews/cycles/${cycle.id}` : undefined,
          };
          addNotification(note);
          if (syncEnabled) submissionWriter.upsert(sub);
        }

        for (const [cycleId, ids] of byCycle) {
          recordAudit({
            cycleId,
            actorId,
            action: 'submission.reminder_sent',
            targetIds: ids,
            summary: `${ids.length}건 리마인드 발송`,
          });
        }

        return { sent, skipped };
      },

      extendDeadline: (submissionIds, until, actorId, reason) => {
        const targetIds = new Set(submissionIds);
        const applied: string[] = [];
        const rejected: { id: string; reason: string }[] = [];
        const extendedAt = new Date().toISOString();
        const syncEnabled = isReviewSyncEnabled();
        const byCycle = new Map<string, string[]>();
        const updatedSubs: ReviewSubmission[] = [];

        set(s => {
          const cycles = s.cycles;
          const next = s.submissions.map(sub => {
            if (!targetIds.has(sub.id)) return sub;
            if (sub.status === 'submitted') {
              rejected.push({ id: sub.id, reason: '이미 제출됨' });
              return sub;
            }
            const cycle = cycles.find(c => c.id === sub.cycleId);
            if (!cycle) {
              rejected.push({ id: sub.id, reason: '사이클 없음' });
              return sub;
            }
            if (cycle.status === 'closed') {
              rejected.push({ id: sub.id, reason: '종료된 사이클' });
              return sub;
            }
            const baseDeadline = sub.type === 'self'
              ? (sub.deadlineOverride?.until ?? cycle.selfReviewDeadline)
              : (sub.deadlineOverride?.until ?? cycle.managerReviewDeadline);
            if (new Date(until).getTime() <= new Date(baseDeadline).getTime()) {
              rejected.push({ id: sub.id, reason: '현재 마감보다 이전 날짜' });
              return sub;
            }
            const override: DeadlineExtension = { until, extendedBy: actorId, extendedAt, reason };
            const nextSub: ReviewSubmission = { ...sub, deadlineOverride: override };
            applied.push(sub.id);
            updatedSubs.push(nextSub);
            const arr = byCycle.get(sub.cycleId) ?? [];
            arr.push(sub.id);
            byCycle.set(sub.cycleId, arr);
            return nextSub;
          });
          return { submissions: next };
        });

        for (const sub of updatedSubs) {
          if (syncEnabled) submissionWriter.upsert(sub);
        }
        for (const [cycleId, ids] of byCycle) {
          recordAudit({
            cycleId,
            actorId,
            action: 'submission.deadline_extended',
            targetIds: ids,
            summary: `${ids.length}건 기한 연장 → ${until}`,
            meta: { until, reason },
          });
        }

        return { applied, rejected };
      },

      reassignReviewer: (submissionId, toReviewerId, actorId, reason) => {
        const state = get();
        const sub = state.submissions.find(s => s.id === submissionId);
        if (!sub) return { ok: false, error: '제출을 찾을 수 없습니다.' };
        if (sub.type !== 'downward') return { ok: false, error: '조직장 리뷰만 작성자 변경이 가능합니다.' };
        if (sub.reviewerId === toReviewerId) return { ok: false, error: '동일한 작성자입니다.' };
        const cycle = state.cycles.find(c => c.id === sub.cycleId);
        if (!cycle) return { ok: false, error: '사이클을 찾을 수 없습니다.' };
        if (cycle.status === 'closed') return { ok: false, error: '종료된 사이클입니다.' };

        const at = new Date().toISOString();
        const change: ReviewerChange = { from: sub.reviewerId, to: toReviewerId, at, by: actorId, reason };
        const nextSub: ReviewSubmission = {
          ...sub,
          reviewerId: toReviewerId,
          reviewerHistory: [...(sub.reviewerHistory ?? []), change],
        };

        set(s => ({
          submissions: s.submissions.map(x => x.id === submissionId ? nextSub : x),
        }));
        if (isReviewSyncEnabled()) submissionWriter.upsert(nextSub);

        const { addNotification } = useNotificationStore.getState();
        addNotification({
          id: `ntf-${submissionId}-from-${Date.now()}`,
          userId: change.from,
          title: '리뷰 작성 대상 해제',
          message: `"${cycle.title}" 리뷰 작성자에서 제외되었습니다.`,
          type: 'system',
          isRead: false,
          createdAt: at,
        });
        addNotification({
          id: `ntf-${submissionId}-to-${Date.now()}`,
          userId: toReviewerId,
          title: '리뷰 작성 할당',
          message: `"${cycle.title}" 리뷰 작성자로 지정되었습니다.`,
          type: 'system',
          isRead: false,
          createdAt: at,
          actionUrl: `/reviews/cycles/${cycle.id}`,
        });

        recordAudit({
          cycleId: cycle.id,
          actorId,
          action: 'submission.reviewer_reassigned',
          targetIds: [submissionId],
          summary: `작성자 변경 ${change.from} → ${toReviewerId}`,
          meta: { from: change.from, to: toReviewerId, reason },
        });

        return { ok: true };
      },

      submitAsProxy: (submissionId, actorId, overallRating) => {
        const state = get();
        const sub = state.submissions.find(s => s.id === submissionId);
        if (!sub) return { ok: false, error: '제출을 찾을 수 없습니다.' };
        const cycle = state.cycles.find(c => c.id === sub.cycleId);
        if (!cycle) return { ok: false, error: '사이클을 찾을 수 없습니다.' };
        if (cycle.status === 'closed') return { ok: false, error: '종료된 사이클입니다.' };

        const submittedAt = new Date().toISOString();
        const nextSub: ReviewSubmission = {
          ...sub,
          status: 'submitted',
          submittedAt,
          overallRating,
          proxyWrittenBy: actorId,
        };
        set(s => ({
          submissions: s.submissions.map(x => x.id === submissionId ? nextSub : x),
        }));
        if (isReviewSyncEnabled()) submissionWriter.upsert(nextSub);

        recordAudit({
          cycleId: cycle.id,
          actorId,
          action: 'submission.proxy_submitted',
          targetIds: [submissionId],
          summary: `대리 제출 (피평가: ${sub.revieweeId})`,
          meta: { revieweeId: sub.revieweeId, originalReviewerId: sub.reviewerId, overallRating },
        });
        return { ok: true };
      },

      assignPeerReviewers: (cycleId, revieweeId, peerIds, actorId) => {
        const state = get();
        const cycle = state.cycles.find(c => c.id === cycleId);
        if (!cycle) return { created: 0, skipped: 0 };
        const existing = state.submissions.filter(s =>
          s.cycleId === cycleId && s.revieweeId === revieweeId && s.type === 'peer'
        );
        const existingReviewerSet = new Set(existing.map(s => s.reviewerId));
        const now = new Date().toISOString();
        let created = 0;
        let skipped = 0;
        const newSubs: ReviewSubmission[] = [];
        for (const peerId of peerIds) {
          if (peerId === revieweeId || existingReviewerSet.has(peerId)) {
            skipped += 1;
            continue;
          }
          const sub: ReviewSubmission = {
            id: `sub_peer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            cycleId,
            reviewerId: peerId,
            revieweeId,
            type: 'peer',
            status: 'not_started',
            answers: [],
            lastSavedAt: now,
          };
          newSubs.push(sub);
          created += 1;
        }
        if (newSubs.length > 0) {
          set(s => ({ submissions: [...s.submissions, ...newSubs] }));
          if (isReviewSyncEnabled()) newSubs.forEach(sub => submissionWriter.upsert(sub));
          recordAudit({
            cycleId,
            actorId,
            action: 'cycle.settings_updated',
            targetIds: newSubs.map(s => s.id),
            summary: `동료 리뷰 ${created}건 배정 (피평가: ${revieweeId})`,
            meta: { revieweeId, peerIds },
          });
        }
        return { created, skipped };
      },

      proposePeerReviewers: (cycleId, revieweeId, peerIds) => {
        const state = get();
        const cycle = state.cycles.find(c => c.id === cycleId);
        if (!cycle) return { created: 0, skipped: 0, error: '사이클을 찾을 수 없습니다.' };
        const policy = cycle.peerSelection;
        if (!policy || policy.method !== 'leader_approves') {
          return { created: 0, skipped: 0, error: '조직장 승인 방식이 아닙니다.' };
        }
        if (peerIds.length < policy.minPeers || peerIds.length > policy.maxPeers) {
          return { created: 0, skipped: 0, error: `${policy.minPeers}–${policy.maxPeers}명 선택해 주세요.` };
        }
        const existing = state.submissions.filter(s =>
          s.cycleId === cycleId && s.revieweeId === revieweeId && s.type === 'peer'
        );
        const existingReviewerSet = new Set(existing.map(s => s.reviewerId));
        const now = new Date().toISOString();
        let created = 0;
        let skipped = 0;
        const newSubs: ReviewSubmission[] = [];
        for (const peerId of peerIds) {
          if (peerId === revieweeId || existingReviewerSet.has(peerId)) {
            skipped += 1;
            continue;
          }
          const sub: ReviewSubmission = {
            id: `sub_peer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            cycleId,
            reviewerId: peerId,
            revieweeId,
            type: 'peer',
            status: 'not_started',
            answers: [],
            lastSavedAt: now,
            peerProposal: {
              status: 'pending',
              proposedAt: now,
              proposedBy: revieweeId,
            },
          };
          newSubs.push(sub);
          created += 1;
        }
        if (newSubs.length > 0) {
          set(s => ({ submissions: [...s.submissions, ...newSubs] }));
          if (isReviewSyncEnabled()) newSubs.forEach(sub => submissionWriter.upsert(sub));
          recordAudit({
            cycleId,
            actorId: revieweeId,
            action: 'cycle.settings_updated',
            targetIds: newSubs.map(s => s.id),
            summary: `동료 리뷰 제안 ${created}건 (조직장 승인 대기)`,
            meta: { revieweeId, peerIds },
          });
        }
        return { created, skipped };
      },

      decidePeerProposal: (submissionId, approve, actorId, reason) => {
        const state = get();
        const sub = state.submissions.find(s => s.id === submissionId);
        if (!sub) return { ok: false, error: '제출을 찾을 수 없습니다.' };
        if (sub.type !== 'peer' || !sub.peerProposal) return { ok: false, error: '승인 대상이 아닙니다.' };
        if (sub.peerProposal.status !== 'pending') return { ok: false, error: '이미 처리된 제안입니다.' };
        const now = new Date().toISOString();
        if (approve) {
          const nextSub: ReviewSubmission = {
            ...sub,
            peerProposal: {
              ...sub.peerProposal,
              status: 'approved',
              decidedAt: now,
              decidedBy: actorId,
            },
          };
          set(s => ({ submissions: s.submissions.map(x => x.id === submissionId ? nextSub : x) }));
          if (isReviewSyncEnabled()) submissionWriter.upsert(nextSub);
          recordAudit({
            cycleId: sub.cycleId,
            actorId,
            action: 'cycle.settings_updated',
            targetIds: [submissionId],
            summary: `동료 리뷰 제안 승인 (reviewer=${sub.reviewerId})`,
          });
        } else {
          const nextSub: ReviewSubmission = {
            ...sub,
            peerProposal: {
              ...sub.peerProposal,
              status: 'rejected',
              decidedAt: now,
              decidedBy: actorId,
              rejectionReason: reason,
            },
          };
          set(s => ({ submissions: s.submissions.map(x => x.id === submissionId ? nextSub : x) }));
          if (isReviewSyncEnabled()) submissionWriter.upsert(nextSub);
          recordAudit({
            cycleId: sub.cycleId,
            actorId,
            action: 'cycle.settings_updated',
            targetIds: [submissionId],
            summary: `동료 리뷰 제안 반려`,
            meta: { reason },
          });
        }
        return { ok: true };
      },

      pickPeerReviewers: (cycleId, revieweeId, peerIds) => {
        // 피평가자 본인이 reviewee_picks 방식에서 동료를 고를 때 사용.
        // 정책에 따라 min/max 범위 검증.
        const state = get();
        const cycle = state.cycles.find(c => c.id === cycleId);
        if (!cycle) return { created: 0, skipped: 0, error: '사이클을 찾을 수 없습니다.' };
        const policy = cycle.peerSelection;
        if (!policy || policy.method !== 'reviewee_picks') {
          return { created: 0, skipped: 0, error: '이 사이클은 피평가자 선택 방식이 아닙니다.' };
        }
        // 현재 고른 갯수 확인
        if (peerIds.length < policy.minPeers || peerIds.length > policy.maxPeers) {
          return { created: 0, skipped: 0, error: `${policy.minPeers}–${policy.maxPeers}명 선택해 주세요.` };
        }
        // 내부적으로 assignPeerReviewers 재사용 — actorId='self:<revieweeId>' 로 구분
        return get().assignPeerReviewers(cycleId, revieweeId, peerIds, `self:${revieweeId}`);
      },

      reopenSubmission: (submissionId, actorId) => {
        const state = get();
        const sub = state.submissions.find(s => s.id === submissionId);
        if (!sub) return { ok: false, error: '제출을 찾을 수 없습니다.' };
        if (sub.status !== 'submitted') return { ok: false, error: '제출 완료 상태에서만 재오픈할 수 있습니다.' };
        const cycle = state.cycles.find(c => c.id === sub.cycleId);
        if (!cycle) return { ok: false, error: '사이클을 찾을 수 없습니다.' };
        if (cycle.status === 'closed') return { ok: false, error: '종료된 사이클입니다.' };

        const nextSub: ReviewSubmission = {
          ...sub,
          status: 'in_progress',
          lastSavedAt: new Date().toISOString(),
        };
        set(s => ({
          submissions: s.submissions.map(x => x.id === submissionId ? nextSub : x),
        }));
        if (isReviewSyncEnabled()) submissionWriter.upsert(nextSub);

        recordAudit({
          cycleId: cycle.id,
          actorId,
          action: 'submission.reopened',
          targetIds: [submissionId],
          summary: `제출 재오픈`,
        });
        return { ok: true };
      },

      /* ── 시트 동기화 ──────────────────────────────────────────── */
      /**
       * QA 라운드 12 — A3/B2 fix.
       * submissions 는 local-newer merge — local 의 lastSavedAt 이 sheet 보다 최신이면 local 유지.
       * 디바운스 중인 미sync 답변이 폴링에 의해 덮어써지지 않도록 보호. local 에만 있고 sheet 에 없는 row 도 보존 (예: sync 누락 큐 대기).
       * cycles/templates 는 단일 admin 작성이라 기존 덮어쓰기 유지.
       */
      syncFromSheet: ({ cycles, templates, submissions }) =>
        set(s => {
          const next: Partial<ReviewState> = {};
          if (cycles !== undefined) {
            // 발행된 cycle 의 templateSnapshot 은 immutable. 시트의 템플릿스냅샷JSON
            // 셀이 비어 있으면 (P0-2 미복원분) parseSheetCycle 가 undefined 로 파싱하고,
            // cycles 를 wholesale 교체하면 store 에서 snapshot 이 소실된다. 그러면
            // getEffectiveTemplate 가 fallback(현 템플릿/DEFAULT) 으로 빠지면서 답변의
            // questionId 와 불일치 → Self 리뷰/팀원평가 화면에서 답변이 "사라진" 것처럼
            // 보인다 (시트의 답변JSON 은 정상). 단계 전환 시 발생하는 cycle write + 폴링이
            // 이 소실을 트리거. 방어: remote 에 snapshot 이 없고 local 에 있으면 보존.
            const localById = new Map(s.cycles.map(c => [c.id, c] as const));
            next.cycles = cycles.map(rc => {
              if (rc.templateSnapshot) return rc;
              const lc = localById.get(rc.id);
              if (lc?.templateSnapshot) {
                return {
                  ...rc,
                  templateSnapshot:   lc.templateSnapshot,
                  templateSnapshotAt: rc.templateSnapshotAt ?? lc.templateSnapshotAt,
                };
              }
              return rc;
            });
          }
          if (templates !== undefined) next.templates = templates;
          if (submissions !== undefined) {
            const remoteById = new Map(submissions.map(r => [r.id, r] as const));
            const merged: ReviewSubmission[] = [];
            const seenIds = new Set<string>();
            for (const r of submissions) {
              const l = s.submissions.find(x => x.id === r.id);
              if (!l) { merged.push(r); seenIds.add(r.id); continue; }
              const lTs = Date.parse(l.lastSavedAt) || 0;
              const rTs = Date.parse(r.lastSavedAt) || 0;
              merged.push(lTs > rTs ? l : r);
              seenIds.add(r.id);
            }
            // local 에만 있고 remote 에 없는 row (sync 큐 대기 또는 미발행) 보존
            for (const l of s.submissions) {
              if (!seenIds.has(l.id) && !remoteById.has(l.id)) merged.push(l);
            }
            next.submissions = merged;
          }
          return next;
        }),

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'review-data-v3',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state): PersistedState => ({
        cycles:      state.cycles,
        templates:   state.templates,
        submissions: state.submissions,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.templates.length === 0) {
          state.templates = [DEFAULT_TEMPLATE];
        }
      },
    }
  )
);
