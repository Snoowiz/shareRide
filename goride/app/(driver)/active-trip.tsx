import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, Linking, Dimensions, Platform,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import AlertModal from '@/components/AlertModal';
import PaymentSettlementModal from '@/components/PaymentSettlementModal';
import PremiumVehicleMarker from '@/components/PremiumVehicleMarker';

const { width, height } = Dimensions.get('window');
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_APIKEY || '';

type TripPhase = 'heading_to_pickup' | 'arrived_at_pickup' | 'trip_in_progress';

const PHASE_CONFIG = {
  heading_to_pickup: { label: 'HEADING TO PICKUP', color: '#3B82F6', action: 'Arrived at Pickup', nextPhase: 'arrived_at_pickup' as TripPhase },
  arrived_at_pickup: { label: 'WAITING FOR RIDER', color: '#F59E0B', action: 'Start Trip', nextPhase: 'trip_in_progress' as TripPhase },
  trip_in_progress: { label: 'TRIP IN PROGRESS', color: '#22C55E', action: 'End Trip', nextPhase: null },
};

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

import SOSModal from '@/components/SOSModal';

export default function ActiveTripScreen() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const { authUser } = useAuth();
  const { colorScheme } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const isMounted = useRef(true);
  const locationWatcher = useRef<Location.LocationSubscription | null>(null);

  const isDark = colorScheme === 'dark';
  const C = Colors[colorScheme];

  const [phase, setPhase] = useState<TripPhase>('heading_to_pickup');
  const [ride, setRide] = useState<any>(null);
  const [rider, setRider] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number; heading?: number } | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string }>({ distance: '', duration: '' });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [sosVisible, setSosVisible] = useState(false);
  const [showSettlement, setShowSettlement] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    onConfirm?: () => void;
    confirmText?: string;
    showCancel?: boolean;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  // Subscribe to real-time ride status updates (for rider cancellations)
  useEffect(() => {
    if (!rideId) return;
    const channel = supabase
      .channel(`active-trip-status-${rideId}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rides',
        filter: `id=eq.${rideId}`,
      }, (payload) => {
        if (payload.new.status === 'cancelled') {
          setAlertConfig({
            visible: true,
            title: 'Ride Cancelled',
            message: 'The rider has cancelled this trip. You will be redirected to the home screen.',
            type: 'error',
            confirmText: 'Go Home',
            onConfirm: () => router.replace('/(driver)/(tabs)')
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rideId]);

  // Fetch ride details
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

        // Fetch rider profile
        const { data: riderData } = await supabase
          .from('profiles')
          .select('first_name, last_name, avatar_url, phone')
          .eq('id', rideData.rider_id)
          .single();

        if (riderData) setRider(riderData);
      } catch (err) {
        console.error('Error fetching ride:', err);
        setAlertConfig({
          visible: true,
          title: 'Error',
          message: 'Could not load trip details.',
          type: 'error',
          onConfirm: () => router.back()
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [rideId]);

  // Fetch wallet balance
  useEffect(() => {
    if (!authUser?.id) return;
    (async () => {
      const { data } = await supabase.from('wallets').select('balance').eq('id', authUser.id).single();
      if (data) setWalletBalance(parseFloat(data.balance) || 0);
    })();
  }, [authUser?.id]);

  // Start GPS streaming
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const lastLoc = await Location.getLastKnownPositionAsync({});
      if (lastLoc) {
        setDriverLocation({ latitude: lastLoc.coords.latitude, longitude: lastLoc.coords.longitude });
      }

      locationWatcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 3000 },
        (loc) => {
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, heading: loc.coords.heading || 0 };
          setDriverLocation(coords);
          // Update available_drivers with live position
          if (authUser?.id) {
            supabase.from('available_drivers').update({
              latitude: coords.latitude,
              longitude: coords.longitude,
              heading: coords.heading,
              last_updated: new Date().toISOString(),
            }).eq('id', authUser.id).then(() => {});
          }
        }
      );
    })();

    return () => {
      isMounted.current = false;
      locationWatcher.current?.remove();
    };
  }, []);

  const pickup = ride ? { latitude: ride.pickup_lat, longitude: ride.pickup_lng } : null;
  const destination = ride ? { latitude: ride.destination_lat, longitude: ride.destination_lng } : null;
  const riderName = rider ? `${rider.first_name} ${rider.last_name || ''}`.trim() : 'Rider';
  const riderPhone = rider?.phone || null;

  // Current route: driver→pickup (before pickup) or pickup→destination (during trip)
  // Memoize coordinates to prevent infinite render loops with MapViewDirections
  const routeOrigin = React.useMemo(() => {
    if (!driverLocation && !pickup) return null;
    return phase === 'trip_in_progress' ? pickup : driverLocation;
  }, [phase, driverLocation?.latitude, driverLocation?.longitude, pickup?.latitude, pickup?.longitude]);

  const routeDestination = React.useMemo(() => {
    return phase === 'trip_in_progress' ? destination : pickup;
  }, [phase, pickup?.latitude, pickup?.longitude, destination?.latitude, destination?.longitude]);

  const handlePhaseAction = async () => {
    if (!ride) return;
    setActionLoading(true);

    try {
      const config = PHASE_CONFIG[phase];

      if (phase === 'heading_to_pickup') {
        // Driver arrived at pickup
        setPhase('arrived_at_pickup');
      } else if (phase === 'arrived_at_pickup') {
        // Start the trip — update ride status to 'ongoing'
        const { error } = await supabase
          .from('rides')
          .update({ status: 'ongoing', updated_at: new Date().toISOString() })
          .eq('id', ride.id);
        if (error) throw error;
        setPhase('trip_in_progress');
      } else if (phase === 'trip_in_progress') {
        // End the trip — show payment settlement (status stays 'ongoing' until payment settles)
        // The PaymentSettlementModal will atomically update status to 'completed' + payment_status to 'settled'
        setShowSettlement(true);
      }
    } catch (err: any) {
      console.error('Phase action error:', err);
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: 'Something went wrong. Please try again.',
        type: 'error'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCall = () => {
    if (riderPhone) {
      Linking.openURL(`tel:${riderPhone}`);
    } else {
      setAlertConfig({
        visible: true,
        title: 'Unavailable',
        message: "Rider's phone number is not available.",
        type: 'info'
      });
    }
  };

  const fitMapToRoute = useCallback(() => {
    if (!mapRef.current || !pickup || !driverLocation) return;
    const coords = phase === 'trip_in_progress' && destination
      ? [pickup, destination]
      : [driverLocation, pickup];
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 120, right: 60, bottom: height * 0.45, left: 60 },
      animated: true,
    });
  }, [pickup, destination, driverLocation, phase]);

  useEffect(() => {
    let timer: any;
    if (ride && driverLocation && isMounted.current) {
      timer = setTimeout(fitMapToRoute, 500);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [ride, driverLocation, phase]);

  if (loading || !ride) {
    return (
      <View style={[s.loadingContainer, { backgroundColor: C.background }]}>
        <ActivityIndicator size="large" color={Colors.driver.primary} />
        <Text style={[s.loadingText, { color: C.textMuted }]}>Loading trip...</Text>
      </View>
    );
  }

  const phaseConfig = PHASE_CONFIG[phase];

  return (
    <View style={s.root}>
      {/* Map */}
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={StyleSheet.absoluteFillObject}
        customMapStyle={isDark ? darkMapStyle : []}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {/* Driver marker */}
        {driverLocation && (
          <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <PremiumVehicleMarker heading={driverLocation.heading || 0} />
          </Marker>
        )}

        {/* Pickup marker */}
        {pickup && (
          <Marker coordinate={pickup}>
            <View style={s.pickupMarker}>
              <Ionicons name="person" size={16} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Destination marker */}
        {destination && phase === 'trip_in_progress' && (
          <Marker coordinate={destination}>
            <View style={s.destMarker}>
              <Ionicons name="flag" size={16} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Route line */}
        {routeOrigin && routeDestination && (
          <MapViewDirections
            origin={routeOrigin}
            destination={routeDestination}
            apikey={GOOGLE_API_KEY}
            strokeWidth={5}
            strokeColor={phaseConfig.color}
            optimizeWaypoints
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
        <TouchableOpacity
          style={[s.backButton, { backgroundColor: C.surface }]}
          onPress={() => {
            // Block navigation during payment settlement
            if (showSettlement) return;
            setAlertConfig({
              visible: true,
              title: 'Leave Trip?',
              message: 'Are you sure? The trip is still active.',
              type: 'warning',
              showCancel: true,
              onConfirm: () => router.back()
            });
          }}
        >
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>

        {/* Phase badge */}
        <View style={[s.phaseBadge, { backgroundColor: phaseConfig.color }]}>
          <Text style={s.phaseBadgeText}>{phaseConfig.label}</Text>
        </View>

        <TouchableOpacity style={[s.backButton, { backgroundColor: '#FEF2F2' }]} onPress={() => setSosVisible(true)}>
          <Ionicons name="shield-half" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <SOSModal isVisible={sosVisible} onClose={() => setSosVisible(false)} rideId={rideId} />

      {/* Bottom Card */}
      <View style={[s.bottomCard, { backgroundColor: C.surface }]}>
        {/* Route info strip */}
        <View style={[s.routeStrip, { backgroundColor: phaseConfig.color + '15' }]}>
          <Ionicons name="navigate" size={16} color={phaseConfig.color} />
          <Text style={[s.routeStripText, { color: phaseConfig.color }]}>
            {routeInfo.distance} · {routeInfo.duration} {phase === 'trip_in_progress' ? 'to destination' : 'to pickup'}
          </Text>
        </View>

        {/* Rider info */}
        <View style={s.riderRow}>
          <View style={s.riderLeft}>
            {rider?.avatar_url ? (
              <Image source={{ uri: rider.avatar_url }} style={s.riderAvatar} />
            ) : (
              <View style={[s.riderAvatar, { backgroundColor: Colors.brand.primary + '30' }]}>
                <Ionicons name="person" size={22} color={Colors.brand.primary} />
              </View>
            )}
            <View>
              <Text style={[s.riderName, { color: C.text }]}>{riderName}</Text>
              <Text style={[s.riderSub, { color: C.textMuted }]}>
                {ride.ride_type} · ₦{(ride.fare || 0).toLocaleString()}
              </Text>
            </View>
          </View>
          <View style={s.actionIcons}>
            <TouchableOpacity style={[s.iconBtn, { backgroundColor: C.surfaceAlt }]} onPress={handleCall}>
              <Ionicons name="call" size={20} color="#22C55E" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[s.iconBtn, { backgroundColor: C.surfaceAlt }]}
              onPress={() => router.push(`/chat?rideId=${ride.id}&otherUserId=${ride.rider_id}&type=ride`)}
            >
              <Ionicons name="chatbubble-ellipses" size={20} color="#3B82F6" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Addresses */}
        <View style={s.addressSection}>
          <View style={s.addressRow}>
            <View style={[s.dot, { backgroundColor: '#22C55E' }]} />
            <Text style={[s.addressText, { color: C.textSecondary }]} numberOfLines={1}>
              {ride.pickup_address || 'Pickup location'}
            </Text>
          </View>
          <View style={[s.addressLine, { borderColor: C.border }]} />
          <View style={s.addressRow}>
            <View style={[s.dot, { backgroundColor: '#EF4444' }]} />
            <Text style={[s.addressText, { color: C.textSecondary }]} numberOfLines={1}>
              {ride.destination_address || 'Destination'}
            </Text>
          </View>
        </View>

        {/* Action button */}
        <TouchableOpacity
          style={[s.phaseButton, { backgroundColor: phaseConfig.color }]}
          onPress={handlePhaseAction}
          disabled={actionLoading}
          activeOpacity={0.85}
        >
          {actionLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.phaseButtonText}>{phaseConfig.action}</Text>
          )}
        </TouchableOpacity>
      </View>
      <AlertModal
        isVisible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        showCancel={alertConfig.showCancel}
        onConfirm={alertConfig.onConfirm}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />

      {/* Payment Settlement Modal */}
      {ride && (
        <PaymentSettlementModal
          isVisible={showSettlement}
          fareAmount={parseFloat(ride.fare) || 0}
          rideId={ride.id}
          driverWalletBalance={walletBalance}
          driverEmail={authUser?.email || ''}
          driverName={authUser ? `${authUser.firstName} ${authUser.lastName}` : 'Driver'}
          driverId={authUser?.id || ''}
          onSettlementComplete={(method, newBalance) => {
            setShowSettlement(false);
            setWalletBalance(newBalance);
            // Navigate to rating screen after settlement
            router.replace(`/rate-trip?rideId=${ride.id}&role=driver&otherUserId=${ride.rider_id}`);
          }}
          onClose={() => {}}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 15 },

  driverMarker: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FCCA14', alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4 },
      android: { elevation: 6 },
    }),
  },
  pickupMarker: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff',
  },
  destMarker: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff',
  },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  phaseBadge: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  phaseBadgeText: {
    color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 0.5,
  },

  bottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: 34, paddingTop: 4,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.12, shadowRadius: 12 },
      android: { elevation: 16 },
    }),
  },
  routeStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 16, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
  },
  routeStripText: { fontWeight: '700', fontSize: 13 },

  riderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 16,
  },
  riderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  riderAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  riderName: { fontSize: 17, fontWeight: '700' },
  riderSub: { fontSize: 13, marginTop: 2 },

  actionIcons: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },

  addressSection: { paddingHorizontal: 20, marginBottom: 20 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  addressLine: {
    width: 2, height: 20, marginLeft: 4, borderLeftWidth: 2,
    borderStyle: 'dashed',
  },
  addressText: { fontSize: 14, flex: 1 },

  phaseButton: {
    marginHorizontal: 20, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  phaseButtonText: {
    color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3,
  },
});
