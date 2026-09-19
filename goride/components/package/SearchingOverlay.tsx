import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Modal from 'react-native-modal';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { useAppContext } from '@/context/AppContext';
import { PackageDeliveryState } from '@/context/PackageDeliveryContext';

// MapView conditionally loaded
let MapView: any = null;
let MapMarker: any = null;
let PROVIDER_GOOGLE: any = null;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  MapMarker = Maps.Marker;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}
let MapViewDirections: any = null;
try { MapViewDirections = require('react-native-maps-directions').default; } catch { }

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_APIKEY || '';
const { height } = Dimensions.get('window');

interface Props {
  state: PackageDeliveryState;
  onCancelPress: () => void;
  showCancelDialog: boolean;
  onKeepSearching: () => void;
  onConfirmCancel: () => void;
  onTimeout?: () => void;
}

export default function SearchingOverlay(props: Props) {
  const { state, onCancelPress, showCancelDialog, onKeepSearching, onConfirmCancel } = props;
  const { colorScheme } = useAppContext();
  const C = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.4, { duration: 1500 }), -1, true);

    // Auto timeout after 10 seconds
    const timer = setTimeout(() => {
      if (props.onTimeout) props.onTimeout();
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 1.4 - pulse.value,
  }));

  const mapStyle = isDark ? [
    { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  ] : [];

  return (
    <View style={s.root}>
      {/* Map Background */}
      <View style={s.mapWrap}>
        {Platform.OS !== 'web' && MapView && state.senderLocation && state.receiverLocation ? (
          <MapView
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            style={StyleSheet.absoluteFillObject}
            customMapStyle={mapStyle}
            initialRegion={{
              ...state.senderLocation,
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
            }}
          >
            <MapMarker coordinate={state.senderLocation}>
              <View style={[s.pin, { backgroundColor: '#22C55E' }]}>
                <Ionicons name="arrow-up" size={12} color="#fff" />
              </View>
            </MapMarker>
            <MapMarker coordinate={state.receiverLocation}>
              <View style={[s.pin, { backgroundColor: Colors.brand.primary }]}>
                <Ionicons name="arrow-down" size={12} color="#fff" />
              </View>
            </MapMarker>
            {MapViewDirections && (
              <MapViewDirections
                origin={state.senderLocation}
                destination={state.receiverLocation}
                apikey={GOOGLE_API_KEY}
                strokeWidth={4}
                strokeColor={Colors.brand.primary}
              />
            )}
          </MapView>
        ) : (
          <View style={[s.mapFallback, { backgroundColor: C.surfaceAlt }]}>
            <Ionicons name="map-outline" size={48} color={C.border} />
          </View>
        )}
      </View>

      {/* Bottom Searching Sheet */}
      <View style={[s.sheet, { backgroundColor: C.background }]}>
        <View style={[s.handle, { backgroundColor: C.border }]} />

        <View style={s.pulseWrap}>
          <Animated.View style={[s.pulseRing, { backgroundColor: Colors.brand.secondary + '30' }, pulseStyle]} />
          <View style={[s.pulseCore, { backgroundColor: Colors.brand.secondary }]}>
            <Ionicons name="bicycle" size={28} color="#fff" />
          </View>
        </View>

        <Text style={[s.searchTitle, { color: C.text }]}>Finding Delivery Man...</Text>
        <Text style={[s.searchSub, { color: C.textSecondary }]}>
          Broadcasting your delivery request to nearby couriers
        </Text>

        <View style={[s.infoRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
          <View style={[s.infoItem, { borderRightWidth: 1, borderRightColor: C.border }]}>
            <Text style={[s.infoVal, { color: C.text }]}>{state.selectedVehicleType?.name || '—'}</Text>
            <Text style={[s.infoLab, { color: C.textMuted }]}>Vehicle</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={[s.infoVal, { color: Colors.brand.secondary }]}>
              ₦{state.offerFare && parseFloat(state.offerFare) > 0 ? parseFloat(state.offerFare).toLocaleString() : state.fare.toLocaleString()}
            </Text>
            <Text style={[s.infoLab, { color: C.textMuted }]}>Price</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[s.cancelBtn, { borderColor: Colors.brand.danger + '60' }]}
          onPress={onCancelPress}
        >
          <Text style={[s.cancelTxt, { color: Colors.brand.danger }]}>Cancel Searching</Text>
        </TouchableOpacity>
      </View>

      {/* Cancel Confirmation Dialog (Step 7) */}
      <Modal
        isVisible={showCancelDialog}
        backdropOpacity={0.6}
        animationIn="zoomIn"
        animationOut="zoomOut"
        useNativeDriver
        style={s.dialogModal}
      >
        <View style={[s.dialog, { backgroundColor: C.background }]}>
          <View style={[s.dialogIcon, { backgroundColor: Colors.brand.danger + '15' }]}>
            <Ionicons name="alert-circle" size={40} color={Colors.brand.danger} />
          </View>
          <Text style={[s.dialogTitle, { color: C.text }]}>Cancel Searching?</Text>
          <Text style={[s.dialogSub, { color: C.textSecondary }]}>
            Are you sure you want to cancel searching for a deliveryman?
          </Text>
          <TouchableOpacity
            style={[s.dialogBtn, { backgroundColor: Colors.brand.primary }]}
            onPress={onKeepSearching}
          >
            <Text style={s.dialogBtnTxt}>Keep Searching</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.dialogBtnOutline, { borderColor: Colors.brand.danger + '60' }]}
            onPress={onConfirmCancel}
          >
            <Text style={[s.dialogBtnOutlineTxt, { color: Colors.brand.danger }]}>Cancel Searching</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  mapWrap: { flex: 1 },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pin: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 36,
    elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  pulseWrap: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  pulseRing: { position: 'absolute', width: 120, height: 120, borderRadius: 60 },
  pulseCore: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: Colors.brand.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  searchTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  searchSub: { fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  infoRow: { flexDirection: 'row', borderRadius: 16, padding: 16, marginBottom: 20 },
  infoItem: { flex: 1, alignItems: 'center', gap: 4 },
  infoVal: { fontSize: 18, fontWeight: '800' },
  infoLab: { fontSize: 12, fontWeight: '600' },
  cancelBtn: { paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, alignItems: 'center' },
  cancelTxt: { fontSize: 15, fontWeight: '700' },
  dialogModal: { margin: 30, justifyContent: 'center' },
  dialog: { borderRadius: 24, padding: 28, alignItems: 'center' },
  dialogIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  dialogTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  dialogSub: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  dialogBtn: { width: '100%', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginBottom: 10 },
  dialogBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dialogBtnOutline: { width: '100%', paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, alignItems: 'center' },
  dialogBtnOutlineTxt: { fontSize: 16, fontWeight: '700' },
});
