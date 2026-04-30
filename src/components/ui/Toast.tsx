import { create } from 'zustand';
import { MsCheckCircleIcon, MsWarningIcon, MsCancelIcon, MsInfoIcon } from './MsIcons';

type ToastType = 'success' | 'warning' | 'error' | 'info';
interface ToastItem { id: string; type: ToastType; message: string; }
interface ToastState {
  toasts: ToastItem[];
  show: (type: ToastType, message: string) => void;
  remove: (id: string) => void;
}

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  show: (type, message) => {
    const id = `toast_${Date.now()}`;
    set(s => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 4000);
  },
  remove: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

const CONFIG: Record<ToastType, {
  icon: typeof MsCheckCircleIcon;
  iconCls: string;
}> = {
  success: { icon: MsCheckCircleIcon, iconCls: 'text-green-060'  },
  warning: { icon: MsWarningIcon,     iconCls: 'text-orange-060' },
  error:   { icon: MsCancelIcon,      iconCls: 'text-red-060'    },
  info:    { icon: MsInfoIcon,        iconCls: 'text-blue-070'   },
};

function Toast({ toast }: { toast: ToastItem }) {
  const { remove } = useToast();
  const { icon: Icon, iconCls } = CONFIG[toast.type];

  return (
    <div className="
      flex items-start gap-3 bg-white rounded-xl
      shadow-[0_3px_10px_rgb(0,0,0,0.1),0_1px_3px_rgb(0,0,0,0.06)]
      ring-1 ring-gray-010
      px-4 py-3 min-w-72 max-w-sm
      animate-[fadeSlideDown_0.2s_ease]
    ">
      <Icon size={16} className={`flex-shrink-0 mt-0.5 ${iconCls}`} />
      <p className="flex-1 text-base/6 text-fg-default font-medium">{toast.message}</p>
      <button
        onClick={() => remove(toast.id)}
        className="flex-shrink-0 mt-0.5 text-fg-subtlest hover:text-gray-060 transition-colors"
        aria-label="닫기"
      >
        <MsCancelIcon size={12} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToast();
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <Toast toast={t} />
        </div>
      ))}
    </div>
  );
}

export function useShowToast() {
  return useToast(s => s.show);
}
