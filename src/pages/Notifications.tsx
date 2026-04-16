import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import { formatDateTime } from '../utils/dateUtils';
import { Bell, Clock, MessageSquare, AlertCircle, CheckCheck, ChevronRight } from 'lucide-react';
import type { NotificationType } from '../types';

const TYPE_CONFIG: Record<NotificationType, { icon: typeof Bell; color: string; bg: string }> = {
  deadline: { icon: Clock, color: 'text-primary-600', bg: 'bg-primary-50' },
  feedback: { icon: MessageSquare, color: 'text-primary-600', bg: 'bg-primary-50' },
  nudge: { icon: AlertCircle, color: 'text-neutral-500', bg: 'bg-neutral-100' },
  review_result: { icon: Bell, color: 'text-success-600', bg: 'bg-success-50' },
  system: { icon: Bell, color: 'text-neutral-500', bg: 'bg-neutral-100' },
};

export function Notifications() {
  const { currentUser } = useAuthStore();
  const { notifications, markAsRead, markAllAsRead } = useNotificationStore();
  const navigate = useNavigate();

  const myNotifs = notifications
    .filter(n => n.userId === currentUser?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const unreadCount = myNotifs.filter(n => !n.isRead).length;

  const handleClick = (id: string, url?: string) => {
    markAsRead(id);
    if (url) navigate(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">알림</h1>
          {unreadCount > 0 && <p className="text-xs text-neutral-400 mt-0.5">읽지 않은 알림 {unreadCount}개</p>}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsRead(currentUser?.id ?? '')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 border border-neutral-200 rounded hover:bg-neutral-50 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" /> 모두 읽음
          </button>
        )}
      </div>

      {myNotifs.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
          <Bell className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm text-neutral-500">새 알림이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {myNotifs.map(n => {
            const cfg = TYPE_CONFIG[n.type];
            const Icon = cfg.icon;
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n.id, n.actionUrl)}
                className={`w-full flex items-start gap-3.5 p-4 rounded-xl border text-left transition-all hover:shadow-card ${
                  !n.isRead ? 'bg-white border-primary-200 shadow-card' : 'bg-white border-neutral-200'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${!n.isRead ? 'text-neutral-900' : 'text-neutral-600'}`}>
                      {n.title}
                    </p>
                    {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{n.message}</p>
                  <p className="text-xs text-neutral-300 mt-1">{formatDateTime(n.createdAt)}</p>
                </div>
                {n.actionUrl && <ChevronRight className="w-4 h-4 text-neutral-300 flex-shrink-0 mt-1" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
