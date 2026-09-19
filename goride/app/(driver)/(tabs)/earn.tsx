import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Image, Dimensions,
  ActivityIndicator, Platform, RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

export default function EarnScreen() {
  const { colorScheme } = useAppContext();
  const { authUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const C = Colors[colorScheme];

  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dynamic data
  const [walletBalance, setWalletBalance] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [weekEarnings, setWeekEarnings] = useState(0);
  const [rideEarnings, setRideEarnings] = useState(0);
  const [deliveryEarnings, setDeliveryEarnings] = useState(0);
  const [cashEarnings, setCashEarnings] = useState(0);
  const [totalWithdraws, setTotalWithdraws] = useState(0);
  const [totalTrips, setTotalTrips] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'year'>('week');
  const [periodEarnings, setPeriodEarnings] = useState(0);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  const driverName = authUser ? `${authUser.firstName} ${authUser.lastName}` : 'Driver';
  const driverAvatar = authUser?.avatar;
  const initials = authUser ? `${authUser.firstName.charAt(0)}${authUser.lastName.charAt(0)}` : 'D';

  const fetchEarnings = useCallback(async (showLoader = true) => {
    if (!authUser?.id) return;
    if (showLoader) setLoading(true);

    try {
      // Wallet balance
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('id', authUser.id)
        .single();
      if (wallet) setWalletBalance(parseFloat(wallet.balance) || 0);

      // Wallet Transactions
      const { data: txs } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (txs) setRecentTransactions(txs);

      const { data: completedRides, error: ridesErr } = await supabase
        .from('rides')
        .select('id, fare, driver_payout, duration_mins, created_at, updated_at, destination_address, pickup_address')
        .eq('driver_id', authUser.id)
        .eq('status', 'completed');

      // All completed deliveries
      const { data: completedDeliveries, error: delErr } = await supabase
        .from('deliveries')
        .select('id, fare, created_at, payment_method, receiver_address, sender_address')
        .eq('driver_id', authUser.id)
        .eq('status', 'delivered');

      const rides = completedRides || [];
      const deliveries = completedDeliveries || [];

      setTotalTrips(rides.length + deliveries.length);
      setTotalHours(Math.round(rides.reduce((s, r) => s + (r.duration_mins || 0), 0) / 60));

      let totalRideEarn = 0;
      let totalDelEarn = 0;
      let totalCash = 0;
      let totalPlatform = 0;
      let todayEarn = 0;
      let weekEarn = 0;
      let monthEarn = 0;
      let yearEarn = 0;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);

      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - 1);

      const yearStart = new Date();
      yearStart.setFullYear(yearStart.getFullYear() - 1);

      rides.forEach(r => {
        const earn = parseFloat(r.driver_payout || r.fare) || 0;
        totalRideEarn += earn;
        if ((r as any).payment_method === 'wallet') totalPlatform += earn;
        else totalCash += earn;

        const date = new Date(r.updated_at || r.created_at);
        if (date >= todayStart) todayEarn += earn;
        if (date >= weekStart) weekEarn += earn;
        if (date >= monthStart) monthEarn += earn;
        if (date >= yearStart) yearEarn += earn;
      });

      deliveries.forEach(d => {
        const earn = parseFloat(d.fare) || 0;
        totalDelEarn += earn;
        if (d.payment_method === 'wallet') totalPlatform += earn;
        else totalCash += earn;

        const date = new Date((d as any).updated_at || d.created_at);
        if (date >= todayStart) todayEarn += earn;
        if (date >= weekStart) weekEarn += earn;
        if (date >= monthStart) monthEarn += earn;
        if (date >= yearStart) yearEarn += earn;
      });

      // Total Withdraws
      const { data: withdrawals } = await supabase
        .from('withdrawal_requests')
        .select('amount')
        .eq('driver_id', authUser.id)
        .in('status', ['pending', 'completed']);
      
      const totalW = withdrawals ? withdrawals.reduce((s, w) => s + (parseFloat(w.amount) || 0), 0) : 0;
      setTotalWithdraws(totalW);

      setRideEarnings(totalRideEarn);
      setDeliveryEarnings(totalDelEarn);
      setCashEarnings(totalCash);
      setTodayEarnings(todayEarn);

      if (timeFilter === 'week') setPeriodEarnings(weekEarn);
      else if (timeFilter === 'month') setPeriodEarnings(monthEarn);
      else setPeriodEarnings(yearEarn);

      // Average rating
      const { data: ratings } = await supabase
        .from('ratings')
        .select('rating')
        .eq('rated_id', authUser.id);
      if (ratings && ratings.length > 0) {
        setAvgRating(parseFloat((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)));
      }

      // Recent jobs
      const normalizedRides = rides.map(r => ({ ...r, type: 'ride', title: r.destination_address || 'Ride Dropoff', earn: parseFloat(r.driver_payout || r.fare) || 0, sort_date: r.updated_at || r.created_at }));
      const normalizedDeliveries = deliveries.map(d => ({ ...d, type: 'delivery', title: d.receiver_address || 'Package Dropoff', earn: parseFloat(d.fare) || 0, sort_date: (d as any).updated_at || d.created_at }));

      let combinedJobs = [...normalizedRides, ...normalizedDeliveries];
      combinedJobs.sort((a, b) => new Date(b.sort_date).getTime() - new Date(a.sort_date).getTime());

      setRecentJobs(combinedJobs.slice(0, 5));

    } catch (err) {
      console.error('Error fetching earnings:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authUser?.id, timeFilter]);

  useFocusEffect(useCallback(() => { fetchEarnings(false); }, [fetchEarnings]));
  const onRefresh = () => { setRefreshing(true); fetchEarnings(false); };

  const STATS = [
    { label: 'Trips', value: `${totalTrips}`, icon: 'car-outline', color: '#FCCA14' },
    { label: 'Hours', value: `${totalHours}h`, icon: 'time-outline', color: '#3B82F6' },
    { label: 'Rating', value: avgRating > 0 ? avgRating.toFixed(1) : '—', icon: 'star-outline', color: '#EAB308' },
  ];

  function formatTxDate(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return `Today, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (loading) {
    return (
      <View style={[{ flex: 1, justifyContent: 'center', alignItems: 'center' }, { backgroundColor: C.background }]}>
        <ActivityIndicator size="large" color={Colors.driver.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: C.background }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.driver.primary} />}
    >
      {/* Premium Header */}
      <LinearGradient
        colors={isDark ? ['#1E293B', '#0F172A'] : ['#0F346E', '#16213E']}
        style={[s.headerCard, { paddingTop: insets.top + 20 }]}
      >
        <View style={s.headerTop}>
          <View>
            <Text style={s.welcomeTxt}>Wallet Balance</Text>
            <View style={s.balanceRow}>
              <Text style={s.balanceTxt}>
                {isBalanceVisible ? `₦${walletBalance.toLocaleString()}` : '•••'}
              </Text>
              <TouchableOpacity onPress={() => setIsBalanceVisible(!isBalanceVisible)} style={s.eyeBtn}>
                <Ionicons name={isBalanceVisible ? "eye-outline" : "eye-off-outline"} size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={s.walletBtn} activeOpacity={0.8} onPress={() => router.push('/(driver)/wallet-topup')}>
              <LinearGradient colors={['#3B82F6', '#2563EB']} style={s.walletGradient}>
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={[s.walletTxt, { color: '#fff' }]}>Top-up</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={s.walletBtn} activeOpacity={0.8} onPress={() => router.push('/(driver)/withdrawal-request')}>
              <LinearGradient colors={['#FCCA14', '#EAB308']} style={s.walletGradient}>
                <Ionicons name="wallet-outline" size={20} color="#000" />
                <Text style={s.walletTxt}>Withdraw</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Floating Identity Card */}
      <View style={[s.identityCard, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
          <View style={s.idLeft}>
            {driverAvatar ? (
              <Image source={{ uri: driverAvatar }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, { backgroundColor: '#FCCA1430' }]}>
                <Text style={s.initials}>{initials}</Text>
              </View>
            )}
            <View style={s.idInfo}>
              <View style={s.nameRow}>
                <Text style={[s.idName, { color: isDark ? '#fff' : '#000' }]}>{driverName}</Text>
                {authUser?.isDriverVerified && (
                  <MaterialCommunityIcons name="check-decagram" size={16} color="#3B82F6" style={{ marginLeft: 4 }} />
                )}
              </View>
              <Text style={s.idLevel}>Gold Partner</Text>
            </View>
          </View>
          <View style={[s.ratingBadge, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
            <Ionicons name="star" size={14} color="#FCCA14" />
            <Text style={[s.ratingVal, { color: isDark ? '#fff' : '#000' }]}>{avgRating > 0 ? avgRating.toFixed(1) : '—'}</Text>
          </View>
        </View>

      {/* Stats Grid */}
      <View style={s.statsGrid}>
        {STATS.map((stat, idx) => (
          <View key={idx} style={[s.statCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={[s.statIconWrap, { backgroundColor: stat.color + '15' }]}>
              <Ionicons name={stat.icon as any} size={20} color={stat.color} />
            </View>
            <Text style={[s.statVal, { color: C.text }]}>{stat.value}</Text>
            <Text style={[s.statLabel, { color: C.textMuted }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Earnings Breakdown */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: C.text }]}>Earnings Breakdown</Text>
        </View>

        {/* Source Breakdown */}
        <View style={s.breakdownRow}>
          <View style={[s.breakdownCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={[s.iconBox, { backgroundColor: '#3B82F620' }]}>
              <Ionicons name="car-outline" size={18} color="#3B82F6" />
            </View>
            <Text style={[s.breakdownLabel, { color: C.textMuted }]}>Ride Earnings</Text>
            <Text style={[s.breakdownVal, { color: C.text }]}>₦{rideEarnings.toLocaleString()}</Text>
          </View>
          <View style={[s.breakdownCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={[s.iconBox, { backgroundColor: '#FCCA1420' }]}>
              <Ionicons name="cube-outline" size={18} color="#FCCA14" />
            </View>
            <Text style={[s.breakdownLabel, { color: C.textMuted }]}>Delivery Earnings</Text>
            <Text style={[s.breakdownVal, { color: C.text }]}>₦{deliveryEarnings.toLocaleString()}</Text>
          </View>
        </View>

        {/* Payment Type Breakdown */}
        <View style={[s.breakdownRow, { marginTop: 12 }]}>
          <View style={[s.breakdownCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={[s.iconBox, { backgroundColor: '#22C55E20' }]}>
              <Ionicons name="cash-outline" size={18} color="#22C55E" />
            </View>
            <Text style={[s.breakdownLabel, { color: C.textMuted }]}>Cash Income</Text>
            <Text style={[s.breakdownVal, { color: '#22C55E' }]}>₦{cashEarnings.toLocaleString()}</Text>
          </View>
          <View style={[s.breakdownCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={[s.iconBox, { backgroundColor: '#A855F720' }]}>
              <Ionicons name="swap-vertical-outline" size={18} color="#A855F7" />
            </View>
            <Text style={[s.breakdownLabel, { color: C.textMuted }]}>Total Withdraws</Text>
            <Text style={[s.breakdownVal, { color: C.text }]}>₦{totalWithdraws.toLocaleString()}</Text>
          </View>
        </View>

        {/* Time Breakdown */}
        <View style={[s.breakdownRow, { marginTop: 12 }]}>
          <View style={[s.breakdownCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[s.breakdownLabel, { color: C.textMuted }]}>Today's Work</Text>
            <Text style={[s.breakdownVal, { color: C.text }]}>₦{todayEarnings.toLocaleString()}</Text>
          </View>
          <TouchableOpacity
            style={[s.breakdownCard, { backgroundColor: C.surface, borderColor: C.border }]}
            onPress={() => {
              if (timeFilter === 'week') setTimeFilter('month');
              else if (timeFilter === 'month') setTimeFilter('year');
              else setTimeFilter('week');
            }}
            activeOpacity={0.7}
          >
            <Text style={[s.breakdownLabel, { color: C.textMuted }]}>
              {timeFilter === 'week' ? 'This Week' : timeFilter === 'month' ? 'This Month' : 'This Year'}
            </Text>
            <Text style={[s.breakdownVal, { color: C.text }]}>₦{periodEarnings.toLocaleString()}</Text>
            <View style={s.trendRow}>
              <Ionicons name="calendar-outline" size={14} color={C.textMuted} />
              <Text style={[s.trendTxt, { color: C.textMuted }]}>
                {timeFilter === 'week' ? 'Last 7 days' : timeFilter === 'month' ? 'Last 30 days' : 'Last 365 days'} (Tap to change)
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: C.text, marginBottom: 16 }]}>Recent Transactions</Text>
        {recentTransactions.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Ionicons name="receipt-outline" size={32} color={C.textMuted} />
            <Text style={[{ color: C.textMuted, marginTop: 8, fontSize: 14 }]}>No recent transactions</Text>
          </View>
        ) : (
          recentTransactions.map((tx) => (
            <View
              key={tx.id}
              style={[s.activityRow, { backgroundColor: C.surface, borderColor: C.border }]}
            >
              <View style={s.activityLeft}>
                <View style={[s.activityIcon, { backgroundColor: C.surfaceAlt }]}>
                  <Ionicons
                    name={tx.type === 'credit' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                    size={24}
                    color={tx.type === 'credit' ? '#22C55E' : '#EF4444'}
                  />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[s.activityTitle, { color: C.text }]} numberOfLines={1}>{tx.description}</Text>
                  <Text style={[s.activityTime, { color: C.textMuted }]}>
                    {formatTxDate(tx.created_at)}
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.activityAmount, { color: tx.type === 'credit' ? '#22C55E' : '#EF4444' }]}>
                  {tx.type === 'credit' ? '+' : '-'}₦{parseFloat(tx.amount).toLocaleString()}
                </Text>
                <Text style={[s.statusTxt, { color: C.textMuted }]}>
                  {tx.status === 'completed' ? 'Success' : tx.status}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  headerCard: { paddingHorizontal: 20, paddingBottom: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  welcomeTxt: { color: '#CBD5E1', fontSize: 14, fontWeight: '500' },
  balanceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  balanceTxt: { color: '#fff', fontSize: 20, fontWeight: '800' },
  eyeBtn: { marginLeft: 12, padding: 4 },
  walletBtn: { borderRadius: 20, overflow: 'hidden' },
  walletGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: width < 380 ? 10 : 16, paddingVertical: 10, gap: width < 380 ? 4 : 8 },
  walletTxt: { color: '#000', fontWeight: '700', fontSize: width < 380 ? 12 : 14 },
  identityCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderRadius: 20, marginHorizontal: 20, marginTop: -35, zIndex: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 10 },
      android: { elevation: 10 },
    }),
  },
  idLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 20, fontWeight: 'bold', color: '#FCCA14' },
  idInfo: { gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  idName: { fontSize: 16, fontWeight: '700' },
  idLevel: { fontSize: 12, color: '#64748B' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  ratingVal: { fontWeight: '700', fontSize: 14 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 24, gap: 12 },
  statCard: { flex: 1, padding: 16, borderRadius: 20, alignItems: 'center', borderWidth: 1 },
  statIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statVal: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  section: { marginTop: 32, paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  breakdownRow: { flexDirection: 'row', gap: 12 },
  breakdownCard: { flex: 1, padding: 16, borderRadius: 20, borderWidth: 1, gap: 4 },
  iconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  breakdownLabel: { fontSize: 13, fontWeight: '500' },
  breakdownVal: { fontSize: 20, fontWeight: '800' },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  trendTxt: { fontSize: 11, color: '#64748B' },
  emptyCard: { borderRadius: 20, borderWidth: 1, padding: 32, alignItems: 'center' },
  activityRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 12,
  },
  activityLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  activityIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  activityTitle: { fontSize: 15, fontWeight: '600' },
  activityTime: { fontSize: 12, marginTop: 2 },
  activityAmount: { fontSize: 16, fontWeight: '700' },
  statusTxt: { fontSize: 11, color: '#22C55E', marginTop: 2, fontWeight: '600' },
});
