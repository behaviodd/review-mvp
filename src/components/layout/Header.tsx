import { useAuthStore } from '../../stores/authStore';
import { usePageHeader } from '../../contexts/PageHeaderContext';

export function Header() {
  const { currentUser } = useAuthStore();
  const { title, actions } = usePageHeader();

  if (!currentUser) return null;

  return (
    <header className="h-[72px] bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-10 gap-4">
      {title && (
        <h1 className="text-base font-semibold text-gray-900 truncate">{title}</h1>
      )}
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </header>
  );
}
