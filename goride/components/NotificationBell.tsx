import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '@/context/NotificationContext';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSequence, 
  withTiming, 
  withRepeat,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';

interface NotificationBellProps {
  size?: number;
  color?: string;
}

export default function NotificationBell({ size = 26, color }: NotificationBellProps) {
  const { unreadCount } = useNotifications();
  const { colorScheme } = useAppContext();
  const { selectedRole } = useAuth();
  const router = useRouter();
  const isDark = colorScheme === 'dark';
  const isDriver = selectedRole === 'driver';

  // Animated bell shake when new notifications arrive
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (unreadCount > 0) {
      rotation.value = withDelay(
        300,
        withSequence(
          withTiming(15, { duration: 100, easing: Easing.elastic(2) }),
          withTiming(-15, { duration: 100, easing: Easing.elastic(2) }),
          withTiming(10, { duration: 80, easing: Easing.elastic(2) }),
          withTiming(-10, { duration: 80, easing: Easing.elastic(2) }),
          withTiming(0, { duration: 60 })
        )
      );
    }
  }, [unreadCount]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const iconColor = color || (isDriver ? Colors.driver.secondary : isDark ? '#F0F4FF' : Colors.rider.primary);

  const handlePress = () => {
    if (isDriver) {
      router.push('/(driver)/notifications' as any);
    } else {
      router.push('/(user)/notifications' as any);
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} style={s.container} activeOpacity={0.7}>
      <Animated.View style={animatedStyle}>
        <Ionicons 
          name={unreadCount > 0 ? 'notifications' : 'notifications-outline'} 
          size={size} 
          color={iconColor} 
        />
      </Animated.View>
      {unreadCount > 0 && (
        <View style={[s.badge, { backgroundColor: Colors.brand.danger }]}>
          <Text style={s.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
});
