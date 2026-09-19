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
import { supabase } from '@/lib/supabase';
import AlertModal from '@/components/AlertModal';

export default function WithdrawalRequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { authUser } = useAuth();
  const { colorScheme } = useAppContext();
  const C = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  const [amountStr, setAmountStr] = useState('');
  const [processing, setProcessing] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    onConfirm?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const amount = parseFloat(amountStr.replace(/,/g, '')) || 0;

  useEffect(() => {
    if (!authUser?.id) return;
    (async () => {
      // Fetch wallet balance
      const { data } = await supabase.from('wallets').select('balance').eq('id', authUser.id).single();
      if (data) setWalletBalance(parseFloat(data.balance) || 0);
      setLoadingConfig(false);
    })();
  }, [authUser?.id]);

  const handleWithdraw = async () => {
    if (!authUser?.bankName || !authUser?.accountNumber) {
      setAlertConfig({
        visible: true,
        title: 'Bank Details Missing',
        message: 'Please update your bank details in your profile before requesting a withdrawal.',
        type: 'warning',
        onConfirm: () => {
          setAlertConfig(prev => ({ ...prev, visible: false }));
          router.push('/(driver)/bank-details');
        }
      });
      return;
    }

    if (amount < 1000) {
      setAlertConfig({
        visible: true,
        title: 'Invalid Amount',
        message: 'Minimum withdrawal amount is ₦1,000.',
        type: 'warning'
      });
      return;
    }

    if (amount > walletBalance) {
      setAlertConfig({
        visible: true,
        title: 'Insufficient Balance',
        message: 'You cannot withdraw more than your current wallet balance.',
        type: 'error'
      });
      return;
    }

    setProcessing(true);

    try {
      // 1. Debit wallet
      const { data: debitData, error: debitError } = await supabase.rpc('debit_driver_wallet', {
        p_driver_id: authUser.id,
        p_amount: amount,
        p_description: `Withdrawal request to ${authUser.bankName} (${authUser.accountNumber})`,
        p_category: 'withdrawal'
      });

      if (debitError) throw debitError;
      const debitRes = typeof debitData === 'string' ? JSON.parse(debitData) : debitData;

      if (!debitRes.success) {
        throw new Error(debitRes.error || 'Failed to debit wallet');
      }

      // 1.5 Update transaction status to 'pending' (instead of the default 'completed')
      // This ensures the transaction history shows it as pending review
      if (debitRes.transaction_id) {
        await supabase
          .from('wallet_transactions')
          .update({ status: 'pending' })
          .eq('id', debitRes.transaction_id);
      }

      // 2. Create withdrawal request
      const { error: reqError } = await supabase.from('withdrawal_requests').insert({
        driver_id: authUser.id,
        amount: amount,
        bank_name: authUser.bankName,
        account_number: authUser.accountNumber,
        account_name: authUser.accountName || `${authUser.firstName} ${authUser.lastName}`,
        status: 'pending',
        wallet_transaction_id: debitRes.transaction_id
      });

      if (reqError) {
        console.error("Critical: Debit succeeded but request failed", reqError);
        throw new Error("Failed to create withdrawal request record. Please contact support.");
      }

      setAlertConfig({
        visible: true,
        title: 'Withdrawal Successful',
        message: `Your withdrawal of ₦${amount.toLocaleString()} has been received and is currently Pending Review. You will be notified once it is approved.`,
        type: 'success',
        onConfirm: () => {
          setAlertConfig(prev => ({ ...prev, visible: false }));
          router.back();
        }
      });
    } catch (err: any) {
      console.error('Withdrawal error:', err);
      setAlertConfig({
        visible: true,
        title: 'Withdrawal Failed',
        message: err.message || 'Something went wrong.',
        type: 'error'
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loadingConfig) {
    return (
      <View style={[s.root, { backgroundColor: C.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.driver.primary} />
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
          <Text style={[s.headerTitle, { color: isDark ? '#fff' : '#000' }]}>Withdraw Funds</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          
          <View style={[s.balanceCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[s.balanceLabel, { color: C.textSecondary }]}>Available Balance</Text>
            <Text style={[s.balanceVal, { color: C.text }]}>₦{walletBalance.toLocaleString()}</Text>
          </View>

          <View style={[s.inputCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[s.inputLabel, { color: C.textSecondary }]}>Amount to Withdraw (₦)</Text>
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
            <TouchableOpacity 
              onPress={() => {
                if (!processing) setAmountStr(walletBalance.toString());
              }} 
              style={[s.maxBtn, { opacity: processing ? 0.6 : 1 }]}
              disabled={processing}
            >
              <Text style={[s.maxBtnTxt, { color: Colors.driver.primary }]}>Withdraw All</Text>
            </TouchableOpacity>
          </View>

          <View style={[s.infoBox, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
            <MaterialCommunityIcons name="bank-outline" size={24} color="#3B82F6" />
            <View style={s.infoTextWrap}>
              <Text style={[s.infoTitle, { color: C.text }]}>Payout Destination</Text>
              {authUser?.bankName && authUser?.accountNumber ? (
                <>
                  <Text style={[s.infoDesc, { color: C.text }]}>{authUser.bankName}</Text>
                  <Text style={[s.infoDesc, { color: C.textSecondary }]}>{authUser.accountNumber}</Text>
                </>
              ) : (
                <Text style={[s.infoDesc, { color: '#EF4444' }]}>No bank details added.</Text>
              )}
            </View>
            <TouchableOpacity 
              onPress={() => {
                if (!processing) router.push('/(driver)/bank-details');
              }}
              disabled={processing}
              style={{ opacity: processing ? 0.5 : 1 }}
            >
              <Text style={{ color: Colors.driver.primary, fontWeight: '700' }}>Edit</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={[s.footer, { paddingBottom: insets.bottom + 20, backgroundColor: C.surface, borderTopColor: C.border }]}>
          <TouchableOpacity
            style={[s.payBtn, { backgroundColor: amount > 0 && amount <= walletBalance && !processing ? Colors.driver.primary : C.border }]}
            onPress={handleWithdraw}
            disabled={amount <= 0 || amount > walletBalance || processing}
            activeOpacity={0.8}
          >
            {processing ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color="#000" />
                <Text style={s.payBtnTxt}>Processing...</Text>
              </View>
            ) : (
              <Text style={s.payBtnTxt}>Request Withdrawal</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <AlertModal
        isVisible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={() => {
          if (alertConfig.onConfirm) alertConfig.onConfirm();
          else setAlertConfig(prev => ({ ...prev, visible: false }));
        }}
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
  balanceCard: { padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 20, alignItems: 'center' },
  balanceLabel: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  balanceVal: { fontSize: 28, fontWeight: '800' },

  inputCard: { padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 24, alignItems: 'center' },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, paddingBottom: 8, paddingHorizontal: 12 },
  currencySymbol: { fontSize: 32, fontWeight: '700', marginRight: 8 },
  input: { fontSize: 40, fontWeight: '800', minWidth: 120, textAlign: 'center' },
  maxBtn: { marginTop: 16, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: 'rgba(252, 202, 20, 0.15)' },
  maxBtnTxt: { fontWeight: '700', fontSize: 14 },
  
  infoBox: { flexDirection: 'row', padding: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center', gap: 14 },
  infoTextWrap: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  infoDesc: { fontSize: 13 },

  footer: { padding: 20, borderTopWidth: 1 },
  payBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  payBtnTxt: { fontSize: 18, fontWeight: '800', color: '#000' },
});
