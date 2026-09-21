import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Switch, Dimensions, Image, Platform, ActivityIndicator,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import BottomSheet, { BottomSheetView, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import AlertModal from '@/components/AlertModal';
import NotificationBell from '@/components/NotificationBell';
import Modal from 'react-native-modal';
import LocationPermissionModal from '@/components/LocationPermissionModal';
import { Image as ExpoImage } from 'expo-image';

const PremiumVehicleMarker = ({ heading, isBike }: { heading: number; isBike?: boolean }) => {
  // Using the SVG assets with a sleek, smaller size (width 20, height 40)
  return (
    <View style={{
      width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
      transform: [{ rotate: `${heading}deg` }]
    }}>
      <ExpoImage 
        source={isBike ? require('@/assets/svg/bike_marker.svg') : require('@/assets/svg/car_marker.svg')}
        style={{ width: 20, height: 40 }}
        contentFit="contain"
      />
    </View>
  );
};



const { width, height } = Dimensions.get('window');

// Custom Map Style for a clean look (Silver/Light mode)
const mapStyle = [
  { "featureType": "poi", "elementType": "labels.text", "stylers": [{ "visibility": "off" }] },
  { "featureType": "poi.business", "stylers": [{ "visibility": "off" }] },
  { "featureType": "road", "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "featureType": "transit", "stylers": [{ "visibility": "off" }] }
];

// Dark Map Style
const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi", "elementType": "labels.text", "stylers": [{ "visibility": "off" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#263c3f" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#6b9a76" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#746855" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#1f2835" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#f3d19c" }] },
  { "featureType": "transit", "stylers": [{ "visibility": "off" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#515c6d" }] },
  { "featureType": "water", "elementType": "labels.text.stroke", "stylers": [{ "color": "#17263c" }] }
];


export default function DriverHomeIndex() {
  const { colorScheme } = useAppContext();
  const isDark = colorScheme === 'dark';
  const { authUser, updateAuthUser, setSelectedRole } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const isMounted = useRef(true);

  const [isOnline, setIsOnline] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [heading, setHeading] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isNewRideVisible, setIsNewRideVisible] = useState(false);
  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<any>(null);
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = React.useMemo(() => ['25%', '60%', '90%'], []);
  const C = Colors[colorScheme];

  // Determine if driver is bike-only (courier-only) based on driverType
  const isBikeDriver = authUser?.driverType === 'motorbike';

  useEffect(() => {
    let ridesChannel: any;
    let deliveriesChannel: any;
    if (isOnline && location && authUser) {
      fetchAvailableRequests();

      // Subscribe to deliveries (all drivers can do courier)
      deliveriesChannel = supabase
        .channel(`searching-deliveries-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => {
          fetchAvailableRequests();
        })
        .subscribe();

      // Subscribe to rides (only car/tricycle drivers)
      if (!isBikeDriver) {
        ridesChannel = supabase
          .channel(`searching-rides-${Date.now()}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () => {
            fetchAvailableRequests();
          })
          .subscribe();
      }
    } else {
      setAvailableRides([]);
      setIsNewRideVisible(false);
    }
    return () => {
      if (ridesChannel) supabase.removeChannel(ridesChannel);
      if (deliveriesChannel) supabase.removeChannel(deliveriesChannel);
    };
  }, [isOnline, location, authUser]);

  const fetchAvailableRequests = async () => {
    if (!location || !authUser) return;

    try {
      // 1. Fetch deliveries (all drivers)
      const { data: deliveries } = await supabase
        .from('deliveries')
        .select('*')
        .eq('status', 'searching')
        .order('created_at', { ascending: false });

      // 2. Fetch rides (only for non-bike drivers, filtered to driver's ride type if set)
      let rides: any[] = [];
      if (!isBikeDriver) {
        let query = supabase
          .from('rides')
          .select('*')
          .eq('status', 'searching');

        if (authUser?.rideTypeId) {
          query = query.eq('ride_type_id', authUser.rideTypeId);
        }

        const { data } = await query.order('created_at', { ascending: false });
        rides = data || [];
      }

      // Tag each request with its type
      const allRides = [
        ...(rides || []).map(r => ({ ...r, requestType: 'ride' as const })),
        ...(deliveries || []).map(d => ({
          ...d,
          requestType: 'delivery' as const,
          // Map delivery fields to a common shape for cards
          pickup_lat: d.sender_lat,
          pickup_lng: d.sender_lng,
          pickup_address: d.sender_address,
          destination_address: d.receiver_address,
        })),
      ];

      if (allRides.length === 0) {
        setAvailableRides([]);
        setIsNewRideVisible(false);
        return;
      }

      // 3. Fetch rider profiles
      const riderIds = [...new Set(allRides.map(r => r.rider_id))].filter(Boolean);
      let profilesMap: Record<string, any> = {};
      if (riderIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', riderIds);
        if (profilesData) {
          profilesData.forEach(p => { profilesMap[p.id] = p; });
        }
      }

      const requestsWithProfiles = allRides.map(r => ({
        ...r,
        rider: profilesMap[r.rider_id] || null
      }));

      // 4. Distance Matrix to filter by proximity (6km) with resilient offline/GPS fallback
      const driverLoc = `${location.coords.latitude},${location.coords.longitude}`;
      const destinations = requestsWithProfiles.map(r => `${r.pickup_lat},${r.pickup_lng}`).join('|');
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_APIKEY;

      let filtered: any[] = [];

      try {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${driverLoc}&destinations=${destinations}&key=${apiKey}`;
        const response = await fetch(url);
        const matrixData = await response.json();

        if (matrixData.status === 'OK' && matrixData.rows?.[0]?.elements) {
          filtered = requestsWithProfiles.map((req, index) => {
            const element = matrixData.rows[0].elements[index];
            if (!element || element.status !== 'OK') return null;
            const distanceInKm = element.distance.value / 1000;
            if (distanceInKm <= 6) {
              return {
                ...req,
                driver_distance: element.distance.text,
                driver_duration: element.duration.text,
                proximity_km: distanceInKm,
              };
            }
            return null;
          }).filter(r => r !== null);
        } else {
          throw new Error(matrixData.error_message || `Distance Matrix returned ${matrixData.status}`);
        }
      } catch (matrixErr: any) {
        // Fallback to Haversine GPS formula if Google Maps API is down, rate-limited, or billing suspended
        filtered = requestsWithProfiles.map((req) => {
          const lat1 = location.coords.latitude;
          const lon1 = location.coords.longitude;
          const lat2 = parseFloat(req.pickup_lat);
          const lon2 = parseFloat(req.pickup_lng);
          if (isNaN(lat2) || isNaN(lon2)) return null;

          const R = 6371; // Earth radius in km
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distanceInKm = Math.round(R * c * 1.3 * 10) / 10; // 1.3 driving curvature factor

          if (distanceInKm <= 6) {
            const approxMins = Math.max(2, Math.round(distanceInKm * 2.5));
            return {
              ...req,
              driver_distance: `${distanceInKm} km`,
              driver_duration: `${approxMins} mins`,
              proximity_km: distanceInKm,
            };
          }
          return null;
        }).filter(r => r !== null);
      }

      setAvailableRides(filtered);
      setIsNewRideVisible(filtered.length > 0);

    } catch (err) {
      console.error('Error fetching available requests:', err);
    }
  };

  const handleAcceptRequest = async (requestId: string, requestType: 'ride' | 'delivery') => {
    if (!authUser) return;

    setLoading(true);
    try {
      if (requestType === 'ride') {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('accept_ride_request', {
          p_ride_id: requestId,
          p_driver_id: authUser.id,
        });

        if (rpcErr) throw rpcErr;
        if (!rpcRes?.success) {
          setAlertConfig({
            visible: true,
            title: 'Ride Unavailable',
            message: rpcRes?.message || 'This ride is no longer available.',
            type: 'warning',
          });
          setLoading(false);
          fetchAvailableRequests();
          return;
        }

        setAvailableRides([]);
        setIsNewRideVisible(false);
        router.push(`/(driver)/active-trip?rideId=${requestId}`);
      } else {
        const { data: updatedDelivery, error: delivErr } = await supabase
          .from('deliveries')
          .update({
            status: 'accepted',
            driver_id: authUser.id,
            accepted_at: new Date().toISOString(),
          })
          .eq('id', requestId)
          .eq('status', 'searching')
          .select();

        if (delivErr) throw delivErr;
        if (!updatedDelivery || updatedDelivery.length === 0) {
          setAlertConfig({
            visible: true,
            title: 'Delivery Unavailable',
            message: 'This delivery has already been accepted or cancelled.',
            type: 'warning',
          });
          setLoading(false);
          fetchAvailableRequests();
          return;
        }

        setAvailableRides([]);
        setIsNewRideVisible(false);
        router.push(`/(driver)/active-delivery?deliveryId=${requestId}`);
      }

    } catch (err: any) {
      console.error(`Error accepting ${requestType}:`, err);
      setAlertConfig({
        visible: true,
        title: 'Accept Error',
        message: `Could not accept this ${requestType}. It may have been taken or cancelled.`,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authUser) {
      fetchOnlineStatus();
    }
  }, [authUser]);

  const fetchOnlineStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('available_drivers')
        .select('is_online')
        .eq('id', authUser?.id)
        .maybeSingle();

      if (data) {
        setIsOnline(data.is_online);
      }
    } catch (err) {
      console.error('Error fetching online status:', err);
    }
  };

  // Check location permission — show premium modal if not yet granted
  useEffect(() => {
    (async () => {
      try {
        const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
        if (existingStatus === 'granted') {
          initLocationTracking();
          return;
        }
        // Show premium pre-permission modal
        setShowPermissionModal(true);
      } catch (err) {
        console.warn('Permission check error:', err);
      }
    })();

    return () => {
      isMounted.current = false;
      locationSubscription.current?.remove();
    };
  }, []);

  const handlePermissionAllow = () => {
    setShowPermissionModal(false);
    setTimeout(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        initLocationTracking();
      }
    }, 500);
  };

  const handlePermissionDeny = () => {
    setShowPermissionModal(false);
  };

  const initLocationTracking = async () => {
    try {
      // Get last known location for immediate UI response
      let lastLoc = await Location.getLastKnownPositionAsync({});
      if (lastLoc) {
        setLocation(lastLoc);
        mapRef.current?.animateToRegion({
          latitude: lastLoc.coords.latitude,
          longitude: lastLoc.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }

      // Then try to get fresh high-accuracy position
      let loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(loc);
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });

      // Subscribe to location updates
      locationSubscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10 },
        (newLoc) => {
          if (!isMounted.current) return;
          setLocation(newLoc);
          if (newLoc.coords.heading !== null) setHeading(newLoc.coords.heading);
        }
      );
    } catch (err) {
      console.warn('Location initialization error:', err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const fetchActiveTask = async () => {
        if (!authUser?.id) return;
        try {
          const { data: rides } = await supabase
            .from('rides')
            .select('*')
            .eq('driver_id', authUser.id)
            .in('status', ['accepted', 'ongoing'])
            .maybeSingle();

          if (rides) {
            setActiveTask({ ...rides, type: 'ride' });
            return;
          }

          const { data: deliveries } = await supabase
            .from('deliveries')
            .select('*')
            .eq('driver_id', authUser.id)
            .in('status', ['accepted', 'picked_up', 'in_transit'])
            .maybeSingle();

          if (deliveries) {
            setActiveTask({ ...deliveries, type: 'delivery' });
            return;
          }

          setActiveTask(null);
        } catch (err) {
          console.error('Error fetching active task:', err);
        }
      };
      fetchActiveTask();
    }, [authUser?.id])
  );

  useFocusEffect(
    useCallback(() => {
      const fetchWalletBalance = async () => {
        if (!authUser?.id) return;
        try {
          const { data, error } = await supabase
            .from('wallets')
            .select('balance')
            .eq('id', authUser.id)
            .single();

          if (data) {
            setWalletBalance(parseFloat(data.balance) || 0);
          }
        } catch (err) {
          console.error('Error fetching wallet balance:', err);
        }
      };
      fetchWalletBalance();
    }, [authUser?.id])
  );

  const centerMap = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  };

  const toggleOnlineStatus = async () => {
    if (!authUser) return;

    const nextStatus = !isOnline;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('available_drivers')
        .upsert({
          id: authUser.id,
          is_online: nextStatus,
          latitude: location?.coords.latitude || null,
          longitude: location?.coords.longitude || null,
          last_updated: new Date().toISOString(),
        });

      if (error) throw error;
      setIsOnline(nextStatus);
    } catch (err: any) {
      setAlertConfig({
        visible: true,
        title: 'Status Error',
        message: 'Failed to update online status. Please check your connection.',
        type: 'error'
      });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Periodically update location in Supabase while online
  useEffect(() => {
    let interval: any;
    if (isOnline && location && authUser) {
      interval = setInterval(async () => {
        await supabase
          .from('available_drivers')
          .update({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            last_updated: new Date().toISOString(),
          })
          .eq('id', authUser.id);
      }, 30000); // Every 30 seconds
    }
    return () => clearInterval(interval);
  }, [isOnline, location, authUser]);



  return (
    <View style={s.root}>
      {/* Map View */}
      <MapView
        ref={mapRef}
        style={s.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={colorScheme === 'dark' ? darkMapStyle : mapStyle}
        initialRegion={{
          latitude: location?.coords.latitude || 6.5244,
          longitude: location?.coords.longitude || 3.3792,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
        showsUserLocation={false}
      >
        {location && (
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            flat
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <PremiumVehicleMarker
              heading={heading}
              isBike={isBikeDriver}
            />
          </Marker>
        )}
      </MapView>

      {/* Top Controls Overlay */}
      <View style={[s.topOverlay, { paddingTop: insets.top + 10 }]}>
        <View style={s.topRow}>
          {/* Wallet Balance */}
          <TouchableOpacity
            style={s.balanceBubble}
            activeOpacity={0.8}
            onPress={() => setShowBalance(!showBalance)}
          >
            <Ionicons name={showBalance ? "eye-outline" : "eye-off-outline"} size={20} color="#fff" />
            <Text style={s.balanceTxt}>
              {showBalance ? `₦${walletBalance.toLocaleString()}` : "•••"}
            </Text>
          </TouchableOpacity>

          <View style={s.topRight}>
            {/* Notification */}
            <NotificationBell size={22} color={isDark ? '#fff' : '#1E293B'} />
            {/* Profile */}
            <TouchableOpacity onPress={() => router.push('/(driver)/(tabs)/profile')}>
              {authUser?.avatar ? (
                <Image source={{ uri: authUser.avatar }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, s.avatarInitials, { backgroundColor: Colors.driver.primary, borderColor: isDark ? '#1E293B' : '#fff' }]}>
                  <Text style={[s.initialsTxt, { color: '#0D1B3E' }]}>
                    {authUser ? `${authUser.firstName.charAt(0)}${authUser.lastName.charAt(0)}` : 'D'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Online Toggle Switch (Pill Layout) */}
        <View style={s.toggleContainer}>
          <View style={[s.togglePill, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
            <TouchableOpacity
              style={[s.toggleHalf, isOnline && { backgroundColor: '#22C55E' }]}
              onPress={() => !isOnline && toggleOnlineStatus()}
            >
              <Text style={[s.toggleLabel, { color: isOnline ? '#fff' : (isDark ? '#94A3B8' : '#64748B') }]}>Go Online</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.toggleHalf, !isOnline && { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}
              onPress={() => isOnline && toggleOnlineStatus()}
            >
              <Text style={[s.toggleLabel, { color: !isOnline ? (isDark ? '#fff' : '#1E293B') : (isDark ? '#94A3B8' : '#64748B') }]}>Go Offline</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Active Task Banner */}
        {activeTask && (
          <TouchableOpacity
            style={[s.activeBanner, { backgroundColor: Colors.driver.primary }]}
            activeOpacity={0.9}
            onPress={() => {
              if (activeTask.type === 'delivery') {
                router.push(`/(driver)/active-delivery?deliveryId=${activeTask.id}`);
              } else {
                router.push(`/(driver)/active-trip?rideId=${activeTask.id}`);
              }
            }}
          >
            <View style={s.activeBannerContent}>
              <View style={s.activeIconCircle}>
                <Ionicons
                  name={activeTask.type === 'delivery' ? "cube" : "car"}
                  size={20}
                  color="#0D1B3E"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.activeTitle}>
                  {activeTask.status === 'picked_up' || activeTask.status === 'in_transit' ? 'In Transit' : `Ongoing ${activeTask.type === 'delivery' ? 'Delivery' : 'Ride'}`}
                </Text>
                <Text style={s.activeSub} numberOfLines={1}>
                  {activeTask.destination_address || activeTask.receiver_address || 'Tap to resume'}
                </Text>
              </View>
              <View style={s.resumeBtn}>
                <Text style={s.resumeBtnTxt}>Resume</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Floating Action Buttons */}
      <View style={s.bottomFloating}>
        {/* Left Side */}
        <View style={s.fabCol}>
          <TouchableOpacity
            style={[s.fabCircle, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}
            onPress={() => setIsNewRideVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="car-outline" size={24} color={isDark ? '#fff' : '#1E293B'} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.fabCircle, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
            <Ionicons name="shield-checkmark-outline" size={24} color={isDark ? '#fff' : '#1E293B'} />
          </TouchableOpacity>
        </View>

        {/* Center/Go Button */}
        <TouchableOpacity
          style={[s.goBtn, {
            backgroundColor: isOnline ? '#EF4444' : Colors.driver.primary,
            borderColor: isDark ? '#1E293B' : '#fff'
          }]}
          activeOpacity={0.9}
          onPress={toggleOnlineStatus}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={isOnline ? "#fff" : "#0D1B3E"} />
          ) : (
            <Text style={[s.goTxt, { color: isOnline ? '#fff' : '#0D1B3E' }]}>{isOnline ? 'STOP' : 'GO'}</Text>
          )}
        </TouchableOpacity>

        {/* Right Side */}
        <View style={s.fabCol}>
          <TouchableOpacity
            style={[s.fabCircle, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}
            onPress={() => setIsNewRideVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="search" size={24} color={isDark ? '#fff' : '#1E293B'} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.fabCircle, { backgroundColor: isDark ? '#1E293B' : '#fff' }]} onPress={centerMap} activeOpacity={0.7}>
            <Ionicons name="locate" size={24} color={isDark ? '#fff' : '#1E293B'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* New Ride Requests Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={isNewRideVisible ? 1 : -1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={() => setIsNewRideVisible(false)}
        handleIndicatorStyle={{ backgroundColor: Colors.brand.secondary, width: 60 }}
        backgroundStyle={{ backgroundColor: C.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32 }}
      >
        <BottomSheetFlatList
          data={availableRides}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Ionicons name="search" size={48} color={C.textMuted} />
              <Text style={{ color: C.textMuted, marginTop: 12, fontSize: 16 }}>Searching for rides nearby...</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const isDelivery = item.requestType === 'delivery';
            const displayFare = isDelivery && item.offer_fare ? item.offer_fare : item.fare;
            return (
              <View style={[s.rideCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                {/* Type Badge + Card Header */}
                <View style={s.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[s.idBadge, { backgroundColor: isDelivery ? Colors.brand.secondary + '20' : Colors.brand.primary + '15' }]}>
                      <Text style={[s.idTxt, { color: isDelivery ? Colors.brand.secondary : Colors.brand.primary }]}>
                        {isDelivery ? '📦 DELIVERY' : '🚗 RIDE'}
                      </Text>
                    </View>
                    <Text style={[s.dateTimeTxt, { color: C.textMuted }]}>#{item.id.slice(0, 6).toUpperCase()}</Text>
                  </View>
                  <View style={s.timeInfo}>
                    <Ionicons name="navigate-outline" size={14} color={C.textMuted} />
                    <Text style={[s.dateTimeTxt, { color: C.textMuted }]}>{item.driver_distance || 'Nearby'}</Text>
                    <View style={[s.vLine, { backgroundColor: C.border }]} />
                    <Ionicons name="time-outline" size={14} color={C.textMuted} />
                    <Text style={[s.dateTimeTxt, { color: C.textMuted }]}>{item.driver_duration || 'Now'}</Text>
                  </View>
                </View>

                {/* Delivery-specific parcel info */}
                {isDelivery && (
                  <View style={[s.parcelInfoRow, { backgroundColor: C.surfaceAlt }]}>
                    <View style={s.parcelChip}>
                      <Ionicons name="cube-outline" size={14} color={Colors.brand.primary} />
                      <Text style={[s.parcelChipTxt, { color: C.text }]}>{item.parcel_type}</Text>
                    </View>
                    <View style={s.parcelChip}>
                      <Ionicons name="scale-outline" size={14} color={Colors.brand.primary} />
                      <Text style={[s.parcelChipTxt, { color: C.text }]}>{item.parcel_weight}kg</Text>
                    </View>
                    <View style={s.parcelChip}>
                      <Ionicons name={item.vehicle_type === 'bike' ? 'bicycle' : 'car-outline'} size={14} color={Colors.brand.primary} />
                      <Text style={[s.parcelChipTxt, { color: C.text }]}>{item.vehicle_type}</Text>
                    </View>
                    {item.parcel_image_url && (
                      <TouchableOpacity
                        style={[s.parcelChip, { backgroundColor: Colors.brand.primary + '15' }]}
                        onPress={() => setPreviewImage(item.parcel_image_url)}
                      >
                        <Ionicons name="image-outline" size={14} color={Colors.brand.primary} />
                        <Text style={[s.parcelChipTxt, { color: Colors.brand.primary, fontWeight: '700' }]}>View Item</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Rider/Sender Info & Price */}
                <View style={s.riderPriceRow}>
                  <View style={s.riderInfo}>
                    {(() => {
                      const r = item.rider;
                      return r?.avatar_url ? (
                        <Image source={{ uri: r.avatar_url }} style={s.riderAvatar} />
                      ) : (
                        <View style={[s.riderAvatar, { backgroundColor: Colors.brand.primary, alignItems: 'center', justifyContent: 'center' }]}>
                          <Ionicons name="person" size={24} color="#fff" />
                        </View>
                      );
                    })()}
                    <View>
                      <View style={s.nameVerified}>
                        <Text style={[s.riderName, { color: C.text }]}>
                          {(() => {
                            if (isDelivery) return item.sender_name || 'Sender';
                            const r = item.rider;
                            if (r?.first_name) return `${r.first_name} ${r.last_name || ''}`.trim();
                            return 'Rider';
                          })()}
                        </Text>
                        <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                      </View>
                      <View style={s.ratingRow}>
                        <Ionicons name="time-outline" size={14} color={C.textMuted} />
                        <Text style={[s.ratingTxt, { color: C.textMuted, marginLeft: 4 }]}>
                          {(() => {
                            const mins = item.duration_mins;
                            if (!mins) return isDelivery ? 'Delivery' : 'Trip';
                            if (mins < 60) return `${Math.round(mins)} Min ${isDelivery ? 'Delivery' : 'Trip'}`;
                            const hrs = Math.floor(mins / 60);
                            const remainingMins = Math.round(mins % 60);
                            if (remainingMins === 0) return `${hrs} Hour ${isDelivery ? 'Delivery' : 'Trip'}`;
                            return `${hrs}h ${remainingMins}m ${isDelivery ? 'Delivery' : 'Trip'}`;
                          })()}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.priceTxt, { color: C.text }]}>₦{(displayFare || 0).toLocaleString()}</Text>
                    {isDelivery && item.offer_fare && item.offer_fare !== item.fare && (
                      <Text style={{ fontSize: 11, color: Colors.brand.secondary, fontWeight: '700' }}>Bid Price</Text>
                    )}
                  </View>
                </View>

                {/* Route Info */}
                <View style={s.routeContainer}>
                  <View style={s.routeMarkers}>
                    <View style={[s.dot, { backgroundColor: isDelivery ? '#22C55E' : C.textMuted }]} />
                    <View style={[s.line, { borderColor: C.border }]} />
                    <View style={[s.dotSquare, { backgroundColor: Colors.brand.primary }]} />
                  </View>
                  <View style={s.addresses}>
                    <Text style={[s.addressTxt, { color: C.textSecondary }]} numberOfLines={2}>
                      Pickup: {item.pickup_address || 'Current Location'}
                      {item.driver_duration ? ` (${item.driver_duration.replace(' mins', 'm')} away)` : ''}
                    </Text>
                    <Text style={[s.addressTxt, { color: C.textSecondary, marginTop: 15 }]} numberOfLines={2}>Drop-off: {item.destination_address || 'Destination'}</Text>
                  </View>
                  <View style={[s.distanceBadge, { borderColor: C.border, backgroundColor: C.surfaceAlt }]}>
                    <Text style={[s.distanceTxt, { color: C.text }]}>
                      {item.distance_km ? `${item.distance_km.toFixed(1)}km` : '?'}
                      {'\n'}{isDelivery ? 'route' : 'trip'}
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={s.actionRow}>
                  <TouchableOpacity
                    style={[s.actionBtn, s.declineBtn]}
                    onPress={() => {
                      setAvailableRides(prev => prev.filter(r => r.id !== item.id));
                      if (availableRides.length <= 1) setIsNewRideVisible(false);
                    }}
                  >
                    <Text style={s.declineBtnTxt}>Skip</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionBtn, s.acceptBtn, item.status === 'cancelled' && { backgroundColor: C.border }]}
                    onPress={() => handleAcceptRequest(item.id, item.requestType)}
                    disabled={loading || item.status === 'cancelled'}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={s.acceptBtnTxt}>{item.status === 'cancelled' ? 'Cancelled' : 'Accept'}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      </BottomSheet>

      <AlertModal
        isVisible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
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
      {/* Premium Location Permission Modal */}
      <LocationPermissionModal
        isVisible={showPermissionModal}
        onAllow={handlePermissionAllow}
        onDeny={handlePermissionDeny}
        role="driver"
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  arrowWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  activeBanner: {
    marginTop: 16,
    borderRadius: 16,
    padding: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  activeBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D1B3E',
  },
  activeSub: {
    fontSize: 12,
    color: 'rgba(13, 27, 62, 0.7)',
    fontWeight: '600',
    marginTop: 1,
  },
  resumeBtn: {
    backgroundColor: '#0D1B3E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  resumeBtnTxt: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  balanceBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1B3E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    gap: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  balanceTxt: { color: '#fff', fontSize: 18, fontWeight: '800' },

  topRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#fff' },
  avatarInitials: { backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center' },
  initialsTxt: { fontSize: 16, fontWeight: '800', color: '#0D1B3E' },

  toggleContainer: { marginTop: 20, alignItems: 'center' },
  togglePill: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    width: width * 0.85,
    height: 56,
    borderRadius: 28,
    padding: 4,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  toggleHalf: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  toggleActiveOnline: { backgroundColor: '#22C55E' },
  toggleActiveOffline: { backgroundColor: '#F1F5F9' },
  toggleLabel: { fontSize: 16, fontWeight: '700', color: '#64748B' },
  toggleLabelActive: { color: '#1E293B' },

  bottomFloating: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  fabCol: { gap: 16 },
  fabCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  sosBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  sosTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },
  goBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    borderWidth: 4,
    borderColor: '#fff',
  },
  goTxt: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0D1B3E',
  },

  /* Ride Card Styles */
  rideCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  idBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  idTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateTimeTxt: {
    fontSize: 12,
    fontWeight: '600',
  },
  vLine: {
    width: 1,
    height: 12,
    marginHorizontal: 4,
  },
  riderPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  riderAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E2E8F0',
  },
  nameVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  riderName: {
    fontSize: 16,
    fontWeight: '800',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingTxt: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
  reviewsTxt: {
    fontSize: 12,
  },
  priceTxt: {
    fontSize: 22,
    fontWeight: '900',
  },
  routeContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    position: 'relative',
  },
  routeMarkers: {
    alignItems: 'center',
    width: 20,
    marginRight: 12,
    paddingVertical: 6,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 4,
    borderColor: '#E2E8F0',
  },
  line: {
    flex: 1,
    width: 2,
    borderStyle: 'dashed',
    borderWidth: 1,
    marginVertical: 4,
  },
  dotSquare: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  addresses: {
    flex: 1,
    paddingTop: 2,
  },
  addressTxt: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  distanceBadge: {
    position: 'absolute',
    right: 0,
    top: '40%',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  distanceTxt: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    backgroundColor: '#F1F5F9',
  },
  acceptBtn: {
    backgroundColor: '#000',
  },
  declineBtnTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  acceptBtnTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  parcelInfoRow: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  parcelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  parcelChipTxt: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
