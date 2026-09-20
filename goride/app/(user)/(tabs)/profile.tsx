import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Switch, Animated,
  ActivityIndicator, Dimensions, Image, Modal as RNModal
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import Modal from 'react-native-modal';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppContext, ThemeMode } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import AlertModal from '@/components/AlertModal';

const { width, height } = Dimensions.get('window');

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: 'light', label: 'Light', icon: 'sunny' },
  { mode: 'dark', label: 'Dark', icon: 'moon' },
  { mode: 'system', label: 'System', icon: 'phone-portrait' },
];

const ACCOUNT_ITEMS = [
  { id: 'edit', label: 'Edit Profile', icon: 'person-outline', chevron: true },
  { id: 'verify', label: 'Verify Account', icon: 'shield-checkmark-outline', chevron: true },
  { id: 'saved_places', label: 'Saved Places', icon: 'bookmark-outline', chevron: true },
  { id: 'notif', label: 'Notifications', icon: 'notifications-outline', chevron: true },
  { id: 'privacy', label: 'Privacy & Security', icon: 'shield-checkmark-outline', chevron: true },
];

const SUPPORT_ITEMS = [
  { id: 'help', label: 'Help Center', icon: 'help-circle-outline', chevron: true },
  { id: 'terms', label: 'Terms & Conditions', icon: 'document-text-outline', chevron: true },
  { id: 'about', label: 'About GoRide', icon: 'information-circle-outline', chevron: true },
];

