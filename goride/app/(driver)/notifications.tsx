import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Dimensions, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInRight, FadeOutLeft, Layout } from 'react-native-reanimated';

import { useAppContext } from '@/context/AppContext';
import { useNotifications } from '@/context/NotificationContext';
import { Colors } from '@/constants/Colors';
import { getNotificationIcon, formatNotificationTime, NotificationType } from '@/lib/notifications';
import AlertModal from '@/components/AlertModal';

const { width } = Dimensions.get('window');

export default function DriverNotificationsScreen() {
  const router = useRouter();
  const { colorScheme } = useAppContext();
  const {
    notifications, unreadCount, loading,
    fetchNotifications, markAsRead, markAllAsRead, deleteNotification, clearAll,
  } = useNotifications();
  const C = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
    onConfirm?: () => void;
    showCancel?: boolean;
  }>({ visible: false, title: '', message: '', type: 'info' });

  const handleNotificationPress = useCallback(async (item: any) => {
    if (!item.is_read) {
      await markAsRead(item.id);
    }

    const data = item.data || {};
    const screen = data.screen;

    if (!screen || screen === 'home') return;

    switch (screen) {
      case '/chat':
        if (data.ride_id) {
          router.push(`/chat?rideId=${data.ride_id}&otherUserId=${data.sender_id}` as any);
        } else if (data.delivery_id) {
          router.push(`/chat?deliveryId=${data.delivery_id}&otherUserId=${data.sender_id}` as any);
        }
        break;
      case 'wallet':
        router.push('/(driver)/(tabs)/earn' as any);
        break;
      case 'withdrawal':
        router.push('/(driver)/withdrawal-request' as any);
        break;
      case 'profile':
        router.push('/(driver)/(tabs)/profile' as any);
        break;
    }
  }, [markAsRead, router]);

  const handleClearAll = () => {
    if (notifications.length === 0) return;
    setAlertConfig({
      visible: true,
      title: 'Clear All Notifications',
      message: 'Are you sure you want to delete all notifications? This cannot be undone.',
      type: 'warning',
      showCancel: true,
      onConfirm: async () => {
        await clearAll();
      },
    });
  };

  const renderNotification = ({ item, index }: { item: any; index: number }) => {
    const icon = getNotificationIcon(item.type as NotificationType);
    const isUnread = !item.is_read;

    return (
      <Animated.View
        entering={FadeInRight.delay(index * 50).springify()}
        layout={Layout.springify()}
      >
        <TouchableOpacity
          style={[
            s.notifCard,
            {
              backgroundColor: isUnread
                ? (isDark ? 'rgba(252,202,20,0.08)' : 'rgba(252,202,20,0.06)')
                : C.surface,
              borderColor: isUnread
                ? (isDark ? Colors.brand.secondary + '30' : Colors.brand.secondary + '40')
                : C.border,
            },
          ]}
          onPress={() => handleNotificationPress(item)}
          activeOpacity={0.7}
        >
          {/* Unread indicator */}
          {isUnread && (
            <View style={[s.unreadDot, { backgroundColor: Colors.brand.secondary }]} />
          )}

          {/* Icon */}
          <View style={[s.iconContainer, { backgroundColor: icon.color + '15' }]}>
            <Ionicons name={icon.name as any} size={22} color={icon.color} />
          </View>

          {/* Content */}
          <View style={s.notifContent}>
            <View style={s.notifHeader}>
              <Text
                style={[
                  s.notifTitle,
                  { color: C.text, fontWeight: isUnread ? '800' : '600' },
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text style={[s.notifTime, { color: C.textMuted }]}>
                {formatNotificationTime(item.created_at)}
              </Text>
            </View>
            <Text
              style={[s.notifBody, { color: C.textSecondary }]}
              numberOfLines={2}
            >
              {item.body}
            </Text>
          </View>

          {/* Delete */}
          <TouchableOpacity
            style={s.deleteBtn}
            onPress={() => deleteNotification(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={16} color={C.textMuted} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderEmpty = () => (
    <View style={s.emptyContainer}>
      <View style={[s.emptyIconBg, { backgroundColor: isDark ? 'rgba(252,202,20,0.08)' : 'rgba(252,202,20,0.06)' }]}>
        <Ionicons name="notifications-off-outline" size={56} color={isDark ? Colors.brand.secondary : Colors.brand.primary} />
      </View>
      <Text style={[s.emptyTitle, { color: C.text }]}>No Notifications</Text>
      <Text style={[s.emptySubtitle, { color: C.textSecondary }]}>
        You're all caught up! We'll notify you when{'\n'}something important happens.
      </Text>
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header - Driver themed with yellow accent */}
      <LinearGradient
        colors={isDark ? ['#1A1600', '#111827'] : [Colors.brand.secondary, '#FFD84D']}
        style={[s.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : Colors.brand.primary} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: isDark ? '#fff' : Colors.brand.primary }]}>Notifications</Text>
          <View style={s.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={markAllAsRead} style={[s.headerAction, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
                <Ionicons name="checkmark-done" size={22} color={isDark ? '#fff' : Colors.brand.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleClearAll} style={[s.headerAction, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
              <Ionicons name="trash-outline" size={20} color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Unread count badge */}
        {unreadCount > 0 && (
          <View style={s.unreadBanner}>
            <View style={[s.unreadBannerBadge, { backgroundColor: isDark ? Colors.brand.secondary : Colors.brand.primary }]}>
              <Text style={[s.unreadBannerCount, { color: isDark ? '#000' : '#fff' }]}>{unreadCount}</Text>
            </View>
            <Text style={[s.unreadBannerText, { color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(15,52,110,0.7)' }]}>
              unread notification{unreadCount > 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </LinearGradient>

      {/* Notification List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          s.listContent,
          notifications.length === 0 && s.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchNotifications}
            tintColor={Colors.brand.secondary}
            colors={[Colors.brand.secondary]}
          />
        }
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />

      <AlertModal
        isVisible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        showCancel={alertConfig.showCancel}
        onConfirm={alertConfig.onConfirm}
        onClose={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  unreadBannerBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  unreadBannerCount: {
    fontSize: 13,
    fontWeight: '800',
  },
  unreadBannerText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: 'center',
  },

  // Card
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 15,
    flex: 1,
    marginRight: 8,
  },
  notifTime: {
    fontSize: 12,
    fontWeight: '500',
  },
  notifBody: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  deleteBtn: {
    padding: 4,
    marginLeft: 4,
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
});
