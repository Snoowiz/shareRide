import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Platform,
} from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';

const { width } = Dimensions.get('window');

interface LocationPermissionModalProps {
  isVisible: boolean;
  onAllow: () => void;
  onDeny: () => void;
  /** 'user' for rider, 'driver' for driver */
  role?: 'user' | 'driver';
}

export default function LocationPermissionModal({
  isVisible,
  onAllow,
  onDeny,
  role = 'user',
}: LocationPermissionModalProps) {
  const { colorScheme } = useAppContext();
  const isDark = colorScheme === 'dark';
  const C = Colors[colorScheme];
  const isDriver = role === 'driver';

  const primaryColor = isDriver ? Colors.driver.primary : Colors.brand.primary;
  const accentColor = isDriver ? Colors.driver.secondary : Colors.brand.secondary;

  return (
    <Modal
      isVisible={isVisible}
      style={s.modal}
      animationIn="zoomIn"
      animationOut="zoomOut"
      backdropOpacity={0.65}
      useNativeDriver
    >
      <View style={[s.container, { backgroundColor: isDark ? '#0F172A' : '#fff' }]}>
        {/* Top Illustration Area */}
        <LinearGradient
          colors={
            isDriver
              ? (isDark ? ['#2D2400', '#1A1600'] : ['#FCCA14', '#FFE066'])
              : (isDark ? ['#0D1B3E', '#162350'] : ['#0F346E', '#1A4DB0'])
          }
          style={s.illustrationArea}
        >
          {/* Animated rings */}
          <View style={s.ringContainer}>
            <View style={[s.ring, s.ringOuter, { borderColor: 'rgba(255,255,255,0.08)' }]} />
            <View style={[s.ring, s.ringMiddle, { borderColor: 'rgba(255,255,255,0.12)' }]} />
            <View style={[s.ring, s.ringInner, { borderColor: 'rgba(255,255,255,0.18)' }]} />
            <View style={[s.locationPinBg, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons
                name="location"
                size={40}
                color={isDriver ? (isDark ? '#FCCA14' : '#0D1B3E') : '#fff'}
              />
            </View>
          </View>

          {/* Floating map pin decorations */}
          <View style={[s.floatPin, { top: 20, left: 30 }]}>
            <Ionicons name="navigate" size={18} color="rgba(255,255,255,0.25)" />
          </View>
          <View style={[s.floatPin, { top: 40, right: 35 }]}>
            <Ionicons name="pin" size={16} color="rgba(255,255,255,0.2)" />
          </View>
          <View style={[s.floatPin, { bottom: 25, left: 50 }]}>
            <Ionicons name="map" size={15} color="rgba(255,255,255,0.15)" />
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={s.content}>
          <Text style={[s.title, { color: C.text }]}>
            Enable Location Access
          </Text>
          <Text style={[s.subtitle, { color: C.textSecondary }]}>
            GoRide needs your location to show nearby{' '}
            {isDriver ? 'ride requests and navigate to riders' : 'drivers and calculate accurate routes'}.
          </Text>

          {/* Feature list */}
          <View style={s.featureList}>
            <FeatureItem
              icon="navigate-circle"
              text={isDriver ? 'Accept rides near you' : 'Find your current location'}
              color={primaryColor}
              isDark={isDark}
              textColor={C.text}
              mutedColor={C.textSecondary}
            />
            <FeatureItem
              icon="map"
              text={isDriver ? 'Navigate to pickups & drop-offs' : 'Get accurate route & fare estimates'}
              color={primaryColor}
              isDark={isDark}
              textColor={C.text}
              mutedColor={C.textSecondary}
            />
            <FeatureItem
              icon="shield-checkmark"
              text="Your location is only used while using the app"
              color="#22C55E"
              isDark={isDark}
              textColor={C.text}
              mutedColor={C.textSecondary}
            />
          </View>
        </View>

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.allowBtn, { backgroundColor: primaryColor }]}
            onPress={onAllow}
            activeOpacity={0.85}
          >
            <Ionicons name="location" size={20} color={isDriver ? '#0D1B3E' : '#fff'} />
            <Text style={[s.allowBtnTxt, { color: isDriver ? '#0D1B3E' : '#fff' }]}>
              Allow Location
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.denyBtn, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}
            onPress={onDeny}
            activeOpacity={0.85}
          >
            <Text style={[s.denyBtnTxt, { color: C.textSecondary }]}>Not Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function FeatureItem({
  icon, text, color, isDark, textColor, mutedColor,
}: {
  icon: string; text: string; color: string;
  isDark: boolean; textColor: string; mutedColor: string;
}) {
  return (
    <View style={s.featureRow}>
      <View style={[s.featureIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[s.featureText, { color: textColor }]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  modal: { margin: 24, justifyContent: 'center' },
  container: {
    borderRadius: 28,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 20 },
      android: { elevation: 24 },
    }),
  },

  // Illustration
  illustrationArea: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  ringContainer: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 999,
  },
  ringOuter: { width: 140, height: 140 },
  ringMiddle: { width: 105, height: 105 },
  ringInner: { width: 72, height: 72 },
  locationPinBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatPin: {
    position: 'absolute',
  },

  // Content
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 24,
  },

  // Feature list
  featureList: {
    gap: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },

  // Actions
  actions: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    gap: 10,
  },
  allowBtn: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  allowBtnTxt: {
    fontSize: 16,
    fontWeight: '800',
  },
  denyBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  denyBtnTxt: {
    fontSize: 15,
    fontWeight: '600',
  },
});
