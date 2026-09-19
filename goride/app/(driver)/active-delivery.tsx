import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, Linking, Dimensions, Platform, ScrollView,
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
import Modal from 'react-native-modal';
import PremiumVehicleMarker from '@/components/PremiumVehicleMarker';

const { width, height } = Dimensions.get('window');
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_APIKEY || '';

type DeliveryPhase = 'heading_to_sender' | 'arrived_at_sender' | 'picked_up' | 'in_transit' | 'arrived_at_receiver';

const PHASE_CONFIG: Record<DeliveryPhase, { label: string; color: string; action: string; icon: string; dbStatus: string }> = {
  heading_to_sender:   { label: 'HEADING TO SENDER',    color: '#3B82F6', action: 'Arrived at Pickup',   icon: 'navigate',         dbStatus: 'accepted' },
  arrived_at_sender:   { label: 'AT SENDER LOCATION',   color: '#F59E0B', action: 'Picked Up Parcel',    icon: 'cube',             dbStatus: 'accepted' },
  picked_up:           { label: 'PARCEL COLLECTED',      color: '#8B5CF6', action: 'Start Delivery',      icon: 'checkmark-circle', dbStatus: 'picked_up' },
  in_transit:          { label: 'DELIVERING PARCEL',     color: '#22C55E', action: 'Arrived at Receiver', icon: 'bicycle',          dbStatus: 'in_transit' },
  arrived_at_receiver: { label: 'AT RECEIVER LOCATION',  color: '#EC4899', action: 'Confirm Delivery',   icon: 'flag',             dbStatus: 'in_transit' },
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

export default function ActiveDeliveryScreen() {
  const { deliveryId } = useLocalSearchParams<{ deliveryId: string }>();
  const { authUser } = useAuth();
  const { colorScheme } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const isMounted = useRef(true);
  const locationWatcher = useRef<Location.LocationSubscription | null>(null);

  const isDark = colorScheme === 'dark';
  const C = Colors[colorScheme];

  const [phase, setPhase] = useState<DeliveryPhase>('heading_to_sender');
  const [delivery, setDelivery] = useState<any>(null);
  const [sender, setSender] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number; heading?: number } | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string }>({ distance: '', duration: '' });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showSettlement, setShowSettlement] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  // Custom Alert State
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

  // Subscribe to real-time delivery status updates (for sender cancellations)
  useEffect(() => {
    if (!deliveryId) return;
    const channel = supabase
      .channel(`active-delivery-status-${deliveryId}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'deliveries',
        filter: `id=eq.${deliveryId}`,
      }, (payload) => {
        if (payload.new.status === 'cancelled') {
          setAlertConfig({
            visible: true,
            title: 'Delivery Cancelled',
            message: 'The sender has cancelled this delivery. You will be redirected to the home screen.',
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
  }, [deliveryId]);

  // ─── Fetch delivery details ────────────────────────────────
  useEffect(() => {
    if (!deliveryId) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('deliveries')
          .select('*')
          .eq('id', deliveryId)
          .single();

        if (error || !data) throw error || new Error('Delivery not found');
        setDelivery(data);

        // Fetch wallet balance
        if (authUser?.id) {
          const { data: walletData } = await supabase.from('wallets').select('balance').eq('id', authUser.id).single();
          if (walletData) setWalletBalance(parseFloat(walletData.balance) || 0);
        }

        // Set phase based on current DB status
        if (data.status === 'in_transit') {
          setPhase(data.picked_up_at ? 'in_transit' : 'heading_to_sender');
        } else if (data.status === 'picked_up') {
          setPhase('picked_up');
        }

        // Fetch sender (rider) profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, avatar_url, phone')
          .eq('id', data.rider_id)
          .single();

        if (profile) setSender(profile);
      } catch (err) {
        console.error('Error fetching delivery:', err);
        setAlertConfig({
          visible: true,
          title: 'Error',
          message: 'Could not load delivery details.',
          type: 'error',
          confirmText: 'Go Back',
          onConfirm: () => router.back()
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [deliveryId]);

  // ─── GPS streaming ────────────────────────────────────────
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

  // ─── Map coordinates ──────────────────────────────────────
  const senderLoc = delivery
    ? { latitude: delivery.sender_lat, longitude: delivery.sender_lng }
    : null;
  const receiverLoc = delivery
    ? { latitude: delivery.receiver_lat, longitude: delivery.receiver_lng }
    : null;

  const isBeforePickup = phase === 'heading_to_sender' || phase === 'arrived_at_sender';

  // Memoize coordinates to prevent infinite render loops with MapViewDirections
  const routeOrigin = React.useMemo(() => {
    if (!driverLocation && !senderLoc) return null;
    return isBeforePickup ? driverLocation : (driverLocation || senderLoc);
  }, [isBeforePickup, driverLocation?.latitude, driverLocation?.longitude, senderLoc?.latitude, senderLoc?.longitude]);

  const routeDestination = React.useMemo(() => {
    return isBeforePickup ? senderLoc : receiverLoc;
  }, [isBeforePickup, senderLoc?.latitude, senderLoc?.longitude, receiverLoc?.latitude, receiverLoc?.longitude]);

  const displayFare = delivery?.offer_fare && delivery.offer_fare > 0
    ? delivery.offer_fare
    : delivery?.fare || 0;

  // ─── Phase action handler ─────────────────────────────────
  const handlePhaseAction = async () => {
    if (!delivery) return;
    setActionLoading(true);

    try {
      if (phase === 'heading_to_sender') {
        setPhase('arrived_at_sender');
      } else if (phase === 'arrived_at_sender') {
        // Mark as picked up in DB
        const { error } = await supabase
          .from('deliveries')
          .update({ status: 'picked_up', picked_up_at: new Date().toISOString() })
          .eq('id', delivery.id);
        if (error) throw error;
        setDelivery({ ...delivery, status: 'picked_up', picked_up_at: new Date().toISOString() });
        setPhase('picked_up');
      } else if (phase === 'picked_up') {
        // Start transit
        const { error } = await supabase
          .from('deliveries')
          .update({ status: 'in_transit' })
          .eq('id', delivery.id);
        if (error) throw error;
        setDelivery({ ...delivery, status: 'in_transit' });
        setPhase('in_transit');
      } else if (phase === 'in_transit') {
        setPhase('arrived_at_receiver');
      } else if (phase === 'arrived_at_receiver') {
        // Confirm delivery — show payment settlement (status stays in_transit until payment settles)
        // The PaymentSettlementModal will atomically update status to 'delivered' + payment_status to 'settled'
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

  // ─── Contact helpers ──────────────────────────────────────
  const handleCallSender = () => {
    if (delivery?.sender_phone) {
      Linking.openURL(`tel:${delivery.sender_phone}`);
    } else {
      setAlertConfig({
        visible: true,
        title: 'Unavailable',
        message: "Sender's phone number is not available.",
        type: 'warning'
      });
    }
  };

  const handleCallReceiver = () => {
    if (delivery?.receiver_phone) {
      Linking.openURL(`tel:${delivery.receiver_phone}`);
    } else {
      setAlertConfig({
        visible: true,
        title: 'Unavailable',
        message: "Receiver's phone number is not available.",
        type: 'warning'
      });
    }
  };

  // ─── Map fitting ──────────────────────────────────────────
  const fitMapToRoute = useCallback(() => {
    if (!mapRef.current || !senderLoc || !driverLocation) return;
    const coords = isBeforePickup
      ? [driverLocation, senderLoc]
      : receiverLoc ? [driverLocation, receiverLoc] : [driverLocation, senderLoc];
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 120, right: 60, bottom: height * 0.55, left: 60 },
      animated: true,
    });
  }, [senderLoc, receiverLoc, driverLocation, isBeforePickup]);

  useEffect(() => {
    let timer: any;
    if (delivery && driverLocation && isMounted.current) {
      timer = setTimeout(fitMapToRoute, 500);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [delivery, driverLocation, phase]);

  // ─── Loading state ────────────────────────────────────────
  if (loading || !delivery) {
    return (
      <View style={[s.loadingContainer, { backgroundColor: C.background }]}>
        <ActivityIndicator size="large" color={Colors.driver.primary} />
        <Text style={[s.loadingText, { color: C.textMuted }]}>Loading delivery...</Text>
      </View>
    );
  }

  const phaseConfig = PHASE_CONFIG[phase];

  // ─── Progress steps ───────────────────────────────────────
  const phases: DeliveryPhase[] = ['heading_to_sender', 'arrived_at_sender', 'picked_up', 'in_transit', 'arrived_at_receiver'];
  const currentPhaseIndex = phases.indexOf(phase);

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
            <PremiumVehicleMarker heading={driverLocation.heading || 0} isBike={true} />
          </Marker>
        )}

        {/* Sender (pickup) marker */}
        {senderLoc && (
          <Marker coordinate={senderLoc}>
            <View style={s.senderMarker}>
              <Ionicons name="arrow-up" size={14} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Receiver (dropoff) marker */}
        {receiverLoc && !isBeforePickup && (
          <Marker coordinate={receiverLoc}>
            <View style={s.receiverMarker}>
              <Ionicons name="arrow-down" size={14} color="#fff" />
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
          style={[s.topBtn, { backgroundColor: C.surface }]}
        onPress={() => {
          // Block navigation during payment settlement
          if (showSettlement) return;
          setAlertConfig({
            visible: true,
            title: 'Leave Delivery?',
            message: 'Are you sure? The delivery is still active.',
            type: 'warning',
            showCancel: true,
            confirmText: 'Leave',
            onConfirm: () => router.back()
          });
        }}
        >
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>

        {/* Phase badge */}
        <View style={[s.phaseBadge, { backgroundColor: phaseConfig.color }]}>
          <Ionicons name={phaseConfig.icon as any} size={14} color="#fff" style={{ marginRight: 6 }} />
          <Text style={s.phaseBadgeText}>{phaseConfig.label}</Text>
        </View>

        <TouchableOpacity
          style={[s.topBtn, { backgroundColor: C.surface }]}
          onPress={fitMapToRoute}
        >
          <Ionicons name="locate" size={20} color={Colors.brand.primary} />
        </TouchableOpacity>
      </View>

      {/* Bottom Card */}
      <View style={[s.bottomCard, { backgroundColor: C.surface }]}>
        {/* Progress tracker */}
        <View style={s.progressRow}>
          {phases.map((p, i) => (
            <React.Fragment key={p}>
              <View style={[
                s.progressDot,
                {
                  backgroundColor: i <= currentPhaseIndex ? phaseConfig.color : C.border,
                  width: i === currentPhaseIndex ? 12 : 8,
                  height: i === currentPhaseIndex ? 12 : 8,
                },
              ]} />
              {i < phases.length - 1 && (
                <View style={[
                  s.progressLine,
                  { backgroundColor: i < currentPhaseIndex ? phaseConfig.color : C.border },
                ]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Route info strip */}
        <View style={[s.routeStrip, { backgroundColor: phaseConfig.color + '15' }]}>
          <Ionicons name="navigate" size={16} color={phaseConfig.color} />
          <Text style={[s.routeStripText, { color: phaseConfig.color }]}>
            {routeInfo.distance} · {routeInfo.duration}{' '}
            {isBeforePickup ? 'to sender' : 'to receiver'}
          </Text>
        </View>

        {/* Parcel info chips */}
        <View style={s.parcelRow}>
          <View style={[s.chip, { backgroundColor: C.surfaceAlt }]}>
            <Ionicons name="cube-outline" size={14} color={Colors.brand.primary} />
            <Text style={[s.chipTxt, { color: C.text }]}>{delivery.parcel_type}</Text>
          </View>
          <View style={[s.chip, { backgroundColor: C.surfaceAlt }]}>
            <Ionicons name="scale-outline" size={14} color={Colors.brand.primary} />
            <Text style={[s.chipTxt, { color: C.text }]}>{delivery.parcel_weight}kg</Text>
          </View>
          <View style={[s.chip, { backgroundColor: Colors.brand.secondary + '15' }]}>
            <MaterialCommunityIcons name="cash" size={14} color={Colors.brand.secondary} />
            <Text style={[s.chipTxt, { color: Colors.brand.secondary, fontWeight: '800' }]}>
              ₦{displayFare.toLocaleString()}
            </Text>
          </View>
          {delivery.parcel_image_url && (
            <TouchableOpacity 
              style={[s.chip, { backgroundColor: Colors.brand.primary + '15' }]}
              onPress={() => setPreviewImage(delivery.parcel_image_url)}
            >
              <Ionicons name="image-outline" size={14} color={Colors.brand.primary} />
              <Text style={[s.chipTxt, { color: Colors.brand.primary, fontWeight: '800' }]}>Item Preview</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Contact cards: Sender & Receiver */}
        <View style={s.contactsRow}>
          {/* Sender */}
          <View style={[s.contactCard, { backgroundColor: C.surfaceAlt, borderColor: isBeforePickup ? phaseConfig.color + '40' : C.border }]}>
            <View style={[s.contactDot, { backgroundColor: '#22C55E' }]}>
              <Ionicons name="arrow-up" size={10} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.contactLabel, { color: C.textMuted }]}>Sender</Text>
              <Text style={[s.contactName, { color: C.text }]} numberOfLines={1}>{delivery.sender_name}</Text>
              <Text style={[s.contactAddr, { color: C.textMuted }]} numberOfLines={1}>{delivery.sender_address}</Text>
            </View>
            <TouchableOpacity style={[s.callBtn, { backgroundColor: '#22C55E20' }]} onPress={handleCallSender}>
              <Ionicons name="call" size={16} color="#22C55E" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[s.callBtn, { backgroundColor: Colors.brand.primary + '20', marginLeft: 8 }]} 
              onPress={() => router.push(`/chat?rideId=${deliveryId}&otherUserId=${delivery.rider_id}&type=delivery`)}
            >
              <Ionicons name="chatbubble-ellipses" size={16} color={Colors.brand.primary} />
            </TouchableOpacity>
          </View>

          {/* Receiver */}
          <View style={[s.contactCard, { backgroundColor: C.surfaceAlt, borderColor: !isBeforePickup ? phaseConfig.color + '40' : C.border }]}>
            <View style={[s.contactDot, { backgroundColor: Colors.brand.primary }]}>
              <Ionicons name="arrow-down" size={10} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.contactLabel, { color: C.textMuted }]}>Receiver</Text>
              <Text style={[s.contactName, { color: C.text }]} numberOfLines={1}>{delivery.receiver_name}</Text>
              <Text style={[s.contactAddr, { color: C.textMuted }]} numberOfLines={1}>{delivery.receiver_address}</Text>
            </View>
            <TouchableOpacity style={[s.callBtn, { backgroundColor: Colors.brand.primary + '20' }]} onPress={handleCallReceiver}>
              <Ionicons name="call" size={16} color={Colors.brand.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Payment info */}
        <View style={[s.paymentRow, { backgroundColor: C.surfaceAlt }]}>
          <View style={s.paymentLeft}>
            <MaterialCommunityIcons
              name={delivery.payment_method === 'cash' ? 'cash' : 'wallet'}
              size={18}
              color={Colors.brand.secondary}
            />
            <Text style={[s.paymentTxt, { color: C.text }]}>
              {delivery.payment_method === 'cash' ? 'Cash' : 'Wallet'} · {delivery.payer_type === 'sender' ? 'Sender pays' : 'Receiver pays'}
            </Text>
          </View>
          {delivery.offer_fare && delivery.offer_fare !== delivery.fare && (
            <View style={[s.bidTag, { backgroundColor: Colors.brand.secondary + '20' }]}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: Colors.brand.secondary }}>BID</Text>
            </View>
          )}
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
            <View style={s.phaseButtonInner}>
              <Ionicons name={phaseConfig.icon as any} size={20} color="#fff" />
              <Text style={s.phaseButtonText}>{phaseConfig.action}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <AlertModal
        isVisible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        confirmText={alertConfig.confirmText}
        cancelText={alertConfig.showCancel ? "Stay" : undefined}
        onConfirm={alertConfig.onConfirm}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />

      {/* Payment Settlement Modal */}
      {delivery && (
        <PaymentSettlementModal
          isVisible={showSettlement}
          fareAmount={parseFloat(displayFare) || 0}
          deliveryId={delivery.id}
          driverWalletBalance={walletBalance}
          driverEmail={authUser?.email || ''}
          driverName={authUser ? `${authUser.firstName} ${authUser.lastName}` : 'Driver'}
          driverId={authUser?.id || ''}
          onSettlementComplete={(method, newBalance) => {
            setShowSettlement(false);
            setWalletBalance(newBalance);
            router.replace('/(driver)/(tabs)/earn');
          }}
          onClose={() => {}}
        />
      )}

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
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' }}>
            <TouchableOpacity 
              style={{ position: 'absolute', top: insets.top + 20, right: 20, zIndex: 10 }}
              onPress={() => setPreviewImage(null)}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={28} color="#fff" />
              </View>
            </TouchableOpacity>
            <Image 
              source={{ uri: previewImage }} 
              style={{ width: width * 0.9, height: height * 0.6, borderRadius: 20 }} 
              resizeMode="contain" 
            />
            <Text style={{ color: '#fff', marginTop: 20, fontSize: 16, fontWeight: '600' }}>Parcel Item Preview</Text>
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

  driverMarker: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FCCA14', alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4 },
      android: { elevation: 6 },
    }),
  },
  senderMarker: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff',
  },
  receiverMarker: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#0F346E', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff',
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
  phaseBadgeText: {
    color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 0.5,
  },

  bottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: 34, paddingTop: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.12, shadowRadius: 12 },
      android: { elevation: 16 },
    }),
  },

  // Progress tracker
  progressRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, marginTop: 8, marginBottom: 12,
  },
  progressDot: { borderRadius: 6 },
  progressLine: { flex: 1, height: 3, borderRadius: 1.5, marginHorizontal: 4 },

  routeStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
  },
  routeStripText: { fontWeight: '700', fontSize: 13 },

  // Parcel chips
  parcelRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  chipTxt: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },

  // Contact cards
  contactsRow: { gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 14, borderWidth: 1.5,
  },
  contactDot: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  contactLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  contactName: { fontSize: 14, fontWeight: '700', marginTop: 1 },
  contactAddr: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  callBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },

  // Payment row
  paymentRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 20, marginBottom: 14, paddingHorizontal: 14,
    paddingVertical: 10, borderRadius: 10,
  },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paymentTxt: { fontSize: 13, fontWeight: '600' },
  bidTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },

  // Phase button
  phaseButton: {
    marginHorizontal: 20, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  phaseButtonInner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  phaseButtonText: {
    color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3,
  },
});
