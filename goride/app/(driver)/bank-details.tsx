import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import AlertModal from '@/components/AlertModal';

export default function BankDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { authUser, updateAuthUser } = useAuth();
  const { colorScheme } = useAppContext();
  const C = Colors[colorScheme];
  const accentColor = Colors.driver.primary;

  const [bankName, setBankName] = useState(authUser?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(authUser?.accountNumber || '');
  const [accountName, setAccountName] = useState(authUser?.accountName || '');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
    onConfirm?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  useEffect(() => {
    if (authUser?.id) {
      fetchBankDetails();
    }
  }, [authUser?.id]);

  const fetchBankDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('bank_name, account_number, account_name')
        .eq('id', authUser?.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setBankName(data.bank_name || '');
        setAccountNumber(data.account_number || '');
        setAccountName(data.account_name || '');

        // Update context if it was missing
        if (!authUser?.bankName) {
          updateAuthUser({
            bankName: data.bank_name || '',
            accountNumber: data.account_number || '',
            accountName: data.account_name || '',
          });
        }
      }
    } catch (err: any) {
      console.error('Error fetching bank details:', err);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: 'Please fill in all bank account details.',
        type: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('driver_profiles')
        .upsert({
          id: authUser?.id,
          bank_name: bankName.trim(),
          account_number: accountNumber.trim(),
          account_name: accountName.trim(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) throw error;

      // Update global context
      updateAuthUser({
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
      });

      setAlertConfig({
        visible: true,
        title: 'Success',
        message: 'Bank details updated successfully',
        type: 'success',
        onConfirm: () => setAlertConfig({ ...alertConfig, visible: false })
      });
    } catch (err: any) {
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: err.message || 'Failed to update bank details',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (label: string, value: string, onChange: (t: string) => void, icon: string, placeholder: string, keyboardType: any = 'default') => (
    <View style={s.inputGroup}>
      <Text style={[s.label, { color: C.textSecondary }]}>{label}</Text>
      <View style={[s.inputWrap, { backgroundColor: C.surface, borderColor: C.border }]}>
        <Ionicons name={icon as any} size={20} color={C.textMuted} style={{ marginRight: 12 }} />
        <TextInput
          style={[s.input, { color: C.text }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.textMuted}
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );

  if (fetching) {
    return (
      <View style={[s.root, { backgroundColor: C.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(driver)/(tabs)/profile')} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: C.text }]}>Bank Account</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading} style={s.saveBtn}>
          {loading ? <ActivityIndicator size="small" color={accentColor} /> : (
            <Text style={[s.saveBtnTxt, { color: accentColor }]}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.infoSection}>
            <View style={[s.infoIcon, { backgroundColor: accentColor + '15' }]}>
              <Ionicons name="card" size={32} color={accentColor} />
            </View>
            <Text style={[s.infoTitle, { color: C.text }]}>Payout Method</Text>
            <Text style={[s.infoSub, { color: C.textSecondary }]}>
              Enter your bank details accurately to ensure smooth and timely payouts of your earnings.
            </Text>
          </View>

          <View style={s.form}>
            {renderInput('Bank Name', bankName, setBankName, 'business-outline', 'e.g. Zenith Bank')}
            {renderInput('Account Number', accountNumber, setAccountNumber, 'keypad-outline', '10 digit account number', 'number-pad')}
            {renderInput('Account Name', accountName, setAccountName, 'person-outline', 'Full name as it appears on bank statement')}
          </View>

          <View style={[s.warningCard, { backgroundColor: Colors.brand.warning + '10', borderColor: Colors.brand.warning + '30' }]}>
            <Ionicons name="information-circle" size={20} color={Colors.brand.warning} />
            <Text style={[s.warningTxt, { color: C.textSecondary }]}>
              Please ensure the account name matches your registered GoRide name to avoid payment delays.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AlertModal
        isVisible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={alertConfig.onConfirm}
        onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  saveBtn: { paddingHorizontal: 12, height: 40, justifyContent: 'center' },
  saveBtnTxt: { fontSize: 16, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingTop: 24 },
  infoSection: { alignItems: 'center', marginBottom: 32 },
  infoIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  infoTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  infoSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  form: { gap: 4 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 16, height: 56 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  warningCard: { flexDirection: 'row', padding: 16, borderRadius: 12, borderWidth: 1, marginTop: 12, gap: 12, alignItems: 'flex-start' },
  warningTxt: { flex: 1, fontSize: 13, lineHeight: 18 },
});
