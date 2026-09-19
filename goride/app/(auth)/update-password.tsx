import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import AlertModal from '@/components/AlertModal';

export default function UpdatePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useAppContext();
  const { updatePassword, selectedRole } = useAuth();
  
  const C = Colors[colorScheme];
  const isDriver = selectedRole === 'driver';
  const accentColor = isDriver ? Colors.brand.secondary : Colors.brand.primary;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const handleUpdate = async () => {
    if (!password) {
      setError('Please enter a new password');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    const { error: updateError } = await updatePassword(password);
    
    setLoading(false);
    
    if (updateError) {
      setAlertConfig({
        visible: true,
        title: 'Update Failed',
        message: updateError,
        type: 'error',
      });
    } else {
      setAlertConfig({
        visible: true,
        title: 'Password Updated',
        message: 'Your password has been successfully updated.',
        type: 'success',
      });
    }
  };

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 12 }]}>
          {/* Header */}
          <View style={s.headerSection}>
            <LinearGradient
              colors={isDriver ? [Colors.brand.secondary, Colors.brand.secondaryLight] : [Colors.brand.primary, Colors.brand.primaryLight]}
              style={s.logoCircle}
            >
              <Ionicons name="key" size={32} color={isDriver ? '#000' : '#fff'} />
            </LinearGradient>
            <Text style={[s.title, { color: C.text }]}>New Password</Text>
            <Text style={[s.subtitle, { color: C.textSecondary }]}>
              Please create a new password that you don't use on any other site.
            </Text>
          </View>

          {/* Form */}
          <View style={s.formSection}>
            <Text style={[s.inputLabel, { color: C.textSecondary }]}>New Password</Text>
            <View style={[s.inputWrap, { backgroundColor: C.surface, borderColor: error ? Colors.brand.danger : C.border }]}>
              <Ionicons name="lock-closed-outline" size={20} color={C.textMuted} style={{ marginRight: 12 }} />
              <TextInput
                style={[s.input, { color: C.text }]}
                placeholder="Enter new password"
                placeholderTextColor={C.textMuted}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(''); }}
                secureTextEntry={!showPassword}
                returnKeyType="next"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={C.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[s.inputLabel, { color: C.textSecondary, marginTop: 8 }]}>Confirm New Password</Text>
            <View style={[s.inputWrap, { backgroundColor: C.surface, borderColor: error ? Colors.brand.danger : C.border }]}>
              <Ionicons name="lock-closed-outline" size={20} color={C.textMuted} style={{ marginRight: 12 }} />
              <TextInput
                style={[s.input, { color: C.text }]}
                placeholder="Confirm new password"
                placeholderTextColor={C.textMuted}
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); setError(''); }}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleUpdate}
              />
            </View>
            {!!error && <Text style={s.errorTxt}>{error}</Text>}

            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: accentColor, marginTop: 12 }]}
              activeOpacity={0.85}
              onPress={handleUpdate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={isDriver ? '#000' : '#fff'} />
              ) : (
                <Text style={[s.primaryBtnTxt, { color: isDriver ? '#000' : '#fff' }]}>Update Password</Text>
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
             router.replace(selectedRole === 'driver' ? '/(driver)/(tabs)' : '/(user)/(tabs)');
          }
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  headerSection: { alignItems: 'center', marginTop: 40, marginBottom: 32 },
  logoCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 15, fontWeight: '500', textAlign: 'center', lineHeight: 22, paddingHorizontal: 10 },
  formSection: { marginBottom: 24 },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 16, height: 56, marginBottom: 12 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  errorTxt: { color: '#E53935', fontSize: 13, fontWeight: '500', marginBottom: 12, marginLeft: 4 },
  primaryBtn: { height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
  primaryBtnTxt: { fontSize: 16, fontWeight: '800' },
});