function SettingsRow({
  icon, label, chevron, right, C, onPress,
}: {
  icon: string; label: string; chevron?: boolean; right?: React.ReactNode;
  C: typeof Colors['light']; onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={s.settRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.settIcon, { backgroundColor: C.surfaceAlt }]}>
        <Ionicons name={icon as any} size={18} color={C.icon} />
      </View>
      <Text style={[s.settLabel, { color: C.text }]}>{label}</Text>
      {right ?? (chevron && <Ionicons name="chevron-forward" size={16} color={C.textMuted} style={{ marginLeft: 'auto' }} />)}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { colorScheme, themeMode, setThemeMode, user } = useAppContext();
  const { authUser, signOut, updateAuthUser, setSelectedRole, refreshUser } = useAuth();
  const C = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const [isSignOutVisible, setIsSignOutVisible] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ count: 0, spent: 0, rating: 0 });
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
    confirmText?: string;
    showCancel?: boolean;
    onConfirm?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });
  const transitionAnim = useRef(new Animated.Value(0)).current;

  // Fetch dynamic stats
  const fetchStats = useCallback(async () => {
    if (!authUser?.id) return;
    try {
      const { data: rides } = await supabase.from('rides').select('fare').eq('rider_id', authUser.id).eq('status', 'completed');
      const { data: delivs } = await supabase.from('deliveries').select('fare').eq('rider_id', authUser.id).eq('status', 'delivered');
      const { data: ratings } = await supabase.from('ratings').select('rating').eq('rated_id', authUser.id);
      
      const count = (rides?.length || 0) + (delivs?.length || 0);
      const spent = [...(rides || []), ...(delivs || [])].reduce((sum, r) => sum + (parseFloat(r.fare) || 0), 0);
      const avgRating = ratings && ratings.length > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0;
      
      setStats({ count, spent, rating: parseFloat(avgRating.toFixed(1)) });
    } catch (err) {
      console.warn('Error fetching stats:', err);
    }
  }, [authUser?.id]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshUser(), fetchStats()]);
    setRefreshing(false);
  }, [refreshUser, fetchStats]);

  // Auto-refresh profile and stats when screen is viewed
  useFocusEffect(
    useCallback(() => {
      refreshUser();
      fetchStats();
    }, [refreshUser, fetchStats])
  );

  // Always use authenticated user's real data — never fall back to mock.
  const displayName = authUser ? `${authUser.firstName} ${authUser.lastName}`.trim() : '';
  const displayEmail = authUser?.email || '';
  const isVerified = Boolean(
    authUser?.verificationStatus === 'approved' ||
    authUser?.verificationStatus === 'verified'
  );
  const isPending = !isVerified && authUser?.verificationStatus === 'pending';
  const isRejected = !isVerified && authUser?.verificationStatus === 'rejected';
  const hasProfile = authUser?.hasDriverProfile ?? false;

  const startTransition = (toValue: number, callback?: () => void) => {
    Animated.timing(transitionAnim, {
      toValue,
      duration: 500,
      useNativeDriver: true,
    }).start(callback);
  };



  const handlePhotoUpload = async () => {
    if (!authUser) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setAlertConfig({
          visible: true,
          title: 'Permission Denied',
          message: 'We need access to your photos to change your profile picture.',
          type: 'warning'
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setIsUploading(true);
        const fileExt = result.assets[0].uri.split('.').pop();
        const fileName = `${authUser.id}_${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, decode(result.assets[0].base64), {
            contentType: `image/${fileExt}`,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        // Update Database Profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', authUser.id);

        if (updateError) throw updateError;

        // Update local state
        updateAuthUser({ avatar: publicUrl });
        setAlertConfig({
          visible: true,
          title: 'Success',
          message: 'Profile photo updated successfully!',
          type: 'success'
        });
      }
    } catch (err: any) {
      console.error('Upload Error:', err);
      setAlertConfig({
        visible: true,
        title: 'Upload Failed',
        message: err.message || 'Something went wrong.',
        type: 'error'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSignOut = () => {
    setIsSignOutVisible(true);
  };

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.brand.primary}
            colors={[Colors.brand.primary]}
          />
        }
      >
        {/* Profile Header */}
        <LinearGradient
          colors={isDark ? ['#1C2333', '#0D1117'] : ['#F0FFF4', '#E3F2FD']}
          style={[s.header, { paddingTop: insets.top + 16 }]}
        >
          <View style={s.profileTopRow}>
            {/* Avatar */}
            <View style={s.avatarWrap}>
              {isUploading ? (
                <View style={[s.avatar, { backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' }]}>
                  <ActivityIndicator color={Colors.brand.primary} />
                </View>
              ) : authUser?.avatar ? (
                <Image source={{ uri: authUser.avatar }} style={s.avatar} />
              ) : (
                <LinearGradient colors={[Colors.brand.primary, Colors.brand.primaryLight]} style={s.avatar}>
                  <Text style={s.avatarTxt}>{displayName[0]}</Text>
                </LinearGradient>
              )}
              <TouchableOpacity 
                style={[s.editAvatarBtn, { backgroundColor: C.surface, borderColor: C.border }]}
                onPress={handlePhotoUpload}
                disabled={isUploading}
              >
                <Ionicons name="camera" size={14} color={C.icon} />
              </TouchableOpacity>
            </View>

            {/* Profile Details */}
            <View style={s.profileDetails}>
              <View style={s.nameRow}>
                <Text style={[s.name, { color: C.text }]} numberOfLines={1}>{displayName}</Text>
                {isVerified && (
                  <Ionicons name="checkmark-circle" size={18} color={Colors.brand.success} style={{ marginLeft: 6 }} />
                )}
              </View>
              <Text style={[s.email, { color: C.textSecondary, marginBottom: 8 }]} numberOfLines={1}>{displayEmail}</Text>

              {/* Verification Badge */}
              {isVerified ? (
                <View style={[s.statusBadge, { backgroundColor: Colors.brand.success + '15', borderColor: Colors.brand.success + '30', borderWidth: 1 }]}>
                  <Ionicons name="shield-checkmark" size={12} color={Colors.brand.success} />
                  <Text style={[s.statusBadgeTxt, { color: Colors.brand.success }]}>Verified Rider</Text>
                </View>
              ) : isPending ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => router.push('/(user)/verification')}
                  style={[s.statusBadge, { backgroundColor: Colors.brand.warning + '15', borderColor: Colors.brand.warning + '30', borderWidth: 1 }]}
                >
                  <Ionicons name="time" size={12} color={Colors.brand.warning} />
                  <Text style={[s.statusBadgeTxt, { color: Colors.brand.warning }]}>Pending Review</Text>
                </TouchableOpacity>
              ) : isRejected ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => router.push('/(user)/verification')}
                  style={[s.statusBadge, { backgroundColor: '#EF444415', borderColor: '#EF444430', borderWidth: 1 }]}
                >
                  <Ionicons name="close-circle" size={12} color="#EF4444" />
                  <Text style={[s.statusBadgeTxt, { color: '#EF4444' }]}>Verification Rejected</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => router.push('/(user)/verification')}
                  style={[s.statusBadge, { backgroundColor: C.surfaceAlt, borderColor: C.border, borderWidth: 1 }]}
                >
                  <Ionicons name="alert-circle" size={12} color={C.textMuted} />
                  <Text style={[s.statusBadgeTxt, { color: C.textMuted }]}>Unverified Account</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          {/* Stats */}
          <View style={[s.statsRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: C.border }]}>
            <View style={s.stat}>
              <Text style={[s.statVal, { color: C.text }]}>{stats.count}</Text>
              <Text style={[s.statLabel, { color: C.textMuted }]}>Total Rides</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: C.border }]} />
            <View style={s.stat}>
              <Text style={[s.statVal, { color: C.text }]}>{stats.rating > 0 ? stats.rating : '—'} <Ionicons name="star" size={13} color={Colors.brand.gold} /></Text>
              <Text style={[s.statLabel, { color: C.textMuted }]}>Rating</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: C.border }]} />
            <View style={s.stat}>
              <Text style={[s.statVal, { color: C.text }]}>₦{stats.spent.toLocaleString()}</Text>
              <Text style={[s.statLabel, { color: C.textMuted }]}>Total Spent</Text>
            </View>
          </View>
        </LinearGradient>



        {/* Appearance */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: C.text }]}>Appearance</Text>
          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={s.themeRow}>
              {THEME_OPTIONS.map(opt => {
                const active = themeMode === opt.mode;
                return (
                  <TouchableOpacity
                    key={opt.mode}
                    style={[s.themeChip, {
                      backgroundColor: active ? C.tint : C.surfaceAlt,
                      borderColor: active ? C.tint : C.border,
                    }]}
                    onPress={() => setThemeMode(opt.mode)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={opt.icon as any} size={16} color={active ? (colorScheme === 'dark' ? '#000' : '#fff') : C.icon} />
                    <Text style={[s.themeLabel, { color: active ? (colorScheme === 'dark' ? '#000' : '#fff') : C.textSecondary }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Account Settings */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: C.text }]}>Account</Text>
          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
            {ACCOUNT_ITEMS.map((item, idx) => (
              <View key={item.id}>
                <SettingsRow 
                  icon={item.icon} 
                  label={item.label} 
                  chevron 
                  C={C} 
                  onPress={() => {
                    if (item.id === 'edit') router.push('/(user)/edit-profile');
                    if (item.id === 'verify') router.push('/(user)/verification');
                    if (item.id === 'saved_places') router.push('/(user)/saved-places');
                    if (item.id === 'notif') router.push('/(user)/notifications' as any);
                    if (item.id === 'privacy') router.push('/privacy-security');
                  }}
                />
                {idx < ACCOUNT_ITEMS.length - 1 && <View style={[s.divider, { backgroundColor: C.border, marginLeft: 58 }]} />}
              </View>
            ))}
          </View>
        </View>

        {/* Support */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: C.text }]}>Support</Text>
          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
            {SUPPORT_ITEMS.map((item, idx) => (
              <View key={item.id}>
                <SettingsRow 
                  icon={item.icon} 
                  label={item.label} 
                  chevron 
                  C={C} 
                  onPress={() => {
                    if (item.id === 'help') router.push('/help-center');
                    if (item.id === 'terms') router.push('/terms-conditions');
                    if (item.id === 'about') router.push('/about');
                  }}
                />
                {idx < SUPPORT_ITEMS.length - 1 && <View style={[s.divider, { backgroundColor: C.border, marginLeft: 58 }]} />}
              </View>
            ))}
          </View>
        </View>

        {/* Sign Out */}
        <View style={[s.section, { marginTop: 12 }]}>
          <TouchableOpacity
            style={[s.signOutBtn, { backgroundColor: Colors.brand.danger + '12', borderColor: Colors.brand.danger + '40' }]}
            activeOpacity={0.8}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.brand.danger} />
            <Text style={[s.signOutTxt, { color: Colors.brand.danger }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={[s.version, { color: C.textMuted }]}>GoRide v1.0.0</Text>
      </ScrollView>



      {/* Sign Out Confirmation Modal */}
      <Modal 
        isVisible={isSignOutVisible}
        onBackdropPress={() => setIsSignOutVisible(false)}
        onSwipeComplete={() => setIsSignOutVisible(false)}
        swipeDirection="down"
        style={s.bottomModal}
      >
        <View style={[s.bottomModalContent, { backgroundColor: C.background, paddingBottom: insets.bottom + 20 }]}>
          <View style={[s.dragHandle, { backgroundColor: C.border }]} />
          
          <Text style={[s.bottomModalTitle, { color: C.text }]}>Sign Out</Text>
          <Text style={[s.bottomModalSub, { color: C.textSecondary }]}>Are you sure you want to sign out of your account?</Text>
          
          <View style={s.bottomModalButtons}>
            <TouchableOpacity 
              style={[s.bottomBtnSec, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F5F5F5' }]} 
              onPress={() => setIsSignOutVisible(false)}
            >
              <Text style={[s.bottomBtnSecTxt, { color: C.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[s.bottomBtnPri, { backgroundColor: Colors.brand.secondary }]} 
              onPress={async () => {
                setIsSignOutVisible(false);
                await signOut();
              }}
            >
              <Text style={s.bottomBtnPriTxt}>Yes, Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Transition Overlay */}
      {isTransitioning && (
        <Animated.View style={[s.transitionOverlay, { opacity: transitionAnim }]}>
           <LinearGradient colors={['#0D1B3E', '#1E293B']} style={s.transitionBg}>
             <View style={s.carContainer}>
                <Ionicons name="car-sport" size={60} color={Colors.brand.primary} />
             </View>
             <Text style={s.transitionTxt}>Switching Roles...</Text>
             <ActivityIndicator size="small" color="#fff" style={{ marginTop: 20 }} />
           </LinearGradient>
        </Animated.View>
      )}
      <AlertModal
        isVisible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        confirmText={alertConfig.confirmText}
        showCancel={alertConfig.showCancel}
        onConfirm={alertConfig.onConfirm}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  profileTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, width: '100%', paddingHorizontal: 8 },
  avatarWrap: { position: 'relative' },
  profileDetails: { flex: 1, justifyContent: 'center', alignItems: 'flex-end', paddingLeft: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, justifyContent: 'flex-end' },
  avatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 32, fontWeight: '800' },
  editAvatarBtn: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  name: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, textAlign: 'right' },
  email: { fontSize: 14, marginBottom: 8, textAlign: 'right' },
  statsRow: { flexDirection: 'row', borderRadius: 10, borderWidth: 1, overflow: 'hidden', width: '100%' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statVal: { fontSize: 17, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  statDivider: { width: 1 },
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12, letterSpacing: -0.2 },
  driverCard: { borderRadius: 10, borderWidth: 1.5, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  driverIconWrap: { width: 46, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  driverTitle: { fontSize: 16, fontWeight: '700' },
  driverSub: { fontSize: 12, marginTop: 2 },
  card: { borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  themeRow: { flexDirection: 'row', padding: 12, gap: 8 },
  themeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
  themeLabel: { fontSize: 13, fontWeight: '600' },
  settRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  settIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  divider: { height: 1 },
  signOutBtn: { borderRadius: 10, borderWidth: 1, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  signOutTxt: { fontSize: 16, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 12, marginTop: 20 },
  pendingBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  pendingTxt: { fontSize: 10, fontWeight: '700' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusBadgeTxt: { fontSize: 12, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', borderRadius: 24, padding: 24, alignItems: 'center' },
  modalIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.brand.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: '800', marginBottom: 12 },
  modalSub: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalBtnPri: { flex: 1, height: 54, backgroundColor: Colors.brand.primary, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalBtnPriTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalBtnSec: { flex: 1, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalBtnSecTxt: { fontSize: 16, fontWeight: '600' },

  transitionOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 9999 },
  transitionBg: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  carContainer: { marginBottom: 20 },
  transitionTxt: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },

  /* Bottom Modal Styles */
  bottomModal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  bottomModalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    alignItems: 'center',
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    marginBottom: 24,
  },
  bottomModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
  },
  bottomModalSub: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  bottomModalButtons: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  bottomBtnPri: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: Colors.brand.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  bottomBtnPriTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomBtnSec: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBtnSecTxt: {
    fontSize: 16,
    fontWeight: '700',
  },
});
