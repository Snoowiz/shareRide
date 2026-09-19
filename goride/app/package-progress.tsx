import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, Linking, Dimensions, Platform, Share
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import AlertModal from '@/components/AlertModal';
import { Stack } from 'expo-router';
import Modal from 'react-native-modal';
import PremiumVehicleMarker from '@/components/PremiumVehicleMarker';

const { width, height } = Dimensions.get('window');
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_APIKEY || '';

const PHASE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  accepted: { label: 'Courier is heading to pickup', color: '#3B82F6', icon: 'bicycle' },
  picked_up: { label: 'Parcel Collected', color: '#8B5CF6', icon: 'cube' },
  in_transit: { label: 'Delivery in progress', color: '#22C55E', icon: 'navigate' },
  delivered: { label: 'Parcel Delivered', color: '#EC4899', icon: 'checkmark-circle' }
};

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export default function PackageProgressScreen() {
  const { deliveryId } = useLocalSearchParams<{ deliveryId: string }>();
  const { authUser } = useAuth();
  const { colorScheme } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const isDark = colorScheme === 'dark';
  const C = Colors[colorScheme];
  const isMounted = useRef(true);

  const [delivery, setDelivery] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [driverVehicle, setDriverVehicle] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number; heading?: number } | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<string>('accepted');
  const [routeInfo, setRouteInfo] = useState({ distance: '', duration: '' });
  const [loading, setLoading] = useState(true);
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    onConfirm?: () => void;
    showCancel?: boolean;
    confirmText?: string;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Fetch delivery + driver details
  useEffect(() => {
    if (!deliveryId) return;
    (async () => {
      try {
        const { data: deliveryData, error } = await supabase
          .from('deliveries')
          .select('*')
          .eq('id', deliveryId)
          .single();

        if (error || !deliveryData) throw error || new Error('Delivery not found');
        setDelivery(deliveryData);
        setDeliveryStatus(deliveryData.status);

        if (deliveryData.driver_id) {
          // Fetch driver profile
          const { data: driverData } = await supabase
            .from('profiles')
            .select('first_name, last_name, avatar_url, phone')
            .eq('id', deliveryData.driver_id)
            .single();
          if (driverData) setDriver(driverData);

          // Fetch vehicle info
          const { data: vehicleData } = await supabase
            .from('driver_profiles')
            .select('vehicle_make, vehicle_color, license_plate, driver_type')
            .eq('id', deliveryData.driver_id)
            .maybeSingle();
          if (vehicleData) setDriverVehicle(vehicleData);

          // Fetch driver's live location
          const { data: locData } = await supabase
            .from('available_drivers')
            .select('latitude, longitude, heading')
            .eq('id', deliveryData.driver_id)
            .single();
          if (locData?.latitude) {
            setDriverLocation({ latitude: locData.latitude, longitude: locData.longitude, heading: locData.heading });
          }
        }
      } catch (err) {
        console.error('Error fetching delivery:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [deliveryId]);

  // Subscribe to real-time delivery status updates
  useEffect(() => {
    if (!deliveryId) return;
    const channel = supabase
      .channel(`delivery-updates-${deliveryId}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'deliveries',
        filter: `id=eq.${deliveryId}`,
      }, (payload) => {
        const newStatus = payload.new.status;
        setDeliveryStatus(newStatus);

        if (newStatus === 'delivered') {
          setAlertConfig({
            visible: true,
            title: 'Delivery Complete',
            message: 'Your package has been successfully delivered!',
            type: 'success',
            onConfirm: () => router.replace('/(user)/(tabs)/rides')
          });
        } else if (newStatus === 'cancelled') {
          setAlertConfig({
            visible: true,
            title: 'Delivery Cancelled',
            message: 'This delivery has been cancelled.',
            type: 'error',
            onConfirm: () => router.replace('/(user)/(tabs)')
          });
        }
      })
      .subscribe();

    return () => {
      isMounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [deliveryId]);

  // Poll driver location every 5 seconds
  useEffect(() => {
    if (!delivery?.driver_id) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('available_drivers')
        .select('latitude, longitude, heading')
        .eq('id', delivery.driver_id)
        .single();
      if (data?.latitude) {
        setDriverLocation({ latitude: data.latitude, longitude: data.longitude, heading: data.heading });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [delivery?.driver_id]);

  const pickup = delivery ? { latitude: delivery.sender_lat, longitude: delivery.sender_lng } : null;
  const destination = delivery ? { latitude: delivery.receiver_lat, longitude: delivery.receiver_lng } : null;
  const driverName = driver ? `${driver.first_name} ${driver.last_name || ''}`.trim() : 'Courier';
  const vehicleInfo = driverVehicle
    ? `${driverVehicle.vehicle_color || ''} ${driverVehicle.vehicle_make || ''} · ${driverVehicle.license_plate || ''}`.trim()
    : '';

  const isHeadingToPickup = deliveryStatus === 'accepted';
  
  // Memoize coordinates to prevent infinite render loops with MapViewDirections
  const routeOrigin = React.useMemo(() => driverLocation, [driverLocation?.latitude, driverLocation?.longitude]);
  const routeDestination = React.useMemo(() => {
    return isHeadingToPickup ? pickup : destination;
  }, [isHeadingToPickup, pickup?.latitude, pickup?.longitude, destination?.latitude, destination?.longitude]);

  const phase = PHASE_LABELS[deliveryStatus] || PHASE_LABELS.accepted;

  // Fit map to show the entire route (pickup to destination) by default
  useEffect(() => {
    let timer: any;
    if (!mapRef.current || !pickup || !destination || !isMounted.current) return;
    
    const coords = [pickup, destination];
    if (driverLocation) coords.push(driverLocation);
    
    timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 140, right: 70, bottom: height * 0.45, left: 70 },
        animated: true,
      });
    }, 800);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [delivery?.id, pickup?.latitude, destination?.latitude]); // Run when booking details are ready

  const handleCall = () => {
    if (driver?.phone) Linking.openURL(`tel:${driver.phone}`);
    else setAlertConfig({
      visible: true,
      title: 'Unavailable',
      message: "Courier's phone is not available.",
      type: 'info'
    });
  };

  const handleRecenterMap = () => {
    if (!mapRef.current || !pickup || !destination) return;
    mapRef.current.fitToCoordinates([pickup, destination], {
      edgePadding: { top: 140, right: 70, bottom: height * 0.45, left: 70 },
      animated: true,
    });
  };

  const handleCancel = async () => {
    if (!isHeadingToPickup) {
      setAlertConfig({
        visible: true,
        title: 'Cannot Cancel',
        message: 'Delivery is already in progress.',
        type: 'warning'
      });
      return;
    }
    setAlertConfig({
      visible: true,
      title: 'Cancel Delivery?',
      message: 'Are you sure you want to cancel?',
      type: 'warning',
      showCancel: true,
      confirmText: 'Yes, Cancel',
      onConfirm: async () => {
        await supabase.from('deliveries').update({ status: 'cancelled' }).eq('id', deliveryId);
        router.replace('/(user)/(tabs)');
      }
    });
  };

  if (loading || !delivery) {
    return (
      <View style={[s.loadingContainer, { backgroundColor: C.background }]}>
        <ActivityIndicator size="large" color={Colors.brand.primary} />
        <Text style={[s.loadingText, { color: C.textMuted }]}>Loading delivery details...</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Stack.Screen options={{ title: 'Package in Progress', headerShadowVisible: false }} />
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={StyleSheet.absoluteFillObject}
        customMapStyle={isDark ? darkMapStyle : []}
        showsUserLocation={false}
      >
        {driverLocation && (
          <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <PremiumVehicleMarker 
              heading={driverLocation.heading || 0} 
              isBike={driverVehicle?.driver_type === 'motorbike'} 
            />
          </Marker>
        )}
        {pickup && (
          <Marker coordinate={pickup}>
            <View style={s.pickupPin}>
              <Ionicons name="arrow-up" size={14} color="#fff" />
            </View>
          </Marker>
        )}
        {destination && !isHeadingToPickup && (
          <Marker coordinate={destination}>
            <View style={s.destPin}>
              <Ionicons name="arrow-down" size={14} color="#fff" />
            </View>
          </Marker>
        )}
        {routeOrigin && routeDestination && (
          <MapViewDirections
            origin={routeOrigin}
            destination={routeDestination}
            apikey={GOOGLE_API_KEY}
            strokeWidth={5}
            strokeColor={phase.color}
            onReady={(result) => {
              const newDist = `${result.distance.toFixed(1)} km`;
              const newDur = `${Math.round(result.duration)} min`;
              // Only update if values actually changed to prevent render loops
              if (routeInfo.distance !== newDist || routeInfo.duration !== newDur) {
                setRouteInfo({
                  distance: newDist,
                  duration: newDur,
                });
              }
            }}
          />
        )}
      </MapView>

      {/* Top bar */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={[s.topBtn, { backgroundColor: C.surface }]} onPress={() => router.replace('/(user)/(tabs)/rides')}>
          <Ionicons name="close" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={[s.phaseBadge, { backgroundColor: phase.color }]}>
          <Ionicons name={phase.icon as any} size={14} color="#fff" style={{ marginRight: 6 }} />
          <Text style={s.phaseTxt}>{phase.label}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[s.topBtn, { backgroundColor: C.surface }]} onPress={handleRecenterMap}>
            <Ionicons name="map-outline" size={20} color={C.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom card */}
      <View style={[s.bottomCard, { backgroundColor: C.surface }]}>
        {/* ETA strip */}
        <View style={[s.etaStrip, { backgroundColor: phase.color + '12' }]}>
          <Ionicons name="time-outline" size={16} color={phase.color} />
          <Text style={[s.etaTxt, { color: phase.color }]}>
            {routeInfo.duration || '...'} · {routeInfo.distance || '...'} {isHeadingToPickup ? 'to pickup' : 'to destination'}
          </Text>
        </View>

        {/* Driver info */}
        <View style={s.driverRow}>
          <View style={s.driverLeft}>
            {driver?.avatar_url ? (
              <Image source={{ uri: driver.avatar_url }} style={s.driverAvatar} />
            ) : (
              <View style={[s.driverAvatar, { backgroundColor: '#FCCA1430' }]}>
                <Ionicons name="person" size={22} color="#FCCA14" />
              </View>
            )}
            <View>
              <Text style={[s.driverName, { color: C.text }]}>{driverName}</Text>
              {vehicleInfo ? (
                <Text style={[s.vehicleTxt, { color: C.textMuted }]}>{vehicleInfo}</Text>
              ) : (
                <Text style={[s.vehicleTxt, { color: C.textMuted }]}>{delivery.parcel_type || 'Package'}</Text>
              )}
            </View>
          </View>
          <View style={s.driverActions}>
            <TouchableOpacity style={[s.actionCircle, { backgroundColor: C.surfaceAlt }]} onPress={handleCall}>
              <Ionicons name="call" size={20} color="#22C55E" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[s.actionCircle, { backgroundColor: C.surfaceAlt }]}
              onPress={() => router.push(`/chat?rideId=${deliveryId}&otherUserId=${delivery.driver_id}&type=delivery`)}
            >
              <Ionicons name="chatbubble-ellipses" size={20} color="#3B82F6" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sender & Parcel Info */}
        <View style={s.detailsSection}>
          <View style={[s.detailCard, { backgroundColor: C.surfaceAlt }]}>
            <View style={s.detailHeader}>
              <Text style={[s.detailLabel, { color: C.textMuted }]}>Receiver Details</Text>
              {delivery.parcel_image_url && (
                <TouchableOpacity 
                  style={s.previewBadge}
                  onPress={() => setPreviewImage(delivery.parcel_image_url)}
                >
                  <Ionicons name="image" size={14} color={Colors.brand.primary} />
                  <Text style={s.previewTxt}>Item Preview</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={s.detailRow}>
              <View style={s.detailMain}>
                <Text style={[s.detailName, { color: C.text }]}>{delivery.receiver_name}</Text>
                <Text style={[s.detailSub, { color: C.textMuted }]}>{delivery.receiver_phone}</Text>
              </View>
              <TouchableOpacity 
                style={s.detailCall}
                onPress={() => Linking.openURL(`tel:${delivery.receiver_phone}`)}
              >
                <Ionicons name="call-outline" size={18} color={C.text} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Fare info */}
        <View style={[s.fareRow, { borderTopColor: C.border }]}>
          <View>
            <Text style={[s.fareLabel, { color: C.textMuted }]}>Delivery Fare</Text>
            <Text style={[s.fareAmount, { color: C.text }]}>₦{(delivery.fare || 0).toLocaleString()}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.fareLabel, { color: C.textMuted }]}>Weight</Text>
            <Text style={[s.fareAmount, { color: C.text }]}>{delivery.parcel_weight} kg</Text>
          </View>
        </View>

        {/* Cancel button — only before pickup */}
        {isHeadingToPickup && (
          <TouchableOpacity style={s.cancelBtn} onPress={handleCancel} activeOpacity={0.7}>
            <Text style={s.cancelTxt}>Cancel Delivery</Text>
          </TouchableOpacity>
        )}
      </View>
      <AlertModal
        isVisible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        showCancel={alertConfig.showCancel}
        confirmText={alertConfig.confirmText}
        onConfirm={alertConfig.onConfirm}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />

      {/* Image Preview Modal */}
      {previewImage && (
        <Modal
          isVisible={!!previewImage}
          onBackdropPress={() => setPreviewImage(null)}
          onBackButtonPress={() => setPreviewImage(null)}
          style={{ margin: 0 }}
          animationIn="zoomIn"
          animationOut="zoomOut"
        >
          <View style={s.previewModal}>
            <TouchableOpacity 
              style={[s.closeBtn, { top: insets.top + 20 }]}
              onPress={() => setPreviewImage(null)}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Image 
              source={{ uri: previewImage }} 
              style={s.previewImg} 
              resizeMode="contain" 
            />
            <Text style={s.previewTitle}>Parcel Item Preview</Text>
          </View>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 15 },

  carMarker: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FCCA14', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
      android: { elevation: 6 },
    }),
  },
  pickupPin: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  destPin: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#0F346E', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16,
  },
  topBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  phaseBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  phaseTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },

  bottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: 34,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.12, shadowRadius: 12 },
      android: { elevation: 16 },
    }),
  },
  etaStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 18, marginBottom: 14,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
  },
  etaTxt: { fontWeight: '700', fontSize: 13 },

  driverRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 16,
  },
  driverLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  driverName: { fontSize: 17, fontWeight: '700' },
  vehicleTxt: { fontSize: 13, marginTop: 2 },

  driverActions: { flexDirection: 'row', gap: 10 },
  actionCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  fareRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1,
  },
  fareLabel: { fontSize: 12, marginBottom: 2 },
  fareAmount: { fontSize: 18, fontWeight: '800' },

  cancelBtn: {
    marginHorizontal: 20, marginTop: 16, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FEE2E2',
  },
  cancelTxt: { color: '#EF4444', fontWeight: '700', fontSize: 15 },

  // New Details Section
  detailsSection: { paddingHorizontal: 20, marginBottom: 16 },
  detailCard: { padding: 12, borderRadius: 14 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  detailLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  previewBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.brand.primary + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  previewTxt: { fontSize: 11, fontWeight: '700', color: Colors.brand.primary },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailMain: { flex: 1 },
  detailName: { fontSize: 15, fontWeight: '700' },
  detailSub: { fontSize: 13, marginTop: 1 },
  detailCall: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },

  // Preview Modal
  previewModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  closeBtn: { position: 'absolute', right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  previewImg: { width: width * 0.9, height: height * 0.6, borderRadius: 20 },
  previewTitle: { color: '#fff', marginTop: 20, fontSize: 16, fontWeight: '600' },
});
