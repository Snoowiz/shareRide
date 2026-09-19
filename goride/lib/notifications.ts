import type * as NotificationsType from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import Constants from 'expo-constants';

// Detect if running in Expo Go (push notifications not supported in SDK 53+)
const isExpoGo = Constants.appOwnership === 'expo';
const isAndroid = Platform.OS === 'android';

let Notifications: typeof NotificationsType | null = null;
if (!(isExpoGo && isAndroid)) {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {}
}

// ── Notification Channel Setup (Android) ──
try {
  if (Platform.OS === 'android' && Notifications) {
    Notifications.setNotificationChannelAsync('default', {
      name: 'GoRide',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0F346E',
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    });
  }
} catch (e) {
  // Silently fail in Expo Go or unsupported environments
}

// ── Foreground Notification Behavior ──
try {
  if (Notifications) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      }),
    });
  }
} catch (e) {
  // Silently fail in Expo Go
}

// ── Notification Types ──
export type NotificationType =
  | 'ride_accepted'
  | 'ride_arrived'
  | 'ride_completed'
  | 'ride_cancelled'
  | 'delivery_accepted'
  | 'delivery_picked_up'
  | 'delivery_delivered'
  | 'delivery_cancelled'
  | 'message'
  | 'wallet_credit'
  | 'wallet_debit'
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'withdrawal_completed'
  | 'profile_approved'
  | 'profile_rejected'
  | 'coupon'
  | 'promo'
  | 'system'
  | 'admin_announcement';

export interface NotificationData {
  type: NotificationType;
  screen?: string;
  ride_id?: string;
  delivery_id?: string;
  sender_id?: string;
  transaction_id?: string;
  withdrawal_id?: string;
  amount?: number;
  [key: string]: any;
}

// ── Permission & Token Registration ──
export async function registerForPushNotifications(): Promise<string | null> {
  // Skip entirely in Expo Go on Android — push is not supported in SDK 53+
  if (isExpoGo && isAndroid) {
    console.info('Push notifications are not supported in Expo Go on Android. Use a development build for full push support.');
    return null;
  }

  if (!Notifications) return null;

  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    // Get Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId 
      ?? Constants.easConfig?.projectId;
    
    if (!projectId) {
      console.warn('No EAS projectId found. Push tokens require a development build with EAS configured.');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    
    return tokenData.data;
  } catch (error) {
    console.warn('Push token registration skipped:', (error as Error).message);
    return null;
  }
}

// ── Save token to Supabase ──
export async function savePushToken(userId: string, token: string): Promise<void> {
  try {
    // Upsert into push_tokens table
    await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS as 'ios' | 'android' | 'web',
          device_name: Device.modelName || Device.deviceName || 'Unknown',
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' }
      );

    // Also update legacy expo_push_token on profiles for backward compatibility
    await supabase
      .from('profiles')
      .update({ expo_push_token: token })
      .eq('id', userId);
  } catch (error) {
    console.error('Error saving push token:', error);
  }
}

// ── Remove token on logout ──
export async function removePushToken(userId: string, token: string): Promise<void> {
  try {
    await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('token', token);

    await supabase
      .from('profiles')
      .update({ expo_push_token: null })
      .eq('id', userId);
  } catch (error) {
    console.error('Error removing push token:', error);
  }
}

// ── Get notification icon based on type ──
export function getNotificationIcon(type: NotificationType): { name: string; color: string } {
  const icons: Record<NotificationType, { name: string; color: string }> = {
    ride_accepted: { name: 'car-sport', color: '#22C55E' },
    ride_arrived: { name: 'location', color: '#3B82F6' },
    ride_completed: { name: 'checkmark-circle', color: '#22C55E' },
    ride_cancelled: { name: 'close-circle', color: '#EF4444' },
    delivery_accepted: { name: 'cube', color: '#22C55E' },
    delivery_picked_up: { name: 'bicycle', color: '#F59E0B' },
    delivery_delivered: { name: 'checkmark-done-circle', color: '#22C55E' },
    delivery_cancelled: { name: 'close-circle', color: '#EF4444' },
    message: { name: 'chatbubble-ellipses', color: '#3B82F6' },
    wallet_credit: { name: 'wallet', color: '#22C55E' },
    wallet_debit: { name: 'wallet', color: '#F59E0B' },
    withdrawal_approved: { name: 'checkmark-circle', color: '#22C55E' },
    withdrawal_rejected: { name: 'close-circle', color: '#EF4444' },
    withdrawal_completed: { name: 'cash', color: '#22C55E' },
    profile_approved: { name: 'shield-checkmark', color: '#22C55E' },
    profile_rejected: { name: 'shield', color: '#EF4444' },
    coupon: { name: 'pricetag', color: '#A855F7' },
    promo: { name: 'megaphone', color: '#EC4899' },
    system: { name: 'information-circle', color: '#6366F1' },
    admin_announcement: { name: 'megaphone', color: '#0F346E' },
  };
  return icons[type] || { name: 'notifications', color: '#6366F1' };
}

