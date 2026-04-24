import { Component, type ErrorInfo, type ReactNode } from 'react';
import { MsAlertIcon, MsRefreshIcon, MsHomeIcon } from '../ui/MsIcons';
import { MsButton } from '../ui/MsButton';

interface Props {
  children: ReactNode;
  /** fallback 모드. page = 페이지 내부 카드, root = 전체 화면 */
  scope?: 'page' | 'root';
  /** 에러 발생 시 자동으로 호출되는 콜백 (로깅 등) */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = '/';
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isRoot = this.props.scope === 'root';
    const wrapper = isRoot
      ? 'min-h-screen flex items-center justify-center bg-gray-001 p-6'
      : 'flex items-center justify-center py-16 px-6';

    return (
      <div className={wrapper}>
        <div className="max-w-md w-full rounded-2xl bg-white border border-gray-010 shadow-card p-8 text-center">
          <div className="size-14 mx-auto rounded-2xl bg-red-005 flex items-center justify-center mb-4">
            <MsAlertIcon size={24} className="text-red-060" />
          </div>
          <p className="text-base font-semibold text-gray-080 mb-1">문제가 발생했어요</p>
          <p className="text-sm text-gray-050 mb-1">
            페이지를 표시하는 중 오류가 발생했습니다.
          </p>
          <p className="text-xs text-gray-040 mb-6 break-words">
            {error.message || '알 수 없는 오류'}
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <MsButton
              size="md"
              variant="brand1"
              onClick={this.handleReset}
              leftIcon={<MsRefreshIcon size={14} />}
            >
              다시 시도
            </MsButton>
            <MsButton
              size="md"
              variant="outline-default"
              onClick={this.handleReload}
            >
              새로고침
            </MsButton>
            {!isRoot && (
              <MsButton
                size="md"
                variant="ghost"
                onClick={this.handleHome}
                leftIcon={<MsHomeIcon size={14} />}
              >
                홈으로
              </MsButton>
            )}
          </div>
        </div>
      </div>
    );
  }
}
