import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Dimensions, Platform, ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import AlertModal from '@/components/AlertModal';

const { width } = Dimensions.get('window');

const RIDER_TAGS = ['Polite', 'Clean Car', 'Safe Driving', 'On Time', 'Great Music'];
const DRIVER_TAGS = ['Friendly', 'Ready on Time', 'Good Location', 'Respectful'];

export default function RateTripScreen() {
  const { rideId, role, otherUserId } = useLocalSearchParams<{
    rideId: string;
    role: string; // 'rider' or 'driver'
    otherUserId: string;
  }>();
  const { authUser } = useAuth();
  const { colorScheme } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isDark = colorScheme === 'dark';
  const C = Colors[colorScheme];
  const isRider = role === 'rider';
  const accentColor = isRider ? Colors.brand.primary : Colors.driver.primary;

  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rideData, setRideData] = useState<any>(null);
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

  const tags = isRider ? RIDER_TAGS : DRIVER_TAGS;

  useEffect(() => {
    if (!rideId) return;

    (async () => {
      // 1. Fetch Ride Data
      const { data: ride, error: rideErr } = await supabase
        .from('rides')
        .select('*, driver_id, rider_id, fare, distance_km, duration_mins, pickup_address, destination_address')
        .eq('id', rideId)
        .single();
      
      if (rideErr || !ride) return;
      setRideData(ride);

      // 2. Resolve Role and Other User if missing
      let resolvedRole = role;
      let resolvedOtherUserId = otherUserId;

      if (!resolvedRole) {
        // If I am the driver, the other person is the rider
        resolvedRole = (authUser?.id === ride.driver_id) ? 'driver' : 'rider';
      }

      if (!resolvedOtherUserId) {
        // If I am the rider, I rate the driver. If I am driver, I rate the rider.
        resolvedOtherUserId = (authUser?.id === ride.driver_id) ? ride.rider_id : ride.driver_id;
      }

      // 3. Fetch Other User Profile
      if (resolvedOtherUserId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, avatar_url')
          .eq('id', resolvedOtherUserId)
          .single();
        if (profile) setOtherUser(profile);
      }
    })();
  }, [otherUserId, rideId, role, authUser?.id]);

  const otherName = otherUser
    ? `${otherUser.first_name} ${otherUser.last_name || ''}`.trim()
    : (isRider ? 'Your Driver' : 'Your Rider');

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      setAlertConfig({
        visible: true,
        title: 'Rating Required',
        message: 'Please select a star rating.',
        type: 'warning'
      });
      return;
    }
    setSubmitting(true);
    const targetId = otherUserId || (rideData?.driver_id === authUser?.id ? rideData?.rider_id : rideData?.driver_id);
    const targetRole = role || (rideData?.driver_id === authUser?.id ? 'driver' : 'rider');

    if (!targetId) {
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: 'Could not identify the person to rate.',
        type: 'error'
      });
      setSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase.from('ratings').insert({
        ride_id: rideId,
        rater_id: authUser?.id,
        rated_id: targetId,
        rating,
        feedback: feedback.trim() || null,
        tags: selectedTags,
      });
      if (error) throw error;

      const destination = isRider ? '/(user)/(tabs)' : '/(driver)/(tabs)/earn';
      router.replace(destination);
    } catch (err: any) {
      console.error('Rating error:', err);
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: 'Could not submit rating. Please try again.',
        type: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    const destination = isRider ? '/(user)/(tabs)' : '/(driver)/(tabs)/earn';
    router.replace(destination);
  };

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <LinearGradient
            colors={isRider ? [Colors.brand.primary, '#16213E'] : ['#1E293B', '#0F172A']}
            style={[s.header, { paddingTop: insets.top + 20 }]}
          >
            <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
            <Text style={s.headerTitle}>Trip Completed!</Text>
            {rideData && (
              <View style={s.tripSummary}>
                <View style={s.summaryItem}>
                  <Text style={s.summaryVal}>₦{(rideData.fare || 0).toLocaleString()}</Text>
                  <Text style={s.summaryLabel}>Fare</Text>
                </View>
                <View style={s.summaryDivider} />
                <View style={s.summaryItem}>
                  <Text style={s.summaryVal}>{rideData.distance_km?.toFixed(1) || '?'} km</Text>
                  <Text style={s.summaryLabel}>Distance</Text>
                </View>
                <View style={s.summaryDivider} />
                <View style={s.summaryItem}>
                  <Text style={s.summaryVal}>{Math.round(rideData.duration_mins || 0)} min</Text>
                  <Text style={s.summaryLabel}>Duration</Text>
                </View>
              </View>
            )}
          </LinearGradient>

          {/* Rating section */}
          <View style={s.section}>
            <Text style={[s.ratePrompt, { color: C.text }]}>
              How was your {isRider ? 'ride' : 'rider'}?
            </Text>
            <Text style={[s.rateSubPrompt, { color: C.textMuted }]}>
              Rate {otherName}
            </Text>

            {/* Stars */}
            <View style={s.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={44}
                    color={star <= rating ? '#FCCA14' : C.border}
                    style={s.star}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {rating > 0 && (
              <Text style={[s.ratingLabel, { color: accentColor }]}>
                {rating === 5 ? 'Excellent! ⭐' : rating === 4 ? 'Great!' : rating === 3 ? 'Good' : rating === 2 ? 'Fair' : 'Poor'}
              </Text>
            )}
          </View>

          {/* Quick tags */}
          {rating > 0 && (
            <View style={s.section}>
              <Text style={[s.tagTitle, { color: C.text }]}>What stood out?</Text>
              <View style={s.tagsWrap}>
                {tags.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        s.tagChip,
                        {
                          backgroundColor: active ? accentColor + '18' : C.surfaceAlt,
                          borderColor: active ? accentColor : C.border,
                        },
                      ]}
                      onPress={() => toggleTag(tag)}
                    >
                      <Text style={[s.tagText, { color: active ? accentColor : C.textSecondary }]}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Feedback input */}
          {rating > 0 && (
            <View style={s.section}>
              <TextInput
                style={[s.feedbackInput, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
                placeholder="Add a comment (optional)"
                placeholderTextColor={C.textMuted}
                multiline
                numberOfLines={3}
                maxLength={200}
                value={feedback}
                onChangeText={setFeedback}
                textAlignVertical="top"
              />
            </View>
          )}

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: accentColor }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[s.submitTxt, { color: isRider ? '#fff' : '#000' }]}>Submit Rating</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={s.skipBtn} onPress={handleSkip}>
              <Text style={[s.skipTxt, { color: C.textMuted }]}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <AlertModal
        isVisible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    alignItems: 'center',
    paddingBottom: 28,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 12, marginBottom: 20 },
  tripSummary: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 20,
    marginHorizontal: 20,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { color: '#fff', fontSize: 17, fontWeight: '700' },
  summaryLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },

  section: { paddingHorizontal: 24, marginTop: 28 },
  ratePrompt: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  rateSubPrompt: { fontSize: 14, textAlign: 'center', marginTop: 4 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 8 },
  star: { marginHorizontal: 2 },
  ratingLabel: { textAlign: 'center', fontSize: 16, fontWeight: '700', marginTop: 12 },

  tagTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tagChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1,
  },
  tagText: { fontSize: 13, fontWeight: '600' },

  feedbackInput: {
    borderWidth: 1, borderRadius: 16,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
    fontSize: 15, minHeight: 90,
  },

  actions: { paddingHorizontal: 24, marginTop: 32 },
  submitBtn: {
    height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  submitTxt: { fontSize: 17, fontWeight: '800' },
  skipBtn: { alignItems: 'center', marginTop: 16, paddingVertical: 8 },
  skipTxt: { fontSize: 14, fontWeight: '500' },
});
