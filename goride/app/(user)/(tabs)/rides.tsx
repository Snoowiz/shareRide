import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, RefreshControl, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

const FILTERS = ['All', 'Completed', 'Cancelled'];
const PAGE_SIZE = 20;

const STATUS_COLORS: Record<string, string> = {
  completed: '#00C853',
  cancelled: '#F44336',
  searching: '#FF9800',
  accepted: '#3B82F6',
  ongoing: '#22C55E',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  } else if (diffDays === 1) {
    return `Yesterday, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  } else {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      `, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }
}

function RideCard({ ride, C }: { ride: any; C: typeof Colors['light'] }) {
  const driverName = ride.driver_first_name
    ? `${ride.driver_first_name} ${ride.driver_last_name || ''}`.trim()
    : 'Unassigned';
  const driverInitial = driverName[0] || '?';
  const rating = ride.rider_rating;

  return (
    <TouchableOpacity 
      style={[s.rideCard, { backgroundColor: C.card, borderColor: C.border }]} 
      activeOpacity={0.8}
      onPress={() => ride.onPress && ride.onPress(ride)}
    >
      <View style={s.routeCol}>
        <View style={[s.routeDot, { backgroundColor: C.tint }]} />
        <View style={[s.routeLine, { backgroundColor: C.border }]} />
        <View style={[s.routeDot, { backgroundColor: C.textSecondary, width: 8, height: 8 }]} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.rideRow}>
          <Text style={[s.rideFrom, { color: C.text }]} numberOfLines={1}>
            {ride.is_package ? '📦 ' : ''}{ride.pickup_address || 'Pickup'}
          </Text>
          <View style={[s.statusBadge, { backgroundColor: (STATUS_COLORS[ride.status] || '#888') + '18' }]}>
            <Text style={[s.statusTxt, { color: STATUS_COLORS[ride.status] || '#888' }]}>
              {ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}
            </Text>
          </View>
        </View>
        <Text style={[s.rideTo, { color: C.textSecondary }]} numberOfLines={1}>
          {ride.destination_address || 'Destination'}
        </Text>
        <View style={s.rideMeta}>
          <Text style={[s.rideMeta1, { color: C.textMuted }]}>{formatDate(ride.created_at)}</Text>
          <Text style={[s.rideMeta1, { color: C.textMuted }]}>·</Text>
          <Text style={[s.rideMeta1, { color: C.textMuted }]}>{ride.ride_type || 'GoRide'}</Text>
        </View>
        <View style={s.rideBottom}>
          <View style={s.driverRow}>
            <View style={[s.driverAvatar, { backgroundColor: C.tint + '20' }]}>
              <Text style={[s.driverInitial, { color: C.tint }]}>{driverInitial}</Text>
            </View>
            <Text style={[s.driverName, { color: C.textSecondary }]}>{driverName}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.fare, { color: C.text }]}>₦{(ride.fare || 0).toLocaleString()}</Text>
            {['accepted', 'in_transit'].includes(ride.status) && (
              <View style={[s.resumeBadge, { backgroundColor: Colors.brand.primary }]}>
                <Text style={s.resumeTxt}>Tap to Resume</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

import Modal from 'react-native-modal';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';

export default function RidesScreen() {
  const { colorScheme } = useAppContext();
  const { authUser } = useAuth();
  const C = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [filter, setFilter] = useState('All');
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ count: 0, spent: 0, avgRating: 0 });
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  const handleCancelRequest = async () => {
    if (!selectedRequest) return;
    setLoading(true);
    try {
      const table = selectedRequest.is_package ? 'deliveries' : 'rides';
      const { error } = await supabase.from(table).update({ status: 'cancelled' }).eq('id', selectedRequest.id);
      if (error) throw error;
      setSelectedRequest(null);
      fetchRides();
    } catch (err: any) {
      console.warn('Cancel error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRides = useCallback(async (showLoader = true) => {
    if (!authUser?.id) return;
    if (showLoader) setLoading(true);

    try {
      // Fetch ONLY rides
      let ridesQuery = supabase
        .from('rides')
        .select('*')
        .eq('rider_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (filter !== 'All') {
        const filterStr = filter.toLowerCase();
        ridesQuery = ridesQuery.eq('status', filterStr);
      }

      const { data: ridesRes, error } = await ridesQuery;
      if (error) throw error;

      const normalizedRides = (ridesRes || []).map(r => ({
        ...r,
        is_package: false
      }));

      let combinedData = [...normalizedRides];

      // Fetch driver names for each request
      const driverIds = [...new Set(combinedData.filter(r => r.driver_id).map(r => r.driver_id))];
      let driverMap: Record<string, any> = {};
      if (driverIds.length > 0) {
        const { data: drivers } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', driverIds);
        if (drivers) {
          drivers.forEach(d => { driverMap[d.id] = d; });
        }
      }

      // Fetch ratings the rider gave
      const rideIds = combinedData.map(r => r.id);
      let ratingMap: Record<string, number> = {};
      if (rideIds.length > 0) {
        const { data: ratings } = await supabase
          .from('ratings')
          .select('ride_id, rating')
          .eq('rater_id', authUser.id)
          .in('ride_id', rideIds);
        if (ratings) {
          ratings.forEach(r => { ratingMap[r.ride_id] = r.rating; });
        }
      }

      // Merge
      const enriched = combinedData.map(r => ({
        ...r,
        driver_first_name: driverMap[r.driver_id]?.first_name || null,
        driver_last_name: driverMap[r.driver_id]?.last_name || null,
        rider_rating: ratingMap[r.id] || null,
        onPress: (item: any) => {
          if (item.status === 'searching') {
            setSelectedRequest(item);
          } else if (['accepted', 'in_transit'].includes(item.status)) {
            router.push({ pathname: '/trip-progress', params: { rideId: item.id } });
          }
        }
      }));

      setRides(enriched);

      // Stats (always from all completed)
      const { data: allCompletedRides } = await supabase
        .from('rides')
        .select('fare')
        .eq('rider_id', authUser.id)
        .eq('status', 'completed');
        
      const completedCount = (allCompletedRides?.length || 0);
      const totalSpent = (allCompletedRides || []).reduce((sum, r) => sum + (parseFloat(r.fare) || 0), 0);

      // Average rating
      const { data: avgData } = await supabase
        .from('ratings')
        .select('rating')
        .eq('rated_id', authUser.id);
      const avgRating = avgData && avgData.length > 0
        ? (avgData.reduce((s, r) => s + r.rating, 0) / avgData.length).toFixed(1)
        : '0';

      setStats({ count: completedCount, spent: totalSpent, avgRating: parseFloat(avgRating) });
    } catch (err) {
      console.error('Error fetching activity:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authUser?.id, filter]);

  useEffect(() => { fetchRides(); }, [fetchRides]);

  const onRefresh = () => { setRefreshing(true); fetchRides(false); };

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <LinearGradient
        colors={[Colors.brand.primary, Colors.brand.primaryLight]}
        style={[s.header, { paddingTop: insets.top + 12 }]}
      >
        <Text style={s.headerTitle}>My Rides</Text>
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statVal}>{stats.count}</Text>
            <Text style={s.statLabel}>Rides</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={s.statVal}>₦{stats.spent.toLocaleString()}</Text>
            <Text style={s.statLabel}>Spent</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={s.statVal}>{stats.avgRating > 0 ? stats.avgRating : '—'} <Ionicons name="star" size={12} color="#FFD700" /></Text>
            <Text style={s.statLabel}>Avg Rating</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={[s.filterWrap, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {FILTERS.map(f => {
            const active = filter === f;
            return (
              <TouchableOpacity
                key={f}
                style={[s.filterChip, { backgroundColor: active ? C.tint : C.surfaceAlt, borderColor: active ? C.tint : C.border }]}
                onPress={() => setFilter(f)}
              >
                <Text style={[s.filterTxt, { color: active ? (colorScheme === 'dark' ? '#000' : '#fff') : C.textSecondary }]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.tint} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={C.tint} style={{ marginTop: 60 }} />
        ) : rides.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="car-outline" size={52} color={C.textMuted} />
            <Text style={[s.emptyTxt, { color: C.textMuted }]}>
              {filter === 'All' ? "You haven't taken any rides yet.\nBook your first trip!" : `No ${filter.toLowerCase()} rides found.`}
            </Text>
          </View>
        ) : (
          rides.map(ride => <RideCard key={ride.id} ride={ride} C={C} />)
        )}
      </ScrollView>

      {/* Broadcasting Modal for 'searching' requests */}
      <Modal
        isVisible={!!selectedRequest}
        backdropOpacity={0.7}
        animationIn="zoomIn"
        animationOut="zoomOut"
        useNativeDriver
        onBackdropPress={() => setSelectedRequest(null)}
        style={s.searchPopupModal}
      >
        <View style={[s.searchPopupContent, { backgroundColor: C.background }]}>
          {selectedRequest?.status === 'searching' ? (
            <>
              <View style={s.pulseContainer}>
                <View style={[s.pulseInner, { backgroundColor: Colors.brand.secondary }]}>
                  <Ionicons name={selectedRequest?.is_package ? "cube" : "car"} size={44} color="#fff" />
                </View>
              </View>
              
              <Text style={[s.searchTitle, { color: C.text }]}>Broadcasting Request...</Text>
              <Text style={[s.searchSub, { color: C.textSecondary }]}>
                Still looking for a nearby {selectedRequest?.is_package ? 'deliveryman' : 'driver'}
              </Text>
              
              <View style={[s.searchDetailsPopup, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                 <View style={[s.searchDetailItem, { borderRightWidth: 1, borderRightColor: C.border }]}>
                    <Text style={[s.searchDetailVal, { color: C.text }]} numberOfLines={1}>
                      {selectedRequest?.ride_type || 'Ride'}
                    </Text>
                    <Text style={[s.searchDetailLab, { color: C.textMuted }]}>Type</Text>
                 </View>
                 <View style={s.searchDetailItem}>
                    <Text style={[s.searchDetailVal, { color: Colors.brand.secondary }]}>
                      ₦{(selectedRequest?.offer_fare || selectedRequest?.fare || 0).toLocaleString()}
                    </Text>
                    <Text style={[s.searchDetailLab, { color: C.textMuted }]}>Price</Text>
                 </View>
              </View>

              <View style={s.modalActionRow}>
                <TouchableOpacity 
                  style={[s.modalActionBtn, { borderColor: C.border }]}
                  onPress={() => setSelectedRequest(null)}
                >
                  <Text style={[s.modalActionTxt, { color: C.text }]}>Close</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[s.modalActionBtn, { backgroundColor: Colors.brand.danger + '10', borderColor: Colors.brand.danger + '40' }]}
                  onPress={handleCancelRequest}
                >
                  <Text style={[s.modalActionTxt, { color: Colors.brand.danger }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : selectedRequest?.is_package ? (
            <>
              <View style={{ width: '100%', alignItems: 'center' }}>
                <Text style={[s.searchTitle, { color: C.text, marginBottom: 4 }]}>Package Details</Text>
                <View style={[s.statusBadge, { backgroundColor: (STATUS_COLORS[selectedRequest.status] || '#888') + '18', marginBottom: 20 }]}>
                  <Text style={[s.statusTxt, { color: STATUS_COLORS[selectedRequest.status] || '#888' }]}>
                    {selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                  </Text>
                </View>

                {selectedRequest.parcel_image_url ? (
                  <Image 
                    source={{ uri: selectedRequest.parcel_image_url }} 
                    style={{ width: '100%', height: 200, borderRadius: 16, marginBottom: 16 }} 
                    resizeMode="cover" 
                  />
                ) : (
                  <View style={{ width: '100%', height: 120, borderRadius: 16, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Ionicons name="cube-outline" size={40} color={C.textMuted} />
                    <Text style={{ color: C.textMuted, marginTop: 8 }}>No image provided</Text>
                  </View>
                )}

                <View style={[s.searchDetailsPopup, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', marginBottom: 16, padding: 12 }]}>
                   <View style={{ flex: 1 }}>
                      <Text style={{ color: C.textMuted, fontSize: 12, marginBottom: 4 }}>Delivery To</Text>
                      <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }} numberOfLines={2}>
                        {selectedRequest.destination_address}
                      </Text>
                   </View>
                </View>

                {selectedRequest.driver_first_name && (
                  <View style={[s.searchDetailsPopup, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', marginBottom: 24, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                    <View style={[s.driverAvatar, { backgroundColor: C.tint + '20', width: 36, height: 36, borderRadius: 18 }]}>
                      <Text style={[s.driverInitial, { color: C.tint, fontSize: 16 }]}>{selectedRequest.driver_first_name.charAt(0)}</Text>
                    </View>
                    <View>
                      <Text style={{ color: C.textMuted, fontSize: 12 }}>Courier</Text>
                      <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>{selectedRequest.driver_first_name} {selectedRequest.driver_last_name}</Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity 
                  style={[s.cancelSearchBtnPopup, { borderColor: C.border }]}
                  onPress={() => setSelectedRequest(null)}
                >
                  <Text style={[s.cancelSearchTxt, { color: C.text }]}>Close Preview</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 16, letterSpacing: -0.3 },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 14 },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { color: '#fff', fontSize: 18, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.25)' },
  filterWrap: { borderBottomWidth: 1 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  filterTxt: { fontSize: 13, fontWeight: '600' },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  rideCard: { borderRadius: 10, borderWidth: 1, padding: 16, flexDirection: 'row', gap: 14 },
  routeCol: { alignItems: 'center', paddingTop: 4, paddingBottom: 4, width: 12 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { flex: 1, width: 2, marginVertical: 4, borderRadius: 1 },
  rideRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  rideFrom: { fontSize: 15, fontWeight: '700', flex: 1 },
  rideTo: { fontSize: 13, marginBottom: 4 },
  rideMeta: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  rideMeta1: { fontSize: 12 },
  rideBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  driverAvatar: { width: 24, height: 24, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  driverInitial: { fontSize: 11, fontWeight: '700' },
  driverName: { fontSize: 12 },
  stars: { flexDirection: 'row', gap: 1 },
  fare: { fontSize: 16, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusTxt: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTxt: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  searchPopupModal: { justifyContent: 'center', margin: 24 },
  searchPopupContent: { borderRadius: 24, padding: 24, alignItems: 'center' },
  pulseContainer: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  pulseInner: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: Colors.brand.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  searchTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  searchSub: { fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  searchDetailsPopup: { flexDirection: 'row', borderRadius: 16, padding: 16, marginBottom: 24, width: '100%' },
  searchDetailItem: { flex: 1, alignItems: 'center', gap: 4 },
  searchDetailVal: { fontSize: 16, fontWeight: '800' },
  searchDetailLab: { fontSize: 12, fontWeight: '600' },
  cancelSearchBtnPopup: { width: '100%', paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, alignItems: 'center' },
  cancelSearchTxt: { fontSize: 15, fontWeight: '700' },
  modalActionRow: { flexDirection: 'row', gap: 12, width: '100%' },
  modalActionBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  modalActionTxt: { fontSize: 15, fontWeight: '700' },
  resumeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 6 },
  resumeTxt: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
});
