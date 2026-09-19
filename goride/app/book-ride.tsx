import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Dimensions, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Modal from 'react-native-modal';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as Localization from 'expo-localization';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import LottieView from 'lottie-react-native';
import AlertModal from '@/components/AlertModal';
// MapView conditionally loaded for native only
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}
import MapViewDirections from 'react-native-maps-directions';

import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_APIKEY || '';
const { height } = Dimensions.get('window');

type RideType = {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  seats: number;
  baseFare: number;
  pricePerKm: number;
  pricePerMin: number;
  etaMins: number; // base ETA offset
};

const RIDE_TYPES: RideType[] = [
  { id: 'mini', name: 'Mini', icon: 'car-sport', seats: 3, baseFare: 500, pricePerKm: 120, pricePerMin: 25, etaMins: 5 },
  { id: 'sedan', name: 'Sedan', icon: 'car', seats: 4, baseFare: 800, pricePerKm: 180, pricePerMin: 40, etaMins: 8 },
  { id: 'xl', name: 'GoXL', icon: 'bus', seats: 6, baseFare: 1200, pricePerKm: 250, pricePerMin: 60, etaMins: 12 },
];

const formatCurrency = (amount: number) => {
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export default function BookRideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme, currentLocation, currentAddress, destinationLocation, destinationAddress } = useAppContext();
  const { authUser } = useAuth();
  const isDark = colorScheme === 'dark';
  const C = Colors[colorScheme];
  const mapRef = useRef<any>(null);

  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [durationMins, setDurationMins] = useState<number>(0);
  const [selectedRide, setSelectedRide] = useState<RideType>(RIDE_TYPES[0]);
  const [surgeMultiplier, setSurgeMultiplier] = useState<number>(1.0);
  
  const [isScheduleVisible, setScheduleVisible] = useState(false);
  const [scheduleTime, setScheduleTime] = useState<'Now' | string>('Now');

  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedHour, setSelectedHour] = useState(new Date().getHours() % 12 || 12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(new Date().getHours() >= 12 ? 'PM' : 'AM');

  // Generate next 7 days dynamically
  const nextDays = React.useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return {
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        fullDate: d
      };
    });
  }, []);

  const [isBidVisible, setBidVisible] = useState(false);
  const [bidAmount, setBidAmount] = useState<number>(0);

  const [isSearching, setIsSearching] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [isCancelSuccessVisible, setIsCancelSuccessVisible] = useState(false);
  const [isScheduleSuccessVisible, setIsScheduleSuccessVisible] = useState(false);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);

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

  // Pulse animation for searching
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (isSearching) {
      pulse.value = withRepeat(withTiming(1.4, { duration: 1500 }), -1, true);
    } else {
      pulse.value = 1;
    }
  }, [isSearching]);

  // Real-time listener for ride status
  useEffect(() => {
    let channel: any;
    let cancelTimeout: any;

    if (isSearching && currentRideId) {
      channel = supabase
        .channel(`ride-${currentRideId}`)
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'rides',
          filter: `id=eq.${currentRideId}` 
        }, (payload) => {
          if (payload.new.status === 'accepted') {
            setIsSearching(false);
            clearTimeout(cancelTimeout);
            // Navigate to rider's trip progress screen
            router.replace(`/trip-progress?rideId=${currentRideId}`);
          } else if (payload.new.status === 'cancelled') {
            setIsSearching(false);
            clearTimeout(cancelTimeout);
            setAlertConfig({
              visible: true,
              title: 'Ride Cancelled',
              message: 'This ride has been cancelled by the driver or system.',
              type: 'warning'
            });
          }
        })
        .subscribe();

      // Auto-close searching UI after 10 seconds (don't cancel ride, just leave it broadcasting)
      cancelTimeout = setTimeout(() => {
        if (currentRideId) {
          setIsSearching(false);
          setAlertConfig({
            visible: true,
            title: 'Finding Driver',
            message: 'We are broadcasting your request to nearby drivers. You will be notified once a driver is found.',
            type: 'info',
            confirmText: 'View Rides',
            onConfirm: () => router.replace('/(user)/(tabs)/rides')
          });
        }
      }, 10000); // 10 seconds
    }
    return () => {
      if (channel) supabase.removeChannel(channel);
      clearTimeout(cancelTimeout);
    };
  }, [isSearching, currentRideId]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 1.4 - pulse.value,
  }));

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = React.useMemo(() => ['35%', '70%'], []);

  // Recalculate bid when distance/duration/ride changes
  useEffect(() => {
    const fetchSurge = async () => {
      if (currentLocation) {
        try {
          const { data: surgeMult } = await supabase.rpc('get_surge_multiplier', {
            pickup_lat: currentLocation.latitude,
            pickup_lng: currentLocation.longitude,
          });
          if (surgeMult) setSurgeMultiplier(parseFloat(surgeMult));
        } catch (e) {
          console.warn('Could not fetch surge pricing:', e);
        }
      }
    };
    fetchSurge();
  }, [currentLocation]);

  useEffect(() => {
    if (distanceKm > 0 && durationMins > 0) {
      const calculated = (selectedRide.baseFare + (distanceKm * selectedRide.pricePerKm) + (durationMins * selectedRide.pricePerMin)) * surgeMultiplier;
      // Round to nearest 50 Naira for clean pricing
      setBidAmount(Math.round(calculated / 50) * 50);
    }
  }, [distanceKm, durationMins, selectedRide, surgeMultiplier]);

  useEffect(() => {
    if (!currentLocation || !destinationLocation) {
      // If accessed directly without setting location, go back
      router.back();
    }
  }, [currentLocation, destinationLocation]);

  const mapStyle = colorScheme === 'dark' ? [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  ] : [];

  if (!currentLocation || !destinationLocation) return null;

  const handleBook = async () => {
    if (!authUser || !currentLocation || !destinationLocation) return;
    
    setIsBooking(true);
    try {
      // Check for existing active rides
      const { data: activeRide, error: activeErr } = await supabase
        .from('rides')
        .select('id')
        .eq('rider_id', authUser.id)
        .in('status', ['searching', 'accepted', 'ongoing'])
        .maybeSingle();

      if (activeErr) throw activeErr;

      if (activeRide) {
        setAlertConfig({
          visible: true,
          title: 'Active Ride Found',
          message: 'You already have an active ride. Please complete or cancel it before requesting a new one.',
          type: 'warning',
          confirmText: 'View Ride',
          onConfirm: () => {
            setAlertConfig(prev => ({ ...prev, visible: false }));
            router.replace(`/trip-progress?rideId=${activeRide.id}`);
          }
        });
        setIsBooking(false);
        return;
      }

      const finalFare = isBidVisible ? bidAmount : Math.round((selectedRide.baseFare + (distanceKm * selectedRide.pricePerKm) + (durationMins * selectedRide.pricePerMin)) / 50) * 50;

      const { data, error } = await supabase
        .from('rides')
        .insert({
          rider_id: authUser.id,
          pickup_lat: currentLocation.latitude,
          pickup_lng: currentLocation.longitude,
          pickup_address: currentAddress,
          destination_lat: destinationLocation.latitude,
          destination_lng: destinationLocation.longitude,
          destination_address: destinationAddress,
          ride_type: selectedRide.name,
          fare: finalFare,
          distance_km: distanceKm,
          duration_mins: durationMins,
          status: scheduleTime !== 'Now' ? 'scheduled' : 'searching',
          surge_multiplier: surgeMultiplier,
          is_scheduled: scheduleTime !== 'Now',
          scheduled_at: scheduleTime !== 'Now' ? new Date(scheduleTime).toISOString() : null,
        })
        .select()
        .single();

      if (error) throw error;

      if (scheduleTime !== 'Now') {
        // Scheduled ride logic
        setIsScheduleSuccessVisible(true);
      } else {
        // Immediate ride logic
        setCurrentRideId(data.id);
        setIsSearching(true);
      }

    } catch (err: any) {
      console.error(err);
      setAlertConfig({
        visible: true,
        title: 'Booking Error',
        message: 'Failed to create ride request. Please try again.',
        type: 'error'
      });
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancelRide = async () => {
    if (!currentRideId) return;
    
    try {
      const { error } = await supabase
        .from('rides')
        .update({ status: 'cancelled' })
        .eq('id', currentRideId);

      if (error) throw error;
      
      setIsSearching(false);
      setCurrentRideId(null);
      setIsCancelSuccessVisible(true);
    } catch (err: any) {
      console.error(err);
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: 'Failed to cancel ride. Please try again.',
        type: 'error'
      });
    }
  };

  return (
    <View style={s.root}>
      {/* Map Background */}
      <View style={s.mapContainer}>
        {Platform.OS === 'web' ? (
          <View style={[s.mapLoading, { backgroundColor: C.surfaceAlt }]}>
            <Text style={{ color: C.textMuted }}>Map not supported on Web.</Text>
          </View>
        ) : MapView ? (
          <MapView
            ref={mapRef}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            style={StyleSheet.absoluteFillObject}
            customMapStyle={mapStyle}
            initialRegion={{
              ...currentLocation,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            <Marker coordinate={currentLocation}>
              <View style={[s.pinCircle, { backgroundColor: C.tint }]}>
                <View style={s.pinInner} />
              </View>
            </Marker>
            <Marker coordinate={destinationLocation}>
              <Ionicons name="location" size={32} color={Colors.brand.secondary} />
            </Marker>

            <MapViewDirections
              origin={currentLocation}
              destination={destinationLocation}
              apikey={GOOGLE_API_KEY}
              strokeWidth={4}
              strokeColor={C.tint}
              onReady={(result) => {
                setDistanceKm(result.distance);
                setDurationMins(result.duration);
                mapRef.current?.fitToCoordinates(result.coordinates, {
                  edgePadding: {
                    right: 50,
                    bottom: height * 0.5,
                    left: 50,
                    top: 100,
                  },
                  animated: true,
                });
              }}
            />
          </MapView>
        ) : (
          <View style={[s.mapLoading, { backgroundColor: C.surfaceAlt }]}>
            <ActivityIndicator size="large" color={C.tint} />
          </View>
        )}
      </View>

      {/* Floating Back Button */}
      <TouchableOpacity
        style={[s.floatingBack, { backgroundColor: C.surface, top: insets.top + 10 }]}
        activeOpacity={0.8}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={24} color={C.text} />
      </TouchableOpacity>

      {/* Bottom Sheet Modal */}
      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        handleIndicatorStyle={{ backgroundColor: C.border }}
        backgroundStyle={{ backgroundColor: C.background }}
      >
        <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
          
          {/* Location Summary */}
          <View style={[s.locationCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={s.locRow}>
              <View style={s.locIconWrap}>
                <View style={[s.dot, { borderColor: C.text }]} />
              </View>
              <Text style={[s.locText, { color: C.textSecondary }]} numberOfLines={1}>{currentAddress}</Text>
            </View>
            <View style={s.locLineWrap}>
              <View style={[s.locLine, { backgroundColor: C.border }]} />
            </View>
            <View style={s.locRow}>
              <View style={s.locIconWrap}>
                <Ionicons name="location-sharp" size={16} color={Colors.brand.secondary} />
              </View>
              <Text style={[s.locText, { color: C.text }]} numberOfLines={1}>{destinationAddress}</Text>
              {distanceKm > 0 && (
                <View style={[s.distBadge, { backgroundColor: C.surfaceAlt }]}>
                  <Text style={[s.distTxt, { color: C.textMuted }]}>{distanceKm.toFixed(1)} km</Text>
                </View>
              )}
            </View>
          </View>

          {/* Schedule Picker */}
          <TouchableOpacity 
            style={[s.scheduleCard, { backgroundColor: C.surface, borderColor: C.border }]}
            activeOpacity={0.7}
            onPress={() => setScheduleVisible(true)}
          >
            <Ionicons name="time-outline" size={20} color={Colors.brand.secondary} style={{ marginRight: 12 }} />
            <Text style={[s.scheduleTxt, { color: C.text }]}>
              {scheduleTime === 'Now' ? 'Now' : new Date(scheduleTime).toLocaleDateString() + ' ' + new Date(scheduleTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
          </TouchableOpacity>

          {/* Ride Types */}
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: C.text, marginBottom: 0 }]}>Select Ride Type</Text>
            {bidAmount > 0 && (
              <TouchableOpacity style={s.bidToggleBtn} onPress={() => setBidVisible(!isBidVisible)}>
                <MaterialCommunityIcons name="gavel" size={20} color={Colors.brand.secondary} />
                <Text style={[s.bidToggleTxt, { color: Colors.brand.secondary }]}>Offer Fare</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={s.rideTypesRow}>
            {RIDE_TYPES.map((ride) => {
              const isSelected = selectedRide.id === ride.id;
              const calculated = ride.baseFare + (distanceKm * ride.pricePerKm) + (durationMins * ride.pricePerMin);
              const eta = durationMins ? Math.ceil(durationMins) + ride.etaMins : ride.etaMins;

              return (
                <TouchableOpacity
                  key={ride.id}
                  activeOpacity={0.8}
                  onPress={() => setSelectedRide(ride)}
                  style={[
                    s.rideCard,
                    { backgroundColor: C.surface, borderColor: isSelected ? Colors.brand.secondary : C.border }
                  ]}
                >
                  {isSelected && (
                    <View style={s.checkBadge}>
                      <Ionicons name="checkmark-circle" size={20} color={Colors.brand.secondary} />
                    </View>
                  )}
                  <Ionicons name={ride.icon} size={32} color={C.text} style={s.rideIcon} />
                  <Text style={[s.rideEta, { color: C.textSecondary }]}>{eta} Min</Text>
                  <View style={s.rideDivider} />
                  <View style={s.rideInfoRow}>
                    <Text style={[s.rideName, { color: C.text }]}>
                      {ride.name} {surgeMultiplier > 1 && <Ionicons name="flash" size={14} color={Colors.brand.primary} />}
                    </Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.ridePrice, { color: Colors.brand.secondary }]}>
                        {distanceKm > 0 ? formatCurrency(calculated) : formatCurrency(ride.baseFare * surgeMultiplier)}
                      </Text>
                      {surgeMultiplier > 1 && (
                        <Text style={{ fontSize: 10, color: Colors.brand.primary, fontWeight: 'bold' }}>
                          {surgeMultiplier}x SURGE
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text style={[s.rideSeats, { color: C.textMuted }]}>{ride.seats} Seats Capacity</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Bidding UI */}
          {isBidVisible && bidAmount > 0 && (
            <View style={[s.bidContainer, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Text style={[s.bidLabel, { color: C.text }]}>Your Suggested Fare</Text>
              <View style={s.bidControlsRow}>
                <TouchableOpacity 
                  style={[s.bidCtrlBtn, { backgroundColor: C.surfaceAlt }]}
                  onPress={() => setBidAmount(prev => Math.max(selectedRide.baseFare, prev - 100))}
                >
                  <Ionicons name="remove" size={24} color={C.text} />
                </TouchableOpacity>
                
                <Text style={[s.bidAmountTxt, { color: Colors.brand.secondary }]}>{formatCurrency(bidAmount)}</Text>
                
                <TouchableOpacity 
                  style={[s.bidCtrlBtn, { backgroundColor: C.surfaceAlt }]}
                  onPress={() => setBidAmount(prev => prev + 100)}
                >
                  <Ionicons name="add" size={24} color={C.text} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Payment & Promo */}
          <View style={s.optionsGroup}>
            <TouchableOpacity style={[s.optionRow, { backgroundColor: C.surface, borderColor: C.border }]}>
              <MaterialCommunityIcons name="cash" size={20} color={Colors.brand.secondary} style={{ marginRight: 12 }} />
              <Text style={[s.optionTxt, { color: C.text }]}>Cash</Text>
              <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={[s.optionRow, { backgroundColor: C.surface, borderColor: C.border }]}>
              <MaterialCommunityIcons name="ticket-percent" size={20} color={Colors.brand.secondary} style={{ marginRight: 12 }} />
              <Text style={[s.optionTxt, { color: C.text }]}>Apply Promo</Text>
              <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
            </TouchableOpacity>
          </View>

        </BottomSheetScrollView>

        {/* Book Action */}
        <View style={[s.bookActionWrap, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity
            style={[s.bookBtn, { backgroundColor: Colors.brand.secondary, opacity: isBooking ? 0.7 : 1 }]}
            activeOpacity={0.8}
            onPress={handleBook}
            disabled={isBooking}
          >
            {isBooking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.bookBtnTxt}>
                {isBidVisible ? `Bid ${formatCurrency(bidAmount)}` : `Book ${selectedRide.name}`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Searching Pop-up Modal */}
      <Modal
        isVisible={isSearching}
        backdropOpacity={0.7}
        backdropColor={isDark ? '#000' : '#333'}
        animationIn="zoomIn"
        animationOut="zoomOut"
        useNativeDriver
        style={s.searchPopupModal}
      >
        <View style={[s.searchPopupContent, { backgroundColor: C.background }]}>
          <View style={s.pulseContainer}>
            <Animated.View style={[s.pulse, { backgroundColor: Colors.brand.secondary + '30' }, pulseStyle]} />
            <View style={[s.pulseInner, { backgroundColor: Colors.brand.secondary }]}>
              <Ionicons name="car" size={44} color="#fff" />
            </View>
          </View>
          
          <Text style={[s.searchTitle, { color: C.text }]}>Searching for Drivers...</Text>
          <Text style={[s.searchSub, { color: C.textSecondary }]}>
            Broadcasting your request to nearby drivers in Lagos
          </Text>
          
          <View style={[s.searchDetailsPopup, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
             <View style={[s.searchDetailItem, { borderRightWidth: 1, borderRightColor: C.border }]}>
                <Text style={[s.searchDetailVal, { color: C.text }]}>{selectedRide.name}</Text>
                <Text style={[s.searchDetailLab, { color: C.textMuted }]}>Type</Text>
             </View>
             <View style={s.searchDetailItem}>
                <Text style={[s.searchDetailVal, { color: Colors.brand.secondary }]}>{formatCurrency(bidAmount)}</Text>
                <Text style={[s.searchDetailLab, { color: C.textMuted }]}>Price</Text>
             </View>
          </View>

          <TouchableOpacity 
            style={[s.cancelSearchBtnPopup, { borderColor: Colors.brand.danger + '60' }]}
            onPress={handleCancelRide}
          >
            <Text style={[s.cancelSearchTxt, { color: Colors.brand.danger }]}>Cancel Request</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Cancellation Success Modal */}
      <Modal
        isVisible={isCancelSuccessVisible}
        onBackdropPress={() => setIsCancelSuccessVisible(false)}
        backdropOpacity={0.8}
        animationIn="zoomIn"
        animationOut="zoomOut"
        useNativeDriver
        style={s.cancelSuccessModal}
      >
        <View style={[s.cancelSuccessContent, { backgroundColor: C.background }]}>
           <LottieView 
             source={require('@/assets/lottie/cancel.json')}
             autoPlay
             loop={false}
             style={{ width: 180, height: 180 }}
           />
           <Text style={[s.cancelSuccessTitle, { color: C.text }]}>Ride Cancelled</Text>
           <Text style={[s.cancelSuccessSub, { color: C.textSecondary }]}>
             Your request has been successfully removed.
           </Text>
           <TouchableOpacity 
             style={[s.doneBtn, { backgroundColor: Colors.brand.secondary }]}
             onPress={() => setIsCancelSuccessVisible(false)}
           >
             <Text style={s.doneBtnTxt}>Okay</Text>
           </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        isVisible={isScheduleSuccessVisible}
        onBackdropPress={() => {
          setIsScheduleSuccessVisible(false);
          router.push('/(user)/(tabs)/rides');
        }}
        backdropOpacity={0.8}
        animationIn="zoomIn"
        animationOut="zoomOut"
        useNativeDriver
        style={s.cancelSuccessModal}
      >
        <View style={[s.cancelSuccessContent, { backgroundColor: C.background }]}>
           <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.brand.secondary + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
             <Ionicons name="calendar-outline" size={40} color={Colors.brand.secondary} />
           </View>
           <Text style={[s.cancelSuccessTitle, { color: C.text }]}>Ride Scheduled!</Text>
           <Text style={[s.cancelSuccessSub, { color: C.textSecondary }]}>
             {scheduleTime !== 'Now' ? `Your driver will arrive on ${new Date(scheduleTime).toLocaleDateString()} at ${new Date(scheduleTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : 'Your ride is scheduled.'}
             {"\n\n"}We'll notify you when a driver is assigned.
           </Text>
           <TouchableOpacity 
             style={[s.doneBtn, { backgroundColor: Colors.brand.secondary }]}
             onPress={() => {
               setIsScheduleSuccessVisible(false);
               router.push('/(user)/(tabs)/rides');
             }}
           >
             <Text style={s.doneBtnTxt}>View Rides</Text>
           </TouchableOpacity>
        </View>
      </Modal>

      {/* Schedule Modal */}
      <Modal
        isVisible={isScheduleVisible}
        onBackdropPress={() => setScheduleVisible(false)}
        onSwipeComplete={() => setScheduleVisible(false)}
        swipeDirection="down"
        style={s.modal}
      >
        <View style={[s.modalContent, { backgroundColor: C.background, paddingBottom: insets.bottom || 20 }]}>
          <View style={[s.dragHandle, { backgroundColor: C.border }]} />
          
          <View style={s.modalHeader}>
            <Text style={[s.modalTitle, { color: C.text }]}>Schedule Ride</Text>
            <TouchableOpacity onPress={() => { setScheduleTime('Now'); setScheduleVisible(false); }}>
              <Text style={[s.modalActionTxt, { color: Colors.brand.secondary }]}>RIDE NOW</Text>
            </TouchableOpacity>
          </View>

          <View style={[s.divider, { backgroundColor: C.border }]} />

          <Text style={[s.modalSectionLabel, { color: C.text }]}>Select Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dateScroll}>
            {nextDays.map((day, i) => {
              const isSelected = selectedDateIndex === i;
              return (
                <TouchableOpacity 
                  key={i} 
                  activeOpacity={0.7}
                  onPress={() => setSelectedDateIndex(i)}
                  style={[s.dateBox, { backgroundColor: C.surface, borderColor: isSelected ? Colors.brand.secondary : C.border }]}
                >
                  <Text style={[s.dateDayTxt, { color: C.textSecondary }]}>{day.dayName}</Text>
                  <Text style={[s.dateNumTxt, { color: C.text }]}>{day.dayNum}</Text>
                  <Text style={[s.dateMonthTxt, { color: C.textSecondary }]}>{day.month}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[s.modalSectionLabel, { color: C.text, marginTop: 24 }]}>Select Time</Text>
          
          {/* Hour Selector */}
          <Text style={[s.timeSubLabel, { color: C.textSecondary }]}>Hour</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dateScroll}>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(hr => {
              const isSelected = selectedHour === hr;
              return (
                <TouchableOpacity 
                  key={hr} 
                  activeOpacity={0.7}
                  onPress={() => setSelectedHour(hr)}
                  style={[s.timePill, { backgroundColor: isSelected ? Colors.brand.secondary : C.surface, borderColor: isSelected ? Colors.brand.secondary : C.border }]}
                >
                  <Text style={[s.timePillTxt, { color: isSelected ? '#fff' : C.text }]}>{hr.toString().padStart(2, '0')}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Minute Selector */}
          <Text style={[s.timeSubLabel, { color: C.textSecondary, marginTop: 16 }]}>Minute</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dateScroll}>
            {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(min => {
              const isSelected = selectedMinute === min;
              return (
                <TouchableOpacity 
                  key={min} 
                  activeOpacity={0.7}
                  onPress={() => setSelectedMinute(min)}
                  style={[s.timePill, { backgroundColor: isSelected ? Colors.brand.secondary : C.surface, borderColor: isSelected ? Colors.brand.secondary : C.border }]}
                >
                  <Text style={[s.timePillTxt, { color: isSelected ? '#fff' : C.text }]}>{min.toString().padStart(2, '0')}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Period Selector */}
          <Text style={[s.timeSubLabel, { color: C.textSecondary, marginTop: 16 }]}>Period</Text>
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 32 }}>
            {['AM', 'PM'].map(period => {
              const isSelected = selectedPeriod === period;
              return (
                <TouchableOpacity 
                  key={period} 
                  activeOpacity={0.7}
                  onPress={() => setSelectedPeriod(period as 'AM'|'PM')}
                  style={[s.periodPill, { backgroundColor: isSelected ? Colors.brand.secondary : C.surface, borderColor: isSelected ? Colors.brand.secondary : C.border }]}
                >
                  <Text style={[s.timePillTxt, { color: isSelected ? '#fff' : C.text }]}>{period}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[s.confirmBtn, { backgroundColor: Colors.brand.secondary }]}
            activeOpacity={0.8}
            onPress={() => {
              const d = new Date(nextDays[selectedDateIndex].fullDate);
              const hour24 = selectedPeriod === 'PM' ? (selectedHour === 12 ? 12 : selectedHour + 12) : (selectedHour === 12 ? 0 : selectedHour);
              d.setHours(hour24, selectedMinute, 0, 0);

              const diffMs = d.getTime() - Date.now();
              if (diffMs < 10 * 60 * 1000) {
                setAlertConfig({
                  visible: true,
                  title: 'Invalid Time',
                  message: 'Please select a time at least 10 minutes from now.',
                  type: 'warning'
                });
                return;
              }

              setScheduleTime(d.toISOString());
              setScheduleVisible(false);
            }}
          >
            <Text style={s.confirmBtnTxt}>Confirm</Text>
          </TouchableOpacity>
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

const s = StyleSheet.create({
  root: { flex: 1 },
  mapContainer: { flex: 1 },
  mapLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pinCircle: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  pinInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  
  floatingBack: {
    position: 'absolute',
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  locationCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locIconWrap: {
    width: 20,
    alignItems: 'center',
    marginRight: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  locText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  locLineWrap: {
    height: 16,
    marginLeft: 9,
    justifyContent: 'center',
  },
  locLine: { width: 1, height: 16 },
  distBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distTxt: { fontSize: 11, fontWeight: '600' },

  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
  },
  scheduleTxt: { flex: 1, fontSize: 15, fontWeight: '600' },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  rideTypesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  rideCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 2,
    padding: 16,
    position: 'relative',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  rideIcon: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  rideEta: {
    textAlign: 'center',
    fontSize: 12,
    marginBottom: 12,
  },
  rideDivider: {
    height: 1,
    backgroundColor: '#00000010',
    marginBottom: 12,
  },
  rideInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rideName: {
    fontSize: 16,
    fontWeight: '800',
  },
  ridePrice: {
    fontSize: 13,
    fontWeight: '700',
  },
  rideSeats: {
    fontSize: 11,
    fontWeight: '500',
  },

  optionsGroup: {
    gap: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  optionTxt: { flex: 1, fontSize: 15, fontWeight: '600' },

  bookActionWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  bookBtn: {
    paddingVertical: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookBtnTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bidToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ffb34715',
  },
  bidToggleTxt: {
    fontSize: 13,
    fontWeight: '700',
  },
  bidContainer: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  bidLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  bidControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  bidCtrlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bidAmountTxt: {
    fontSize: 24,
    fontWeight: '800',
  },

  /* Modal Styles */
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalActionTxt: { fontSize: 14, fontWeight: '700' },
  divider: { height: 1, marginBottom: 20 },
  
  modalSectionLabel: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  
  dateScroll: { gap: 12 },
  dateBox: {
    width: 64,
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDayTxt: { fontSize: 12, marginBottom: 2 },
  dateNumTxt: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  dateMonthTxt: { fontSize: 12 },

  timeSubLabel: { fontSize: 13, marginLeft: 20, marginBottom: 8, fontWeight: '600' },
  timePill: { width: 60, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  periodPill: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  timePillTxt: { fontSize: 16, fontWeight: '700' },

  confirmBtn: {
    paddingVertical: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  confirmBtnTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  /* Search Modal Styles */
  searchPopupModal: {
    margin: 20,
    justifyContent: 'center',
  },
  searchPopupContent: {
    borderRadius: 30,
    padding: 30,
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  pulseContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pulse: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  pulseInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: Colors.brand.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  searchTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  searchSub: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  searchDetailsPopup: {
    flexDirection: 'row',
    width: '100%',
    padding: 20,
    borderRadius: 20,
    marginBottom: 32,
  },
  searchDetailItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  searchDetailVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  searchDetailLab: {
    fontSize: 12,
    fontWeight: '600',
  },
  cancelSearchBtnPopup: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    width: '100%',
    alignItems: 'center',
  },
  cancelSearchTxt: {
    fontSize: 16,
    fontWeight: '700',
  },
  /* Cancel Success Modal */
  cancelSuccessModal: {
    margin: 30,
    justifyContent: 'center',
  },
  cancelSuccessContent: {
    borderRadius: 30,
    padding: 30,
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  cancelSuccessTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: -20,
    marginBottom: 8,
    textAlign: 'center',
  },
  cancelSuccessSub: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 10,
    lineHeight: 22,
  },
  doneBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
