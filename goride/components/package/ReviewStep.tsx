import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal as RNModal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useAppContext } from '@/context/AppContext';
import { PackageDeliveryState, PayerType, PaymentMethod } from '@/context/PackageDeliveryContext';

interface Props {
  state: PackageDeliveryState;
  onPayerChange: (p: PayerType) => void;
  onPaymentChange: (m: PaymentMethod) => void;
  onOfferFareChange: (offer: string) => void;
  onFindDriver: () => void;
  loading: boolean;
}

const fmt = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;

export default function ReviewStep({ state, onPayerChange, onPaymentChange, onOfferFareChange, onFindDriver, loading }: Props) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useAppContext();
  const C = Colors[colorScheme];
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [showBidInput, setShowBidInput] = useState(false);

  // Payment options based on payer type
  const paymentOptions: { value: PaymentMethod; label: string; icon: string }[] = [
    { value: 'cash', label: 'Cash', icon: 'cash' },
  ];

  // Determine the displayed fare (offer takes priority if set)
  const displayFare = state.offerFare && parseFloat(state.offerFare) > 0
    ? parseFloat(state.offerFare)
    : state.fare;

  const hasOffer = state.offerFare && parseFloat(state.offerFare) > 0 && parseFloat(state.offerFare) !== state.fare;

  // When payer changes to receiver, force cash
  const handlePayerChange = (p: PayerType) => {
    onPayerChange(p);
    if (p === 'receiver') {
      onPaymentChange('cash');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 20}
    >
      <ScrollView style={s.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={[s.title, { color: C.text }]}>Your Parcel</Text>
        <Text style={[s.subtitle, { color: C.textSecondary }]}>Review delivery details before booking</Text>

      {/* Route */}
      <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
        <Text style={[s.cardTitle, { color: C.text }]}>Route</Text>
        <View style={s.routeRow}>
          <View style={s.routeDots}>
            <View style={[s.dot, { backgroundColor: '#22C55E' }]} />
            <View style={[s.routeLine, { backgroundColor: C.border }]} />
            <View style={[s.dotSquare, { backgroundColor: Colors.brand.primary }]} />
          </View>
          <View style={{ flex: 1, gap: 18 }}>
            <View>
              <Text style={[s.routeLabel, { color: C.textMuted }]}>Pickup</Text>
              <Text style={[s.routeAddr, { color: C.text }]} numberOfLines={2}>{state.senderAddress || '—'}</Text>
            </View>
            <View>
              <Text style={[s.routeLabel, { color: C.textMuted }]}>Dropoff</Text>
              <Text style={[s.routeAddr, { color: C.text }]} numberOfLines={2}>{state.receiverAddress || '—'}</Text>
            </View>
          </View>
        </View>
        {state.distanceKm > 0 && (
          <View style={[s.distBadge, { backgroundColor: C.surfaceAlt }]}>
            <Ionicons name="navigate-outline" size={14} color={Colors.brand.primary} />
            <Text style={[s.distTxt, { color: C.text }]}>{state.distanceKm.toFixed(1)} km</Text>
          </View>
        )}
      </View>

      {/* Parcel Details */}
      <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
        <Text style={[s.cardTitle, { color: C.text }]}>Parcel Details</Text>
        <View style={s.detailRow}>
          <Ionicons name={state.parcelType?.icon as any || 'cube'} size={18} color={C.textMuted} />
          <Text style={[s.detailLabel, { color: C.textSecondary }]}>Type</Text>
          <Text style={[s.detailVal, { color: C.text }]}>{state.parcelType?.label || '—'}</Text>
        </View>
        <View style={s.detailRow}>
          <Ionicons name="scale-outline" size={18} color={C.textMuted} />
          <Text style={[s.detailLabel, { color: C.textSecondary }]}>Weight</Text>
          <Text style={[s.detailVal, { color: C.text }]}>{state.parcelWeight} kg</Text>
        </View>
        <View style={s.detailRow}>
          <Ionicons name={state.selectedVehicleType?.icon as any || 'car'} size={18} color={C.textMuted} />
          <Text style={[s.detailLabel, { color: C.textSecondary }]}>Vehicle</Text>
          <Text style={[s.detailVal, { color: C.text }]}>{state.selectedVehicleType?.name || '—'}</Text>
        </View>
      </View>

      {/* Who Pays Toggle */}
      <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
        <Text style={[s.cardTitle, { color: C.text }]}>Who will pay?</Text>
        <View style={[s.toggleRow, { backgroundColor: C.surfaceAlt }]}>
          {(['sender', 'receiver'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              activeOpacity={0.8}
              onPress={() => handlePayerChange(p)}
              style={[s.toggleBtn, state.payerType === p && { backgroundColor: Colors.brand.primary }]}
            >
              <Ionicons
                name={p === 'sender' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
                size={16}
                color={state.payerType === p ? '#fff' : C.textMuted}
              />
              <Text style={[s.toggleTxt, { color: state.payerType === p ? '#fff' : C.textSecondary }]}>
                {p === 'sender' ? 'Sender pay' : 'Receiver pay'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {state.payerType === 'receiver' && (
          <View style={[s.payerNote, { backgroundColor: Colors.brand.secondary + '15' }]}>
            <Ionicons name="information-circle-outline" size={14} color={Colors.brand.secondary} />
            <Text style={[s.payerNoteTxt, { color: Colors.brand.secondary }]}>
              Receiver pay only supports cash payment
            </Text>
          </View>
        )}
      </View>

      {/* Contact Summary */}
      <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
        <Text style={[s.cardTitle, { color: C.text }]}>Contacts</Text>
        <View style={s.contactRow}>
          <View style={[s.contactIcon, { backgroundColor: '#22C55E20' }]}>
            <Ionicons name="arrow-up" size={14} color="#22C55E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.contactName, { color: C.text }]}>{state.senderName || 'Sender'}</Text>
            <Text style={[s.contactPhone, { color: C.textMuted }]}>{state.senderPhone || '—'}</Text>
          </View>
        </View>
        <View style={[s.divider, { backgroundColor: C.border }]} />
        <View style={s.contactRow}>
          <View style={[s.contactIcon, { backgroundColor: Colors.brand.primary + '20' }]}>
            <Ionicons name="arrow-down" size={14} color={Colors.brand.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.contactName, { color: C.text }]}>{state.receiverName || 'Receiver'}</Text>
            <Text style={[s.contactPhone, { color: C.textMuted }]}>{state.receiverPhone || '—'}</Text>
          </View>
        </View>
      </View>

      {/* Fare + Offer Bid */}
      <View style={[s.fareCard, { backgroundColor: Colors.brand.primary + '08', borderColor: Colors.brand.primary + '30' }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.fareLabel, { color: C.textSecondary }]}>Estimated Fare</Text>
          <Text style={[s.fareVal, { color: Colors.brand.primary }]}>{fmt(state.fare)}</Text>
        </View>
        {/* Payment method picker */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => paymentOptions.length > 1 && setShowPaymentPicker(true)}
          disabled={paymentOptions.length <= 1}
          style={[s.payMethodBtn, { backgroundColor: C.surface, borderColor: C.border }]}
        >
          <MaterialCommunityIcons
            name="cash"
            size={18}
            color={Colors.brand.secondary}
          />
          <Text style={[s.payMethodTxt, { color: C.text }]}>
            Cash
          </Text>
          {paymentOptions.length > 1 && (
            <Ionicons name="chevron-down" size={14} color={C.textMuted} />
          )}
        </TouchableOpacity>
      </View>

      {/* Offer / Bid Your Price */}
      <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
        <View style={s.offerHeader}>
          <View>
            <Text style={[s.cardTitle, { color: C.text, marginBottom: 2 }]}>Bid Your Price</Text>
            <Text style={[s.offerHint, { color: C.textMuted }]}>Offer what you'd like to pay (optional)</Text>
          </View>
          {(hasOffer || showBidInput) && (
            <TouchableOpacity onPress={() => { onOfferFareChange(''); setShowBidInput(false); }}>
              <Text style={{ color: Colors.brand.danger, fontSize: 12, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
        {!showBidInput && !hasOffer ? (
          <TouchableOpacity 
            style={[s.addBidBtn, { borderColor: Colors.brand.secondary }]}
            onPress={() => setShowBidInput(true)}
          >
            <Ionicons name="pricetag-outline" size={16} color={Colors.brand.secondary} />
            <Text style={[s.addBidTxt, { color: Colors.brand.secondary }]}>Bid Your Price</Text>
          </TouchableOpacity>
        ) : (
          <View style={[s.offerInputWrap, { backgroundColor: C.surfaceAlt, borderColor: hasOffer ? Colors.brand.secondary : C.border }]}>
            <Text style={[s.offerPrefix, { color: C.textMuted }]}>₦</Text>
            <TextInput
              style={[s.offerInput, { color: C.text }]}
              placeholder={state.fare.toLocaleString()}
              placeholderTextColor={C.textMuted}
              value={state.offerFare}
              onChangeText={(t) => onOfferFareChange(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              returnKeyType="done"
              autoFocus={showBidInput && !hasOffer}
            />
            {hasOffer && (
              <View style={[s.offerBadge, { backgroundColor: Colors.brand.secondary + '20' }]}>
                <Text style={[s.offerBadgeTxt, { color: Colors.brand.secondary }]}>
                  {parseFloat(state.offerFare) > state.fare ? '↑' : '↓'}
                  {Math.abs(((parseFloat(state.offerFare) - state.fare) / state.fare) * 100).toFixed(0)}%
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Book Button */}
      <TouchableOpacity 
        activeOpacity={0.85} 
        onPress={onFindDriver} 
        disabled={loading} 
        style={{ marginTop: 8, marginBottom: Math.max(insets.bottom, 16) }}
      >
        <LinearGradient
          colors={[Colors.brand.secondary, Colors.brand.secondaryDark || '#C4A811']}
          style={s.bookBtn}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Ionicons name="search" size={20} color={Colors.brand.primary} />
          <Text style={s.bookBtnTxt}>
            Find Deliveryman{hasOffer ? ` · ${fmt(parseFloat(state.offerFare))}` : ` · ${fmt(state.fare)}`}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Payment Picker Modal */}
      <RNModal
        visible={showPaymentPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPaymentPicker(false)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPaymentPicker(false)}
        >
          <View style={[s.payPickerSheet, { backgroundColor: C.background }]}>
            <Text style={[s.payPickerTitle, { color: C.text }]}>Payment Method</Text>
            {paymentOptions.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                activeOpacity={0.8}
                onPress={() => { onPaymentChange(opt.value); setShowPaymentPicker(false); }}
                style={[s.payOption, {
                  backgroundColor: state.paymentMethod === opt.value ? Colors.brand.primary + '10' : C.surface,
                  borderColor: state.paymentMethod === opt.value ? Colors.brand.primary : C.border,
                }]}
              >
                <MaterialCommunityIcons name={opt.icon as any} size={22} color={state.paymentMethod === opt.value ? Colors.brand.primary : C.textMuted} />
                <Text style={[s.payOptionTxt, { color: state.paymentMethod === opt.value ? Colors.brand.primary : C.text }]}>{opt.label}</Text>
                {state.paymentMethod === opt.value && (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.brand.primary} style={{ marginLeft: 'auto' }} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </RNModal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4 },
  subtitle: { fontSize: 14, fontWeight: '500', marginBottom: 20 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  routeRow: { flexDirection: 'row', gap: 12 },
  routeDots: { alignItems: 'center', paddingTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { width: 2, flex: 1, marginVertical: 4 },
  dotSquare: { width: 10, height: 10, borderRadius: 2 },
  routeLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  routeAddr: { fontSize: 14, fontWeight: '600' },
  distBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 12 },
  distTxt: { fontSize: 13, fontWeight: '700' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  detailLabel: { fontSize: 13, fontWeight: '500', flex: 1 },
  detailVal: { fontSize: 14, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', borderRadius: 12, padding: 4 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10 },
  toggleTxt: { fontSize: 13, fontWeight: '700' },
  payerNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  payerNoteTxt: { fontSize: 12, fontWeight: '600' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  contactIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  contactName: { fontSize: 14, fontWeight: '700' },
  contactPhone: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  divider: { height: 1, marginVertical: 10, marginLeft: 44 },
  fareCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 14 },
  fareLabel: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  fareVal: { fontSize: 24, fontWeight: '800' },
  payMethodBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  payMethodTxt: { fontSize: 14, fontWeight: '600' },
  // Offer / Bid
  offerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  offerHint: { fontSize: 11, fontWeight: '500', marginBottom: 8 },
  offerInputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, height: 54 },
  offerPrefix: { fontSize: 20, fontWeight: '800', marginRight: 4 },
  offerInput: { flex: 1, fontSize: 20, fontWeight: '700' },
  offerBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  offerBadgeTxt: { fontSize: 12, fontWeight: '800' },
  addBidBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed' },
  addBidTxt: { fontSize: 14, fontWeight: '700' },
  // Book Button
  bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderRadius: 14, elevation: 4, shadowColor: Colors.brand.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  bookBtnTxt: { fontSize: 16, fontWeight: '800', color: Colors.brand.primary },
  // Payment Picker Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  payPickerSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  payPickerTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  payOption: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, borderWidth: 1.5, marginBottom: 10 },
  payOptionTxt: { fontSize: 16, fontWeight: '600' },
});
