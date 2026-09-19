import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';

type SavedPlace = {
  id: string;
  type: 'home' | 'work' | 'favorite';
  title: string;
  address: string;
  lat: number;
  lng: number;
};

export default function SavedPlacesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme, setDestinationLocation, setDestinationAddress } = useAppContext();
  const { authUser } = useAuth();
  const C = Colors[colorScheme];

  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlaces();
  }, [authUser]);

  const fetchPlaces = async () => {
    if (!authUser) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('saved_places')
      .select('*')
      .eq('user_id', authUser.id)
      .order('type', { ascending: true });

    if (data && !error) {
      setPlaces(data);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string, type: string) => {
    Alert.alert('Remove Place', `Are you sure you want to remove this ${type}?`, [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Remove', 
        style: 'destructive',
        onPress: async () => {
          await supabase.from('saved_places').delete().eq('id', id);
          fetchPlaces();
        }
      }
    ]);
  };

  const handlePress = (place: SavedPlace) => {
    setDestinationLocation({ latitude: place.lat, longitude: place.lng });
    setDestinationAddress(place.address);
    router.push('/book-ride');
  };

  const renderPlaceCard = (place: SavedPlace) => {
    const iconMap = {
      home: 'home',
      work: 'briefcase',
      favorite: 'star'
    };

    return (
      <View key={place.id} style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
        <TouchableOpacity style={s.cardBody} onPress={() => handlePress(place)}>
          <View style={[s.iconWrap, { backgroundColor: C.surfaceAlt }]}>
            <Ionicons name={iconMap[place.type] as any || 'location'} size={20} color={C.tint} />
          </View>
          <View style={s.infoWrap}>
            <Text style={[s.title, { color: C.text }]}>{place.title}</Text>
            <Text style={[s.address, { color: C.textSecondary }]} numberOfLines={2}>{place.address}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(place.id, place.title)}>
          <Ionicons name="trash-outline" size={20} color={Colors.brand.danger || '#FF3B30'} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: C.background, paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: C.text }]}>Saved Places</Text>
        <View style={s.backBtn} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.tint} />
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={{ padding: 20 }}>
          {places.length === 0 ? (
            <View style={s.emptyState}>
              <Ionicons name="location-outline" size={48} color={C.textMuted} />
              <Text style={[s.emptyTxt, { color: C.textSecondary }]}>No saved places yet.</Text>
            </View>
          ) : (
            places.map(renderPlaceCard)
          )}

          <TouchableOpacity 
            style={[s.addBtn, { backgroundColor: C.tint }]}
            onPress={() => router.push('/destination?save=favorite')}
          >
            <Ionicons name="add" size={20} color={colorScheme === 'dark' ? '#000' : '#fff'} />
            <Text style={[s.addBtnTxt, { color: colorScheme === 'dark' ? '#000' : '#fff' }]}>Add New Place</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyTxt: { fontSize: 16, marginTop: 16 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  cardBody: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  infoWrap: { flex: 1, marginRight: 12 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  address: { fontSize: 14, lineHeight: 20 },
  deleteBtn: { padding: 8 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, marginTop: 12 },
  addBtnTxt: { fontSize: 16, fontWeight: '600', marginLeft: 8 },
});
