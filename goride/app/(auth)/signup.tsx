import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import PhoneInput from '@/components/PhoneInput';

export default function UserSignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ phone?: string; email?: string }>();
  const { colorScheme } = useAppContext();
  const { signUpWithEmail, signUpWithPhone, signInWithGoogle, setSelectedRole } = useAuth();
  const C = Colors[colorScheme];

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(params.email || '');
  const [phone, setPhone] = useState(params.phone || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [wantsPromo, setWantsPromo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const refs = {
    lastName: useRef<TextInput>(null),
    email: useRef<TextInput>(null),
    phone: useRef<TextInput>(null),
    password: useRef<TextInput>(null),
    confirmPassword: useRef<TextInput>(null),
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'First name is required';
    if (!lastName.trim()) e.lastName = 'Last name is required';
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) e.email = 'Valid email is required';
    if (!phone.trim() || phone.trim().length < 8) e.phone = 'Valid phone number is required';
    if (password.length < 6) e.password = 'Password must be at least 6 characters';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    if (!agreedToTerms) e.terms = 'You must agree to Terms & Privacy Policy';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    await setSelectedRole('user');
    await signInWithGoogle();
    setLoading(false);
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setLoading(true);

    // Try email signup (primary), include phone in metadata
    const result = await signUpWithEmail(email.trim(), password, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      role: 'user',
    });

    setLoading(false);

    if (result.error) {
      if (result.error.includes('already registered')) {
        setErrors({ email: 'This email is already registered. Try signing in.' });
      } else {
        setErrors({ general: result.error });
      }
      return;
    }

    // Success — role is locked to user's profile and routes automatically.
    await setSelectedRole('user');
    router.replace('/(user)/(tabs)');
  };

  const renderInput = (
    label: string, value: string, onChange: (t: string) => void, icon: string,
    opts: {
      placeholder?: string; keyboardType?: TextInput['props']['keyboardType'];
      autoCapitalize?: TextInput['props']['autoCapitalize']; secureTextEntry?: boolean;
      ref?: React.RefObject<TextInput | null>; nextRef?: React.RefObject<TextInput | null>;
      error?: string; rightIcon?: React.ReactNode;
    } = {}
  ) => (
    <View style={s.inputGroup}>
      <Text style={[s.inputLabel, { color: C.textSecondary }]}>{label}</Text>
      <View style={[s.inputWrap, { backgroundColor: C.surface, borderColor: opts.error ? Colors.brand.danger : C.border }]}>
        <Ionicons name={icon as any} size={20} color={C.textMuted} style={{ marginRight: 12 }} />
        <TextInput
          ref={opts.ref as any}
          style={[s.input, { color: C.text }]}
          placeholder={opts.placeholder || ''}
          placeholderTextColor={C.textMuted}
          value={value}
          onChangeText={(t) => { onChange(t); }}
          keyboardType={opts.keyboardType}
          autoCapitalize={opts.autoCapitalize ?? 'words'}
          secureTextEntry={opts.secureTextEntry}
          returnKeyType={opts.nextRef ? 'next' : 'done'}
          onSubmitEditing={() => opts.nextRef?.current?.focus()}
        />
        {opts.rightIcon}
      </View>
      {opts.error ? <Text style={s.errorTxt}>{opts.error}</Text> : null}
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 20}>
        <ScrollView
          contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={true}
        >
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </TouchableOpacity>

          <View style={s.headerSection}>
            <LinearGradient colors={[Colors.brand.primary, Colors.brand.primaryLight]} style={s.logoCircle}>
              <Ionicons name="person-add" size={32} color="#fff" />
            </LinearGradient>
            <Text style={[s.title, { color: C.text }]}>Create Account</Text>
            <Text style={[s.subtitle, { color: C.textSecondary }]}>Sign up to start riding with GoRide</Text>
          </View>

          {errors.general ? (
            <View style={s.generalError}>
              <Ionicons name="alert-circle" size={18} color={Colors.brand.danger} />
              <Text style={s.generalErrorTxt}>{errors.general}</Text>
            </View>
          ) : null}

          <View style={s.nameRow}>
            <View style={{ flex: 1 }}>
              {renderInput('First Name', firstName, setFirstName, 'person-outline', {
                placeholder: 'John', nextRef: refs.lastName, error: errors.firstName,
              })}
            </View>
            <View style={{ flex: 1 }}>
              {renderInput('Last Name', lastName, setLastName, 'person-outline', {
                placeholder: 'Doe', ref: refs.lastName, nextRef: refs.email, error: errors.lastName,
              })}
            </View>
          </View>

          {renderInput('Email Address', email, setEmail, 'mail-outline', {
            placeholder: 'you@example.com', keyboardType: 'email-address', autoCapitalize: 'none',
            ref: refs.email, nextRef: refs.phone, error: errors.email,
          })}

          <View style={s.inputGroup}>
            <Text style={[s.inputLabel, { color: C.textSecondary }]}>Phone Number</Text>
            <PhoneInput
              ref={refs.phone}
              value={phone}
              onChangeText={(t) => { setPhone(t); setErrors(prev => ({ ...prev, phone: '' })); }}
              error={errors.phone}
            />
          </View>

          {renderInput('Password', password, setPassword, 'lock-closed-outline', {
            placeholder: 'Min 6 characters', secureTextEntry: !showPassword, autoCapitalize: 'none',
            ref: refs.password, nextRef: refs.confirmPassword, error: errors.password,
            rightIcon: (
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={C.textMuted} />
              </TouchableOpacity>
            ),
          })}

          {renderInput('Confirm Password', confirmPassword, setConfirmPassword, 'lock-closed-outline', {
            placeholder: 'Re-enter password', secureTextEntry: !showPassword, autoCapitalize: 'none',
            ref: refs.confirmPassword, error: errors.confirmPassword,
          })}

          {/* Terms */}
          <TouchableOpacity style={s.checkRow} onPress={() => setAgreedToTerms(!agreedToTerms)} activeOpacity={0.7}>
            <View style={[s.checkbox, { borderColor: errors.terms ? Colors.brand.danger : C.border, backgroundColor: agreedToTerms ? Colors.brand.primary : 'transparent' }]}>
              {agreedToTerms && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={[s.checkTxt, { color: C.textSecondary }]}>
              I agree to the <Text style={{ color: Colors.brand.primary, fontWeight: '700' }}>Terms of Service</Text> and <Text style={{ color: Colors.brand.primary, fontWeight: '700' }}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>
          {errors.terms ? <Text style={[s.errorTxt, { marginLeft: 36 }]}>{errors.terms}</Text> : null}

          <TouchableOpacity style={s.checkRow} onPress={() => setWantsPromo(!wantsPromo)} activeOpacity={0.7}>
            <View style={[s.checkbox, { borderColor: C.border, backgroundColor: wantsPromo ? Colors.brand.primary : 'transparent' }]}>
              {wantsPromo && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={[s.checkTxt, { color: C.textMuted }]}>Send me promotional offers and ride discounts</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: Colors.brand.primary, marginTop: 24 }]}
            activeOpacity={0.85} onPress={handleSignup} disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={[s.primaryBtnTxt, { color: '#fff' }]}>Create Account</Text>}
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.dividerRow}>
            <View style={[s.dividerLine, { backgroundColor: C.border }]} />
            <Text style={[s.dividerTxt, { color: C.textMuted }]}>or</Text>
            <View style={[s.dividerLine, { backgroundColor: C.border }]} />
          </View>

          <TouchableOpacity
            style={[s.googleBtn, { backgroundColor: C.surface, borderColor: C.border, marginBottom: 24 }]}
            activeOpacity={0.8}
            onPress={async () => {
              setLoading(true);
              await setSelectedRole('user');
              await signInWithGoogle();
              setLoading(false);
            }}
          >
            <Ionicons name="logo-google" size={20} color={colorScheme === 'dark' ? '#fff' : '#4285F4'} />
            <Text style={[s.googleBtnTxt, { color: C.text }]}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={s.loginLinkRow}>
            <Text style={[s.loginLinkTxt, { color: C.textSecondary }]}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={[s.loginLinkAction, { color: Colors.brand.primary }]}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerSection: { alignItems: 'center', marginTop: 8, marginBottom: 28 },
  logoCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 15, fontWeight: '500', textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },
  nameRow: { flexDirection: 'row', gap: 12 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 16, height: 56 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  errorTxt: { color: '#E53935', fontSize: 12, fontWeight: '500', marginTop: 4, marginLeft: 4 },
  generalError: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E5393512', borderRadius: 10, padding: 14, marginBottom: 16 },
  generalErrorTxt: { color: '#E53935', fontSize: 13, fontWeight: '600', flex: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkTxt: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 20 },
  primaryBtn: { height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, marginBottom: 16 },
  primaryBtnTxt: { fontSize: 16, fontWeight: '800' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1 },
  dividerTxt: { paddingHorizontal: 16, fontSize: 13, fontWeight: '600' },
  googleBtn: { height: 56, borderRadius: 12, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  googleBtnTxt: { fontSize: 16, fontWeight: '700' },
  loginLinkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  loginLinkTxt: { fontSize: 14, fontWeight: '500' },
  loginLinkAction: { fontSize: 14, fontWeight: '800' },
});
