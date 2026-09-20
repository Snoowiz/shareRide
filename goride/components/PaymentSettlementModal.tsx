import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Dimensions, Platform, BackHandler,
} from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { usePaystack } from 'react-native-paystack-webview';
import LottieView from 'lottie-react-native';
import { useEffect } from 'react';
import { initializePayment, openFlutterwaveCheckout, verifyPayment } from '@/lib/paymentService';

const { width } = Dimensions.get('window');
const COMMISSION_RATE = 0.15;

interface PaymentSettlementModalProps {
  isVisible: boolean;
  fareAmount: number;
  rideId?: string;
  deliveryId?: string;
  driverWalletBalance: number;
  driverEmail: string;
  driverName: string;
  driverId: string;
  onSettlementComplete: (method: 'paystack' | 'flutterwave' | 'cash', newBalance: number) => void;
  onClose: () => void;
}

export default function PaymentSettlementModal({
  isVisible,
  fareAmount,
  rideId,
  deliveryId,
  driverWalletBalance,
  driverEmail,
  driverName,
  driverId,
  onSettlementComplete,
  onClose,
}: PaymentSettlementModalProps) {
  const { colorScheme, paymentConfig } = useAppContext();
  const isDark = colorScheme === 'dark';
  const C = Colors[colorScheme];

  const isPaystackEnabled = paymentConfig?.paystackEnabled ?? true;
  const isFlutterwaveEnabled = paymentConfig?.flutterwaveEnabled ?? false;
  const isCashEnabled = paymentConfig?.enableCashPayments ?? true;

  const [processing, setProcessing] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'paystack' | 'flutterwave' | 'cash' | null>(null);
  const [paystackOpen, setPaystackOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ method: string; payout: number; balance: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [failCount, setFailCount] = useState(0);
  const { popup } = usePaystack();

  const commissionAmount = Math.round(fareAmount * COMMISSION_RATE * 100) / 100;
  const driverPayout = Math.round((fareAmount - commissionAmount) * 100) / 100;
  // For Handle Cash: deduct ONLY the commission from wallet (driver got the full fare in cash)
  const cashDeduction = commissionAmount;
  const canHandleCash = isCashEnabled && (driverWalletBalance >= cashDeduction);

  // ── Block Android back button while modal is visible ──
  useEffect(() => {
    if (!isVisible) return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Block back button — payment is mandatory
      return true;
    });
    return () => backHandler.remove();
  }, [isVisible]);

  // Clear error when method changes
  useEffect(() => {
    if (selectedMethod) setErrorMsg(null);
  }, [selectedMethod]);

  // ── Paystack Success Handler ──
  const handlePaystackSuccess = async (response: any) => {
    setProcessing(true);
    setErrorMsg(null);
    try {
      // Robustly extract the reference from whatever Paystack returns
      const extractedRef =
        (typeof response?.transactionRef === 'string' ? response.transactionRef : null) ||
        response?.transactionRef?.reference ||
        response?.reference ||
        response?.trxref;

      if (!extractedRef) {
        throw new Error('Could not find transaction reference in Paystack response.');
      }

      const payload = {
        driver_id: driverId,
        ride_id: rideId || null,
        delivery_id: deliveryId || null,
        fare_amount: fareAmount,
      };

      const result = await verifyPayment({
        gateway: 'paystack',
        reference: extractedRef,
        metadata: payload,
      });

      if (result.success) {
        const newBal = result.settlement?.new_balance ?? (driverWalletBalance + driverPayout);
        setPaystackOpen(false);
        setFailCount(0);
        setSuccessData({
          method: 'Paystack',
          payout: driverPayout,
          balance: newBal,
        });
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          onSettlementComplete('paystack', newBal);
        }, 2500);
      } else {
        setPaystackOpen(false);
        setProcessing(false);
        setFailCount(prev => prev + 1);
        setErrorMsg(result.error || 'Payment verification failed. Please try again.');
      }
    } catch (err: any) {
      setPaystackOpen(false);
      setProcessing(false);
      setFailCount(prev => prev + 1);
      setErrorMsg('Payment verification error. Please try again or use another payment method.');
    }
  };

  // ── Handle Paystack Cancel ──
  const handlePaystackCancel = () => {
    setPaystackOpen(false);
    setProcessing(false);
    setSelectedMethod(null);
    setFailCount(prev => prev + 1);
    setErrorMsg('Payment was cancelled. Please select a payment method to proceed.');
  };

  // ── Handle Flutterwave Payment Flow ──
  const handleFlutterwavePayment = async () => {
    setProcessing(true);
    setErrorMsg(null);

    try {
      const initRes = await initializePayment({
        gateway: 'flutterwave',
        amount: fareAmount,
        email: driverEmail || 'driver@goride.ng',
        name: driverName || 'GoRide Driver',
        metadata: {
          driver_id: driverId,
          ride_id: rideId || null,
          delivery_id: deliveryId || null,
          fare_amount: fareAmount,
        },
      });

      if (!initRes.success || !initRes.checkout_url) {
        setProcessing(false);
        setFailCount(prev => prev + 1);
        setErrorMsg(initRes.error || 'Could not initialize Flutterwave checkout.');
        return;
      }

      const checkoutRes = await openFlutterwaveCheckout(initRes.checkout_url);

      if (!checkoutRes.success) {
        setProcessing(false);
        if (!checkoutRes.cancelled) {
          setFailCount(prev => prev + 1);
          setErrorMsg(checkoutRes.error || 'Payment was cancelled or could not be completed.');
        }
        return;
      }

      const verifyRes = await verifyPayment({
        gateway: 'flutterwave',
        reference: checkoutRes.reference || initRes.reference || '',
        metadata: {
          driver_id: driverId,
          ride_id: rideId || null,
          delivery_id: deliveryId || null,
          fare_amount: fareAmount,
        },
      });

      if (verifyRes.success) {
        const newBal = verifyRes.settlement?.new_balance ?? (driverWalletBalance + driverPayout);
        setFailCount(0);
        setSuccessData({
          method: 'Flutterwave',
          payout: driverPayout,
          balance: newBal,
        });
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          onSettlementComplete('flutterwave', newBal);
        }, 2500);
      } else {
        setProcessing(false);
        setFailCount(prev => prev + 1);
        setErrorMsg(verifyRes.error || 'Flutterwave payment verification failed. Please try again.');
      }
    } catch (err: any) {
      setProcessing(false);
      setFailCount(prev => prev + 1);
      setErrorMsg(err.message || 'Flutterwave payment error. Please try again.');
    }
  };

  // ── Handle Cash Handler ──
  const handleCashSettlement = async () => {
    if (!canHandleCash) return;
    setProcessing(true);
    setErrorMsg(null);

    try {
      // ── Idempotency: Check if already settled before proceeding ──
      if (rideId) {
        const { data: rideCheck } = await supabase
          .from('rides').select('payment_status').eq('id', rideId).single();
        if (rideCheck?.payment_status === 'settled') {
          setProcessing(false);
          setErrorMsg('This ride has already been settled.');
          return;
        }
      }
      if (deliveryId) {
        const { data: delCheck } = await supabase
          .from('deliveries').select('payment_status').eq('id', deliveryId).single();
        if (delCheck?.payment_status === 'settled') {
          setProcessing(false);
          setErrorMsg('This delivery has already been settled.');
          return;
        }
      }

      const description = deliveryId
        ? `Cash settlement (Delivery) - Fare: ₦${fareAmount}, Commission: ₦${commissionAmount}`
        : `Cash settlement (Ride) - Fare: ₦${fareAmount}, Commission: ₦${commissionAmount}`;

      const { data, error } = await supabase.rpc('debit_driver_wallet', {
        p_driver_id: driverId,
        p_amount: cashDeduction,
        p_description: description,
        p_reference_id: rideId || null,
        p_delivery_id: deliveryId || null,
        p_category: 'cash_settlement',
      });

      if (error) throw error;

      const result = typeof data === 'string' ? JSON.parse(data) : data;

      if (result.success) {
        // Update ride/delivery payment_status AND final completion status
        if (rideId) {
          await supabase.from('rides').update({
            status: 'completed',
            payment_status: 'settled',
            payment_method: 'cash',
            commission_amount: commissionAmount,
            driver_payout: driverPayout,
            updated_at: new Date().toISOString()
          }).eq('id', rideId);
        }
        if (deliveryId) {
          await supabase.from('deliveries').update({
            status: 'delivered',
            payment_status: 'settled',
            payment_method: 'cash',
            commission_amount: commissionAmount,
            driver_payout: driverPayout,
            delivered_at: new Date().toISOString()
          }).eq('id', deliveryId);
        }

        setFailCount(0);
        setSuccessData({
          method: 'Cash',
          payout: driverPayout,
          balance: result.new_balance,
        });
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          onSettlementComplete('cash', result.new_balance);
        }, 2500);
      } else {
        setProcessing(false);
        setErrorMsg(result.error || 'Cash settlement failed. Please try again.');
      }
    } catch (err) {
      setProcessing(false);
      setErrorMsg('Cash settlement error. Please try again.');
    }
  };

  return (
    <Modal
      isVisible={isVisible && !paystackOpen}
      style={showSuccess ? s.modalCentered : s.modalBottom}
      animationIn={showSuccess ? "zoomIn" : "slideInUp"}
      animationOut={showSuccess ? "zoomOut" : "slideOutDown"}
      backdropOpacity={0.6}
      // ── SECURITY: Prevent ALL dismissal methods ──
      onBackButtonPress={() => {}} // Block Android back button
      onBackdropPress={() => {}}   // Block backdrop tap
      swipeDirection={undefined}   // Block swipe down
      avoidKeyboard
    >
      <View style={[
        showSuccess ? s.containerCentered : s.containerBottom, 
        { backgroundColor: isDark ? '#0F172A' : '#fff' }
      ]}>
        {showSuccess ? (
          <View style={s.successWrap}>
            <LottieView
              source={require('@/assets/lottie/success.json')}
              autoPlay
              loop={false}
              style={{ width: 160, height: 160 }}
            />
            <Text style={[s.successTitle, { color: C.text }]}>Payment Settled!</Text>
            <Text style={[s.successSub, { color: C.textSecondary }]}>
              {successData?.method} payment processed successfully
            </Text>
            <View style={[s.successCard, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
              <View style={s.successRow}>
                <Text style={[s.successLabel, { color: C.textMuted }]}>Your Earnings</Text>
                <Text style={[s.successVal, { color: '#22C55E' }]}>+₦{successData?.payout.toLocaleString()}</Text>
              </View>
              <View style={[s.successDivider, { backgroundColor: C.border }]} />
              <View style={s.successRow}>
                <Text style={[s.successLabel, { color: C.textMuted }]}>Updated Balance</Text>
                <Text style={[s.successVal, { color: C.text }]}>₦{successData?.balance.toLocaleString()}</Text>
              </View>
            </View>
          </View>
        ) : (
          <>
        {/* Header */}
        <LinearGradient
          colors={isDark ? ['#1E293B', '#0F172A'] : ['#0F346E', '#16213E']}
          style={s.header}
        >
          <Ionicons name="checkmark-circle" size={40} color="#22C55E" />
          <Text style={s.headerTitle}>
            {deliveryId ? 'Delivery Complete!' : 'Trip Complete!'}
          </Text>
          <View style={s.fareRow}>
            <View style={s.fareItem}>
              <Text style={s.fareLabel}>Total Fare</Text>
              <Text style={s.fareVal}>₦{fareAmount.toLocaleString()}</Text>
            </View>
            <View style={s.fareDivider} />
            <View style={s.fareItem}>
              <Text style={s.fareLabel}>Commission (15%)</Text>
              <Text style={[s.fareVal, { color: '#F59E0B' }]}>-₦{commissionAmount.toLocaleString()}</Text>
            </View>
            <View style={s.fareDivider} />
            <View style={s.fareItem}>
              <Text style={s.fareLabel}>Your Earnings</Text>
              <Text style={[s.fareVal, { color: '#22C55E' }]}>₦{driverPayout.toLocaleString()}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Mandatory Notice */}
        <View style={[s.mandatoryNotice, { backgroundColor: isDark ? '#1E293B' : '#FFF7ED' }]}>
          <Ionicons name="lock-closed" size={16} color="#F59E0B" />
          <Text style={[s.mandatoryText, { color: isDark ? '#F59E0B' : '#92400E' }]}>
            Payment settlement is required to proceed. Select a method below.
          </Text>
        </View>

        {/* Error Banner */}
        {errorMsg && (
          <View style={[s.errorBanner, { backgroundColor: isDark ? '#3B1414' : '#FEF2F2' }]}>
            <Ionicons name="warning" size={18} color="#EF4444" />
            <Text style={[s.errorText, { color: '#EF4444' }]}>{errorMsg}</Text>
            {failCount >= 2 && (
              <Text style={[s.errorHint, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>
                Having trouble? Try "Handle Cash" if the rider paid cash.
              </Text>
            )}
          </View>
        )}

        {/* Payment Options */}
        <View style={s.options}>
          <Text style={[s.optionsTitle, { color: C.text }]}>How was the payment handled?</Text>

          {/* Option 1: Paystack */}
          {isPaystackEnabled && (
            <TouchableOpacity
              style={[
                s.optionCard,
                {
                  backgroundColor: selectedMethod === 'paystack' ? '#3B82F610' : C.surface,
                  borderColor: selectedMethod === 'paystack' ? '#3B82F6' : C.border,
                },
              ]}
              onPress={() => setSelectedMethod('paystack')}
              activeOpacity={0.8}
              disabled={processing}
            >
              <View style={[s.optionIcon, { backgroundColor: '#3B82F615' }]}>
                <MaterialCommunityIcons name="credit-card-outline" size={24} color="#3B82F6" />
              </View>
              <View style={s.optionInfo}>
                <Text style={[s.optionTitle, { color: C.text }]}>Paystack</Text>
                <Text style={[s.optionDesc, { color: C.textMuted }]}>
                  Pay ₦{fareAmount.toLocaleString()} via Paystack card / transfer. You receive ₦{driverPayout.toLocaleString()} to wallet.
                </Text>
              </View>
              {selectedMethod === 'paystack' && (
                <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />
              )}
            </TouchableOpacity>
          )}

          {/* Option 2: Flutterwave */}
          {isFlutterwaveEnabled && (
            <TouchableOpacity
              style={[
                s.optionCard,
                {
                  backgroundColor: selectedMethod === 'flutterwave' ? '#F5A62310' : C.surface,
                  borderColor: selectedMethod === 'flutterwave' ? '#F5A623' : C.border,
                },
              ]}
              onPress={() => setSelectedMethod('flutterwave')}
              activeOpacity={0.8}
              disabled={processing}
            >
              <View style={[s.optionIcon, { backgroundColor: '#F5A62315' }]}>
                <MaterialCommunityIcons name="credit-card-fast-outline" size={24} color="#F5A623" />
              </View>
              <View style={s.optionInfo}>
                <Text style={[s.optionTitle, { color: C.text }]}>Flutterwave</Text>
                <Text style={[s.optionDesc, { color: C.textMuted }]}>
                  Pay ₦{fareAmount.toLocaleString()} via Flutterwave card / bank. You receive ₦{driverPayout.toLocaleString()} to wallet.
                </Text>
              </View>
              {selectedMethod === 'flutterwave' && (
                <Ionicons name="checkmark-circle" size={24} color="#F5A623" />
              )}
            </TouchableOpacity>
          )}

          {/* Option 3: Cash */}
          {isCashEnabled && (
            <TouchableOpacity
              style={[
                s.optionCard,
                {
                  backgroundColor: !canHandleCash
                    ? (isDark ? '#1E293B' : '#F8FAFC')
                    : selectedMethod === 'cash' ? '#22C55E10' : C.surface,
                  borderColor: !canHandleCash
                    ? (isDark ? '#334155' : '#E2E8F0')
                    : selectedMethod === 'cash' ? '#22C55E' : C.border,
                  opacity: canHandleCash ? 1 : 0.6,
                },
              ]}
              onPress={() => canHandleCash && setSelectedMethod('cash')}
              activeOpacity={canHandleCash ? 0.8 : 1}
              disabled={!canHandleCash || processing}
            >
              <View style={[s.optionIcon, { backgroundColor: canHandleCash ? '#22C55E15' : '#EF444415' }]}>
                <MaterialCommunityIcons
                  name="cash"
                  size={24}
                  color={canHandleCash ? '#22C55E' : '#EF4444'}
                />
              </View>
              <View style={s.optionInfo}>
                <Text style={[s.optionTitle, { color: canHandleCash ? C.text : C.textMuted }]}>Handle Cash</Text>
                {canHandleCash ? (
                  <Text style={[s.optionDesc, { color: C.textMuted }]}>
                    Rider paid cash. ₦{cashDeduction.toLocaleString()} deducted from wallet (commission only).
                  </Text>
                ) : (
                  <Text style={[s.optionDesc, { color: '#EF4444' }]}>
                    Insufficient balance. Need ₦{cashDeduction.toLocaleString()}, have ₦{driverWalletBalance.toLocaleString()}. Top up first.
                  </Text>
                )}
              </View>
              {selectedMethod === 'cash' && canHandleCash && (
                <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
              )}
            </TouchableOpacity>
          )}

          {/* Wallet balance indicator */}
          <View style={[s.walletIndicator, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
            <Ionicons name="wallet-outline" size={18} color={Colors.driver.primary} />
            <Text style={[s.walletTxt, { color: C.textSecondary }]}>
              Wallet Balance: <Text style={{ fontWeight: '800', color: C.text }}>₦{driverWalletBalance.toLocaleString()}</Text>
            </Text>
          </View>
        </View>

        {/* Action Button */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[
              s.actionBtn,
              {
                backgroundColor: selectedMethod ? Colors.driver.primary : C.border,
              },
            ]}
            onPress={() => {
              if (selectedMethod === 'paystack') {
                setErrorMsg(null);
                setPaystackOpen(true);
                popup.checkout({
                  email: driverEmail || 'driver@goride.ng',
                  amount: fareAmount,
                  onSuccess: handlePaystackSuccess,
                  onCancel: handlePaystackCancel,
                });
              } else if (selectedMethod === 'flutterwave') {
                handleFlutterwavePayment();
              } else if (selectedMethod === 'cash') {
                handleCashSettlement();
              }
            }}
            disabled={!selectedMethod || processing}
            activeOpacity={0.85}
          >
            {processing ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={s.actionBtnTxt}>
                {selectedMethod === 'paystack'
                  ? `Pay ₦${fareAmount.toLocaleString()} with Paystack`
                  : selectedMethod === 'flutterwave'
                    ? `Pay ₦${fareAmount.toLocaleString()} with Flutterwave`
                    : selectedMethod === 'cash'
                      ? 'Confirm Cash Payment'
                      : 'Select Payment Method'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

          </>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalBottom: { margin: 0, justifyContent: 'flex-end' },
  modalCentered: { margin: 20, justifyContent: 'center' },
  containerBottom: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 12 },
      android: { elevation: 20 },
    }),
  },
  containerCentered: {
    borderRadius: 28,
    paddingVertical: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16 },
      android: { elevation: 24 },
    }),
  },
  header: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 10, marginBottom: 18 },
  fareRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 20,
  },
  fareItem: { flex: 1, alignItems: 'center' },
  fareLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: 4 },
  fareVal: { color: '#fff', fontSize: 16, fontWeight: '800' },
  fareDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 4 },

  // Mandatory notice
  mandatoryNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  mandatoryText: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 17 },

  // Error banner
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  errorText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  errorHint: { fontSize: 12, fontWeight: '500', fontStyle: 'italic', marginTop: 2 },

  options: { paddingHorizontal: 20, paddingTop: 16 },
  optionsTitle: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 12,
    gap: 14,
  },
  optionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  optionInfo: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  optionDesc: { fontSize: 12, lineHeight: 17 },
  walletIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  walletTxt: { fontSize: 13, fontWeight: '500' },
  footer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 34 },
  actionBtn: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnTxt: { fontSize: 17, fontWeight: '800', color: '#000' },

  // Success overlay
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  successTitle: { fontSize: 26, fontWeight: '800', marginTop: 8 },
  successSub: { fontSize: 15, marginTop: 8, marginBottom: 28 },
  successCard: { width: '100%', borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  successRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18 },
  successLabel: { fontSize: 14, fontWeight: '500' },
  successVal: { fontSize: 18, fontWeight: '800' },
  successDivider: { height: 1 },
});
