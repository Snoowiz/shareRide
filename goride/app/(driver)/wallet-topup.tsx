import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import AlertModal from '@/components/AlertModal';
import { usePaystack } from 'react-native-paystack-webview';
import LottieView from 'lottie-react-native';
import { initializePayment, openFlutterwaveCheckout, verifyPayment, PaymentGatewayId } from '@/lib/paymentService';

const { width } = Dimensions.get('window');
const PRESET_AMOUNTS = [1000, 2000, 5000, 10000];

export default function WalletTopupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { authUser } = useAuth();
  const { colorScheme, paymentConfig } = useAppContext();
  const C = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  const isPaystackEnabled = paymentConfig?.paystackEnabled ?? true;
  const isFlutterwaveEnabled = paymentConfig?.flutterwaveEnabled ?? false;

  const [selectedGateway, setSelectedGateway] = useState<PaymentGatewayId>(
    isPaystackEnabled ? 'paystack' : (isFlutterwaveEnabled ? 'flutterwave' : 'paystack')
  );

  useEffect(() => {
    if (!isPaystackEnabled && isFlutterwaveEnabled) {
      setSelectedGateway('flutterwave');
    } else if (isPaystackEnabled && !isFlutterwaveEnabled) {
      setSelectedGateway('paystack');
    }
  }, [isPaystackEnabled, isFlutterwaveEnabled]);

  const [amountStr, setAmountStr] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successAmount, setSuccessAmount] = useState(0);
  const { popup } = usePaystack();

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

  const amount = parseFloat(amountStr.replace(/,/g, '')) || 0;

  // ── Paystack Success Handler ──
  const handlePaystackSuccess = async (response: any) => {
    setProcessing(true);
    try {
      const extractedRef =
        (typeof response?.transactionRef === 'string' ? response.transactionRef : null) ||
        response?.transactionRef?.reference ||
        response?.reference ||
        response?.trxref;

      if (!extractedRef) {
        throw new Error('Transaction reference missing from Paystack response.');
      }

      const result = await verifyPayment({
        gateway: 'paystack',
        reference: extractedRef,
        metadata: {
          driver_id: authUser?.id,
          topup: true,
          amount: amount,
        },
      });

      if (result.success) {
        setSuccessAmount(result.amount || amount);
        setShowSuccess(true);
      } else {
        throw new Error(result.error || 'Payment verification failed');
      }
    } catch (err: any) {
      console.error('Paystack topup error:', err);
      setAlertConfig({
        visible: true,
        title: 'Payment Verification Failed',
        message: err.message || 'Could not verify your payment. Please contact support if you were debited.',
        type: 'error',
      });
    } finally {
      setProcessing(false);
    }
  };

  // ── Flutterwave Checkout Flow ──
  const handleFlutterwaveCheckout = async () => {
    setProcessing(true);
    try {
      const initRes = await initializePayment({
        gateway: 'flutterwave',
        amount: amount,
        email: authUser?.email || 'driver@goride.ng',
        name: authUser ? `${authUser.firstName} ${authUser.lastName}`.trim() : 'GoRide Driver',
        phone: authUser?.phone || '',
        metadata: {
          driver_id: authUser?.id,
          topup: true,
          amount: amount,
        },
      });

      if (!initRes.success || !initRes.checkout_url) {
        throw new Error(initRes.error || 'Could not initialize Flutterwave checkout session.');
      }

      const checkoutRes = await openFlutterwaveCheckout(initRes.checkout_url);

      if (!checkoutRes.success) {
        if (!checkoutRes.cancelled) {
          setAlertConfig({
            visible: true,
            title: 'Payment Incomplete',
            message: checkoutRes.error || 'Payment session ended without confirmation.',
            type: 'warning',
          });
        }
        setProcessing(false);
        return;
      }

      // Verify transaction on backend
      const verifyRes = await verifyPayment({
        gateway: 'flutterwave',
        reference: checkoutRes.reference || initRes.reference || '',
        metadata: {
          driver_id: authUser?.id,
          topup: true,
          amount: amount,
        },
      });

      if (verifyRes.success) {
        setSuccessAmount(verifyRes.amount || amount);
        setShowSuccess(true);
      } else {
        throw new Error(verifyRes.error || 'Flutterwave payment verification failed.');
      }
    } catch (err: any) {
      console.error('Flutterwave topup error:', err);
      setAlertConfig({
        visible: true,
        title: 'Payment Failed',
        message: err.message || 'Payment processing failed. Please try again.',
        type: 'error',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleContinue = () => {
    if (!isPaystackEnabled && !isFlutterwaveEnabled) {
      setAlertConfig({
        visible: true,
        title: 'Gateways Unavailable',
        message: 'Online top-up is currently disabled by administrator.',
        type: 'warning',
      });
      return;
    }

    const minTopup = paymentConfig?.minWalletTopup || 500;
    if (amount < minTopup) {
      setAlertConfig({
        visible: true,
        title: 'Invalid Amount',
        message: `Minimum top-up amount is ₦${minTopup.toLocaleString()}`,
        type: 'warning',
      });
      return;
    }

    if (selectedGateway === 'paystack') {
      if (!isPaystackEnabled) {
        setAlertConfig({
          visible: true,
          title: 'Gateway Disabled',
          message: 'Paystack is currently disabled. Please select Flutterwave.',
          type: 'warning',
        });
        return;
      }

      popup.checkout({
        email: authUser?.email || 'driver@goride.ng',
        amount: amount,
        onSuccess: handlePaystackSuccess,
        onCancel: () => setProcessing(false),
      });
    } else if (selectedGateway === 'flutterwave') {
      if (!isFlutterwaveEnabled) {
        setAlertConfig({
          visible: true,
          title: 'Gateway Disabled',
          message: 'Flutterwave is currently disabled. Please select Paystack.',
          type: 'warning',
        });
        return;
      }

      handleFlutterwaveCheckout();
    }
  };

  if (showSuccess) {
    return (
      <View style={[s.successWrap, { backgroundColor: C.background }]}>
        <LottieView
          source={require('@/assets/lottie/success.json')}
          autoPlay
          loop={false}
          style={{ width: 200, height: 200 }}
        />
        <Text style={[s.successTitle, { color: C.text }]}>Top-up Successful!</Text>
        <Text style={[s.successSub, { color: C.textSecondary }]}>
          ₦{successAmount.toLocaleString()} has been added to your wallet.
        </Text>
        <TouchableOpacity
          style={[s.doneBtn, { backgroundColor: Colors.driver.primary }]}
          onPress={() => router.back()}
        >
          <Text style={s.doneBtnTxt}>Back to Earnings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <LinearGradient
        colors={isDark ? ['#1E293B', '#0F172A'] : ['#FCCA14', '#EAB308']}
        style={[s.header, { paddingTop: insets.top + 10 }]}
      >
        <View style={s.headerTop}>
          <TouchableOpacity 
            onPress={() => {
              if (!processing) router.back();
            }} 
            style={[s.backBtn, { opacity: processing ? 0.5 : 1 }]}
            disabled={processing}
          >
            <Ionicons name="chevron-back" size={28} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: isDark ? '#fff' : '#000' }]}>Top-up Wallet</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={[s.inputCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[s.inputLabel, { color: C.textSecondary }]}>Enter Amount (₦)</Text>
            <View style={[s.inputWrap, { borderColor: C.border }]}>
              <Text style={[s.currencySymbol, { color: C.text }]}>₦</Text>
              <TextInput
                style={[s.input, { color: C.text, opacity: processing ? 0.6 : 1 }]}
                value={amountStr}
                onChangeText={(text) => {
                  if (processing) return;
                  const numericValue = text.replace(/[^0-9]/g, '');
                  if (numericValue) {
                    setAmountStr(parseInt(numericValue).toLocaleString());
                  } else {
                    setAmountStr('');
                  }
                }}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={C.textMuted}
                maxLength={10}
                editable={!processing}
              />
            </View>
          </View>

          <Text style={[s.presetTitle, { color: C.textSecondary }]}>Quick Select</Text>
          <View style={s.presetsGrid}>
            {PRESET_AMOUNTS.map((val) => (
              <TouchableOpacity
                key={val}
                style={[
                  s.presetChip,
                  {
                    backgroundColor: amount === val ? Colors.driver.primary + '15' : C.surface,
                    borderColor: amount === val ? Colors.driver.primary : C.border,
                    opacity: processing ? 0.6 : 1,
                  }
                ]}
                onPress={() => {
                  if (!processing) setAmountStr(val.toLocaleString());
                }}
                disabled={processing}
              >
                <Text style={[
                  s.presetTxt,
                  { color: amount === val ? Colors.driver.primary : C.text }
                ]}>
                  ₦{val.toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Payment Gateway Selector (Only enabled gateways shown) */}
          <Text style={[s.presetTitle, { color: C.textSecondary, marginTop: 4 }]}>Payment Method</Text>
          <View style={s.gatewayContainer}>
            {isPaystackEnabled && (
              <TouchableOpacity
                style={[
                  s.gatewayCard,
                  {
                    backgroundColor: selectedGateway === 'paystack' ? '#3B82F610' : C.surface,
                    borderColor: selectedGateway === 'paystack' ? '#3B82F6' : C.border,
                  }
                ]}
                onPress={() => setSelectedGateway('paystack')}
                disabled={processing}
                activeOpacity={0.8}
              >
                <View style={[s.gatewayIcon, { backgroundColor: '#3B82F615' }]}>
                  <MaterialCommunityIcons name="credit-card-outline" size={24} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.gatewayTitle, { color: C.text }]}>Paystack</Text>
                  <Text style={[s.gatewayDesc, { color: C.textMuted }]}>Cards, USSD & Bank Transfers</Text>
                </View>
                {selectedGateway === 'paystack' && (
                  <Ionicons name="checkmark-circle" size={22} color="#3B82F6" />
                )}
              </TouchableOpacity>
            )}

            {isFlutterwaveEnabled && (
              <TouchableOpacity
                style={[
                  s.gatewayCard,
                  {
                    backgroundColor: selectedGateway === 'flutterwave' ? '#F5A62310' : C.surface,
                    borderColor: selectedGateway === 'flutterwave' ? '#F5A623' : C.border,
                  }
                ]}
                onPress={() => setSelectedGateway('flutterwave')}
                disabled={processing}
                activeOpacity={0.8}
              >
                <View style={[s.gatewayIcon, { backgroundColor: '#F5A62315' }]}>
                  <MaterialCommunityIcons name="credit-card-fast-outline" size={24} color="#F5A623" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.gatewayTitle, { color: C.text }]}>Flutterwave</Text>
                  <Text style={[s.gatewayDesc, { color: C.textMuted }]}>Cards, Mobile Money & Direct Pay</Text>
                </View>
                {selectedGateway === 'flutterwave' && (
                  <Ionicons name="checkmark-circle" size={22} color="#F5A623" />
                )}
              </TouchableOpacity>
            )}
          </View>

          <View style={[s.infoBox, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
            <Ionicons name="shield-checkmark" size={24} color="#22C55E" />
            <View style={s.infoTextWrap}>
              <Text style={[s.infoTitle, { color: C.text }]}>Encrypted & Secure</Text>
              <Text style={[s.infoDesc, { color: C.textSecondary }]}>
                Payments are processed securely via verified gateways. Funds reflect in your wallet immediately upon completion.
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={[s.footer, { paddingBottom: insets.bottom + 20, backgroundColor: C.surface, borderTopColor: C.border }]}>
          <TouchableOpacity
            style={[s.payBtn, { backgroundColor: amount > 0 && !processing ? Colors.driver.primary : C.border }]}
            onPress={handleContinue}
            disabled={amount <= 0 || processing}
            activeOpacity={0.8}
          >
            {processing ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color="#000" />
                <Text style={s.payBtnTxt}>Processing...</Text>
              </View>
            ) : (
              <Text style={s.payBtnTxt}>
                Pay ₦{amount.toLocaleString()} with {selectedGateway === 'flutterwave' ? 'Flutterwave' : 'Paystack'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
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
  header: { paddingBottom: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  
  content: { padding: 20 },
  inputCard: { padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 24, alignItems: 'center' },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, paddingBottom: 8, paddingHorizontal: 12 },
  currencySymbol: { fontSize: 32, fontWeight: '700', marginRight: 8 },
  input: { fontSize: 40, fontWeight: '800', minWidth: 120, textAlign: 'center' },
  
  presetTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  presetsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  presetChip: { flex: 1, minWidth: '45%', paddingVertical: 14, alignItems: 'center', borderRadius: 12, borderWidth: 1 },
  presetTxt: { fontSize: 16, fontWeight: '700' },

  gatewayContainer: { gap: 12, marginBottom: 28 },
  gatewayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  gatewayIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gatewayTitle: { fontSize: 16, fontWeight: '700' },
  gatewayDesc: { fontSize: 12, marginTop: 2 },
  
  infoBox: { flexDirection: 'row', padding: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center', gap: 14 },
  infoTextWrap: { flex: 1 },
  infoTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  infoDesc: { fontSize: 13, lineHeight: 18 },

  footer: { padding: 20, borderTopWidth: 1 },
  payBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  payBtnTxt: { fontSize: 18, fontWeight: '800', color: '#000' },

  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  successTitle: { fontSize: 24, fontWeight: '800', marginTop: 16 },
  successSub: { fontSize: 15, textAlign: 'center', marginTop: 8, marginBottom: 32 },
  doneBtn: { width: '100%', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  doneBtnTxt: { fontSize: 17, fontWeight: '800', color: '#000' },
});
