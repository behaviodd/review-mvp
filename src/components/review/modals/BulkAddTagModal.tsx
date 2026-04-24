import { useState } from 'react';
import { ModalShell } from './ModalShell';
import { MsButton } from '../../ui/MsButton';
import { TagInput } from '../TagInput';

interface Props {
  open: boolean;
  onClose: () => void;
  count: number;
  suggestions: string[];
  onConfirm: (tags: string[]) => void;
}

export function BulkAddTagModal({ open, onClose, count, suggestions, onConfirm }: Props) {
  const [tags, setTags] = useState<string[]>([]);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="태그 추가"
      description={`선택한 ${count}개 사이클에 태그를 추가합니다. (중복 태그는 무시)`}
      widthClass="max-w-md"
      footer={
        <>
          <MsButton variant="ghost" size="sm" onClick={onClose}>취소</MsButton>
          <MsButton size="sm" disabled={tags.length === 0} onClick={() => onConfirm(tags)}>추가</MsButton>
        </>
      }
    >
      <TagInput value={tags} onChange={setTags} suggestions={suggestions} placeholder="태그 Enter로 추가" />
    </ModalShell>
  );
}
