import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Dimensions, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import NotificationBell from '@/components/NotificationBell';
import * as Location from 'expo-location';
import LocationPermissionModal from '@/components/LocationPermissionModal';
import PremiumVehicleMarker from '@/components/PremiumVehicleMarker';

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

const { height } = Dimensions.get('window');



type SavedPlace = {
  id: string;
  type: 'home' | 'work' | 'favorite';
  title: string;
  address: string;
  lat: number;
  lng: number;
};

type RecentPlace = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export default function HomeScreen() {
  const { colorScheme, setDestinationLocation, setDestinationAddress } = useAppContext();
  const { authUser } = useAuth();
  const router = useRouter();
  const C = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<RecentPlace[]>([]);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const mapRef = useRef<any>(null);
  const { currentLocation } = useAppContext();
  const firstName = authUser?.firstName || 'User';

  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const { setCurrentLocation, setCurrentAddress } = useAppContext();

  useFocusEffect(
    React.useCallback(() => {
      if (authUser?.id) {
        // Fetch saved places
        supabase
          .from('saved_places')
          .select('*')
          .eq('user_id', authUser.id)
          .in('type', ['home', 'work'])
          .then(({ data, error }) => {
            if (!error && data) {
              setSavedPlaces(data);
            }
          });

        // Fetch initial available drivers
        fetchDrivers();

        // Fetch recent places
        fetchRecentPlaces();

        // Subscribe to real-time driver updates
        const channel = supabase
          .channel('available-drivers')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'available_drivers' },
            (payload) => {
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const driver = payload.new;
                if (driver.is_online) {
                  setDrivers(prev => {
                    const filtered = prev.filter(d => d.id !== driver.id);
                    return [...filtered, driver];
                  });
                } else {
                  setDrivers(prev => prev.filter(d => d.id !== driver.id));
                }
              } else if (payload.eventType === 'DELETE') {
                setDrivers(prev => prev.filter(d => d.id !== payload.old.id));
              }
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      }
    }, [authUser])
  );

  // Check location permission on mount
  useEffect(() => {
    (async () => {
      try {
        const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
        if (existingStatus === 'granted') {
          initLocation();
          return;
        }
        // If not granted, show our premium modal
        setShowPermissionModal(true);
      } catch (err) {
        console.warn('Rider Home permission check error:', err);
      }
    })();
  }, []);

  const handlePermissionAllow = () => {
    setShowPermissionModal(false);
    // Allow the JS modal to completely close before showing the native OS alert
    setTimeout(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        initLocation();
      }
    }, 500);
  };

  const handlePermissionDeny = () => {
    setShowPermissionModal(false);
  };

  const initLocation = async () => {
    try {
      // Get current position
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      // Optional: reverse geocode to get address
      const [address] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (address) {
        const fullAddr = `${address.name || ''} ${address.street || ''}, ${address.city || ''}`.trim();
        setCurrentAddress(fullAddr);
      }
    } catch (err) {
      console.warn('Rider Home initLocation error:', err);
    }
  };

  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from('available_drivers')
      .select('*')
      .eq('is_online', true);
    
    if (!error && data) {
      setDrivers(data);
    }
  };

  const mapStyle = isDark ? [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  ] : [];

  const homePlace = savedPlaces.find(p => p.type === 'home');
  const workPlace = savedPlaces.find(p => p.type === 'work');

  const handleQuickLocPress = (type: 'home' | 'work') => {
    const place = type === 'home' ? homePlace : workPlace;
    if (place) {
      setDestinationLocation({ latitude: place.lat, longitude: place.lng });
      setDestinationAddress(place.address);
      router.push('/book-ride');
    } else {
      // Navigate to search with an intention to save
      router.push(`/destination?save=${type}`);
    }
  };

  const handleRecentPress = (place: RecentPlace) => {
    setDestinationLocation({ latitude: place.lat, longitude: place.lng });
    setDestinationAddress(place.address);
    router.push('/book-ride');
  };

  const fetchRecentPlaces = async () => {
    if (!authUser?.id) return;
    const { data, error } = await supabase
      .from('rides')
      .select('destination_address, destination_lat, destination_lng')
      .eq('rider_id', authUser.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      // Filter for unique addresses
      const unique: RecentPlace[] = [];
      const seen = new Set();
      data.forEach((r, idx) => {
        if (!seen.has(r.destination_address)) {
          seen.add(r.destination_address);
          if (unique.length < 2) {
            unique.push({
              id: idx.toString(),
              name: r.destination_address.split(',')[0],
              address: r.destination_address,
              lat: r.destination_lat,
              lng: r.destination_lng
            });
          }
        }
      });
      setRecentPlaces(unique);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };



  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Map section */}
      <View style={s.mapContainer}>
        {Platform.OS === 'web' || !MapView ? (
          <LinearGradient
            colors={[C.mapA, C.mapB, C.mapC]}
            style={s.map}
          >
            {[0,1,2,3,4,5,6].map(i => (
              <View key={`h${i}`} style={[s.road, s.roadH, { top: 50 + i * 54, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' }]} />
            ))}
            {[0,1,2,3,4].map(i => (
              <View key={`v${i}`} style={[s.road, s.roadV, { left: 40 + i * 80, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' }]} />
            ))}
          </LinearGradient>
        ) : (
            <MapView
            ref={mapRef}
            style={s.map}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            customMapStyle={mapStyle}
            initialRegion={{
              latitude: (currentLocation?.latitude || 6.5244) - 0.0004,
              longitude: currentLocation?.longitude || 3.3792,
              latitudeDelta: 0.0015,
              longitudeDelta: 0.0015,
            }}
            region={currentLocation ? {
              latitude: currentLocation.latitude - 0.0004,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.0015,
              longitudeDelta: 0.0015,
            } : undefined}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={false}
          >
            {drivers.map(driver => (
              <Marker
                key={driver.id}
                coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
                flat
              >
                <PremiumVehicleMarker heading={driver.heading || 0} />
              </Marker>
            ))}
          </MapView>
        )}
      </View>

      <LinearGradient
        colors={[C.background, isDark ? 'rgba(13,17,23,0.5)' : 'rgba(245,246,250,0.5)', 'transparent']}
        style={s.mapFadeTop}
        pointerEvents="none"
      />

      <LinearGradient
        colors={['transparent', isDark ? 'rgba(13,17,23,0.75)' : 'rgba(245,246,250,0.75)', C.background]}
        style={s.mapFade}
        pointerEvents="none"
      />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <View>
          <Text style={[s.greeting, { color: C.textSecondary }]}>{getGreeting()} 👋</Text>
          <Text style={[s.userName, { color: C.text }]}>{firstName}</Text>
        </View>
        <View style={s.headerRight}>
          <NotificationBell size={20} color={C.text} />
          <TouchableOpacity 
            style={[s.avatar, { backgroundColor: Colors.brand.primary }]}
            onPress={() => router.push('/(user)/(tabs)/profile')}
          >
            {authUser?.avatar ? (
              <Image source={{ uri: authUser.avatar }} style={s.avatarImg} />
            ) : (
              <Text style={s.avatarTxt}>{firstName[0]}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable bottom content */}
      <ScrollView style={[s.scroll, { marginTop: height * 0.18 }]} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        {/* Search bar */}
        <View style={s.searchWrap}>
          <TouchableOpacity 
            style={[s.searchBar, { backgroundColor: C.searchBar, borderColor: C.border, shadowColor: C.shadow }]} 
            activeOpacity={0.85}
            onPress={() => router.push('/destination')}
          >
            <LinearGradient colors={[Colors.brand.primary, Colors.brand.primaryLight]} style={s.dot} />
            <Text style={[s.searchTxt, { color: C.textMuted }]}>Where to?</Text>
            <View style={[s.nowBadge, { backgroundColor: C.tint + '18' }]}>
              <Ionicons name="time-outline" size={13} color={C.tint} />
              <Text style={[s.nowTxt, { color: C.tint }]}>Now</Text>
            </View>
          </TouchableOpacity>

          <View style={s.quickRow}>
            {/* Home Quick Loc */}
            <TouchableOpacity 
              style={[s.quickCard, { backgroundColor: C.surface, borderColor: C.border }]} 
              activeOpacity={0.8}
              onPress={() => handleQuickLocPress('home')}
            >
              <View style={[s.quickIcon, { backgroundColor: C.tint + '15' }]}>
                <Ionicons name="home" size={15} color={C.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.quickLabel, { color: C.text }]}>Home</Text>
                <Text style={[s.quickAddr, { color: C.textMuted }]} numberOfLines={1}>
                  {homePlace ? homePlace.address : 'Add Home'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Work Quick Loc */}
            <TouchableOpacity 
              style={[s.quickCard, { backgroundColor: C.surface, borderColor: C.border }]} 
              activeOpacity={0.8}
              onPress={() => handleQuickLocPress('work')}
            >
              <View style={[s.quickIcon, { backgroundColor: C.tint + '15' }]}>
                <Ionicons name="briefcase" size={15} color={C.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.quickLabel, { color: C.text }]}>Work</Text>
                <Text style={[s.quickAddr, { color: C.textMuted }]} numberOfLines={1}>
                  {workPlace ? workPlace.address : 'Add Work'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>



        {/* Send Package */}
        <View style={[s.section, { paddingHorizontal: 20 }]}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => router.push('/send-package')}
            style={[s.packageCard, { backgroundColor: C.surface, borderColor: C.border }]}
          >
            <View style={[s.packageIcon, { backgroundColor: Colors.brand.primary + '15' }]}>
              <Ionicons name="cube" size={22} color={Colors.brand.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.packageTitle, { color: C.text }]}>Send a Package</Text>
              <Text style={[s.packageSub, { color: C.textMuted }]}>Fast courier delivery to any location</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Promo */}
        <View style={s.section}>
          <LinearGradient colors={[Colors.brand.primary, Colors.brand.primaryLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.promo}>
            <View>
              <Text style={s.promoTag}>LIMITED OFFER</Text>
              <Text style={s.promoTitle}>20% off your next 3 rides</Text>
              <Text style={s.promoSub}>Use code GORIDE20</Text>
            </View>
            <View style={s.promoIcon}>
              <Ionicons name="gift-outline" size={32} color="rgba(255,255,255,0.9)" />
            </View>
          </LinearGradient>
        </View>

        {/* Recent */}
        {recentPlaces.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: C.text }]}>Recent Places</Text>
            <View style={[s.recentCard, { backgroundColor: C.surface, borderColor: C.border }]}>
              {recentPlaces.map((place, idx) => (
                <View key={place.id}>
                  <TouchableOpacity style={s.recentRow} activeOpacity={0.7} onPress={() => handleRecentPress(place)}>
                    <View style={[s.recentIcon, { backgroundColor: C.surfaceAlt }]}>
                      <Ionicons name="location-outline" size={15} color={C.icon} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.recentName, { color: C.text }]}>{place.name}</Text>
                      <Text style={[s.recentAddr, { color: C.textMuted }]} numberOfLines={1}>{place.address}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color={C.textMuted} />
                  </TouchableOpacity>
                  {idx < recentPlaces.length - 1 && <View style={[s.divider, { backgroundColor: C.border }]} />}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Book CTA */}
        <View style={[s.section, { paddingHorizontal: 20 }]}>
          <TouchableOpacity activeOpacity={0.88} onPress={() => router.push('/destination')}>
            <LinearGradient colors={[Colors.brand.primary, Colors.brand.primaryLight]} style={s.bookBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="car" size={20} color="#fff" />
              <Text style={s.bookTxt}>Book a Ride</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {/* Premium Location Permission Modal */}
      <LocationPermissionModal
        isVisible={showPermissionModal}
        onAllow={handlePermissionAllow}
        onDeny={handlePermissionDeny}
        role="user"
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  mapContainer: { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.4 },
  map: { width: '100%', height: '100%' },
  driverMarker: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  road: { position: 'absolute', borderRadius: 6 },
  roadH: { left: 0, right: 0, height: 11 },
  roadV: { top: 0, bottom: 0, width: 11 },
  pin: { position: 'absolute', top: '42%', left: '47%', alignItems: 'center' },
  pinCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.brand.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8 },
  pinShadow: { width: 18, height: 8, borderRadius: 9, marginTop: 2 },
  mapFadeTop: { position: 'absolute', left: 0, right: 0, top: 0, height: height * 0.18 },
  mapFade: { position: 'absolute', left: 0, right: 0, top: height * 0.22, height: height * 0.18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  greeting: { fontSize: 13, fontWeight: '500' },
  userName: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  badge: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F44336', position: 'absolute', top: 8, right: 8, borderWidth: 1.5, borderColor: '#fff' },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  scroll: { flex: 1 },
  searchWrap: { paddingHorizontal: 16, marginBottom: 4 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, gap: 12, elevation: 8, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, marginBottom: 10 },
  dot: { width: 13, height: 13, borderRadius: 7 },
  searchTxt: { flex: 1, fontSize: 16, fontWeight: '500' },
  nowBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  nowTxt: { fontSize: 12, fontWeight: '600' },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, padding: 12, borderWidth: 1 },
  quickIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 13, fontWeight: '700' },
  quickAddr: { fontSize: 11, marginTop: 1 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12, paddingHorizontal: 20, letterSpacing: -0.2 },

  promo: { marginHorizontal: 20, borderRadius: 10, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  promoTag: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.75)', letterSpacing: 1.2, marginBottom: 4 },
  promoTitle: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 4 },
  promoSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  promoIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  recentCard: { marginHorizontal: 20, borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  recentRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  recentIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  recentName: { fontSize: 14, fontWeight: '600' },
  recentAddr: { fontSize: 12, marginTop: 2 },
  divider: { height: 1, marginLeft: 64 },
  bookBtn: { borderRadius: 10, paddingVertical: 17, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, elevation: 6, shadowColor: Colors.brand.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
  bookTxt: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  packageCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 12, padding: 16, borderWidth: 1 },
  packageIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  packageTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  packageSub: { fontSize: 12, fontWeight: '500' },
});
