import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';

const FILTERS = ['All', 'Active', 'Completed', 'Cancelled', 'Today', 'Deliveries'];

const STATUS_COLORS: Record<string, string> = {
  completed: '#22C55E', cancelled: '#EF4444', searching: '#F59E0B',
  accepted: '#3B82F6', ongoing: '#22C55E', picked_up: '#3B82F6', in_transit: '#8B5CF6',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return `Today, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  if (diffDays === 1) return `Yesterday, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    `, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

function RideCard({ ride, C, isDark, onPress }: { ride: any; C: typeof Colors['light']; isDark: boolean; onPress?: (ride: any) => void }) {
  const riderName = ride.rider_first_name
    ? `${ride.rider_first_name} ${ride.rider_last_name || ''}`.trim()
    : 'Rider';

  const cardBg = ride.is_package ? (isDark ? '#FCCA1415' : '#FCCA1410') : C.surface;
  const isActive = ['accepted', 'picked_up', 'in_transit', 'ongoing'].includes(ride.status);

  return (
    <TouchableOpacity 
      style={[s.card, { backgroundColor: cardBg, borderColor: isActive ? Colors.driver.primary : C.border, borderWidth: isActive ? 2 : 1 }]} 
      activeOpacity={0.8}
      onPress={() => onPress && onPress(ride)}
    >
      <View style={s.cardTop}>
        <View style={s.cardTopLeft}>
          <View style={[s.riderCircle, { backgroundColor: '#FCCA1420' }]}>
            <Text style={s.riderInitial}>{riderName[0]}</Text>
          </View>
          <View>
            <Text style={[s.riderName, { color: C.text }]}>{riderName}</Text>
            <Text style={[s.dateTxt, { color: C.textMuted }]}>{formatDate(ride.sort_date || ride.created_at)}</Text>
          </View>
        </View>
        <View style={[s.statusPill, { backgroundColor: (STATUS_COLORS[ride.status] || '#888') + '15' }]}>
          <Text style={[s.statusTxt, { color: STATUS_COLORS[ride.status] || '#888' }]}>
            {ride.status === 'picked_up' || ride.status === 'in_transit' ? 'In Transit' : ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}
          </Text>
        </View>
      </View>

      <View style={s.routeSection}>
        <View style={s.routeRow}>
          <View style={[s.dot, { backgroundColor: '#22C55E' }]} />
          <Text style={[s.routeTxt, { color: C.textSecondary }]} numberOfLines={1}>
            {ride.is_package ? '📦 ' : ''}{ride.pickup_address || 'Pickup'}
          </Text>
        </View>
        <View style={[s.routeDash, { borderColor: C.border }]} />
        <View style={s.routeRow}>
          <View style={[s.dot, { backgroundColor: '#EF4444' }]} />
          <Text style={[s.routeTxt, { color: C.textSecondary }]} numberOfLines={1}>
            {ride.destination_address || 'Destination'}
          </Text>
        </View>
      </View>

      <View style={[s.cardBottom, { borderTopColor: C.border }]}>
        <View style={s.metaItem}>
          <Ionicons name="cash-outline" size={14} color={C.textMuted} />
          <Text style={[s.metaVal, { color: C.text }]}>₦{(ride.driver_payout || ride.fare || 0).toLocaleString()}</Text>
        </View>
        <View style={s.metaItem}>
          <Ionicons name="navigate-outline" size={14} color={C.textMuted} />
          <Text style={[s.metaVal, { color: C.textMuted }]}>{ride.distance_km?.toFixed(1) || '?'} km</Text>
        </View>
        <View style={s.metaItem}>
          <Ionicons name="time-outline" size={14} color={C.textMuted} />
          <Text style={[s.metaVal, { color: C.textMuted }]}>{ride.is_package ? '—' : `${Math.round(ride.duration_mins || 0)} min`}</Text>
        </View>
      </View>

      {isActive && (
        <View style={[s.resumeBanner, { backgroundColor: Colors.driver.primary + '20' }]}>
          <Text style={[s.resumeTxt, { color: Colors.driver.primary }]}>Active Task • Tap to Resume</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.driver.primary} />
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function RidesScreen() {
  const { colorScheme } = useAppContext();
  const { authUser } = useAuth();
  const C = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [filter, setFilter] = useState('All');
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ total: 0, today: 0, earned: 0 });

  const fetchRides = useCallback(async (showLoader = true) => {
    if (!authUser?.id) return;
    if (showLoader) setLoading(true);

    try {
      let ridesQuery = supabase
        .from('rides')
        .select('*')
        .eq('driver_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(30);

      let deliveriesQuery = supabase
        .from('deliveries')
        .select('*')
        .eq('driver_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (filter === 'Active') {
        ridesQuery = ridesQuery.in('status', ['accepted', 'ongoing']);
        deliveriesQuery = deliveriesQuery.in('status', ['accepted', 'picked_up', 'in_transit']);
      } else if (filter === 'Completed') {
        ridesQuery = ridesQuery.eq('status', 'completed');
        deliveriesQuery = deliveriesQuery.eq('status', 'delivered');
      } else if (filter === 'Cancelled') {
        ridesQuery = ridesQuery.eq('status', 'cancelled');
        deliveriesQuery = deliveriesQuery.eq('status', 'cancelled');
      } else if (filter === 'Today') {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        ridesQuery = ridesQuery.gte('created_at', todayStart.toISOString());
        deliveriesQuery = deliveriesQuery.gte('created_at', todayStart.toISOString());
      }

      const [ridesRes, deliveriesRes] = await Promise.all([ridesQuery, deliveriesQuery]);
      if (ridesRes.error) throw ridesRes.error;
      if (deliveriesRes.error) throw deliveriesRes.error;

      const normalizedRides = (ridesRes.data || []).map(r => ({ ...r, is_package: false }));
      const normalizedDeliveries = (deliveriesRes.data || []).map(d => ({
        ...d,
        is_package: true,
        pickup_address: d.sender_address,
        destination_address: d.receiver_address,
        driver_payout: d.fare,
        sort_date: (d as any).updated_at || d.created_at
      }));

      let combinedData = [];
      if (filter === 'Deliveries') {
        combinedData = [...normalizedDeliveries];
      } else {
        combinedData = [...normalizedRides, ...normalizedDeliveries];
      }
      
      combinedData = combinedData.map(item => ({
        ...item,
        sort_date: item.sort_date || item.updated_at || item.created_at
      }));
      
      combinedData.sort((a, b) => new Date(b.sort_date).getTime() - new Date(a.sort_date).getTime());
      combinedData = combinedData.slice(0, 30);

      // Fetch rider names
      const riderIds = [...new Set(combinedData.filter(r => r.rider_id).map(r => r.rider_id))];
      let riderMap: Record<string, any> = {};
      if (riderIds.length > 0) {
        const { data: riders } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', riderIds);
        if (riders) riders.forEach(r => { riderMap[r.id] = r; });
      }

      const enriched = combinedData.map(r => ({
        ...r,
        rider_first_name: riderMap[r.rider_id]?.first_name || null,
        rider_last_name: riderMap[r.rider_id]?.last_name || null,
      }));

      setRides(enriched);

      // Stats
      const { data: allCompletedRides } = await supabase
        .from('rides')
        .select('fare, driver_payout, created_at, updated_at')
        .eq('driver_id', authUser.id)
        .eq('status', 'completed');
        
      const { data: allCompletedDeliveries } = await supabase
        .from('deliveries')
        .select('fare, created_at')
        .eq('driver_id', authUser.id)
        .eq('status', 'delivered');

      const allCompleted = [...(allCompletedRides || []), ...(allCompletedDeliveries || [])];

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayRides = allCompleted.filter(r => new Date((r as any).updated_at || r.created_at) >= todayStart);

      setStats({
        total: allCompleted.length,
        today: todayRides.length,
        earned: allCompleted.reduce((s, r) => s + (parseFloat((r as any).driver_payout || r.fare) || 0), 0),
      });
    } catch (err) {
      console.error('Error fetching driver rides:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authUser?.id, filter]);

  useFocusEffect(useCallback(() => { fetchRides(false); }, [fetchRides]));
  const onRefresh = () => { setRefreshing(true); fetchRides(false); };

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <LinearGradient
        colors={isDark ? ['#1E293B', '#0F172A'] : ['#FCCA14', '#EAB308']}
        style={[s.header, { paddingTop: insets.top + 12 }]}
      >
        <Text style={[s.headerTitle, { color: isDark ? '#fff' : '#000' }]}>My Rides</Text>
        <View style={[s.statsRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
          <View style={s.stat}>
            <Text style={[s.statVal, { color: isDark ? '#fff' : '#000' }]}>{stats.total}</Text>
            <Text style={[s.statLbl, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }]}>Total</Text>
          </View>
          <View style={[s.statDiv, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]} />
          <View style={s.stat}>
            <Text style={[s.statVal, { color: isDark ? '#fff' : '#000' }]}>{stats.today}</Text>
            <Text style={[s.statLbl, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }]}>Today</Text>
          </View>
          <View style={[s.statDiv, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]} />
          <View style={s.stat}>
            <Text style={[s.statVal, { color: isDark ? '#fff' : '#000' }]}>₦{stats.earned.toLocaleString()}</Text>
            <Text style={[s.statLbl, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }]}>Earned</Text>
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
                style={[s.filterChip, {
                  backgroundColor: active ? (isDark ? '#FCCA14' : '#0F346E') : C.surfaceAlt,
                  borderColor: active ? (isDark ? '#FCCA14' : '#0F346E') : C.border,
                }]}
                onPress={() => setFilter(f)}
              >
                <Text style={[s.filterTxt, { color: active ? (isDark ? '#000' : '#fff') : C.textSecondary }]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.driver.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={Colors.driver.primary} style={{ marginTop: 60 }} />
        ) : rides.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="car-outline" size={52} color={C.textMuted} />
            <Text style={[s.emptyTxt, { color: C.textMuted }]}>
              {filter === 'All' ? 'No rides yet.\nGo online to start accepting trips!' : `No ${filter.toLowerCase()} found.`}
            </Text>
          </View>
        ) : (
          rides.map(ride => (
            <RideCard 
              key={ride.id} 
              ride={ride} 
              C={C} 
              isDark={isDark} 
              onPress={(r) => {
                const isActive = ['accepted', 'picked_up', 'in_transit', 'ongoing'].includes(r.status);
                if (isActive) {
                  if (r.is_package) {
                    router.push(`/(driver)/active-delivery?deliveryId=${r.id}`);
                  } else {
                    router.push(`/(driver)/active-trip?rideId=${r.id}`);
                  }
                }
              }}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  headerTitle: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  statsRow: { flexDirection: 'row', borderRadius: 12, padding: 14 },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 17, fontWeight: '800' },
  statLbl: { fontSize: 11, marginTop: 2 },
  statDiv: { width: 1, height: 28 },
  filterWrap: { borderBottomWidth: 1 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  filterTxt: { fontSize: 13, fontWeight: '600' },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  riderCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  riderInitial: { fontSize: 15, fontWeight: '700', color: '#FCCA14' },
  riderName: { fontSize: 15, fontWeight: '700' },
  dateTxt: { fontSize: 12, marginTop: 1 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusTxt: { fontSize: 11, fontWeight: '700' },
  routeSection: { marginBottom: 14 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  routeDash: { width: 2, height: 16, marginLeft: 3, borderLeftWidth: 2, borderStyle: 'dashed' },
  routeTxt: { fontSize: 13, flex: 1 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaVal: { fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTxt: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  resumeBanner: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resumeTxt: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
