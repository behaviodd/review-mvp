import { cn } from '../../utils/cn';
import { MsButton } from '../ui/MsButton';
import { MsCancelIcon, MsArticleIcon, MsDeleteIcon, MsEditIcon } from '../ui/MsIcons';

interface Props {
  selectedCount: number;
  totalMembers: number;
  totalSubmissions: number;
  onClear: () => void;
  onMoveFolder: () => void;
  onAddTag: () => void;
  onArchive: () => void;
  onClone: () => void;
  onDelete: () => void;
}

export function CycleBulkBar({
  selectedCount, totalMembers, totalSubmissions,
  onClear, onMoveFolder, onAddTag, onArchive, onClone, onDelete,
}: Props) {
  if (selectedCount === 0) return null;
  return (
    <div
      className={cn(
        'sticky bottom-4 z-20 mx-auto flex max-w-5xl items-center gap-3 rounded-full border border-gray-020 bg-white/95 px-4 py-2 shadow-modal backdrop-blur',
      )}
      role="toolbar"
      aria-label="사이클 일괄 작업"
    >
      <span className="text-xs font-semibold text-gray-080">
        {selectedCount}개 선택됨
        <span className="ml-2 text-gray-040 font-normal">
          대상 {totalMembers}명 · 제출 {totalSubmissions}건
        </span>
      </span>
      <div className="ml-auto flex items-center gap-2">
        <MsButton variant="ghost" size="sm" onClick={onClear} leftIcon={<MsCancelIcon />}>해제</MsButton>
        <MsButton variant="outline-default" size="sm" onClick={onMoveFolder} leftIcon={<MsArticleIcon />}>폴더 이동</MsButton>
        <MsButton variant="outline-default" size="sm" onClick={onAddTag} leftIcon={<MsEditIcon />}>태그 추가</MsButton>
        <MsButton variant="outline-default" size="sm" onClick={onClone}>복제</MsButton>
        <MsButton variant="outline-default" size="sm" onClick={onArchive}>보관</MsButton>
        <MsButton variant="outline-red" size="sm" onClick={onDelete} leftIcon={<MsDeleteIcon />}>삭제</MsButton>
      </div>
    </div>
  );
}
