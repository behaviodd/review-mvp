import { useMemo } from 'react';
import { useSetPageHeader } from '../contexts/PageHeaderContext';
import { usePermission } from '../hooks/usePermission';
import { EmptyState } from '../components/ui/EmptyState';
import { Pill } from '../components/ui/Pill';
import { MsButton } from '../components/ui/MsButton';
import { MsCheckbox } from '../components/ui/MsControl';
import { MsChevronUpLineIcon, MsChevronDownLineIcon, MsLockIcon, MsRefreshIcon } from '../components/ui/MsIcons';
import { useShowToast } from '../components/ui/Toast';
import {
  useProfileFieldStore,
  PROFILE_FIELD_LABEL,
  PROFILE_FIELD_LOCKED,
  PROFILE_VIEWER_LABEL,
  PROFILE_VIEWER_ORDER,
} from '../stores/profileFieldStore';
import type { ProfileFieldConfig, ProfileFieldKey, ProfileFieldViewer } from '../types';

/**
 * 어드민 — 구성원 프로필 설정.
 * 기본 정보 항목의 노출 순서와 열람 권한을 구성한다.
 * 이름·이메일은 잠금 — 항상 모든 구성원에게 노출.
 *
 * UI: 구성원 추가 모달과 동일한 섹션 헤더 + 카드 구조.
 */
export function ProfileFieldSettings() {
  const { can } = usePermission();
  const fields = useProfileFieldStore(s => s.fields);
  const toggleViewer = useProfileFieldStore(s => s.toggleViewer);
  const move = useProfileFieldStore(s => s.move);
  const reset = useProfileFieldStore(s => s.reset);
  const showToast = useShowToast();

  const headerActions = useMemo(() => can.manageOrg ? (
    <MsButton
      variant="ghost"
      leftIcon={<MsRefreshIcon size={14} />}
      onClick={() => {
        if (!confirm('기본값으로 되돌립니다. 진행할까요?')) return;
        reset();
        showToast('success', '기본값으로 초기화되었습니다.');
      }}
    >
      기본값 복원
    </MsButton>
  ) : undefined, [can.manageOrg, reset, showToast]);

  useSetPageHeader('구성원 프로필 설정', headerActions, {
    subtitle: '기본 정보 항목의 노출 순서와 열람 권한을 설정합니다.',
  });

  if (!can.manageOrg) {
    return (
      <EmptyState
        illustration="empty-list"
        title="권한이 없어요"
        description="구성원 프로필 설정은 '조직·구성원 관리' 권한 보유자만 접근할 수 있습니다."
      />
    );
  }

  const sorted = [...fields].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-020 shadow-card p-5 space-y-5">
        {/* 기본 정보 */}
        <section>
          <p className="text-[11px] font-semibold text-gray-040 uppercase tracking-wide mb-3">기본 정보</p>
          <p className="text-xs text-gray-050 mb-4 leading-relaxed">
            이름·이메일은 모든 구성원에게 항상 노출되며 열람 권한을 변경할 수 없습니다.
            그 외 항목은 본인·조직 리더·평가권자·모든 구성원 중 누구에게 보일지 선택하세요.
            어드민은 모든 항목을 항상 열람할 수 있습니다.
          </p>

          <div className="rounded-lg border border-gray-010 divide-y divide-gray-005">
            {sorted.map((field, idx) => (
              <FieldRow
                key={field.key}
                field={field}
                isFirst={idx === 0}
                isLast={idx === sorted.length - 1}
                onMoveUp={() => move(field.key, 'up')}
                onMoveDown={() => move(field.key, 'down')}
                onToggleViewer={(v) => toggleViewer(field.key, v)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── Field Row ──────────────────────────────────────────────────────── */
function FieldRow({
  field,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onToggleViewer,
}: {
  field: ProfileFieldConfig;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleViewer: (v: ProfileFieldViewer) => void;
}) {
  const locked = PROFILE_FIELD_LOCKED.includes(field.key);
  const label = PROFILE_FIELD_LABEL[field.key];

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      {/* 순서 */}
      <div className="flex flex-col gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label={`${label} 위로`}
          className="p-0.5 rounded text-gray-040 hover:text-gray-080 hover:bg-gray-010 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <MsChevronUpLineIcon size={14} />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label={`${label} 아래로`}
          className="p-0.5 rounded text-gray-040 hover:text-gray-080 hover:bg-gray-010 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <MsChevronDownLineIcon size={14} />
        </button>
      </div>

      {/* 필드명 */}
      <div className="w-28 shrink-0">
        <p className="text-sm font-medium text-gray-080">{label}</p>
        <FieldKeyHint k={field.key} />
      </div>

      {/* 권한 */}
      <div className="flex-1 min-w-0">
        {locked ? (
          <Pill tone="neutral" size="sm" leftIcon={<MsLockIcon size={10} />}>
            모든 구성원에게 항상 노출 · 변경 불가
          </Pill>
        ) : (
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {PROFILE_VIEWER_ORDER.map(viewer => (
              <MsCheckbox
                key={viewer}
                size="md"
                checked={field.viewers.includes(viewer)}
                onChange={() => onToggleViewer(viewer)}
                label={PROFILE_VIEWER_LABEL[viewer]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldKeyHint({ k }: { k: ProfileFieldKey }) {
  const hint: Record<ProfileFieldKey, string> = {
    name:        '필수',
    nameEn:      '선택',
    email:       '필수',
    phone:       '선택',
    joinDate:    '선택',
    jobFunction: '선택',
  };
  return <p className="text-[11px] text-gray-040 mt-0.5">{hint[k]}</p>;
}
