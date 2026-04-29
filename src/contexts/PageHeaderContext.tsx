import { createContext, useContext, useState, useEffect, useMemo, useRef, type ReactNode } from 'react';

interface PageHeader {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
  // Phase D-2.3: 헤더에 붙은 Tab strip (Figma 정합) — 페이지 1차 분류용.
  // 콘텐츠 영역 안의 세그먼테이션은 ListToolbar segments 사용 (역할 분리).
  tabs?: ReactNode;
  // Tab strip 우측 작은 액션 버튼 그룹 (예: 조직도/정렬/필터 토글)
  tabActions?: ReactNode;
}

const PageHeaderContext = createContext<{
  header: PageHeader;
  setHeader: (h: PageHeader) => void;
}>({ header: { title: '' }, setHeader: () => {} });

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<PageHeader>({ title: '' });
  // Memoize the context value so that consumers don't re-render every time the
  // provider parent renders. setHeader from useState is stable.
  const value = useMemo(() => ({ header, setHeader }), [header]);
  return (
    <PageHeaderContext.Provider value={value}>
      {children}
    </PageHeaderContext.Provider>
  );
}

/**
 * 페이지 컴포넌트에서 호출해 헤더 제목·액션·뒤로가기를 설정한다.
 *
 * 안정성 보장:
 * - `onBack` 콜백은 매 렌더마다 새 함수 참조여도 안전하다 (ref 패턴으로 안정화).
 * - `actions`/`subtitle` 은 안정적인 참조를 권장 — useMemo 로 감싸지 않으면
 *   매 렌더마다 setHeader 가 호출된다 (값이 의미적으로 같아도).
 *   단, 이로 인해 무한 루프가 발생하지는 않는다.
 */
export function useSetPageHeader(
  title: string,
  actions?: ReactNode,
  options?: { subtitle?: ReactNode; onBack?: () => void; tabs?: ReactNode; tabActions?: ReactNode },
) {
  const { setHeader } = useContext(PageHeaderContext);
  const subtitle = options?.subtitle;
  const onBack = options?.onBack;
  const tabs = options?.tabs;
  const tabActions = options?.tabActions;

  // 최신 onBack 을 ref 에 보관 → stableOnBack 이 항상 최신 closure 를 호출.
  // 이 패턴이 없으면 매 렌더마다 onBack 이 새 함수라서 effect 가 무한 재발화한다.
  const onBackRef = useRef(onBack);
  useEffect(() => { onBackRef.current = onBack; });

  const hasBack = !!onBack;
  const stableOnBack = useMemo<(() => void) | undefined>(
    () => hasBack ? () => onBackRef.current?.() : undefined,
    [hasBack],
  );

  useEffect(() => {
    setHeader({ title, actions, subtitle, onBack: stableOnBack, tabs, tabActions });
  }, [setHeader, title, actions, subtitle, stableOnBack, tabs, tabActions]);

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
