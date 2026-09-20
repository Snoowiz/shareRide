import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, FlatList, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import Modal from 'react-native-modal';

import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import AlertModal from '@/components/AlertModal';
import {
  PackageDeliveryProvider,
  usePackageDelivery,
} from '@/context/PackageDeliveryContext';

import ParcelTypeStep from '@/components/package/ParcelTypeStep';
import ContactInfoStep from '@/components/package/ContactInfoStep';
import WeightStep from '@/components/package/WeightStep';
import VehicleStep from '@/components/package/VehicleStep';
import ReviewStep from '@/components/package/ReviewStep';
import SearchingOverlay from '@/components/package/SearchingOverlay';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_APIKEY || '';

const STEP_TITLES = ['Parcel Type', 'Contact Info', 'Weight', 'Vehicle', 'Review'];

function SendPackageInner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useAppContext();
  const { authUser } = useAuth();
  const C = Colors[colorScheme];
  const pkg = usePackageDelivery();
  const { state } = pkg;

  const [step, setStep] = useState(0);
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationPickerTarget, setLocationPickerTarget] = useState<'sender' | 'receiver'>('sender');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    onConfirm?: () => void;
    confirmText?: string;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  // ─── Recent delivery addresses ────────────────────────────────
  const [recentAddresses, setRecentAddresses] = useState<any[]>([]);

  useEffect(() => {
    if (authUser?.id) {
      fetchRecentAddresses();
    }
  }, [authUser]);

  const fetchRecentAddresses = async () => {
    if (!authUser?.id) return;
    const { data } = await supabase
      .from('search_history')
      .select('*')
      .eq('user_id', authUser.id)
      .order('searched_at', { ascending: false })
      .limit(8);
    if (data) setRecentAddresses(data);
  };

  const saveAddressToHistory = async (data: any, details: any) => {
    if (!authUser?.id || !details) return;
    await supabase.from('search_history').upsert({
      user_id: authUser.id,
      place_id: data.place_id,
      name: data.structured_formatting?.main_text || data.description.split(',')[0],
      address: data.description,
      latitude: details.geometry.location.lat,
      longitude: details.geometry.location.lng,
      searched_at: new Date().toISOString(),
    }, { onConflict: 'user_id,place_id' });
    fetchRecentAddresses();
  };

  // ─── Auto-fill sender info from authenticated user ────────────
  // Only sender gets auto-filled. Receiver stays empty for manual entry.
  useEffect(() => {
    if (authUser && !state.senderName && !state.senderPhone) {
      const fullName = `${authUser.firstName} ${authUser.lastName}`.trim();
      if (fullName) pkg.setSenderInfo({ name: fullName });
      if (authUser.phone) pkg.setSenderInfo({ phone: authUser.phone });
    }
  }, [authUser]);

  const goBack = () => {
    if (state.isSearching) {
      setShowCancelDialog(true);
    } else if (step > 0) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  // ─── Location picker handlers ────────────────────────────────
  const handlePickLocation = useCallback((type: 'sender' | 'receiver') => {
    setLocationPickerTarget(type);
    setShowLocationPicker(true);
  }, []);

  const handleLocationSelected = useCallback((data: any, details: any) => {
    if (!details) return;
    const loc = {
      latitude: details.geometry.location.lat,
      longitude: details.geometry.location.lng,
    };
    const addr = data.description;

    if (locationPickerTarget === 'sender') {
      pkg.setSenderInfo({ location: loc, address: addr });
    } else {
      pkg.setReceiverInfo({ location: loc, address: addr });
    }

    // Save to search history
    saveAddressToHistory(data, details);
    setShowLocationPicker(false);
  }, [locationPickerTarget, pkg, authUser]);

  // ─── Select from recent ──────────────────────────────────────
  const handleSelectRecent = useCallback((item: any) => {
    const loc = { latitude: item.latitude, longitude: item.longitude };
    const addr = item.address;

    if (locationPickerTarget === 'sender') {
      pkg.setSenderInfo({ location: loc, address: addr });
    } else {
      pkg.setReceiverInfo({ location: loc, address: addr });
    }
    setShowLocationPicker(false);
  }, [locationPickerTarget, pkg]);

  // ─── Step transitions ────────────────────────────────────────
  const handleStep1Next = () => {
    if (!state.parcelType) return;
    setStep(1);
  };

  const handleStep2Next = () => {
    const errs: Record<string, string> = {};
    if (!state.senderName.trim()) errs.senderName = 'Name required';
    if (state.senderPhone.length < 8) errs.senderPhone = 'Phone required';
    if (!state.senderAddress) errs.senderAddress = 'Address required';
    if (!state.receiverName.trim()) errs.receiverName = 'Name required';
    if (state.receiverPhone.length < 8) errs.receiverPhone = 'Phone required';
    if (!state.receiverAddress) errs.receiverAddress = 'Address required';

    setContactErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setStep(2);
  };

  const handleStep3Save = () => {
    if (!state.parcelWeight || parseFloat(state.parcelWeight) <= 0) return;

    // Calculate distance between sender and receiver
    if (state.senderLocation && state.receiverLocation) {
      const origin = `${state.senderLocation.latitude},${state.senderLocation.longitude}`;
      const dest = `${state.receiverLocation.latitude},${state.receiverLocation.longitude}`;
      fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${dest}&key=${GOOGLE_API_KEY}`
      )
        .then((r) => r.json())
        .then((data) => {
          if (data.status === 'OK' && data.rows[0]?.elements[0]?.status === 'OK') {
            const el = data.rows[0].elements[0];
            const km = el.distance.value / 1000;
            const mins = el.duration.value / 60;
            pkg.setRouteInfo(km, mins);
          } else {
            // Fallback GPS calculation if Google Maps API has billing/rate limits
            const lat1 = state.senderLocation.latitude;
            const lon1 = state.senderLocation.longitude;
            const lat2 = state.receiverLocation.latitude;
            const lon2 = state.receiverLocation.longitude;
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const km = Math.max(1, Math.round(R * c * 1.3 * 10) / 10);
            const mins = Math.max(5, Math.round(km * 2.5));
            pkg.setRouteInfo(km, mins);
          }
        })
        .catch(() => {
          // Fallback on network/fetch error
          if (state.senderLocation && state.receiverLocation) {
            const lat1 = state.senderLocation.latitude;
            const lon1 = state.senderLocation.longitude;
            const lat2 = state.receiverLocation.latitude;
            const lon2 = state.receiverLocation.longitude;
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const km = Math.max(1, Math.round(R * c * 1.3 * 10) / 10);
            const mins = Math.max(5, Math.round(km * 2.5));
            pkg.setRouteInfo(km, mins);
          }
        });
    }
    setStep(3);
  };

  const handleStep4Next = () => {
    if (!state.selectedVehicleType) return;
    const vehicle = state.selectedVehicleType;
    const raw = vehicle.baseFare + state.distanceKm * vehicle.pricePerKm;
    pkg.setFare(Math.round(raw / 50) * 50);
    setStep(4);
  };

  // ─── SUPABASE: Create delivery and start searching ────────────
  const handleFindDriver = async () => {
    if (!authUser) {
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: 'You must be logged in to send a package.',
        type: 'error'
      });
      return;
    }
    if (!state.senderLocation || !state.receiverLocation) {
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: 'Please set both pickup and delivery locations.',
        type: 'warning'
      });
      return;
    }

    setLoading(true);
    try {
      const finalFare = state.offerFare && parseFloat(state.offerFare) > 0
        ? parseFloat(state.offerFare)
        : state.fare;

      const { data, error } = await supabase
        .from('deliveries')
        .insert({
          rider_id: authUser.id,
          parcel_type: state.parcelType?.id || 'other',
          parcel_weight: parseFloat(state.parcelWeight),
          sender_name: state.senderName,
          sender_phone: state.senderPhone,
          sender_lat: state.senderLocation.latitude,
          sender_lng: state.senderLocation.longitude,
          sender_address: state.senderAddress,
          receiver_name: state.receiverName,
          receiver_phone: state.receiverPhone,
          receiver_lat: state.receiverLocation.latitude,
          receiver_lng: state.receiverLocation.longitude,
          receiver_address: state.receiverAddress,
          distance_km: state.distanceKm,
          duration_mins: state.durationMins,
          vehicle_type: state.selectedVehicleType?.id || 'bike',
          fare: state.fare,
          offer_fare: state.offerFare && parseFloat(state.offerFare) > 0 ? parseFloat(state.offerFare) : null,
          payer_type: state.payerType,
          payment_method: state.paymentMethod,
          parcel_image_url: state.parcelImageUrl,
          terms_accepted: state.termsAccepted,
          status: 'searching',
        })
        .select()
        .single();

      if (error) throw error;

      pkg.setSearchState(true, data.id);

      // Listen for driver acceptance via realtime
      const channel = supabase
        .channel(`delivery-${data.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          filter: `id=eq.${data.id}`,
        }, (payload) => {
          const updated = payload.new as any;
          if (updated.status === 'accepted') {
            // Driver accepted! Navigate to tracking
            setAlertConfig({
              visible: true,
              title: 'Driver Found!',
              message: 'A deliveryman has accepted your request.',
              type: 'success',
              confirmText: 'OK',
              onConfirm: () => {
                pkg.setSearchState(false, data.id);
                router.replace('/(user)/(tabs)');
              }
            });
          } else if (updated.status === 'cancelled') {
            pkg.setSearchState(false, null);
          }
        })
        .subscribe();

    } catch (err: any) {
      console.error('Error creating delivery:', err);
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: err.message || 'Failed to create delivery request.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeepSearching = () => setShowCancelDialog(false);

  const handleConfirmCancel = async () => {
    setShowCancelDialog(false);
    // Cancel in Supabase
    if (state.currentDeliveryId) {
      try {
        await supabase
          .from('deliveries')
          .update({ status: 'cancelled' })
          .eq('id', state.currentDeliveryId);
      } catch (err) {
        console.warn('Cancel error:', err);
      }
    }
    pkg.setSearchState(false, null);
    pkg.resetState();
    router.replace('/(user)/(tabs)');
  };

  const handleSearchTimeout = () => {
    // Drop the searching state first so the main view (and AlertModal) renders
    pkg.setSearchState(false, null);

    setAlertConfig({
      visible: true,
      title: 'Request Broadcasted!',
      message: 'Your delivery request is now being broadcasted to all nearby deliverymen. You will be notified once a driver accepts your request.',
      type: 'success',
      confirmText: 'Got it',
      onConfirm: () => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
        pkg.resetState();
        router.replace('/(user)/(tabs)');
      }
    });
  };

  // ─── Searching state ─────────────────────────────────────────
  if (state.isSearching) {
    return (
      <SearchingOverlay
        state={state}
        onCancelPress={() => setShowCancelDialog(true)}
        showCancelDialog={showCancelDialog}
        onKeepSearching={handleKeepSearching}
        onConfirmCancel={handleConfirmCancel}
        onTimeout={handleSearchTimeout}
      />
    );
  }

  // ─── Progress indicator ──────────────────────────────────────
  const renderProgress = () => (
    <View style={s.progressRow}>
      {STEP_TITLES.map((_, i) => (
        <View key={i} style={[s.progressDot, {
          backgroundColor: i <= step ? Colors.brand.primary : C.border,
          width: i === step ? 24 : 8,
        }]} />
      ))}
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={goBack} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={[s.headerTitle, { color: C.text }]}>Send Package</Text>
          <Text style={[s.headerSub, { color: C.textMuted }]}>{STEP_TITLES[step]}</Text>
        </View>
        <View style={s.backBtn} />
      </View>

      {renderProgress()}

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Steps */}
        <View style={{ flex: 1 }}>
          {step === 0 && (
            <ParcelTypeStep
              selected={state.parcelType}
              onSelect={pkg.setParcelType}
              onNext={handleStep1Next}
            />
          )}
          {step === 1 && (
            <ContactInfoStep
              sender={{ phone: state.senderPhone, name: state.senderName, address: state.senderAddress, location: state.senderLocation }}
              receiver={{ phone: state.receiverPhone, name: state.receiverName, address: state.receiverAddress, location: state.receiverLocation }}
              onSenderChange={(d) => pkg.setSenderInfo(d)}
              onReceiverChange={(d) => pkg.setReceiverInfo(d)}
              onPickLocation={handlePickLocation}
              onNext={handleStep2Next}
              errors={contactErrors}
            />
          )}
          {step === 2 && state.parcelType && (
            <WeightStep
              parcelType={state.parcelType}
              weight={state.parcelWeight}
              onWeightChange={pkg.setParcelWeight}
              parcelImageUrl={state.parcelImageUrl}
              onImageChange={pkg.setParcelImage}
              termsAccepted={state.termsAccepted}
              onTermsChange={pkg.setTermsAccepted}
              onSave={handleStep3Save}
            />
          )}
          {step === 3 && (
            <VehicleStep
              selected={state.selectedVehicleType}
              distanceKm={state.distanceKm}
              onSelect={pkg.setSelectedVehicle}
              onNext={handleStep4Next}
            />
          )}
          {step === 4 && (
            <ReviewStep
              state={state}
              onPayerChange={pkg.setPayerType}
              onPaymentChange={pkg.setPaymentMethod}
              onOfferFareChange={pkg.setOfferFare}
              onFindDriver={handleFindDriver}
              loading={loading}
            />
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Location Picker Modal */}
      <Modal
        isVisible={showLocationPicker}
        onBackdropPress={() => setShowLocationPicker(false)}
        onSwipeComplete={() => setShowLocationPicker(false)}
        swipeDirection="down"
        avoidKeyboard={true}
        style={s.modal}
      >
        <View style={[s.modalContent, { backgroundColor: C.background, paddingBottom: 20 }]}>
          <View style={[s.dragHandle, { backgroundColor: C.border }]} />
          <Text style={[s.modalTitle, { color: C.text }]}>
            {locationPickerTarget === 'sender' ? 'Pickup Location' : 'Delivery Location'}
          </Text>

          <GooglePlacesAutocomplete
            placeholder="Search for an address..."
            fetchDetails
            onPress={handleLocationSelected}
            query={{
              key: GOOGLE_API_KEY,
              language: 'en',
              components: 'country:ng',
            }}
            debounce={400}
            styles={{
              container: { flex: 0, zIndex: 999 },
              textInputContainer: { backgroundColor: 'transparent' },
              textInput: {
                color: C.text,
                fontSize: 15,
                backgroundColor: C.surface,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: C.border,
                paddingHorizontal: 16,
                height: 50,
                fontWeight: '500',
              },
              listView: {
                backgroundColor: C.surface,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: C.border,
                marginTop: 8,
                maxHeight: 200,
              },
              row: { backgroundColor: 'transparent', padding: 14 },
              separator: { height: 1, backgroundColor: C.border },
              description: { color: C.text, fontSize: 14 },
            }}
            textInputProps={{ placeholderTextColor: C.textMuted, autoFocus: true }}
            enablePoweredByContainer={false}
          />

          {/* Recent Addresses */}
          {recentAddresses.length > 0 && (
            <View style={s.recentSection}>
              <Text style={[s.recentTitle, { color: C.textSecondary }]}>Recent Addresses</Text>
              <FlatList
                data={recentAddresses}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[s.recentItem, { borderBottomColor: C.border }]}
                    onPress={() => handleSelectRecent(item)}
                  >
                    <View style={[s.recentIcon, { backgroundColor: Colors.brand.primary + '12' }]}>
                      <Ionicons name="time-outline" size={16} color={Colors.brand.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.recentName, { color: C.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[s.recentAddr, { color: C.textMuted }]} numberOfLines={1}>
                        {item.address}
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={14} color={C.textMuted} />
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>
      </Modal>

      <AlertModal
        isVisible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        confirmText={alertConfig.confirmText}
        onConfirm={alertConfig.onConfirm}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

export default function SendPackageScreen() {
  return (
    <PackageDeliveryProvider>
      <SendPackageInner />
    </PackageDeliveryProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 4,
  },
  progressDot: { height: 6, borderRadius: 3 },
  modal: { justifyContent: 'flex-end', margin: 0 },
  modalContent: { 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    paddingHorizontal: 20, 
    paddingTop: 12, 
    maxHeight: '90%',
  },
  dragHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  // Recent addresses
  recentSection: { marginTop: 18 },
  recentTitle: { fontSize: 13, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  recentName: { fontSize: 14, fontWeight: '600' },
  recentAddr: { fontSize: 12, fontWeight: '500', marginTop: 2 },
});
