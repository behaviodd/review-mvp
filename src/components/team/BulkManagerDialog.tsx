import { useState, useMemo } from 'react';
import { useTeamStore } from '../../stores/teamStore';
import { isUserActive } from '../../utils/userCompat';
import { MsButton } from '../ui/MsButton';
import { UserSearchSelect } from '../ui/UserSearchSelect';

interface Props {
  open: boolean;
  selectedCount: number;
  onConfirm: (managerId: string | undefined) => void;
  onClose: () => void;
}

export function BulkManagerDialog({ open, selectedCount, onConfirm, onClose }: Props) {
  const { users, orgUnits } = useTeamStore();

  const headIds = useMemo(
    () => new Set(orgUnits.map(u => u.headId).filter(Boolean) as string[]),
    [orgUnits],
  );

  const managerOptions = useMemo(
    () =>
      users
        .filter(u => isUserActive(u) && (u.role === 'admin' || u.role === 'leader' || headIds.has(u.id)))
        .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [users, headIds],
  );

  const [managerId, setManagerId] = useState('');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-[fadeIn_120ms_ease-out]" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 animate-[scaleIn_140ms_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-base font-bold text-fg-default tracking-[-0.3px]">
            보고대상 일괄 변경
          </h2>
          <p className="text-sm text-fg-subtle mt-1">
            선택된 <strong className="text-fg-default">{selectedCount}명</strong>의 보고대상을 변경합니다.
          </p>
        </div>

        <div className="px-6 py-4">
          <UserSearchSelect
            label="새 보고대상"
            value={managerId}
            onChange={setManagerId}
            users={managerOptions}
            clearLabel="없음 (보고대상 해제)"
          />
        </div>

        <div className="px-6 pb-6 flex justify-end gap-2">
          <MsButton variant="outline-default" size="sm" onClick={onClose}>
            취소
          </MsButton>
          <MsButton
            size="sm"
            onClick={() => {
              onConfirm(managerId || undefined);
              onClose();
            }}
          >
            변경
          </MsButton>
        </div>
      </div>
    </div>
  );
}
