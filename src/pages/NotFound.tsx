import { useNavigate } from 'react-router-dom';
import { useSetPageHeader } from '../contexts/PageHeaderContext';
import { EmptyState } from '../components/ui/EmptyState';

export function NotFound() {
  const navigate = useNavigate();
  useSetPageHeader('페이지를 찾을 수 없어요');

  return (
    <EmptyState
      illustration="empty-list"
      title="페이지를 찾을 수 없어요"
      description={
        <>
          요청하신 주소가 올바르지 않거나,
          <br />
          삭제되었을 수 있습니다.
        </>
      }
      action={{
        label: '대시보드로',
        onClick: () => navigate('/', { replace: true }),
      }}
    />
  );
}
