import { useEffect, useState } from 'react';
import { useReviewStore } from '../../stores/reviewStore';
import { useAuthStore } from '../../stores/authStore';
import { useShowToast } from '../ui/Toast';
import { MsButton } from '../ui/MsButton';
import { MsLockIcon } from '../ui/MsIcons';
import { SideDrawer } from '../ui/SideDrawer';
import { TagInput } from './TagInput';
import { PolicySection } from './cycleNew/PolicySection';
import { AutomationSection } from './cycleNew/AutomationSection';
import { recordAudit } from '../../utils/auditLog';
import type {
  AnonymityPolicy, AutoAdvanceRule, ReferenceInfoPolicy, ReminderRule, ReviewCycle, VisibilityPolicy,
} from '../../types';

interface Props {
  cycle: ReviewCycle;
  open: boolean;
  onClose: () => void;
}

interface DraftState {
  tags: string[];
  anonymity?: AnonymityPolicy;
  visibility?: VisibilityPolicy;
  referenceInfo?: ReferenceInfoPolicy;
  autoAdvance?: AutoAdvanceRule;
  reminderPolicy?: ReminderRule[];
  scheduledPublishAt?: string;
}

function buildDraft(c: ReviewCycle): DraftState {
  return {
    tags: [...(c.tags ?? [])],
    anonymity: c.anonymity ? { ...c.anonymity } : undefined,
    visibility: c.visibility ? { ...c.visibility } : undefined,
    referenceInfo: c.referenceInfo ? { ...c.referenceInfo } : undefined,
    autoAdvance: c.autoAdvance ? { ...c.autoAdvance } : undefined,
    reminderPolicy: c.reminderPolicy ? [...c.reminderPolicy] : undefined,
    scheduledPublishAt: c.scheduledPublishAt,
  };
}

export function CycleSettingsDrawer({ cycle, open, onClose }: Props) {
  const updateCycle = useReviewStore(s => s.updateCycle);
  const allCycles = useReviewStore(s => s.cycles);
  const currentUser = useAuthStore(s => s.currentUser);
  const showToast = useShowToast();
  const [draft, setDraft] = useState<DraftState>(() => buildDraft(cycle));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(buildDraft(cycle));
  }, [open, cycle]);

  if (!open) return null;

  const readOnly = !!cycle.editLockedAt;
  const allTags = Array.from(new Set(allCycles.flatMap(c => c.tags ?? [])));

  const save = () => {
    if (readOnly) return;
    setSaving(true);
    try {
      updateCycle(cycle.id, {
        tags: draft.tags,
        anonymity: draft.anonymity,
        visibility: draft.visibility,
        referenceInfo: draft.referenceInfo,
        autoAdvance: draft.autoAdvance,
        reminderPolicy: draft.reminderPolicy,
        scheduledPublishAt: draft.scheduledPublishAt,
      });
      recordAudit({
        cycleId: cycle.id,
        actorId: currentUser?.id ?? 'system',
        action: 'cycle.settings_updated',
        targetIds: [cycle.id],
        summary: '리뷰 설정 수정',
        meta: {
          tagsCount: draft.tags.length,
          anonymity: draft.anonymity ?? {},
          visibility: draft.visibility ?? {},
          referenceInfo: draft.referenceInfo ?? {},
        },
      });
      showToast('success', '설정이 저장되었습니다.');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="리뷰 설정"
      description="발행 후에도 바꿀 수 있는 정책·태그·자동화 설정"
      width="lg"
      footer={
        <>
          <MsButton variant="ghost" size="sm" onClick={onClose} disabled={saving}>취소</MsButton>
          <MsButton size="sm" onClick={save} disabled={readOnly || saving} loading={saving}>저장</MsButton>
        </>
      }
    >
      <>
        {readOnly && (
          <div className="flex items-start gap-2 border-b border-gray-010 bg-gray-005 px-5 py-2.5">
            <MsLockIcon size={14} className="mt-0.5 shrink-0 text-gray-060" />
            <p className="text-xs text-gray-060">
              편집 잠금 상태입니다. 상세 화면에서 "잠금 해제" 후 수정할 수 있습니다.
            </p>
          </div>
        )}

        <div className="px-5 py-4 space-y-5">
          {/* 태그 */}
          <section>
            <h3 className="text-sm font-semibold text-gray-080 mb-2">태그</h3>
            <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
              <TagInput
                value={draft.tags}
                onChange={tags => setDraft(d => ({ ...d, tags }))}
                suggestions={allTags}
                placeholder="태그 Enter로 추가"
                disabled={readOnly}
              />
            </div>
          </section>

          {/* 정책 */}
          <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
            <PolicySection
              form={draft}
              setForm={setDraft as unknown as React.Dispatch<React.SetStateAction<DraftState>>}
            />
          </div>

          {/* 자동화 */}
          <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
            <AutomationSection
              form={draft}
              setForm={setDraft as unknown as React.Dispatch<React.SetStateAction<DraftState>>}
            />
          </div>
        </div>
      </>
    </SideDrawer>
  );
}
