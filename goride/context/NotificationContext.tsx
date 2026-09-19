import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type * as NotificationsType from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const isExpoGo = Constants.appOwnership === 'expo';
const isAndroid = Platform.OS === 'android';

let Notifications: typeof NotificationsType | null = null;
if (!(isExpoGo && isAndroid)) {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {}
}
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import {
  registerForPushNotifications,
  savePushToken,
  removePushToken,
  NotificationData,
  NotificationType,
} from '@/lib/notifications';
import { AppState, AppStateStatus } from 'react-native';

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: NotificationData;
  is_read: boolean;
  created_at: string;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  pushToken: string | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { status, authUser } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  
  const notificationListener = useRef<NotificationsType.EventSubscription | null>(null);
  const responseListener = useRef<NotificationsType.EventSubscription | null>(null);

  // ── Register push token on auth ──
  useEffect(() => {
    if (status !== 'authenticated' || !authUser?.id) return;

    const register = async () => {
      const token = await registerForPushNotifications();
      if (token) {
        setPushToken(token);
        await savePushToken(authUser.id, token);
      }
    };
    register();
  }, [status, authUser?.id]);

  // ── Fetch notifications from Supabase ──
  const fetchNotifications = useCallback(async () => {
    if (!authUser?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setNotifications(data as NotificationItem[]);
        setUnreadCount(data.filter((n: any) => !n.is_read).length);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [authUser?.id]);

  // ── Fetch on auth + subscribe to realtime ──
  useEffect(() => {
    if (status !== 'authenticated' || !authUser?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications();

    // Subscribe to realtime notifications
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${authUser.id}`,
        },
        (payload) => {
          const newNotification = payload.new as NotificationItem;
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [status, authUser?.id, fetchNotifications]);

  // ── Refresh on app focus ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && authUser?.id) {
        fetchNotifications();
      }
    });
    return () => sub.remove();
  }, [authUser?.id, fetchNotifications]);

  // ── Handle notification tap → deep link ──
  const handleNotificationResponse = useCallback(
    (response: NotificationsType.NotificationResponse) => {
      const data = response.notification.request.content.data as NotificationData;
      if (!data?.screen) return;

      navigateToScreen(data);
    },
    [router, segments]
  );

  const navigateToScreen = useCallback(
    async (data: NotificationData) => {
      const { screen, ride_id, delivery_id, sender_id } = data;

      switch (screen) {
        case '/trip-progress':
          if (ride_id) {
            // Check if ride is already completed
            const { data: rideData } = await supabase
              .from('rides')
              .select('status')
              .eq('id', ride_id)
              .single();

            if (rideData?.status === 'completed') {
              const seg = segments[0];
              if (seg === '(driver)') {
                router.push('/(driver)/(tabs)/rides' as any);
              } else {
                router.push('/(user)/(tabs)/rides' as any);
              }
            } else {
              router.push(`/trip-progress?rideId=${ride_id}` as any);
            }
          }
          break;
        case '/package-progress':
          if (delivery_id) {
            // Check if delivery is already delivered
            const { data: delData } = await supabase
              .from('deliveries')
              .select('status')
              .eq('id', delivery_id)
              .single();

            if (delData?.status === 'delivered') {
              const seg = segments[0];
              if (seg === '(driver)') {
                router.push('/(driver)/(tabs)/rides' as any);
              } else {
                router.push('/(user)/(tabs)/parcels' as any);
              }
            } else {
              router.push(`/package-progress?deliveryId=${delivery_id}` as any);
            }
          }
          break;
        case '/rate-trip':
          if (ride_id) {
            const role = segments[0] === '(driver)' ? 'driver' : 'rider';
            router.push(`/rate-trip?rideId=${ride_id}&role=${role}` as any);
          }
          break;
        case '/chat':
          if (ride_id) {
            router.push(`/chat?rideId=${ride_id}&otherUserId=${sender_id}` as any);
          } else if (delivery_id) {
            router.push(`/chat?deliveryId=${delivery_id}&otherUserId=${sender_id}` as any);
          }
          break;
        case 'wallet':
          // Navigate to the earnings/wallet tab based on role
          const currentRole = segments[0];
          if (currentRole === '(driver)') {
            router.push('/(driver)/(tabs)/earn' as any);
          } else {
            router.push('/(user)/(tabs)/profile' as any);
          }
          break;
        case 'withdrawal':
          router.push('/(driver)/withdrawal-request' as any);
          break;
        case 'profile':
          const role = segments[0];
          if (role === '(driver)') {
            router.push('/(driver)/(tabs)/profile' as any);
          } else {
            router.push('/(user)/(tabs)/profile' as any);
          }
          break;
        case '/support-chat':
        case 'support-chat':
          router.push('/support-chat' as any);
          break;
        case 'home':
        default:
          // Navigate to appropriate home
          const seg = segments[0];
          if (seg === '(driver)') {
            router.push('/(driver)/(tabs)' as any);
          } else {
            router.push('/(user)/(tabs)' as any);
          }
          break;
      }
    },
    [router, segments]
  );

  // ── Listeners for foreground + tap response ──
  useEffect(() => {
    if (!Notifications) return;

    // Foreground: notification received while app is open
    notificationListener.current = Notifications.addNotificationReceivedListener((_notification) => {
      // Notification is already handled by the realtime subscription
      // Just ensure we refresh the count
      if (authUser?.id) {
        fetchNotifications();
      }
    });

    // User tapped a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    // Check if app was opened from a notification (killed state)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        // Small delay to ensure navigation is ready
        setTimeout(() => {
          handleNotificationResponse(response);
        }, 1000);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [handleNotificationResponse, authUser?.id, fetchNotifications]);

  // ── Actions ──
  const markAsRead = useCallback(
    async (id: string) => {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    },
    []
  );

  const markAllAsRead = useCallback(async () => {
    if (!authUser?.id) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', authUser.id)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [authUser?.id]);

  const deleteNotification = useCallback(async (id: string) => {
    const notif = notifications.find((n) => n.id === id);
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (notif && !notif.is_read) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  }, [notifications]);

  const clearAll = useCallback(async () => {
    if (!authUser?.id) return;
    await supabase.from('notifications').delete().eq('user_id', authUser.id);
    setNotifications([]);
    setUnreadCount(0);
  }, [authUser?.id]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
        pushToken,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
