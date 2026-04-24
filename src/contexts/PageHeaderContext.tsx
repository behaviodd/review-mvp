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
 */
export function useSetPageHeader(
  title: string,
  actions?: ReactNode,
  options?: { subtitle?: ReactNode; onBack?: () => void },
) {
  const { setHeader } = useContext(PageHeaderContext);
  useEffect(() => {
    setHeader({ title, actions, subtitle: options?.subtitle, onBack: options?.onBack });
    return () => setHeader({ title: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, actions, options?.subtitle, options?.onBack]);
}

export function usePageHeader() {
  return useContext(PageHeaderContext).header;
}
