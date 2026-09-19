import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Platform, TextInput, ActivityIndicator, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import Modal from 'react-native-modal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import AlertModal from '@/components/AlertModal';

export default function PrivacySecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useAppContext();
  const { authUser, signOut } = useAuth();
  const C = Colors[colorScheme];

  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [locationSharing, setLocationSharing] = useState(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [dataCollection, setDataCollection] = useState(true);

  // Modals state
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info' as any });

  // Load Preferences
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const bio = await AsyncStorage.getItem(`bio_${authUser?.id}`);
        const loc = await AsyncStorage.getItem(`loc_${authUser?.id}`);
        const tfa = await AsyncStorage.getItem(`tfa_${authUser?.id}`);
        const data = await AsyncStorage.getItem(`data_${authUser?.id}`);

        if (bio !== null) setBiometricsEnabled(bio === 'true');
        if (loc !== null) setLocationSharing(loc === 'true');
        if (tfa !== null) setTwoFactorAuth(tfa === 'true');
        if (data !== null) setDataCollection(data === 'true');
      } catch (err) {
        console.warn('Error loading preferences', err);
      }
    };
    if (authUser?.id) loadPrefs();
  }, [authUser?.id]);

  const toggleBiometrics = async (value: boolean) => {
    if (value) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        setAlertConfig({ visible: true, title: 'Not Available', message: 'Biometrics are not set up on this device.', type: 'error' });
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable Biometric Login',
      });

      if (result.success) {
        setBiometricsEnabled(true);
        await AsyncStorage.setItem(`bio_${authUser?.id}`, 'true');
      }
    } else {
      setBiometricsEnabled(false);
      await AsyncStorage.setItem(`bio_${authUser?.id}`, 'false');
    }
  };

  const togglePreference = async (key: string, value: boolean, setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(value);
    await AsyncStorage.setItem(`${key}_${authUser?.id}`, value.toString());
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      setAlertConfig({ visible: true, title: 'Invalid', message: 'Password must be at least 6 characters.', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      setShowPwdModal(false);
      setNewPassword('');
      setAlertConfig({ visible: true, title: 'Success', message: 'Your password has been updated.', type: 'success' });
    } catch (err: any) {
      setAlertConfig({ visible: true, title: 'Error', message: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsLoading(true);
    try {
      // Soft delete: mark profile as deleted
      await supabase.from('profiles').update({ status: 'deleted' }).eq('id', authUser?.id);
      
      setShowDeleteModal(false);
      setAlertConfig({ visible: true, title: 'Account Deleted', message: 'Your account has been successfully deleted.', type: 'success' });
      
      setTimeout(async () => {
        await signOut();
      }, 1500);
    } catch (err: any) {
      setShowDeleteModal(false);
      setAlertConfig({ visible: true, title: 'Error', message: 'Could not delete account. Please contact support.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: C.text }]}>Privacy & Security</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: C.text }]}>Security Settings</Text>
          
          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={s.row}>
              <View style={s.rowLeft}>
                <View style={[s.iconBox, { backgroundColor: Colors.brand.primary + '15' }]}>
                  <Ionicons name="finger-print-outline" size={20} color={Colors.brand.primary} />
                </View>
                <View>
                  <Text style={[s.rowTitle, { color: C.text }]}>Biometric Login</Text>
                  <Text style={[s.rowSub, { color: C.textMuted }]}>Use Face ID or Touch ID</Text>
                </View>
              </View>
              <Switch
                value={biometricsEnabled}
                onValueChange={toggleBiometrics}
                trackColor={{ false: C.border, true: Colors.brand.primary }}
              />
            </View>

            <View style={[s.divider, { backgroundColor: C.border }]} />

            <View style={s.row}>
              <View style={s.rowLeft}>
                <View style={[s.iconBox, { backgroundColor: '#3B82F615' }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#3B82F6" />
                </View>
                <View>
                  <Text style={[s.rowTitle, { color: C.text }]}>Two-Factor Authentication</Text>
                  <Text style={[s.rowSub, { color: C.textMuted }]}>Require an extra step to log in</Text>
                </View>
              </View>
              <Switch
                value={twoFactorAuth}
                onValueChange={(val) => togglePreference('tfa', val, setTwoFactorAuth)}
                trackColor={{ false: C.border, true: '#3B82F6' }}
              />
            </View>

            <View style={[s.divider, { backgroundColor: C.border }]} />

            <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={() => setShowPwdModal(true)}>
              <View style={s.rowLeft}>
                <View style={[s.iconBox, { backgroundColor: C.surfaceAlt }]}>
                  <Ionicons name="key-outline" size={20} color={C.text} />
                </View>
                <View>
                  <Text style={[s.rowTitle, { color: C.text }]}>Change Password</Text>
                  <Text style={[s.rowSub, { color: C.textMuted }]}>Update your account password</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: C.text }]}>Data & Privacy</Text>

          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={s.row}>
              <View style={s.rowLeft}>
                <View style={[s.iconBox, { backgroundColor: '#F59E0B15' }]}>
                  <Ionicons name="location-outline" size={20} color="#F59E0B" />
                </View>
                <View>
                  <Text style={[s.rowTitle, { color: C.text }]}>Location Tracking</Text>
                  <Text style={[s.rowSub, { color: C.textMuted }]}>Allow app to use location in background</Text>
                </View>
              </View>
              <Switch
                value={locationSharing}
                onValueChange={(val) => togglePreference('loc', val, setLocationSharing)}
                trackColor={{ false: C.border, true: '#F59E0B' }}
              />
            </View>

            <View style={[s.divider, { backgroundColor: C.border }]} />

            <View style={s.row}>
              <View style={s.rowLeft}>
                <View style={[s.iconBox, { backgroundColor: '#8B5CF615' }]}>
                  <Ionicons name="analytics-outline" size={20} color="#8B5CF6" />
                </View>
                <View>
                  <Text style={[s.rowTitle, { color: C.text }]}>Data Collection</Text>
                  <Text style={[s.rowSub, { color: C.textMuted }]}>Help us improve the app</Text>
                </View>
              </View>
              <Switch
                value={dataCollection}
                onValueChange={(val) => togglePreference('data', val, setDataCollection)}
                trackColor={{ false: C.border, true: '#8B5CF6' }}
              />
            </View>
          </View>
        </View>

        <TouchableOpacity style={s.deleteBtn} activeOpacity={0.7} onPress={() => setShowDeleteModal(true)}>
          <Text style={s.deleteBtnTxt}>Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal isVisible={showPwdModal} onBackdropPress={() => setShowPwdModal(false)} useNativeDriver>
        <View style={[s.modalContent, { backgroundColor: C.surface }]}>
          <Image 
            source={require('@/assets/images/change_password.png')} 
            style={s.modalHeroImage}
            resizeMode="contain"
          />
          <Text style={[s.modalTitle, { color: C.text }]}>Change Password</Text>
          <Text style={[s.modalSub, { color: C.textSecondary }]}>Enter your new password below.</Text>
          
          <View style={[s.inputWrap, { backgroundColor: C.background, borderColor: C.border }]}>
            <Ionicons name="lock-closed-outline" size={20} color={C.textMuted} style={{ marginRight: 10 }} />
            <TextInput
              style={[s.input, { color: C.text }]}
              placeholder="New Password"
              placeholderTextColor={C.textMuted}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
          </View>
          
          <View style={s.modalActions}>
            <TouchableOpacity style={s.modalBtnCancel} onPress={() => setShowPwdModal(false)}>
              <Text style={[s.modalBtnCancelTxt, { color: C.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalBtnPri, { backgroundColor: Colors.brand.primary }]} onPress={handleChangePassword} disabled={isLoading}>
              {isLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.modalBtnPriTxt}>Update</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal isVisible={showDeleteModal} onBackdropPress={() => setShowDeleteModal(false)} useNativeDriver>
        <View style={[s.modalContent, { backgroundColor: C.surface }]}>
          <View style={s.dangerIconWrap}>
             <Ionicons name="warning-outline" size={32} color="#EF4444" />
          </View>
          <Text style={[s.modalTitle, { color: C.text, textAlign: 'center' }]}>Delete Account</Text>
          <Text style={[s.modalSub, { color: C.textSecondary, textAlign: 'center', marginBottom: 24 }]}>
            Are you sure you want to delete your account? This action is permanent and cannot be undone. All your data will be wiped.
          </Text>
          
          <View style={s.modalActions}>
            <TouchableOpacity style={[s.modalBtnCancel, { flex: 1 }]} onPress={() => setShowDeleteModal(false)}>
              <Text style={[s.modalBtnCancelTxt, { color: C.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalBtnPri, { backgroundColor: '#EF4444', flex: 1 }]} onPress={handleDeleteAccount} disabled={isLoading}>
              {isLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.modalBtnPriTxt}>Delete</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AlertModal
        isVisible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
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
  content: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, paddingRight: 16 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  rowSub: { fontSize: 12 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 70 },
  deleteBtn: { marginTop: 10, alignSelf: 'center', padding: 12 },
  deleteBtnTxt: { color: '#EF4444', fontWeight: '700', fontSize: 15 },
  
  modalContent: { padding: 24, borderRadius: 20 },
  modalHeroImage: { width: 120, height: 120, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  modalSub: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, marginBottom: 24 },
  input: { flex: 1, fontSize: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtnCancel: { paddingHorizontal: 16, height: 44, justifyContent: 'center', alignItems: 'center' },
  modalBtnCancelTxt: { fontSize: 15, fontWeight: '600' },
  modalBtnPri: { paddingHorizontal: 24, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  modalBtnPriTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  dangerIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EF444415', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
});
