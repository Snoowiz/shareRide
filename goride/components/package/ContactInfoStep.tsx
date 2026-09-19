import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Keyboard, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useAppContext } from '@/context/AppContext';
import PhoneInput from '@/components/PhoneInput';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_APIKEY || '';

interface ContactData {
  phone: string;
  name: string;
  address: string;
  location: { latitude: number; longitude: number } | null;
}

interface Props {
  sender: ContactData;
  receiver: ContactData;
  onSenderChange: (data: Partial<ContactData>) => void;
  onReceiverChange: (data: Partial<ContactData>) => void;
  onPickLocation: (type: 'sender' | 'receiver') => void;
  onNext: () => void;
  errors: Record<string, string>;
}

export default function ContactInfoStep({ sender, receiver, onSenderChange, onReceiverChange, onPickLocation, onNext, errors }: Props) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useAppContext();
  const C = Colors[colorScheme];
  const [activeTab, setActiveTab] = useState<'sender' | 'receiver'>('sender');
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [showSenderSuccessMark, setShowSenderSuccessMark] = useState(false);
  const [hasAutoSwitched, setHasAutoSwitched] = useState(false);

  const isSenderValid = sender.phone.length >= 8 && sender.name.trim().length > 0 && sender.address.length > 0;
  const isReceiverValid = receiver.phone.length >= 8 && receiver.name.trim().length > 0 && receiver.address.length > 0;

  // Auto-switch to receiver tab when sender is completed
  useEffect(() => {
    if (isSenderValid && !isReceiverValid && activeTab === 'sender' && !hasAutoSwitched) {
      setShowSenderSuccessMark(true);
      const timer = setTimeout(() => {
        setActiveTab('receiver');
        setHasAutoSwitched(true);
        setShowSenderSuccessMark(false);
      }, 2000); // 2 seconds as requested
      return () => clearTimeout(timer);
    }
  }, [isSenderValid, isReceiverValid, activeTab, hasAutoSwitched]);
  const allValid = isSenderValid && isReceiverValid;

  // ─── Use My Current Location ────────────────────────────────
  const handleUseCurrentLocation = async () => {
    setFetchingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setFetchingLocation(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };

      // Reverse geocode to get address
      let address = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&key=${GOOGLE_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && data.results?.[0]) {
          address = data.results[0].formatted_address;
        }
      } catch {}

      onSenderChange({ location: coords, address });
    } catch (err) {
      console.warn('Location error:', err);
    } finally {
      setFetchingLocation(false);
    }
  };

  const renderTab = (type: 'sender' | 'receiver') => {
    const data = type === 'sender' ? sender : receiver;
    const onChange = type === 'sender' ? onSenderChange : onReceiverChange;
    const prefix = type === 'sender' ? 'sender' : 'receiver';

    return (
      <View style={s.tabContent}>
        {/* Name */}
        <View style={s.field}>
          <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Full Name</Text>
          <View style={[s.inputWrap, { backgroundColor: C.surface, borderColor: errors[`${prefix}Name`] ? Colors.brand.danger : C.border }]}>
            <Ionicons name="person-outline" size={18} color={C.textMuted} style={{ marginRight: 10 }} />
            <TextInput
              style={[s.input, { color: C.text }]}
              placeholder={type === 'sender' ? 'Sender name' : 'Receiver name'}
              placeholderTextColor={C.textMuted}
              value={data.name}
              onChangeText={(t) => onChange({ name: t })}
              returnKeyType="next"
            />
          </View>
          {errors[`${prefix}Name`] ? <Text style={s.errTxt}>{errors[`${prefix}Name`]}</Text> : null}
        </View>

        {/* Phone */}
        <View style={s.field}>
          <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Phone Number</Text>
          <PhoneInput
            value={data.phone}
            onChangeText={(t) => onChange({ phone: t })}
            error={errors[`${prefix}Phone`]}
            placeholder="812 345 6789"
          />
        </View>

        {/* Address / Location Picker */}
        <View style={s.field}>
          <Text style={[s.fieldLabel, { color: C.textSecondary }]}>
            {type === 'sender' ? 'Pickup Address' : 'Delivery Address'}
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => { Keyboard.dismiss(); onPickLocation(type); }}
            style={[s.inputWrap, { backgroundColor: C.surface, borderColor: errors[`${prefix}Address`] ? Colors.brand.danger : C.border }]}
          >
            <Ionicons name="location-outline" size={18} color={Colors.brand.primary} style={{ marginRight: 10 }} />
            <Text
              style={[s.input, { color: data.address ? C.text : C.textMuted }]}
              numberOfLines={1}
            >
              {data.address || 'Tap to search for location'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
          </TouchableOpacity>
          {errors[`${prefix}Address`] ? <Text style={s.errTxt}>{errors[`${prefix}Address`]}</Text> : null}

          {/* Use Current Location - only for sender */}
          {type === 'sender' && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleUseCurrentLocation}
              disabled={fetchingLocation}
              style={[s.currentLocBtn, { backgroundColor: Colors.brand.primary + '10' }]}
            >
              {fetchingLocation ? (
                <ActivityIndicator size="small" color={Colors.brand.primary} />
              ) : (
                <Ionicons name="navigate-circle-outline" size={18} color={Colors.brand.primary} />
              )}
              <Text style={[s.currentLocTxt, { color: Colors.brand.primary }]}>
                {fetchingLocation ? 'Fetching location...' : 'Use my current location'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={s.container}>
      {/* Tabs */}
      <View style={[s.tabBar, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
        {(['sender', 'receiver'] as const).map((tab) => {
          const isActive = activeTab === tab;
          const isValid = tab === 'sender' ? isSenderValid : isReceiverValid;
          return (
            <TouchableOpacity
              key={tab}
              activeOpacity={0.8}
              onPress={() => setActiveTab(tab)}
              style={[s.tab, isActive && { backgroundColor: Colors.brand.primary }]}
            >
              <Ionicons
                name={tab === 'sender' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
                size={16}
                color={isActive ? '#fff' : C.textMuted}
              />
              <Text style={[s.tabTxt, { color: isActive ? '#fff' : C.textSecondary }]}>
                {tab === 'sender' ? 'Sender Info' : 'Receiver Info'}
              </Text>
              {isValid && <Ionicons name="checkmark-circle" size={14} color={isActive ? '#fff' : '#22C55E'} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
        {renderTab(activeTab)}
      </ScrollView>

      {/* Validation status - tappable to navigate to incomplete section */}
      {!allValid && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (!isSenderValid) setActiveTab('sender');
            else if (!isReceiverValid) setActiveTab('receiver');
          }}
          style={[s.statusBar, { backgroundColor: isSenderValid || isReceiverValid ? '#22C55E15' : C.surfaceAlt }]}
        >
          <Ionicons
            name={isSenderValid || isReceiverValid ? 'arrow-forward-circle-outline' : 'information-circle-outline'}
            size={16}
            color={isSenderValid || isReceiverValid ? '#22C55E' : C.textMuted}
          />
          <Text style={[s.statusTxt, { color: isSenderValid || isReceiverValid ? '#22C55E' : C.textMuted }]}>
            {!isSenderValid && !isReceiverValid ? 'Fill in both sender and receiver details' :
             !isSenderValid ? 'Tap here to complete sender info' : 'Tap here to fill receiver details →'}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity 
        activeOpacity={0.85} 
        disabled={!allValid} 
        onPress={onNext}
        style={{ marginBottom: Math.max(insets.bottom, 16) }}
      >
        <LinearGradient
          colors={allValid ? [Colors.brand.primary, Colors.brand.primaryLight] : [C.surfaceAlt, C.surfaceAlt]}
          style={s.nextBtn}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={[s.nextBtnTxt, { color: allValid ? '#fff' : C.textMuted }]}>
            {allValid ? 'Next' : !isSenderValid ? 'Complete Sender Info' : 'Complete Receiver Info'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color={allValid ? '#fff' : C.textMuted} />
        </LinearGradient>
      </TouchableOpacity>

      {/* Success Mark Overlay */}
      {showSenderSuccessMark && (
        <Animated.View 
          entering={FadeInDown} 
          exiting={FadeOutDown}
          style={[s.successOverlay, { backgroundColor: C.background + 'F0' }]}
        >
          <View style={[s.successCircle, { backgroundColor: '#22C55E' }]}>
            <Ionicons name="checkmark" size={40} color="#fff" />
          </View>
          <Text style={[s.successText, { color: C.text }]}>Sender Info Completed</Text>
          <Text style={[s.successSub, { color: C.textSecondary }]}>Switching to Receiver Info...</Text>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 11,
  },
  tabTxt: { fontSize: 13, fontWeight: '700' },
  tabContent: { gap: 4 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    height: 52,
  },
  input: { flex: 1, fontSize: 15, fontWeight: '500' },
  errTxt: { color: '#E53935', fontSize: 11, fontWeight: '500', marginTop: 4, marginLeft: 4 },
  currentLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  currentLocTxt: { fontSize: 13, fontWeight: '600' },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  statusTxt: { fontSize: 12, fontWeight: '500' },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 17,
    borderRadius: 14,
  },
  nextBtnTxt: { fontSize: 16, fontWeight: '800' },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    borderRadius: 20,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  successText: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  successSub: { fontSize: 14, fontWeight: '500' },
});
