import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Notification } from '../types';

interface NotificationState {
  notifications: Notification[];
  addNotification: (n: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: (userId: string) => void;
  getUnread: (userId: string) => Notification[];
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      addNotification: (n) => set(s => ({ notifications: [n, ...s.notifications] })),
      markAsRead: (id) =>
        set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, isRead: true } : n) })),
      markAllAsRead: (userId) =>
        set(s => ({ notifications: s.notifications.map(n => n.userId === userId ? { ...n, isRead: true } : n) })),
      getUnread: (userId) => get().notifications.filter(n => n.userId === userId && !n.isRead),
    }),
    { name: 'review-notifications-v2' }
  )
);
