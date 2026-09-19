import React, { useState, useRef, useEffect } from 'react';
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
import { supabase } from '@/lib/supabase';
import AlertModal from '@/components/AlertModal';
import { usePaystack } from 'react-native-paystack-webview';
import LottieView from 'lottie-react-native';

const { width } = Dimensions.get('window');
const PAYSTACK_PUBLIC_KEY = process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || '';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

const PRESET_AMOUNTS = [1000, 2000, 5000, 10000];

export default function WalletTopupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { authUser } = useAuth();
  const { colorScheme, paymentConfig } = useAppContext();
  const C = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

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

  const handlePaystackSuccess = async (response: any) => {
    setProcessing(true);
    console.log('PAYSTACK SUCCESS RESPONSE:', JSON.stringify(response, null, 2));
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-paystack-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          reference: typeof response.transactionRef === 'string' ? response.transactionRef : (response.transactionRef?.reference || response.reference),
          driver_id: authUser?.id,
          topup: true,
        }),
      });

      const result = await res.json();

      if (result.success) {
        setSuccessAmount(result.credited);
        setShowSuccess(true);
      } else {
        console.error('Paystack Edge Function Error:', result.details);
        throw new Error(result.error || 'Verification failed');
      }
    } catch (err: any) {
      console.error('Topup verification error:', err);
      setAlertConfig({
        visible: true,
        title: 'Payment Failed',
        message: err.message || 'Could not verify your payment. Please contact support if you were debited.',
        type: 'error'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleContinue = () => {
    if (paymentConfig?.paystackEnabled === false) {
      setAlertConfig({
        visible: true,
        title: 'Gateway Unavailable',
        message: 'Online top-up via Paystack is currently disabled by administrator.',
        type: 'warning'
      });
      return;
    }

    const minTopup = paymentConfig?.minWalletTopup || 500;
    if (amount < minTopup) {
      setAlertConfig({
        visible: true,
        title: 'Invalid Amount',
        message: `Minimum top-up amount is ₦${minTopup.toLocaleString()}`,
        type: 'warning'
      });
      return;
    }
    popup.checkout({
      email: authUser?.email || 'driver@goride.ng',
      amount: amount,
      onSuccess: handlePaystackSuccess,
      onCancel: () => setProcessing(false)
    });
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

          <View style={[s.infoBox, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
            <Ionicons name="shield-checkmark" size={24} color="#22C55E" />
            <View style={s.infoTextWrap}>
              <Text style={[s.infoTitle, { color: C.text }]}>Secure Payment</Text>
              <Text style={[s.infoDesc, { color: C.textSecondary }]}>
                Payments are processed securely via Paystack. Funds reflect in your wallet instantly.
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
              <Text style={s.payBtnTxt}>Pay ₦{amount.toLocaleString()}</Text>
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
  presetsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  presetChip: { flex: 1, minWidth: '45%', paddingVertical: 14, alignItems: 'center', borderRadius: 12, borderWidth: 1 },
  presetTxt: { fontSize: 16, fontWeight: '700' },
  
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
