import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Animated,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth, AuthRole } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import PhoneInput from '@/components/PhoneInput';
import AlertModal from '@/components/AlertModal';

type LoginMethod = 'phone' | 'email';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useAppContext();
  const {
    selectedRole, signInWithEmail, signInWithPhone,
    signInWithGoogle, checkUserExists, setSelectedRole,
  } = useAuth();
  const params = useLocalSearchParams<{ role?: string }>();
  const role = (params.role as AuthRole) || selectedRole;
  const C = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  const [method, setMethod] = useState<LoginMethod>('phone');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<'identifier' | 'password'>('identifier');
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

  const passwordRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const isDriver = role === 'driver';
  const accentColor = isDriver ? Colors.brand.secondary : Colors.brand.primary;

  const animateTransition = (callback: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      callback();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const handleCheckIdentifier = async () => {
    const trimmed = identifier.trim();
    if (!trimmed) {
      setError(method === 'phone' ? 'Please enter your phone number' : 'Please enter your email');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const exists = await checkUserExists(trimmed, method);

      if (exists) {
        animateTransition(() => setStep('password'));
        setTimeout(() => passwordRef.current?.focus(), 350);
      } else {
        // Redirect to signup
        if (isDriver) {
          router.push({ pathname: '/(auth)/driver-signup', params: { [method]: trimmed } });
        } else {
          router.push({ pathname: '/(auth)/signup', params: { [method]: trimmed } });
        }
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }
    setLoading(true);
    setError('');

    const trimmed = identifier.trim();
    const result = method === 'email'
      ? await signInWithEmail(trimmed, password)
      : await signInWithPhone(trimmed, password);

    setLoading(false);

    if (result.error) {
      // Map common Supabase errors to friendly messages
      if (result.error.includes('Invalid login credentials')) {
        setError('Invalid password. Please try again.');
      } else if (result.error.includes('Email not confirmed')) {
        setError('Please check your email and confirm your account first.');
      } else {
        setError(result.error);
      }
      return;
    }

    // Success — AuthGate will route to the correct dashboard based on authUser.role.
    await setSelectedRole(role);
    router.replace(role === 'driver' ? '/(driver)/(tabs)' : '/(user)/(tabs)');
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    const result = await signInWithGoogle();
    setLoading(false);
    if (result.error) {
      setAlertConfig({
        visible: true,
        title: 'Google Sign-In',
        message: result.error,
        type: 'error'
      });
    }
    // OAuth will redirect via deep link — handled by auth state listener
  };

  const switchMethod = () => {
    animateTransition(() => {
      setMethod((m) => (m === 'phone' ? 'email' : 'phone'));
      setIdentifier('');
      setPassword('');
      setStep('identifier');
      setError('');
    });
  };

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 20}>
        <ScrollView
          contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={true}
        >
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
              <Ionicons name={isDriver ? 'car-sport' : 'person'} size={32} color={isDriver ? '#000' : '#fff'} />
            </LinearGradient>
            <Text style={[s.title, { color: C.text }]}>
              {isDriver ? 'Driver Login' : 'Welcome Back'}
            </Text>
            <Text style={[s.subtitle, { color: C.textSecondary }]}>
              {step === 'identifier'
                ? `Enter your ${method === 'phone' ? 'phone number' : 'email'} to continue`
                : 'Enter your password to sign in'}
            </Text>
          </View>

          {/* Method Toggle */}
          <View style={[s.toggleRow, { backgroundColor: C.surfaceAlt }]}>
            <TouchableOpacity
              style={[s.toggleBtn, method === 'phone' && { backgroundColor: accentColor }]}
              onPress={() => method !== 'phone' && switchMethod()}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={16} color={method === 'phone' ? (isDriver ? '#000' : '#fff') : C.textMuted} />
              <Text style={[s.toggleTxt, { color: method === 'phone' ? (isDriver ? '#000' : '#fff') : C.textMuted }]}>Phone</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.toggleBtn, method === 'email' && { backgroundColor: accentColor }]}
              onPress={() => method !== 'email' && switchMethod()}
              activeOpacity={0.8}
            >
              <Ionicons name="mail" size={16} color={method === 'email' ? (isDriver ? '#000' : '#fff') : C.textMuted} />
              <Text style={[s.toggleTxt, { color: method === 'email' ? (isDriver ? '#000' : '#fff') : C.textMuted }]}>Email</Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <Animated.View style={{ opacity: fadeAnim }}>
            {step === 'identifier' ? (
              <View style={s.formSection}>
                <Text style={[s.inputLabel, { color: C.textSecondary }]}>
                  {method === 'phone' ? 'Phone Number' : 'Email Address'}
                </Text>
                {method === 'phone' ? (
                  <PhoneInput
                    value={identifier}
                    onChangeText={(t) => { setIdentifier(t); setError(''); }}
                    error={error}
                    isDriver={isDriver}
                  />
                ) : (
                  <>
                    <View style={[s.inputWrap, { backgroundColor: C.surface, borderColor: error ? Colors.brand.danger : C.border }]}>
                      <Ionicons
                        name="mail-outline"
                        size={20} color={C.textMuted} style={{ marginRight: 12 }}
                      />
                      <TextInput
                        style={[s.input, { color: C.text }]}
                        placeholder="you@example.com"
                        placeholderTextColor={C.textMuted}
                        value={identifier}
                        onChangeText={(t) => { setIdentifier(t); setError(''); }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="next"
                        onSubmitEditing={handleCheckIdentifier}
                      />
                    </View>
                    {!!error && <Text style={s.errorTxt}>{error}</Text>}
                  </>
                )}

                <TouchableOpacity
                  style={[s.primaryBtn, { backgroundColor: accentColor }]}
                  activeOpacity={0.85}
                  onPress={handleCheckIdentifier}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={isDriver ? '#000' : '#fff'} />
                  ) : (
                    <Text style={[s.primaryBtnTxt, { color: isDriver ? '#000' : '#fff' }]}>Continue</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.formSection}>
                <Text style={[s.inputLabel, { color: C.textSecondary }]}>Password</Text>
                <View style={[s.inputWrap, { backgroundColor: C.surface, borderColor: error ? Colors.brand.danger : C.border }]}>
                  <Ionicons name="lock-closed-outline" size={20} color={C.textMuted} style={{ marginRight: 12 }} />
                  <TextInput
                    ref={passwordRef}
                    style={[s.input, { color: C.text }]}
                    placeholder="Enter password"
                    placeholderTextColor={C.textMuted}
                    value={password}
                    onChangeText={(t) => { setPassword(t); setError(''); }}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={C.textMuted} />
                  </TouchableOpacity>
                </View>
                {!!error && <Text style={s.errorTxt}>{error}</Text>}

                <TouchableOpacity 
                  style={{ alignSelf: 'flex-end', marginBottom: 16 }}
                  onPress={() => router.push({ pathname: '/(auth)/forgot-password', params: { email: method === 'email' ? identifier : '' } })}
                >
                  <Text style={[s.forgotTxt, { color: accentColor }]}>Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.primaryBtn, { backgroundColor: accentColor }]}
                  activeOpacity={0.85}
                  onPress={handleLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={isDriver ? '#000' : '#fff'} />
                  ) : (
                    <Text style={[s.primaryBtnTxt, { color: isDriver ? '#000' : '#fff' }]}>Sign In</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => animateTransition(() => { setStep('identifier'); setPassword(''); setError(''); })}>
                  <Text style={[s.changeTxt, { color: C.textSecondary }]}>
                    Use a different {method === 'phone' ? 'phone number' : 'email'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>

          {/* Divider */}
          <View style={s.dividerRow}>
            <View style={[s.dividerLine, { backgroundColor: C.border }]} />
            <Text style={[s.dividerTxt, { color: C.textMuted }]}>or</Text>
            <View style={[s.dividerLine, { backgroundColor: C.border }]} />
          </View>

          {/* Google Auth */}
          <TouchableOpacity
            style={[s.googleBtn, { backgroundColor: C.surface, borderColor: C.border }]}
            activeOpacity={0.8}
            onPress={handleGoogleAuth}
          >
            <Ionicons name="logo-google" size={20} color={isDark ? '#fff' : '#4285F4'} />
            <Text style={[s.googleBtnTxt, { color: C.text }]}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View style={s.signupLinkRow}>
            <Text style={[s.signupLinkTxt, { color: C.textSecondary }]}>
              {isDriver ? "Don't have a driver account? " : "Don't have an account? "}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (isDriver) {
                  router.push('/(auth)/driver-signup');
                } else {
                  router.push('/(auth)/signup');
                }
              }}
            >
              <Text style={[s.signupLinkAction, { color: accentColor }]}>Sign Up</Text>
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
  scrollContent: { paddingHorizontal: 24 },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerSection: { alignItems: 'center', marginTop: 12, marginBottom: 32 },
  logoCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 15, fontWeight: '500', textAlign: 'center', lineHeight: 22 },
  toggleRow: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 28 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10 },
  toggleTxt: { fontSize: 14, fontWeight: '700' },
  formSection: { marginBottom: 24 },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 16, height: 56, marginBottom: 16 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  errorTxt: { color: '#E53935', fontSize: 13, fontWeight: '500', marginBottom: 12, marginLeft: 4 },
  forgotTxt: { fontSize: 14, fontWeight: '600' },
  primaryBtn: { height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
  primaryBtnTxt: { fontSize: 16, fontWeight: '800' },
  changeTxt: { textAlign: 'center', fontSize: 14, fontWeight: '500', marginTop: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1 },
  dividerTxt: { marginHorizontal: 16, fontSize: 13, fontWeight: '500' },
  googleBtn: { height: 56, borderRadius: 12, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 24 },
  googleBtnTxt: { fontSize: 16, fontWeight: '700' },
  signupLinkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  signupLinkTxt: { fontSize: 14, fontWeight: '500' },
  signupLinkAction: { fontSize: 14, fontWeight: '800' },
});
