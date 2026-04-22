import { useAuthStore } from '../../stores/authStore';
import { usePageHeader } from '../../contexts/PageHeaderContext';

export function Header() {
  const { currentUser } = useAuthStore();
  const { title, actions } = usePageHeader();

  if (!currentUser) return null;

  return (
    <header className="h-[72px] bg-white border-b border-[#dee2e6] flex items-center justify-between px-6 sticky top-0 z-10 gap-4 flex-shrink-0">
      {title && (
        <h1 className="text-2xl font-bold text-[#212529] tracking-[-0.3px] leading-10 truncate">{title}</h1>
      )}
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </header>
  );
}
