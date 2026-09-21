import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Dimensions, ActivityIndicator, TextInput } from 'react-native';
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

type PromoCoupon = {
  id: number;
  code: string;
  title: string | null;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_percentage: number | null;
  discount_amount: number | null;
  max_discount_amount: number | null;
  min_ride_fare: number | null;
  banner_image_url: string | null;
  bg_color: string | null;
  text_color: string | null;
  valid_from: string | null;
  valid_until: string | null;
  usage_limit: number | null;
  times_used: number | null;
  per_user_limit: number | null;
};

type DynamicRideType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon_name: string;
  image_url: string | null;
  passenger_capacity: number;
  base_fare: number;
  price_per_km: number;
  price_per_min: number;
  minimum_fare: number;
  estimated_pickup_mins: number;
  supports_shared_rides: boolean;
  shared_discount_percentage: number;
  display_order: number;
  is_active: boolean;
  calculated_fare?: number;
  shared_fare?: number;
  available_drivers_count?: number;
  is_available?: boolean;
};

const FALLBACK_RIDE_TYPES: DynamicRideType[] = [
  { id: 'mini', code: 'mini', name: 'Mini', description: 'Affordable, compact rides', icon_name: 'car-sport', image_url: null, passenger_capacity: 3, base_fare: 500, price_per_km: 120, price_per_min: 25, minimum_fare: 500, estimated_pickup_mins: 5, supports_shared_rides: false, shared_discount_percentage: 0, display_order: 1, is_active: true, is_available: false, available_drivers_count: 0 },
  { id: 'sedan', code: 'sedan', name: 'Sedan', description: 'Comfortable standard sedans', icon_name: 'car', image_url: null, passenger_capacity: 4, base_fare: 800, price_per_km: 180, price_per_min: 40, minimum_fare: 800, estimated_pickup_mins: 8, supports_shared_rides: true, shared_discount_percentage: 20, display_order: 2, is_active: true, is_available: false, available_drivers_count: 0 },
  { id: 'xl', code: 'xl', name: 'GoXL', description: 'Spacious for groups or luggage', icon_name: 'bus', image_url: null, passenger_capacity: 6, base_fare: 1200, price_per_km: 250, price_per_min: 60, minimum_fare: 1200, estimated_pickup_mins: 12, supports_shared_rides: true, shared_discount_percentage: 25, display_order: 3, is_active: true, is_available: false, available_drivers_count: 0 },
];

