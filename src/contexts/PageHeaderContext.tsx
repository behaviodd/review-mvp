import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface PageHeader {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
}

const PageHeaderContext = createContext<{
  header: PageHeader;
  setHeader: (h: PageHeader) => void;
}>({ header: { title: '' }, setHeader: () => {} });

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<PageHeader>({ title: '' });
  return (
    <PageHeaderContext.Provider value={{ header, setHeader }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

/**
 * Call from a page component to set the header title and optional action buttons.
 * Pass memoized JSX for `actions`/`subtitle` to avoid re-render loops.
 *
 * 중요한 두 가지 useEffect 분리
 * 1) 본 effect: title/actions/subtitle/onBack 이 바뀌면 setHeader 갱신
 * 2) unmount-only cleanup: 페이지 빠질 때만 헤더 초기화. 매 deps 변경 시 cleanup 이
 *    헤더를 일시적으로 비워서 onBack 클릭이 누락되는 문제 (R7) 회피.
 */
export function useSetPageHeader(
  title: string,
  actions?: ReactNode,
  options?: { subtitle?: ReactNode; onBack?: () => void },
) {
  const { setHeader } = useContext(PageHeaderContext);

  useEffect(() => {
    setHeader({ title, actions, subtitle: options?.subtitle, onBack: options?.onBack });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, actions, options?.subtitle, options?.onBack]);

  // unmount-only — 페이지 이동 시 다음 페이지가 즉시 setHeader 를 호출하므로
  // 일반적으로 보이지 않음. NotFound 등 호출 누락 페이지 대비.
  useEffect(() => {
    return () => setHeader({ title: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function usePageHeader() {
  return useContext(PageHeaderContext).header;
}
