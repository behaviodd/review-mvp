import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '../utils/safeStorage';
import type { ReviewCycle, ReviewTemplate, ReviewSubmission, Answer, Notification, DeadlineExtension, ReviewerChange, ReviewKind } from '../types';
import { cycleWriter, templateWriter, submissionWriter } from '../utils/reviewSheetWriter';
import { useSheetsSyncStore } from './sheetsSyncStore';
import { useNotificationStore } from './notificationStore';
import { DEFAULT_TEMPLATE } from '../data/defaultTemplate';
import { recordAudit } from '../utils/auditLog';

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
  submitSubmission: (submissionId: string, overallRating?: number) => void;
  getSubmission: (cycleId: string, reviewerId: string, revieweeId: string, type: ReviewKind) => ReviewSubmission | undefined;
  publishCycle: (cycleId: string, actorId: string) => { ok: boolean; error?: string };
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

      saveAnswer: (submissionId, answer) =>
        set(s => ({
          submissions: s.submissions.map(sub => {
            if (sub.id !== submissionId) return sub;
            const existing = sub.answers.findIndex(a => a.questionId === answer.questionId);
            const newAnswers = existing >= 0
              ? sub.answers.map((a, i) => i === existing ? answer : a)
              : [...sub.answers, answer];
            return { ...sub, answers: newAnswers, status: 'in_progress', lastSavedAt: new Date().toISOString() };
          }),
        })),

      submitSubmission: (submissionId, overallRating) => {
        const submittedAt = new Date().toISOString();
        set(s => ({
          submissions: s.submissions.map(sub =>
            sub.id === submissionId
              ? { ...sub, status: 'submitted', submittedAt, overallRating }
              : sub
          ),
        }));
        if (isReviewSyncEnabled()) {
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
          summary: `발행 (초안 → 자기평가). 템플릿 스냅샷 저장`,
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
          return { created: 0, skipped: 0, error: '리더 승인 방식이 아닙니다.' };
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
            summary: `동료 리뷰 제안 ${created}건 (리더 승인 대기)`,
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
      syncFromSheet: ({ cycles, templates, submissions }) =>
        set(s => ({
          cycles:      cycles      !== undefined ? cycles      : s.cycles,
          templates:   templates   !== undefined ? templates   : s.templates,
          submissions: submissions !== undefined ? submissions : s.submissions,
        })),

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
