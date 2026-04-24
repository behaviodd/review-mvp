import { MsWarningIcon } from '../ui/MsIcons';

interface Props {
  reviewerName?: string;
  revieweeName?: string;
  stage: 'self' | 'downward';
}

export function ProxyModeBanner({ reviewerName, revieweeName, stage }: Props) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-020 bg-red-005 px-4 py-3">
      <MsWarningIcon size={16} className="mt-0.5 shrink-0 text-red-050" />
      <div className="text-xs text-red-070 leading-relaxed">
        <p className="font-semibold">대리 작성 모드</p>
        <p className="mt-0.5">
          {stage === 'self'
            ? <>원 작성자: <strong>{revieweeName ?? '대상자'}</strong> — 본인을 대신하여 자기평가를 작성합니다.</>
            : <>원 작성자: <strong>{reviewerName ?? '조직장'}</strong> · 대상자: <strong>{revieweeName ?? '대상자'}</strong></>
          }
          {' '}제출 시 감사 로그에 대리 작성자 정보가 기록됩니다.
        </p>
      </div>
    </div>
  );
}