// ── Format relative time ──
export function formatNotificationTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Centralized Transactional Email & Backend Notification Service ──
const NOTIFICATION_API_BASE = process.env.EXPO_PUBLIC_ADMIN_API_URL || 'http://127.0.0.1:8000';
const NOTIFICATION_API_KEY = process.env.EXPO_PUBLIC_NOTIFICATION_API_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'goride_secure_notification_secret_2026';

export interface NotificationApiResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  log_id?: number;
  data?: T;
}

/**
 * Dispatch authenticated HTTP request to GoRide centralized notification backend.
 * Zero SMTP credentials touch the mobile application.
 */
async function sendNotificationRequest<T = any>(endpoint: string, payload: Record<string, any>): Promise<NotificationApiResponse<T>> {
  try {
    const url = `${NOTIFICATION_API_BASE}/api/v1/notifications/${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-GoRide-Key': NOTIFICATION_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({ success: false, error: `HTTP ${response.status}: Failed to parse JSON` }));
    if (!response.ok) {
      console.warn(`[NotificationService] ${endpoint} returned HTTP ${response.status}:`, data);
      return { success: false, error: data.error || data.message || `HTTP ${response.status}` };
    }
    return data;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Network request failed';
    console.error(`[NotificationService] Error contacting ${endpoint}:`, msg);
    return { success: false, error: msg };
  }
}

/**
 * Send password reset email with secure OTP and reset link.
 */
export async function triggerPasswordResetEmail(params: {
  email: string;
  name?: string;
  resetLink?: string;
  otpCode?: string;
  expiryMinutes?: number;
}): Promise<NotificationApiResponse> {
  return sendNotificationRequest('password-reset', {
    email: params.email,
    name: params.name,
    reset_link: params.resetLink,
    otp_code: params.otpCode,
    expiry_minutes: params.expiryMinutes || 30,
  });
}

/**
 * Send support ticket / complaint received confirmation email.
 */
export async function triggerComplaintConfirmationEmail(params: {
  email: string;
  name?: string;
  ticketId: string;
  ticketSubject?: string;
  ticketCategory?: string;
}): Promise<NotificationApiResponse> {
  return sendNotificationRequest('complaint-received', {
    email: params.email,
    name: params.name,
    ticket_id: params.ticketId,
    ticket_subject: params.ticketSubject,
    ticket_category: params.ticketCategory,
  });
}

/**
 * Send ride update or e-receipt email to rider.
 */
export async function triggerRideUpdateEmail(params: {
  email: string;
  name?: string;
  rideId: string;
  status: string;
  driverName?: string;
  pickupLocation?: string;
  destinationLocation?: string;
  fare?: number;
  paymentMethod?: string;
}): Promise<NotificationApiResponse> {
  return sendNotificationRequest('ride-update', {
    email: params.email,
    name: params.name,
    ride_id: params.rideId,
    status: params.status,
    driver_name: params.driverName,
    pickup_location: params.pickupLocation,
    destination_location: params.destinationLocation,
    fare: params.fare,
    payment_method: params.paymentMethod,
  });
}

/**
 * Universal dynamic template trigger for welcome, announcements, and custom events.
 */
export async function triggerTemplateEmail(params: {
  templateKey: string;
  toEmail: string;
  variables?: Record<string, any>;
  recipientName?: string;
  overrideSubject?: string;
}): Promise<NotificationApiResponse> {
  return sendNotificationRequest('send-template', {
    template_key: params.templateKey,
    to_email: params.toEmail,
    variables: params.variables || {},
    recipient_name: params.recipientName,
    override_subject: params.overrideSubject,
  });
}

