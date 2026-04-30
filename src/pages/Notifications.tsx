import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import { formatDateTime } from '../utils/dateUtils';
import { MsClockIcon, MsMessageIcon, MsAlertIcon, MsCheckIcon, MsChevronRightLineIcon } from '../components/ui/MsIcons';
import type { NotificationType } from '../types';

const TYPE_CONFIG: Record<NotificationType, { icon: typeof MsAlertIcon; color: string; bg: string }> = {
  deadline: { icon: MsClockIcon, color: 'text-pink-050', bg: 'bg-pink-005' },
  feedback: { icon: MsMessageIcon, color: 'text-pink-050', bg: 'bg-pink-005' },
  review_result: { icon: MsAlertIcon, color: 'text-green-060', bg: 'bg-green-005' },
  system: { icon: MsAlertIcon, color: 'text-fg-subtle', bg: 'bg-gray-010' },
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
          <h1 className="text-xl font-semibold text-fg-default">알림</h1>
          {unreadCount > 0 && <p className="text-xs text-fg-subtlest mt-0.5">읽지 않은 알림 {unreadCount}개</p>}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsRead(currentUser?.id ?? '')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-060 border border-gray-020 rounded hover:bg-gray-005 transition-colors"
          >
            <MsCheckIcon size={14} /> 모두 읽음
          </button>
        )}
      </div>

      {myNotifs.length === 0 ? (
        <div className="rounded-lg border border-bd-default p-12 text-center">
          <MsAlertIcon size={40} className="text-gray-030 mx-auto mb-3" />
          <p className="text-sm text-fg-subtle">새 알림이 없습니다.</p>
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
                className={`w-full flex items-start gap-3.5 p-4 rounded-lg border text-left transition-colors hover:bg-interaction-hovered ${
                  !n.isRead ? 'border-pink-020 bg-pink-005/30' : 'border-bd-default'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                  <Icon size={16} className={cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${!n.isRead ? 'text-fg-default' : 'text-gray-060'}`}>
                      {n.title}
                    </p>
                    {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-pink-040 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-fg-subtle mt-0.5 leading-relaxed">{n.message}</p>
                  <p className="text-xs text-gray-030 mt-1">{formatDateTime(n.createdAt)}</p>
                </div>
                {n.actionUrl && <MsChevronRightLineIcon size={16} className="text-gray-030 flex-shrink-0 mt-1" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
