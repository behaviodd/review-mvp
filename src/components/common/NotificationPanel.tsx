import { useState, useRef, useEffect } from 'react';
import { MsCancelIcon, MsAlertIcon, MsCheckIcon } from '../ui/MsIcons';
import { useNotificationStore } from '../../stores/notificationStore';
import { useAuthStore } from '../../stores/authStore';
import { formatDateTime } from '../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';

const TYPE_CONFIG = {
  deadline:      { cls: 'bg-pink-005 text-pink-060', label: '마감'      },
  feedback:      { cls: 'bg-pink-005 text-pink-060', label: '피드백'    },
  review_result: { cls: 'bg-green-005 text-green-060', label: '결과'      },
  system:        { cls: 'bg-gray-010 text-gray-060', label: '시스템'   },
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
        className="relative p-2 rounded-lg hover:bg-gray-010 transition-colors"
        aria-label={`알림 ${unread}개`}
      >
        <MsAlertIcon size={16} className={unread > 0 ? 'text-gray-070' : 'text-fg-subtle'} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-040 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-modal border border-gray-020 z-50 overflow-hidden animate-[fadeSlideDown_0.15s_ease]">
          {/* header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-010">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-fg-default">알림</h3>
              {unread > 0 && (
                <span className="text-xs font-bold bg-red-040 text-white px-1.5 py-0.5 rounded-full leading-none">
                  {unread}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && currentUser && (
                <button
                  onClick={() => markAllAsRead(currentUser.id)}
                  className="flex items-center gap-1 text-xs text-pink-050 hover:text-pink-060 px-2 py-1 rounded hover:bg-pink-005 transition-colors"
                >
                  <MsCheckIcon size={12} /> 모두 읽음
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-gray-010 text-fg-subtlest hover:text-gray-070"
              >
                <MsCancelIcon size={12} />
              </button>
            </div>
          </div>

          {/* list */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-010">
            {mine.length === 0 ? (
              <p className="text-base text-fg-subtle text-center py-10">새 알림이 없습니다.</p>
            ) : mine.map(n => {
              const tc = TYPE_CONFIG[n.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.system;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-005 transition-colors ${!n.isRead ? 'bg-pink-005/30' : ''}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${n.isRead ? 'bg-transparent' : 'bg-pink-040'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tc.cls}`}>
                          {tc.label}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-fg-default leading-snug">{n.title}</p>
                      <p className="text-xs text-fg-subtle mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                      <p className="text-[11px] text-fg-subtlest mt-1">{formatDateTime(n.createdAt)}</p>
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
