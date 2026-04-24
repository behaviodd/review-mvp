import { useMemo, useState } from 'react';
import { ModalShell } from './ModalShell';
import { MsButton } from '../../ui/MsButton';
import { MsSelect } from '../../ui/MsControl';
import { useFolderStore } from '../../../stores/folderStore';

interface Props {
  open: boolean;
  onClose: () => void;
  count: number;
  onConfirm: (folderId: string | null) => void;
}

export function BulkMoveFolderModal({ open, onClose, count, onConfirm }: Props) {
  const raw = useFolderStore(s => s.folders);
  const folders = useMemo(() => [...raw].sort((a, b) => a.order - b.order), [raw]);
  const [value, setValue] = useState<string>('');

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="폴더로 이동"
      description={`선택한 ${count}개 사이클을 이동합니다.`}
      widthClass="max-w-md"
      footer={
        <>
          <MsButton variant="ghost" size="sm" onClick={onClose}>취소</MsButton>
          <MsButton size="sm" onClick={() => onConfirm(value === '' ? null : value)}>이동</MsButton>
        </>
      }
    >
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-060">대상 폴더</label>
        <MsSelect value={value} onChange={e => setValue(e.target.value)}>
          <option value="">폴더 미지정으로 이동</option>
          {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </MsSelect>
        {folders.length === 0 && (
          <p className="text-xs text-gray-040">좌측 사이드에서 폴더를 먼저 만들어 주세요.</p>
        )}
      </div>
    </ModalShell>
  );
}