const formatCurrency = (amount: number) => {
  return `₦${Math.round(amount).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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

  // Dynamic Backend Ride Types
  const [rideTypes, setRideTypes] = useState<DynamicRideType[]>(FALLBACK_RIDE_TYPES);
  const [loadingRideTypes, setLoadingRideTypes] = useState<boolean>(true);
  const [selectedRide, setSelectedRide] = useState<DynamicRideType>(FALLBACK_RIDE_TYPES[0]);
  const [isSharedRide, setIsSharedRide] = useState<boolean>(false);
  const [passengerCount, setPassengerCount] = useState<number>(1);
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

  // Rider Price Adjustment / Bargaining Settings
  const [adjSettings, setAdjSettings] = useState<{
    enabled: boolean;
    max_downward_percent: number;
    max_upward_percent: number;
  }>({
    enabled: true,
    max_downward_percent: 10,
    max_upward_percent: 20,
  });
  const [isBidVisible, setBidVisible] = useState(false);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [bidInputText, setBidInputText] = useState<string>('');

  const [isSearching, setIsSearching] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [isCancelSuccessVisible, setIsCancelSuccessVisible] = useState(false);
  const [isScheduleSuccessVisible, setIsScheduleSuccessVisible] = useState(false);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);

  // Promo Coupon State
  const [appliedCoupon, setAppliedCoupon] = useState<PromoCoupon | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [isPromoModalVisible, setIsPromoModalVisible] = useState(false);
  const [promoInputCode, setPromoInputCode] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<PromoCoupon[]>([]);

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

  const calculateCouponDiscount = useCallback((coupon: PromoCoupon, fare: number): number => {
    let disc = 0;
    if (coupon.discount_type === 'percentage') {
      const pct = coupon.discount_percentage || 0;
      disc = Math.round((fare * pct) / 100);
      if (coupon.max_discount_amount && disc > coupon.max_discount_amount) {
        disc = coupon.max_discount_amount;
      }
    } else {
      disc = coupon.discount_amount || 0;
    }
    return Math.min(fare, Math.max(0, disc));
  }, []);

  const fetchAvailableCoupons = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('is_active', true)
        .or(`valid_from.is.null,valid_from.lte.${now}`)
        .or(`valid_until.is.null,valid_until.gte.${now}`)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAvailableCoupons(data as PromoCoupon[]);
      }
    } catch (e) {
      console.warn('Failed to fetch available coupons:', e);
    }
  }, []);

  // Dynamic Admin Price Adjustment Settings Fetcher
  const fetchPriceAdjustmentSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_price_adjustment_settings');
      if (!error && data) {
        setAdjSettings({
          enabled: Boolean(data.enabled),
          max_downward_percent: Number(data.max_downward_percent) || 0,
          max_upward_percent: Number(data.max_upward_percent) || 0,
        });
      }
    } catch (err) {
      console.warn('Failed to load price adjustment settings:', err);
    }
  }, []);

  useEffect(() => {
    fetchPriceAdjustmentSettings();

    const channel = supabase
      .channel('public-settings-price-adj-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settings' },
        () => fetchPriceAdjustmentSettings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPriceAdjustmentSettings]);

  useEffect(() => {
    fetchAvailableCoupons();
  }, [fetchAvailableCoupons]);

  // Authoritative dynamic ride types fetcher
  const fetchAvailableRideTypes = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_available_ride_types_with_pricing', {
        p_distance_km: distanceKm || 0,
        p_duration_mins: durationMins || 0,
      });

      if (!error && data && data.length > 0) {
        // Sort available ride types to always come first before unavailable ones
        const sortedData = [...(data as DynamicRideType[])].sort((a, b) => {
          const aAvail = (a.is_available ?? ((a.available_drivers_count || 0) > 0)) ? 1 : 0;
          const bAvail = (b.is_available ?? ((b.available_drivers_count || 0) > 0)) ? 1 : 0;
          if (bAvail !== aAvail) return bAvail - aAvail;
          return (a.display_order || 0) - (b.display_order || 0);
        });

        setRideTypes(sortedData);
        setSelectedRide(prev => {
          // If previous selection is still available, keep it
          const matching = sortedData.find((r: DynamicRideType) => 
            (r.id === prev?.id || r.code === prev?.code) && (r.is_available ?? ((r.available_drivers_count || 0) > 0))
          );
          if (matching) return matching;

          // Otherwise auto-select the first available ride type
          const firstAvailable = sortedData.find((r: DynamicRideType) => 
            (r.is_available ?? ((r.available_drivers_count || 0) > 0))
          );
          return firstAvailable || sortedData[0];
        });
      }
    } catch (err) {
      console.warn('Error loading dynamic ride types:', err);
    } finally {
      setLoadingRideTypes(false);
    }
  }, [distanceKm, durationMins]);

  useEffect(() => {
    fetchAvailableRideTypes();

    // Subscribe to driver availability and active rides changes for live real-time sync
    const channel = supabase
      .channel('public-ride-types-availability-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'available_drivers' },
        () => fetchAvailableRideTypes()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides' },
        () => fetchAvailableRideTypes()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ride_types' },
        () => fetchAvailableRideTypes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAvailableRideTypes]);

  const platformEstimatedFare = React.useMemo(() => {
    if (isSharedRide && selectedRide.supports_shared_rides && selectedRide.shared_fare) {
      return selectedRide.shared_fare;
    }
    return selectedRide.calculated_fare ?? Math.round((selectedRide.base_fare + (distanceKm * selectedRide.price_per_km) + (durationMins * selectedRide.price_per_min)) / 50) * 50;
  }, [isSharedRide, selectedRide, distanceKm, durationMins]);

  const minAllowedFare = React.useMemo(() => {
    if (!adjSettings.enabled) return platformEstimatedFare;
    const downPct = Math.min(100, Math.max(0, adjSettings.max_downward_percent));
    const rawMin = Math.round((platformEstimatedFare * (1.0 - downPct / 100.0)) / 50) * 50;
    const floorMin = selectedRide.minimum_fare || 0;
    return Math.max(floorMin, rawMin);
  }, [platformEstimatedFare, adjSettings, selectedRide]);

  const maxAllowedFare = React.useMemo(() => {
    if (!adjSettings.enabled) return platformEstimatedFare;
    const upPct = Math.max(0, adjSettings.max_upward_percent);
    return Math.round((platformEstimatedFare * (1.0 + upPct / 100.0)) / 50) * 50;
  }, [platformEstimatedFare, adjSettings]);

  const isBidOutOfRange = isBidVisible && adjSettings.enabled && (
    !bidAmount || isNaN(Number(bidAmount)) || Number(bidAmount) < minAllowedFare || Number(bidAmount) > maxAllowedFare
  );

  const computedFareBeforeDiscount = isBidVisible && adjSettings.enabled && bidAmount > 0 && !isBidOutOfRange
    ? bidAmount 
    : platformEstimatedFare;

  useEffect(() => {
    if (appliedCoupon) {
      if (appliedCoupon.min_ride_fare && computedFareBeforeDiscount < appliedCoupon.min_ride_fare) {
        setAppliedCoupon(null);
        setDiscountAmount(0);
        setAlertConfig({
          visible: true,
          title: 'Coupon Removed',
          message: `This coupon requires a minimum fare of ${formatCurrency(appliedCoupon.min_ride_fare)}.`,
          type: 'info'
        });
      } else {
        const disc = calculateCouponDiscount(appliedCoupon, computedFareBeforeDiscount);
        setDiscountAmount(disc);
      }
    }
  }, [selectedRide, distanceKm, durationMins, bidAmount, isBidVisible, isSharedRide, appliedCoupon, calculateCouponDiscount, computedFareBeforeDiscount]);

  const handleApplyCouponCode = async (codeToValidate?: string) => {
    const rawCode = (codeToValidate || promoInputCode).trim().toUpperCase();
    if (!rawCode) {
      setPromoError('Please enter a coupon code.');
      return;
    }
    setPromoError(null);
    setIsValidatingPromo(true);

    try {
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .ilike('code', rawCode)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !coupon) {
        setPromoError('Invalid or inactive coupon code.');
        setIsValidatingPromo(false);
        return;
      }

      const now = new Date();
      if (coupon.valid_from && new Date(coupon.valid_from) > now) {
        setPromoError('This coupon is not yet active.');
        setIsValidatingPromo(false);
        return;
      }

      if (coupon.valid_until && new Date(coupon.valid_until) < now) {
        setPromoError('This coupon has expired.');
        setIsValidatingPromo(false);
        return;
      }

      if (coupon.usage_limit && coupon.times_used >= coupon.usage_limit) {
        setPromoError('This coupon has reached its total usage limit.');
        setIsValidatingPromo(false);
        return;
      }

      if (coupon.min_ride_fare && computedFareBeforeDiscount < coupon.min_ride_fare) {
        setPromoError(`Minimum ride fare of ${formatCurrency(coupon.min_ride_fare)} required.`);
        setIsValidatingPromo(false);
        return;
      }

      // Check per-user limit
      if (authUser && (coupon.per_user_limit || 1) > 0) {
        const { count, error: countErr } = await supabase
          .from('user_coupons')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', authUser.id)
          .eq('coupon_id', coupon.id);

        if (!countErr && count !== null && count >= (coupon.per_user_limit || 1)) {
          setPromoError(`You have reached the maximum uses (${coupon.per_user_limit || 1}) for this coupon.`);
          setIsValidatingPromo(false);
          return;
        }
      }

      const disc = calculateCouponDiscount(coupon as PromoCoupon, computedFareBeforeDiscount);
      setAppliedCoupon(coupon as PromoCoupon);
      setDiscountAmount(disc);
      setIsPromoModalVisible(false);
      setPromoInputCode('');
      setAlertConfig({
        visible: true,
        title: 'Coupon Applied!',
        message: `Successfully applied code ${coupon.code}! You saved ${formatCurrency(disc)}.`,
        type: 'success',
      });
    } catch (e: any) {
      console.error(e);
      setPromoError('Unable to apply coupon. Please try again.');
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setDiscountAmount(0);
  };

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
        }, (payload: any) => {
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
    if (platformEstimatedFare > 0) {
      setBidAmount(prev => {
        if (!isBidVisible || prev <= 0 || prev < minAllowedFare || prev > maxAllowedFare) {
          setBidInputText(String(platformEstimatedFare));
          return platformEstimatedFare;
        }
        return prev;
      });
    }
  }, [platformEstimatedFare, isBidVisible, minAllowedFare, maxAllowedFare]);

  const handleStepBid = (delta: number) => {
    const current = Number(bidAmount) || platformEstimatedFare;
    const next = Math.round((current + delta) / 50) * 50;
    const clamped = Math.min(maxAllowedFare, Math.max(minAllowedFare, next));
    setBidAmount(clamped);
    setBidInputText(String(clamped));
  };

  const handleBidInputChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setBidInputText(cleaned);
    const val = parseInt(cleaned, 10);
    if (!isNaN(val)) {
      setBidAmount(val);
    } else {
      setBidAmount(0);
    }
  };

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
    
    // Validate that the ride type is currently available (has at least 1 online approved driver)
    const isAvail = selectedRide.is_available ?? ((selectedRide.available_drivers_count || 0) > 0);
    if (scheduleTime === 'Now' && !isAvail) {
      setAlertConfig({
        visible: true,
        title: 'Ride Type Unavailable',
        message: `There are currently zero online, approved drivers for ${selectedRide.name}. Please select an available ride type to continue.`,
        type: 'warning'
      });
      return;
    }

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

      const hasAdjustedFare = isBidVisible && adjSettings.enabled && bidAmount > 0 && bidAmount !== platformEstimatedFare;

      if (isBidVisible && adjSettings.enabled) {
        if (isBidOutOfRange) {
          setAlertConfig({
            visible: true,
            title: 'Invalid Proposed Fare',
            message: `Your proposed fare must be between ${formatCurrency(minAllowedFare)} and ${formatCurrency(maxAllowedFare)}.`,
            type: 'warning'
          });
          setIsBooking(false);
          return;
        }
      }

      // Call authoritative backend RPC for race-condition-safe booking & fare validation
      const { data: bookedRide, error: rpcError } = await supabase.rpc('book_ride_request', {
        p_rider_id: authUser.id,
        p_ride_type_id: selectedRide.id,
        p_pickup_lat: currentLocation.latitude,
        p_pickup_lng: currentLocation.longitude,
        p_pickup_address: currentAddress,
        p_destination_lat: destinationLocation.latitude,
        p_destination_lng: destinationLocation.longitude,
        p_destination_address: destinationAddress,
        p_distance_km: distanceKm || 0,
        p_duration_mins: durationMins || 0,
        p_is_scheduled: scheduleTime !== 'Now',
        p_scheduled_at: scheduleTime !== 'Now' ? new Date(scheduleTime).toISOString() : null,
        p_is_shared: isSharedRide && selectedRide.supports_shared_rides,
        p_passenger_count: passengerCount,
        p_coupon_id: appliedCoupon ? appliedCoupon.id : null,
        p_is_bid: hasAdjustedFare,
        p_bid_amount: hasAdjustedFare ? bidAmount : null,
      });

      if (rpcError) {
        setAlertConfig({
          visible: true,
          title: 'Booking Notice',
          message: rpcError.message || 'Unable to book this ride type. Please choose another option.',
          type: 'warning'
        });
        setIsBooking(false);
        return;
      }

      if (scheduleTime !== 'Now') {
        setIsScheduleSuccessVisible(true);
      } else {
        setCurrentRideId(bookedRide?.id);
        setIsSearching(true);
      }

    } catch (err: any) {
      console.error('Ride booking error:', err);
      setAlertConfig({
        visible: true,
        title: 'Booking Error',
        message: err.message || 'Failed to create ride request. Please try again.',
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
            style={StyleSheet.absoluteFill}
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
            {adjSettings.enabled && platformEstimatedFare > 0 && (
              <TouchableOpacity 
                style={[
                  s.bidToggleBtn,
                  isBidVisible && { backgroundColor: Colors.brand.secondary + '25', borderColor: Colors.brand.secondary, borderWidth: 1 }
                ]} 
                onPress={() => {
                  const nextVisible = !isBidVisible;
                  setBidVisible(nextVisible);
                  if (nextVisible) {
                    setBidAmount(platformEstimatedFare);
                    setBidInputText(String(platformEstimatedFare));
                  }
                }}
              >
                <MaterialCommunityIcons 
                  name={isBidVisible ? "close" : "gavel"} 
                  size={18} 
                  color={Colors.brand.secondary} 
                />
                <Text style={[s.bidToggleTxt, { color: Colors.brand.secondary }]}>
                  {isBidVisible ? "Cancel Offer" : "Offer Fare"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rideTypesRow}>
            {rideTypes.map((ride) => {
              const isSelected = selectedRide.id === ride.id;
              const isAvail = ride.is_available ?? ((ride.available_drivers_count || 0) > 0);
              const calculated = (isSharedRide && ride.supports_shared_rides && ride.shared_fare) 
                ? ride.shared_fare 
                : (ride.calculated_fare ?? Math.round((ride.base_fare + (distanceKm * ride.price_per_km) + (durationMins * ride.price_per_min)) / 50) * 50);
              const eta = durationMins ? Math.ceil(durationMins) + (ride.estimated_pickup_mins || 5) : (ride.estimated_pickup_mins || 5);

              return (
                <TouchableOpacity
                  key={ride.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (!isAvail) {
                      setAlertConfig({
                        visible: true,
                        title: 'Ride Type Unavailable',
                        message: `There are currently no online, approved drivers for ${ride.name} in your area. Please select an available option.`,
                        type: 'info'
                      });
                      return;
                    }
                    setSelectedRide(ride);
                  }}
                  style={[
                    s.rideCard,
                    { 
                      backgroundColor: C.surface, 
                      borderColor: isSelected ? Colors.brand.secondary : C.border,
                      opacity: isAvail ? 1 : 0.55
                    }
                  ]}
                >
                  {isSelected && isAvail && (
                    <View style={s.checkBadge}>
                      <Ionicons name="checkmark-circle" size={20} color={Colors.brand.secondary} />
                    </View>
                  )}
                  <Ionicons name={(ride.icon_name || 'car') as any} size={30} color={isAvail ? C.text : C.textMuted} style={s.rideIcon} />
                  <Text style={[s.rideEta, { color: C.textSecondary }]}>{eta} Min</Text>
                  
                  {isAvail ? (
                    <View style={s.availableBadge}>
                      <Text style={s.availableBadgeTxt}>{(ride.available_drivers_count || 1)} Available</Text>
                    </View>
                  ) : (
                    <View style={s.unavailableBadge}>
                      <Text style={s.unavailableBadgeTxt}>No Drivers</Text>
                    </View>
                  )}

                  <View style={s.rideDivider} />
                  <View style={s.rideInfoRow}>
                    <Text style={[s.rideName, { color: isAvail ? C.text : C.textMuted }]}>
                      {ride.name} {surgeMultiplier > 1 && <Ionicons name="flash" size={14} color={Colors.brand.primary} />}
                    </Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.ridePrice, { color: isAvail ? Colors.brand.secondary : C.textMuted }]}>
                        {formatCurrency(calculated)}
                      </Text>
                    </View>
                  </View>
                  <Text style={[s.rideSeats, { color: C.textMuted }]}>{ride.passenger_capacity} Seats</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Shared Ride Option Toggle */}
          {selectedRide.supports_shared_rides && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsSharedRide(!isSharedRide)}
              style={[
                s.sharedRideOptionCard,
                {
                  backgroundColor: isSharedRide ? (isDark ? '#1E293B' : '#EFF6FF') : C.surface,
                  borderColor: isSharedRide ? Colors.brand.secondary : C.border,
                }
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                <View style={[s.sharedIconWrap, { backgroundColor: Colors.brand.secondary + '20' }]}>
                  <Ionicons name="people" size={20} color={Colors.brand.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[s.sharedOptionTitle, { color: C.text }]}>Shared Ride</Text>
                    <View style={s.sharedDiscountBadge}>
                      <Text style={s.sharedDiscountBadgeTxt}>SAVE {selectedRide.shared_discount_percentage || 20}%</Text>
                    </View>
                  </View>
                  <Text style={[s.sharedOptionDesc, { color: C.textSecondary }]}>
                    Share your ride with others heading the same direction and save money.
                  </Text>
                </View>
              </View>
              <Ionicons 
                name={isSharedRide ? 'checkbox' : 'square-outline'} 
                size={24} 
                color={isSharedRide ? Colors.brand.secondary : C.textMuted} 
              />
            </TouchableOpacity>
          )}

          {/* Rider Price Adjustment / Bargaining UI */}
          {isBidVisible && adjSettings.enabled && (
            <View style={[s.bidContainer, { backgroundColor: C.surface, borderColor: isBidOutOfRange ? '#EF4444' : C.border }]}>
              {/* Header: Platform Estimate & Allowed Range Badge */}
              <View style={s.bidHeaderRow}>
                <View>
                  <Text style={[s.bidSubTitle, { color: C.textMuted }]}>Platform Estimate</Text>
                  <Text style={[s.bidPlatformPrice, { color: C.text }]}>{formatCurrency(platformEstimatedFare)}</Text>
                </View>
                <View style={[s.bidRangeBadge, { backgroundColor: isBidOutOfRange ? '#FEE2E2' : (isDark ? '#1E293B' : '#F1F5F9') }]}>
                  <Ionicons name="options-outline" size={14} color={isBidOutOfRange ? '#EF4444' : Colors.brand.secondary} />
                  <Text style={[s.bidRangeBadgeTxt, { color: isBidOutOfRange ? '#EF4444' : C.textSecondary }]}>
                    Limit: {formatCurrency(minAllowedFare)} – {formatCurrency(maxAllowedFare)}
                  </Text>
                </View>
              </View>

              <View style={s.bidDivider} />

              {/* Proposed Fare Controls */}
              <Text style={[s.bidLabel, { color: C.text }]}>Your Proposed Fare</Text>
              <View style={s.bidControlsRow}>
                <TouchableOpacity 
                  style={[
                    s.bidCtrlBtn, 
                    { backgroundColor: C.surfaceAlt },
                    bidAmount <= minAllowedFare && { opacity: 0.4 }
                  ]}
                  onPress={() => handleStepBid(-50)}
                  disabled={bidAmount <= minAllowedFare}
                >
                  <Ionicons name="remove" size={22} color={C.text} />
                </TouchableOpacity>
                
                <View style={[
                  s.bidInputWrap, 
                  { 
                    backgroundColor: C.background,
                    borderColor: isBidOutOfRange ? '#EF4444' : (bidAmount !== platformEstimatedFare ? Colors.brand.secondary : C.border)
                  }
                ]}>
                  <Text style={[s.bidCurrencySymbol, { color: Colors.brand.secondary }]}>₦</Text>
                  <TextInput
                    value={bidInputText}
                    onChangeText={handleBidInputChange}
                    keyboardType="number-pad"
                    maxLength={7}
                    style={[s.bidTextInput, { color: C.text }]}
                    selectTextOnFocus
                    placeholder="0"
                    placeholderTextColor={C.textMuted}
                  />
                </View>
                
                <TouchableOpacity 
                  style={[
                    s.bidCtrlBtn, 
                    { backgroundColor: C.surfaceAlt },
                    bidAmount >= maxAllowedFare && { opacity: 0.4 }
                  ]}
                  onPress={() => handleStepBid(50)}
                  disabled={bidAmount >= maxAllowedFare}
                >
                  <Ionicons name="add" size={22} color={C.text} />
                </TouchableOpacity>
              </View>

              {/* Status / Validation Feedback */}
              {isBidOutOfRange ? (
                <View style={s.bidWarningRow}>
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={s.bidWarningTxt}>
                    Offer must be between {formatCurrency(minAllowedFare)} and {formatCurrency(maxAllowedFare)}
                  </Text>
                </View>
              ) : bidAmount !== platformEstimatedFare ? (
                <View style={s.bidDiffRow}>
                  <Text style={[
                    s.bidDiffTxt, 
                    { color: bidAmount > platformEstimatedFare ? '#10B981' : Colors.brand.secondary }
                  ]}>
                    {bidAmount > platformEstimatedFare 
                      ? `+${formatCurrency(bidAmount - platformEstimatedFare)} (+${Math.round(((bidAmount - platformEstimatedFare) / platformEstimatedFare) * 100)}%) for faster pickup` 
                      : `-${formatCurrency(platformEstimatedFare - bidAmount)} (-${Math.round(((platformEstimatedFare - bidAmount) / platformEstimatedFare) * 100)}%) rider discount offer`}
                  </Text>
                </View>
              ) : (
                <Text style={[s.bidHintTxt, { color: C.textMuted }]}>
                  Use + / − or type directly to adjust within Admin limits (-{adjSettings.max_downward_percent}% / +{adjSettings.max_upward_percent}%)
                </Text>
              )}
            </View>
          )}

          {/* Payment & Promo */}
          <View style={s.optionsGroup}>
            <TouchableOpacity style={[s.optionRow, { backgroundColor: C.surface, borderColor: C.border }]}>
              <MaterialCommunityIcons name="cash" size={20} color={Colors.brand.secondary} style={{ marginRight: 12 }} />
              <Text style={[s.optionTxt, { color: C.text }]}>Cash</Text>
              <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
            </TouchableOpacity>

            {appliedCoupon ? (
              <View style={[s.appliedPromoCard, { backgroundColor: C.surface, borderColor: Colors.brand.secondary }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={[s.promoIconBadge, { backgroundColor: Colors.brand.secondary + '20' }]}>
                    <MaterialCommunityIcons name="ticket-percent" size={20} color={Colors.brand.secondary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[s.appliedCodeTxt, { color: C.text }]}>{appliedCoupon.code}</Text>
                      <View style={[s.appliedActiveBadge, { backgroundColor: '#10B98120' }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#10B981' }}>APPLIED</Text>
                      </View>
                    </View>
                    <Text style={[s.appliedDiscTxt, { color: '#10B981' }]}>
                      Saved {formatCurrency(discountAmount)} ({appliedCoupon.discount_type === 'percentage' ? `${appliedCoupon.discount_percentage}% OFF` : `₦${appliedCoupon.discount_amount} OFF`})
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={handleRemoveCoupon} style={s.removePromoBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={22} color={C.textMuted} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={[s.optionRow, { backgroundColor: C.surface, borderColor: C.border }]}
                onPress={() => {
                  setPromoError(null);
                  setIsPromoModalVisible(true);
                }}
              >
                <MaterialCommunityIcons name="ticket-percent" size={20} color={Colors.brand.secondary} style={{ marginRight: 12 }} />
                <Text style={[s.optionTxt, { color: C.text }]}>Apply Promo</Text>
                <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
              </TouchableOpacity>
            )}
          </View>

        </BottomSheetScrollView>

        {/* Book Action */}
        <View style={[s.bookActionWrap, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity
            style={[
              s.bookBtn, 
              { backgroundColor: Colors.brand.secondary },
              (isBooking || isBidOutOfRange) && { opacity: 0.6 }
            ]}
            activeOpacity={0.8}
            onPress={handleBook}
            disabled={isBooking || isBidOutOfRange}
          >
            {isBooking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Text style={s.bookBtnTxt}>
                  {isBidOutOfRange
                    ? `Enter Valid Offer (${formatCurrency(minAllowedFare)} - ${formatCurrency(maxAllowedFare)})`
                    : isBidVisible && adjSettings.enabled && bidAmount !== platformEstimatedFare
                      ? `Offer ${formatCurrency(Math.max(0, bidAmount - discountAmount))}`
                      : !(selectedRide.is_available ?? ((selectedRide.available_drivers_count || 0) > 0)) && scheduleTime === 'Now'
                        ? `No ${selectedRide.name} Drivers Available`
                        : isSharedRide && selectedRide.supports_shared_rides
                          ? `Book Shared ${formatCurrency(Math.max(0, computedFareBeforeDiscount - discountAmount))}`
                          : `Book ${selectedRide.name} ${formatCurrency(Math.max(0, computedFareBeforeDiscount - discountAmount))}`
                  }
                </Text>
                {discountAmount > 0 && (
                  <View style={s.btnDiscountPill}>
                    <Text style={s.btnDiscountPillTxt}>-{formatCurrency(discountAmount)}</Text>
                  </View>
                )}
              </View>
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

      {/* Promo Code Modal */}
      <Modal
        isVisible={isPromoModalVisible}
        onBackdropPress={() => setIsPromoModalVisible(false)}
        onBackButtonPress={() => setIsPromoModalVisible(false)}
        style={s.promoModal}
        avoidKeyboard
      >
        <View style={[s.promoModalContent, { backgroundColor: C.background }]}>
          <View style={s.promoModalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="ticket-percent" size={24} color={Colors.brand.secondary} />
              <Text style={[s.promoModalTitle, { color: C.text }]}>Promotions & Coupons</Text>
            </View>
            <TouchableOpacity onPress={() => setIsPromoModalVisible(false)} style={s.promoCloseBtn}>
              <Ionicons name="close" size={22} color={C.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Promo Input Box */}
          <View style={[s.promoInputWrapper, { backgroundColor: C.surface, borderColor: promoError ? '#EF4444' : C.border }]}>
            <TextInput
              value={promoInputCode}
              onChangeText={(text) => {
                setPromoInputCode(text.toUpperCase());
                if (promoError) setPromoError(null);
              }}
              placeholder="Enter Promo Code"
              placeholderTextColor={C.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={[s.promoTextInput, { color: C.text }]}
            />
            <TouchableOpacity
              style={[s.applyCodeBtn, { backgroundColor: Colors.brand.secondary, opacity: isValidatingPromo ? 0.7 : 1 }]}
              onPress={() => handleApplyCouponCode()}
              disabled={isValidatingPromo}
            >
              {isValidatingPromo ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.applyCodeBtnTxt}>Apply</Text>
              )}
            </TouchableOpacity>
          </View>

          {promoError ? (
            <View style={s.promoErrorRow}>
              <Ionicons name="alert-circle" size={16} color="#EF4444" />
              <Text style={s.promoErrorTxt}>{promoError}</Text>
            </View>
          ) : null}

          {/* Available Coupons List */}
          <Text style={[s.availableCouponsLabel, { color: C.textSecondary }]}>Available Offers</Text>
          <ScrollView style={s.couponsListScroll} showsVerticalScrollIndicator={false}>
            {availableCoupons.length === 0 ? (
              <View style={s.emptyCouponsWrap}>
                <Ionicons name="gift-outline" size={36} color={C.textMuted} />
                <Text style={[s.emptyCouponsTxt, { color: C.textMuted }]}>No active coupons at this time.</Text>
              </View>
            ) : (
              availableCoupons.map((coupon) => {
                const isSelected = appliedCoupon?.id === coupon.id;
                const discountDisplay = coupon.discount_type === 'percentage' 
                  ? `${coupon.discount_percentage}% OFF` 
                  : `₦${(coupon.discount_amount || 0).toLocaleString()} OFF`;

                return (
                  <View 
                    key={coupon.id} 
                    style={[
                      s.couponCard, 
                      { 
                        backgroundColor: coupon.bg_color || (isDark ? '#1E293B' : '#F1F5F9'), 
                        borderColor: isSelected ? Colors.brand.secondary : 'transparent',
                        borderWidth: isSelected ? 2 : 1
                      }
                    ]}
                  >
                    <View style={s.couponCardLeft}>
                      <View style={s.couponCodeBadge}>
                        <Text style={s.couponCodeText}>{coupon.code}</Text>
                      </View>
                      <Text style={[s.couponTitle, { color: coupon.text_color || (isDark ? '#fff' : '#0F172A') }]}>
                        {coupon.title || discountDisplay}
                      </Text>
                      {coupon.description ? (
                        <Text style={[s.couponDesc, { color: (coupon.text_color || (isDark ? '#fff' : '#0F172A')) + 'CC' }]}>
                          {coupon.description}
                        </Text>
                      ) : null}
                      {coupon.min_ride_fare ? (
                        <Text style={[s.couponMinFare, { color: (coupon.text_color || (isDark ? '#fff' : '#0F172A')) + '99' }]}>
                          Min. fare: {formatCurrency(coupon.min_ride_fare)}
                        </Text>
                      ) : null}
                    </View>

                    <View style={s.couponCardRight}>
                      <TouchableOpacity
                        style={[
                          s.couponApplyActionBtn,
                          { 
                            backgroundColor: isSelected ? '#10B981' : Colors.brand.secondary 
                          }
                        ]}
                        onPress={() => {
                          if (isSelected) {
                            handleRemoveCoupon();
                          } else {
                            handleApplyCouponCode(coupon.code);
                          }
                        }}
                      >
                        <Text style={s.couponApplyActionTxt}>{isSelected ? 'Applied' : 'Use'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
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
    paddingRight: 12,
  },
  rideCard: {
    minWidth: 125,
    borderRadius: 12,
    borderWidth: 2,
    padding: 14,
    position: 'relative',
    justifyContent: 'space-between',
  },
  unavailableBadge: {
    backgroundColor: '#EF444415',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 8,
    alignSelf: 'center',
  },
  unavailableBadgeTxt: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '700',
  },
  availableBadge: {
    backgroundColor: '#10B98115',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 8,
    alignSelf: 'center',
  },
  availableBadgeTxt: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  sharedRideOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  sharedIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedOptionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  sharedDiscountBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sharedDiscountBadgeTxt: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  sharedOptionDesc: {
    fontSize: 12,
    marginTop: 2,
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  bidHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bidSubTitle: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  bidPlatformPrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  bidRangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  bidRangeBadgeTxt: {
    fontSize: 11,
    fontWeight: '700',
  },
  bidDivider: {
    height: 1,
    backgroundColor: 'rgba(150, 150, 150, 0.15)',
    marginBottom: 14,
  },
  bidLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  bidControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  bidCtrlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bidInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    minWidth: 140,
    justifyContent: 'center',
  },
  bidCurrencySymbol: {
    fontSize: 20,
    fontWeight: '800',
    marginRight: 4,
  },
  bidTextInput: {
    fontSize: 22,
    fontWeight: '800',
    minWidth: 60,
    textAlign: 'center',
    paddingVertical: 0,
  },
  bidWarningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 8,
  },
  bidWarningTxt: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  bidDiffRow: {
    alignItems: 'center',
    marginTop: 10,
  },
  bidDiffTxt: {
    fontSize: 12,
    fontWeight: '700',
  },
  bidHintTxt: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
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
  /* Promo Section Styles */
  appliedPromoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  promoIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appliedCodeTxt: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  appliedActiveBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  appliedDiscTxt: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  removePromoBtn: {
    padding: 4,
  },
  btnDiscountPill: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  btnDiscountPillTxt: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  /* Promo Modal */
  promoModal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  promoModalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '80%',
  },
  promoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  promoModalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  promoCloseBtn: {
    padding: 4,
  },
  promoInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  promoTextInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 8,
  },
  applyCodeBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  applyCodeBtnTxt: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  promoErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  promoErrorTxt: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  availableCouponsLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  couponsListScroll: {
    maxHeight: 280,
  },
  emptyCouponsWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyCouponsTxt: {
    fontSize: 14,
    fontWeight: '500',
  },
  couponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
  },
  couponCardLeft: {
    flex: 1,
    paddingRight: 12,
  },
  couponCodeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  couponCodeText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#fff',
  },
  couponTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  couponDesc: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  couponMinFare: {
    fontSize: 11,
    fontWeight: '600',
  },
  couponCardRight: {
    alignItems: 'center',
  },
  couponApplyActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  couponApplyActionTxt: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
});
