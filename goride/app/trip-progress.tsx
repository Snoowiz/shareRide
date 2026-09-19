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
import PremiumVehicleMarker from '@/components/PremiumVehicleMarker';

const { width, height } = Dimensions.get('window');
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_APIKEY || '';

const PHASE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  accepted: { label: 'Driver is on the way', color: '#3B82F6', icon: 'car' },
  arrived: { label: 'Driver has arrived', color: '#F59E0B', icon: 'checkmark-circle' },
  ongoing: { label: 'Trip in progress', color: '#22C55E', icon: 'navigate' },
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

import SOSModal from '@/components/SOSModal';

export default function TripProgressScreen() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const { authUser } = useAuth();
  const { colorScheme } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const isDark = colorScheme === 'dark';
  const C = Colors[colorScheme];
  const isMounted = useRef(true);

  const [ride, setRide] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [driverVehicle, setDriverVehicle] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number; heading?: number } | null>(null);
  const [rideStatus, setRideStatus] = useState<string>('accepted');
  const [routeInfo, setRouteInfo] = useState({ distance: '', duration: '' });
  const [loading, setLoading] = useState(true);
  const [sosVisible, setSosVisible] = useState(false);
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

  // Fetch ride + driver details
  useEffect(() => {
    if (!rideId) return;
    (async () => {
      try {
        const { data: rideData, error } = await supabase
          .from('rides')
          .select('*')
          .eq('id', rideId)
          .single();

        if (error || !rideData) throw error || new Error('Ride not found');
        setRide(rideData);
        setRideStatus(rideData.status);

        if (rideData.driver_id) {
          // Fetch driver profile
          const { data: driverData } = await supabase
            .from('profiles')
            .select('first_name, last_name, avatar_url, phone')
            .eq('id', rideData.driver_id)
            .single();
          if (driverData) setDriver(driverData);

          // Fetch vehicle info
          const { data: vehicleData } = await supabase
            .from('driver_profiles')
            .select('vehicle_make, vehicle_color, license_plate, driver_type')
            .eq('id', rideData.driver_id)
            .maybeSingle();
          if (vehicleData) setDriverVehicle(vehicleData);

          // Fetch driver's live location
          const { data: locData } = await supabase
            .from('available_drivers')
            .select('latitude, longitude, heading')
            .eq('id', rideData.driver_id)
            .single();
          if (locData?.latitude) {
            setDriverLocation({ latitude: locData.latitude, longitude: locData.longitude, heading: locData.heading });
          }
        }
      } catch (err) {
        console.error('Error fetching trip:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [rideId]);

  // Subscribe to real-time ride status updates
  useEffect(() => {
    if (!rideId) return;
    const channel = supabase
      .channel(`trip-${rideId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rides',
        filter: `id=eq.${rideId}`,
      }, (payload) => {
        const newStatus = payload.new.status;
        setRideStatus(newStatus);

        if (newStatus === 'completed') {
          router.replace(`/rate-trip?rideId=${rideId}&role=rider&otherUserId=${payload.new.driver_id}`);
        } else if (newStatus === 'cancelled') {
          setAlertConfig({
            visible: true,
            title: 'Ride Cancelled',
            message: 'This ride has been cancelled.',
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
  }, [rideId]);

  // Poll driver location every 5 seconds
  useEffect(() => {
    if (!ride?.driver_id) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('available_drivers')
        .select('latitude, longitude, heading')
        .eq('id', ride.driver_id)
        .single();
      if (data?.latitude) {
        setDriverLocation({ latitude: data.latitude, longitude: data.longitude, heading: data.heading });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [ride?.driver_id]);

  const pickup = ride ? { latitude: ride.pickup_lat, longitude: ride.pickup_lng } : null;
  const destination = ride ? { latitude: ride.destination_lat, longitude: ride.destination_lng } : null;
  const driverName = driver ? `${driver.first_name} ${driver.last_name || ''}`.trim() : 'Driver';
  const vehicleInfo = driverVehicle
    ? `${driverVehicle.vehicle_color || ''} ${driverVehicle.vehicle_make || ''} · ${driverVehicle.license_plate || ''}`.trim()
    : '';

  const routeOrigin = driverLocation; // Always track from driver's current position
  const routeDestination = rideStatus === 'ongoing' ? destination : pickup;

  const phase = PHASE_LABELS[rideStatus] || PHASE_LABELS.accepted;

  // Fit map to show the current active leg of the trip
  const fitMap = () => {
    if (!mapRef.current || !pickup || !isMounted.current) return;
    const coords = [];
    if (driverLocation) coords.push(driverLocation);
    if (rideStatus === 'ongoing') {
      if (destination) coords.push(destination);
    } else {
      coords.push(pickup);
    }

    if (coords.length > 0) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 140, right: 70, bottom: height * 0.45, left: 70 },
        animated: true,
      });
    }
  };

  useEffect(() => {
    const timer = setTimeout(fitMap, 800);
    return () => clearTimeout(timer);
  }, [rideStatus, driverLocation?.latitude]);

  const handleCall = () => {
    if (driver?.phone) Linking.openURL(`tel:${driver.phone}`);
    else setAlertConfig({
      visible: true,
      title: 'Unavailable',
      message: "Driver's phone is not available.",
      type: 'info'
    });
  };

  const handleRecenterMap = () => {
    fitMap();
  };

  const handleCancel = async () => {
    if (rideStatus === 'ongoing') {
      setAlertConfig({
        visible: true,
        title: 'Cannot Cancel',
        message: 'Trip is already in progress.',
        type: 'warning'
      });
      return;
    }
    setAlertConfig({
      visible: true,
      title: 'Cancel Ride?',
      message: 'Are you sure you want to cancel?',
      type: 'warning',
      showCancel: true,
      confirmText: 'Yes, Cancel',
      onConfirm: async () => {
        await supabase.from('rides').update({ status: 'cancelled' }).eq('id', rideId);
        router.replace('/(user)/(tabs)');
      }
    });
  };

  if (loading || !ride) {
    return (
      <View style={[s.loadingContainer, { backgroundColor: C.background }]}>
        <ActivityIndicator size="large" color={Colors.brand.primary} />
        <Text style={[s.loadingText, { color: C.textMuted }]}>Loading trip details...</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
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
              <Ionicons name="person" size={14} color="#fff" />
            </View>
          </Marker>
        )}
        {destination && rideStatus === 'ongoing' && (
          <Marker coordinate={destination}>
            <View style={s.destPin}>
              <Ionicons name="flag" size={14} color="#fff" />
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
              setRouteInfo({
                distance: `${result.distance.toFixed(1)} km`,
                duration: `${Math.round(result.duration)} min`,
              });
            }}
          />
        )}
      </MapView>

      {/* Top bar */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={[s.topBtn, { backgroundColor: C.surface }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={[s.phaseBadge, { backgroundColor: phase.color }]}>
          <Ionicons name={phase.icon as any} size={14} color="#fff" style={{ marginRight: 6 }} />
          <Text style={s.phaseTxt}>{phase.label}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[s.topBtn, { backgroundColor: C.surface }]} onPress={handleRecenterMap}>
            <Ionicons name="map-outline" size={20} color={C.text} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.topBtn, { backgroundColor: '#FEF2F2' }]} onPress={() => setSosVisible(true)}>
            <Ionicons name="shield-half" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <SOSModal isVisible={sosVisible} onClose={() => setSosVisible(false)} rideId={rideId} />

      {/* Bottom card */}
      <View style={[s.bottomCard, { backgroundColor: C.surface }]}>
        {/* ETA strip */}
        <View style={[s.etaStrip, { backgroundColor: phase.color + '12' }]}>
          <Ionicons name="time-outline" size={16} color={phase.color} />
          <Text style={[s.etaTxt, { color: phase.color }]}>
            {routeInfo.duration || '...'} · {routeInfo.distance || '...'}
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
                <Text style={[s.vehicleTxt, { color: C.textMuted }]}>{ride.ride_type}</Text>
              )}
            </View>
          </View>
          <View style={s.driverActions}>
            <TouchableOpacity style={[s.actionCircle, { backgroundColor: C.surfaceAlt }]} onPress={handleCall}>
              <Ionicons name="call" size={20} color="#22C55E" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionCircle, { backgroundColor: C.surfaceAlt }]}
              onPress={() => router.push(`/chat?rideId=${rideId}&otherUserId=${ride.driver_id}&type=ride`)}
            >
              <Ionicons name="chatbubble-ellipses" size={20} color="#3B82F6" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Fare info */}
        <View style={[s.fareRow, { borderTopColor: C.border }]}>
          <View>
            <Text style={[s.fareLabel, { color: C.textMuted }]}>Trip Fare</Text>
            <Text style={[s.fareAmount, { color: C.text }]}>₦{(ride.fare || 0).toLocaleString()}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.fareLabel, { color: C.textMuted }]}>Distance</Text>
            <Text style={[s.fareAmount, { color: C.text }]}>{ride.distance_km?.toFixed(1) || '?'} km</Text>
          </View>
        </View>

        {/* Cancel button — only before trip starts */}
        {rideStatus !== 'ongoing' && (
          <TouchableOpacity style={s.cancelBtn} onPress={handleCancel} activeOpacity={0.7}>
            <Text style={s.cancelTxt}>Cancel Ride</Text>
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
    backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
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
});
