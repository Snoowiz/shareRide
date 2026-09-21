import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Keyboard, TouchableWithoutFeedback, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import LocationPermissionModal from '@/components/LocationPermissionModal';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_APIKEY || '';

export default function DestinationScreen() {
  const router = useRouter();
  const { save } = useLocalSearchParams<{ save: string }>();
  const insets = useSafeAreaInsets();
  const { authUser } = useAuth();
  const { 
    colorScheme, 
    currentLocation, 
    setCurrentLocation, 
    currentAddress, 
    setCurrentAddress,
    setDestinationLocation,
    setDestinationAddress 
  } = useAppContext();
  const C = Colors[colorScheme];

  const [destination, setDestination] = useState<{ lat: number, lng: number, address: string } | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);

  const googleInputRef = React.useRef<any>(null);

  useEffect(() => {
    if (authUser?.id) {
      supabase
        .from('saved_places')
        .select('*')
        .eq('user_id', authUser.id)
        .then(({ data }: any) => {
          if (data) setSavedPlaces(data);
        });
      
      fetchHistory();
    }
  }, [authUser]);

  const fetchHistory = async () => {
    if (!authUser?.id) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from('search_history')
      .select('*')
      .eq('user_id', authUser.id)
      .order('searched_at', { ascending: false })
      .limit(10);
    if (data) setHistory(data);
    setLoadingHistory(false);
  };

  const clearHistory = async () => {
    if (!authUser?.id) return;
    await supabase.from('search_history').delete().eq('user_id', authUser.id);
    setHistory([]);
  };

  const saveToHistory = async (data: any, details: any) => {
    if (!authUser?.id || !details) return;
    
    // Deduplicate by updating searched_at if exists
    await supabase.from('search_history').upsert({
      user_id: authUser.id,
      place_id: data.place_id,
      name: data.structured_formatting?.main_text || data.description.split(',')[0],
      address: data.description,
      latitude: details.geometry.location.lat,
      longitude: details.geometry.location.lng,
      searched_at: new Date().toISOString()
    }, { onConflict: 'user_id,place_id' });

    fetchHistory(); // Refresh
  };

  const predefinedLocations = savedPlaces.map(place => ({
    description: `★ ${place.title} - ${place.address}`,
    geometry: { location: { lat: place.lat, lng: place.lng, latitude: place.lat, longitude: place.lng } }
  }));

  // Check if we already have permission, if not show our premium modal first
  useEffect(() => {
    (async () => {
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      if (existingStatus === 'granted') {
        // Already have permission, proceed directly
        setPermissionChecked(true);
        fetchLocationData();
        return;
      }
      // Show our premium pre-permission modal
      setShowPermissionModal(true);
    })();
  }, []);

  const handlePermissionAllow = () => {
    setShowPermissionModal(false);
    // Allow the JS modal to fully unmount before showing the native OS permission dialog
    setTimeout(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setPermissionChecked(true);
        fetchLocationData();
      } else {
        setCurrentAddress('Location permission denied');
        setPermissionChecked(true);
      }
    }, 500);
  };

  const handlePermissionDeny = () => {
    setShowPermissionModal(false);
    setCurrentAddress('Location permission denied');
    setPermissionChecked(true);
  };

  const fetchLocationData = async () => {
    try {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCurrentAddress('Location permission denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const coords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      
      // Calculate diff if we already have a location
      if (currentLocation) {
        const latDiff = Math.abs(currentLocation.latitude - coords.latitude);
        const lonDiff = Math.abs(currentLocation.longitude - coords.longitude);
        // ~50 meters is roughly 0.0005 degrees
        if (latDiff < 0.0005 && lonDiff < 0.0005) {
          return; // Skip updating if location hasn't meaningfully changed
        }
      }
      
      setCurrentLocation(coords);

      try {
        let geocode = await Location.reverseGeocodeAsync(coords);
        if (geocode && geocode.length > 0) {
          const place = geocode[0];
          let formattedAddress = 'Current Location';
          if (place.streetNumber && place.street) {
            formattedAddress = `${place.streetNumber} ${place.street}`;
          } else if (place.name && place.name !== place.street) {
            formattedAddress = place.name;
          } else if (place.street) {
            formattedAddress = place.street;
          }
          
          if (place.city && formattedAddress !== 'Current Location') {
            setCurrentAddress(`${formattedAddress}, ${place.city}`);
          } else {
            setCurrentAddress(formattedAddress);
          }
        } else {
          setCurrentAddress('Current Location');
        }
      } catch (error) {
        setCurrentAddress('Current Location');
      }
    } catch (err) {
      setCurrentAddress('Current Location');
    }
  };

  const handleConfirm = async () => {
    if (destination) {
      if (save && authUser) {
        // Upsert logic for home/work/favorite
        await supabase.from('saved_places').upsert({
          user_id: authUser.id,
          type: save,
          title: save.charAt(0).toUpperCase() + save.slice(1), // Home or Work
          address: destination.address,
          lat: destination.lat,
          lng: destination.lng
        }, { onConflict: 'user_id,type' });
        
        router.back();
      } else {
        setDestinationLocation({ latitude: destination.lat, longitude: destination.lng });
        setDestinationAddress(destination.address);
        router.replace('/book-ride');
      }
    }
  };

  return (
    <>
      <View style={[s.root, { backgroundColor: C.background, paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </TouchableOpacity>
          <Text style={[s.title, { color: C.text }]}>Destination</Text>
          <View style={s.backBtn} /> 
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 90 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[s.inputsContainer, { backgroundColor: C.surface, borderColor: C.border }]}>
            
            <View style={[s.inputRow, { zIndex: 1000 }]}>
              <View style={s.iconWrap}>
                <View style={[s.dot, { borderColor: C.text }]} />
              </View>
              <View style={{ flex: 1 }}>
                <GooglePlacesAutocomplete
                  placeholder={currentAddress || "Pickup Location"}
                  fetchDetails
                  onPress={(data, details = null) => {
                    if (details) {
                      setCurrentLocation({
                        latitude: details.geometry.location.lat,
                        longitude: details.geometry.location.lng,
                      });
                      setCurrentAddress(data.description);
                    }
                    Keyboard.dismiss();
                  }}
                  query={{
                    key: GOOGLE_API_KEY,
                    language: 'en',
                    components: 'country:ng',
                  }}
                  debounce={400}
                  suppressDefaultStyles={false}
                  styles={{
                    container: { flex: 0 },
                    textInputContainer: { backgroundColor: 'transparent', height: 40, paddingBottom: 0, borderTopWidth: 0, borderBottomWidth: 0 },
                    textInput: {
                      color: C.text,
                      fontSize: 15,
                      backgroundColor: 'transparent',
                      paddingHorizontal: 0,
                      margin: 0,
                      height: 40,
                      fontWeight: '600',
                    },
                    listView: {
                      position: 'absolute',
                      top: 45,
                      backgroundColor: C.surface,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: C.border,
                      elevation: 5,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      maxHeight: 250,
                    },
                    row: { backgroundColor: 'transparent', padding: 12, height: 48, flexDirection: 'row' },
                    separator: { height: 1, backgroundColor: C.border },
                    description: { color: C.text, fontSize: 14 },
                  }}
                  textInputProps={{
                    placeholderTextColor: C.textSecondary,
                    clearButtonMode: 'always',
                  }}
                  enablePoweredByContainer={false}
                />
              </View>
            </View>

            <View style={s.lineConnection}>
              <View style={[s.dashLine, { backgroundColor: C.border }]} />
              <View style={[s.dashLine, { backgroundColor: C.border }]} />
              <View style={[s.dashLine, { backgroundColor: C.border }]} />
            </View>

            
            <View style={[s.inputRow, { zIndex: 999 }]}>
              <View style={s.iconWrap}>
                <Ionicons name="location-sharp" size={18} color={C.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <GooglePlacesAutocomplete
                  ref={googleInputRef}
                  placeholder="Where to?"
                  fetchDetails
                  onPress={(data, details = null) => {
                    if (details) {
                      const place = {
                        lat: details.geometry.location.lat,
                        lng: details.geometry.location.lng,
                        address: data.description,
                      };
                      setDestination(place);
                      saveToHistory(data, details);
                    }
                    Keyboard.dismiss();
                  }}
                  query={{
                    key: GOOGLE_API_KEY,
                    language: 'en',
                    components: 'country:ng',
                  }}
                  nearbyPlacesAPI="GooglePlacesSearch"
                  debounce={400}
                  predefinedPlaces={predefinedLocations}
                  predefinedPlacesAlwaysVisible={true}
                  suppressDefaultStyles={false}
                  listEmptyComponent={() => (
                    <View style={{ padding: 20 }}>
                      <Text style={{ color: C.textSecondary }}>No results found</Text>
                    </View>
                  )}
                  styles={{
                    container: { flex: 0 },
                    textInputContainer: { backgroundColor: 'transparent', height: 40, paddingBottom: 0, borderTopWidth: 0, borderBottomWidth: 0 },
                    textInput: {
                      color: C.text,
                      fontSize: 15,
                      backgroundColor: 'transparent',
                      paddingHorizontal: 0,
                      margin: 0,
                      height: 40,
                      fontWeight: '600',
                    },
                    listView: {
                      position: 'absolute',
                      top: 45,
                      backgroundColor: C.surface,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: C.border,
                      elevation: 5,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      maxHeight: 250,
                    },
                    row: { backgroundColor: 'transparent', padding: 12, height: 48, flexDirection: 'row' },
                    separator: { height: 1, backgroundColor: C.border },
                    description: { color: C.text, fontSize: 14 },
                  }}
                  textInputProps={{
                    placeholderTextColor: C.textMuted,
                    clearButtonMode: 'never',
                  }}
                  enablePoweredByContainer={false}
                />
              </View>
            </View>
          </View>

          
          <TouchableOpacity 
            style={[s.savedCard, { backgroundColor: C.surface, borderColor: C.border }]}
            onPress={() => router.push('/(user)/(tabs)/profile')}
          >
            <View style={s.savedIcon}>
              <Ionicons name="bookmark" size={18} color={C.tint} />
            </View>
            <Text style={[s.savedTxt, { color: C.text }]}>Manage Saved Places</Text>
            <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
          </TouchableOpacity>

          {/* Search History */}
          <View style={s.historySection}>
            <View style={s.historyHeader}>
              <Text style={[s.historyTitle, { color: C.text }]}>Recent Searches</Text>
              {history.length > 0 && (
                <TouchableOpacity onPress={clearHistory}>
                  <Text style={[s.clearHistory, { color: C.tint }]}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {loadingHistory ? (
              <ActivityIndicator size="small" color={C.tint} style={{ marginTop: 20 }} />
            ) : history.length > 0 ? (
              <View style={[s.historyCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
                  {history.map((item, index) => (
                    <TouchableOpacity 
                      key={item.id} 
                      style={[s.historyRow, index < history.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}
                      onPress={() => {
                        setDestination({ lat: item.latitude, lng: item.longitude, address: item.address });
                        googleInputRef.current?.setAddressText(item.address);
                      }}
                    >
                      <View style={[s.historyIcon, { backgroundColor: C.surfaceAlt }]}>
                        <Ionicons name="time-outline" size={18} color={C.icon} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.historyName, { color: C.text }]} numberOfLines={1}>{item.name}</Text>
                        <Text style={[s.historyAddr, { color: C.textMuted }]} numberOfLines={1}>{item.address}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : (
              <View style={s.emptyHistory}>
                <Ionicons name="search-outline" size={32} color={C.border} />
                <Text style={[s.emptyHistoryText, { color: C.textMuted }]}>Your search history will appear here</Text>
              </View>
            )}
          </View>

        </ScrollView>

        <View style={[s.floatingConfirmWrap, { paddingBottom: insets.bottom + 20, backgroundColor: C.background }]}>
          <TouchableOpacity
            style={[s.confirmBtn, { backgroundColor: destination ? C.tint : C.surfaceAlt }]}
            activeOpacity={0.8}
            disabled={!destination}
            onPress={handleConfirm}
          >
            <Text style={[s.confirmTxt, { color: destination ? (colorScheme === 'dark' ? '#000' : '#fff') : C.textMuted }]}>
              Confirm Location
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Premium Location Permission Modal */}
      <LocationPermissionModal
        isVisible={showPermissionModal}
        onAllow={handlePermissionAllow}
        onDeny={handlePermissionDeny}
        role="user"
      />
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  
  inputsContainer: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    zIndex: 99, // needed for autocomplete dropdown
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 24,
    alignItems: 'center',
    marginRight: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 3,
  },
  currentAddress: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  lineConnection: {
    marginLeft: 11,
    paddingVertical: 4,
    gap: 3,
  },
  dashLine: {
    width: 2,
    height: 4,
    borderRadius: 1,
  },

  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  savedIcon: {
    marginRight: 12,
  },
  savedTxt: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  
  floatingConfirmWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: '#00000010',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  confirmBtn: {
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTxt: {
    fontSize: 16,
    fontWeight: '700',
  },
  
  historySection: {
    marginTop: 24,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  clearHistory: {
    fontSize: 13,
    fontWeight: '600',
  },
  historyCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyName: {
    fontSize: 15,
    fontWeight: '600',
  },
  historyAddr: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyHistory: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyHistoryText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
