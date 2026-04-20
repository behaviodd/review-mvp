import { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';
import { useAuthStore } from '../../stores/authStore';
import { formatDateTime } from '../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';

const TYPE_CONFIG = {
  deadline:      { cls: 'bg-primary-50 text-primary-700', label: '마감'      },
  feedback:      { cls: 'bg-primary-50 text-primary-700', label: '피드백'    },
  review_result: { cls: 'bg-success-50 text-success-700', label: '결과'      },
  system:        { cls: 'bg-neutral-100 text-neutral-600', label: '시스템'   },
};

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const { currentUser } = useAuthStore();
  const { notifications, markAsRead, markAllAsRead } = useNotificationStore();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  const mine = notifications.filter(n => n.userId === currentUser?.id).slice(0, 12);
  const unread = mine.filter(n => !n.isRead).length;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleClick = (n: typeof mine[0]) => {
    markAsRead(n.id);
    if (n.actionUrl) navigate(n.actionUrl);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg hover:bg-neutral-100 transition-colors"
        aria-label={`알림 ${unread}개`}
      >
        <Bell size={17} className={unread > 0 ? 'text-neutral-700' : 'text-neutral-500'} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-danger-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-modal border border-neutral-200 z-50 overflow-hidden animate-[fadeSlideDown_0.15s_ease]">
          {/* header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-neutral-900">알림</h3>
              {unread > 0 && (
                <span className="text-xs font-bold bg-danger-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                  {unread}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={() => markAllAsRead(currentUser!.id)}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 px-2 py-1 rounded hover:bg-primary-50 transition-colors"
                >
                  <CheckCheck size={12} /> 모두 읽음
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* list */}
          <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100">
            {mine.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-10">새 알림이 없습니다.</p>
            ) : mine.map(n => {
              const tc = TYPE_CONFIG[n.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.system;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors ${!n.isRead ? 'bg-primary-50/30' : ''}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${n.isRead ? 'bg-transparent' : 'bg-primary-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tc.cls}`}>
                          {tc.label}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-neutral-900 leading-snug">{n.title}</p>
                      <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                      <p className="text-[11px] text-neutral-400 mt-1">{formatDateTime(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
