import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import AlertModal from '@/components/AlertModal';
import { triggerPasswordResetEmail } from '@/lib/notifications';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useAppContext();
  const { resetPassword, selectedRole } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  
  const C = Colors[colorScheme];
  const isDriver = selectedRole === 'driver';
  const accentColor = isDriver ? Colors.brand.secondary : Colors.brand.primary;

  const [email, setEmail] = useState(params.email || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

  const handleSendLink = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    setError('');

    const { error: resetError } = await resetPassword(trimmed);
    
    // Trigger branded GoRide transactional email notification via centralized backend
    if (!resetError) {
      await triggerPasswordResetEmail({
        email: trimmed,
        resetLink: `https://goride.app/reset-password?email=${encodeURIComponent(trimmed)}`,
      }).catch(err => console.warn('Transactional reset email warning:', err));
    }

    setLoading(false);
    
    if (resetError) {
      setAlertConfig({
        visible: true,
        title: 'Reset Failed',
        message: resetError,
        type: 'error',
      });
    } else {
      setAlertConfig({
        visible: true,
        title: 'Check your email',
        message: 'We have sent you a password reset link. Please check your inbox and spam folder.',
        type: 'success',
      });
    }
  };

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 12 }]}>
          {/* Back Button */}
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </TouchableOpacity>

          {/* Header */}
          <View style={s.headerSection}>
            <LinearGradient
              colors={isDriver ? [Colors.brand.secondary, Colors.brand.secondaryLight] : [Colors.brand.primary, Colors.brand.primaryLight]}
              style={s.logoCircle}
            >
              <Ionicons name="lock-closed" size={32} color={isDriver ? '#000' : '#fff'} />
            </LinearGradient>
            <Text style={[s.title, { color: C.text }]}>Reset Password</Text>
            <Text style={[s.subtitle, { color: C.textSecondary }]}>
              Enter your email address and we'll send you a link to reset your password.
            </Text>
          </View>

          {/* Form */}
          <View style={s.formSection}>
            <Text style={[s.inputLabel, { color: C.textSecondary }]}>Email Address</Text>
            <View style={[s.inputWrap, { backgroundColor: C.surface, borderColor: error ? Colors.brand.danger : C.border }]}>
              <Ionicons name="mail-outline" size={20} color={C.textMuted} style={{ marginRight: 12 }} />
              <TextInput
                style={[s.input, { color: C.text }]}
                placeholder="you@example.com"
                placeholderTextColor={C.textMuted}
                value={email}
                onChangeText={(t) => { setEmail(t); setError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={handleSendLink}
              />
            </View>
            {!!error && <Text style={s.errorTxt}>{error}</Text>}

            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: accentColor, marginTop: 12 }]}
              activeOpacity={0.85}
              onPress={handleSendLink}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={isDriver ? '#000' : '#fff'} />
              ) : (
                <Text style={[s.primaryBtnTxt, { color: isDriver ? '#000' : '#fff' }]}>Send Reset Link</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AlertModal
        isVisible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => {
          setAlertConfig(prev => ({ ...prev, visible: false }));
          if (alertConfig.type === 'success') {
            router.back();
          }
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerSection: { alignItems: 'center', marginTop: 12, marginBottom: 32 },
  logoCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 15, fontWeight: '500', textAlign: 'center', lineHeight: 22, paddingHorizontal: 10 },
  formSection: { marginBottom: 24 },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 16, height: 56, marginBottom: 8 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  errorTxt: { color: '#E53935', fontSize: 13, fontWeight: '500', marginBottom: 12, marginLeft: 4 },
  primaryBtn: { height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
  primaryBtnTxt: { fontSize: 16, fontWeight: '800' },
});
