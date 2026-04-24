import { useAuthStore } from '../../stores/authStore';
import { usePageHeader } from '../../contexts/PageHeaderContext';
import { MsChevronLeftLineIcon } from '../ui/MsIcons';

export function Header() {
  const { currentUser } = useAuthStore();
  const { title, subtitle, actions, onBack } = usePageHeader();

  if (!currentUser) return null;

  return (
    <header className="h-[72px] bg-white border-b border-gray-020 flex items-center px-6 sticky top-0 z-10 gap-3 flex-shrink-0">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-060 hover:bg-gray-010 hover:text-gray-080 transition-colors"
          aria-label="뒤로"
        >
          <MsChevronLeftLineIcon size={20} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        {title && (
          <h1 className="text-xl font-bold text-gray-099 tracking-[-0.3px] leading-7 truncate">{title}</h1>
        )}
        {subtitle && (
          <div className="text-xs text-gray-040 mt-0.5 truncate">{subtitle}</div>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-[60%] flex-shrink-0">{actions}</div>
      )}
    </header>
  );
}
